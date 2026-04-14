export interface ZtncuiControllerInfo {
  controllerAddress: string | null;
  version: string | null;
}

export interface ZtncuiNetworkListItem {
  detailPath: string | null;
  membersPath: string | null;
  networkId: string;
  networkName: string;
}

export interface ZtncuiIpAssignmentPool {
  ipRangeEnd: string;
  ipRangeStart: string;
}

export interface ZtncuiRoute {
  target: string;
  via: string | null;
}

export interface ZtncuiMember {
  activeBridge: boolean;
  authorized: boolean;
  ipAssignments: string[];
  latency: number | null;
  memberId: string;
  memberName: string;
  online: boolean;
  peerStatus: string;
  physicalAddress: string | null;
  version: string | null;
}

export interface ZtncuiNetworkDetail {
  ipAssignmentPools: ZtncuiIpAssignmentPool[];
  memberCount: number;
  members: ZtncuiMember[];
  networkId: string;
  networkName: string;
  private: boolean | null;
  routes: ZtncuiRoute[];
}
