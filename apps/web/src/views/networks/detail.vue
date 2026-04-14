<template>
  <div class="page-shell">
    <a-card class="page-card" :bordered="false">
      <a-space direction="vertical" style="width: 100%" :size="20">
        <div class="detail-head">
          <div>
            <h1 class="page-title">{{ detail?.networkName || 'Network Detail' }}</h1>
            <p class="page-subtitle">
              Controller {{ detail?.controllerName || '-' }} · Network ID {{ detail?.networkId || '-' }}
            </p>
          </div>
          <a-space>
            <a-button @click="loadData">Refresh</a-button>
            <a-button @click="router.push('/networks')">Back</a-button>
          </a-space>
        </div>

        <a-descriptions bordered :column="2" size="middle">
          <a-descriptions-item label="Controller">{{ detail?.controllerName || '-' }}</a-descriptions-item>
          <a-descriptions-item label="Private">{{ detail?.private ?? '-' }}</a-descriptions-item>
          <a-descriptions-item label="Routes">
            <div v-if="detail?.routes.length">
              <div v-for="route in detail.routes" :key="route.target">{{ route.target }}</div>
            </div>
            <span v-else>-</span>
          </a-descriptions-item>
          <a-descriptions-item label="Assignment Pools">
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
          <h2 class="section-title">Members</h2>
          <a-table :columns="columns" :data-source="members" :loading="loading" row-key="memberId">
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'authorized'">
                <a-switch
                  :checked="record.authorized"
                  checked-children="Auth"
                  un-checked-children="Off"
                  @change="(checked: boolean) => handleToggleAuth(record.memberId, checked)"
                />
              </template>
              <template v-else-if="column.key === 'online'">
                <a-tag :color="record.online ? 'green' : 'default'">
                  {{ record.online ? 'ONLINE' : 'OFFLINE' }}
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
                    Edit Name
                  </a-button>
                  <a-button danger size="small" @click="handleDelete(record.memberId)">
                    Delete
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
      title="Edit Member name"
      @ok="handleRename"
    >
      <a-form layout="vertical">
        <a-form-item label="Member name" extra="This maps to ztncui Member name.">
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
  { dataIndex: 'memberName', key: 'memberName', title: 'Member name' },
  { dataIndex: 'memberId', key: 'memberId', title: 'Member ID' },
  { key: 'authorized', title: 'Authorized' },
  { key: 'online', title: 'Status' },
  { key: 'ipAssignments', title: 'IP Assignments' },
  { key: 'peer', title: 'Peer' },
  { key: 'actions', title: 'Actions' },
];

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
    message.error(error instanceof Error ? error.message : 'Failed to load network detail');
  } finally {
    loading.value = false;
  }
}

async function handleToggleAuth(memberId: string, checked: boolean) {
  try {
    await updateMemberAuth(controllerId, networkId, memberId, checked);
    message.success('Member authorization updated');
    await loadData();
  } catch (error) {
    message.error(error instanceof Error ? error.message : 'Failed to update member authorization');
  }
}

async function handleRename() {
  saving.value = true;
  try {
    await updateMemberName(controllerId, networkId, renameMemberId.value, renameValue.value);
    message.success('Member name updated');
    renameOpen.value = false;
    await loadData();
  } catch (error) {
    message.error(error instanceof Error ? error.message : 'Failed to update member name');
  } finally {
    saving.value = false;
  }
}

function handleDelete(memberId: string) {
  Modal.confirm({
    content: 'Delete this member from the current network?',
    okText: 'Delete',
    okType: 'danger',
    onOk: async () => {
      try {
        await deleteMember(controllerId, networkId, memberId);
        message.success('Member deleted');
        await loadData();
      } catch (error) {
        message.error(error instanceof Error ? error.message : 'Failed to delete member');
      }
    },
    title: 'Delete Member',
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
