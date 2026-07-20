/**
 * @doc [V9-DOC-BACK-012, V9-DOC-BACK-023, V9-DOC-BACK-033, V9-DOC-BACK-021, V9-DOC-BACK-026]
 */
import { dataBridge } from '@/core/databridge'
import { EnvelopeFactory } from '@/core/envelope'
import { MODULE_ID, ENVELOPE_TARGET, ENVELOPE_ACTION, STORE_NAME } from '@/config/dbConfig'
import { INTENTION_STATUS, DEFAULT_POOL_GROUP, DEFAULT_POOL_TYPE, type ResearchStatus } from '@/constants/pool.constants'
import { INPUT_CONFIG } from '@/config/inputConfig'
import type { DataLayerResult, Stock } from '@/data/types'
import { fetchBasicDataUseCase, fetchKlineDataUseCase } from '@/services/useCase/fetcherOrchestrator.useCase'
import { getLogger } from '@/lib/logger'
import { withBroadcast } from '@/lib/withBroadcast'
import { EVENT_NAMES } from '@/constants/store-channels.constants'
import { searchFullMarket } from '@/services/stock/FullMarketStockService'

import { nanoid } from 'nanoid'

const logger = getLogger()
export interface AddStockInput {
  symbol: string
  name: string
}

/** 股票搜索结果（基于用户已导入的真实股票，非 Mock 数据） */
export interface StockSearchResult {
  symbol: string
  name: string
  /** 行业标签（取自 Stock.industryText 或 industryCode） */
  industry: string
}

export interface PoolExportPayload {
  version: 'v9-pool-export-1'
  exportedAt: number
  stocks: Stock[]
}

export interface PoolImportResult {
  success: number
  failed: number
  errors: string[]
}

function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase()
}

export interface AddStockOptions {
  /**
   * 是否在录入成功后立即拉取 AKShare 基础数据
   */
  fetchBasicAfterAdd?: boolean
  /**
   * 是否在录入成功后立即拉取 AKShare K线数据
   */
  fetchKlineAfterAdd?: boolean
  /**
   * 目标股票池分组，未指定时使用默认分组
   */
  group?: string
}

// ============================================================
// 阶段 C-1：in-memory 互斥锁（addStock 并发竞态防护）
// ============================================================
/** 同一进程内 addStock 的 in-flight 集合；防止两个并发批次同时通过存在性检查 */
const addStockInFlight = new Set<string>()

/**
 * 添加候选股票到意向候选池，并在需要时触发基础数据采集
 *
 * 通过 DataBridge.forward() 写入，确保 ACL 校验与审计日志。
 *
 * 阶段 C-1 增强：
 * - 进程内同 symbol 并发 addStock 用 `addStockInFlight` Set 互斥
 * - 避免「A 读不存在 + B 读不存在 → 双方同时 forward insertStock」竞态
 * - 跨进程/跨 Tab 互斥由 IDB 主键冲突兜底（dataVersion 仍=1，下次 update 会覆盖）
/**
 * 按 options 拉取基础数据并合并到 stock；未开启或失败时返回 warning 但不中断主流程。
 */
async function fetchBasicIfNeeded(
  stock: Stock,
  options: AddStockOptions,
): Promise<{ stock: Stock; warning?: string }> {
  // 默认自动采集基础数据，除非显式设为 false
  if (options.fetchBasicAfterAdd === false) return { stock }
  logger.info('[inputService] 拉取基础数据', { symbol: stock.symbol })
  const fetchResult = await fetchBasicDataUseCase({ symbol: stock.symbol })
  if (fetchResult.success && fetchResult.data) {
    logger.info('[inputService] 基础数据拉取成功', { symbol: stock.symbol })
    return { stock: { ...fetchResult.data, group: stock.group } }
  }
  logger.warn('[inputService] 基础数据拉取失败', { symbol: stock.symbol, error: fetchResult.error })
  return { stock, warning: fetchResult.error ?? '未知错误' }
}

