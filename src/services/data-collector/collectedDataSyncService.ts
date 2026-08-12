/**
 * @fileoverview 采集资料本地同步服务
 *
 * 在批量采集任务完成后，将 IndexedDB 中各股票对应的各维度资料
 * 同步导出到本地文件夹，便于离线查阅与归档。
 *
 * 目录结构：
 *   outputs/collected-data/{batchId}_{timestamp}/
 *     ├── _batch_metadata.json       批量任务元数据
 *     ├── _summary.md               汇总报告（Markdown）
 *     └── {symbol}/
 *         ├── _metadata.json         股票级元数据
 *         ├── 01_基本信息/
 *         │   └── stock.json
 *         ├── 02_K线数据/
 *         │   ├── daily_quotes.json
 *         │   └── daily_quotes.csv
 *         ├── 03_筹码分布/
 *         │   └── chip_data.json
 *         ├── 04_重大事项/
 *         │   └── news.json
 *         ├── 05_热点新闻/
 *         │   └── news.json
 *         ├── 06_行业竞品/
 *         │   └── sector_scores.json
 *         ├── 07_关联指数/
 *         │   └── sector_scores.json
 *         ├── 08_研报中心/
 *         │   └── research_logs.json
 *         └── 09_财务数据/
 *             └── financial_reports.json
 *
 * 两种运行环境：
 *   1. Electron 主进程环境：调用 window.fileSync IPC 写入真实文件系统
 *   2. 纯浏览器环境：打包为 ZIP Blob 触发浏览器下载
 *
 * @module services/data-collector/collectedDataSyncService
 * @doc [V9-DOC-BACK-012, V9-DOC-BACK-023]
 */

import { getLogger } from '@/lib/logger'
import { STORE_NAME } from '@/config/dbConfig'
import { queryList, queryByIndex, queryGet } from '@/core/databridgeQueries'
import { DEFAULT_DIMENSIONS } from '@/config/collectConfig'
import type { CollectionConfig } from '@/types/modules/collection.types'
import type { TraceResult } from './collectionPipeline'

const logger = getLogger()

// ============================================================
// 类型定义
// ============================================================

/** 同步结果 */
export interface SyncResult {
  success: boolean
  batchDir?: string
  fileCount: number
  symbolCount: number
  error?: string
  files?: string[]
}

/** 批量元数据 */
export interface BatchMetadata {
  batchId: string
  parentTaskId?: string
  startedAt: number
  completedAt: number
  symbols: string[]
  dimensions: string[]
  totalTraces: number
  successTraces: number
  failedTraces: number
  configSnapshot?: CollectionConfig
  exportedAt: number
  version: '1.0.0'
}

/** 股票级元数据 */
export interface SymbolMetadata {
  symbol: string
  name?: string
  industry?: string
  dimensions: string[]
  traces: Array<{
    dimensionCode: string
    success: boolean
    source?: string
    latencyMs: number
    error?: string
  }>
  exportedAt: number
}

/** 维度 → store 映射 */
const DIMENSION_STORE_MAP: Readonly<Record<string, { store: typeof STORE_NAME[keyof typeof STORE_NAME]; label: string }>> = {
  '01': { store: STORE_NAME.stocks, label: '基本信息' },
  '02': { store: STORE_NAME.dailyQuotes, label: 'K线数据' },
  '03': { store: STORE_NAME.news, label: '筹码分布' },
  '04': { store: STORE_NAME.news, label: '重大事项' },
  '05': { store: STORE_NAME.news, label: '热点新闻' },
  '06': { store: STORE_NAME.sectorScores, label: '行业竞品' },
  '07': { store: STORE_NAME.sectorScores, label: '关联指数' },
  '08': { store: STORE_NAME.researchLogs, label: '研报中心' },
  '09': { store: STORE_NAME.financialReports, label: '财务数据' },
}

/** 基础输出根目录 */
const OUTPUT_ROOT = 'outputs/collected-data'

// ============================================================
// 数据读取层：按 symbol 从各 store 拉取数据
// ============================================================

/**
 * 读取股票基本信息（01 维度）。
 */
