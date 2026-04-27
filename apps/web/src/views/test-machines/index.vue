<template>
  <div class="page-shell">
    <a-card class="page-card" :bordered="false">
      <div class="toolbar">
        <div>
          <h1 class="page-title">网络测试</h1>
          <p class="page-subtitle">
            管理测试机的 SSH 信息，并将测试机切换到指定控制器下的单个测试网络。
          </p>
        </div>
        <a-space>
          <a-button @click="loadData">刷新</a-button>
          <a-button v-if="authStore.isAdmin" type="primary" @click="openCreateModal">
            新增测试机
          </a-button>
        </a-space>
      </div>

      <a-table
        :columns="columns"
        :data-source="machines"
        :loading="loading"
        row-key="id"
        size="middle"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'status'">
            <a-space direction="vertical" :size="4">
              <a-tag :color="machineStatusColor(record.status)">
                {{ machineStatusText(record.status) }}
              </a-tag>
              <a-tag :color="record.enabled ? 'green' : 'default'">
                {{ record.enabled ? '已启用' : '已禁用' }}
              </a-tag>
            </a-space>
          </template>

          <template v-else-if="column.key === 'zerotierServiceStatus'">
            <a-space direction="vertical" :size="4">
              <a-tag :color="zerotierStatusColor(record.zerotierServiceStatus)">
                {{ zerotierStatusText(record.zerotierServiceStatus) }}
              </a-tag>
              <span class="cell-subtext">{{ formatDate(record.lastZeroTierCheckedAt) }}</span>
            </a-space>
          </template>

          <template v-else-if="column.key === 'currentNetwork'">
            <div v-if="record.currentNetworkMasked">
              <a-tag color="default">已屏蔽</a-tag>
            </div>
            <div v-else-if="record.currentNetworkId">
              <div>{{ record.currentControllerName || '-' }} / {{ record.currentNetworkName || '-' }}</div>
              <div class="cell-subtext">{{ record.currentNetworkId }}</div>
            </div>
            <span v-else>-</span>
          </template>

          <template v-else-if="column.key === 'switchStatus'">
            <a-space direction="vertical" :size="4">
              <a-tag :color="switchStatusColor(record.switchStatus)">
                {{ switchStatusText(record.switchStatus) }}
              </a-tag>
              <span class="cell-subtext">{{ record.lastSwitchMessage || '-' }}</span>
            </a-space>
          </template>

          <template v-else-if="column.key === 'lastCheckedAt'">
            {{ formatDate(record.lastCheckedAt) }}
          </template>

          <template v-else-if="column.key === 'lastSwitchAt'">
            {{ formatDate(record.lastSwitchAt) }}
          </template>

          <template v-else-if="column.key === 'remark'">
            {{ record.remark || '-' }}
          </template>

          <template v-else-if="column.key === 'actions'">
            <a-space wrap>
              <a-button
                size="small"
                type="primary"
                :disabled="!record.enabled || record.switchStatus === 'running'"
                :loading="switchingId === record.id"
                @click="openSwitchModal(record)"
              >
                切换网络
              </a-button>
              <template v-if="authStore.isAdmin">
                <a-button size="small" @click="openEditModal(record)">编辑</a-button>
                <a-button
                  size="small"
                  :loading="sshTestingId === record.id"
                  @click="handleTestSsh(record)"
                >
                  测试 SSH
                </a-button>
                <a-dropdown :trigger="['click']">
                  <a-button
                    size="small"
                    :disabled="record.switchStatus === 'running'"
                    :loading="isZeroTierActionLoading(record.id)"
                  >
                    ZeroTier
                    <DownOutlined />
                  </a-button>
                  <template #overlay>
                    <a-menu @click="handleZeroTierMenuClick(record, $event)">
                      <a-menu-item key="check">检查</a-menu-item>
                      <a-menu-item
                        key="start"
                        :disabled="record.zerotierServiceStatus !== 'stopped'"
                      >
                        开启
                      </a-menu-item>
                      <a-menu-item
                        key="stop"
                        :disabled="record.zerotierServiceStatus !== 'running'"
                      >
                        关闭
                      </a-menu-item>
                    </a-menu>
                  </template>
                </a-dropdown>
                <a-button size="small" @click="openLogsModal(record)">查看日志</a-button>
                <a-button danger size="small" @click="handleDelete(record.id)">删除</a-button>
              </template>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-modal
      v-model:open="machineModalOpen"
      :confirm-loading="saving"
      :title="editingId ? '编辑测试机' : '新增测试机'"
      @ok="handleSaveMachine"
    >
      <a-form layout="vertical">
        <a-form-item label="名称">
          <a-input v-model:value="machineForm.name" />
        </a-form-item>
        <a-form-item label="IP / 主机名">
          <a-input v-model:value="machineForm.host" />
        </a-form-item>
        <a-form-item label="SSH 端口">
          <a-input-number v-model:value="machineForm.port" :min="1" :max="65535" style="width: 100%" />
        </a-form-item>
        <a-form-item label="SSH 用户">
          <a-input v-model:value="machineForm.username" />
        </a-form-item>
        <a-form-item :label="editingId ? 'SSH 密码（留空则不更新）' : 'SSH 密码'">
          <a-input-password v-model:value="machineForm.password" />
        </a-form-item>
        <a-form-item label="备注">
          <a-textarea v-model:value="machineForm.remark" :rows="3" />
        </a-form-item>
        <a-form-item label="启用状态">
          <a-switch v-model:checked="machineForm.enabled" checked-children="启用" un-checked-children="禁用" />
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal
      v-model:open="switchOpen"
      :confirm-loading="switchingId !== null"
      :title="`切换网络${switchTarget ? ` · ${switchTarget.name}` : ''}`"
      @ok="handleSwitchNetwork"
    >
      <a-space direction="vertical" style="width: 100%" :size="16">
        <div class="modal-copy">
          当前网络：
          <template v-if="switchTarget?.currentNetworkMasked">已屏蔽</template>
          <template v-else-if="switchTarget?.currentNetworkId">
            {{ switchTarget.currentControllerName || '-' }} / {{ switchTarget.currentNetworkName || '-' }}
            （{{ switchTarget.currentNetworkId }}）
          </template>
          <template v-else>-</template>
        </div>

        <a-form layout="vertical">
          <a-form-item label="控制器">
            <a-select
              v-model:value="switchForm.controllerId"
              :options="switchControllerOptions"
              placeholder="请选择控制器"
              @change="handleSwitchControllerChange"
            />
          </a-form-item>
          <a-form-item label="目标网络">
            <a-select
              v-model:value="switchForm.networkId"
              :disabled="!switchForm.controllerId"
              :options="switchNetworkOptions"
              placeholder="请选择网络"
              show-search
              :filter-option="filterSelectOption"
            />
          </a-form-item>
        </a-form>

        <div class="modal-copy">
          <div>
            Planet 文件：
            <a-tag :color="selectedController?.hasPlanetFile ? 'cyan' : 'default'">
              {{ selectedController?.hasPlanetFile ? '已上传' : '未上传' }}
            </a-tag>
          </div>
          <div v-if="!selectedController?.hasPlanetFile">
            目标控制器未上传 planet 文件时，无法完成切换。
          </div>
        </div>
      </a-space>
    </a-modal>

    <a-modal
      v-model:open="logsOpen"
      :footer="null"
      :title="`切换日志${logsTarget ? ` · ${logsTarget.name}` : ''}`"
      width="1080px"
    >
      <a-space direction="vertical" style="width: 100%" :size="16">
        <a-table
          :columns="logColumns"
          :data-source="logs"
          :loading="logsLoading"
          :pagination="{ pageSize: 6 }"
          row-key="id"
          size="small"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'status'">
              <a-tag :color="switchStatusColor(record.status)">
                {{ switchStatusText(record.status) }}
              </a-tag>
            </template>
            <template v-else-if="column.key === 'target'">
              <div>{{ record.targetControllerName || '-' }} / {{ record.targetNetworkName || '-' }}</div>
              <div class="cell-subtext">{{ record.targetNetworkId }}</div>
            </template>
            <template v-else-if="column.key === 'startedAt'">
              {{ formatDate(record.startedAt) }}
            </template>
            <template v-else-if="column.key === 'finishedAt'">
              {{ formatDate(record.finishedAt) }}
            </template>
            <template v-else-if="column.key === 'actions'">
              <a-button size="small" @click="selectedLog = record">查看详情</a-button>
            </template>
          </template>
        </a-table>

        <div v-if="selectedLog" class="log-detail">
          <div class="log-detail-title">
            详情 · {{ selectedLog.targetControllerName || '-' }} / {{ selectedLog.targetNetworkName || '-' }}
          </div>
          <pre>{{ selectedLog.detailLog || selectedLog.summary || '-' }}</pre>
        </div>
      </a-space>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { DownOutlined } from '@ant-design/icons-vue';
