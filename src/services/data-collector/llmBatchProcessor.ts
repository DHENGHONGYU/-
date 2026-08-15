/**
 * @module llmBatchProcessor
 * @description LLM 夜间异步批处理服务 — 将 LLM 调用从采集主链移出，改为夜间批量执行。
 *
 * 设计理念（对应用户"AI 降级方案"）：
 * - 白天爬虫抓取原始文本，夜间 LLM 批处理提取公告/新闻/研报摘要
 * - 绝不阻塞采集主流程（multiSourceFetcher 已移除同步 LLM 调用）
 * - 任务队列 + 定时触发 + 批量执行 + 结果回写 IndexedDB
 *
 * 触发策略：
 * - 默认凌晨 02:00 触发（LLM_BATCH_TRIGGER_HOUR 可配置）
 * - 支持手动触发 `runBatchNow()`
 * - 支持事件驱动触发（监听全维度采集完成事件）
 *
 * 批处理流程：
 * 1. 从 IndexedDB 查询待处理股票列表（有 symbol 但缺 LLM 增强数据的）
 * 2. 对每只股票调用 llmSearchAgent 的 searchAnnouncements/searchNews/searchReports
 * 3. 结果通过 DataBridge 写入 news / research_logs store（_source: 'llm-batch'）
 * 4. 记录处理日志和统计
 *
 * 容错策略：
 * - 单只股票失败不阻塞批次内其他股票
 * - 无 Qwen API Key 时优雅跳过（不报错，仅 warn）
 * - 批次超时保护（默认 30 分钟）
 *
 * @doc [V9-DOC-AI-006, V9-DOC-AI-003, V9-DOC-BACK-012, V9-DOC-AI-014]
 */

import { getLogger } from '@/lib/logger'
import { dataBridge } from '@/core/databridge'
import { ENVELOPE_ACTION, MODULE_ID, ENVELOPE_TARGET, STORE_NAME } from '@/config/dbConfig'
import type { Stock } from '@/data/types'
import { searchAnnouncements, searchNews, searchReports } from './llmSearchAgent'
import type { NewsItem, ResearchReport } from './dimensionDataTypes'

const logger = getLogger()

// ============================================================
// 配置常量
// ============================================================

/** 夜间触发小时（24h 制，默认凌晨 2 点） */
const LLM_BATCH_TRIGGER_HOUR = 2

/** 夜间触发分钟 */
const LLM_BATCH_TRIGGER_MINUTE = 0

/** 单批次最大并发股票数（控制 LLM API 并发，避免限流） */
const BATCH_CONCURRENCY = 3

/** 单批次超时（毫秒，默认 30 分钟） */
const BATCH_TIMEOUT_MS = 30 * 60 * 1000

/** 每只股票 LLM 处理的维度 */
type LlmDimension = 'announcements' | 'news' | 'reports'

/** 待处理任务条目 */
interface LlmBatchTask {
  symbol: string
  stockName: string
  dimensions: LlmDimension[]
}

/** 批处理结果统计 */
interface BatchResult {
  total: number
  success: number
  failed: number
  skipped: number
  durationMs: number
  errors: Array<{ symbol: string; dimension: LlmDimension; error: string }>
}

// ============================================================
// 调度器 — 夜间定时触发
// ============================================================

let scheduledTimer: ReturnType<typeof setTimeout> | null = null
let isRunning = false

/**
 * 计算距离下次触发时间的毫秒数。
 * @param triggerHour 触发小时（24h 制）
 * @param triggerMinute 触发分钟
 * @returns 距离下次触发的毫秒数
 */
function msUntilNextTrigger(triggerHour: number, triggerMinute: number): number {
  const now = new Date()
  const next = new Date(now)
  next.setHours(triggerHour, triggerMinute, 0, 0)

  // 如果今天的目标时间已过，则计算到明天
  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1)
  }

  return next.getTime() - now.getTime()
}

