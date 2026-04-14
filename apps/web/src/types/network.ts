import type { MemberItem } from './member';

export interface NetworkItem {
  controllerId: number;
  controllerName: string;
  memberCount: number | null;
  networkId: string;
  networkName: string;
  region: string;
}

export interface NetworkDetail {
  controllerId: number;
  controllerName: string;
  ipAssignmentPools: Array<{
    ipRangeEnd: string;
    ipRangeStart: string;
  }>;
  memberCount: number;
  networkId: string;
  networkName: string;
  private: boolean | null;
  routes: Array<{
    target: string;
    via: string | null;
  }>;
}

export interface CreateNetworkPayload {
  controllerId: number;
  networkName: string;
}

export interface CreateNetworkResult {
  controllerId: number;
  networkCidr: string;
  networkId: string;
  networkName: string;
  poolEnd: string;
  poolStart: string;
  private: boolean;
}

export interface MembersResponse {
  items: MemberItem[];
}
