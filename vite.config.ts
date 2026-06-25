import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['react', 'react-dom', 'react-router', 'zustand'],
          'ui': ['lucide-react', 'clsx', 'tailwind-merge'],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    exclude: ['e2e/**', 'node_modules/**', 'dist/**', 'temp/**'],
    testTimeout: 30000,
    hookTimeout: 30000,
    retry: 2,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        'src/core/**': { statements: 55, branches: 75, functions: 60, lines: 55 },
        'src/data/**': { statements: 35, branches: 35, functions: 35, lines: 35 },
        'src/lib/**': { statements: 70, branches: 65, functions: 80, lines: 70 },
        'src/services/**': { statements: 70, branches: 65, functions: 70, lines: 70 },
      },
      exclude: ['e2e/**', 'node_modules/**', 'dist/**', 'tests/**', 'temp/**', 'src/types/**'],
    },
  },
})