/**
 * 按 options 拉取 K 线数据并合并到 stock；未开启或失败时返回 warning 但不中断主流程。
 */
async function fetchKlineIfNeeded(
  stock: Stock,
  options: AddStockOptions,
): Promise<{ stock: Stock; warning?: string }> {
  if (!options.fetchKlineAfterAdd) return { stock }
  logger.info('[inputService] 拉取 K线数据', { symbol: stock.symbol })
  const klineResult = await fetchKlineDataUseCase({ symbol: stock.symbol })
  if (klineResult.success && klineResult.data) {
    logger.info('[inputService] K线数据拉取成功', { symbol: stock.symbol })
    return { stock: { ...klineResult.data, group: stock.group } }
  }
  logger.warn('[inputService] K线数据拉取失败', { symbol: stock.symbol, error: klineResult.error })
  return { stock, warning: klineResult.error ?? '未知错误' }
}

/**
 * 添加股票到股票池：规范化 symbol + 名称，获取 K 线数据，写入 dataLayer。
 * @param input 添加股票的输入（symbol, name 等）
 * @param options 可选配置项
 * @returns 添加结果，包含 Stock 数据
 */
export async function addStock(
  input: AddStockInput,
  options: AddStockOptions = {},
): Promise<DataLayerResult<Stock>> {
  const symbol = normalizeSymbol(input.symbol)
  const name = input.name.trim()

  logger.info('[inputService] addStock 开始', { symbol, name, options })

  if (!symbol) {
    logger.warn('[inputService] addStock 失败：股票代码为空', { input })
    return { success: false, error: '股票代码不能为空' }
  }
  if (!name) {
    logger.warn('[inputService] addStock 失败：股票名称为空', { input })
    return { success: false, error: '股票名称不能为空' }
  }

  // 阶段 C-1：进程内同 symbol 互斥（防并发读+写竞态）
  if (addStockInFlight.has(symbol)) {
    logger.warn('[inputService] addStock 拒绝并发: 已有 in-flight 调用', { symbol })
    return { success: false, error: `股票 ${symbol} 正在导入中，请稍后重试` }
  }
  addStockInFlight.add(symbol)

  let stock: Stock = {
    symbol,
    name,
    pool: DEFAULT_POOL_TYPE,
    researchStatus: INTENTION_STATUS.screening,
    source: 'manual',
    group: options.group ?? DEFAULT_POOL_GROUP,
    dataVersion: 1,
    ingestedAt: Date.now(),
    updatedAt: Date.now(),
  }

  const envelope = EnvelopeFactory.create(
    {
      source: MODULE_ID.pool,
      target: ENVELOPE_TARGET.db,
      action: ENVELOPE_ACTION.insertStock,
      traceId: `input-${nanoid(8)}-${symbol}`,
    },
    stock,
  )

  logger.debug('[inputService] 构建 Envelope', { traceId: envelope.meta.traceId, action: envelope.meta.action })

  try {
    logger.info('[inputService] 写入数据库', { symbol, envelopeAction: ENVELOPE_ACTION.insertStock })
    await dataBridge.forward(envelope)
    logger.info('[inputService] 数据库写入成功', { symbol })

    // 广播 POOL_CHANGED 事件，通知各池模块刷新
    await withBroadcast(EVENT_NAMES.POOL_CHANGED, {
      action: 'add',
      pool: stock.pool,
      symbol,
    })

    // 自动流转到研究池（意向池 → 研究池，通过 updateStock 更新 pool 字段）
    if (stock.pool === 'intention') {
      try {
        const transitionEnvelope = EnvelopeFactory.create(
          {
            source: MODULE_ID.pool,
            target: ENVELOPE_TARGET.db,
            action: ENVELOPE_ACTION.updateStock,
            traceId: `input-intention-to-research-${nanoid(8)}-${symbol}`,
          },
          {
            symbol,
            pool: 'research' as Stock['pool'],
            researchStatus: 'candidate' as Stock['researchStatus'],
          },
        )
        await dataBridge.forward(transitionEnvelope)
        await withBroadcast(EVENT_NAMES.POOL_CHANGED, { action: 'transition', pool: 'research', symbol })
        logger.info('[inputService] 自动流转到研究池成功', { symbol })
      } catch (researchErr) {
        logger.warn('[inputService] 自动流转到研究池失败（不影响意向池录入）', {
          symbol,
          error: researchErr instanceof Error ? researchErr.message : String(researchErr),
        })
      }
    }

    const basic = await fetchBasicIfNeeded(stock, options)
    stock = basic.stock
    if (basic.warning) {
      return {
        success: true,
        data: stock,
        error: `录入成功，但基础数据拉取失败：${basic.warning}`,
      }
    }

    const kline = await fetchKlineIfNeeded(stock, options)
    stock = kline.stock
    if (kline.warning) {
      return {
        success: true,
        data: stock,
        error: `录入成功，但 K线数据拉取失败：${kline.warning}`,
      }
    }

    logger.info('[inputService] addStock 完成', { symbol, name, group: stock.group })
    return { success: true, data: stock }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  } finally {
    // 阶段 C-1：无论成功失败，释放 in-flight 锁
    addStockInFlight.delete(symbol)
  }
}