import { Modal, message } from 'ant-design-vue';
import { computed, onMounted, reactive, ref } from 'vue';
import { getControllers } from '../../api/controllers';
import { getNetworks } from '../../api/networks';
import {
  checkTestMachineZeroTier,
  createTestMachine,
  deleteTestMachine,
  getTestMachineLogs,
  getTestMachines,
  startTestMachineZeroTier,
  stopTestMachineZeroTier,
  switchTestMachineNetwork,
  testTestMachineSsh,
  updateTestMachine,
} from '../../api/test-machines';
import { useAuthStore } from '../../stores/auth';
import { useNetworkVisibilityStore } from '../../stores/network-visibility';
import type { ControllerItem } from '../../types/controller';
import type { NetworkItem } from '../../types/network';
import type {
  TestMachineFormPayload,
  TestMachineItem,
  TestMachineSwitchLogItem,
} from '../../types/test-machine';

const authStore = useAuthStore();
const visibilityStore = useNetworkVisibilityStore();
const loading = ref(false);
const saving = ref(false);
const logsLoading = ref(false);
const machineModalOpen = ref(false);
const switchOpen = ref(false);
const logsOpen = ref(false);
const editingId = ref<number | null>(null);
const switchingId = ref<number | null>(null);
const sshTestingId = ref<number | null>(null);
const zerotierCheckingId = ref<number | null>(null);
const zerotierActionId = ref<number | null>(null);
const zerotierActionType = ref<'start' | 'stop' | null>(null);
const machines = ref<TestMachineItem[]>([]);
const controllers = ref<ControllerItem[]>([]);
const switchNetworks = ref<NetworkItem[]>([]);
const logs = ref<TestMachineSwitchLogItem[]>([]);
const switchTarget = ref<TestMachineItem | null>(null);
const logsTarget = ref<TestMachineItem | null>(null);
const selectedLog = ref<TestMachineSwitchLogItem | null>(null);

