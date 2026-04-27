import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  TestMachine as TestMachineRecord,
  TestMachineStatus as PrismaTestMachineStatus,
  TestMachineSwitchLog as TestMachineSwitchLogRecord,
  TestMachineSwitchStatus as PrismaTestMachineSwitchStatus,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { decryptString, encryptString } from '../../common/utils/crypto.util';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ControllersService } from '../controllers/controllers.service';
import { UsersService } from '../users/users.service';
import { ZtncuiService } from '../ztncui/ztncui.service';
import { CreateTestMachineDto } from './dto/create-test-machine.dto';
import { SwitchTestMachineNetworkDto } from './dto/switch-test-machine-network.dto';
import { UpdateTestMachineDto } from './dto/update-test-machine.dto';
import {
  TestMachineConfig,
  TestMachineDto,
  TestMachineSshTestResult,
  TestMachineSwitchLogDto,
  TestMachineSwitchResult,
} from './test-machines.types';
import { TestMachineRemoteSession, TestMachineSshService } from './test-machine-ssh.service';

const ZEROTIER_HOME_PATH = '/var/lib/zerotier-one';
const ZEROTIER_PLANET_PATH = `${ZEROTIER_HOME_PATH}/planet`;
const ZEROTIER_PLANET_BACKUP_PATH = `${ZEROTIER_HOME_PATH}/planet.zt-mgmt.bak`;
const DEFAULT_LOG_LIMIT = 20;
const MAX_LOG_LIMIT = 100;

type TestMachineDtoRecord = Pick<
  TestMachineRecord,
  | 'currentControllerId'
  | 'currentMemberId'
  | 'currentNetworkId'
  | 'currentNetworkName'
  | 'currentNodeId'
  | 'enabled'
  | 'host'
  | 'id'
  | 'lastCheckedAt'
  | 'lastSwitchAt'
  | 'lastSwitchMessage'
  | 'name'
  | 'port'
  | 'remark'
  | 'status'
  | 'switchStatus'
  | 'username'
>;

type TestMachineLogRecord = Pick<
  TestMachineSwitchLogRecord,
  | 'detailLog'
  | 'finishedAt'
  | 'id'
  | 'machineId'
  | 'memberId'
  | 'nodeId'
  | 'startedAt'
  | 'status'
  | 'summary'
  | 'targetControllerId'
  | 'targetNetworkId'
  | 'targetNetworkName'
> & {
  operatorUser: {
    username: string;
  };
};

interface PrismaLikeError {
  code?: string;
}

interface RemoteNodeInfo {
  nodeId: string;
  version: string | null;
}

interface RemoteNetworkInfo {
  name: string | null;
  networkId: string;
  status: string | null;
}

function buildHiddenKey(controllerId: number, networkId: string) {
  return `${controllerId}:${networkId}`;
}

function isPrismaLikeError(error: unknown): error is PrismaLikeError {
  return typeof error === 'object' && error !== null;
}