async function readStockInfo(symbol: string): Promise<Record<string, unknown> | null> {
  logger.info('[collectedDataSync] readStockInfo 开始', { symbol, store: STORE_NAME.stocks })
  const data = await queryGet<Record<string, unknown>>(STORE_NAME.stocks, symbol)
  if (!data) {
    logger.warn('[collectedDataSync] readStockInfo: 股票基本信息为空', { symbol })
  } else {
    logger.info('[collectedDataSync] readStockInfo 成功', {
      symbol,
      name: data['name'] ?? 'N/A',
      industry: data['industry'] ?? 'N/A',
    })
  }
  return data ?? null
}

/**
 * 读取 K 线日线数据（02 维度），按 symbol 索引过滤。
 */
async function readDailyQuotes(symbol: string): Promise<Record<string, unknown>[]> {
  logger.info('[collectedDataSync] readDailyQuotes 开始', { symbol, store: STORE_NAME.dailyQuotes })
  try {
    const result = await queryByIndex<Record<string, unknown>>(STORE_NAME.dailyQuotes, 'symbol', symbol)
    logger.info('[collectedDataSync] readDailyQuotes 索引查询成功', { symbol, count: result.length })
    return result
  } catch (err) {
    logger.warn('[collectedDataSync] readDailyQuotes 索引查询失败，回退全量过滤', {
      symbol,
      error: err instanceof Error ? err.message : String(err),
    })
    // 索引不存在时回退到全量过滤
    const all = await queryList<Record<string, unknown>>(STORE_NAME.dailyQuotes)
    const filtered = all.filter((r) => r['symbol'] === symbol)
    logger.info('[collectedDataSync] readDailyQuotes 全量过滤完成', {
      symbol,
      totalRecords: all.length,
      filteredCount: filtered.length,
    })
    return filtered
  }
}

/**
 * 读取 news 表中指定 symbol、指定维度类别的新闻。
 * dimensionCode: '03'=筹码, '04'=重大事项, '05'=热点新闻
 */
async function readNewsByDimension(
  symbol: string,
  dimensionCode: string,
): Promise<Record<string, unknown>[]> {
  logger.info('[collectedDataSync] readNewsByDimension 开始', { symbol, dimensionCode, store: STORE_NAME.news })
  const all = await queryList<Record<string, unknown>>(STORE_NAME.news)
  logger.info('[collectedDataSync] readNewsByDimension 全量加载', { symbol, dimensionCode, totalNews: all.length })
  const filtered = all.filter((r) => {
    const symMatch = r['symbol'] === symbol || (Array.isArray(r['symbols']) && r['symbols'].includes(symbol))
    const catMatch = !r['dimensionCode'] || r['dimensionCode'] === dimensionCode
    return symMatch && catMatch
  })
  logger.info('[collectedDataSync] readNewsByDimension 过滤完成', {
    symbol,
    dimensionCode,
    matchedCount: filtered.length,
  })
  return filtered
}

/**
 * 读取行业/指数评分（06/07 维度）。
 */
async function readSectorScores(symbol: string): Promise<Record<string, unknown>[]> {
  logger.info('[collectedDataSync] readSectorScores 开始', { symbol, store: STORE_NAME.sectorScores })
  try {
    const result = await queryByIndex<Record<string, unknown>>(STORE_NAME.sectorScores, 'symbol', symbol)
    logger.info('[collectedDataSync] readSectorScores 索引查询成功', { symbol, count: result.length })
    return result
  } catch (err) {
    logger.warn('[collectedDataSync] readSectorScores 索引查询失败，回退全量过滤', {
      symbol,
      error: err instanceof Error ? err.message : String(err),
    })
    const all = await queryList<Record<string, unknown>>(STORE_NAME.sectorScores)
    const filtered = all.filter((r) => r['symbol'] === symbol)
    logger.info('[collectedDataSync] readSectorScores 全量过滤完成', {
      symbol,
      totalRecords: all.length,
      filteredCount: filtered.length,
    })
    return filtered
  }
}

/**
 * 读取研报日志（08 维度）。
 */
async function readResearchLogs(symbol: string): Promise<Record<string, unknown>[]> {
  logger.info('[collectedDataSync] readResearchLogs 开始', { symbol, store: STORE_NAME.researchLogs })
  try {
    const result = await queryByIndex<Record<string, unknown>>(STORE_NAME.researchLogs, 'symbol', symbol)
    logger.info('[collectedDataSync] readResearchLogs 索引查询成功', { symbol, count: result.length })
    return result
  } catch (err) {
    logger.warn('[collectedDataSync] readResearchLogs 索引查询失败，回退全量过滤', {
      symbol,
      error: err instanceof Error ? err.message : String(err),
    })
    const all = await queryList<Record<string, unknown>>(STORE_NAME.researchLogs)
    const filtered = all.filter((r) => r['symbol'] === symbol)
    logger.info('[collectedDataSync] readResearchLogs 全量过滤完成', {
      symbol,
      totalRecords: all.length,
      filteredCount: filtered.length,
    })
    return filtered
  }
}

