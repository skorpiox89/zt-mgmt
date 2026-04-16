import { request } from './http';
import type { MembersResponse } from '../types/network';
import type { UpdateMemberNameResult } from '../types/member';

export function getMembers(controllerId: number, networkId: string) {
  return request<MembersResponse>(`/networks/${controllerId}/${networkId}/members`);
}

export function updateMemberAuth(
  controllerId: number,
  networkId: string,
  memberId: string,
  authorized: boolean,
) {
  return request(`/networks/${controllerId}/${networkId}/members/${memberId}/auth`, {
    body: JSON.stringify({ authorized }),
    method: 'PATCH',
  });
}

export function updateMemberName(
  controllerId: number,
  networkId: string,
  memberId: string,
  memberName: string,
) {
  return request<UpdateMemberNameResult>(
    `/networks/${controllerId}/${networkId}/members/${memberId}/name`,
    {
      body: JSON.stringify({ memberName }),
      method: 'PATCH',
    },
  );
}

export function deleteMember(
  controllerId: number,
  networkId: string,
  memberId: string,
) {
  return request(`/networks/${controllerId}/${networkId}/members/${memberId}`, {
    method: 'DELETE',
  });
}
