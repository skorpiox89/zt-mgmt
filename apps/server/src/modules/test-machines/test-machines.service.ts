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
  ZeroTierServiceStatus as PrismaZeroTierServiceStatus,
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
  TestMachineZeroTierServiceResult,
  TestMachineSwitchLogDto,
  TestMachineSwitchResult,
} from './test-machines.types';
import { TestMachineRemoteSession, TestMachineSshService } from './test-machine-ssh.service';

const ZEROTIER_HOME_PATH = '/var/lib/zerotier-one';
const ZEROTIER_PLANET_PATH = `${ZEROTIER_HOME_PATH}/planet`;
const ZEROTIER_PLANET_BACKUP_PATH = `${ZEROTIER_HOME_PATH}/planet.zt-mgmt.bak`;
const DEFAULT_LOG_LIMIT = 20;
const MAX_LOG_LIMIT = 100;
const SWITCH_POLL_RETRY_COUNT = 15;
const SWITCH_POLL_INTERVAL_MS = 2_000;
const CONTROLLER_POLL_TIMEOUT_MS = 5_000;
const NETWORK_LEAVE_RETRY_COUNT = 5;
const NETWORK_LEAVE_POLL_INTERVAL_MS = 1_000;
const BACKGROUND_MEMBER_NAME_RETRY_COUNT = 5;
const BACKGROUND_MEMBER_NAME_RETRY_DELAY_MS = 60_000;
const BACKGROUND_MEMBER_NAME_PENDING_SUFFIX = '，成员名称后台同步中';

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
  | 'lastZeroTierCheckedAt'
  | 'lastSwitchAt'
  | 'lastSwitchMessage'
  | 'name'
  | 'port'
  | 'remark'
  | 'status'
  | 'switchStatus'
  | 'username'
  | 'zerotierServiceStatus'
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

interface RemoteZeroTierServiceInfo {
  status: TestMachineZeroTierServiceResult['serviceStatus'];
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
  private readonly memberRenameTimers = new Map<number, NodeJS.Timeout>();

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
    const checkedAt = new Date();