/**
 * 读取财务报告（09 维度）。
 */
async function readFinancialReports(symbol: string): Promise<Record<string, unknown>[]> {
  logger.info('[collectedDataSync] readFinancialReports 开始', { symbol, store: STORE_NAME.financialReports })
  try {
    const result = await queryByIndex<Record<string, unknown>>(STORE_NAME.financialReports, 'symbol', symbol)
    logger.info('[collectedDataSync] readFinancialReports 索引查询成功', { symbol, count: result.length })
    return result
  } catch (err) {
    logger.warn('[collectedDataSync] readFinancialReports 索引查询失败，回退全量过滤', {
      symbol,
      error: err instanceof Error ? err.message : String(err),
    })
    const all = await queryList<Record<string, unknown>>(STORE_NAME.financialReports)
    const filtered = all.filter((r) => r['symbol'] === symbol)
    logger.info('[collectedDataSync] readFinancialReports 全量过滤完成', {
      symbol,
      totalRecords: all.length,
      filteredCount: filtered.length,
    })
    return filtered
  }
}

// ============================================================
// 数据序列化辅助
// ============================================================

/** 序列化为格式化 JSON 字符串 */
function toJson(data: unknown): string {
  return JSON.stringify(data, null, 2)
}

/**
 * 将对象数组序列化为 CSV（适用于 K 线等表格数据）。
 *
 * 安全特性：
 * - CSV 公式注入防护：以 =/+/-/@ 开头的单元格前置单引号（'）
 *   避免 Excel/WPS 当作公式执行（HYPERLINK、CMD 执行等攻击向量）
 * - 字段不一致检测：后续行字段多于表头时 warn，避免静默丢数据
 */
function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return ''
  const firstRow = rows[0] as Record<string, unknown>
  const headers = Object.keys(firstRow)
  const DANGEROUS_PREFIX = /^[=+\-@]/
  const escape = (val: unknown): string => {
    if (val == null) return ''
    let str: string
    if (typeof val === 'object') {
      str = JSON.stringify(val)
    } else {
      // eslint-disable-next-line @typescript-eslint/no-base-to-string -- val is narrowed to non-object primitive
      str = String(val)
    }
    // CSV 公式注入防护：危险前缀前置单引号
    if (DANGEROUS_PREFIX.test(str)) {
      str = `'${str}`
    }
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }
  const lines = [headers.join(',')]
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] as Record<string, unknown>
    const extraKeys = Object.keys(row).filter((k) => !headers.includes(k))
    if (extraKeys.length > 0) {
      logger.warn('[collectedDataSync] toCsv: 当前行字段与表头不一致，多余字段将被丢弃', {
        rowIndex: i,
        headers,
        extraKeys,
      })
    }
    lines.push(headers.map((h) => escape(row[h])).join(','))
  }
  return lines.join('\n')
}

/** 生成带前导零的维度目录名 */
function dimensionDir(code: string): string {
  const meta = DIMENSION_STORE_MAP[code]
  const label = meta?.label ?? '未知维度'
  return `${code}_${label}`
}

/** 构建批量目录名 */
function buildBatchDirName(batchId: string, timestamp: number): string {
  const d = new Date(timestamp)
  const pad = (n: number) => String(n).padStart(2, '0')
  const ts = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  return `${batchId}_${ts}`
}

// ============================================================
// 数据组装：收集单个 symbol 的全部维度文件
// ============================================================

export interface SymbolFileBundle {
  relativePath: string
  content: string
}

/**
 * 收集指定 symbol 的所有维度数据文件。
 * @returns 相对路径 → 文件内容的数组
 */
