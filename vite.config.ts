import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [
    react(),
    // P1-2 安全合规：生产构建注入 Content-Security-Policy 响应头（等价 meta）
    // 仅 build 阶段注入（apply:'build'），避免破坏 dev 的 HMR/WebSocket；
    // script-src 'self' 禁用 unsafe-inline（原内联脚本已外置为 public/theme-boot.js）。
    // 说明：style-src 保留 'unsafe-inline' 是 React 动态行内样式的刚需；
    // connect-src 当前放行 'self' https:，上线前应收紧为精确行情域名白名单。
    {
      name: 'inject-csp-meta',
      apply: 'build',
      transformIndexHtml(html) {
        const csp = [
          "default-src 'self'",
          "script-src 'self'",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: https:",
          "font-src 'self' data:",
          "connect-src 'self' https:",
          "worker-src 'self' blob:",
          "object-src 'none'",
          "base-uri 'self'",
          "frame-ancestors 'none'",
        ].join('; ')
        return {
          html,
          tags: [
            {
              tag: 'meta',
              attrs: { 'http-equiv': 'Content-Security-Policy', content: csp },
              injectTo: 'head-prepend',
            },
          ],
        }
      },
    },
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
    proxy: {
      // 腾讯行情 API 代理（解决浏览器 CORS）
      '/api/proxy/tencent': {
        target: 'https://qt.gtimg.cn',
        changeOrigin: true,
        rewrite: (path) => '/q=' + path.replace('/api/proxy/tencent/', ''),
        headers: { Referer: 'https://finance.qq.com' },
      },
      // 新浪行情 API 代理（需正确 Referer 头）
      '/api/proxy/sina': {
        target: 'https://hq.sinajs.cn',
        changeOrigin: true,
        rewrite: (path) => '/list=' + path.replace('/api/proxy/sina/', ''),
        headers: { Referer: 'https://finance.sina.com.cn' },
      },
      // 腾讯 Smartbox 搜索 API 代理（股票搜索建议，免费无 Key）
      '/api/proxy/smartbox': {
        target: 'https://smartbox.gtimg.cn',
        changeOrigin: true,
        rewrite: (path) => '/s3/' + path.replace('/api/proxy/smartbox/', ''),
        headers: { Referer: 'https://finance.qq.com' },
      },
      // 腾讯历史 K 线 API 代理（web.ifzq.gtimg.cn 日 K线数据，解决浏览器 CORS）
      '/api/proxy/tencent-kline': {
        target: 'https://web.ifzq.gtimg.cn',
        changeOrigin: true,
        rewrite: (path) => path.replace('/api/proxy/tencent-kline/', '/'),
        headers: { Referer: 'https://finance.qq.com' },
      },
      // 新浪财经数据 API 代理（股东户数/公告/新闻等非行情端点）
      '/api/proxy/sina-finance': {
        target: 'https://vip.stock.finance.sina.com.cn',
        changeOrigin: true,
        rewrite: (path) => path.replace('/api/proxy/sina-finance/', '/'),
        headers: { Referer: 'https://finance.sina.com.cn' },
      },
      // 腾讯财经数据 API 代理（行业/板块等非行情端点）
      '/api/proxy/tencent-finance': {
        target: 'https://proxy.finance.qq.com',
        changeOrigin: true,
        rewrite: (path) => path.replace('/api/proxy/tencent-finance/', '/'),
        headers: { Referer: 'https://finance.qq.com' },
      },
      // Tushare Pro API 代理（POST http://api.tushare.pro，由服务端持有 Token）
      '/api/proxy/tushare': {
        target: 'http://api.tushare.pro',
        changeOrigin: true,
        rewrite: (path) => path.replace('/api/proxy/tushare/', '/'),
      },
    },
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 800,
    modulePreload: {
      polyfill: false,
      resolveDependencies(_filename, deps, context) {
        const heavyChunks = ['charts', 'pdf', 'excel', 'transformers', 'duckdb', 'html2canvas']
        return deps.filter((dep) => {
          const isHeavy = heavyChunks.some((name) => dep.includes(name))
          return !isHeavy
        })
      },
    },
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['react', 'react-dom', 'react-router', 'zustand'],
          'ui': ['lucide-react', 'clsx', 'tailwind-merge', '@heroicons/react'],
          'charts': ['recharts', 'lightweight-charts'],
          'pdf': ['jspdf', 'jspdf-autotable'],
          'excel': ['xlsx'],
          'transformers': ['@xenova/transformers'],
          'duckdb': ['@duckdb/duckdb-wasm'],
          'purify': ['dompurify'],
          'html2canvas': ['html2canvas'],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts', './tests/contracts/setup.ts'],
    // 注意：必须写 **/node_modules/**（前导 globstar），否则无法匹配嵌套的
    // packages/*/node_modules，会导致把 pino/thread-stream/process-warning 等
    // 第三方依赖的测试误收进门禁（TD-013 衍生噪声）。见 test:clean 治理。
    exclude: ['e2e/**', '**/node_modules/**', 'dist/**', 'temp/**'],
    testTimeout: 30000,
    hookTimeout: 30000,
    retry: 2,
    // Windows 环境下 Worker 崩溃问题对策（TD-010）
    // 关键配置：forks 池 + fileParallelism=false（避免 threads 池 tinypool 崩溃）
    // maxForks=4：允许 vitest 在文件间回收 fork 进程，避免单 fork 跨全部文件累积内存
    // 导致 "Worker exited unexpectedly"（旧 maxForks=1 恰恰造成单进程内存累积致死）。
    // 每个文件复用/轮换到较新的 fork，内存得以释放。跨文件模块状态污染（TD-013）
    // 改用测试内 beforeEach 重置共享单例（store/db）解决，见 tests/setup.ts。
    pool: 'forks',
    poolOptions: {
      forks: {
        minForks: 1,
        maxForks: 4,
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
