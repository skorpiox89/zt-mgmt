import { request } from './http';
import type {
  CreateNetworkPayload,
  CreateNetworkResult,
  NetworkDetail,
  NetworkItem,
} from '../types/network';

export function getNetworks(filters?: {
  controllerId?: number;
  keyword?: string;
  region?: string;
}) {
  const search = new URLSearchParams();
  if (filters?.controllerId) {
    search.set('controllerId', String(filters.controllerId));
  }
  if (filters?.keyword) {
    search.set('keyword', filters.keyword);
  }
  if (filters?.region) {
    search.set('region', filters.region);
  }

  const query = search.toString();
  return request<{ items: NetworkItem[] }>(`/networks${query ? `?${query}` : ''}`);
}

export function createNetwork(payload: CreateNetworkPayload) {
  return request<CreateNetworkResult>('/networks', {
    body: JSON.stringify(payload),
    method: 'POST',
  });
}

export function getNetworkDetail(controllerId: number, networkId: string) {
  return request<NetworkDetail>(`/networks/${controllerId}/${networkId}`);
}

export function renameNetwork(
  controllerId: number,
  networkId: string,
  networkName: string,
) {
  return request<{ controllerId: number; networkId: string; networkName: string }>(
    `/networks/${controllerId}/${networkId}/name`,
    {
      body: JSON.stringify({ networkName }),
      method: 'PATCH',
    },
  );
}

export function deleteNetwork(controllerId: number, networkId: string) {
  return request<{ success: boolean }>(`/networks/${controllerId}/${networkId}`, {
    method: 'DELETE',
  });
}
