<template>
  <div class="login-shell">
    <div class="login-panel">
      <div class="login-copy">
        <div class="login-kicker">内部管理平台</div>
        <h1>统一 ztncui 控制台</h1>
        <p>
          登录后可统一管理控制器、自动初始化网络，并跨区域维护成员节点。
        </p>
      </div>
      <a-card :bordered="false" class="login-card">
        <h2>平台登录</h2>
        <a-form :model="form" layout="vertical" @finish="handleSubmit">
          <a-form-item label="用户名" name="username">
            <a-input v-model:value="form.username" placeholder="请输入用户名" />
          </a-form-item>
          <a-form-item label="密码" name="password">
            <a-input-password v-model:value="form.password" placeholder="请输入密码" />
          </a-form-item>
          <a-button :loading="loading" block html-type="submit" size="large" type="primary">
            登录
          </a-button>
        </a-form>
      </a-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import { useRouter } from 'vue-router';
import { login } from '../../api/auth';
import { useAuthStore } from '../../stores/auth';

const router = useRouter();
const authStore = useAuthStore();
const loading = ref(false);
const form = reactive({
  password: '',
  username: '',
});

async function handleSubmit() {
  loading.value = true;
  try {
    const result = await login(form);
    authStore.setSession(result.token, result.user);
    message.success('登录成功');
    await router.push('/controllers');
  } catch (error) {
    message.error(error instanceof Error ? error.message : '登录失败');
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-shell {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
}

.login-panel {
  width: min(1120px, 100%);
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(360px, 408px);
  border-radius: 28px;
  overflow: hidden;
  background:
    linear-gradient(145deg, rgba(12, 74, 110, 0.95), rgba(6, 78, 59, 0.88)),
    #0f172a;
  box-shadow: 0 30px 60px rgba(15, 23, 42, 0.22);
}

.login-copy {
  padding: clamp(40px, 4vw, 64px);
  color: #f8fafc;
}

.login-copy h1 {
  margin: 16px 0 12px;
  font-size: clamp(40px, 2vw + 0.9rem, 54px);
  line-height: 0.98;
  letter-spacing: -0.05em;
  white-space: nowrap;
}

.login-copy p {
  max-width: 34rem;
  color: rgba(248, 250, 252, 0.82);
  font-size: 16px;
  line-height: 1.6;
}

.login-kicker {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(248, 250, 252, 0.72);
}

.login-card {
  padding: clamp(28px, 3vw, 36px);
  border-radius: 0;
}

.login-card h2 {
  margin: 0 0 20px;
  font-size: 28px;
  letter-spacing: -0.03em;
}

@media (max-width: 1080px) {
  .login-panel {
    width: min(980px, 100%);
    grid-template-columns: minmax(0, 1fr) minmax(320px, 360px);
  }

  .login-copy h1 {
    font-size: clamp(36px, 4.2vw, 46px);
  }
}

@media (max-width: 900px) {
  .login-panel {
    grid-template-columns: 1fr;
  }

  .login-copy {
    padding: 32px;
  }

  .login-copy h1 {
    white-space: normal;
  }
}
</style>
