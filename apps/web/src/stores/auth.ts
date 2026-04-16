import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { SessionUser } from '../types/auth';

const TOKEN_KEY = 'zt-mgmt-token';
const USER_KEY = 'zt-mgmt-user';

function parseStoredUser() {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<SessionUser>;
    if (
      typeof parsed.id === 'number' &&
      (parsed.role === 'ADMIN' || parsed.role === 'USER') &&
      typeof parsed.username === 'string'
    ) {
      return parsed as SessionUser;
    }
  } catch {
    // Ignore malformed local storage content.
  }

  localStorage.removeItem(USER_KEY);
  return null;
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<SessionUser | null>(parseStoredUser());
  const token = ref<string | null>(user.value ? localStorage.getItem(TOKEN_KEY) : null);

  if (!user.value) {
    localStorage.removeItem(TOKEN_KEY);
  }

  const isAdmin = computed(() => user.value?.role === 'ADMIN');
  const isAuthenticated = computed(() => Boolean(token.value && user.value));

  function setSession(nextToken: string, nextUser: SessionUser) {
    token.value = nextToken;
    user.value = nextUser;
    localStorage.setItem(TOKEN_KEY, nextToken);
    localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
  }

  function clearSession() {
    token.value = null;
    user.value = null;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  return {
    clearSession,
    isAdmin,
    isAuthenticated,
    setSession,
    token,
    user,
  };
});
