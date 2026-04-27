export interface ControllerItem {
  baseUrl: string;
  hasPlanetFile: boolean;
  id: number;
  lastCheckedAt: string | null;
  name: string;
  planetFileSize: number | null;
  planetFileUploadedAt: string | null;
  region: string;
  status: 'offline' | 'online' | 'unknown';
  subnetPoolCidr: string;
  subnetPrefix: number;
  username: string;
}

export interface ControllerFormPayload {
  baseUrl: string;
  name: string;
  password: string;
  region: string;
  subnetPoolCidr: string;
  subnetPrefix: number;
  username: string;
}

export interface ControllerTestResult {
  controllerAddress: string | null;
  controllerHome: string;
  success: boolean;
  version: string | null;
}