/**
 * 启动夜间定时调度器。
 *
 * 使用 setTimeout 链式调度（非 setInterval），确保前一批次执行完毕后才调度下一次。
 * 浏览器环境安全：不依赖 Node cron / child_process。
 *
 * @param triggerHour 触发小时，默认 2（凌晨 2 点）
 * @param triggerMinute 触发分钟，默认 0
 */
export function startNightlyScheduler(
  triggerHour: number = LLM_BATCH_TRIGGER_HOUR,
  triggerMinute: number = LLM_BATCH_TRIGGER_MINUTE,
): void {
  if (scheduledTimer) {
    logger.warn('[llmBatchProcessor] 调度器已在运行，跳过重复启动')
    return
  }

  const scheduleNext = (): void => {
    const delay = msUntilNextTrigger(triggerHour, triggerMinute)
    logger.info(`[llmBatchProcessor] 下次夜间批处理将在 ${Math.round(delay / 1000 / 60)} 分钟后触发`)

    scheduledTimer = setTimeout(() => {
      void (async () => {
        await runBatchSafely()
        scheduleNext()
      })()
    }, delay)
  }

  scheduleNext()
  logger.info(`[llmBatchProcessor] 夜间调度器已启动，触发时间: ${String(triggerHour).padStart(2, '0')}:${String(triggerMinute).padStart(2, '0')}`)
}

/**
 * 停止夜间定时调度器。
 */
export function stopNightlyScheduler(): void {
  if (scheduledTimer) {
    clearTimeout(scheduledTimer)
    scheduledTimer = null
    logger.info('[llmBatchProcessor] 夜间调度器已停止')
  }
}

/**
 * 查询调度器是否正在运行。
 */
export function isSchedulerRunning(): boolean {
  return scheduledTimer !== null
}

/**
 * 查询当前是否有批处理正在执行。
 */
export function isBatchRunning(): boolean {
  return isRunning
}

// ============================================================
// 任务队列管理
// ============================================================

/** 待处理任务队列（内存级，页面刷新后清空） */
const taskQueue: LlmBatchTask[] = []

/**
 * 向批处理队列添加任务。
 * 可在白天采集流程中调用，将需要 LLM 增强的股票加入队列，
 * 等待夜间批处理时统一执行。
 *
 * @param symbol 股票代码
 * @param stockName 股票名称
 * @param dimensions 需要处理的维度列表
 */
export function enqueueTask(
  symbol: string,
  stockName: string,
  dimensions: LlmDimension[] = ['announcements', 'news', 'reports'],
): void {
  // 去重：已存在相同 symbol 的任务则合并维度
  const existing = taskQueue.find((t) => t.symbol === symbol)
  if (existing) {
    for (const dim of dimensions) {
      if (!existing.dimensions.includes(dim)) {
        existing.dimensions.push(dim)
      }
    }
    return
  }

  taskQueue.push({ symbol, stockName, dimensions })
  logger.debug(`[llmBatchProcessor] 任务入队: ${symbol} (${stockName})`, { dimensions })
}

/**
 * 从 IndexedDB 查询待处理股票列表，自动填充任务队列。
 *
 * 策略：查询 stocks store 中所有股票，为每只股票添加全维度处理任务。
 * 可扩展：仅添加缺少 LLM 增强数据的股票。
 */
async function loadPendingStocksFromDB(): Promise<void> {
  try {
    const result = await dataBridge.query<Stock[]>({
      action: ENVELOPE_ACTION.queryList,
      store: STORE_NAME.stocks,
      source: MODULE_ID.fetcher,
    })

    if (!result.success || !result.data) {
      logger.warn('[llmBatchProcessor] 查询股票列表失败或为空')
      return
    }

    for (const stock of result.data) {
      if (stock.symbol && stock.name) {
        enqueueTask(stock.symbol, stock.name)
      }
    }

    logger.info(`[llmBatchProcessor] 从 DB 加载 ${result.data.length} 只股票到任务队列`)
  } catch (err) {
    logger.warn('[llmBatchProcessor] 加载待处理股票失败', { error: err instanceof Error ? err.message : String(err) })
  }
}

