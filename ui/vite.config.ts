import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import svgr from 'vite-plugin-svgr';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), svgr()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  assetsInclude: ['**/*.mp4', '**/*.webm', '**/*.ogg'],
  build: {
    target: 'es2020',
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          // Separate React and related libraries
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],

          // Separate AWS Amplify (large dependency)
          'aws-vendor': ['aws-amplify', '@aws-amplify/ui-react', 'amazon-cognito-identity-js'],

          // Separate Monaco Editor (code editor - very large)
          'monaco-vendor': ['@monaco-editor/react'],

          // Separate chart libraries
          'charts-vendor': ['recharts'],

          // Separate markdown rendering
          'markdown-vendor': ['react-markdown', 'react-syntax-highlighter'],

          // Separate UI components library
          'ui-vendor': ['framer-motion', 'lucide-react'],

          // Separate payment processing
          'stripe-vendor': ['@stripe/stripe-js', '@stripe/react-stripe-js', 'stripe'],
        },
      },
    },
    // Increase chunk size warning limit to 600kb (from default 500kb)
    chunkSizeWarningLimit: 600,
    // Enable source maps for production debugging (optional)
    sourcemap: false,
  },
  server: {
    proxy: {
      '/api': {
        target: 'https://dev-gateway.pureai-api.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        secure: true,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
        },
      },
    },
  },
});
