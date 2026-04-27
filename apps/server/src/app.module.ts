import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './common/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { ControllersModule } from './modules/controllers/controllers.module';
import { HealthModule } from './modules/health/health.module';
import { MembersModule } from './modules/members/members.module';
import { NetworksModule } from './modules/networks/networks.module';
import { TestMachinesModule } from './modules/test-machines/test-machines.module';
import { UsersModule } from './modules/users/users.module';
import { ZtncuiModule } from './modules/ztncui/ztncui.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    ZtncuiModule,
    ControllersModule,
    NetworksModule,
    MembersModule,
    TestMachinesModule,
    HealthModule,
  ],
})
export class AppModule {}