    try {
      session = await this.sshService.connect(machine);

      await this.prisma.testMachine.update({
        data: {
          lastCheckedAt: checkedAt,
          status: PrismaTestMachineStatus.ONLINE,
        },
        where: { id },
      });

      return {
        checkedAt: checkedAt.toISOString(),
        success: true,
      };
    } catch (error) {
      await this.prisma.testMachine.update({
        data: {
          lastCheckedAt: checkedAt,
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

  async checkZeroTierStatus(id: number): Promise<TestMachineZeroTierServiceResult> {
    return this.withMachineLock(id, async () => {
      const machine = await this.findMachineEntity(id);
      if (machine.switchStatus === PrismaTestMachineSwitchStatus.RUNNING) {
        throw new ConflictException('测试机正在切换网络，暂时不能检查 ZeroTier 服务');
      }

      let session: TestMachineRemoteSession | null = null;
      let sshConnected = false;
      const checkedAt = new Date();

      try {
        session = await this.sshService.connect(this.toMachineConfig(machine));
        sshConnected = true;

        const serviceInfo = await this.readRemoteZeroTierServiceInfo(session);
        const result = await this.buildZeroTierServiceResult(
          session,
          checkedAt,
          serviceInfo,
        );

        await this.prisma.testMachine.update({
          data: {
            lastCheckedAt: checkedAt,
            lastZeroTierCheckedAt: checkedAt,
            status: PrismaTestMachineStatus.ONLINE,
            zerotierServiceStatus: this.toPrismaZeroTierServiceStatus(
              result.serviceStatus,
            ),
          },
          where: { id },
        });

        return result;
      } catch (error) {
        await this.prisma.testMachine.update({
          data: {
            lastCheckedAt: checkedAt,
            lastZeroTierCheckedAt: checkedAt,
            status: sshConnected
              ? PrismaTestMachineStatus.ONLINE
              : PrismaTestMachineStatus.OFFLINE,
            zerotierServiceStatus: PrismaZeroTierServiceStatus.UNKNOWN,
          },
          where: { id },
        });
        throw new BadRequestException(
          error instanceof Error
            ? error.message
            : `测试机 ${machine.name} ZeroTier 服务状态检查失败`,
        );
      } finally {
        session?.close();
      }
    });
  }

  async startZeroTier(id: number): Promise<TestMachineZeroTierServiceResult> {
    return this.manageZeroTierService(id, 'start');
  }

  async stopZeroTier(id: number): Promise<TestMachineZeroTierServiceResult> {
    return this.manageZeroTierService(id, 'stop');
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
      let joinedTargetNetwork = false;
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

        await this.leaveRemoteExtraNetworks(session, dto.networkId, appendLog);

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
        joinedTargetNetwork = true;
        appendLog(`已执行 zerotier-cli join ${dto.networkId}`);

        memberId = await this.waitForMemberAndAuthorize(
          session,
          controller.id,
          dto.networkId,
          nodeId,
          appendLog,
        );
        appendLog(`已确认并授权成员：${memberId}`);

        await this.waitForRemoteNetworkReady(session, dto.networkId, appendLog);
        appendLog('测试机网络状态已恢复正常');

        await this.leaveRemoteExtraNetworks(session, dto.networkId, appendLog);
        appendLog('已确认测试机仅保留目标 ZeroTier 网络');
        await this.cleanupDuplicateMembersAcrossNetworks(
          controller.id,
          dto.networkId,
          nodeId,
          appendLog,
        );
        appendLog('成员名称将在后台自动同步，最多重试 5 次，每次间隔 1 分钟');

        const result = await this.completeSwitchSuccess({
          controllerId: controller.id,
          controllerName: controller.name,
          logLines,
          logRecordId: logRecord.id,
          machineId,
          memberId: memberId!,
          networkId: dto.networkId,
          networkName: networkDetail.networkName,
          nodeId: nodeId!,
        });
        this.scheduleBackgroundMemberRename({
          controllerId: controller.id,
          controllerName: controller.name,
          logRecordId: logRecord.id,
          machineId,
          memberId: memberId!,
          memberName: machine.name,
          networkId: dto.networkId,
          networkName: networkDetail.networkName,
        });
        return result;
      } catch (error) {
        if (session && joinedTargetNetwork && nodeId) {
          const fallbackNetwork = await this.safeReadRemoteNetworkById(
            session,
            dto.networkId,
          );

          if (fallbackNetwork?.status?.toUpperCase() === 'OK') {
            memberId = memberId ?? nodeId;
            appendLog(
              '控制器确认失败，但测试机目标网络状态已正常，按切换成功处理',
            );
            await this.leaveRemoteExtraNetworks(session, dto.networkId, appendLog);
            appendLog('已确认测试机仅保留目标 ZeroTier 网络');
            await this.cleanupDuplicateMembersAcrossNetworks(
              controller.id,
              dto.networkId,
              nodeId,
              appendLog,
            );
            appendLog('成员名称将在后台自动同步，最多重试 5 次，每次间隔 1 分钟');

            const result = await this.completeSwitchSuccess({
              controllerId: controller.id,
              controllerName: controller.name,
              logLines,
              logRecordId: logRecord.id,
              machineId,
              memberId: memberId!,
              networkId: dto.networkId,
              networkName: networkDetail.networkName,
              nodeId: nodeId!,
            });
            this.scheduleBackgroundMemberRename({
              controllerId: controller.id,
              controllerName: controller.name,
              logRecordId: logRecord.id,
              machineId,
              memberId: memberId!,
              memberName: machine.name,
              networkId: dto.networkId,
              networkName: networkDetail.networkName,
            });
            return result;
          }
        }

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

  private async completeSwitchSuccess(params: {
    controllerId: number;
    controllerName: string;
    logLines: string[];
    logRecordId: number;
    machineId: number;
    memberId: string;
    networkId: string;
    networkName: string;
    nodeId: string;
  }): Promise<TestMachineSwitchResult> {
    const {
      controllerId,
      controllerName,
      logLines,
      logRecordId,
      machineId,
      memberId,
      networkId,
      networkName,
      nodeId,
    } = params;
    const baseSwitchMessage = `已切换到 ${controllerName} / ${networkName}`;
    const switchMessage = `${baseSwitchMessage}${BACKGROUND_MEMBER_NAME_PENDING_SUFFIX}`;

    await this.prisma.testMachine.update({
      data: {
        currentControllerId: controllerId,
        currentMemberId: memberId,
        currentNetworkId: networkId,
        currentNetworkName: networkName,
        currentNodeId: nodeId,
        lastZeroTierCheckedAt: new Date(),
        lastSwitchAt: new Date(),
        lastSwitchMessage: switchMessage,
        status: PrismaTestMachineStatus.ONLINE,
        switchStatus: PrismaTestMachineSwitchStatus.SUCCESS,
        zerotierServiceStatus: PrismaZeroTierServiceStatus.RUNNING,
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
        summary: switchMessage,
      },
      where: { id: logRecordId },
    });

    return {
      controllerId,
      currentNodeId: nodeId,
      machineId,
      message: `切换成功：${networkName}，成员名称将于后台自动同步`,
      memberId,
      networkId,
      networkName,
      success: true,
    };
  }

  private scheduleBackgroundMemberRename(task: {
    controllerId: number;
    controllerName: string;
    logRecordId: number;
    machineId: number;
    memberId: string;
    memberName: string;
    networkId: string;
    networkName: string;
  }) {
    const existingTimer = this.memberRenameTimers.get(task.machineId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      void this.runBackgroundMemberRename({
        ...task,
        attempt: 1,
      });
    }, BACKGROUND_MEMBER_NAME_RETRY_DELAY_MS);

    this.memberRenameTimers.set(task.machineId, timer);
  }

  private async runBackgroundMemberRename(task: {
    attempt: number;
    controllerId: number;
    controllerName: string;
    logRecordId: number;
    machineId: number;
    memberId: string;
    memberName: string;
    networkId: string;
    networkName: string;
  }) {
    const {
      attempt,
      controllerId,
      controllerName,
      logRecordId,
      machineId,
      memberId,
      memberName,
      networkId,
      networkName,
    } = task;

    const appendBackgroundLog = async (message: string) => {
      await this.appendSwitchLogLine(logRecordId, message);
    };

    try {
      const controller = await this.controllersService.getControllerConfigOrThrow(controllerId);
      await appendBackgroundLog(
        `开始后台同步成员名称，第 ${attempt} / ${BACKGROUND_MEMBER_NAME_RETRY_COUNT} 次：${memberId} -> ${memberName}`,
      );

      const result = await this.ztncuiService.setMemberName(
        controller,
        networkId,
        memberId,
        memberName,
      );

      if (result.confirmed) {
        const message = `已切换到 ${controllerName} / ${networkName}，成员名称已同步`;
        await this.prisma.testMachine.update({
          data: {
            lastSwitchMessage: message,
          },
          where: { id: machineId },
        });
        await this.prisma.testMachineSwitchLog.update({
          data: {
            summary: message,
          },
          where: { id: logRecordId },
        });
        await appendBackgroundLog(`后台成员名称同步成功：${memberName}`);
        this.memberRenameTimers.delete(machineId);
        return;
      }

      await appendBackgroundLog(
        result.requestTimedOut
          ? `后台成员名称同步超时，第 ${attempt} 次未确认生效`
          : `后台成员名称同步未确认生效，第 ${attempt} 次继续等待`,
      );
    } catch (error) {
      await appendBackgroundLog(
        `后台成员名称同步失败，第 ${attempt} 次：${
          error instanceof Error ? error.message : '未知错误'
        }`,
      );
    }

    if (attempt >= BACKGROUND_MEMBER_NAME_RETRY_COUNT) {
      const message = `已切换到 ${controllerName} / ${networkName}，成员名称待手动同步`;
      await this.prisma.testMachine.update({
        data: {
          lastSwitchMessage: message,
        },
        where: { id: machineId },
      });
      await this.prisma.testMachineSwitchLog.update({
        data: {
          summary: message,
        },
        where: { id: logRecordId },
      });
      await appendBackgroundLog('后台成员名称同步已达到最大重试次数，停止继续尝试');
      this.memberRenameTimers.delete(machineId);
      return;
    }

    const timer = setTimeout(() => {
      void this.runBackgroundMemberRename({
        ...task,
        attempt: attempt + 1,
      });
    }, BACKGROUND_MEMBER_NAME_RETRY_DELAY_MS);
    this.memberRenameTimers.set(machineId, timer);
  }

  private async appendSwitchLogLine(logRecordId: number, message: string) {
    const existing = await this.prisma.testMachineSwitchLog.findUnique({
      select: {
        detailLog: true,
      },
      where: { id: logRecordId },
    });

    const line = `[${new Date().toISOString()}] ${message}`;
    const detailLog = existing?.detailLog ? `${existing.detailLog}\n${line}` : line;

    await this.prisma.testMachineSwitchLog.update({
      data: {
        detailLog,
      },
      where: { id: logRecordId },
    });
  }

  private async leaveRemoteExtraNetworks(
    session: TestMachineRemoteSession,
    targetNetworkId: string,
    appendLog: (message: string) => void,
  ) {
    const networks = await this.readRemoteNetworks(session);
    const extraNetworks = networks.filter((item) => item.networkId !== targetNetworkId);

    if (!extraNetworks.length) {
      return;
    }

    appendLog(
      `检测到其他 ZeroTier 网络：${extraNetworks
        .map((item) => `${item.name || '-'}(${item.networkId})`)
        .join(', ')}`,
    );

    for (const network of extraNetworks) {
      await this.leaveRemoteNetwork(session, network.networkId, network.name, appendLog);
    }

    const remainingNetworks = await this.readRemoteNetworks(session);
    const remainingExtraNetworks = remainingNetworks.filter(
      (item) => item.networkId !== targetNetworkId,
    );

    if (remainingExtraNetworks.length) {
      throw new Error(
        `测试机仍存在其他 ZeroTier 网络：${remainingExtraNetworks
          .map((item) => `${item.name || '-'}(${item.networkId})`)
          .join(', ')}`,
      );
    }
  }

  private async leaveRemoteNetwork(
    session: TestMachineRemoteSession,
    networkId: string,
    networkName: string | null,
    appendLog: (message: string) => void,
  ) {
    const result = await session.exec(`zerotier-cli leave ${networkId}`, {
      allowNonZeroExit: true,
      timeoutMs: 15_000,
    });

    appendLog(
      `已尝试离开 ZeroTier 网络：${networkName || '-'} (${networkId})${
        result.code === 0 ? '' : `，返回码 ${result.code}`
      }`,
    );

    for (let attempt = 1; attempt <= NETWORK_LEAVE_RETRY_COUNT; attempt += 1) {
      const network = await this.safeReadRemoteNetworkById(session, networkId);
      if (!network) {
        return;
      }

      appendLog(`等待 ZeroTier 网络 ${networkId} 离开完成，第 ${attempt} 次重试`);
      await this.sleep(NETWORK_LEAVE_POLL_INTERVAL_MS);
    }

    throw new Error(`未能离开 ZeroTier 网络 ${networkId}`);
  }

  private async cleanupDuplicateMembersAcrossNetworks(
    controllerId: number,
    targetNetworkId: string,
    nodeId: string,
    appendLog: (message: string) => void,
  ) {
    try {
      const controller = await this.controllersService.getControllerConfigOrThrow(controllerId);
      const networks = await this.ztncuiService.listNetworks(controller);

      for (const network of networks) {
        if (network.networkId === targetNetworkId) {
          continue;
        }

        try {
          const detail = await this.ztncuiService.getNetworkDetail(
            controller,
            network.networkId,
            {
              timeoutMs: CONTROLLER_POLL_TIMEOUT_MS,
            },
          );
          const member = detail.members.find((item) => item.memberId === nodeId);
          if (!member) {
            continue;
          }

          await this.ztncuiService.deleteMember(
            controller,
            network.networkId,
            nodeId,
          );
          appendLog(
            `已删除其他网络中的同节点成员：${detail.networkName || network.networkName} (${network.networkId})`,
          );
        } catch (error) {
          appendLog(
            `清理其他网络中的同节点成员失败：${network.networkName} (${network.networkId})，${
              error instanceof Error ? error.message : '未知错误'
            }`,
          );
        }
      }
    } catch (error) {
      appendLog(
        `扫描其他网络中的同节点成员失败：${
          error instanceof Error ? error.message : '未知错误'
        }`,
      );
    }
  }

  private async safeReadRemoteNetworkById(
    session: TestMachineRemoteSession,
    networkId: string,
  ) {
    try {
      const networks = await this.readRemoteNetworks(session);
      return networks.find((item) => item.networkId === networkId) ?? null;
    } catch {
      return null;
    }
  }

  private async manageZeroTierService(
    machineId: number,
    action: 'start' | 'stop',
  ): Promise<TestMachineZeroTierServiceResult> {
    return this.withMachineLock(machineId, async () => {
      const machine = await this.findMachineEntity(machineId);
      if (machine.switchStatus === PrismaTestMachineSwitchStatus.RUNNING) {
        throw new ConflictException(
          `测试机正在切换网络，暂时不能${this.getZeroTierActionLabel(action)} ZeroTier 服务`,
        );
      }

      let session: TestMachineRemoteSession | null = null;
      let sshConnected = false;
      const checkedAt = new Date();

      try {
        session = await this.sshService.connect(this.toMachineConfig(machine));
        sshConnected = true;

        const serviceInfo = await this.readRemoteZeroTierServiceInfo(session);
        if (serviceInfo.status === 'unknown') {
          throw new Error('无法识别 zerotier-one 服务状态');
        }
        if (serviceInfo.status === 'not_installed') {
          throw new Error('测试机未安装 zerotier-one 服务');
        }

        const expectedStatus = action === 'start' ? 'running' : 'stopped';
        if (serviceInfo.status !== expectedStatus) {
          await session.exec(`systemctl ${action} zerotier-one`, {
            timeoutMs: 20_000,
          });

          if (action === 'start') {
            await session.exec('sleep 1', {
              timeoutMs: 5_000,
            });
          }
        }

        const nextServiceInfo = await this.readRemoteZeroTierServiceInfo(session);
        if (nextServiceInfo.status !== expectedStatus) {
          throw new Error(
            `zerotier-one 服务${this.getZeroTierActionLabel(action)}后状态异常`,
          );
        }

        const result = await this.buildZeroTierServiceResult(
          session,
          checkedAt,
          nextServiceInfo,
        );

        await this.prisma.testMachine.update({
          data: {
            lastCheckedAt: checkedAt,
            lastZeroTierCheckedAt: checkedAt,
            status: PrismaTestMachineStatus.ONLINE,
            zerotierServiceStatus: this.toPrismaZeroTierServiceStatus(
              result.serviceStatus,
            ),
          },
          where: { id: machineId },
        });

        return result;
      } catch (error) {
        const serviceInfo =
          sshConnected && session
            ? await this.safeReadRemoteZeroTierServiceInfo(session)
            : { status: 'unknown' as const };

        await this.prisma.testMachine.update({
          data: {
            lastCheckedAt: checkedAt,
            lastZeroTierCheckedAt: checkedAt,
            status: sshConnected
              ? PrismaTestMachineStatus.ONLINE
              : PrismaTestMachineStatus.OFFLINE,
            zerotierServiceStatus: this.toPrismaZeroTierServiceStatus(
              serviceInfo.status,
            ),
          },
          where: { id: machineId },
        });

        throw new BadRequestException(
          this.toZeroTierServiceActionErrorMessage(action, error),
        );
      } finally {
        session?.close();
      }
    });
  }

  private async ensureRemotePrerequisites(session: TestMachineRemoteSession) {
    const serviceInfo = await this.readRemoteZeroTierServiceInfo(session);
    if (serviceInfo.status === 'not_installed') {
      throw new Error('测试机未安装 zerotier-one 服务');
    }
    await session.exec('command -v zerotier-cli >/dev/null');
    await session.exec('command -v zerotier-one >/dev/null');
    await session.exec(`test -d ${this.quoteRemotePath(ZEROTIER_HOME_PATH)}`);
  }

  private async waitForMemberAndAuthorize(
    session: TestMachineRemoteSession,
    controllerId: number,
    networkId: string,
    nodeId: string,
    appendLog: (message: string) => void,
  ) {
    const controller = await this.controllersService.getControllerConfigOrThrow(controllerId);

    for (let attempt = 1; attempt <= SWITCH_POLL_RETRY_COUNT; attempt += 1) {
      try {
        const detail = await this.ztncuiService.getNetworkDetail(controller, networkId, {
          timeoutMs: CONTROLLER_POLL_TIMEOUT_MS,
        });
        const member = detail.members.find((item) => item.memberId === nodeId);

        if (!member) {
          const remoteNetwork = await this.safeReadRemoteNetworkById(session, networkId);
          if (remoteNetwork?.status?.toUpperCase() === 'OK') {
            appendLog(
              `控制器暂未返回成员 ${nodeId}，但测试机目标网络状态已正常，按节点 ID 记录成员`,
            );
            return nodeId;
          }

          appendLog(`等待成员出现在控制器中，第 ${attempt} 次重试`);
          await this.sleep(SWITCH_POLL_INTERVAL_MS);
          continue;
        }

        if (!member.authorized) {
          await this.ztncuiService.setMemberAuthorized(
            controller,
            networkId,
            member.memberId,
            true,
            {
              timeoutMs: CONTROLLER_POLL_TIMEOUT_MS,
            },
          );
          appendLog(`已授权成员 ${member.memberId}`);
        }

        return member.memberId;
      } catch (error) {
        const remoteNetwork = await this.safeReadRemoteNetworkById(session, networkId);
        if (remoteNetwork?.status?.toUpperCase() === 'OK') {
          appendLog(
            `控制器查询失败，但测试机目标网络状态已正常，按节点 ID ${nodeId} 记录成员`,
          );
          return nodeId;
        }

        appendLog(
          `读取控制器成员状态失败，第 ${attempt} 次重试：${
            error instanceof Error ? error.message : '未知错误'
          }`,
        );
        await this.sleep(SWITCH_POLL_INTERVAL_MS);
      }
    }

    throw new Error('等待控制器发现测试机成员超时');
  }

  private async waitForRemoteNetworkReady(
    session: TestMachineRemoteSession,
    networkId: string,
    appendLog: (message: string) => void,
  ) {
    for (let attempt = 1; attempt <= SWITCH_POLL_RETRY_COUNT; attempt += 1) {
      try {
        const networks = await this.readRemoteNetworks(session);
        const network = networks.find((item) => item.networkId === networkId);

        if (network?.status?.toUpperCase() === 'OK') {
          return;
        }
      } catch (error) {
        appendLog(
          `读取测试机网络状态失败，第 ${attempt} 次重试：${
            error instanceof Error ? error.message : '未知错误'
          }`,
        );
        await this.sleep(SWITCH_POLL_INTERVAL_MS);
        continue;
      }

      appendLog(`等待测试机网络状态恢复正常，第 ${attempt} 次重试`);
      await this.sleep(SWITCH_POLL_INTERVAL_MS);
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

  private async buildZeroTierServiceResult(
    session: TestMachineRemoteSession,
    checkedAt: Date,
    serviceInfo: RemoteZeroTierServiceInfo,
  ): Promise<TestMachineZeroTierServiceResult> {
    let version =
      serviceInfo.status === 'not_installed'
        ? null
        : await this.readRemoteZeroTierVersion(session).catch(() => null);
    let nodeInfo: RemoteNodeInfo | null = null;
    let currentNetworks: RemoteNetworkInfo[] = [];

    if (serviceInfo.status === 'running') {
      const [resolvedNodeInfo, resolvedNetworks] = await Promise.all([
        this.readRemoteNodeInfo(session).catch(() => null),
        this.readRemoteNetworks(session).catch(() => []),
      ]);

      nodeInfo = resolvedNodeInfo;
      currentNetworks = resolvedNetworks;
      if (!version) {
        version = resolvedNodeInfo?.version ?? null;
      }
    }

    return {
      checkedAt: checkedAt.toISOString(),
      currentNetworks,
      nodeId: nodeInfo?.nodeId ?? null,
      serviceStatus: serviceInfo.status,
      success: true,
      version,
    };
  }

  private async readRemoteZeroTierServiceInfo(
    session: TestMachineRemoteSession,
  ): Promise<RemoteZeroTierServiceInfo> {
    const [systemctlResult, zerotierBinaryResult] = await Promise.all([
      session.exec('command -v systemctl >/dev/null', {
        allowNonZeroExit: true,
        timeoutMs: 10_000,
        usePrivilege: false,
      }),
      session.exec('command -v zerotier-one >/dev/null', {
        allowNonZeroExit: true,
        timeoutMs: 10_000,
        usePrivilege: false,
      }),
    ]);

    if (systemctlResult.code !== 0) {
      return {
        status: zerotierBinaryResult.code === 0 ? 'unknown' : 'not_installed',
      };
    }

    const result = await session.exec(
      'systemctl show zerotier-one --property=LoadState --property=ActiveState --no-pager',
      {
        allowNonZeroExit: true,
        timeoutMs: 15_000,
        usePrivilege: false,
      },
    );
    const output = [result.stdout, result.stderr].filter(Boolean).join('\n');
    const loadState = output.match(/^LoadState=(.+)$/m)?.[1]?.trim() ?? null;
    const activeState = output.match(/^ActiveState=(.+)$/m)?.[1]?.trim() ?? null;

    if (loadState === 'not-found' || zerotierBinaryResult.code !== 0) {
      return {
        status: 'not_installed',
      };
    }
    if (!loadState) {
      return {
        status: 'unknown',
      };
    }
    if (activeState === 'active') {
      return {
        status: 'running',
      };
    }
    if (activeState) {
      return {
        status: 'stopped',
      };
    }

    return {
      status: 'unknown',
    };
  }

  private async safeReadRemoteZeroTierServiceInfo(
    session: TestMachineRemoteSession,
  ): Promise<RemoteZeroTierServiceInfo> {
    try {
      return await this.readRemoteZeroTierServiceInfo(session);
    } catch {
      return {
        status: 'unknown',
      };
    }
  }

  private async readRemoteZeroTierVersion(
    session: TestMachineRemoteSession,
  ): Promise<string | null> {
    const result = await session.exec('zerotier-one -version', {
      allowNonZeroExit: true,
      timeoutMs: 10_000,
      usePrivilege: false,
    });
    const output = result.stdout || result.stderr;
    return output ? output.trim() : null;
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
      lastZeroTierCheckedAt: entity.lastZeroTierCheckedAt?.toISOString() ?? null,
      lastSwitchAt: entity.lastSwitchAt?.toISOString() ?? null,
      lastSwitchMessage: entity.lastSwitchMessage,
      name: entity.name,
      port: entity.port,
      remark: entity.remark,
      status: this.normalizeMachineStatus(entity.status),
      switchStatus: this.normalizeSwitchStatus(entity.switchStatus),
      username: includeSensitive ? entity.username : null,
      zerotierServiceStatus: this.normalizeZeroTierServiceStatus(
        entity.zerotierServiceStatus,
      ),
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

  private normalizeZeroTierServiceStatus(
    status: PrismaZeroTierServiceStatus,
  ): TestMachineDto['zerotierServiceStatus'] {
    if (status === PrismaZeroTierServiceStatus.NOT_INSTALLED) {
      return 'not_installed';
    }
    if (status === PrismaZeroTierServiceStatus.RUNNING) {
      return 'running';
    }
    if (status === PrismaZeroTierServiceStatus.STOPPED) {
      return 'stopped';
    }
    return 'unknown';
  }

  private toPrismaZeroTierServiceStatus(
    status: TestMachineZeroTierServiceResult['serviceStatus'],
  ) {
    if (status === 'not_installed') {
      return PrismaZeroTierServiceStatus.NOT_INSTALLED;
    }
    if (status === 'running') {
      return PrismaZeroTierServiceStatus.RUNNING;
    }
    if (status === 'stopped') {
      return PrismaZeroTierServiceStatus.STOPPED;
    }
    return PrismaZeroTierServiceStatus.UNKNOWN;
  }

  private getZeroTierActionLabel(action: 'start' | 'stop') {
    return action === 'start' ? '开启' : '关闭';
  }

  private toZeroTierServiceActionErrorMessage(
    action: 'start' | 'stop',
    error: unknown,
  ) {
    const fallback = `ZeroTier 服务${this.getZeroTierActionLabel(action)}失败`;
    const message =
      error instanceof Error ? error.message.trim() : fallback;

    if (
      /sudo:.*(password is required|a password is required|no tty present|not allowed to execute)/i.test(
        message,
      )
    ) {
      return '当前 SSH 用户没有免密 sudo 权限，无法管理 zerotier-one 服务';
    }

    return message || fallback;
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
    lastZeroTierCheckedAt: true,
    lastSwitchAt: true,
    lastSwitchMessage: true,
    name: true,
    port: true,
    remark: true,
    status: true,
    switchStatus: true,
    username: true,
    zerotierServiceStatus: true,
  } satisfies Prisma.TestMachineSelect;
}
