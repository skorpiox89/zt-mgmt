import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { decryptString, encryptString } from '../../common/utils/crypto.util';
import { ZtncuiService } from '../ztncui/ztncui.service';
import { CreateControllerDto } from './dto/create-controller.dto';
import { UpdateControllerDto } from './dto/update-controller.dto';
import {
  ControllerConfig,
  ControllerDto,
  ControllerEntity,
} from './controllers.types';

@Injectable()
export class ControllersService {
  private readonly controllers: ControllerEntity[] = [];
  private nextId = 1;

  constructor(private readonly ztncuiService: ZtncuiService) {}

  list(): ControllerDto[] {
    return this.controllers.map((controller) => this.toDto(controller));
  }

  create(dto: CreateControllerDto): ControllerDto {
    const entity: ControllerEntity = {
      baseUrl: dto.baseUrl,
      id: this.nextId++,
      lastCheckedAt: null,
      name: dto.name,
      passwordEnc: encryptString(dto.password),
      region: dto.region,
      status: 'unknown',
      subnetPoolCidr: dto.subnetPoolCidr,
      subnetPrefix: dto.subnetPrefix,
      username: dto.username,
    };

    this.controllers.push(entity);
    return this.toDto(entity);
  }

  update(id: number, dto: UpdateControllerDto): ControllerDto {
    const entity = this.findEntity(id);

    if (dto.baseUrl !== undefined) {
      entity.baseUrl = dto.baseUrl;
    }
    if (dto.name !== undefined) {
      entity.name = dto.name;
    }
    if (dto.password !== undefined) {
      entity.passwordEnc = encryptString(dto.password);
    }
    if (dto.region !== undefined) {
      entity.region = dto.region;
    }
    if (dto.subnetPoolCidr !== undefined) {
      entity.subnetPoolCidr = dto.subnetPoolCidr;
    }
    if (dto.subnetPrefix !== undefined) {
      entity.subnetPrefix = dto.subnetPrefix;
    }
    if (dto.username !== undefined) {
      entity.username = dto.username;
    }

    return this.toDto(entity);
  }

  remove(id: number) {
    const index = this.controllers.findIndex((controller) => controller.id === id);
    if (index === -1) {
      throw new NotFoundException(`Controller ${id} not found`);
    }
    this.controllers.splice(index, 1);
    this.ztncuiService.clearSession(id);
    return {
      success: true,
    };
  }

  async testConnection(id: number) {
    const config = this.getControllerConfigOrThrow(id);
    const entity = this.findEntity(id);

    try {
      const result = await this.ztncuiService.testConnection(config);
      entity.lastCheckedAt = new Date().toISOString();
      entity.status = 'online';
      return {
        controllerAddress: result.controllerAddress,
        controllerHome: '/controller',
        success: true,
        version: result.version,
      };
    } catch (error) {
      entity.lastCheckedAt = new Date().toISOString();
      entity.status = 'offline';
      throw error;
    }
  }

  getControllerConfigOrThrow(id: number): ControllerConfig {
    const entity = this.findEntity(id);
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

  private findEntity(id: number) {
    const entity = this.controllers.find((controller) => controller.id === id);
    if (!entity) {
      throw new NotFoundException(`Controller ${id} not found`);
    }
    return entity;
  }

  private toDto(entity: ControllerEntity): ControllerDto {
    return {
      baseUrl: entity.baseUrl,
      id: entity.id,
      lastCheckedAt: entity.lastCheckedAt,
      name: entity.name,
      region: entity.region,
      status: entity.status,
      subnetPoolCidr: entity.subnetPoolCidr,
      subnetPrefix: entity.subnetPrefix,
      username: entity.username,
    };
  }
}
