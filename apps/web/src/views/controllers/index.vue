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
        <a-space class="toolbar-actions" wrap>
          <template v-if="authStore.isAdmin">
            <a-button :loading="exporting" @click="openExportModal">
              <template #icon><ExportOutlined /></template>
              导出控制器
            </a-button>
            <a-button :loading="importing" @click="openImportPicker">
              <template #icon><ImportOutlined /></template>
              导入控制器
            </a-button>
          </template>
          <a-button type="primary" @click="openCreateModal">新增控制器</a-button>
        </a-space>
      </div>

      <a-table
        :columns="columns"
        :data-source="controllers"
        :loading="loading"
        row-key="id"
        :scroll="{ x: 1120 }"
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
                      <a-menu-item key="link" :disabled="!record.hasPlanetFile">
                        获取下载链接
                      </a-menu-item>
                      <a-menu-item
                        key="rotate-link"
                        :disabled="!record.hasPlanetDownloadLink"
                      >
                        重新生成下载链接
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
    <input
      ref="controllerImportInput"
      accept=".json,application/json"
      aria-label="选择控制器导入文件"
      class="hidden-file-input"
      type="file"
      @change="handleControllerImportSelected"
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

    <a-modal
      v-model:open="exportModalOpen"
      :confirm-loading="exporting"
      ok-text="导出"
      title="导出控制器"
      @cancel="resetExportModal"
      @ok="handleExport"
    >
      <a-alert
        description="迁移密码不会写入导出包；导入时必须输入相同密码。"
        message="导出包包含控制器凭据与 planet 文件"
        show-icon
        type="warning"
      />
      <a-form layout="vertical">
        <a-form-item label="迁移密码">
          <a-input-password
            v-model:value="exportForm.migrationPassword"
            autocomplete="new-password"
          />
        </a-form-item>
        <a-form-item label="确认迁移密码">
          <a-input-password
            v-model:value="exportForm.confirmMigrationPassword"
            autocomplete="new-password"
          />
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal
      v-model:open="importModalOpen"
      :confirm-loading="importing"
      :ok-button-props="{ disabled: !importFile }"
      ok-text="导入"
      title="导入控制器"
      @cancel="resetImportModal"
      @ok="handleImport"
    >
      <a-alert
        description="导入会新增文件中的全部控制器；存在同名控制器时会取消整次导入。"
        message="请确认导入来源可信"
        show-icon
        type="warning"
      />
      <a-form layout="vertical">
        <a-form-item label="配置文件">
          <div class="import-file-selection">
            <span class="import-file-name">{{ importFile?.name || '未选择文件' }}</span>
            <a-button size="small" @click="openImportPicker">重新选择</a-button>
          </div>
        </a-form-item>
        <a-form-item label="迁移密码">
          <a-input-password
            v-model:value="importMigrationPassword"
            autocomplete="current-password"
          />
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal v-model:open="planetLinkModalOpen" :footer="null" title="planet 下载链接">
      <a-alert
        description="该链接无需登录。更新 planet 文件后链接保持不变，请仅在受信任的局域网内使用。"
        message="局域网公开下载地址"
        show-icon
        type="warning"
      />
      <div class="planet-link-field">
        <label class="planet-link-label" for="planet-download-url">下载地址</label>
        <a-input
          id="planet-download-url"
          :value="planetDownloadUrl"
          readonly
          @focus="selectPlanetLink"
        />
      </div>
      <div class="planet-link-actions">
        <a-button @click="handleCopyPlanetLink">
          <template #icon><CopyOutlined /></template>
          复制链接
        </a-button>
        <a-button type="primary" @click="handleOpenPlanetLink">
          <template #icon><LinkOutlined /></template>
          打开链接
        </a-button>
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import {
  CopyOutlined,
  DownOutlined,
  ExportOutlined,
  ImportOutlined,
  LinkOutlined,
} from '@ant-design/icons-vue';
import { Modal, message } from 'ant-design-vue';
import { onMounted, reactive, ref } from 'vue';
import {
  createController,
  deleteControllerPlanet,
  deleteController,
  downloadControllerPlanet,
  exportControllerConfiguration,
  getControllers,
  getOrCreateControllerPlanetLink,
  importControllerConfiguration,
  rotateControllerPlanetLink,
  testController,
  uploadControllerPlanet,
  updateController,
} from '../../api/controllers';
import { useAuthStore } from '../../stores/auth';
import type { ControllerFormPayload, ControllerItem } from '../../types/controller';

