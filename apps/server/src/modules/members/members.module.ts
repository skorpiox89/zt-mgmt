import { Module } from '@nestjs/common';
import { ControllersModule } from '../controllers/controllers.module';
import { ZtncuiModule } from '../ztncui/ztncui.module';
import { MembersController } from './members.controller';
import { MembersService } from './members.service';

@Module({
  controllers: [MembersController],
  imports: [ControllersModule, ZtncuiModule],
  providers: [MembersService],
})
export class MembersModule {}
