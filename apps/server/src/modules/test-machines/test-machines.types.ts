export interface TestMachineConfig {
  enabled: boolean;
  host: string;
  id: number;
  name: string;
  password: string;
  port: number;
  remark: string | null;
  username: string;
}

export interface TestMachineDto {
  currentControllerId: number | null;
  currentControllerName: string | null;
  currentMemberId: string | null;
  currentNetworkId: string | null;
  currentNetworkMasked: boolean;
  currentNetworkName: string | null;
  currentNodeId: string | null;
  enabled: boolean;
  host: string;
  id: number;
  lastCheckedAt: string | null;
  lastSwitchAt: string | null;
  lastSwitchMessage: string | null;
  name: string;
  port: number;
  remark: string | null;
  status: 'offline' | 'online' | 'unknown';
  switchStatus: 'failed' | 'idle' | 'running' | 'success';
  username: string | null;
}

export interface TestMachineSshTestResult {
  currentNetworks: Array<{
    name: string | null;
    networkId: string;
    status: string | null;
  }>;
  nodeId: string | null;
  success: boolean;
  version: string | null;
}

export interface TestMachineSwitchResult {
  controllerId: number;
  currentNodeId: string;
  machineId: number;
  memberId: string;
  networkId: string;
  networkName: string;
  success: boolean;
}

export interface TestMachineSwitchLogDto {
  detailLog: string | null;
  finishedAt: string | null;
  id: number;
  machineId: number;
  memberId: string | null;
  nodeId: string | null;
  operatorUsername: string;
  startedAt: string;
  status: 'failed' | 'idle' | 'running' | 'success';
  summary: string | null;
  targetControllerId: number;
  targetControllerName: string | null;
  targetNetworkId: string;
  targetNetworkName: string | null;
}

export interface TestMachinePlanetPaths {
  backupPath: string;
  planetPath: string;
}
