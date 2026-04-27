import { request } from './http';
import type {
  SwitchTestMachinePayload,
  SwitchTestMachineResult,
  TestMachineFormPayload,
  TestMachineItem,
  TestMachineSshTestResult,
  TestMachineSwitchLogItem,
} from '../types/test-machine';

export function getTestMachines() {
  return request<{ items: TestMachineItem[] }>('/test-machines');
}

export function createTestMachine(payload: TestMachineFormPayload) {
  return request<TestMachineItem>('/test-machines', {
    body: JSON.stringify(payload),
    method: 'POST',
  });
}

export function updateTestMachine(id: number, payload: TestMachineFormPayload) {
  return request<TestMachineItem>(`/test-machines/${id}`, {
    body: JSON.stringify(payload),
    method: 'PUT',
  });
}

export function deleteTestMachine(id: number) {
  return request<{ success: boolean }>(`/test-machines/${id}`, {
    method: 'DELETE',
  });
}

export function testTestMachineSsh(id: number) {
  return request<TestMachineSshTestResult>(`/test-machines/${id}/test-ssh`, {
    method: 'POST',
  });
}

export function switchTestMachineNetwork(id: number, payload: SwitchTestMachinePayload) {
  return request<SwitchTestMachineResult>(`/test-machines/${id}/switch`, {
    body: JSON.stringify(payload),
    method: 'POST',
  });
}

export function getTestMachineLogs(id: number, limit = 20) {
  return request<{ items: TestMachineSwitchLogItem[] }>(
    `/test-machines/${id}/logs?limit=${limit}`,
  );
}