const machineForm = reactive({
  enabled: true,
  host: '',
  name: '',
  password: '',
  port: 22,
  remark: '',
  username: 'root',
});

const switchForm = reactive({
  controllerId: undefined as number | undefined,
  networkId: undefined as string | undefined,
});

const columns = computed(() => {
  const baseColumns = [
    { dataIndex: 'name', key: 'name', title: '测试机' },
    { dataIndex: 'host', key: 'host', title: '管理地址' },
    { key: 'currentNetwork', title: '当前测试网络' },
    { key: 'status', title: '主机状态' },
    { key: 'zerotierServiceStatus', title: 'ZeroTier 服务' },
    { key: 'switchStatus', title: '最近切换结果' },
    { dataIndex: 'lastCheckedAt', key: 'lastCheckedAt', title: '最近 SSH 检测' },
    { dataIndex: 'lastSwitchAt', key: 'lastSwitchAt', title: '最近切换时间' },
    { dataIndex: 'remark', key: 'remark', title: '备注' },
    { key: 'actions', title: '操作' },
  ];

  if (authStore.isAdmin) {
    return baseColumns;
  }

  return baseColumns.filter((column) => column.key !== 'lastCheckedAt');
});

const logColumns = [
  { dataIndex: 'status', key: 'status', title: '结果' },
  { dataIndex: 'operatorUsername', key: 'operatorUsername', title: '操作人' },
  { key: 'target', title: '目标网络' },
  { dataIndex: 'startedAt', key: 'startedAt', title: '开始时间' },
  { dataIndex: 'finishedAt', key: 'finishedAt', title: '结束时间' },
  { dataIndex: 'summary', key: 'summary', title: '摘要' },
  { key: 'actions', title: '操作' },
];

const switchControllerOptions = computed(() =>
  controllers.value.map((controller) => ({
    disabled: !controller.hasPlanetFile,
    label: `${controller.name} (${controller.region})${controller.hasPlanetFile ? '' : ' · 未上传 planet'}`,
    value: controller.id,
  })),
);

const switchNetworkOptions = computed(() =>
  switchNetworks.value.map((network) => ({
    label: `${network.networkName} (${network.networkId})`,
    value: network.networkId,
  })),
);

const selectedController = computed(() =>
  controllers.value.find((controller) => controller.id === switchForm.controllerId) ?? null,
);

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : '-';
}

function machineStatusColor(status: TestMachineItem['status']) {
  if (status === 'online') {
    return 'green';
  }
  if (status === 'offline') {
    return 'red';
  }
  return 'default';
}

function machineStatusText(status: TestMachineItem['status']) {
  if (status === 'online') {
    return '在线';
  }
  if (status === 'offline') {
    return '离线';
  }
  return '未知';
}

