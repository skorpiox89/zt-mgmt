export interface LoginPayload {
  password: string;
  username: string;
}

export interface SessionUser {
  id: number;
  username: string;
}

export interface LoginResponse {
  token: string;
  user: SessionUser;
}
