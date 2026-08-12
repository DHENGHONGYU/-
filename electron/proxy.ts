/**
 * API 代理处理器
 *
 * 在生产模式下（Electron 打包后）处理前端 API 请求
 * 代替 Vite 的 proxy 功能
 *
 * 策略：
 * - /api/embed/* → 转发到 Embedding Service (localhost:8001)
 * - /api/akshare/* → 转发到 AKShare Collector (localhost:8000)
 * - /api/proxy/* → 按域名白名单转发到外部 API
 */

import { BrowserWindow, session } from 'electron'
import { getLogger } from './logger'

const logger = getLogger('proxy')

// 域名白名单（允许 /api/proxy/ 转发的外部域名）
const DOMAIN_WHITELIST = [
  'proxy.finance.qq.com',
  'hq.sinajs.cn',
  'push2.eastmoney.com',
  'push2his.eastmoney.com',
  'datacenter-web.eastmoney.com',
  'reportapi.eastmoney.com',
  'np-anotice-stock.eastmoney.com',
  'api.tushare.pro',
  'api.deepseek.com',
]

interface ProxyTarget {
  target: string
  rewrite?: (path: string) => string
}

// 本地服务代理规则
const LOCAL_PROXIES: Record<string, ProxyTarget> = {
  '/api/embed': {
    target: 'http://127.0.0.1:8001',
  },
  '/api/akshare': {
    target: 'http://127.0.0.1:8000',
    rewrite: (p) => p.replace('/api/akshare', ''),
  },
  '/api/collect': {
    target: 'http://127.0.0.1:8000',
  },
}

/**
 * 设置 API 代理
 * 在 app.whenReady() 后调用
 */
export function createProxyHandler(_mainWindow: BrowserWindow | null): void {
  logger.info('Setting up API proxy handlers...')

  // 拦截所有请求
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const url = details.url

    // 检查本地服务代理
    for (const [prefix, config] of Object.entries(LOCAL_PROXIES)) {
      if (url.includes(prefix) || url.includes(prefix.replace('/api/', ''))) {
        // 本地服务代理由前端 fetch 直接处理（CORS 已在服务端配置）
        // 这里不做拦截，让请求直接到达本地服务
        callback({})
        return
      }
    }

    callback({})
  })

  // 处理 CORS 头
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = { ...details.responseHeaders }

    // 添加 CORS 头
    responseHeaders['access-control-allow-origin'] = ['*']
    responseHeaders['access-control-allow-methods'] = ['GET, POST, PUT, DELETE, OPTIONS']
    responseHeaders['access-control-allow-headers'] = ['Content-Type, Authorization']

    callback({ responseHeaders })
  })

  logger.info('API proxy handlers set up successfully')
}

/**
 * 检查域名是否在白名单中
 */
export function isDomainWhitelisted(hostname: string): boolean {
  return DOMAIN_WHITELIST.some(
    (domain) => hostname === domain || hostname.endsWith('.' + domain)
  )
}
