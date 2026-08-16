/**
 * @fileoverview directDataAPI 错误类、共享工具函数与网络请求封装
 *
 * 从 directDataAPI.ts 拆分，提供所有子模块共用的基础设施：
 * - DirectDataAPIError 错误类
 * - isAbortError 超时检测
 * - safeNumber 安全数字解析
 * - fetchWithTimeout 带超时的 fetch
 * - getMarketPrefix / stripCodeSuffix / buildTencentCode / buildSinaCode / getNeteaseCode 代码格式化
 */

import { getLogger } from '@/lib/logger'
import { createBranchLogger, type BranchLogger } from '@/lib/logHelpers'
import { DIRECT_DATA_API_TIMEOUT_MS } from '@/config/timeouts'
import { HK_CODE_LENGTH } from '@/constants/stockCode.constants'

const logger = getLogger()
const blog: BranchLogger = createBranchLogger(logger, 'directDataAPI')

export { logger, blog }

// ============================================================
// 公共类型定义
// ============================================================

export interface StockQuote {
  code: string
  name: string
  price: number
  change: number
  changePercent: number
  open: number
  high: number
  low: number
  prevClose: number
  volume: number
  amount: number
  timestamp: number
  source: 'tencent' | 'sina' | 'netease' | 'akshare' | 'mock'
}

export interface KlineItem {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
  amount: number
  /** 数据来源标记，用于 Mock 检测 */
  source?: string
}

// ============================================================
// 错误类
// ============================================================

export class DirectDataAPIError extends Error {
  constructor(
    message: string,
    public readonly source: 'tencent' | 'sina' | 'netease',
    public readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'DirectDataAPIError'
  }
}

// ============================================================
// 代码格式化工具
// ============================================================

/** 根据股票代码推断交易所前缀：沪市 sh，深市 sz，港股 hk */
export function getMarketPrefix(code: string): 'sh' | 'sz' | 'hk' {
  const c = code.trim().toUpperCase()
  if (c.endsWith('.HK')) return 'hk'
  if (c.startsWith('6') || c.startsWith('5') || c.startsWith('11') || c.startsWith('13')) {
    return 'sh'
  }
  return 'sz'
}

/** 去除股票代码后缀（.SH/.SZ/.HK），返回纯数字代码 */
export function stripCodeSuffix(code: string): string {
  return code.trim().toUpperCase().replace(/\.(SH|SZ|HK)$/i, '')
}

/** 构建腾讯行情请求代码：A 股 sh600519 / 港股 s_hk00700 */
export function buildTencentCode(code: string): string {
  const prefix = getMarketPrefix(code)
  const bare = stripCodeSuffix(code)
  if (prefix === 'hk') {
    return `s_hk${bare.padStart(HK_CODE_LENGTH, '0')}`
  }
  return `${prefix}${bare}`
}

/**
 * 构建腾讯 K 线请求代码：A 股 sh600519 / 港股 hk00700（不带 s_ 前缀）。
 *
 * ⚠️ 与 buildTencentCode 的差异（关键 bug 修复）：
 * 腾讯 K 线接口（web.ifzq.gtimg.cn/appstock/app/fqkline/get）的港股数据 key 为
 * `hk00700`（无 s_ 前缀），而实时行情接口为 `s_hk00700`。此前 tencentKline 复用
 * buildTencentCode 导致港股 K 线 URL 与解析 key 均为错误的 `s_hk00700`，腾讯返回
 * `param error` / `v_pv_none_match` → 港股 K 线恒为空。本函数专用于 K 线，修正该错位。
 */
export function buildTencentKlineCode(code: string): string {
  const prefix = getMarketPrefix(code)
  const bare = stripCodeSuffix(code)
  if (prefix === 'hk') {
    return `hk${bare.padStart(HK_CODE_LENGTH, '0')}`
  }
  return `${prefix}${bare}`
}

/** 构建新浪行情请求代码：A 股 sh600519 / 港股 rt_hk00700 */
export function buildSinaCode(code: string): string {
  const prefix = getMarketPrefix(code)
  const bare = stripCodeSuffix(code)
  if (prefix === 'hk') {
    return `rt_hk${bare.padStart(HK_CODE_LENGTH, '0')}`
  }
  return `${prefix}${bare}`
}

/** 网易历史接口代码前缀：0=沪，1=深/港 */
export function getNeteaseCode(code: string): string {
  const prefix = getMarketPrefix(code)
  const bare = stripCodeSuffix(code)
  if (prefix === 'hk') {
    if (bare.length > HK_CODE_LENGTH) {
      blog.guardWarn('getNeteaseCode HK 长度守卫', `超过 ${HK_CODE_LENGTH} 位`, { code, bare, length: bare.length })
      throw new DirectDataAPIError(
        `港股代码 ${code} 超过 ${HK_CODE_LENGTH} 位，网易代码与深市 A 股碰撞风险`,
        'netease',
      )
    }
    return `1${bare.padStart(HK_CODE_LENGTH, '0')}`
  }
  return prefix === 'sh' ? `0${bare}` : `1${bare}`
}

// ============================================================
// 安全解析 & 网络请求
// ============================================================

/** 安全数字解析：非法/空值返回 fallback */
export function safeNumber(val: string | undefined | null, fallback = 0): number {
  if (val === undefined || val === null || val === '') return fallback
  const trimmed = String(val).trim()
  if (trimmed === '') return fallback
  const n = Number(trimmed)
  return Number.isFinite(n) ? n : fallback
}

/** fetch + AbortController 超时控制 */
export async function fetchWithTimeout(url: string, timeoutMs: number = DIRECT_DATA_API_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  try {
    logger.info('[directDataAPI] fetch start', { url, timeoutMs })
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'text/plain, application/json, */*' },
    })
    logger.info('[directDataAPI] fetch response', { url, status: response.status })
    return response
  } finally {
    clearTimeout(timeoutId)
  }
}

export function isAbortError(err: unknown): boolean {
  return err instanceof Error && (err.name === 'AbortError' || err.message.includes('aborted'))
}
