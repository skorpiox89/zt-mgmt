import type { UserRole } from '@prisma/client';

export interface AuthSessionUser {
  id: number;
  role: UserRole;
  updatedAt: Date;
  username: string;
}

export interface PublicUser {
  createdAt: Date;
  hiddenNetworkCount: number;
  id: number;
  role: UserRole;
  username: string;
}

export interface HiddenNetworkItem {
  controllerId: number;
  networkId: string;
}
