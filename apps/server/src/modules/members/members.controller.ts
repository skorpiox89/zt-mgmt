import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UpdateMemberAuthDto } from './dto/update-member-auth.dto';
import { UpdateMemberNameDto } from './dto/update-member-name.dto';
import { MembersService } from './members.service';

@Controller('networks/:controllerId/:networkId/members')
@UseGuards(JwtAuthGuard)
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Get()
  list(
    @Param('controllerId', ParseIntPipe) controllerId: number,
    @Param('networkId') networkId: string,
  ) {
    return this.membersService.list(controllerId, networkId);
  }

  @Patch(':memberId/auth')
  updateAuth(
    @Param('controllerId', ParseIntPipe) controllerId: number,
    @Param('networkId') networkId: string,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateMemberAuthDto,
  ) {
    return this.membersService.updateAuth(
      controllerId,
      networkId,
      memberId,
      dto.authorized,
    );
  }

  @Patch(':memberId/name')
  updateName(
    @Param('controllerId', ParseIntPipe) controllerId: number,
    @Param('networkId') networkId: string,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateMemberNameDto,
  ) {
    return this.membersService.updateName(
      controllerId,
      networkId,
      memberId,
      dto.memberName,
    );
  }

  @Delete(':memberId')
  remove(
    @Param('controllerId', ParseIntPipe) controllerId: number,
    @Param('networkId') networkId: string,
    @Param('memberId') memberId: string,
  ) {
    return this.membersService.remove(controllerId, networkId, memberId);
  }
}
