<template>
  <div class="page-shell">
    <a-card class="page-card" :bordered="false">
      <div class="toolbar">
        <div>
          <h1 class="page-title">Controller Management</h1>
          <p class="page-subtitle">
            Maintain ztncui endpoints and the subnet pool used for automatic network setup.
          </p>
        </div>
        <a-button type="primary" @click="openCreateModal">Add Controller</a-button>
      </div>

      <a-table
        :columns="columns"
        :data-source="controllers"
        :loading="loading"
        row-key="id"
        size="middle"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'status'">
            <a-tag :color="statusColor(record.status)">{{ record.status }}</a-tag>
          </template>

          <template v-else-if="column.key === 'lastCheckedAt'">
            {{ record.lastCheckedAt || '-' }}
          </template>

          <template v-else-if="column.key === 'actions'">
            <a-space>
              <a-button size="small" @click="openEditModal(record)">Edit</a-button>
              <a-button size="small" @click="handleTest(record.id)">Test</a-button>
              <a-button danger size="small" @click="handleDelete(record.id)">Delete</a-button>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-modal
      v-model:open="modalOpen"
      :confirm-loading="saving"
      :title="editingId ? 'Edit Controller' : 'Add Controller'"
      @ok="handleSave"
    >
      <a-form layout="vertical">
        <a-form-item label="Name">
          <a-input v-model:value="form.name" />
        </a-form-item>
        <a-form-item label="Region">
          <a-input v-model:value="form.region" />
        </a-form-item>
        <a-form-item label="Base URL">
          <a-input v-model:value="form.baseUrl" placeholder="http://127.0.0.1:30980" />
        </a-form-item>
        <a-form-item label="Username">
          <a-input v-model:value="form.username" />
        </a-form-item>
        <a-form-item label="Password">
          <a-input-password v-model:value="form.password" />
        </a-form-item>
        <a-form-item label="Subnet Pool CIDR">
          <a-input v-model:value="form.subnetPoolCidr" placeholder="10.10.0.0/16" />
        </a-form-item>
        <a-form-item label="Subnet Prefix">
          <a-input-number v-model:value="form.subnetPrefix" :max="30" :min="1" style="width: 100%" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { Modal, message } from 'ant-design-vue';
import { onMounted, reactive, ref } from 'vue';
import {
  createController,
  deleteController,
  getControllers,
  testController,
  updateController,
} from '../../api/controllers';
import type { ControllerFormPayload, ControllerItem } from '../../types/controller';

const loading = ref(false);
const saving = ref(false);
const modalOpen = ref(false);
const editingId = ref<number | null>(null);
const controllers = ref<ControllerItem[]>([]);
const form = reactive<ControllerFormPayload>({
  baseUrl: '',
  name: '',
  password: '',
  region: '',
  subnetPoolCidr: '10.10.0.0/16',
  subnetPrefix: 24,
  username: 'admin',
});

const columns = [
  { dataIndex: 'name', key: 'name', title: 'Name' },
  { dataIndex: 'region', key: 'region', title: 'Region' },
  { dataIndex: 'baseUrl', key: 'baseUrl', title: 'Base URL' },
  { dataIndex: 'subnetPoolCidr', key: 'subnetPoolCidr', title: 'Subnet Pool' },
  { dataIndex: 'status', key: 'status', title: 'Status' },
  { dataIndex: 'lastCheckedAt', key: 'lastCheckedAt', title: 'Last Checked' },
  { key: 'actions', title: 'Actions' },
];

function resetForm() {
  form.baseUrl = '';
  form.name = '';
  form.password = '';
  form.region = '';
  form.subnetPoolCidr = '10.10.0.0/16';
  form.subnetPrefix = 24;
  form.username = 'admin';
}

function openCreateModal() {
  editingId.value = null;
  resetForm();
  modalOpen.value = true;
}

function openEditModal(record: ControllerItem) {
  editingId.value = record.id;
  form.baseUrl = record.baseUrl;
  form.name = record.name;
  form.password = '';
  form.region = record.region;
  form.subnetPoolCidr = record.subnetPoolCidr;
  form.subnetPrefix = record.subnetPrefix;
  form.username = record.username;
  modalOpen.value = true;
}

function statusColor(status: ControllerItem['status']) {
  if (status === 'online') {
    return 'green';
  }
  if (status === 'offline') {
    return 'red';
  }
  return 'default';
}

async function loadControllers() {
  loading.value = true;
  try {
    const result = await getControllers();
    controllers.value = result.items;
  } catch (error) {
    message.error(error instanceof Error ? error.message : 'Failed to load controllers');
  } finally {
    loading.value = false;
  }
}

async function handleSave() {
  saving.value = true;
  try {
    if (editingId.value) {
      await updateController(editingId.value, form);
      message.success('Controller updated');
    } else {
      await createController(form);
      message.success('Controller created');
    }
    modalOpen.value = false;
    await loadControllers();
  } catch (error) {
    message.error(error instanceof Error ? error.message : 'Failed to save controller');
  } finally {
    saving.value = false;
  }
}

async function handleTest(id: number) {
  try {
    const result = await testController(id);
    message.success(
      `Connection ok. Controller ${result.controllerAddress || '-'} / version ${result.version || '-'}`,
    );
    await loadControllers();
  } catch (error) {
    message.error(error instanceof Error ? error.message : 'Connection test failed');
    await loadControllers();
  }
}

function handleDelete(id: number) {
  Modal.confirm({
    content: 'Delete this controller configuration?',
    okText: 'Delete',
    okType: 'danger',
    onOk: async () => {
      try {
        await deleteController(id);
        message.success('Controller deleted');
        await loadControllers();
      } catch (error) {
        message.error(error instanceof Error ? error.message : 'Failed to delete controller');
      }
    },
    title: 'Delete Controller',
  });
}

onMounted(() => {
  void loadControllers();
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
