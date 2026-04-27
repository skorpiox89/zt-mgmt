<template>
  <div class="page-shell">
    <a-card class="page-card" :bordered="false">
      <div class="toolbar">
        <div>
          <h1 class="page-title">用户管理</h1>
          <p class="page-subtitle">
            创建普通用户、重置密码，并为指定用户配置前端隐藏的网络列表。
          </p>
        </div>
        <a-space>
          <a-button @click="loadUsers">刷新</a-button>
          <a-button type="primary" @click="openCreateModal">新建用户</a-button>
        </a-space>
      </div>

      <a-table
        :columns="columns"
        :data-source="users"
        :loading="loading"
        row-key="id"
        size="middle"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'role'">
            <a-tag :color="record.role === 'ADMIN' ? 'gold' : 'blue'">
              {{ record.role === 'ADMIN' ? '管理员' : '用户' }}
            </a-tag>
          </template>

          <template v-else-if="column.key === 'createdAt'">
            {{ formatDate(record.createdAt) }}
          </template>

          <template v-else-if="column.key === 'actions'">
            <a-space v-if="record.role === 'USER'">
              <a-button size="small" @click="openResetPasswordModal(record)">重置密码</a-button>
              <a-button size="small" @click="openHiddenNetworksModal(record)">隐藏网络</a-button>
            </a-space>
            <span v-else>-</span>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-modal
      v-model:open="createOpen"
      :confirm-loading="saving"
      title="新建用户"
      @ok="handleCreateUser"
    >
      <a-form layout="vertical">
        <a-form-item label="用户名" extra="支持字母、数字、点、下划线与中划线。">
          <a-input v-model:value="createForm.username" />
        </a-form-item>
        <a-form-item label="初始密码">
          <a-input-password v-model:value="createForm.password" />
        </a-form-item>
        <a-form-item label="确认密码">
          <a-input-password v-model:value="createForm.confirmPassword" />
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal
      v-model:open="resetOpen"
      :confirm-loading="saving"
      :title="`重置密码${resetTarget ? ` · ${resetTarget.username}` : ''}`"
      @ok="handleResetPassword"
    >
      <a-form layout="vertical">
        <a-form-item label="新密码">
          <a-input-password v-model:value="resetForm.newPassword" />
        </a-form-item>
        <a-form-item label="确认密码">
          <a-input-password v-model:value="resetForm.confirmPassword" />
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal
      v-model:open="hiddenOpen"
      :confirm-loading="hiddenSaving"
      :title="`隐藏网络配置${hiddenTarget ? ` · ${hiddenTarget.username}` : ''}`"
      width="920px"
      @ok="handleSaveHiddenNetworks"
    >
      <a-space direction="vertical" style="width: 100%" :size="16">
        <div class="modal-copy">
          被隐藏的网络不会出现在普通用户的网络列表和网络测试切换选项中，后端也会阻止切换到这些网络。
        </div>
        <a-input
          v-model:value="hiddenKeyword"
          allow-clear
          placeholder="搜索网络名称 / 控制器 / 区域 / 网络 ID"
        />
        <a-table
          :columns="hiddenNetworkColumns"
          :data-source="filteredNetworkRows"
          :loading="hiddenLoading"
          :pagination="{ pageSize: 8 }"
          :row-selection="hiddenRowSelection"
          row-key="hiddenKey"
          size="small"
        />
      </a-space>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { message } from 'ant-design-vue';
import { computed, onMounted, reactive, ref } from 'vue';
import { getNetworks } from '../../api/networks';
import {
  createUser,
  getUserHiddenNetworks,
  getUsers,
  resetUserPassword,
  updateUserHiddenNetworks,
} from '../../api/users';
import type { NetworkItem } from '../../types/network';
import type { HiddenNetworkItem, UserItem } from '../../types/user';

function buildHiddenKey(controllerId: number, networkId: string) {
  return `${controllerId}:${networkId}`;
}

function parseHiddenKey(value: string): HiddenNetworkItem {
  const [controllerId, networkId] = value.split(':');
  return {
    controllerId: Number(controllerId),
    networkId,
  };
}

const loading = ref(false);
const saving = ref(false);
const hiddenLoading = ref(false);
const hiddenSaving = ref(false);
const createOpen = ref(false);
const resetOpen = ref(false);
const hiddenOpen = ref(false);
const users = ref<UserItem[]>([]);
const allNetworks = ref<NetworkItem[]>([]);
const resetTarget = ref<UserItem | null>(null);
const hiddenTarget = ref<UserItem | null>(null);
const hiddenKeyword = ref('');
const selectedHiddenKeys = ref<string[]>([]);

const createForm = reactive({
  confirmPassword: '',
  password: '',
  username: '',
});

const resetForm = reactive({
  confirmPassword: '',
  newPassword: '',
});

