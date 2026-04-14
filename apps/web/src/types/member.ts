export interface MemberItem {
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
