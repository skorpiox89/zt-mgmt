import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module';
import { ControllersModule } from './modules/controllers/controllers.module';
import { HealthModule } from './modules/health/health.module';
import { MembersModule } from './modules/members/members.module';
import { NetworksModule } from './modules/networks/networks.module';
import { UsersModule } from './modules/users/users.module';
import { ZtncuiModule } from './modules/ztncui/ztncui.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    AuthModule,
    UsersModule,
    ZtncuiModule,
    ControllersModule,
    NetworksModule,
    MembersModule,
    HealthModule,
  ],
})
export class AppModule {}
