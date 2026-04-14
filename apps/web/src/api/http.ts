import { useAuthStore } from '../stores/auth';

interface ApiEnvelope<T> {
  code: number;
  data: T;
  message: string;
}

const DEFAULT_API_BASE_URL = '/api';

function isLoopbackApiBaseUrl(url: string) {
  try {
    const parsed = new URL(url, window.location.origin);
    return ['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname);
  } catch {
    return false;
  }
}

const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
const API_BASE_URL =
  import.meta.env.DEV && configuredApiBaseUrl && isLoopbackApiBaseUrl(configuredApiBaseUrl)
    ? DEFAULT_API_BASE_URL
    : configuredApiBaseUrl || DEFAULT_API_BASE_URL;

export async function request<T>(path: string, init?: RequestInit) {
  const authStore = useAuthStore();
  const headers = new Headers(init?.headers || {});

  if (!headers.has('Content-Type') && init?.body) {
    headers.set('Content-Type', 'application/json');
  }

  if (authStore.token) {
    headers.set('Authorization', `Bearer ${authStore.token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  const payload = (await response.json()) as ApiEnvelope<T>;

  if (!response.ok || payload.code !== 0) {
    throw new Error(payload.message || 'Request failed');
  }

  return payload.data;
}
