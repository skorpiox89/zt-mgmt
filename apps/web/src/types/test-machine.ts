export interface TestMachineItem {
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
  lastZeroTierCheckedAt: string | null;
  lastSwitchAt: string | null;
  lastSwitchMessage: string | null;
  name: string;
  port: number;
  remark: string | null;
  status: 'offline' | 'online' | 'unknown';
  switchStatus: 'failed' | 'idle' | 'running' | 'success';
  username: string | null;
  zerotierServiceStatus: 'not_installed' | 'running' | 'stopped' | 'unknown';
}

export interface TestMachineFormPayload {
  enabled: boolean;
  host: string;
  name: string;
  password?: string;
  port: number;
  remark?: string;
  username: string;
}

export interface TestMachineSshTestResult {
  checkedAt: string;
  success: boolean;
}

export interface TestMachineZeroTierServiceResult {
  checkedAt: string;
  currentNetworks: Array<{
    name: string | null;
    networkId: string;
    status: string | null;
  }>;
  nodeId: string | null;
  success: boolean;
  serviceStatus: 'not_installed' | 'running' | 'stopped' | 'unknown';
  version: string | null;
}

export interface SwitchTestMachinePayload {
  controllerId: number;
  networkId: string;
}

export interface SwitchTestMachineResult {
  controllerId: number;
  currentNodeId: string;
  machineId: number;
  message: string;
  memberId: string;
  networkId: string;
  networkName: string;
  success: boolean;
}

export interface TestMachineSwitchLogItem {
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