export async function collectSymbolFiles(
  symbol: string,
  enabledDimensions: string[],
  traces: TraceResult[],
): Promise<{ files: SymbolFileBundle[]; metadata: SymbolMetadata }> {
  const files: SymbolFileBundle[] = []
  const symTraces = traces.filter((t) => t.symbol === symbol)
  const basicInfo = await readStockInfo(symbol)

  logger.info('[collectedDataSync] collectSymbolFiles 开始', {
    symbol,
    dimensionCount: enabledDimensions.length,
    traceCount: symTraces.length,
    hasBasicInfo: !!basicInfo,
  })

  // 维度级数据
  for (const dimCode of enabledDimensions) {
    const dir = dimensionDir(dimCode)
    switch (dimCode) {
      case '01': {
        if (basicInfo) {
          files.push({
            relativePath: `${symbol}/${dir}/stock.json`,
            content: toJson(basicInfo),
          })
          logger.info('[collectedDataSync] 维度 01 基本信息文件已生成', { symbol })
        } else {
          logger.warn('[collectedDataSync] 维度 01 基本信息为空，跳过文件生成', { symbol })
        }
        break
      }
      case '02': {
        const quotes = await readDailyQuotes(symbol)
        if (quotes.length > 0) {
          files.push({
            relativePath: `${symbol}/${dir}/daily_quotes.json`,
            content: toJson(quotes),
          })
          files.push({
            relativePath: `${symbol}/${dir}/daily_quotes.csv`,
            content: toCsv(quotes),
          })
          logger.info('[collectedDataSync] 维度 02 K线数据文件已生成', { symbol, recordCount: quotes.length })
        } else {
          logger.warn('[collectedDataSync] 维度 02 K线数据为空，跳过文件生成', { symbol })
        }
        break
      }
      case '03':
      case '04':
      case '05': {
        const news = await readNewsByDimension(symbol, dimCode)
        if (news.length > 0) {
          files.push({
            relativePath: `${symbol}/${dir}/news.json`,
            content: toJson(news),
          })
          logger.info(`[collectedDataSync] 维度 ${dimCode} 新闻文件已生成`, {
            symbol,
            dimCode,
            newsCount: news.length,
          })
        } else {
          logger.info(`[collectedDataSync] 维度 ${dimCode} 新闻为空，跳过文件生成`, { symbol, dimCode })
        }
        break
      }
      case '06':
      case '07': {
        const scores = await readSectorScores(symbol)
        const filtered = scores.filter((s) => !s['dimensionCode'] || s['dimensionCode'] === dimCode)
        const data = filtered.length > 0 ? filtered : scores
        if (data.length > 0) {
          files.push({
            relativePath: `${symbol}/${dir}/sector_scores.json`,
            content: toJson(data),
          })
          logger.info(`[collectedDataSync] 维度 ${dimCode} 行业评分文件已生成`, {
            symbol,
            dimCode,
            recordCount: data.length,
          })
        } else {
          logger.info(`[collectedDataSync] 维度 ${dimCode} 行业评分为空，跳过文件生成`, { symbol, dimCode })
        }
        break
      }
      case '08': {
        const logs = await readResearchLogs(symbol)
        if (logs.length > 0) {
          files.push({
            relativePath: `${symbol}/${dir}/research_logs.json`,
            content: toJson(logs),
          })
          logger.info('[collectedDataSync] 维度 08 研报日志文件已生成', {
            symbol,
            recordCount: logs.length,
          })
        } else {
          logger.warn('[collectedDataSync] 维度 08 研报日志为空，跳过文件生成', { symbol })
        }
        break
      }
      case '09': {
        const reports = await readFinancialReports(symbol)
        if (reports.length > 0) {
          files.push({
            relativePath: `${symbol}/${dir}/financial_reports.json`,
            content: toJson(reports),
          })
          logger.info('[collectedDataSync] 维度 09 财务数据文件已生成', {
            symbol,
            recordCount: reports.length,
          })
        } else {
          logger.warn('[collectedDataSync] 维度 09 财务数据为空，跳过文件生成', { symbol })
        }
        break
      }
      default:
        logger.debug(`[collectedDataSync] 跳过未实现的维度: ${dimCode}`)
    }
  }

  // 股票级 metadata
  const metadata: SymbolMetadata = {
    symbol,
    name: basicInfo?.['name'] as string | undefined,
    industry: basicInfo?.['industry'] as string | undefined,
    dimensions: enabledDimensions,
    traces: symTraces.map((t) => ({
      dimensionCode: t.dimensionCode,
      success: t.success,
      source: t.source,
      latencyMs: t.latency,
      error: t.error,
    })),
    exportedAt: Date.now(),
  }
  files.push({
    relativePath: `${symbol}/_metadata.json`,
    content: toJson(metadata),
  })

  logger.info('[collectedDataSync] collectSymbolFiles 完成', {
    symbol,
    totalFiles: files.length,
    dimensionsCollected: files.filter((f) => !f.relativePath.endsWith('_metadata.json')).length,
  })

  return { files, metadata }
}

