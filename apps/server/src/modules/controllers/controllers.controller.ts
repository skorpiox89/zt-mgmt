import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CreateControllerDto } from './dto/create-controller.dto';
import { UpdateControllerDto } from './dto/update-controller.dto';
import { ControllersService } from './controllers.service';

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

  @Post(':id/test')
  async testConnection(@Param('id', ParseIntPipe) id: number) {
    return this.controllersService.testConnection(id);
  }
}
