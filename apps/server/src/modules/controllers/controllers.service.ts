import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Controller as ControllerRecord } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { decryptString, encryptString } from '../../common/utils/crypto.util';
import {
  decryptMigrationPayload,
  encryptMigrationPayload,
  type EncryptedMigrationPayload,
} from '../../common/utils/migration-crypto.util';
import { ZtncuiService } from '../ztncui/ztncui.service';
import {
  CONTROLLER_MIGRATION_FORMAT,
  CONTROLLER_MIGRATION_VERSION,
  MAX_CONTROLLER_MIGRATION_FILE_SIZE_BYTES,
  MAX_PLANET_FILE_SIZE_BYTES,
} from './controller-migration.constants';
import { CreateControllerDto } from './dto/create-controller.dto';
import { ControllerMigrationDataDto } from './dto/import-controller-migration.dto';
import { UpdateControllerDto } from './dto/update-controller.dto';
import {
  ControllerConfig,
  ControllerDto,
  ControllerMigrationData,
  ControllerMigrationImportResult,
  ControllerPlanetFile,
} from './controllers.types';

type ControllerDtoRecord = Pick<
  ControllerRecord,
  | 'baseUrl'
  | 'id'
  | 'lastCheckedAt'
  | 'name'
  | 'planetDownloadToken'
  | 'planetFileSize'
  | 'planetFileUploadedAt'
  | 'region'
  | 'status'
  | 'subnetPoolCidr'
  | 'subnetPrefix'
  | 'username'
>;

interface PrismaLikeError {
  code?: string;
}

