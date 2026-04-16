<template>
  <div class="page-shell">
    <a-card class="page-card" :bordered="false">
      <div class="toolbar">
        <div>
          <h1 class="page-title">网络管理</h1>
          <p class="page-subtitle">
            浏览所有控制器下的网络，并一键创建带自动初始化的新网络。
          </p>
        </div>
        <a-space>
          <a-button @click="loadData">刷新</a-button>
          <a-button type="primary" @click="openCreateModal">创建网络</a-button>
        </a-space>
      </div>

      <a-form layout="inline" style="margin-bottom: 20px">
        <a-form-item label="控制器">
          <a-select
            v-model:value="filters.controllerId"
            :allow-clear="true"
            :options="controllerOptions"
            style="width: 220px"
          />
        </a-form-item>
        <a-form-item label="关键词">
          <a-input v-model:value="filters.keyword" placeholder="搜索网络名称" style="width: 220px" />
        </a-form-item>
        <a-form-item>
          <a-button type="primary" @click="loadData">搜索</a-button>
        </a-form-item>
      </a-form>

      <a-table
        :columns="columns"
        :data-source="networks"
        :loading="loading"
        row-key="networkId"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'memberCount'">
            {{ record.memberCount ?? '-' }}
          </template>
          <template v-else-if="column.key === 'actions'">
            <a-space>
              <a-button size="small" @click="router.push(`/networks/${record.controllerId}/${record.networkId}`)">
                详情
              </a-button>
              <a-button size="small" @click="openRenameModal(record)">重命名</a-button>
              <a-button danger size="small" @click="handleDelete(record.controllerId, record.networkId)">
                删除
              </a-button>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-modal
      v-model:open="createOpen"
      :confirm-loading="saving"
      title="创建网络"
      @ok="handleCreate"
    >
      <a-form layout="vertical">
        <a-form-item label="控制器">
          <a-select
            v-model:value="createForm.controllerId"
            :options="controllerOptions"
            placeholder="请选择控制器"
          />
        </a-form-item>
        <a-form-item label="网络名称">
          <a-input v-model:value="createForm.networkName" placeholder="office-vpn" />
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal
      v-model:open="renameOpen"
      :confirm-loading="saving"
      title="重命名网络"
      @ok="handleRename"
    >
      <a-form layout="vertical">
        <a-form-item label="网络名称">
          <a-input v-model:value="renameValue" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { Modal, message } from 'ant-design-vue';
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { getControllers } from '../../api/controllers';
import {
  createNetwork,
  deleteNetwork,
  getNetworks,
  renameNetwork,
} from '../../api/networks';
import { useNetworkVisibilityStore } from '../../stores/network-visibility';
import type { ControllerItem } from '../../types/controller';
import type { NetworkItem } from '../../types/network';

const router = useRouter();
const visibilityStore = useNetworkVisibilityStore();
const loading = ref(false);
const saving = ref(false);
const createOpen = ref(false);
const renameOpen = ref(false);
const controllers = ref<ControllerItem[]>([]);
const networks = ref<NetworkItem[]>([]);
const renameTarget = ref<NetworkItem | null>(null);
const renameValue = ref('');
const filters = reactive({
  controllerId: undefined as number | undefined,
  keyword: '',
});
const createForm = reactive({
  controllerId: undefined as number | undefined,
  networkName: '',
});

const columns = [
  { dataIndex: 'controllerName', key: 'controllerName', title: '控制器' },
  { dataIndex: 'region', key: 'region', title: '区域' },
  { dataIndex: 'networkName', key: 'networkName', title: '网络名称' },
  { dataIndex: 'networkId', key: 'networkId', title: '网络 ID' },
  { dataIndex: 'memberCount', key: 'memberCount', title: '成员数' },
  { key: 'actions', title: '操作' },
];

const controllerOptions = computed(() =>
  controllers.value.map((controller) => ({
    label: `${controller.name} (${controller.region})`,
    value: controller.id,
  })),
);

function openCreateModal() {
  createForm.controllerId = controllers.value[0]?.id;
  createForm.networkName = '';
  createOpen.value = true;
}

function openRenameModal(record: NetworkItem) {
  renameTarget.value = record;
  renameValue.value = record.networkName;
  renameOpen.value = true;
}

async function loadControllersData() {
  const result = await getControllers();
  controllers.value = result.items;
}

async function loadData() {
  loading.value = true;
  try {
    await visibilityStore.ensureLoaded();
    await loadControllersData();
    const result = await getNetworks({
      controllerId: filters.controllerId,
      keyword: filters.keyword || undefined,
    });
    networks.value = visibilityStore.filterNetworks(result.items);
  } catch (error) {
    message.error(error instanceof Error ? error.message : '加载网络列表失败');
  } finally {
    loading.value = false;
  }
}

async function handleCreate() {
  if (!createForm.controllerId) {
    message.warning('请先选择控制器');
    return;
  }

  saving.value = true;
  try {
    const result = await createNetwork({
      controllerId: createForm.controllerId,
      networkName: createForm.networkName,
    });
    message.success(`网络创建成功，CIDR：${result.networkCidr}`);
    createOpen.value = false;
    await loadData();
    if (visibilityStore.isHidden(result.controllerId, result.networkId)) {
      message.warning('网络已创建，但当前账号的隐藏配置不允许查看该网络');
      return;
    }
    await router.push(`/networks/${result.controllerId}/${result.networkId}`);
  } catch (error) {
    message.error(error instanceof Error ? error.message : '创建网络失败');
  } finally {
    saving.value = false;
  }
}

async function handleRename() {
  if (!renameTarget.value) {
    return;
  }

  saving.value = true;
  try {
    await renameNetwork(
      renameTarget.value.controllerId,
      renameTarget.value.networkId,
      renameValue.value,
    );
    message.success('网络重命名成功');
    renameOpen.value = false;
    await loadData();
  } catch (error) {
    message.error(error instanceof Error ? error.message : '重命名网络失败');
  } finally {
    saving.value = false;
  }
}

function handleDelete(controllerId: number, networkId: string) {
  Modal.confirm({
    content: '确认删除这个网络吗？删除后无法恢复。',
    okText: '删除',
    okType: 'danger',
    onOk: async () => {
      try {
        await deleteNetwork(controllerId, networkId);
        message.success('网络已删除');
        await loadData();
      } catch (error) {
        message.error(error instanceof Error ? error.message : '删除网络失败');
      }
    },
    title: '删除网络',
  });
}

onMounted(() => {
  void loadData();
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
</style>
