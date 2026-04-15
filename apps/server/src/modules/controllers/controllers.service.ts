import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Controller as ControllerRecord } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { decryptString, encryptString } from '../../common/utils/crypto.util';
import { ZtncuiService } from '../ztncui/ztncui.service';
import { CreateControllerDto } from './dto/create-controller.dto';
import { UpdateControllerDto } from './dto/update-controller.dto';
import {
  ControllerConfig,
  ControllerDto,
} from './controllers.types';

interface PrismaLikeError {
  code?: string;
}

function isPrismaLikeError(error: unknown): error is PrismaLikeError {
  return typeof error === 'object' && error !== null;
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
    });

    return controllers.map((controller) => this.toDto(controller));
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
    const entity = await this.findEntity(id);
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

  private toDto(entity: ControllerRecord): ControllerDto {
    return {
      baseUrl: entity.baseUrl,
      id: entity.id,
      lastCheckedAt: entity.lastCheckedAt?.toISOString() ?? null,
      name: entity.name,
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
}