function normalizeOptionalText(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeRequiredText(value: string) {
  const normalized = value.trim();
  if (!normalized) {
    throw new BadRequestException('字段不能为空');
  }
  return normalized;
}

@Injectable()
export class TestMachinesService {
  private readonly machineLocks = new Map<number, Promise<void>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly controllersService: ControllersService,
    private readonly usersService: UsersService,
    private readonly ztncuiService: ZtncuiService,
    private readonly sshService: TestMachineSshService,
  ) {}

  async list(user: AuthenticatedUser) {
    const [machines, controllers, hiddenNetworkKeys] = await Promise.all([
      this.prisma.testMachine.findMany({
        orderBy: {
          id: 'asc',
        },
        select: this.testMachineDtoSelect,
      }),
      this.controllersService.list(),
      this.usersService.getHiddenNetworkKeySet(user.id, user.role),
    ]);

    const controllerNameMap = new Map(controllers.map((controller) => [controller.id, controller.name]));

    return {
      items: machines.map((machine) =>
        this.toDto(
          machine,
          controllerNameMap,
          hiddenNetworkKeys,
          user.role === UserRole.ADMIN,
        ),
      ),
    };
  }

  async create(dto: CreateTestMachineDto): Promise<TestMachineDto> {
    try {
      const entity = await this.prisma.testMachine.create({
        data: {
          enabled: dto.enabled ?? true,
          host: normalizeRequiredText(dto.host),
          name: normalizeRequiredText(dto.name),
          passwordEnc: encryptString(dto.password),
          port: dto.port,
          remark: normalizeOptionalText(dto.remark),
          username: normalizeRequiredText(dto.username),
        },
        select: this.testMachineDtoSelect,
      });

      return this.toDto(entity, await this.buildControllerNameMap(), new Set(), true);
    } catch (error) {
      this.handlePrismaWriteError(error);
    }
  }

  async update(id: number, dto: UpdateTestMachineDto): Promise<TestMachineDto> {
    const existing = await this.findMachineEntity(id);
    if (existing.switchStatus === PrismaTestMachineSwitchStatus.RUNNING) {
      throw new ConflictException('测试机正在切换网络，暂时不能编辑');
    }

    try {
      const entity = await this.prisma.testMachine.update({
        data: {
          ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
          ...(dto.host !== undefined ? { host: normalizeRequiredText(dto.host) } : {}),
          ...(dto.name !== undefined ? { name: normalizeRequiredText(dto.name) } : {}),
          ...(dto.password !== undefined ? { passwordEnc: encryptString(dto.password) } : {}),
          ...(dto.port !== undefined ? { port: dto.port } : {}),
          ...(dto.remark !== undefined ? { remark: normalizeOptionalText(dto.remark) } : {}),
          ...(dto.username !== undefined ? { username: normalizeRequiredText(dto.username) } : {}),
        },
        select: this.testMachineDtoSelect,
        where: { id },
      });

      return this.toDto(entity, await this.buildControllerNameMap(), new Set(), true);
    } catch (error) {
      this.handlePrismaWriteError(error);
    }
  }

  async remove(id: number) {
    const existing = await this.findMachineEntity(id);
    if (existing.switchStatus === PrismaTestMachineSwitchStatus.RUNNING) {
      throw new ConflictException('测试机正在切换网络，暂时不能删除');
    }

    await this.prisma.testMachine.delete({
      where: { id },
    });

    return {
      success: true,
    };
  }

  async testSsh(id: number): Promise<TestMachineSshTestResult> {
    const machine = await this.getMachineConfigOrThrow(id);
    let session: TestMachineRemoteSession | null = null;

    try {
      session = await this.sshService.connect(machine);
      await this.ensureRemotePrerequisites(session);
      const [nodeInfo, networks] = await Promise.all([
        this.readRemoteNodeInfo(session),
        this.readRemoteNetworks(session),
      ]);

      await this.prisma.testMachine.update({
        data: {
          lastCheckedAt: new Date(),
          status: PrismaTestMachineStatus.ONLINE,
        },
        where: { id },
      });

      return {
        currentNetworks: networks,
        nodeId: nodeInfo.nodeId,
        success: true,
        version: nodeInfo.version,
      };
    } catch (error) {
      await this.prisma.testMachine.update({
        data: {
          lastCheckedAt: new Date(),
          status: PrismaTestMachineStatus.OFFLINE,
        },
        where: { id },
      });
      throw new BadRequestException(
        error instanceof Error ? error.message : `测试机 ${machine.name} SSH 检测失败`,
      );
    } finally {
      session?.close();
    }
  }

  async switchNetwork(
    user: AuthenticatedUser,
    machineId: number,
    dto: SwitchTestMachineNetworkDto,
  ): Promise<TestMachineSwitchResult> {
    await this.usersService.assertNetworkVisibleForUser(
      user.id,
      user.role,
      dto.controllerId,
      dto.networkId,
    );

    return this.withMachineLock(machineId, async () => {
      const machine = await this.findMachineEntity(machineId);
      if (!machine.enabled) {
        throw new ConflictException('测试机已禁用，不能执行网络切换');
      }
      if (machine.switchStatus === PrismaTestMachineSwitchStatus.RUNNING) {
        throw new ConflictException('测试机已有进行中的切换任务');
      }

      const controller = await this.controllersService.getControllerConfigOrThrow(dto.controllerId);
      const planetFile = await this.controllersService.getPlanetFileOrThrow(dto.controllerId);
      const networkDetail = await this.ztncuiService.getNetworkDetail(controller, dto.networkId);

      const logLines: string[] = [];
      const appendLog = (message: string) => {
        logLines.push(`[${new Date().toISOString()}] ${message}`);
      };

      appendLog(`开始切换测试机 ${machine.name} 到控制器 ${controller.name} / 网络 ${networkDetail.networkName}`);

      const logRecord = await this.prisma.testMachineSwitchLog.create({
        data: {
          machineId,
          operatorUserId: user.id,
          status: PrismaTestMachineSwitchStatus.RUNNING,
          summary: '切换进行中',
          targetControllerId: dto.controllerId,
          targetNetworkId: dto.networkId,
          targetNetworkName: networkDetail.networkName,
        },
        select: {
          id: true,
        },
      });

      await this.prisma.testMachine.update({
        data: {
          lastSwitchMessage: '切换进行中',
          switchStatus: PrismaTestMachineSwitchStatus.RUNNING,
        },
        where: { id: machineId },
      });

      let session: TestMachineRemoteSession | null = null;
      let nodeId: string | null = null;
      let memberId: string | null = null;
      let sshConnected = false;

      try {
        const machineConfig = this.toMachineConfig(machine);
        session = await this.sshService.connect(machineConfig);
        sshConnected = true;
        appendLog('SSH 连接成功');

        await this.ensureRemotePrerequisites(session);
        appendLog('远程环境检查通过');

        const nodeInfo = await this.readRemoteNodeInfo(session);
        nodeId = nodeInfo.nodeId;
        appendLog(`识别到测试机节点 ID：${nodeId}`);

        if (machine.currentNetworkId && machine.currentNetworkId !== dto.networkId) {
          await session.exec(`zerotier-cli leave ${machine.currentNetworkId}`, {
            allowNonZeroExit: true,
            timeoutMs: 15_000,
          });
          appendLog(`已尝试离开旧测试网络：${machine.currentNetworkId}`);
        }

        await session.exec('systemctl stop zerotier-one', {
          timeoutMs: 20_000,
        });
        appendLog('已停止 zerotier-one 服务');

        await session.exec(
          `if [ -f ${this.quoteRemotePath(ZEROTIER_PLANET_PATH)} ]; then cp -f ${this.quoteRemotePath(ZEROTIER_PLANET_PATH)} ${this.quoteRemotePath(ZEROTIER_PLANET_BACKUP_PATH)}; fi`,
        );
        appendLog('已备份当前 planet 文件');

        await session.uploadFile(ZEROTIER_PLANET_PATH, planetFile.content);
        appendLog(`已写入目标控制器 planet 文件（${controller.name}）`);

        await session.exec('systemctl start zerotier-one', {
          timeoutMs: 20_000,
        });
        appendLog('已启动 zerotier-one 服务');

        await session.exec('sleep 2', {
          timeoutMs: 5_000,
        });

        await session.exec(`zerotier-cli join ${dto.networkId}`, {
          timeoutMs: 20_000,
        });
        appendLog(`已执行 zerotier-cli join ${dto.networkId}`);

        memberId = await this.waitForMemberAndAuthorize(
          controller.id,
          dto.networkId,
          nodeId,
          appendLog,
        );
        appendLog(`已确认并授权成员：${memberId}`);

        await this.waitForRemoteNetworkReady(session, dto.networkId, appendLog);
        appendLog('测试机网络状态已恢复正常');

        await this.prisma.testMachine.update({
          data: {
            currentControllerId: controller.id,
            currentMemberId: memberId,
            currentNetworkId: dto.networkId,
            currentNetworkName: networkDetail.networkName,
            currentNodeId: nodeId,
            lastSwitchAt: new Date(),
            lastSwitchMessage: `已切换到 ${controller.name} / ${networkDetail.networkName}`,
            status: PrismaTestMachineStatus.ONLINE,
            switchStatus: PrismaTestMachineSwitchStatus.SUCCESS,
          },
          where: { id: machineId },
        });

        await this.prisma.testMachineSwitchLog.update({
          data: {
            detailLog: logLines.join('\n'),
            finishedAt: new Date(),
            memberId,
            nodeId,
            status: PrismaTestMachineSwitchStatus.SUCCESS,
            summary: `已切换到 ${controller.name} / ${networkDetail.networkName}`,
          },
          where: { id: logRecord.id },
        });

        return {
          controllerId: controller.id,
          currentNodeId: nodeId,
          machineId,
          memberId,
          networkId: dto.networkId,
          networkName: networkDetail.networkName,
          success: true,
        };
      } catch (error) {
        appendLog(`切换失败：${error instanceof Error ? error.message : '未知错误'}`);

        if (session) {
          try {
            await this.rollbackPlanet(session, appendLog);
          } catch (rollbackError) {
            appendLog(
              `planet 回滚失败：${
                rollbackError instanceof Error ? rollbackError.message : '未知错误'
              }`,
            );
          }
        }

        await this.prisma.testMachine.update({
          data: {
            lastSwitchAt: new Date(),
            lastSwitchMessage:
              error instanceof Error ? error.message : '网络切换失败',
            status: sshConnected
              ? PrismaTestMachineStatus.ONLINE
              : PrismaTestMachineStatus.OFFLINE,
            switchStatus: PrismaTestMachineSwitchStatus.FAILED,
          },
          where: { id: machineId },
        });

        await this.prisma.testMachineSwitchLog.update({
          data: {
            detailLog: logLines.join('\n'),
            finishedAt: new Date(),
            memberId,
            nodeId,
            status: PrismaTestMachineSwitchStatus.FAILED,
            summary: error instanceof Error ? error.message : '网络切换失败',
          },
          where: { id: logRecord.id },
        });

        throw new BadRequestException(
          error instanceof Error ? error.message : '网络切换失败',
        );
      } finally {
        session?.close();
      }
    });
  }

  async listLogs(machineId: number, limit?: number) {
    await this.findMachineEntity(machineId);

    const safeLimit = Math.min(Math.max(limit ?? DEFAULT_LOG_LIMIT, 1), MAX_LOG_LIMIT);
    const [logs, controllers] = await Promise.all([
      this.prisma.testMachineSwitchLog.findMany({
        include: {
          operatorUser: {
            select: {
              username: true,
            },
          },
        },
        orderBy: {
          startedAt: 'desc',
        },
        take: safeLimit,
        where: {
          machineId,
        },
      }),
      this.controllersService.list(),
    ]);

    const controllerNameMap = new Map(controllers.map((controller) => [controller.id, controller.name]));

    return {
      items: logs.map((log) => this.toLogDto(log, controllerNameMap)),
    };
  }

  private async ensureRemotePrerequisites(session: TestMachineRemoteSession) {
    await session.exec('command -v zerotier-cli >/dev/null');
    await session.exec('command -v zerotier-one >/dev/null');
    await session.exec(`test -d ${this.quoteRemotePath(ZEROTIER_HOME_PATH)}`);
  }

  private async waitForMemberAndAuthorize(
    controllerId: number,
    networkId: string,
    nodeId: string,
    appendLog: (message: string) => void,
  ) {
    const controller = await this.controllersService.getControllerConfigOrThrow(controllerId);

    for (let attempt = 1; attempt <= 15; attempt += 1) {
      const detail = await this.ztncuiService.getNetworkDetail(controller, networkId);
      const member = detail.members.find((item) => item.memberId === nodeId);

      if (!member) {
        appendLog(`等待成员出现在控制器中，第 ${attempt} 次重试`);
        await this.sleep(2_000);
        continue;
      }

      if (!member.authorized) {
        await this.ztncuiService.setMemberAuthorized(controller, networkId, member.memberId, true);
        appendLog(`已授权成员 ${member.memberId}`);
      }

      return member.memberId;
    }

    throw new Error('等待控制器发现测试机成员超时');
  }

  private async waitForRemoteNetworkReady(
    session: TestMachineRemoteSession,
    networkId: string,
    appendLog: (message: string) => void,
  ) {
    for (let attempt = 1; attempt <= 15; attempt += 1) {
      const networks = await this.readRemoteNetworks(session);
      const network = networks.find((item) => item.networkId === networkId);

      if (network?.status?.toUpperCase() === 'OK') {
        return;
      }

      appendLog(`等待测试机网络状态恢复正常，第 ${attempt} 次重试`);
      await this.sleep(2_000);
    }

    throw new Error('测试机加入目标网络后状态未恢复正常');
  }

  private async rollbackPlanet(
    session: TestMachineRemoteSession,
    appendLog: (message: string) => void,
  ) {
    await session.exec('systemctl stop zerotier-one', {
      allowNonZeroExit: true,
      timeoutMs: 20_000,
    });
    appendLog('已停止 zerotier-one，准备回滚 planet');

    await session.exec(
      `if [ -f ${this.quoteRemotePath(ZEROTIER_PLANET_BACKUP_PATH)} ]; then install -m 0644 ${this.quoteRemotePath(ZEROTIER_PLANET_BACKUP_PATH)} ${this.quoteRemotePath(ZEROTIER_PLANET_PATH)}; fi`,
      {
        timeoutMs: 20_000,
      },
    );
    appendLog('已尝试恢复备份 planet');

    await session.exec('systemctl start zerotier-one', {
      allowNonZeroExit: true,
      timeoutMs: 20_000,
    });
    appendLog('已尝试重新启动 zerotier-one');
  }

  private async readRemoteNodeInfo(session: TestMachineRemoteSession): Promise<RemoteNodeInfo> {
    const result = await session.exec('zerotier-cli info -j', {
      timeoutMs: 20_000,
    });
    const payload = JSON.parse(result.stdout) as {
      address?: string;
      version?: string;
    };

    if (!payload.address) {
      throw new Error('无法读取测试机 ZeroTier 节点 ID');
    }

    return {
      nodeId: payload.address,
      version: payload.version ?? null,
    };
  }

  private async readRemoteNetworks(session: TestMachineRemoteSession): Promise<RemoteNetworkInfo[]> {
    const result = await session.exec('zerotier-cli listnetworks -j', {
      timeoutMs: 20_000,
    });
    const payload = JSON.parse(result.stdout) as Array<{
      name?: string;
      nwid?: string;
      status?: string;
    }>;

    return payload.map((item) => ({
      name: item.name ?? null,
      networkId: item.nwid ?? '',
      status: item.status ?? null,
    })).filter((item) => item.networkId);
  }

  private async getMachineConfigOrThrow(id: number): Promise<TestMachineConfig> {
    const entity = await this.prisma.testMachine.findUnique({
      select: {
        enabled: true,
        host: true,
        id: true,
        name: true,
        passwordEnc: true,
        port: true,
        remark: true,
        username: true,
      },
      where: { id },
    });

    if (!entity) {
      throw new NotFoundException(`测试机 ${id} 不存在`);
    }

    return {
      enabled: entity.enabled,
      host: entity.host,
      id: entity.id,
      name: entity.name,
      password: decryptString(entity.passwordEnc),
      port: entity.port,
      remark: entity.remark,
      username: entity.username,
    };
  }

  private async findMachineEntity(id: number) {
    const entity = await this.prisma.testMachine.findUnique({
      where: { id },
    });

    if (!entity) {
      throw new NotFoundException(`测试机 ${id} 不存在`);
    }

    return entity;
  }

  private toMachineConfig(machine: TestMachineRecord): TestMachineConfig {
    return {
      enabled: machine.enabled,
      host: machine.host,
      id: machine.id,
      name: machine.name,
      password: decryptString(machine.passwordEnc),
      port: machine.port,
      remark: machine.remark,
      username: machine.username,
    };
  }

  private toDto(
    entity: TestMachineDtoRecord,
    controllerNameMap: Map<number, string>,
    hiddenNetworkKeys: Set<string>,
    includeSensitive: boolean,
  ): TestMachineDto {
    const currentNetworkHidden =
      entity.currentControllerId !== null &&
      entity.currentNetworkId !== null &&
      hiddenNetworkKeys.has(buildHiddenKey(entity.currentControllerId, entity.currentNetworkId));

    return {
      currentControllerId: entity.currentControllerId,
      currentControllerName:
        entity.currentControllerId !== null
          ? controllerNameMap.get(entity.currentControllerId) ?? null
          : null,
      currentMemberId: includeSensitive ? entity.currentMemberId : null,
      currentNetworkId: currentNetworkHidden ? null : entity.currentNetworkId,
      currentNetworkMasked: currentNetworkHidden,
      currentNetworkName: currentNetworkHidden ? null : entity.currentNetworkName,
      currentNodeId: includeSensitive ? entity.currentNodeId : null,
      enabled: entity.enabled,
      host: entity.host,
      id: entity.id,
      lastCheckedAt: entity.lastCheckedAt?.toISOString() ?? null,
      lastSwitchAt: entity.lastSwitchAt?.toISOString() ?? null,
      lastSwitchMessage: entity.lastSwitchMessage,
      name: entity.name,
      port: entity.port,
      remark: entity.remark,
      status: this.normalizeMachineStatus(entity.status),
      switchStatus: this.normalizeSwitchStatus(entity.switchStatus),
      username: includeSensitive ? entity.username : null,
    };
  }

  private toLogDto(
    entity: TestMachineLogRecord,
    controllerNameMap: Map<number, string>,
  ): TestMachineSwitchLogDto {
    return {
      detailLog: entity.detailLog,
      finishedAt: entity.finishedAt?.toISOString() ?? null,
      id: entity.id,
      machineId: entity.machineId,
      memberId: entity.memberId,
      nodeId: entity.nodeId,
      operatorUsername: entity.operatorUser.username,
      startedAt: entity.startedAt.toISOString(),
      status: this.normalizeSwitchStatus(entity.status),
      summary: entity.summary,
      targetControllerId: entity.targetControllerId,
      targetControllerName: controllerNameMap.get(entity.targetControllerId) ?? null,
      targetNetworkId: entity.targetNetworkId,
      targetNetworkName: entity.targetNetworkName,
    };
  }

  private normalizeMachineStatus(status: PrismaTestMachineStatus): TestMachineDto['status'] {
    if (status === PrismaTestMachineStatus.ONLINE) {
      return 'online';
    }
    if (status === PrismaTestMachineStatus.OFFLINE) {
      return 'offline';
    }
    return 'unknown';
  }

  private normalizeSwitchStatus(
    status: PrismaTestMachineSwitchStatus,
  ): TestMachineDto['switchStatus'] {
    if (status === PrismaTestMachineSwitchStatus.RUNNING) {
      return 'running';
    }
    if (status === PrismaTestMachineSwitchStatus.SUCCESS) {
      return 'success';
    }
    if (status === PrismaTestMachineSwitchStatus.FAILED) {
      return 'failed';
    }
    return 'idle';
  }

  private quoteRemotePath(value: string) {
    return `'${value.replace(/'/g, `'\"'\"'`)}'`;
  }

  private async withMachineLock<T>(machineId: number, task: () => Promise<T>) {
    const previous = this.machineLocks.get(machineId) ?? Promise.resolve();
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const current = previous.then(() => gate);
    this.machineLocks.set(machineId, current);

    await previous;

    try {
      return await task();
    } finally {
      release?.();
      if (this.machineLocks.get(machineId) === current) {
        this.machineLocks.delete(machineId);
      }
    }
  }

  private async sleep(ms: number) {
    await new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  private async buildControllerNameMap() {
    const controllers = await this.controllersService.list();
    return new Map(controllers.map((controller) => [controller.id, controller.name]));
  }

  private handlePrismaWriteError(error: unknown): never {
    if (isPrismaLikeError(error) && error.code === 'P2002') {
      throw new ConflictException('测试机名称已存在');
    }

    throw error;
  }

  private readonly testMachineDtoSelect = {
    currentControllerId: true,
    currentMemberId: true,
    currentNetworkId: true,
    currentNetworkName: true,
    currentNodeId: true,
    enabled: true,
    host: true,
    id: true,
    lastCheckedAt: true,
    lastSwitchAt: true,
    lastSwitchMessage: true,
    name: true,
    port: true,
    remark: true,
    status: true,
    switchStatus: true,
    username: true,
  } satisfies Prisma.TestMachineSelect;
}
