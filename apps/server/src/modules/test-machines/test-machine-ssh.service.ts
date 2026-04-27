import { Injectable } from '@nestjs/common';
import { Client, type ConnectConfig, type SFTPWrapper } from 'ssh2';
import type { TestMachineConfig } from './test-machines.types';

interface ExecOptions {
  allowNonZeroExit?: boolean;
  timeoutMs?: number;
}

export interface ExecResult {
  code: number | null;
  signal: string | null;
  stderr: string;
  stdout: string;
}

function quoteShellArg(value: string) {
  return `'${value.replace(/'/g, `'\"'\"'`)}'`;
}

function buildPrivilegedPrefix(username: string) {
  return username === 'root' ? '' : 'sudo -n ';
}

@Injectable()
export class TestMachineSshService {
  async connect(config: TestMachineConfig) {
    const client = new Client();

    await new Promise<void>((resolve, reject) => {
      const onReady = () => {
        cleanup();
        resolve();
      };

      const onError = (error: Error) => {
        cleanup();
        reject(error);
      };

      const cleanup = () => {
        client.off('ready', onReady);
        client.off('error', onError);
      };

      client.on('ready', onReady);
      client.on('error', onError);
      client.connect({
        host: config.host,
        password: config.password,
        port: config.port,
        readyTimeout: 15_000,
        tryKeyboard: false,
        username: config.username,
      } satisfies ConnectConfig);
    });

    return new TestMachineRemoteSession(client, buildPrivilegedPrefix(config.username));
  }
}

export class TestMachineRemoteSession {
  constructor(
    private readonly client: Client,
    private readonly privilegedPrefix: string,
  ) {}

  async exec(command: string, options: ExecOptions = {}) {
    const wrappedCommand = `bash -lc ${quoteShellArg(`${this.privilegedPrefix}${command}`)}`;
    const timeoutMs = options.timeoutMs ?? 30_000;

    return new Promise<ExecResult>((resolve, reject) => {
      let settled = false;
      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];
      const timer = setTimeout(() => {
        if (settled) {
          return;
        }

        settled = true;
        reject(new Error(`命令执行超时：${command}`));
      }, timeoutMs);

      this.client.exec(wrappedCommand, (error, stream) => {
        if (error) {
          clearTimeout(timer);
          if (!settled) {
            settled = true;
            reject(error);
          }
          return;
        }

        stream.on('data', (chunk: Buffer | string) => {
          stdoutChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });

        stream.stderr.on('data', (chunk: Buffer | string) => {
          stderrChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });

        stream.on('close', (code: number | null, signal: string | null) => {
          clearTimeout(timer);
          if (settled) {
            return;
          }

          const result = {
            code,
            signal,
            stderr: Buffer.concat(stderrChunks).toString('utf8').trim(),
            stdout: Buffer.concat(stdoutChunks).toString('utf8').trim(),
          } satisfies ExecResult;

          if (!options.allowNonZeroExit && code !== 0) {
            settled = true;
            reject(
              new Error(
                result.stderr || result.stdout || `命令执行失败：${command}`,
              ),
            );
            return;
          }

          settled = true;
          resolve(result);
        });
      });
    });
  }

  async uploadFile(targetPath: string, content: Buffer, mode = 0o644) {
    const tempPath = `/tmp/zt-mgmt-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    await this.writeTempFile(tempPath, content, mode);

    try {
      await this.exec(
        `install -m ${mode.toString(8)} ${quoteShellArg(tempPath)} ${quoteShellArg(targetPath)}`,
      );
    } finally {
      await this.exec(`rm -f ${quoteShellArg(tempPath)}`, {
        allowNonZeroExit: true,
        timeoutMs: 10_000,
      }).catch(() => undefined);
    }
  }

  close() {
    this.client.end();
  }

  private async getSftp() {
    return new Promise<SFTPWrapper>((resolve, reject) => {
      this.client.sftp((error, sftp) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(sftp);
      });
    });
  }

  private async writeTempFile(path: string, content: Buffer, mode: number) {
    const sftp = await this.getSftp();

    await new Promise<void>((resolve, reject) => {
      const stream = sftp.createWriteStream(path, {
        mode,
      });

      stream.on('close', () => {
        sftp.end();
        resolve();
      });
      stream.on('error', (error: Error) => {
        sftp.end();
        reject(error);
      });
      stream.end(content);
    });
  }
}
