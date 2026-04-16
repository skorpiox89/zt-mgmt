export type UserRole = 'ADMIN' | 'USER';

export interface LoginPayload {
  password: string;
  username: string;
}

export interface ChangePasswordPayload {
  newPassword: string;
  oldPassword: string;
}

export interface SessionUser {
  id: number;
  role: UserRole;
  username: string;
}

export interface LoginResponse {
  token: string;
  user: SessionUser;
}
