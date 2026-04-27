export interface ControllerEntity {
  id: number;
  name: string;
  region: string;
  baseUrl: string;
  username: string;
  passwordEnc: string;
  subnetPoolCidr: string;
  subnetPrefix: number;
  planetFileSize: number | null;
  planetFileUploadedAt: string | null;
  status: 'offline' | 'online' | 'unknown';
  lastCheckedAt: string | null;
}

export interface ControllerConfig {
  baseUrl: string;
  id: number;
  name: string;
  password: string;
  region: string;
  subnetPoolCidr: string;
  subnetPrefix: number;
  username: string;
}

export interface ControllerDto {
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

export interface ControllerPlanetFile {
  content: Buffer;
  size: number;
  uploadedAt: string;
}
