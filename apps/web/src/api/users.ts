import { request } from './http';
import type {
  CreateUserPayload,
  HiddenNetworkItem,
  ResetPasswordPayload,
  UserItem,
} from '../types/user';

export function getUsers() {
  return request<{ items: UserItem[] }>('/users');
}

export function createUser(payload: CreateUserPayload) {
  return request<UserItem>('/users', {
    body: JSON.stringify(payload),
    method: 'POST',
  });
}

export function resetUserPassword(userId: number, payload: ResetPasswordPayload) {
  return request<{ success: boolean }>(`/users/${userId}/reset-password`, {
    body: JSON.stringify(payload),
    method: 'POST',
  });
}

export function getCurrentUserHiddenNetworks() {
  return request<{ items: HiddenNetworkItem[] }>('/users/me/hidden-networks');
}

export function getUserHiddenNetworks(userId: number) {
  return request<{ items: HiddenNetworkItem[] }>(`/users/${userId}/hidden-networks`);
}

export function updateUserHiddenNetworks(userId: number, items: HiddenNetworkItem[]) {
  return request<{ items: HiddenNetworkItem[] }>(`/users/${userId}/hidden-networks`, {
    body: JSON.stringify({ items }),
    method: 'PUT',
  });
}
