import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AdminGuard } from '../../common/guards/admin.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CreateTestMachineDto } from './dto/create-test-machine.dto';
import { SwitchTestMachineNetworkDto } from './dto/switch-test-machine-network.dto';
import { UpdateTestMachineDto } from './dto/update-test-machine.dto';
import { TestMachinesService } from './test-machines.service';

@Controller('test-machines')
@UseGuards(JwtAuthGuard)
export class TestMachinesController {
  constructor(private readonly testMachinesService: TestMachinesService) {}

  @Get()
  list(@Req() req: Request & { user: AuthenticatedUser }) {
    return this.testMachinesService.list(req.user);
  }

  @Post()
  @UseGuards(AdminGuard)
  create(@Body() dto: CreateTestMachineDto) {
    return this.testMachinesService.create(dto);
  }

  @Put(':id')
  @UseGuards(AdminGuard)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTestMachineDto,
  ) {
    return this.testMachinesService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.testMachinesService.remove(id);
  }

  @Post(':id/test-ssh')
  @UseGuards(AdminGuard)
  testSsh(@Param('id', ParseIntPipe) id: number) {
    return this.testMachinesService.testSsh(id);
  }

  @Post(':id/zerotier/status')
  @UseGuards(AdminGuard)
  checkZeroTierStatus(@Param('id', ParseIntPipe) id: number) {
    return this.testMachinesService.checkZeroTierStatus(id);
  }

  @Post(':id/zerotier/start')
  @UseGuards(AdminGuard)
  startZeroTier(@Param('id', ParseIntPipe) id: number) {
    return this.testMachinesService.startZeroTier(id);
  }

  @Post(':id/zerotier/stop')
  @UseGuards(AdminGuard)
  stopZeroTier(@Param('id', ParseIntPipe) id: number) {
    return this.testMachinesService.stopZeroTier(id);
  }

  @Post(':id/switch')
  switchNetwork(
    @Req() req: Request & { user: AuthenticatedUser },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SwitchTestMachineNetworkDto,
  ) {
    return this.testMachinesService.switchNetwork(req.user, id, dto);
  }

  @Get(':id/logs')
  @UseGuards(AdminGuard)
  listLogs(
    @Param('id', ParseIntPipe) id: number,
    @Query('limit') limit?: string,
  ) {
    return this.testMachinesService.listLogs(
      id,
      limit ? Number(limit) : undefined,
    );
  }
}
