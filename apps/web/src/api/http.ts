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

function shouldSetJsonContentType(body: BodyInit | null | undefined) {
  if (!body) {
    return false;
  }

  if (typeof body === 'string') {
    return true;
  }

  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    return false;
  }

  if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) {
    return false;
  }

  if (typeof Blob !== 'undefined' && body instanceof Blob) {
    return false;
  }

  return false;
}

function applyAuthHeaders(authStore: ReturnType<typeof useAuthStore>, init?: RequestInit) {
  const headers = new Headers(init?.headers || {});

  if (!headers.has('Content-Type') && shouldSetJsonContentType(init?.body)) {
    headers.set('Content-Type', 'application/json');
  }

  if (authStore.token) {
    headers.set('Authorization', `Bearer ${authStore.token}`);
  }

  return headers;
}

async function handleUnauthorized(response: Response, authStore: ReturnType<typeof useAuthStore>) {
  if (response.status === 401 && authStore.token) {
    authStore.clearSession();
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
  }
}

async function parseErrorMessage(response: Response) {
  const contentType = response.headers.get('Content-Type') || '';

  if (contentType.includes('application/json')) {
    try {
      const payload = (await response.json()) as Partial<ApiEnvelope<unknown>>;
      if (typeof payload.message === 'string' && payload.message) {
        return payload.message;
      }
    } catch {
      // Ignore invalid JSON error payloads.
    }
  }

  const text = await response.text();
  return text || '请求失败';
}

async function fetchApi(path: string, init?: RequestInit) {
  const authStore = useAuthStore();
  const headers = applyAuthHeaders(authStore, init);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  await handleUnauthorized(response, authStore);

  return response;
}

export async function request<T>(path: string, init?: RequestInit) {
  const response = await fetchApi(path, init);
  const payload = (await response.json()) as ApiEnvelope<T>;

  if (!response.ok || payload.code !== 0) {
    throw new Error(payload.message || '请求失败');
  }

  return payload.data;
}

export async function requestBlob(path: string, init?: RequestInit) {
  const response = await fetchApi(path, init);

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return response.blob();
}