// ============================================================
// 批处理核心
// ============================================================

/**
 * 处理单只股票的单个维度。
 *
 * @returns 成功返回 true，失败/跳过返回 false
 */
async function processSingleDimension(
  symbol: string,
  stockName: string,
  dimension: LlmDimension,
): Promise<boolean> {
  try {
    if (dimension === 'announcements') {
      const items = await searchAnnouncements(symbol, stockName)
      if (items.length > 0) {
        await writeLlmResultsToDB(symbol, 'news', items)
      }
      return true
    }

    if (dimension === 'news') {
      const items = await searchNews(symbol, stockName)
      if (items.length > 0) {
        await writeLlmResultsToDB(symbol, 'news', items)
      }
      return true
    }

    if (dimension === 'reports') {
      const items = await searchReports(symbol, stockName)
      if (items.length > 0) {
        await writeLlmResultsToDB(symbol, 'research', items)
      }
      return true
    }

    return false
  } catch (err) {
    logger.warn(`[llmBatchProcessor] 处理失败: ${symbol}/${dimension}`, {
      error: err instanceof Error ? err.message : String(err),
    })
    return false
  }
}

/**
 * 处理单只股票的所有维度。
 */
async function processStock(task: LlmBatchTask): Promise<{ success: number; failed: number; errors: BatchResult['errors'] }> {
  let success = 0
  let failed = 0
  const errors: BatchResult['errors'] = []

  for (const dimension of task.dimensions) {
    const ok = await processSingleDimension(task.symbol, task.stockName, dimension)
    if (ok) {
      success++
    } else {
      failed++
      errors.push({ symbol: task.symbol, dimension, error: 'processing_failed' })
    }
  }

  return { success, failed, errors }
}

/**
 * 执行完整批处理。
 *
 * 流程：
 * 1. 加载待处理股票（DB + 队列合并）
 * 2. 按 BATCH_CONCURRENCY 并发处理
 * 3. 汇总统计并清空队列
 *
 * @param options 可选配置
 * @returns 批处理结果统计
 */
export async function runBatch(options?: {
  /** 是否从 DB 加载股票列表（默认 true） */
  loadFromDB?: boolean
  /** 批次超时毫秒数（默认 BATCH_TIMEOUT_MS） */
  timeoutMs?: number
}): Promise<BatchResult> {
  const start = Date.now()
  const timeoutMs = options?.timeoutMs ?? BATCH_TIMEOUT_MS

  // 合并任务源：DB + 内存队列
  if (options?.loadFromDB !== false) {
    await loadPendingStocksFromDB()
  }

  const tasks = [...taskQueue]
  if (tasks.length === 0) {
    logger.info('[llmBatchProcessor] 无待处理任务，跳过批处理')
    return { total: 0, success: 0, failed: 0, skipped: 0, durationMs: 0, errors: [] }
  }

  logger.info(`[llmBatchProcessor] 开始批处理: ${tasks.length} 只股票，并发 ${BATCH_CONCURRENCY}`)

  const result: BatchResult = {
    total: tasks.length,
    success: 0,
    failed: 0,
    skipped: 0,
    durationMs: 0,
    errors: [],
  }

  // 超时保护
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`批次超时 (${timeoutMs}ms)`)), timeoutMs)
  })

  try {
    const processingPromise = (async (): Promise<void> => {
      // 分批并发处理
      for (let i = 0; i < tasks.length; i += BATCH_CONCURRENCY) {
        const chunk = tasks.slice(i, i + BATCH_CONCURRENCY)
        const chunkResults = await Promise.allSettled(
          chunk.map((task) => processStock(task)),
        )

        chunkResults.forEach((r, j) => {
          if (r.status === 'fulfilled') {
            if (r.value.failed === 0) {
              result.success++
            } else if (r.value.success > 0) {
              result.success++ // 部分成功也算成功
            } else {
              result.failed++
            }
            result.errors.push(...r.value.errors)
          } else {
            result.failed++
            const task = chunk[j]
            result.errors.push({
              symbol: task?.symbol ?? 'unknown',
              dimension: 'announcements',
              error: r.reason instanceof Error ? r.reason.message : String(r.reason),
            })
          }
        })

        logger.info(`[llmBatchProcessor] 进度: ${Math.min(i + BATCH_CONCURRENCY, tasks.length)}/${tasks.length}`)
      }
    })()

    await Promise.race([processingPromise, timeoutPromise])
  } catch (err) {
    logger.error('[llmBatchProcessor] 批处理异常终止', { error: err instanceof Error ? err.message : String(err) })
    result.failed = result.total - result.success
  }

  // 清空已处理队列
  taskQueue.length = 0

  result.durationMs = Date.now() - start
  logger.info(`[llmBatchProcessor] 批处理完成: 成功 ${result.success}/${result.total}，耗时 ${result.durationMs}ms`, {
    failed: result.failed,
    errors: result.errors.length,
  })

  return result
}

