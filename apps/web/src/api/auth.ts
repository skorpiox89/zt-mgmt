import { request } from './http';
import type {
  ChangePasswordPayload,
  LoginPayload,
  LoginResponse,
  SessionUser,
} from '../types/auth';

export function login(payload: LoginPayload) {
  return request<LoginResponse>('/auth/login', {
    body: JSON.stringify(payload),
    method: 'POST',
  });
}

export function changePassword(payload: ChangePasswordPayload) {
  return request<LoginResponse>('/auth/change-password', {
    body: JSON.stringify(payload),
    method: 'POST',
  });
}

export function logout() {
  return request<{ success: boolean }>('/auth/logout', {
    method: 'POST',
  });
}

export function getCurrentUser() {
  return request<SessionUser>('/auth/me');
}
