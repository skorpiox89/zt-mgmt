<template>
  <a-layout style="min-height: 100vh">
    <a-layout-sider :width="248" theme="light" style="border-right: 1px solid #e2e8f0">
      <div class="brand-panel">
        <div class="brand-kicker">统一管理平台</div>
        <div class="brand-title">ZT MGMT</div>
        <div class="brand-caption">用于统一管理多个 ztncui 控制器的内部控制台。</div>
      </div>
      <a-menu :selected-keys="selectedKeys" mode="inline">
        <a-menu-item key="/controllers" @click="router.push('/controllers')">
          <template #icon>
            <CloudServerOutlined />
          </template>
          控制器管理
        </a-menu-item>
        <a-menu-item key="/networks" @click="router.push('/networks')">
          <template #icon>
            <DatabaseOutlined />
          </template>
          网络管理
        </a-menu-item>
      </a-menu>
    </a-layout-sider>
    <a-layout>
      <a-layout-header class="topbar">
        <div>
          <div class="topbar-title">ZeroTier 统一管理台</div>
          <div class="topbar-subtitle">在一个界面中集中管理控制器、网络和成员。</div>
        </div>
        <div class="topbar-actions">
          <span class="topbar-user">{{ authStore.user?.username || 'admin' }}</span>
          <a-button type="text" @click="handleLogout">
            <template #icon>
              <LogoutOutlined />
            </template>
            退出登录
          </a-button>
        </div>
      </a-layout-header>
      <a-layout-content>
        <RouterView />
      </a-layout-content>
    </a-layout>
  </a-layout>
</template>

<script setup lang="ts">
import {
  CloudServerOutlined,
  DatabaseOutlined,
  LogoutOutlined,
} from '@ant-design/icons-vue';
import { message } from 'ant-design-vue';
import { computed } from 'vue';
import { RouterView, useRoute, useRouter } from 'vue-router';
import { logout } from '../api/auth';
import { useAuthStore } from '../stores/auth';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const selectedKeys = computed(() => {
  if (route.path.startsWith('/networks')) {
    return ['/networks'];
  }
  return ['/controllers'];
});

async function handleLogout() {
  try {
    await logout();
  } catch {
    // Ignore server logout failures for local session cleanup.
  } finally {
    authStore.clearSession();
    message.success('已退出登录');
    void router.push('/login');
  }
}
</script>

<style scoped>
.brand-panel {
  padding: 28px 20px 24px;
}

.brand-kicker {
  color: #64748b;
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.brand-title {
  margin-top: 8px;
  font-size: 28px;
  font-weight: 800;
  letter-spacing: -0.04em;
}

.brand-caption {
  margin-top: 8px;
  color: #475569;
  font-size: 13px;
  line-height: 1.5;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 88px;
  height: auto;
  padding: 16px 24px;
  line-height: 1.4;
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(18px);
  border-bottom: 1px solid rgba(148, 163, 184, 0.18);
}

.topbar-title {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.15;
}

.topbar-subtitle {
  color: #64748b;
  font-size: 13px;
  line-height: 1.5;
}

.topbar-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.topbar-user {
  color: #334155;
  font-weight: 600;
}

@media (max-width: 900px) {
  .topbar {
    align-items: flex-start;
    flex-direction: column;
  }

  .topbar-actions {
    width: 100%;
    justify-content: space-between;
  }
}
</style>
