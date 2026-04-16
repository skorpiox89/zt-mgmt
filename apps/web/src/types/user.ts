import type { UserRole } from './auth';

export interface UserItem {
  createdAt: string;
  hiddenNetworkCount: number;
  id: number;
  role: UserRole;
  username: string;
}

export interface CreateUserPayload {
  password: string;
  username: string;
}

export interface ResetPasswordPayload {
  newPassword: string;
}

export interface HiddenNetworkItem {
  controllerId: number;
  networkId: string;
}
