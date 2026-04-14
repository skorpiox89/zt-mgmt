import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CreateNetworkDto } from './dto/create-network.dto';
import { RenameNetworkDto } from './dto/rename-network.dto';
import { NetworksService } from './networks.service';

@Controller('networks')
@UseGuards(JwtAuthGuard)
export class NetworksController {
  constructor(private readonly networksService: NetworksService) {}

  @Get()
  list(
    @Query('controllerId') controllerId?: string,
    @Query('keyword') keyword?: string,
    @Query('region') region?: string,
  ) {
    return this.networksService.list({
      controllerId: controllerId ? Number(controllerId) : undefined,
      keyword,
      region,
    });
  }

  @Post()
  create(@Body() dto: CreateNetworkDto) {
    return this.networksService.create(dto);
  }

  @Get(':controllerId/:networkId')
  detail(
    @Param('controllerId', ParseIntPipe) controllerId: number,
    @Param('networkId') networkId: string,
  ) {
    return this.networksService.detail(controllerId, networkId);
  }

  @Patch(':controllerId/:networkId/name')
  rename(
    @Param('controllerId', ParseIntPipe) controllerId: number,
    @Param('networkId') networkId: string,
    @Body() dto: RenameNetworkDto,
  ) {
    return this.networksService.rename(controllerId, networkId, dto.networkName);
  }

  @Delete(':controllerId/:networkId')
  remove(
    @Param('controllerId', ParseIntPipe) controllerId: number,
    @Param('networkId') networkId: string,
  ) {
    return this.networksService.remove(controllerId, networkId);
  }
}
