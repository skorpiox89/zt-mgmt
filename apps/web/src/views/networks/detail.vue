<template>
  <div class="page-shell">
    <a-card class="page-card" :bordered="false">
      <a-space direction="vertical" style="width: 100%" :size="20">
        <div class="detail-head">
          <div>
            <h1 class="page-title">{{ detail?.networkName || '网络详情' }}</h1>
            <p class="page-subtitle">
              控制器 {{ detail?.controllerName || '-' }} · 网络 ID {{ detail?.networkId || '-' }}
            </p>
          </div>
          <a-space>
            <a-button @click="loadData">刷新</a-button>
            <a-button @click="router.push('/networks')">返回</a-button>
          </a-space>
        </div>

        <a-descriptions bordered :column="2" size="middle">
          <a-descriptions-item label="控制器">{{ detail?.controllerName || '-' }}</a-descriptions-item>
          <a-descriptions-item label="私有网络">{{ formatBoolean(detail?.private) }}</a-descriptions-item>
          <a-descriptions-item label="路由">
            <div v-if="detail?.routes.length">
              <div v-for="route in detail.routes" :key="route.target">
                {{ route.target }}<span v-if="route.via"> 经由 {{ route.via }}</span>
              </div>
            </div>
            <span v-else>-</span>
          </a-descriptions-item>
          <a-descriptions-item label="IP 分配池">
            <div v-if="detail?.ipAssignmentPools.length">
              <div
                v-for="pool in detail.ipAssignmentPools"
                :key="`${pool.ipRangeStart}-${pool.ipRangeEnd}`"
              >
                {{ pool.ipRangeStart }} - {{ pool.ipRangeEnd }}
              </div>
            </div>
            <span v-else>-</span>
          </a-descriptions-item>
        </a-descriptions>

        <div>
          <h2 class="section-title">成员列表</h2>
          <a-table :columns="columns" :data-source="members" :loading="loading" row-key="memberId">
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'authorized'">
                <a-switch
                  :checked="record.authorized"
                  checked-children="开"
                  un-checked-children="关"
                  @change="(checked: boolean) => handleToggleAuth(record.memberId, checked)"
                />
              </template>
              <template v-else-if="column.key === 'online'">
                <a-tag :color="record.online ? 'green' : 'default'">
                  {{ record.online ? '在线' : '离线' }}
                </a-tag>
              </template>
              <template v-else-if="column.key === 'ipAssignments'">
                {{ record.ipAssignments.join(', ') || '-' }}
              </template>
              <template v-else-if="column.key === 'peer'">
                {{ record.physicalAddress || '-' }}<span v-if="record.latency !== null"> ({{ record.latency }} ms)</span>
              </template>
              <template v-else-if="column.key === 'actions'">
                <a-space>
                  <a-button size="small" @click="openRenameModal(record.memberId, record.memberName)">
                    修改名称
                  </a-button>
                  <a-button danger size="small" @click="handleDelete(record.memberId)">
                    删除
                  </a-button>
                </a-space>
              </template>
            </template>
          </a-table>
        </div>
      </a-space>
    </a-card>

    <a-modal
      v-model:open="renameOpen"
      :confirm-loading="saving"
      title="修改成员名称"
      @ok="handleRename"
    >
      <a-form layout="vertical">
        <a-form-item label="成员名称" extra="该字段对应 ztncui 中的成员名称字段。">
          <a-input v-model:value="renameValue" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { Modal, message } from 'ant-design-vue';
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { deleteMember, getMembers, updateMemberAuth, updateMemberName } from '../../api/members';
import { getNetworkDetail } from '../../api/networks';
import type { MemberItem } from '../../types/member';
import type { NetworkDetail } from '../../types/network';

const route = useRoute();
const router = useRouter();
const controllerId = Number(route.params.controllerId);
const networkId = String(route.params.networkId);

const loading = ref(false);
const saving = ref(false);
const renameOpen = ref(false);
const renameMemberId = ref('');
const renameValue = ref('');
const detail = ref<NetworkDetail | null>(null);
const members = ref<MemberItem[]>([]);

const columns = [
  { dataIndex: 'memberName', key: 'memberName', title: '成员名称' },
  { dataIndex: 'memberId', key: 'memberId', title: '成员 ID' },
  { key: 'authorized', title: '授权' },
  { key: 'online', title: '状态' },
  { key: 'ipAssignments', title: 'IP 分配' },
  { key: 'peer', title: '对端地址' },
  { key: 'actions', title: '操作' },
];

function formatBoolean(value: boolean | null | undefined) {
  if (value === null || value === undefined) {
    return '-';
  }
  return value ? '是' : '否';
}

function openRenameModal(memberId: string, memberName: string) {
  renameMemberId.value = memberId;
  renameValue.value = memberName;
  renameOpen.value = true;
}

async function loadData() {
  loading.value = true;
  try {
    const [networkDetail, membersResult] = await Promise.all([
      getNetworkDetail(controllerId, networkId),
      getMembers(controllerId, networkId),
    ]);
    detail.value = networkDetail;
    members.value = membersResult.items;
  } catch (error) {
    message.error(error instanceof Error ? error.message : '加载网络详情失败');
  } finally {
    loading.value = false;
  }
}

async function handleToggleAuth(memberId: string, checked: boolean) {
  try {
    await updateMemberAuth(controllerId, networkId, memberId, checked);
    message.success('成员授权状态已更新');
    await loadData();
  } catch (error) {
    message.error(error instanceof Error ? error.message : '更新成员授权状态失败');
  }
}

async function handleRename() {
  saving.value = true;
  try {
    await updateMemberName(controllerId, networkId, renameMemberId.value, renameValue.value);
    message.success('成员名称更新成功');
    renameOpen.value = false;
    await loadData();
  } catch (error) {
    message.error(error instanceof Error ? error.message : '更新成员名称失败');
  } finally {
    saving.value = false;
  }
}

function handleDelete(memberId: string) {
  Modal.confirm({
    content: '确认将该成员从当前网络中删除吗？',
    okText: '删除',
    okType: 'danger',
    onOk: async () => {
      try {
        await deleteMember(controllerId, networkId, memberId);
        message.success('成员已删除');
        await loadData();
      } catch (error) {
        message.error(error instanceof Error ? error.message : '删除成员失败');
      }
    },
    title: '删除成员',
  });
}

onMounted(() => {
  if (!Number.isFinite(controllerId) || !networkId) {
    void router.push('/networks');
    return;
  }
  void loadData();
});
</script>

<style scoped>
.detail-head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
}

.section-title {
  margin: 0 0 16px;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.02em;
}
</style>
