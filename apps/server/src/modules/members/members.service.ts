import { Injectable } from '@nestjs/common';
import { ControllersService } from '../controllers/controllers.service';
import { ZtncuiService } from '../ztncui/ztncui.service';

@Injectable()
export class MembersService {
  constructor(
    private readonly controllersService: ControllersService,
    private readonly ztncuiService: ZtncuiService,
  ) {}

  async list(controllerId: number, networkId: string) {
    const controller = await this.controllersService.getControllerConfigOrThrow(controllerId);
    const detail = await this.ztncuiService.getNetworkDetail(controller, networkId);

    return {
      items: detail.members,
    };
  }

  async updateAuth(
    controllerId: number,
    networkId: string,
    memberId: string,
    authorized: boolean,
  ) {
    const controller = await this.controllersService.getControllerConfigOrThrow(controllerId);
    await this.ztncuiService.setMemberAuthorized(controller, networkId, memberId, authorized);

    return {
      authorized,
      controllerId,
      memberId,
      networkId,
    };
  }

  async updateName(
    controllerId: number,
    networkId: string,
    memberId: string,
    memberName: string,
  ) {
    const controller = await this.controllersService.getControllerConfigOrThrow(controllerId);
    await this.ztncuiService.setMemberName(controller, networkId, memberId, memberName);

    return {
      controllerId,
      memberId,
      memberName,
      networkId,
    };
  }

  async remove(controllerId: number, networkId: string, memberId: string) {
    const controller = await this.controllersService.getControllerConfigOrThrow(controllerId);
    await this.ztncuiService.deleteMember(controller, networkId, memberId);

    return {
      controllerId,
      memberId,
      networkId,
      success: true,
    };
  }
}
