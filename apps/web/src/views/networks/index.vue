<template>
  <div class="page-shell">
    <a-card class="page-card" :bordered="false">
      <div class="toolbar">
        <div>
          <h1 class="page-title">Network Management</h1>
          <p class="page-subtitle">
            Browse networks across all controllers and create a new network with automatic setup.
          </p>
        </div>
        <a-space>
          <a-button @click="loadData">Refresh</a-button>
          <a-button type="primary" @click="openCreateModal">Create Network</a-button>
        </a-space>
      </div>

      <a-form layout="inline" style="margin-bottom: 20px">
        <a-form-item label="Controller">
          <a-select
            v-model:value="filters.controllerId"
            :allow-clear="true"
            :options="controllerOptions"
            style="width: 220px"
          />
        </a-form-item>
        <a-form-item label="Keyword">
          <a-input v-model:value="filters.keyword" placeholder="Search network name" style="width: 220px" />
        </a-form-item>
        <a-form-item>
          <a-button type="primary" @click="loadData">Search</a-button>
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
                Detail
              </a-button>
              <a-button size="small" @click="openRenameModal(record)">Rename</a-button>
              <a-button danger size="small" @click="handleDelete(record.controllerId, record.networkId)">
                Delete
              </a-button>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-modal
      v-model:open="createOpen"
      :confirm-loading="saving"
      title="Create Network"
      @ok="handleCreate"
    >
      <a-form layout="vertical">
        <a-form-item label="Controller">
          <a-select
            v-model:value="createForm.controllerId"
            :options="controllerOptions"
            placeholder="Select controller"
          />
        </a-form-item>
        <a-form-item label="Network Name">
          <a-input v-model:value="createForm.networkName" placeholder="office-vpn" />
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal
      v-model:open="renameOpen"
      :confirm-loading="saving"
      title="Rename Network"
      @ok="handleRename"
    >
      <a-form layout="vertical">
        <a-form-item label="Network Name">
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
import type { ControllerItem } from '../../types/controller';
import type { NetworkItem } from '../../types/network';

const router = useRouter();
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
  { dataIndex: 'controllerName', key: 'controllerName', title: 'Controller' },
  { dataIndex: 'region', key: 'region', title: 'Region' },
  { dataIndex: 'networkName', key: 'networkName', title: 'Network Name' },
  { dataIndex: 'networkId', key: 'networkId', title: 'Network ID' },
  { dataIndex: 'memberCount', key: 'memberCount', title: 'Members' },
  { key: 'actions', title: 'Actions' },
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
    await loadControllersData();
    const result = await getNetworks({
      controllerId: filters.controllerId,
      keyword: filters.keyword || undefined,
    });
    networks.value = result.items;
  } catch (error) {
    message.error(error instanceof Error ? error.message : 'Failed to load networks');
  } finally {
    loading.value = false;
  }
}

async function handleCreate() {
  if (!createForm.controllerId) {
    message.warning('Select a controller first');
    return;
  }

  saving.value = true;
  try {
    const result = await createNetwork({
      controllerId: createForm.controllerId,
      networkName: createForm.networkName,
    });
    message.success(`Network created with CIDR ${result.networkCidr}`);
    createOpen.value = false;
    await loadData();
    await router.push(`/networks/${result.controllerId}/${result.networkId}`);
  } catch (error) {
    message.error(error instanceof Error ? error.message : 'Failed to create network');
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
    message.success('Network renamed');
    renameOpen.value = false;
    await loadData();
  } catch (error) {
    message.error(error instanceof Error ? error.message : 'Failed to rename network');
  } finally {
    saving.value = false;
  }
}

function handleDelete(controllerId: number, networkId: string) {
  Modal.confirm({
    content: 'Delete this network? This action cannot be undone.',
    okText: 'Delete',
    okType: 'danger',
    onOk: async () => {
      try {
        await deleteNetwork(controllerId, networkId);
        message.success('Network deleted');
        await loadData();
      } catch (error) {
        message.error(error instanceof Error ? error.message : 'Failed to delete network');
      }
    },
    title: 'Delete Network',
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
