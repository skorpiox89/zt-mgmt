import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  getHealth() {
    return {
      service: 'zt-mgmt-server',
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
