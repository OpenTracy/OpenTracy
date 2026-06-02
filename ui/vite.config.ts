import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig(({ mode }) => {
  // Read ports from the repo-root .env (process.env wins, e.g. from `make`),
  // falling back to the defaults.
  const env = loadEnv(mode, path.resolve(__dirname, '..'), '');
  const uiPort = Number(process.env.OPENTRACY_UI_PORT || env.OPENTRACY_UI_PORT) || 5174;
  const backendPort =
    Number(process.env.OPENTRACY_BACKEND_PORT || env.OPENTRACY_BACKEND_PORT) || 8002;

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: uiPort,
      strictPort: true,
      host: true,
      proxy: {
        '/v1': { target: `http://127.0.0.1:${backendPort}`, changeOrigin: true },
      },
    },
  };
});
