<template>
  <a-config-provider :locale="zhCN" :theme="themeConfig">
    <RouterView />
  </a-config-provider>
</template>

<script setup lang="ts">
import zhCN from 'ant-design-vue/es/locale/zh_CN';
import type { ThemeConfig } from 'ant-design-vue/es/config-provider/context';
import { RouterView } from 'vue-router';

const themeConfig: ThemeConfig = {
  token: {
    colorPrimary: '#0d9488',
    colorLink: '#0d9488',
    borderRadius: 8,
  },
};
</script>