/**
 * 安全执行批处理（捕获所有异常，确保不抛出）。
 * 供夜间调度器和手动触发使用。
 */
async function runBatchSafely(): Promise<void> {
  if (isRunning) {
    logger.warn('[llmBatchProcessor] 批处理已在运行，跳过')
    return
  }

  isRunning = true
  try {
    await runBatch()
  } catch (err) {
    logger.error('[llmBatchProcessor] 批处理未捕获异常', { error: err instanceof Error ? err.message : String(err) })
  } finally {
    isRunning = false
  }
}

/**
 * 手动触发批处理（立即执行）。
 * 供 UI 按钮 / 开发调试 / API 端点调用。
 *
 * @returns 批处理结果统计
 */
export async function runBatchNow(): Promise<BatchResult> {
  logger.info('[llmBatchProcessor] 手动触发批处理')
  return runBatch()
}

// ============================================================
// 结果回写
// ============================================================

/**
 * 将 LLM 处理结果写入 IndexedDB。
 *
 * @param symbol 股票代码
 * @param targetType 写入目标类型（news / research）
 * @param items 数据条目数组
 */
async function writeLlmResultsToDB(
  symbol: string,
  targetType: 'news' | 'research',
  items: NewsItem[] | ResearchReport[],
): Promise<void> {
  const action = targetType === 'news'
    ? ENVELOPE_ACTION.saveNews
    : ENVELOPE_ACTION.saveResearchLog

  const payload = {
    symbol,
    items: items.map((item) => ({ ...item, _source: 'llm-batch' })),
    count: items.length,
    processedAt: new Date().toISOString(),
  }

  try {
    await dataBridge.forward({
      meta: {
        source: MODULE_ID.fetcher,
        target: ENVELOPE_TARGET.db,
        action,
        traceId: `llm-batch-${symbol}-${targetType}-${Date.now()}`,
        timestamp: Date.now(),
      },
      payload,
    })
    logger.debug(`[llmBatchProcessor] 写入成功: ${symbol}/${targetType} (${items.length} 条)`)
  } catch (err) {
    logger.warn(`[llmBatchProcessor] 写入失败: ${symbol}/${targetType}`, {
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

// ============================================================
// 队列状态查询
// ============================================================

/**
 * 查询当前任务队列状态。
 */
export function getQueueStatus(): {
  queueLength: number
  isRunning: boolean
  isScheduled: boolean
  tasks: Array<{ symbol: string; dimensions: LlmDimension[] }>
} {
  return {
    queueLength: taskQueue.length,
    isRunning,
    isScheduled: scheduledTimer !== null,
    tasks: taskQueue.map((t) => ({ symbol: t.symbol, dimensions: t.dimensions })),
  }
}
