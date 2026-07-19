/**
 * @fileoverview 爬虫补充层
 *
 * 职责：
 * - 当 Tushare 覆盖不足或不可用时，通过东方财富、Baostock 等公开端点补充数据
 * - 统一节流、User-Agent 轮换、失败降级
 * - 所有请求经后端/Vite proxy 转发，避免浏览器 CORS
 */

import { getLogger } from '@/lib/logger'
import { SINA_FINANCE_API_BASE, TENCENT_FINANCE_API_BASE } from '@/config/marketDataEndpoints'
import type { ChipData, NewsItem, CompetitorData, ResearchReport } from './dimensionDataTypes'
import type { KlineBar } from '@/data/types/types.marketData'

const logger = getLogger()

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
]

let lastRequestTime = 0
const EASTMONEY_MIN_INTERVAL_MS = 1500

/** 简单节流：确保东财请求间隔 ≥ 1.5s */
async function throttleEastMoney(): Promise<void> {
  const now = Date.now()
  const elapsed = now - lastRequestTime
  if (elapsed < EASTMONEY_MIN_INTERVAL_MS) {
    await new Promise((resolve) => setTimeout(resolve, EASTMONEY_MIN_INTERVAL_MS - elapsed))
  }
  lastRequestTime = Date.now()
}

function rotateUA(): string {
  const idx = Math.floor(Math.random() * USER_AGENTS.length)
  return USER_AGENTS[idx] ?? USER_AGENTS[0] ?? 'Mozilla/5.0'
}

