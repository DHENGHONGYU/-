import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'mock-trade-api',
      configureServer(server) {
        // 动态导入 mock 模块，避免生产构建时打包
        server.middlewares.use('/api/v1/trade', async (req, res, next) => {
          try {
            const { mockFetchHoldings, mockExecuteTradeAction, mockExportCSV } =
              await import('./src/services/trade/mockHoldingsData')

            const url = new URL(req.url!, `http://${req.headers.host}`)
            const pathname = url.pathname

            // 模拟延迟 200-400ms
            await new Promise((r) => setTimeout(r, 200 + Math.random() * 200))

            // GET /api/v1/trade/holdings - 持仓列表
            if (req.method === 'GET' && pathname === '/holdings') {
              const params = {
                page: Number(url.searchParams.get('page')) || 1,
                pageSize: Number(url.searchParams.get('pageSize')) || 10,
                startDate: url.searchParams.get('startDate') || '',
                endDate: url.searchParams.get('endDate') || '',
                direction: url.searchParams.get('direction') || 'ALL',
                keyword: url.searchParams.get('keyword') || '',
              }
              const result = mockFetchHoldings(params)
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify(result))
              return
            }

            // POST /api/v1/trade/add-position - 补仓
            if (req.method === 'POST' && pathname === '/add-position') {
              const body = await parseBody(req)
              const result = mockExecuteTradeAction(
                body.code as string,
                'ADD_POSITION',
                body.quantity as number,
              )
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify(result))
              return
            }

            // POST /api/v1/trade/close-position - 平仓
            if (req.method === 'POST' && pathname === '/close-position') {
              const body = await parseBody(req)
              const result = mockExecuteTradeAction(
                body.code as string,
                'CLOSE_POSITION',
                body.quantity as number,
              )
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify(result))
              return
            }

            // GET /api/v1/trade/holdings/export - 导出
            if (req.method === 'GET' && pathname === '/holdings/export') {
              const exportParams = {
                page: Number(url.searchParams.get('page')) || 1,
                pageSize: Number(url.searchParams.get('pageSize')) || 10,
                startDate: url.searchParams.get('startDate') || '',
                endDate: url.searchParams.get('endDate') || '',
                direction: url.searchParams.get('direction') || 'ALL',
                keyword: url.searchParams.get('keyword') || '',
              }
              const csv = mockExportCSV(exportParams)
              res.setHeader('Content-Type', 'text/csv; charset=utf-8')
              const fileName = `持仓数据_${new Date().toISOString().slice(0, 10)}.csv`
              res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"; filename*=UTF-8''${encodeURIComponent(fileName)}`)
              res.end(csv)
              return
            }

            next()
          } catch (err) {
            console.error('[mock-trade-api] 中间件异常:', err)
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ code: 500, success: false, message: 'Mock 服务内部异常' }))
          }
        })
      },
    },
  ],
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
    sourcemap: false,  // PR-5 5.2：关闭生产 sourcemap，调试时改为 'hidden'
    rollupOptions: {
      output: {
        manualChunks: {
          // 核心框架
          'vendor': ['react', 'react-dom', 'react-router', 'zustand', 'dayjs'],
          // UI 组件库
          'ui': ['lucide-react', 'clsx', 'tailwind-merge', '@heroicons/react'],
          // 图表库（PR-5 5.1：消除 recharts 重复打包 ~662 kB）
          'charts': ['recharts', 'lightweight-charts'],
          // PDF 导出（PR-5 5.1：配合 backtestExportService 懒加载）
          'pdf': ['jspdf', 'jspdf-autotable'],
          // Excel 处理（PR-5 5.1：配合 backtestExportService 懒加载）
          'excel': ['xlsx'],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts', './tests/contracts/setup.ts'],
    exclude: ['e2e/**', 'node_modules/**', 'dist/**', 'temp/**'],
    testTimeout: 30000,
    hookTimeout: 30000,
    retry: 2,
    // Windows 环境下 Worker 崩溃问题对策（TD-010）
    // 关键配置：forks 池 + maxForks=1 + fileParallelism=false
    // 每个测试文件使用独立 fork 进程，防止内存累积导致崩溃
    // 注：fileParallelism=true 在本机 Windows 会触发 tinypool "Worker exited
    // unexpectedly" 崩溃，故保持单 fork。跨文件模块状态污染（TD-013）改用测试内
    // beforeEach 重置共享单例（store/db）解决，见 tests/setup.ts 与各测试文件。
    pool: 'forks',
    poolOptions: {
      forks: {
        minForks: 1,
        maxForks: 1,
      },
    },
    fileParallelism: false,
    coverage: {
      // istanbul provider 基于源码静态分析，能正确识别所有 statements/branches/functions
      // 使用 threads 池避免 Windows 下 tinypool Worker 崩溃问题（TD-010）
      provider: 'istanbul',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx', 'src/types/**'],
      thresholds: {
        'src/core/**': { statements: 55, branches: 75, functions: 60, lines: 55 },
        'src/data/**': { statements: 35, branches: 35, functions: 35, lines: 35 },
        'src/lib/**': { statements: 70, branches: 65, functions: 80, lines: 70 },
        'src/services/**': { statements: 70, branches: 65, functions: 70, lines: 70 },
      },
    },
  },
})

/** 解析 POST 请求体 */
async function parseBody(req: import('node:http').IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk) => { data += chunk })
    req.on('end', () => {
      try {
        resolve(JSON.parse(data || '{}'))
      } catch {
        reject(new Error('Invalid JSON body'))
      }
    })
    req.on('error', reject)
  })
}
