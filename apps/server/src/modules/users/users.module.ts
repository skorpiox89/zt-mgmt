import { Module } from '@nestjs/common';
import { AdminGuard } from '../../common/guards/admin.guard';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController],
  exports: [UsersService],
  providers: [UsersService, AdminGuard],
})
export class UsersModule {}