const columns = [
  { dataIndex: 'username', key: 'username', title: '用户名' },
  { dataIndex: 'role', key: 'role', title: '角色' },
  { dataIndex: 'hiddenNetworkCount', key: 'hiddenNetworkCount', title: '隐藏网络数' },
  { dataIndex: 'createdAt', key: 'createdAt', title: '创建时间' },
  { key: 'actions', title: '操作' },
];

const hiddenNetworkColumns = [
  { dataIndex: 'controllerName', key: 'controllerName', title: '控制器' },
  { dataIndex: 'region', key: 'region', title: '区域' },
  { dataIndex: 'networkName', key: 'networkName', title: '网络名称' },
  { dataIndex: 'networkId', key: 'networkId', title: '网络 ID' },
];

const filteredNetworkRows = computed(() => {
  const keyword = hiddenKeyword.value.trim().toLowerCase();
  const rows = allNetworks.value.map((item) => ({
    ...item,
    hiddenKey: buildHiddenKey(item.controllerId, item.networkId),
  }));

  if (!keyword) {
    return rows;
  }

  return rows.filter((item) =>
    [item.controllerName, item.networkId, item.networkName, item.region].some((value) =>
      value.toLowerCase().includes(keyword),
    ),
  );
});

const hiddenRowSelection = computed(() => ({
  onChange: (keys: Array<string | number>) => {
    selectedHiddenKeys.value = keys.map((key) => String(key));
  },
  selectedRowKeys: selectedHiddenKeys.value,
}));

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function resetCreateForm() {
  createForm.confirmPassword = '';
  createForm.password = '';
  createForm.username = '';
}

function resetPasswordForm() {
  resetForm.confirmPassword = '';
  resetForm.newPassword = '';
}

async function loadUsers() {
  loading.value = true;
  try {
    const result = await getUsers();
    users.value = result.items;
  } catch (error) {
    message.error(error instanceof Error ? error.message : '加载用户列表失败');
  } finally {
    loading.value = false;
  }
}

function openCreateModal() {
  resetCreateForm();
  createOpen.value = true;
}

async function handleCreateUser() {
  if (!createForm.username || !createForm.password) {
    message.warning('请填写完整的用户信息');
    return;
  }

  if (createForm.password !== createForm.confirmPassword) {
    message.warning('两次输入的密码不一致');
    return;
  }

  saving.value = true;
  try {
    await createUser({
      password: createForm.password,
      username: createForm.username,
    });
    message.success('用户创建成功');
    createOpen.value = false;
    resetCreateForm();
    await loadUsers();
  } catch (error) {
    message.error(error instanceof Error ? error.message : '创建用户失败');
  } finally {
    saving.value = false;
  }
}

function openResetPasswordModal(user: UserItem) {
  resetTarget.value = user;
  resetPasswordForm();
  resetOpen.value = true;
}

async function handleResetPassword() {
  if (!resetTarget.value) {
    return;
  }

  if (!resetForm.newPassword) {
    message.warning('请输入新密码');
    return;
  }

  if (resetForm.newPassword !== resetForm.confirmPassword) {
    message.warning('两次输入的密码不一致');
    return;
  }

  saving.value = true;
  try {
    await resetUserPassword(resetTarget.value.id, {
      newPassword: resetForm.newPassword,
    });
    message.success('密码已重置');
    resetOpen.value = false;
    resetPasswordForm();
  } catch (error) {
    message.error(error instanceof Error ? error.message : '重置密码失败');
  } finally {
    saving.value = false;
  }
}

async function openHiddenNetworksModal(user: UserItem) {
  hiddenTarget.value = user;
  hiddenKeyword.value = '';
  hiddenOpen.value = true;
  hiddenLoading.value = true;
  selectedHiddenKeys.value = [];

  try {
    const [hiddenResult, networksResult] = await Promise.all([
      getUserHiddenNetworks(user.id),
      getNetworks(),
    ]);
    selectedHiddenKeys.value = hiddenResult.items.map((item) =>
      buildHiddenKey(item.controllerId, item.networkId),
    );
    allNetworks.value = networksResult.items;
  } catch (error) {
    message.error(error instanceof Error ? error.message : '加载隐藏网络配置失败');
  } finally {
    hiddenLoading.value = false;
  }
}

async function handleSaveHiddenNetworks() {
  if (!hiddenTarget.value) {
    return;
  }

  hiddenSaving.value = true;
  try {
    await updateUserHiddenNetworks(
      hiddenTarget.value.id,
      selectedHiddenKeys.value.map((item) => parseHiddenKey(item)),
    );
    message.success('隐藏网络配置已更新');
    hiddenOpen.value = false;
    await loadUsers();
  } catch (error) {
    message.error(error instanceof Error ? error.message : '保存隐藏网络配置失败');
  } finally {
    hiddenSaving.value = false;
  }
}

onMounted(() => {
  void loadUsers();
});
</script>

<style scoped>
.toolbar {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  margin-bottom: 20px;
}

.modal-copy {
  color: #64748b;
  font-size: 13px;
  line-height: 1.6;
}
</style>
