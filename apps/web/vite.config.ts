import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

function resolveApiProxyTarget() {
  const configuredApiBaseUrl = process.env.VITE_API_BASE_URL;

  if (configuredApiBaseUrl) {
    try {
      return new URL(configuredApiBaseUrl).origin;
    } catch {
      // Fall back to HOST/PORT for relative API base URLs.
    }
  }

  const backendHost =
    process.env.HOST && process.env.HOST !== '0.0.0.0'
      ? process.env.HOST
      : '127.0.0.1';
  const backendPort = process.env.PORT || '3001';

  return `http://${backendHost}:${backendPort}`;
}

const allowedHosts = ['zt-mgmt.dev', 'zt-mgmt.skorpiox89.cc'];

export default defineConfig({
  plugins: [vue()],
  server: {
    allowedHosts,
    host: '0.0.0.0',
    port: 4173,
    proxy: {
      '/api': {
        changeOrigin: true,
        target: resolveApiProxyTarget(),
      },
    },
  },
  preview: {
    allowedHosts,
    host: '0.0.0.0',
    port: 4173,
    proxy: {
      '/api': {
        changeOrigin: true,
        target: resolveApiProxyTarget(),
      },
    },
  },
});
