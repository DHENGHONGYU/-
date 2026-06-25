import { addStock, type AddStockOptions } from './inputService'
import { dataLayer } from '@/data/dataLayer'
import type { DataLayerResult, Stock } from '@/data/types'

export interface BulkImportRow {
  code: string
  name: string
  symbol: string
}

export interface BulkImportResult {
  total: number
  success: number
  failed: number
  errors: Array<{ row: number; raw: string; error: string }>
  stocks: Stock[]
}

function detectExchange(code: string): string {
  if (/^\d{6}$/.test(code)) {
    return code.startsWith('6') ? 'SH' : 'SZ'
  }
  return ''
}

export function parseBulkInput(text: string): BulkImportRow[] {
  const results: BulkImportRow[] = []
  const lines = text
    .split(/[\n;；、]/)
    .map((s) => s.trim())
    .filter(Boolean)

  for (const line of lines) {
    const parts = line.split(/[\s,]+/).filter(Boolean)

    if (parts.length >= 2 && /^\d{6}$/.test(parts[0]!)) {
      const code = parts[0]!
      const name = parts[1]!
      const exchange = detectExchange(code)
      results.push({ code, name, symbol: `${code}.${exchange}` })
    } else if (/^\d{6}\.(SH|SZ|BJ)$/i.test(line)) {
      const [code, exchange] = line.split('.') as [string, string]
      results.push({ code, name: code, symbol: `${code}.${exchange.toUpperCase()}` })
    } else if (/^\d{6}$/.test(line)) {
      const code = line
      const exchange = detectExchange(code)
      results.push({ code, name: code, symbol: `${code}.${exchange}` })
    }
  }

  return results
}

export interface ImportStocksOptions extends AddStockOptions {
  /**
   * 遇到重复代码时是否跳过（默认 true）
   */
  skipDuplicates?: boolean
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
