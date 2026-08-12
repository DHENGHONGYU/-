/**
 * @fileoverview 直连行情数据源 — 薄适配层（re-export + 签名映射）
 *
 * **收敛说明（TD-012 阶段 2 迁移结果）**：
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  CANONICAL 唯一实现：src/services/fetcher/directDataAPI.ts          │
 * │  本文件仅保留为 data-collector/ 层消费者的兼容入口，                │
 * │  内部调用 fetcher/ 版实现并将返回值适配为原有签名。                  │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * 迁移前（2026-07-19 ~ 2026-08-09）：本文件为独立副本，与 fetcher/ 版
 *   存在 7 类差异（类型/错误策略/配置源/批量行情实现/新浪字段索引不一致
 *   /qfqday 兜底缺失/网易字段差异）。其中新浪 volume/amount 字段索引
 *   [8]/[9]、批量行情 matchAll+idx 顺序敏感、qfqday 兜底缺失共 3 处为
 *   高风险 bug。
 *
 * 迁移后（2026-08-09 起）：本文件 import fetcher/ 的 CANONICAL 实现并
 *   做薄适配（签名映射 + 错误归一化），消除重复代码与 3 处 bug：
 *   ✅ 新浪字段索引：统一为 fetcher/ 版正确索引 [29]volume / [30]amount
 *   ✅ 批量行情：统一为 fetcher/ 版 split 逐段解析（按内容取 code 不依赖顺序）
 *   ✅ qfqday 兜底：统一为 fetcher/ 版 qfqday ?? day 复权优先兜底
 *
 * 兼容契约（不变更）：
 *   - 行情返回 RealtimeQuote（symbol 字段）/ null（非 throw DirectDataAPIError）
 *   - K 线返回 KlineBar[]（来自 @/data/types/types.marketData）
 *   - tencentKline 签名：(code, days = 60) → 内部映射为 period='day' count=days
 *   - 原有 10 项 export 全部保留（见下方 export 块）
 *
 * 消费者迁移建议：
 *   - tushareAdapter.ts / collectionPipeline.ts：可改 import 指向 fetcher/
 *     （只用到 quoteToStock/klinesToDailyQuotes/RealtimeQuote type 兼容子集）
 *   - dataSourceOrchestrator.ts：保留 import './directDataAPI'，因为
 *     orchestrator 内降级链依赖 RealtimeQuote | null 语义与 tencentKline 双参签名
 *
 * @doc [V9-DOC-BACK-012, V9-DOC-BACK-023, V9-DOC-BACK-033, V9-DOC-BACK-021, V9-DOC-BACK-026]
 */

import {
  tencentQuote as _tencentQuote,
  tencentBatchQuotes as _tencentBatchQuotes,
  tencentKline as _tencentKline,
  sinaQuote as _sinaQuote,
  sinaBatchQuotes as _sinaBatchQuotes,
  neteaseHistory as _neteaseHistory,
  quoteToStock,
  klinesToDailyQuotes,
} from '../fetcher/directDataAPI'
import type {
  RealtimeQuote,
  StockQuote,
  KlineItem,
} from '../fetcher/directDataAPI'
import type { KlineBar } from '@/data/types/types.marketData'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

// ── 兼容类型 ────────────────────────────────────────────────────────────
// RealtimeQuote 直接从 fetcher/ re-export（同形，symbol 字段）
export type { RealtimeQuote } from '../fetcher/directDataAPI'

/** 行情源元信息（fetcher/ 无对等类型，仅保留 export 不破坏外部消费者） */
export interface SourceInfo {
  /** 源显示名称（如 "腾讯直连"） */
  name: string
  /** 源类型：direct=直连三方 API / tushare=Tushare Pro / akshare=AKShare Python 侧 / mock=模拟 */
  sourceType: 'direct' | 'tushare' | 'akshare' | 'mock'
  /** 源 API 端点 URL（可选，用于调试/文档） */
  url?: string
  /** 全局优先级（1 最高，数字越大越靠后） */
  priority?: number
}

// ── 辅助：StockQuote → RealtimeQuote（code → symbol） ──────────────────
/**
 * 将 fetcher/ 标准 StockQuote（code 字段）转换为
 * data-collector/ 层 RealtimeQuote（symbol 字段）。
 * 注：RealtimeQuote 无 prevClose / source 字段，选择性丢弃。
 */
function toRealtime(sq: StockQuote): RealtimeQuote {
  return {
    symbol: sq.code,
    name: sq.name,
    price: sq.price,
    change: sq.change,
    changePercent: sq.changePercent,
    open: sq.open,
    high: sq.high,
    low: sq.low,
    volume: sq.volume,
    amount: sq.amount,
    timestamp: sq.timestamp,
  }
}

// ── 辅助：KlineItem[] → KlineBar[] ──────────────────────────────────────
/**
 * fetcher/ KlineItem → 业务域 KlineBar。
 * 核心字段（date/open/high/low/close/volume/amount）完全一致；
 * fetcher/ 的可选字段 source 丢弃；KlineBar 的可选 turnoverRate 留空。
 */