function isPrismaLikeError(error: unknown): error is PrismaLikeError {
  return typeof error === 'object' && error !== null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isEncryptedMigrationPayload(value: unknown): value is EncryptedMigrationPayload {
  return (
    isRecord(value) &&
    typeof value.algorithm === 'string' &&
    typeof value.authTag === 'string' &&
    typeof value.ciphertext === 'string' &&
    typeof value.iv === 'string' &&
    typeof value.kdf === 'string' &&
    typeof value.salt === 'string'
  );
}

@Injectable()
export class ControllersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ztncuiService: ZtncuiService,
  ) {}

  async list(): Promise<ControllerDto[]> {
    const controllers = await this.prisma.controller.findMany({
      orderBy: {
        id: 'asc',
      },
      select: this.controllerDtoSelect,
    });

    return controllers.map((controller) => this.toDto(controller));
  }

  async exportConfiguration(migrationPassword: string) {
    const controllers = await this.prisma.controller.findMany({
      orderBy: {
        id: 'asc',
      },
      select: {
        baseUrl: true,
        name: true,
        passwordEnc: true,
        planetFileContent: true,
        region: true,
        subnetPoolCidr: true,
        subnetPrefix: true,
        username: true,
      },
    });

    const data: ControllerMigrationData = {
      controllers: controllers.map((controller) => ({
        baseUrl: controller.baseUrl,
        name: controller.name,
        password: decryptString(controller.passwordEnc),
        ...(controller.planetFileContent
          ? {
              planetFileContent: Buffer.from(controller.planetFileContent).toString('base64'),
            }
          : {}),
        region: controller.region,
        subnetPoolCidr: controller.subnetPoolCidr,
        subnetPrefix: controller.subnetPrefix,
        username: controller.username,
      })),
      exportedAt: new Date().toISOString(),
    };

    return {
      encryptedPayload: await encryptMigrationPayload(
        JSON.stringify(data),
        migrationPassword,
      ),
      format: CONTROLLER_MIGRATION_FORMAT,
      version: CONTROLLER_MIGRATION_VERSION,
    };
  }

  async importConfiguration(
    file: { buffer: Buffer; size: number } | undefined,
    migrationPassword: string,
  ): Promise<ControllerMigrationImportResult> {
    if (!file) {
      throw new BadRequestException('请选择控制器导入文件');
    }

    if (file.size === 0 || file.buffer.length === 0) {
      throw new BadRequestException('控制器导入文件不能为空');
    }

    if (file.size > MAX_CONTROLLER_MIGRATION_FILE_SIZE_BYTES) {
      throw new BadRequestException('控制器导入文件不能超过 50MB');
    }

    const migrationPackage = this.parseMigrationPackage(file.buffer);
    let decryptedData: string;

    try {
      decryptedData = await decryptMigrationPayload(
        migrationPackage.encryptedPayload,
        migrationPassword,
      );
    } catch {
      throw new BadRequestException('迁移密码错误或导入文件已损坏');
    }

    const migrationData = this.parseMigrationData(decryptedData);
    if (!migrationData.controllers.length) {
      return { imported: 0 };
    }

    const names = migrationData.controllers.map((controller) => controller.name);
    const duplicateNames = this.findDuplicateNames(names);
    if (duplicateNames.length) {
      throw new ConflictException(`导入文件包含重复控制器名称：${duplicateNames.join('、')}`);
    }

    const existingControllers = await this.prisma.controller.findMany({
      select: {
        name: true,
      },
      where: {
        name: {
          in: names,
        },
      },
    });
    if (existingControllers.length) {
      throw new ConflictException(
        `以下控制器名称已存在：${existingControllers.map((item) => item.name).join('、')}`,
      );
    }

    const importedAt = new Date();
    const records = migrationData.controllers.map((controller) => {
      const planetFileContent = this.decodePlanetFileContent(controller.planetFileContent);

      return {
        baseUrl: controller.baseUrl,
        name: controller.name,
        passwordEnc: encryptString(controller.password),
        planetFileContent,
        planetFileSize: planetFileContent?.length ?? null,
        planetFileUploadedAt: planetFileContent ? importedAt : null,
        region: controller.region,
        subnetPoolCidr: controller.subnetPoolCidr,
        subnetPrefix: controller.subnetPrefix,
        username: controller.username,
      };
    });

    try {
      await this.prisma.$transaction(
        records.map((record) =>
          this.prisma.controller.create({
            data: record,
          }),
        ),
      );
    } catch (error) {
      this.handlePrismaWriteError(error);
    }

    return { imported: records.length };
  }

  async create(dto: CreateControllerDto): Promise<ControllerDto> {
    try {
      const entity = await this.prisma.controller.create({
        data: {
          baseUrl: dto.baseUrl,
          name: dto.name,
          passwordEnc: encryptString(dto.password),
          region: dto.region,
          subnetPoolCidr: dto.subnetPoolCidr,
          subnetPrefix: dto.subnetPrefix,
          username: dto.username,
        },
        select: this.controllerDtoSelect,
      });

      return this.toDto(entity);
    } catch (error) {
      this.handlePrismaWriteError(error);
    }
  }

  async update(id: number, dto: UpdateControllerDto): Promise<ControllerDto> {
    await this.findEntity(id);

    try {
      const entity = await this.prisma.controller.update({
        data: {
          ...(dto.baseUrl !== undefined ? { baseUrl: dto.baseUrl } : {}),
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.password !== undefined ? { passwordEnc: encryptString(dto.password) } : {}),
          ...(dto.region !== undefined ? { region: dto.region } : {}),
          ...(dto.subnetPoolCidr !== undefined ? { subnetPoolCidr: dto.subnetPoolCidr } : {}),
          ...(dto.subnetPrefix !== undefined ? { subnetPrefix: dto.subnetPrefix } : {}),
          ...(dto.username !== undefined ? { username: dto.username } : {}),
        },
        select: this.controllerDtoSelect,
        where: { id },
      });

      if (
        dto.baseUrl !== undefined ||
        dto.password !== undefined ||
        dto.username !== undefined
      ) {
        this.ztncuiService.clearSession(id);
      }

      return this.toDto(entity);
    } catch (error) {
      this.handlePrismaWriteError(error);
    }
  }

  async remove(id: number) {
    await this.findEntity(id);
    await this.prisma.controller.delete({
      where: { id },
    });
    this.ztncuiService.clearSession(id);
    return {
      success: true,
    };
  }

  async uploadPlanetFile(
    id: number,
    file?: {
      buffer: Buffer;
      size: number;
    },
  ): Promise<ControllerDto> {
    await this.findEntity(id);

    if (!file) {
      throw new BadRequestException('请上传 planet 文件');
    }

    if (file.size === 0 || file.buffer.length === 0) {
      throw new BadRequestException('planet 文件不能为空');
    }

    if (file.size > MAX_PLANET_FILE_SIZE_BYTES) {
      throw new BadRequestException('planet 文件大小不能超过 1MB');
    }

    const entity = await this.prisma.controller.update({
      data: {
        planetFileContent: Buffer.from(file.buffer),
        planetFileSize: file.size,
        planetFileUploadedAt: new Date(),
      },
      select: this.controllerDtoSelect,
      where: { id },
    });

    return this.toDto(entity);
  }

  async getOrCreatePlanetDownloadToken(id: number): Promise<string> {
    const entity = await this.findPlanetDownloadState(id);
    this.ensurePlanetFileExists(id, entity.planetFileSize);

    if (entity.planetDownloadToken) {
      return entity.planetDownloadToken;
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const token = this.createPlanetDownloadToken();

      try {
        const result = await this.prisma.controller.updateMany({
          data: {
            planetDownloadToken: token,
          },
          where: {
            id,
            planetDownloadToken: null,
            planetFileSize: {
              not: null,
            },
          },
        });

        if (result.count === 1) {
          return token;
        }
      } catch (error) {
        if (!isPrismaLikeError(error) || error.code !== 'P2002') {
          throw error;
        }
      }

      const current = await this.findPlanetDownloadState(id);
      this.ensurePlanetFileExists(id, current.planetFileSize);
      if (current.planetDownloadToken) {
        return current.planetDownloadToken;
      }
    }

    throw new ConflictException('生成 planet 下载链接失败，请重试');
  }

  async rotatePlanetDownloadToken(id: number): Promise<string> {
    const entity = await this.findPlanetDownloadState(id);
    this.ensurePlanetFileExists(id, entity.planetFileSize);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const token = this.createPlanetDownloadToken();

      try {
        const result = await this.prisma.controller.updateMany({
          data: {
            planetDownloadToken: token,
          },
          where: {
            id,
            planetFileSize: {
              not: null,
            },
          },
        });

        if (result.count === 1) {
          return token;
        }
      } catch (error) {
        if (!isPrismaLikeError(error) || error.code !== 'P2002') {
          throw error;
        }
      }

      const current = await this.findPlanetDownloadState(id);
      this.ensurePlanetFileExists(id, current.planetFileSize);
    }

    throw new ConflictException('重新生成 planet 下载链接失败，请重试');
  }

  async getPlanetFileByDownloadTokenOrThrow(token: string): Promise<ControllerPlanetFile> {
    if (!/^[a-f0-9]{64}$/.test(token)) {
      throw new NotFoundException('planet 下载链接无效或已失效');
    }

    const entity = await this.prisma.controller.findUnique({
      select: {
        planetFileContent: true,
        planetFileSize: true,
        planetFileUploadedAt: true,
      },
      where: {
        planetDownloadToken: token,
      },
    });

    if (
      !entity ||
      entity.planetFileContent === null ||
      entity.planetFileSize === null ||
      entity.planetFileUploadedAt === null
    ) {
      throw new NotFoundException('planet 下载链接无效或已失效');
    }

    return {
      content: Buffer.from(entity.planetFileContent),
      size: entity.planetFileSize,
      uploadedAt: entity.planetFileUploadedAt.toISOString(),
    };
  }

  async getPlanetFileOrThrow(id: number): Promise<ControllerPlanetFile> {
    const entity = await this.prisma.controller.findUnique({
      select: {
        planetFileContent: true,
        planetFileSize: true,
        planetFileUploadedAt: true,
      },
      where: { id },
    });

    if (!entity) {
      throw new NotFoundException(`控制器 ${id} 不存在`);
    }

    if (
      entity.planetFileContent === null ||
      entity.planetFileSize === null ||
      entity.planetFileUploadedAt === null
    ) {
      throw new NotFoundException(`控制器 ${id} 未上传 planet 文件`);
    }

    return {
      content: Buffer.from(entity.planetFileContent),
      size: entity.planetFileSize,
      uploadedAt: entity.planetFileUploadedAt.toISOString(),
    };
  }

  async removePlanetFile(id: number): Promise<ControllerDto> {
    await this.findEntity(id);
    await this.getPlanetFileOrThrow(id);

    const entity = await this.prisma.controller.update({
      data: {
        planetDownloadToken: null,
        planetFileContent: null,
        planetFileSize: null,
        planetFileUploadedAt: null,
      },
      select: this.controllerDtoSelect,
      where: { id },
    });

    return this.toDto(entity);
  }

  async testConnection(id: number) {
    const config = await this.getControllerConfigOrThrow(id);

    try {
      const result = await this.ztncuiService.testConnection(config);
      await this.prisma.controller.update({
        data: {
          lastCheckedAt: new Date(),
          status: 'online',
        },
        where: { id },
      });
      return {
        controllerAddress: result.controllerAddress,
        controllerHome: '/controller',
        success: true,
        version: result.version,
      };
    } catch (error) {
      await this.prisma.controller.update({
        data: {
          lastCheckedAt: new Date(),
          status: 'offline',
        },
        where: { id },
      });
      throw error;
    }
  }

  async getControllerConfigOrThrow(id: number): Promise<ControllerConfig> {
    const entity = await this.prisma.controller.findUnique({
      select: {
        baseUrl: true,
        id: true,
        name: true,
        passwordEnc: true,
        region: true,
        subnetPoolCidr: true,
        subnetPrefix: true,
        username: true,
      },
      where: { id },
    });
    if (!entity) {
      throw new NotFoundException(`控制器 ${id} 不存在`);
    }

    return {
      baseUrl: entity.baseUrl,
      id: entity.id,
      name: entity.name,
      password: decryptString(entity.passwordEnc),
      region: entity.region,
      subnetPoolCidr: entity.subnetPoolCidr,
      subnetPrefix: entity.subnetPrefix,
      username: entity.username,
    };
  }

  private parseMigrationPackage(content: Buffer): {
    encryptedPayload: EncryptedMigrationPayload;
  } {
    let parsed: unknown;

    try {
      parsed = JSON.parse(content.toString('utf8'));
    } catch {
      throw new BadRequestException('控制器导入文件不是有效的 JSON');
    }

    if (
      !isRecord(parsed) ||
      parsed.format !== CONTROLLER_MIGRATION_FORMAT ||
      parsed.version !== CONTROLLER_MIGRATION_VERSION ||
      !isEncryptedMigrationPayload(parsed.encryptedPayload)
    ) {
      throw new BadRequestException('控制器导入文件格式不受支持');
    }

    return {
      encryptedPayload: parsed.encryptedPayload,
    };
  }

  private parseMigrationData(content: string): ControllerMigrationDataDto {
    let parsed: unknown;

    try {
      parsed = JSON.parse(content);
    } catch {
      throw new BadRequestException('控制器导入文件内容无效');
    }

    const data = plainToInstance(ControllerMigrationDataDto, parsed);
    const validationErrors = validateSync(data, {
      forbidNonWhitelisted: true,
      whitelist: true,
    });
    if (validationErrors.length) {
      throw new BadRequestException('控制器导入文件内容格式不正确');
    }

    return data;
  }

  private decodePlanetFileContent(content: string | undefined) {
    if (!content) {
      return null;
    }

    const buffer = Buffer.from(content, 'base64');
    if (buffer.length === 0 || buffer.length > MAX_PLANET_FILE_SIZE_BYTES) {
      throw new BadRequestException('导入文件中的 planet 文件无效');
    }

    return buffer;
  }

  private findDuplicateNames(names: string[]) {
    const seen = new Set<string>();
    const duplicates = new Set<string>();

    for (const name of names) {
      if (seen.has(name)) {
        duplicates.add(name);
      }
      seen.add(name);
    }

    return [...duplicates];
  }

  private async findEntity(id: number) {
    const entity = await this.prisma.controller.findUnique({
      where: { id },
    });
    if (!entity) {
      throw new NotFoundException(`控制器 ${id} 不存在`);
    }
    return entity;
  }

  private handlePrismaWriteError(error: unknown): never {
    if (isPrismaLikeError(error) && error.code === 'P2002') {
      throw new ConflictException('控制器名称已存在');
    }

    throw error;
  }

  private toDto(entity: ControllerDtoRecord): ControllerDto {
    return {
      baseUrl: entity.baseUrl,
      hasPlanetDownloadLink:
        entity.planetDownloadToken !== null && entity.planetFileSize !== null,
      hasPlanetFile: entity.planetFileSize !== null,
      id: entity.id,
      lastCheckedAt: entity.lastCheckedAt?.toISOString() ?? null,
      name: entity.name,
      planetFileSize: entity.planetFileSize,
      planetFileUploadedAt: entity.planetFileUploadedAt?.toISOString() ?? null,
      region: entity.region,
      status: this.normalizeStatus(entity.status),
      subnetPoolCidr: entity.subnetPoolCidr,
      subnetPrefix: entity.subnetPrefix,
      username: entity.username,
    };
  }

  private normalizeStatus(status: string): ControllerDto['status'] {
    if (status === 'online' || status === 'offline') {
      return status;
    }

    return 'unknown';
  }

  private createPlanetDownloadToken() {
    return randomBytes(32).toString('hex');
  }

  private async findPlanetDownloadState(id: number) {
    const entity = await this.prisma.controller.findUnique({
      select: {
        planetDownloadToken: true,
        planetFileSize: true,
      },
      where: { id },
    });

    if (!entity) {
      throw new NotFoundException(`控制器 ${id} 不存在`);
    }

    return entity;
  }

  private ensurePlanetFileExists(id: number, planetFileSize: number | null) {
    if (planetFileSize === null) {
      throw new NotFoundException(`控制器 ${id} 未上传 planet 文件`);
    }
  }

  private readonly controllerDtoSelect = {
    baseUrl: true,
    id: true,
    lastCheckedAt: true,
    name: true,
    planetDownloadToken: true,
    planetFileSize: true,
    planetFileUploadedAt: true,
    region: true,
    status: true,
    subnetPoolCidr: true,
    subnetPrefix: true,
    username: true,
  } as const;
}
