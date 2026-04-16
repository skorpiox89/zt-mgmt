import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AdminGuard } from '../../common/guards/admin.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CreateUserDto } from './dto/create-user.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateHiddenNetworksDto } from './dto/update-hidden-networks.dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @UseGuards(AdminGuard)
  async list() {
    return {
      items: await this.usersService.listUsers(),
    };
  }

  @Post()
  @UseGuards(AdminGuard)
  create(@Body() dto: CreateUserDto) {
    return this.usersService.createUser(dto);
  }

  @Post(':id/reset-password')
  @UseGuards(AdminGuard)
  resetPassword(
    @Req() req: Request & { user: AuthenticatedUser },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ResetPasswordDto,
  ) {
    return this.usersService.resetPassword(req.user.id, id, dto.newPassword);
  }

  @Get('me/hidden-networks')
  async getCurrentUserHiddenNetworks(@Req() req: Request & { user: AuthenticatedUser }) {
    return {
      items: await this.usersService.getCurrentUserHiddenNetworks(req.user.id),
    };
  }

  @Get(':id/hidden-networks')
  @UseGuards(AdminGuard)
  async getHiddenNetworks(@Param('id', ParseIntPipe) id: number) {
    return {
      items: await this.usersService.getHiddenNetworks(id),
    };
  }

  @Put(':id/hidden-networks')
  @UseGuards(AdminGuard)
  async updateHiddenNetworks(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateHiddenNetworksDto,
  ) {
    return {
      items: await this.usersService.updateHiddenNetworks(id, dto.items),
    };
  }
}
