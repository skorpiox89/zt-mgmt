import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { AdminGuard } from '../../common/guards/admin.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { MAX_CONTROLLER_MIGRATION_FILE_SIZE_BYTES } from './controller-migration.constants';
import { ControllerMigrationPasswordDto } from './dto/controller-migration-password.dto';
import { CreateControllerDto } from './dto/create-controller.dto';
import { UpdateControllerDto } from './dto/update-controller.dto';
import { ControllersService } from './controllers.service';

interface UploadedPlanetFile {
  buffer: Buffer;
  size: number;
}

interface UploadedControllerMigrationFile {
  buffer: Buffer;
  size: number;
}

@Controller('controllers')
@UseGuards(JwtAuthGuard)
export class ControllersController {
  constructor(private readonly controllersService: ControllersService) {}

  @Get()
  async list() {
    return {
      items: await this.controllersService.list(),
    };
  }

  @Post('export')
  @UseGuards(AdminGuard)
  async exportConfiguration(
    @Body() dto: ControllerMigrationPasswordDto,
    @Res() response: Response,
  ) {
    const migrationPackage = await this.controllersService.exportConfiguration(
      dto.migrationPassword,
    );

    response.setHeader('Content-Disposition', 'attachment; filename="zt-mgmt-controllers.json"');
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.send(JSON.stringify(migrationPackage, null, 2));
  }

  @Post('import')
  @UseGuards(AdminGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: MAX_CONTROLLER_MIGRATION_FILE_SIZE_BYTES,
      },
    }),
  )
  async importConfiguration(
    @Body() dto: ControllerMigrationPasswordDto,
    @UploadedFile() file?: UploadedControllerMigrationFile,
  ) {
    return this.controllersService.importConfiguration(file, dto.migrationPassword);
  }

  @Post()
  async create(@Body() dto: CreateControllerDto) {
    return this.controllersService.create(dto);
  }

  @Put(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateControllerDto) {
    return this.controllersService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.controllersService.remove(id);
  }

  @Put(':id/planet')
  @UseGuards(AdminGuard)
  @UseInterceptors(FileInterceptor('file'))
  async uploadPlanet(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file?: UploadedPlanetFile,
  ) {
    return this.controllersService.uploadPlanetFile(id, file);
  }

  @Get(':id/planet')
  @UseGuards(AdminGuard)
  async downloadPlanet(@Param('id', ParseIntPipe) id: number, @Res() response: Response) {
    const file = await this.controllersService.getPlanetFileOrThrow(id);
    response.setHeader('Content-Disposition', 'attachment; filename="planet"');
    response.setHeader('Content-Length', String(file.size));
    response.setHeader('Content-Type', 'application/octet-stream');
    response.send(file.content);
  }

  @Delete(':id/planet')
  @UseGuards(AdminGuard)
  async removePlanet(@Param('id', ParseIntPipe) id: number) {
    return this.controllersService.removePlanetFile(id);
  }

  @Post(':id/test')
  async testConnection(@Param('id', ParseIntPipe) id: number) {
    return this.controllersService.testConnection(id);
  }
}
