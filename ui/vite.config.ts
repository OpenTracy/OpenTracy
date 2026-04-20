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
      // Redirect every aws-amplify import to the local shim so the UI runs
      // fully self-hosted without Cognito / AppSync. See src/lib/amplify-shim/.
      'aws-amplify/auth': path.resolve(__dirname, './src/lib/amplify-shim/auth.ts'),
      'aws-amplify/data': path.resolve(__dirname, './src/lib/amplify-shim/data.ts'),
      'aws-amplify/utils': path.resolve(__dirname, './src/lib/amplify-shim/utils.ts'),
      'aws-amplify': path.resolve(__dirname, './src/lib/amplify-shim/index.ts'),
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
});
