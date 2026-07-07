/**
 * @fileoverview 批量导入执行层
 *
 * 从 batchImportService.ts 拆分而来，职责：
 * - 实现 importStocks：批量导入候选股票到意向池（每行独立写入，失败不阻塞）
 * - 实现 importStocksWithProgress：带进度的分批导入（批次并行 + 进度回调）
 *
 * 设计原则：
 * - 通过 addStock 写入，不直接调用 dataLayer.stocks.add
 * - 失败行记录在 BulkImportResult.errors 中返回，不抛异常
 * - 分批导入通过 INPUT_CONFIG.bulkImport.batchSize/batchIntervalMs 控制并发
 *
 * @module services/input/batchImportExecutor
 * @created 2026-07-07 - 从 batchImportService.ts 拆分
 */

import { INPUT_CONFIG } from '@/config/inputConfig'
import { dataLayer } from '@/data/dataLayer'
import type { DataLayerResult, Stock } from '@/data/types'
import { getLogger } from '@/lib/logger'

import { addStock, type AddStockOptions } from './inputService'
import type { BulkImportResult, BulkImportRow } from './batchImportParsers'

const logger = getLogger()

export interface ImportStocksOptions extends AddStockOptions {
  /**
   * 遇到重复代码时是否跳过（默认 true）
   */
  skipDuplicates?: boolean
}

/** 单行导入结果（用于批次聚合） */
interface RowImportOutcome {
  ok: boolean
  row: number
  raw: string
  error: string
  stock: Stock | null
}

/**
 * 批量导入候选股票到意向池
 *
 * 每只股票独立写入，失败行记录在结果中返回，不阻塞其他行。
 */
export async function importStocks(
  rows: BulkImportRow[],
  options: ImportStocksOptions = {},
): Promise<DataLayerResult<BulkImportResult>> {
  if (rows.length === 0) {
    return { success: false, error: '没有可导入的股票' }
  }

  const result: BulkImportResult = {
    total: rows.length,
    success: 0,
    failed: 0,
    errors: [],
    stocks: [],
  }

  const seen = new Set<string>()

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!

    if (options.skipDuplicates !== false && seen.has(row.symbol)) {
      result.failed++
      result.errors.push({
        row: i + 1,
        raw: `${row.code} ${row.name}`,
        error: '重复的代码',
      })
      continue
    }
    seen.add(row.symbol)

    const exists = await dataLayer.stocks.get(row.symbol)
    if (exists) {
      result.failed++
      result.errors.push({
        row: i + 1,
        raw: `${row.code} ${row.name}`,
        error: '股票已存在',
      })
      continue
    }

    const addResult = await addStock(
      { symbol: row.symbol, name: row.name },
      {
        fetchBasicAfterAdd: options.fetchBasicAfterAdd,
        fetchKlineAfterAdd: options.fetchKlineAfterAdd,
        group: options.group,
      },
    )

    if (addResult.success && addResult.data) {
      result.success++
      result.stocks.push(addResult.data)
    } else {
      result.failed++
      result.errors.push({
        row: i + 1,
        raw: `${row.code} ${row.name}`,
        error: addResult.error ?? '导入失败',
      })
    }
  }

  return { success: true, data: result }
}

/**
 * 带进度的批量导入
 *
 * - 仅导入 status === 'valid' 的行（过滤无效与重复）
 * - 按 batchSize 分组，每批 Promise.all 并行
 * - 批次间间隔 batchIntervalMs
 * - 通过 onProgress 回调报告进度 (0-100)
 *
 * @param rows 已经过 detectDuplicates 标记状态的行
 * @param options 导入选项
 * @param onProgress 进度回调 (completed, total, percent)
 */
export async function importStocksWithProgress(
  rows: BulkImportRow[],
  options: ImportStocksOptions = {},
  onProgress?: (completed: number, total: number, percent: number) => void,
): Promise<DataLayerResult<BulkImportResult>> {
  const importableRows = rows.filter((r) => r.status === 'valid')

  if (importableRows.length === 0) {
    logger.info('[batchImport] 无可导入的有效行', { totalRows: rows.length })
    return {
      success: false,
      error: '没有可导入的有效股票（请检查重复或无效行）',
    }
  }

  logger.info('[batchImport] 开始分批导入', {
    totalRows: rows.length,
    importableRows: importableRows.length,
    batchSize: INPUT_CONFIG.bulkImport.batchSize,
  })

  const result: BulkImportResult = {
    total: importableRows.length,
    success: 0,
    failed: 0,
    errors: [],
    stocks: [],
  }

  const seen = new Set<string>()
  const batchSize = INPUT_CONFIG.bulkImport.batchSize
  const intervalMs = INPUT_CONFIG.bulkImport.batchIntervalMs
  const total = importableRows.length

  for (let i = 0; i < importableRows.length; i += batchSize) {
    const batch = importableRows.slice(i, i + batchSize)

    const outcomes = await Promise.all(
      batch.map(async (row, batchIdx): Promise<RowImportOutcome> => {
        const globalIdx = i + batchIdx
        try {
          // 批次内重复检测（同步阶段即可生效）
          if (options.skipDuplicates !== false && seen.has(row.symbol)) {
            return {
              ok: false,
              row: globalIdx,
              raw: `${row.code} ${row.name}`,
              error: '重复的代码',
              stock: null,
            }
          }
          seen.add(row.symbol)

          const exists = await dataLayer.stocks.get(row.symbol)
          if (exists) {
            return {
              ok: false,
              row: globalIdx,
              raw: `${row.code} ${row.name}`,
              error: '股票已存在',
              stock: null,
            }
          }

          const addResult = await addStock(
            { symbol: row.symbol, name: row.name },
            {
              fetchBasicAfterAdd: options.fetchBasicAfterAdd,
              fetchKlineAfterAdd: options.fetchKlineAfterAdd,
              group: options.group,
            },
          )

          if (addResult.success && addResult.data) {
            return { ok: true, row: globalIdx, raw: '', error: '', stock: addResult.data }
          }
          return {
            ok: false,
            row: globalIdx,
            raw: `${row.code} ${row.name}`,
            error: addResult.error ?? '导入失败',
            stock: null,
          }
        } catch (err) {
          return {
            ok: false,
            row: globalIdx,
            raw: `${row.code} ${row.name}`,
            error: err instanceof Error ? err.message : String(err),
            stock: null,
          }
        }
      }),
    )

    for (const o of outcomes) {
      if (o.ok && o.stock) {
        result.success++
        result.stocks.push(o.stock)
      } else {
        result.failed++
        result.errors.push({ row: o.row + 1, raw: o.raw, error: o.error })
      }
    }

    const completed = Math.min(i + batchSize, total)
    const percent = Math.round((completed / total) * 100)
    logger.info('[batchImport] 导入进度', { completed, total, percent })
    onProgress?.(completed, total, percent)

    // 批次间隔（最后一批不需要）
    if (i + batchSize < importableRows.length) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs))
    }
  }

  logger.info('[batchImport] 分批导入完成', {
    total: result.total,
    success: result.success,
    failed: result.failed,
  })

  return { success: true, data: result }
}