/**
 * 生成批量汇总报告（Markdown）。
 */
export function buildSummaryMarkdown(
  batchMeta: BatchMetadata,
  symbolMetadatas: SymbolMetadata[],
): string {
  const lines: string[] = []
  lines.push(`# 批量采集资料汇总 — ${batchMeta.batchId}`)
  lines.push('')
  lines.push(`- **导出时间**: ${new Date(batchMeta.exportedAt).toLocaleString('zh-CN')}`)
  lines.push(`- **股票数量**: ${batchMeta.symbols.length}`)
  lines.push(`- **采集维度**: ${batchMeta.dimensions.length} (${batchMeta.dimensions.join(', ')})`)
  lines.push(`- **总采集链路**: ${batchMeta.totalTraces} 条`)
  lines.push(`  - 成功: ${batchMeta.successTraces} 条`)
  lines.push(`  - 失败: ${batchMeta.failedTraces} 条`)
  lines.push(`- **成功率**: ${batchMeta.totalTraces > 0
    ? Math.round((batchMeta.successTraces / batchMeta.totalTraces) * 100)
    : 0}%`)
  lines.push('')
  lines.push('## 各股票采集明细')
  lines.push('')
  lines.push('| 代码 | 名称 | 已采集维度 | 成功链路 | 失败链路 | 状态 |')
  lines.push('|------|------|----------|---------|---------|------|')
  for (const m of symbolMetadatas) {
    const ok = m.traces.filter((t) => t.success).length
    const fail = m.traces.filter((t) => !t.success).length
    const status = fail === 0 ? '✅ 全部成功' : '⚠️ 部分失败'
    lines.push(`| ${m.symbol} | ${m.name ?? '-'} | ${m.dimensions.join('/')} | ${ok} | ${fail} | ${status} |`)
  }
  lines.push('')
  lines.push('## 失败链路详情')
  lines.push('')
  const failures: string[] = []
  for (const m of symbolMetadatas) {
    for (const t of m.traces) {
      if (!t.success) {
        const dimLabel = DIMENSION_STORE_MAP[t.dimensionCode]?.label ?? t.dimensionCode
        failures.push(`- **${m.symbol}** [${dimLabel}]: ${t.error ?? '未知错误'}`)
      }
    }
  }
  if (failures.length === 0) {
    lines.push('_无失败记录_')
  } else {
    lines.push(...failures)
  }
  lines.push('')
  return lines.join('\n')
}

// ============================================================
// 环境探测与写入抽象层
// ============================================================

/** Electron preload 暴露的文件同步 API（window.fileSync） */
interface ElectronFileSyncAPI {
  writeFiles: (params: {
    rootDir: string
    files: Array<{ relativePath: string; content: string }>
  }) => Promise<{ success: boolean; rootDir: string; writtenCount: number; error?: string }>
}

declare global {
  interface Window {
    fileSync?: ElectronFileSyncAPI
  }
}

/** 检测是否运行在 Electron 环境（暴露了 fileSync IPC） */
export function hasElectronFs(): boolean {
  return typeof window !== 'undefined' && !!window.fileSync
}

/**
 * 浏览器端触发下载（打包为 ZIP 或 单 JSON，ZIP 库可选时才用）。
 * 为避免引入新依赖，这里采用：多个文件打包为一个 tar-like JSON。
 */