function toKlineBars(items: KlineItem[]): KlineBar[] {
  return items.map((k) => ({
    date: k.date,
    open: k.open,
    high: k.high,
    low: k.low,
    close: k.close,
    volume: k.volume,
    amount: k.amount,
  }))
}

// ── 薄适配函数：捕获 throw → return null / [] ──────────────────────────
//
// 适配原则：
//  - fetcher/ 版 throw DirectDataAPIError → 适配层 return null（单条）/ []（批量）
//  - 类型映射：StockQuote → RealtimeQuote、KlineItem → KlineBar
//  - 网络异常 / 解析异常：同样归并为 return null/[]，保持旧语义
//  - 不重复记录日志：fetcher/ 内部已 warn，此处仅静默降级；但如异常未分类则补充 debug

/**
 * 腾讯实时行情单条（兼容旧签名：返回 RealtimeQuote | null）
 * CANONICAL 实现：fetcher/directDataAPI.ts → parseTencentQuote + qt.gtimg.cn
 */
export async function tencentQuote(code: string): Promise<RealtimeQuote | null> {
  try {
    const sq = await _tencentQuote(code)
    return toRealtime(sq)
  } catch (err) {
    logger.debug('[directDataAPI@data-collector] tencentQuote 降级为 null', {
      code,
      error: err instanceof Error ? err.message : String(err),
    })
    return null
  }
}

/**
 * 腾讯实时行情批量（适配层：split 逐段解析不依赖返回顺序，来自 fetcher/ 正确实现）
 * 修复原副本 bug：matchAll+idx 顺序敏感 → 统一为 fetcher/ 版 content-code 解析
 */
export async function tencentBatchQuotes(codes: string[]): Promise<RealtimeQuote[]> {
  try {
    const list = await _tencentBatchQuotes(codes)
    return list.map(toRealtime)
  } catch (err) {
    logger.debug('[directDataAPI@data-collector] tencentBatchQuotes 降级为 []', {
      codes: codes.length,
      error: err instanceof Error ? err.message : String(err),
    })
    return []
  }
}

/**
 * 新浪实时行情单条（字段索引：修正原副本 [8]/[9] bug → fetcher/ 版 [29]/[30]）
 */
export async function sinaQuote(code: string): Promise<RealtimeQuote | null> {
  try {
    const sq = await _sinaQuote(code)
    return toRealtime(sq)
  } catch (err) {
    logger.debug('[directDataAPI@data-collector] sinaQuote 降级为 null', {
      code,
      error: err instanceof Error ? err.message : String(err),
    })
    return null
  }
}

/**
 * 新浪实时行情批量（同样：split 逐段解析修正顺序敏感 bug）
 */
export async function sinaBatchQuotes(codes: string[]): Promise<RealtimeQuote[]> {
  try {
    const list = await _sinaBatchQuotes(codes)
    return list.map(toRealtime)
  } catch (err) {
    logger.debug('[directDataAPI@data-collector] sinaBatchQuotes 降级为 []', {
      codes: codes.length,
      error: err instanceof Error ? err.message : String(err),
    })
    return []
  }
}

/**
 * 网易历史 K 线（兼容旧签名：返回 KlineBar[]，catch 异常降级空数组）
 */
export async function neteaseHistory(
  code: string,
  startDate: string,
  endDate: string,
): Promise<KlineBar[]> {
  try {
    const items = await _neteaseHistory(code, startDate, endDate)
    return toKlineBars(items)
  } catch (err) {
    logger.debug('[directDataAPI@data-collector] neteaseHistory 降级为 []', {
      code,
      startDate,
      endDate,
      error: err instanceof Error ? err.message : String(err),
    })
    return []
  }
}

/**
 * 腾讯 K 线（兼容旧签名：(code, days = 60)）
 * 内部映射到 fetcher/ 版签名：_tencentKline(code, 'day', days)
 * 修复原副本 bug：缺少 qfqday 兜底 → 由 fetcher/ 版 qfqday ?? day 保证
 */
export async function tencentKline(code: string, days = 60): Promise<KlineBar[]> {
  try {
    const items = await _tencentKline(code, 'day', days)
    return toKlineBars(items)
  } catch (err) {
    logger.debug('[directDataAPI@data-collector] tencentKline 降级为 []', {
      code,
      days,
      error: err instanceof Error ? err.message : String(err),
    })
    return []
  }
}

// ── 适配函数：直接 re-export fetcher/ 版（签名已兼容 RealtimeQuote|StockQuote）──────
//
// quoteToStock(quote, source?) / klinesToDailyQuotes(symbol, klines, source?)
// fetcher/ 版入参已接受 RealtimeQuote | StockQuote 联合类型，
// quote 类型分发通过 resolveSymbol('symbol' in quote ? quote.symbol : quote.code) 自动处理。
// 因此无需二次包装，直接透传。
export { quoteToStock, klinesToDailyQuotes }

// ── 辅助类型：供消费者 re-export（不使用可忽略） ───────────────────────
export type { StockQuote, KlineItem } from '../fetcher/directDataAPI'
export type { Stock, DailyQuotes } from '@/data/types'
export type { KlineBar } from '@/data/types/types.marketData'