const MAX_PLANET_FILE_SIZE_BYTES = 1024 * 1024;
const MAX_CONTROLLER_IMPORT_FILE_SIZE_BYTES = 50 * 1024 * 1024;
const MIN_MIGRATION_PASSWORD_LENGTH = 12;

const authStore = useAuthStore();
const loading = ref(false);
const saving = ref(false);
const exporting = ref(false);
const importing = ref(false);
const modalOpen = ref(false);
const exportModalOpen = ref(false);
const importModalOpen = ref(false);
const planetLinkModalOpen = ref(false);
const editingId = ref<number | null>(null);
const controllers = ref<ControllerItem[]>([]);
const planetInput = ref<HTMLInputElement | null>(null);
const controllerImportInput = ref<HTMLInputElement | null>(null);
const importFile = ref<File | null>(null);
const importMigrationPassword = ref('');
const pendingPlanetControllerId = ref<number | null>(null);
const uploadingPlanetId = ref<number | null>(null);
const downloadingPlanetId = ref<number | null>(null);
const deletingPlanetId = ref<number | null>(null);
const planetLinkLoadingId = ref<number | null>(null);
const planetDownloadUrl = ref('');
const form = reactive<ControllerFormPayload>({
  baseUrl: '',
  name: '',
  password: '',
  region: '',
  subnetPoolCidr: '10.10.0.0/16',
  subnetPrefix: 24,
  username: 'admin',
});
const exportForm = reactive({
  confirmMigrationPassword: '',
  migrationPassword: '',
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

function openExportModal() {
  exportForm.confirmMigrationPassword = '';
  exportForm.migrationPassword = '';
  exportModalOpen.value = true;
}

function resetExportModal() {
  if (exporting.value) {
    return;
  }

  exportForm.confirmMigrationPassword = '';
  exportForm.migrationPassword = '';
  exportModalOpen.value = false;
}

function openImportPicker() {
  if (controllerImportInput.value) {
    controllerImportInput.value.value = '';
    controllerImportInput.value.click();
  }
}

function resetImportModal() {
  if (importing.value) {
    return;
  }

  importFile.value = null;
  importMigrationPassword.value = '';
  importModalOpen.value = false;
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

function downloadBlob(blob: Blob, filename: string) {
  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => {
    window.URL.revokeObjectURL(downloadUrl);
  }, 0);
}

function buildControllerExportFilename() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `zt-mgmt-controllers-${timestamp}.json`;
}

function handleControllerImportSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';

  if (!file) {
    return;
  }

  const isJsonFile = file.type === 'application/json' || file.name.toLowerCase().endsWith('.json');
  if (!isJsonFile) {
    message.warning('请选择控制器导出生成的 JSON 文件');
    return;
  }

  if (file.size === 0) {
    message.warning('控制器导入文件不能为空');
    return;
  }

  if (file.size > MAX_CONTROLLER_IMPORT_FILE_SIZE_BYTES) {
    message.warning('控制器导入文件不能超过 50MB');
    return;
  }

  importFile.value = file;
  importMigrationPassword.value = '';
  importModalOpen.value = true;
}

async function handleExport() {
  if (exportForm.migrationPassword.length < MIN_MIGRATION_PASSWORD_LENGTH) {
    message.warning('迁移密码至少需要 12 个字符');
    return;
  }

  if (exportForm.migrationPassword !== exportForm.confirmMigrationPassword) {
    message.warning('两次输入的迁移密码不一致');
    return;
  }

  exporting.value = true;
  try {
    const blob = await exportControllerConfiguration(exportForm.migrationPassword);
    downloadBlob(blob, buildControllerExportFilename());
    message.success('控制器配置已导出');
    exportForm.confirmMigrationPassword = '';
    exportForm.migrationPassword = '';
    exportModalOpen.value = false;
  } catch (error) {
    message.error(error instanceof Error ? error.message : '导出控制器失败');
  } finally {
    exporting.value = false;
  }
}

