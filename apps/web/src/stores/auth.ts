import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { SessionUser } from '../types/auth';

const TOKEN_KEY = 'zt-mgmt-token';
const USER_KEY = 'zt-mgmt-user';

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem(TOKEN_KEY));
  const user = ref<SessionUser | null>(
    (() => {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? (JSON.parse(raw) as SessionUser) : null;
    })(),
  );

  const isAuthenticated = computed(() => Boolean(token.value));

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
    isAuthenticated,
    setSession,
    token,
    user,
  };
});
