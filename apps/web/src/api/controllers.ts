import { request } from './http';
import type {
  ControllerFormPayload,
  ControllerItem,
  ControllerTestResult,
} from '../types/controller';

export function getControllers() {
  return request<{ items: ControllerItem[] }>('/controllers');
}

export function createController(payload: ControllerFormPayload) {
  return request<ControllerItem>('/controllers', {
    body: JSON.stringify(payload),
    method: 'POST',
  });
}

export function updateController(id: number, payload: Partial<ControllerFormPayload>) {
  return request<ControllerItem>(`/controllers/${id}`, {
    body: JSON.stringify(payload),
    method: 'PUT',
  });
}

export function deleteController(id: number) {
  return request<{ success: boolean }>(`/controllers/${id}`, {
    method: 'DELETE',
  });
}

export function testController(id: number) {
  return request<ControllerTestResult>(`/controllers/${id}/test`, {
    method: 'POST',
  });
}
