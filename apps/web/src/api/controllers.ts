import { request, requestBlob } from './http';
import type {
  ControllerFormPayload,
  ControllerItem,
  ControllerMigrationImportResult,
  ControllerPlanetDownloadLink,
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

export function uploadControllerPlanet(id: number, file: File) {
  const formData = new FormData();
  formData.append('file', file, 'planet');

  return request<ControllerItem>(`/controllers/${id}/planet`, {
    body: formData,
    method: 'PUT',
  });
}

export function downloadControllerPlanet(id: number) {
  return requestBlob(`/controllers/${id}/planet`);
}

export function deleteControllerPlanet(id: number) {
  return request<ControllerItem>(`/controllers/${id}/planet`, {
    method: 'DELETE',
  });
}

export function getOrCreateControllerPlanetLink(id: number) {
  return request<ControllerPlanetDownloadLink>(`/controllers/${id}/planet-link`, {
    method: 'POST',
  });
}

export function rotateControllerPlanetLink(id: number) {
  return request<ControllerPlanetDownloadLink>(`/controllers/${id}/planet-link/rotate`, {
    method: 'POST',
  });
}

export function exportControllerConfiguration(migrationPassword: string) {
  return requestBlob('/controllers/export', {
    body: JSON.stringify({ migrationPassword }),
    method: 'POST',
  });
}

export function importControllerConfiguration(file: File, migrationPassword: string) {
  const formData = new FormData();
  formData.append('file', file, file.name);
  formData.append('migrationPassword', migrationPassword);

  return request<ControllerMigrationImportResult>('/controllers/import', {
    body: formData,
    method: 'POST',
  });
}