/** 安全 fetch，带超时和 UA */
async function safeFetch(url: string, timeoutMs = 10000): Promise<Response | null> {
  await throttleEastMoney()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': rotateUA(), Accept: 'application/json, text/html' },
    })
  } catch (err) {
    logger.warn('[crawlerProvider] fetch 失败', { url, error: err instanceof Error ? err.message : String(err) })
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** 从 600519.SH 提取 6 位代码 */
function extractSixDigitCode(symbol: string): string {
  return symbol.replace(/\.(SH|SZ|BJ)$/i, '').trim()
}

// ── 03 筹码：东财股东户数 ──

export async function fetchEastMoneyHolderNumber(symbol: string): Promise<ChipData | null> {
  const code = extractSixDigitCode(symbol)
  const url = `${SINA_FINANCE_API_BASE}eastmoney/holder?code=${code}`
  const resp = await safeFetch(url)
  if (!resp) return null
  try {
    const data = (await resp.json()) as Record<string, unknown>
    const result = Array.isArray(data?.result) ? (data.result as Record<string, unknown>[]) : []
    const latest = result[0]
    if (!latest) return null
    return {
      shareholderCount: latest.holderNum != null ? Number(latest.holderNum) : undefined,
      avgSharesPerHolder: latest.avgSharesPerHolder != null ? Number(latest.avgSharesPerHolder) : undefined,
      date: toString(latest.endDate) || new Date().toISOString().slice(0, 10),
    }
  } catch (err) {
    logger.warn('[crawlerProvider] 东财股东户数解析失败', { symbol, error: err instanceof Error ? err.message : String(err) })
    return null
  }
}

// ── 04/05 公告/新闻 ──

export async function fetchEastMoneyAnnouncements(symbol: string): Promise<NewsItem[]> {
  const code = extractSixDigitCode(symbol)
  const url = `${SINA_FINANCE_API_BASE}eastmoney/announcement?code=${code}`
  const resp = await safeFetch(url)
  if (!resp) return []
  try {
    const data = (await resp.json()) as { data?: { data?: Record<string, unknown>[] } }
    const items = data?.data?.data ?? []
    return items.map((item) => ({
      id: `${code}-${toString(item.noticeDate)}-${toString(item.title).slice(0, 16)}`,
      title: toString(item.title),
      content: '',
      source: '东方财富公告',
      date: toString(item.noticeDate)?.slice(0, 10) || '',
      category: 'announcement' as const,
      url: toString(item.url),
    }))
  } catch (err) {
    logger.warn('[crawlerProvider] 东财公告解析失败', { symbol, error: err instanceof Error ? err.message : String(err) })
    return []
  }
}

export async function fetchEastMoneyNews(symbol: string): Promise<NewsItem[]> {
  const code = extractSixDigitCode(symbol)
  const url = `${TENCENT_FINANCE_API_BASE}eastmoney/news?code=${code}`
  const resp = await safeFetch(url)
  if (!resp) return []
  try {
    const data = (await resp.json()) as { result?: { data?: Record<string, unknown>[] } }
    const items = data?.result?.data ?? []
    return items.map((item) => ({
      id: `${code}-${toString(item.artTime)}-${toString(item.title).slice(0, 16)}`,
      title: toString(item.title),
      content: toString(item.content),
      source: toString(item.mediaName) || '东方财富',
      date: toString(item.artTime)?.slice(0, 10) || '',
      category: 'hot_news' as const,
    }))
  } catch (err) {
    logger.warn('[crawlerProvider] 东财新闻解析失败', { symbol, error: err instanceof Error ? err.message : String(err) })
    return []
  }
}

// ── 06 行业竞品 ──

export async function fetchEastMoneyIndustry(symbol: string): Promise<CompetitorData[]> {
  const code = extractSixDigitCode(symbol)
  const url = `${TENCENT_FINANCE_API_BASE}eastmoney/industry?code=${code}`
  const resp = await safeFetch(url)
  if (!resp) return []
  try {
    const data = (await resp.json()) as { data?: Record<string, unknown>[] }
    const items = data?.data ?? []
    return items.map((item) => ({
      symbol: toString(item.code),
      name: toString(item.name),
      pe: item.pe != null ? Number(item.pe) : undefined,
      pb: item.pb != null ? Number(item.pb) : undefined,
    }))
  } catch (err) {
    logger.warn('[crawlerProvider] 东财行业解析失败', { symbol, error: err instanceof Error ? err.message : String(err) })
    return []
  }
}

// ── 08 研报 ──

export async function fetchEastMoneyResearch(symbol: string): Promise<ResearchReport[]> {
  const code = extractSixDigitCode(symbol)
  const url = `${SINA_FINANCE_API_BASE}eastmoney/research?code=${code}`
  const resp = await safeFetch(url)
  if (!resp) return []
  try {
    const data = (await resp.json()) as { data?: Record<string, unknown>[] }
    const items = data?.data ?? []
    return items.map((item) => ({
      id: `${code}-${toString(item.publishDate)}-${toString(item.title).slice(0, 16)}`,
      title: toString(item.title),
      author: toString(item.author),
      institution: toString(item.orgName),
      rating: toString(item.ratingName) || '中性',
      targetPrice: item.predictThisYearPe != null ? Number(item.predictThisYearPe) : undefined,
      date: toString(item.publishDate)?.slice(0, 10) || '',
      summary: toString(item.summary),
    }))
  } catch (err) {
    logger.warn('[crawlerProvider] 东财研报解析失败', { symbol, error: err instanceof Error ? err.message : String(err) })
    return []
  }
}

// ── 02 K线：Baostock 补充 ──

export async function fetchBaostockKline(symbol: string, days: number): Promise<KlineBar[]> {
  const code = extractSixDigitCode(symbol)
  const url = `/api/proxy/baostock/kline?code=${code}&days=${days}`
  const resp = await safeFetch(url)
  if (!resp) return []
  try {
    const data = (await resp.json()) as { data?: KlineBar[] }
    return Array.isArray(data?.data) ? data.data : []
  } catch (err) {
    logger.warn('[crawlerProvider] Baostock K线解析失败', { symbol, error: err instanceof Error ? err.message : String(err) })
    return []
  }
}

function toString(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value)
}
