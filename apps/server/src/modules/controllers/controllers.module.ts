import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { ZtncuiModule } from '../ztncui/ztncui.module';
import { ControllersController } from './controllers.controller';
import { ControllersService } from './controllers.service';

@Module({
  controllers: [ControllersController],
  exports: [ControllersService],
  imports: [AuthModule, PrismaModule, ZtncuiModule],
  providers: [ControllersService],
})
export class ControllersModule {}
