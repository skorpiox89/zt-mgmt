import { Module } from '@nestjs/common';
import { ControllersModule } from '../controllers/controllers.module';
import { SubnetModule } from '../subnet/subnet.module';
import { ZtncuiModule } from '../ztncui/ztncui.module';
import { NetworksController } from './networks.controller';
import { NetworksService } from './networks.service';

@Module({
  controllers: [NetworksController],
  imports: [ControllersModule, ZtncuiModule, SubnetModule],
  providers: [NetworksService],
})
export class NetworksModule {}
