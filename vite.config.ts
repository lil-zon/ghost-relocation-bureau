import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Относительные пути к ассетам: собранное приложение одинаково работает
  // на GitHub Pages в подпапке репозитория, локально из `dist` и на любом
  // статическом хостинге — без привязки к имени репозитория.
  base: './',
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: false,
    css: false,
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
