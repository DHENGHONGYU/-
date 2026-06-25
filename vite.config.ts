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
    testTimeout: 15000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        'src/core/**': { statements: 85, branches: 85, functions: 85, lines: 85 },
        'src/data/**': { statements: 85, branches: 85, functions: 85, lines: 85 },
        'src/lib/**': { statements: 85, branches: 85, functions: 85, lines: 85 },
        'src/services/**': { statements: 70, branches: 70, functions: 70, lines: 70 },
      },
      exclude: ['e2e/**', 'node_modules/**', 'dist/**', 'tests/**'],
    },
  },
})