function zerotierStatusColor(status: TestMachineItem['zerotierServiceStatus']) {
  if (status === 'running') {
    return 'green';
  }
  if (status === 'stopped') {
    return 'orange';
  }
  if (status === 'not_installed') {
    return 'red';
  }
  return 'default';
}

function zerotierStatusText(status: TestMachineItem['zerotierServiceStatus']) {
  if (status === 'running') {
    return '运行中';
  }
  if (status === 'stopped') {
    return '已停止';
  }
  if (status === 'not_installed') {
    return '未安装';
  }
  return '未知';
}

function isZeroTierActionLoading(id: number) {
  return zerotierCheckingId.value === id || zerotierActionId.value === id;
}

function switchStatusColor(status: TestMachineItem['switchStatus']) {
  if (status === 'success') {
    return 'green';
  }
  if (status === 'failed') {
    return 'red';
  }
  if (status === 'running') {
    return 'processing';
  }
  return 'default';
}

function switchStatusText(status: TestMachineItem['switchStatus']) {
  if (status === 'success') {
    return '成功';
  }
  if (status === 'failed') {
    return '失败';
  }
  if (status === 'running') {
    return '进行中';
  }
  return '空闲';
}

function filterSelectOption(input: string, option: { label?: string | number; value?: string | number }) {
  return String(option.label || '')
    .toLowerCase()
    .includes(input.toLowerCase());
}

function resetMachineForm() {
  machineForm.enabled = true;
  machineForm.host = '';
  machineForm.name = '';
  machineForm.password = '';
  machineForm.port = 22;
  machineForm.remark = '';
  machineForm.username = 'root';
}

async function loadData() {
  loading.value = true;
  try {
    await visibilityStore.ensureLoaded(true);
    const [controllersResult, machinesResult] = await Promise.all([
      getControllers(),
      getTestMachines(),
    ]);
    controllers.value = controllersResult.items;
    machines.value = machinesResult.items;
  } catch (error) {
    message.error(error instanceof Error ? error.message : '加载测试机列表失败');
  } finally {
    loading.value = false;
  }
}

function openCreateModal() {
  editingId.value = null;
  resetMachineForm();
  machineModalOpen.value = true;
}

function openEditModal(record: TestMachineItem) {
  editingId.value = record.id;
  machineForm.enabled = record.enabled;
  machineForm.host = record.host;
  machineForm.name = record.name;
  machineForm.password = '';
  machineForm.port = record.port;
  machineForm.remark = record.remark || '';
  machineForm.username = record.username || 'root';
  machineModalOpen.value = true;
}

async function handleSaveMachine() {
  if (!machineForm.name || !machineForm.host || !machineForm.username) {
    message.warning('请填写完整的测试机信息');
    return;
  }

  if (!editingId.value && !machineForm.password) {
    message.warning('请填写 SSH 密码');
    return;
  }

  const payload: TestMachineFormPayload = {
    enabled: machineForm.enabled,
    host: machineForm.host,
    name: machineForm.name,
    port: machineForm.port,
    remark: machineForm.remark || undefined,
    username: machineForm.username,
  };

  if (machineForm.password) {
    payload.password = machineForm.password;
  }

  saving.value = true;
  try {
    if (editingId.value) {
      await updateTestMachine(editingId.value, payload);
      message.success('测试机已更新');
    } else {
      await createTestMachine(payload);
      message.success('测试机已创建');
    }

    machineModalOpen.value = false;
    resetMachineForm();
    await loadData();
  } catch (error) {
    message.error(error instanceof Error ? error.message : '保存测试机失败');
  } finally {
    saving.value = false;
  }
}

async function handleLoadSwitchNetworks(controllerId: number | undefined) {
  switchNetworks.value = [];
  switchForm.networkId = undefined;

  if (!controllerId) {
    return;
  }

  try {
    const result = await getNetworks({
      controllerId,
    });
    switchNetworks.value = visibilityStore.filterNetworks(result.items);
    switchForm.networkId = switchNetworks.value[0]?.networkId;
  } catch (error) {
    message.error(error instanceof Error ? error.message : '加载目标网络失败');
  }
}

async function openSwitchModal(record: TestMachineItem) {
  switchTarget.value = record;
  switchOpen.value = true;

  const currentControllerId =
    record.currentControllerId && controllers.value.some((item) => item.id === record.currentControllerId)
      ? record.currentControllerId
      : controllers.value.find((item) => item.hasPlanetFile)?.id;

  switchForm.controllerId = currentControllerId;
  await handleLoadSwitchNetworks(currentControllerId);

  if (
    !record.currentNetworkMasked &&
    record.currentControllerId === switchForm.controllerId &&
    record.currentNetworkId &&
    switchNetworks.value.some((item) => item.networkId === record.currentNetworkId)
  ) {
    switchForm.networkId = record.currentNetworkId;
  }
}

