import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages отдаёт сайт по адресу https://madmed677.github.io/wishlist/
export default defineConfig({
  base: '/wishlist/',
  plugins: [react()],
  build: { chunkSizeWarningLimit: 1200 }, // Firebase SDK весит ~800 КБ, это нормально
});
