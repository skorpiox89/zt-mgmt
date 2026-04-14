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
  list() {
    return {
      items: this.controllersService.list(),
    };
  }

  @Post()
  create(@Body() dto: CreateControllerDto) {
    return this.controllersService.create(dto);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateControllerDto) {
    return this.controllersService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.controllersService.remove(id);
  }

  @Post(':id/test')
  testConnection(@Param('id', ParseIntPipe) id: number) {
    return this.controllersService.testConnection(id);
  }
}