function triggerBrowserDownload(files: SymbolFileBundle[], batchDir: string): SyncResult {
  try {
    const tarBundle: Record<string, string> = {}
    for (const f of files) tarBundle[f.relativePath] = f.content

    const json = toJson({
      _format: 'finsight-collected-bundle-v1',
      _batchDir: batchDir,
      _createdAt: new Date().toISOString(),
      files: tarBundle,
    })

    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${batchDir}.bundle.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    logger.info('[collectedDataSync] 浏览器下载触发成功', {
      fileCount: files.length,
      download: a.download,
    })

    return {
      success: true,
      fileCount: files.length,
      symbolCount: new Set(files.map((f) => f.relativePath.split('/')[0])).size,
      files: files.map((f) => f.relativePath),
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    logger.error('[collectedDataSync] 浏览器下载失败', { error: msg })
    return { success: false, fileCount: 0, symbolCount: 0, error: msg }
  }
}

// ============================================================
// 主入口：批量资料同步
// ============================================================

export interface SyncOptions {
  /** 自定义输出根目录（仅 Electron 环境生效） */
  outputRoot?: string
  /** 是否生成 Markdown 汇总报告 */
  includeSummary?: boolean
  /** 批量任务父 ID */
  parentTaskId?: string
  /** 采集配置快照 */
  configSnapshot?: CollectionConfig
}

/**
 * 同步批量采集结果到本地文件夹。
 *
 * @param symbols 本次采集的股票代码列表
 * @param enabledDimensionCodes 启用的维度代码列表
 * @param traceResults collectionPipeline 返回的所有链路结果
 * @param options 同步选项
 */
export async function syncCollectedDataToLocal(
  symbols: string[],
  enabledDimensionCodes: string[],
  traceResults: TraceResult[],
  options: SyncOptions = {},
): Promise<SyncResult> {
  const startedAt = Date.now()
  const {
    outputRoot = OUTPUT_ROOT,
    includeSummary = true,
    parentTaskId,
    configSnapshot,
  } = options

  logger.info('[collectedDataSync] 开始同步采集资料到本地', {
    symbolCount: symbols.length,
    dimensionCount: enabledDimensionCodes.length,
    traceCount: traceResults.length,
  })

  try {
    // 生成批次标识
    const batchId = parentTaskId ?? `sync-${Date.now()}`
    const batchDirName = buildBatchDirName(batchId, startedAt)

    const allFiles: SymbolFileBundle[] = []
    const symbolMetadatas: SymbolMetadata[] = []

    // 按股票收集文件
    for (const symbol of symbols) {
      const { files, metadata } = await collectSymbolFiles(symbol, enabledDimensionCodes, traceResults)
      allFiles.push(...files)
      symbolMetadatas.push(metadata)
    }

    // 构建批量 metadata
    const batchMetadata: BatchMetadata = {
      batchId,
      parentTaskId,
      startedAt,
      completedAt: Date.now(),
      symbols: [...symbols],
      dimensions: [...enabledDimensionCodes],
      totalTraces: traceResults.length,
      successTraces: traceResults.filter((t) => t.success).length,
      failedTraces: traceResults.filter((t) => !t.success).length,
      configSnapshot,
      exportedAt: Date.now(),
      version: '1.0.0',
    }
    allFiles.push({
      relativePath: '_batch_metadata.json',
      content: toJson(batchMetadata),
    })

    // Markdown 汇总报告
    if (includeSummary) {
      allFiles.push({
        relativePath: '_summary.md',
        content: buildSummaryMarkdown(batchMetadata, symbolMetadatas),
      })
    }

    logger.info('[collectedDataSync] 文件收集完成', {
      fileCount: allFiles.length,
      hasElectronFs: hasElectronFs(),
    })

    // 写入目标环境
    if (hasElectronFs() && window.fileSync) {
      const rootDir = `${outputRoot}/${batchDirName}`
      const result = await window.fileSync.writeFiles({
        rootDir,
        files: allFiles.map((f) => ({ relativePath: f.relativePath, content: f.content })),
      })
      if (!result.success) {
        throw new Error(result.error ?? 'Electron 文件写入失败')
      }
      logger.info('[collectedDataSync] Electron 写入完成', {
        rootDir: result.rootDir,
        writtenCount: result.writtenCount,
      })
      return {
        success: true,
        batchDir: result.rootDir,
        fileCount: result.writtenCount,
        symbolCount: symbols.length,
        files: allFiles.map((f) => `${result.rootDir}/${f.relativePath}`),
      }
    }

    // 浏览器降级：打包下载
    return triggerBrowserDownload(allFiles, batchDirName)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    logger.error('[collectedDataSync] 同步失败', { error: msg })
    return { success: false, fileCount: 0, symbolCount: 0, error: msg }
  }
}

// ============================================================
// 从配置提取启用维度
// ============================================================

/** 从 CollectionConfig 中提取启用的维度 code 列表 */
export function extractEnabledDimensionCodes(config: CollectionConfig): string[] {
  const dims = DEFAULT_DIMENSIONS.filter((d) => d.enabled).map((d) => d.code)
  // 若 config.dimensions 存在，按 config 覆盖默认
  if (config.dimensions?.length > 0) {
    return config.dimensions.filter((d) => d.enabled).map((d) => d.code)
  }
  return dims
}
