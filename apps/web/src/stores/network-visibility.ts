import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { getCurrentUserHiddenNetworks } from '../api/users';
import { useAuthStore } from './auth';

function buildHiddenKey(controllerId: number, networkId: string) {
  return `${controllerId}:${networkId}`;
}

export const useNetworkVisibilityStore = defineStore('network-visibility', () => {
  const hiddenKeys = ref<string[]>([]);
  const initialized = ref(false);
  const loadedUserId = ref<number | null>(null);
  const hiddenKeySet = computed(() => new Set(hiddenKeys.value));
  let pendingLoad: Promise<void> | null = null;

  async function ensureLoaded(force = false) {
    const authStore = useAuthStore();
    if (!authStore.isAuthenticated || !authStore.user) {
      clear();
      return;
    }

    if (authStore.user.role === 'ADMIN') {
      hiddenKeys.value = [];
      initialized.value = true;
      loadedUserId.value = authStore.user.id;
      return;
    }

    if (!force && initialized.value && loadedUserId.value === authStore.user.id) {
      return;
    }

    if (pendingLoad) {
      return pendingLoad;
    }

    const currentUserId = authStore.user.id;
    pendingLoad = (async () => {
      const result = await getCurrentUserHiddenNetworks();
      if (authStore.user?.id !== currentUserId) {
        return;
      }

      hiddenKeys.value = result.items.map((item) => buildHiddenKey(item.controllerId, item.networkId));
      initialized.value = true;
      loadedUserId.value = currentUserId;
    })().finally(() => {
      pendingLoad = null;
    });

    return pendingLoad;
  }

  function clear() {
    hiddenKeys.value = [];
    initialized.value = false;
    loadedUserId.value = null;
    pendingLoad = null;
  }

  function isHidden(controllerId: number, networkId: string) {
    return hiddenKeySet.value.has(buildHiddenKey(controllerId, networkId));
  }

  function filterNetworks<T extends { controllerId: number; networkId: string }>(items: T[]) {
    return items.filter((item) => !isHidden(item.controllerId, item.networkId));
  }

  return {
    clear,
    ensureLoaded,
    filterNetworks,
    initialized,
    isHidden,
  };
});