/**
 * 从搜索结果录入股票
 */
export async function addStockFromSearch(
  result: StockSearchResult,
  options: AddStockOptions = {},
): Promise<DataLayerResult<Stock>> {
  return addStock({ symbol: result.symbol, name: result.name }, options)
}

/**
 * 搜索股票（A+H 股全市场）
 *
 * 搜索策略（双层冗余）：
 *   Layer 1（主方案）：本地静态字典匹配（A+H 股 ~5000 只，离线可用，<1ms）
 *   Layer 2（回退）  ：腾讯 Smartbox API 在线搜索（网络补充）
 *
 * 本地字典已导入的标的优先展示，并标记"已导入"。
 */
export async function searchStocks(query: string): Promise<StockSearchResult[]> {
  const trimmed = query.trim()
  if (trimmed.length < INPUT_CONFIG.search.minQueryLength) {
    return []
  }

  // 获取用户已导入的股票代码集合（用于排序和标记）
  let existingSymbols = new Set<string>()
  try {
    const result = await dataBridge.query<Stock[]>({
      action: ENVELOPE_ACTION.queryList,
      store: STORE_NAME.stocks,
    })
    if (result.success && result.data) {
      existingSymbols = new Set(result.data.map((s) => s.symbol))
    }
  } catch {
    // 本地查询失败不影响主搜索流程
  }

  try {
    const matches = await searchFullMarket(trimmed, existingSymbols, INPUT_CONFIG.search.maxResults)

    const result = matches.map((m) => ({
      symbol: m.symbol,
      name: m.name,
      industry: m.market, // market 字段标记市场（SH/SZ/HK）
    }))

    logger.info('[inputService] searchStocks（全市场）', {
      query: trimmed,
      hitCount: result.length,
      dictHits: matches.filter((m) => m.source === 'dict').length,
      apiHits: matches.filter((m) => m.source === 'smartbox').length,
    })

    return result
  } catch (err) {
    logger.warn('[inputService] searchStocks: 搜索异常', {
      error: err instanceof Error ? err.message : String(err),
      query: trimmed,
    })
    return []
  }
}

/**
 * 导出意向候选池（全部或按状态过滤）
 */
