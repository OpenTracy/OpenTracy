// Applies theme class before React hydrates to prevent FOUC (Flash of Unstyled Content).
// Runs at module-load time to ensure the correct theme is applied immediately.
(() => {
  const STORAGE_KEY = 'vite-ui-theme';
  const theme = (localStorage.getItem(STORAGE_KEY) ?? 'system') as 'light' | 'dark' | 'system';

  const root = document.documentElement;
  root.classList.remove('light', 'dark');

  if (theme === 'system') {
    root.classList.add(
      window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    );
  } else {
    root.classList.add(theme);
  }
})();

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './index.css';
import App from '@/app/App';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found');

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
