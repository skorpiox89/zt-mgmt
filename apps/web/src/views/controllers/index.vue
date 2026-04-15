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

          <template v-else-if="column.key === 'actions'">
            <a-space>
              <a-button size="small" @click="openEditModal(record)">编辑</a-button>
              <a-button size="small" @click="handleTest(record.id)">测试连接</a-button>
              <a-button danger size="small" @click="handleDelete(record.id)">删除</a-button>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

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
  { dataIndex: 'name', key: 'name', title: '名称' },
  { dataIndex: 'region', key: 'region', title: '区域' },
  { dataIndex: 'baseUrl', key: 'baseUrl', title: '控制器地址' },
  { dataIndex: 'subnetPoolCidr', key: 'subnetPoolCidr', title: '子网池' },
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
</style>