async function handleSwitchControllerChange(value: number) {
  await handleLoadSwitchNetworks(value);
}

async function handleSwitchNetwork() {
  if (!switchTarget.value || !switchForm.controllerId || !switchForm.networkId) {
    message.warning('请选择目标控制器和网络');
    return;
  }

  if (!selectedController.value?.hasPlanetFile) {
    message.warning('目标控制器未上传 planet 文件');
    return;
  }

  switchingId.value = switchTarget.value.id;
  try {
    const result = await switchTestMachineNetwork(switchTarget.value.id, {
      controllerId: switchForm.controllerId,
      networkId: switchForm.networkId,
    });
    message.success(result.message || `切换成功：${result.networkName}`);
    switchOpen.value = false;
    switchTarget.value = null;
    await loadData();
  } catch (error) {
    message.error(error instanceof Error ? error.message : '切换网络失败');
  } finally {
    switchingId.value = null;
  }
}

async function handleTestSsh(record: TestMachineItem) {
  sshTestingId.value = record.id;
  try {
    await testTestMachineSsh(record.id);
    message.success(`SSH 登录成功：${record.name}`);
    await loadData();
  } catch (error) {
    message.error(error instanceof Error ? error.message : 'SSH 检测失败');
  } finally {
    sshTestingId.value = null;
  }
}

async function handleCheckZeroTier(record: TestMachineItem) {
  zerotierCheckingId.value = record.id;
  try {
    const result = await checkTestMachineZeroTier(record.id);
    message.success(`ZeroTier 状态：${zerotierStatusText(result.serviceStatus)}`);
    await loadData();
  } catch (error) {
    message.error(error instanceof Error ? error.message : 'ZeroTier 状态检查失败');
  } finally {
    zerotierCheckingId.value = null;
  }
}

async function handleToggleZeroTier(record: TestMachineItem, action: 'start' | 'stop') {
  zerotierActionId.value = record.id;
  zerotierActionType.value = action;
  try {
    const result =
      action === 'start'
        ? await startTestMachineZeroTier(record.id)
        : await stopTestMachineZeroTier(record.id);
    message.success(`ZeroTier 状态：${zerotierStatusText(result.serviceStatus)}`);
    await loadData();
  } catch (error) {
    message.error(
      error instanceof Error
        ? error.message
        : `ZeroTier ${action === 'start' ? '开启' : '关闭'}失败`,
    );
  } finally {
    zerotierActionId.value = null;
    zerotierActionType.value = null;
  }
}

function handleZeroTierMenuClick(
  record: TestMachineItem,
  event: { key: 'check' | 'start' | 'stop' | string },
) {
  if (event.key === 'check') {
    void handleCheckZeroTier(record);
    return;
  }

  if (event.key === 'start' || event.key === 'stop') {
    void handleToggleZeroTier(record, event.key);
  }
}

function handleDelete(id: number) {
  Modal.confirm({
    content: '确认删除这个测试机吗？相关切换日志也会一并删除。',
    okText: '删除',
    okType: 'danger',
    onOk: async () => {
      try {
        await deleteTestMachine(id);
        message.success('测试机已删除');
        await loadData();
      } catch (error) {
        message.error(error instanceof Error ? error.message : '删除测试机失败');
      }
    },
    title: '删除测试机',
  });
}

async function openLogsModal(record: TestMachineItem) {
  logsTarget.value = record;
  logsOpen.value = true;
  selectedLog.value = null;
  logsLoading.value = true;

  try {
    const result = await getTestMachineLogs(record.id, 20);
    logs.value = result.items;
    selectedLog.value = result.items[0] ?? null;
  } catch (error) {
    message.error(error instanceof Error ? error.message : '加载切换日志失败');
  } finally {
    logsLoading.value = false;
  }
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

.cell-subtext {
  color: #64748b;
  font-size: 12px;
  line-height: 1.6;
}

.modal-copy {
  color: #475569;
  font-size: 13px;
  line-height: 1.7;
}

.log-detail {
  padding: 16px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
}

.log-detail-title {
  margin-bottom: 12px;
  color: #0f172a;
  font-size: 14px;
  font-weight: 600;
}

.log-detail pre {
  margin: 0;
  color: #1e293b;
  font-family: 'SFMono-Regular', 'Consolas', 'Liberation Mono', monospace;
  font-size: 12px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
