import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { ControllersModule } from '../controllers/controllers.module';
import { UsersModule } from '../users/users.module';
import { ZtncuiModule } from '../ztncui/ztncui.module';
import { TestMachineSshService } from './test-machine-ssh.service';
import { TestMachinesController } from './test-machines.controller';
import { TestMachinesService } from './test-machines.service';

@Module({
  controllers: [TestMachinesController],
  imports: [PrismaModule, ControllersModule, UsersModule, ZtncuiModule],
  providers: [TestMachineSshService, TestMachinesService],
})
export class TestMachinesModule {}
