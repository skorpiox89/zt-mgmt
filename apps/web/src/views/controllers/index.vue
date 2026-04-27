<template>
  <div class="page-shell">
    <a-card class="page-card" :bordered="false">
      <div class="toolbar">
        <div>
          <h1 class="page-title">控制器管理</h1>
          <p class="page-subtitle">
            维护 ztncui 控制器地址，以及用于自动创建网络的子网池配置。
          </p>
        </div>
        <a-button type="primary" @click="openCreateModal">新增控制器</a-button>
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
            <a-tag :color="statusColor(record.status)">{{ statusText(record.status) }}</a-tag>
          </template>

          <template v-else-if="column.key === 'lastCheckedAt'">
            {{ record.lastCheckedAt || '-' }}
          </template>

          <template v-else-if="column.key === 'planetFile'">
            <div class="planet-cell">
              <a-tag :color="record.hasPlanetFile ? 'cyan' : 'default'">
                {{ record.hasPlanetFile ? '已上传' : '未上传' }}
              </a-tag>
              <div v-if="record.hasPlanetFile" class="planet-meta">
                大小 {{ formatFileSize(record.planetFileSize) }} ·
                上传时间 {{ record.planetFileUploadedAt || '-' }}
              </div>
            </div>
          </template>

          <template v-else-if="column.key === 'actions'">
            <a-space wrap>
              <a-button size="small" @click="openEditModal(record)">编辑</a-button>
              <a-button size="small" @click="handleTest(record.id)">测试连接</a-button>
              <a-button danger size="small" @click="handleDelete(record.id)">删除</a-button>
              <template v-if="authStore.isAdmin">
                <a-dropdown :trigger="['click']">
                  <a-button size="small" :loading="isPlanetActionLoading(record.id)">
                    管理 planet
                    <DownOutlined />
                  </a-button>
                  <template #overlay>
                    <a-menu @click="handlePlanetMenuMenuClick(record.id, $event)">
                      <a-menu-item key="upload">
                        {{ record.hasPlanetFile ? '更新 planet' : '上传 planet' }}
                      </a-menu-item>
                      <a-menu-item key="download" :disabled="!record.hasPlanetFile">
                        下载 planet
                      </a-menu-item>
                      <a-menu-item key="delete" danger :disabled="!record.hasPlanetFile">
                        删除 planet
                      </a-menu-item>
                    </a-menu>
                  </template>
                </a-dropdown>
              </template>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <input
      ref="planetInput"
      class="hidden-file-input"
      type="file"
      @change="handlePlanetSelected"
    />

    <a-modal
      v-model:open="modalOpen"
      :confirm-loading="saving"
      :title="editingId ? '编辑控制器' : '新增控制器'"
      @ok="handleSave"
    >
      <a-form layout="vertical">
        <a-form-item label="名称">
          <a-input v-model:value="form.name" />
        </a-form-item>
        <a-form-item label="区域">
          <a-input v-model:value="form.region" />
        </a-form-item>
        <a-form-item label="控制器地址">
          <a-input v-model:value="form.baseUrl" placeholder="http://127.0.0.1:30980" />
        </a-form-item>
        <a-form-item label="用户名">
          <a-input v-model:value="form.username" />
        </a-form-item>
        <a-form-item label="密码">
          <a-input-password v-model:value="form.password" />
        </a-form-item>
        <a-form-item label="子网池 CIDR">
          <a-input v-model:value="form.subnetPoolCidr" placeholder="10.10.0.0/16" />
        </a-form-item>
        <a-form-item label="子网前缀">
          <a-input-number v-model:value="form.subnetPrefix" :max="30" :min="1" style="width: 100%" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { DownOutlined } from '@ant-design/icons-vue';
import { Modal, message } from 'ant-design-vue';
import { onMounted, reactive, ref } from 'vue';
import {
  createController,
  deleteControllerPlanet,
  deleteController,
  downloadControllerPlanet,
  getControllers,
  testController,
  uploadControllerPlanet,
  updateController,
} from '../../api/controllers';
import { useAuthStore } from '../../stores/auth';
import type { ControllerFormPayload, ControllerItem } from '../../types/controller';

const MAX_PLANET_FILE_SIZE_BYTES = 1024 * 1024;

const authStore = useAuthStore();
const loading = ref(false);
const saving = ref(false);
const modalOpen = ref(false);
const editingId = ref<number | null>(null);
const controllers = ref<ControllerItem[]>([]);
const planetInput = ref<HTMLInputElement | null>(null);
const pendingPlanetControllerId = ref<number | null>(null);
const uploadingPlanetId = ref<number | null>(null);
const downloadingPlanetId = ref<number | null>(null);
const deletingPlanetId = ref<number | null>(null);
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
  { dataIndex: 'name', key: 'name', title: '名称' },
  { dataIndex: 'region', key: 'region', title: '区域' },
  { dataIndex: 'baseUrl', key: 'baseUrl', title: '控制器地址' },
  { dataIndex: 'subnetPoolCidr', key: 'subnetPoolCidr', title: '子网池' },
  { dataIndex: 'planetFile', key: 'planetFile', title: 'Planet 文件' },
  { dataIndex: 'status', key: 'status', title: '状态' },
  { dataIndex: 'lastCheckedAt', key: 'lastCheckedAt', title: '最近检测时间' },
  { key: 'actions', title: '操作' },
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

