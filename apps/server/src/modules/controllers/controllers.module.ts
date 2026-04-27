import { Module } from '@nestjs/common';
import { AdminGuard } from '../../common/guards/admin.guard';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { ZtncuiModule } from '../ztncui/ztncui.module';
import { ControllersController } from './controllers.controller';
import { ControllersService } from './controllers.service';

@Module({
  controllers: [ControllersController],
  exports: [ControllersService],
  imports: [AuthModule, PrismaModule, ZtncuiModule],
  providers: [AdminGuard, ControllersService],
})
export class ControllersModule {}