async function handleImport() {
  if (!importFile.value) {
    message.warning('请选择控制器导入文件');
    return;
  }

  if (importMigrationPassword.value.length < MIN_MIGRATION_PASSWORD_LENGTH) {
    message.warning('迁移密码至少需要 12 个字符');
    return;
  }

  importing.value = true;
  try {
    const result = await importControllerConfiguration(
      importFile.value,
      importMigrationPassword.value,
    );
    message.success(
      result.imported ? `已导入 ${result.imported} 个控制器` : '导入包中没有控制器',
    );
    importFile.value = null;
    importMigrationPassword.value = '';
    importModalOpen.value = false;
    await loadControllers();
  } catch (error) {
    message.error(error instanceof Error ? error.message : '导入控制器失败');
  } finally {
    importing.value = false;
  }
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
    deletingPlanetId.value === id ||
    planetLinkLoadingId.value === id
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

  if (key === 'link') {
    void handleGetPlanetLink(id);
    return;
  }

  if (key === 'rotate-link') {
    handleRotatePlanetLink(id);
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
    downloadBlob(blob, 'planet');
  } catch (error) {
    message.error(error instanceof Error ? error.message : '下载 planet 文件失败');
  } finally {
    downloadingPlanetId.value = null;
  }
}

async function handleGetPlanetLink(id: number) {
  planetLinkLoadingId.value = id;
  try {
    const result = await getOrCreateControllerPlanetLink(id);
    planetDownloadUrl.value = result.downloadUrl;
    planetLinkModalOpen.value = true;

    const controller = controllers.value.find((item) => item.id === id);
    if (controller) {
      controller.hasPlanetDownloadLink = true;
    }
  } catch (error) {
    message.error(error instanceof Error ? error.message : '获取 planet 下载链接失败');
  } finally {
    planetLinkLoadingId.value = null;
  }
}

function handleRotatePlanetLink(id: number) {
  Modal.confirm({
    content: '重新生成后，当前下载链接会立即失效。确认继续吗？',
    okText: '重新生成',
    okType: 'danger',
    onOk: async () => {
      planetLinkLoadingId.value = id;
      try {
        const result = await rotateControllerPlanetLink(id);
        planetDownloadUrl.value = result.downloadUrl;
        planetLinkModalOpen.value = true;
        message.success('planet 下载链接已重新生成');
      } catch (error) {
        message.error(error instanceof Error ? error.message : '重新生成 planet 下载链接失败');
      } finally {
        planetLinkLoadingId.value = null;
      }
    },
    title: '重新生成下载链接',
  });
}

function fallbackCopyText(value: string) {
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.left = '-9999px';
  textarea.style.position = 'fixed';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();

  if (!copied) {
    throw new Error('浏览器未允许复制');
  }
}

async function handleCopyPlanetLink() {
  if (!planetDownloadUrl.value) {
    return;
  }

  try {
    if (window.isSecureContext && navigator.clipboard) {
      await navigator.clipboard.writeText(planetDownloadUrl.value);
    } else {
      fallbackCopyText(planetDownloadUrl.value);
    }
    message.success('下载链接已复制');
  } catch (error) {
    message.error(error instanceof Error ? error.message : '复制下载链接失败');
  }
}

function handleOpenPlanetLink() {
  if (planetDownloadUrl.value) {
    window.open(planetDownloadUrl.value, '_blank', 'noopener,noreferrer');
  }
}

function selectPlanetLink(event: FocusEvent) {
  const input = event.target;
  if (input instanceof HTMLInputElement) {
    input.select();
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

.toolbar-actions {
  flex-shrink: 0;
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

.import-file-selection {
  align-items: center;
  display: flex;
  gap: 8px;
  min-height: 32px;
}

.import-file-name {
  min-width: 0;
  overflow-wrap: anywhere;
}

.planet-link-field {
  margin-top: 16px;
}

.planet-link-label {
  display: block;
  font-weight: 500;
  margin-bottom: 8px;
}

.planet-link-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 16px;
}

@media (max-width: 640px) {
  .toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .toolbar-actions {
    width: 100%;
  }

  .planet-link-actions {
    flex-direction: column;
  }

  .planet-link-actions :deep(.ant-btn) {
    width: 100%;
  }
}
</style>