function statusText(status: ControllerItem['status']) {
  if (status === 'online') {
    return '在线';
  }
  if (status === 'offline') {
    return '离线';
  }
  return '未知';
}

function formatFileSize(size: number | null) {
  if (size === null) {
    return '-';
  }

  if (size < 1024) {
    return `${size} B`;
  }

  return `${(size / 1024).toFixed(size >= 10 * 1024 ? 0 : 1)} KB`;
}

function openPlanetPicker(id: number) {
  pendingPlanetControllerId.value = id;
  if (planetInput.value) {
    planetInput.value.value = '';
    planetInput.value.click();
  }
}

function isPlanetActionLoading(id: number) {
  return (
    uploadingPlanetId.value === id ||
    downloadingPlanetId.value === id ||
    deletingPlanetId.value === id
  );
}

function handlePlanetMenuClick(id: number, key: string) {
  if (key === 'upload') {
    openPlanetPicker(id);
    return;
  }

  if (key === 'download') {
    void handleDownloadPlanet(id);
    return;
  }

  if (key === 'delete') {
    handleDeletePlanet(id);
  }
}

function handlePlanetMenuMenuClick(id: number, event: { key: string | number }) {
  handlePlanetMenuClick(id, String(event.key));
}

async function handlePlanetSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  const controllerId = pendingPlanetControllerId.value;
  input.value = '';

  if (!file || !controllerId) {
    pendingPlanetControllerId.value = null;
    return;
  }

  if (file.size === 0) {
    pendingPlanetControllerId.value = null;
    message.warning('planet 文件不能为空');
    return;
  }

  if (file.size > MAX_PLANET_FILE_SIZE_BYTES) {
    pendingPlanetControllerId.value = null;
    message.warning('planet 文件大小不能超过 1MB');
    return;
  }

  uploadingPlanetId.value = controllerId;
  try {
    await uploadControllerPlanet(controllerId, file);
    message.success('planet 文件上传成功');
    await loadControllers();
  } catch (error) {
    message.error(error instanceof Error ? error.message : '上传 planet 文件失败');
  } finally {
    uploadingPlanetId.value = null;
    pendingPlanetControllerId.value = null;
  }
}

async function handleDownloadPlanet(id: number) {
  downloadingPlanetId.value = id;
  try {
    const blob = await downloadControllerPlanet(id);
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = 'planet';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => {
      window.URL.revokeObjectURL(downloadUrl);
    }, 0);
  } catch (error) {
    message.error(error instanceof Error ? error.message : '下载 planet 文件失败');
  } finally {
    downloadingPlanetId.value = null;
  }
}

function handleDeletePlanet(id: number) {
  Modal.confirm({
    content: '确认删除当前控制器的 planet 文件吗？',
    okText: '删除',
    okType: 'danger',
    onOk: async () => {
      deletingPlanetId.value = id;
      try {
        await deleteControllerPlanet(id);
        message.success('planet 文件已删除');
        await loadControllers();
      } catch (error) {
        message.error(error instanceof Error ? error.message : '删除 planet 文件失败');
      } finally {
        deletingPlanetId.value = null;
      }
    },
    title: '删除 planet 文件',
  });
}

async function loadControllers() {
  loading.value = true;
  try {
    const result = await getControllers();
    controllers.value = result.items;
  } catch (error) {
    message.error(error instanceof Error ? error.message : '加载控制器列表失败');
  } finally {
    loading.value = false;
  }
}

async function handleSave() {
  saving.value = true;
  try {
    if (editingId.value) {
      await updateController(editingId.value, form);
      message.success('控制器更新成功');
    } else {
      await createController(form);
      message.success('控制器创建成功');
    }
    modalOpen.value = false;
    await loadControllers();
  } catch (error) {
    message.error(error instanceof Error ? error.message : '保存控制器失败');
  } finally {
    saving.value = false;
  }
}

async function handleTest(id: number) {
  try {
    const result = await testController(id);
    message.success(
      `连接成功。控制器地址：${result.controllerAddress || '-'}，版本：${result.version || '-'}`,
    );
    await loadControllers();
  } catch (error) {
    message.error(error instanceof Error ? error.message : '连接测试失败');
    await loadControllers();
  }
}

function handleDelete(id: number) {
  Modal.confirm({
    content: '确认删除这个控制器配置吗？',
    okText: '删除',
    okType: 'danger',
    onOk: async () => {
      try {
        await deleteController(id);
        message.success('控制器已删除');
        await loadControllers();
      } catch (error) {
        message.error(error instanceof Error ? error.message : '删除控制器失败');
      }
    },
    title: '删除控制器',
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

.planet-cell {
  min-width: 220px;
}

.planet-meta {
  margin-top: 6px;
  color: #64748b;
  font-size: 12px;
  line-height: 1.5;
}

.hidden-file-input {
  display: none;
}
</style>