export async function exportPool(
  status?: ResearchStatus,
): Promise<DataLayerResult<PoolExportPayload>> {
  try {
    const listResult = status
      ? await dataBridge.query<Stock[]>({
          action: ENVELOPE_ACTION.queryByIndex,
          store: STORE_NAME.stocks,
          indexName: 'by-status',
          indexValue: status,
          source: MODULE_ID.pool,
        })
      : await dataBridge.query<Stock[]>({
          action: ENVELOPE_ACTION.queryList,
          store: STORE_NAME.stocks,
          source: MODULE_ID.pool,
        })
    if (!listResult.success) {
      return { success: false, error: listResult.error }
    }
    const list = listResult.data ?? []
    return {
      success: true,
      data: {
        version: 'v9-pool-export-1',
        exportedAt: Date.now(),
        stocks: list,
      },
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * 导入意向候选池
 *
 * 通过 DataBridge.forward() 逐条写入，避免 UI 层直接操作 dataLayer。
 */
export async function importPool(payload: PoolExportPayload): Promise<DataLayerResult<PoolImportResult>> {
  if (payload.version !== 'v9-pool-export-1') {
    return { success: false, error: '不兼容的导出文件版本' }
  }

  const result: PoolImportResult = { success: 0, failed: 0, errors: [] }

  const processOne = async (stock: PoolExportPayload['stocks'][number]) => {
    const normalized = normalizeSymbol(stock.symbol)
    const existingResult = await dataBridge.query<Stock>({
      action: ENVELOPE_ACTION.queryGet,
      store: STORE_NAME.stocks,
      key: normalized,
      source: MODULE_ID.pool,
    })
    if (existingResult.success && existingResult.data) return { ok: false, normalized }
    const envelope = EnvelopeFactory.create(
      {
        source: MODULE_ID.pool,
        target: ENVELOPE_TARGET.db,
        action: ENVELOPE_ACTION.insertStock,
        traceId: `import-${nanoid(8)}-${normalized}`,
      },
      {
        ...stock,
        symbol: normalized,
        pool: stock.pool ?? DEFAULT_POOL_TYPE,
        researchStatus: stock.researchStatus ?? INTENTION_STATUS.screening,
        source: stock.source ?? 'import',
        group: stock.group ?? DEFAULT_POOL_GROUP,
        dataVersion: 1,
        ingestedAt: Date.now(),
        updatedAt: Date.now(),
      },
    )
    await dataBridge.forward(envelope)
    return { ok: true, normalized }
  }

  for (const stock of payload.stocks) {
    try {
      const r = await processOne(stock)
      applyImportOutcome(result, r)
    } catch (err) {
      result.failed++
      result.errors.push(`${stock.symbol}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return { success: true, data: result }
}

/** 将单条导入结果归入汇总（已存在 → failed，否则 → success） */
function applyImportOutcome(
  result: PoolImportResult,
  r: { ok: boolean; normalized: string },
): void {
  if (r.ok) {
    result.success++
    return
  }
  result.failed++
  result.errors.push(`${r.normalized}: 已存在`)
}

/**
 * @deprecated 使用带 options 的 addStock 替代
 */
export async function _legacyAddStock(input: AddStockInput): Promise<DataLayerResult<Stock>> {
  return addStock(input, { fetchBasicAfterAdd: false })
}

/**
 * 获取全部股票列表
 */
export async function listStocks(): Promise<DataLayerResult<Stock[]>> {
  try {
    const result = await dataBridge.query<Stock[]>({
      action: ENVELOPE_ACTION.queryList,
      store: STORE_NAME.stocks,
      source: MODULE_ID.pool,
    })
    if (!result.success) {
      return { success: false, error: result.error }
    }
    return { success: true, data: result.data ?? [] }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * 按研究状态获取股票列表
 */
export async function listStocksByStatus(status: ResearchStatus): Promise<DataLayerResult<Stock[]>> {
  try {
    const result = await dataBridge.query<Stock[]>({
      action: ENVELOPE_ACTION.queryByIndex,
      store: STORE_NAME.stocks,
      indexName: 'by-status',
      indexValue: status,
      source: MODULE_ID.pool,
    })
    if (!result.success) {
      return { success: false, error: result.error }
    }
    return { success: true, data: result.data ?? [] }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
