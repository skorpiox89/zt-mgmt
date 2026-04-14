import { Module } from '@nestjs/common';
import { ZtncuiSessionService } from './ztncui-session.service';
import { ZtncuiService } from './ztncui.service';

@Module({
  exports: [ZtncuiService],
  providers: [ZtncuiService, ZtncuiSessionService],
})
export class ZtncuiModule {}
