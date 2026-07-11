import { Controller, Get, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ControllersService } from './controllers.service';

@Controller('public/planet')
export class PlanetDownloadController {
  constructor(private readonly controllersService: ControllersService) {}

  @Get(':token')
  async download(@Param('token') token: string, @Res() response: Response) {
    const file = await this.controllersService.getPlanetFileByDownloadTokenOrThrow(token);

    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Content-Disposition', 'attachment; filename="planet"');
    response.setHeader('Content-Length', String(file.size));
    response.setHeader('Content-Type', 'application/octet-stream');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.send(file.content);
  }
}
