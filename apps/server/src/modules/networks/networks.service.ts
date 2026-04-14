import { Injectable } from '@nestjs/common';
import { ControllersService } from '../controllers/controllers.service';
import { SubnetService } from '../subnet/subnet.service';
import { ZtncuiService } from '../ztncui/ztncui.service';
import { CreateNetworkDto } from './dto/create-network.dto';

@Injectable()
export class NetworksService {
  private readonly controllerLocks = new Map<number, Promise<void>>();

  constructor(
    private readonly controllersService: ControllersService,
    private readonly subnetService: SubnetService,
    private readonly ztncuiService: ZtncuiService,
  ) {}

  async list(filters: {
    controllerId?: number;
    keyword?: string;
    region?: string;
  }) {
    const controllers = this.controllersService.list().filter((controller) => {
      if (filters.controllerId && controller.id !== filters.controllerId) {
        return false;
      }
      if (filters.region && controller.region !== filters.region) {
        return false;
      }
      return true;
    });

    const items = await Promise.all(
      controllers.map(async (controller) => {
        const config = this.controllersService.getControllerConfigOrThrow(controller.id);
        const networks = await this.ztncuiService.listNetworks(config);
        return networks.map((network) => ({
          controllerId: controller.id,
          controllerName: controller.name,
          memberCount: null,
          networkId: network.networkId,
          networkName: network.networkName,
          region: controller.region,
        }));
      }),
    );

    const flattened = items.flat();
    const keyword = filters.keyword?.trim().toLowerCase();

    return {
      items: keyword
        ? flattened.filter((item) => item.networkName.toLowerCase().includes(keyword))
        : flattened,
    };
  }

  async detail(controllerId: number, networkId: string) {
    const controller = this.controllersService.getControllerConfigOrThrow(controllerId);
    const detail = await this.ztncuiService.getNetworkDetail(controller, networkId);

    return {
      controllerId,
      controllerName: controller.name,
      ipAssignmentPools: detail.ipAssignmentPools,
      memberCount: detail.memberCount,
      networkId: detail.networkId,
      networkName: detail.networkName,
      private: detail.private,
      routes: detail.routes,
    };
  }

  async create(dto: CreateNetworkDto) {
    return this.withControllerLock(dto.controllerId, async () => {
      const controller = this.controllersService.getControllerConfigOrThrow(dto.controllerId);
      const created = await this.ztncuiService.createNetwork(controller, dto.networkName);
      const existingNetworks = await this.ztncuiService.listNetworks(controller);

      const usedCidrs: string[] = [];
      for (const network of existingNetworks) {
        if (network.networkId === created.networkId) {
          continue;
        }

        const detail = await this.ztncuiService.getNetworkDetail(controller, network.networkId);
        for (const route of detail.routes) {
          usedCidrs.push(route.target);
        }
      }

      const allocation = this.subnetService.allocateNext(
        controller.subnetPoolCidr,
        controller.subnetPrefix,
        usedCidrs,
      );

      await this.ztncuiService.setNetworkPrivate(controller, created.networkId, true);
      await this.ztncuiService.easySetupNetwork(controller, created.networkId, allocation);

      return {
        controllerId: controller.id,
        networkCidr: allocation.networkCIDR,
        networkId: created.networkId,
        networkName: dto.networkName,
        poolEnd: allocation.poolEnd,
        poolStart: allocation.poolStart,
        private: true,
      };
    });
  }

  async rename(controllerId: number, networkId: string, networkName: string) {
    const controller = this.controllersService.getControllerConfigOrThrow(controllerId);
    await this.ztncuiService.renameNetwork(controller, networkId, networkName);

    return {
      controllerId,
      networkId,
      networkName,
    };
  }

  async remove(controllerId: number, networkId: string) {
    const controller = this.controllersService.getControllerConfigOrThrow(controllerId);
    await this.ztncuiService.deleteNetwork(controller, networkId);

    return {
      controllerId,
      networkId,
      success: true,
    };
  }

  private async withControllerLock<T>(controllerId: number, task: () => Promise<T>) {
    const previous = this.controllerLocks.get(controllerId) ?? Promise.resolve();
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const current = previous.then(() => gate);
    this.controllerLocks.set(controllerId, current);

    await previous;

    try {
      return await task();
    } finally {
      release?.();
      if (this.controllerLocks.get(controllerId) === current) {
        this.controllerLocks.delete(controllerId);
      }
    }
  }
}
