import { Module } from '@nestjs/common';
import { SubnetService } from './subnet.service';

@Module({
  exports: [SubnetService],
  providers: [SubnetService],
})
export class SubnetModule {}
