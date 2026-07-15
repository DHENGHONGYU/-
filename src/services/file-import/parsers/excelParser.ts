/**
 * @fileoverview Excel 文件解析器
 *
 * 解析 Excel HTML 表格格式（.xlsx/.xls 的 HTML 导出形式），
 * 支持多 Sheet、表头识别、数据类型推断。
 *
 * 注意：浏览器环境无法直接解析二进制 .xlsx/.xls 文件，
 * 仅支持 Excel "另存为 HTML" 格式或第三方库导出的 HTML 表格。
 * 完整二进制解析需引入 SheetJS (xlsx) 库，预留接口。
 *
 * @module services/file-import/parsers/excelParser
 * @created 2026-07-14 - 双通道整改 P3-1
 */

import { getLogger } from '@/lib/logger'
import { STORE_NAME } from '@/config/dbConfig'
import type { FileParser, FileImportDataType, ParseOptions, ParsedData } from '@/types/modules/data-sync.types'
import type { StoreName } from '@/config/dbConfig'

const logger = getLogger()

/** 默认最大行数 */
const DEFAULT_MAX_ROWS = 5000

/**
 * 读取文件文本（兼容 jsdom）
 */
async function readFileText(file: File): Promise<string> {
  if (typeof (file as File & { text?: () => Promise<string> }).text === 'function') {
    return (file as File & { text: () => Promise<string> }).text()
  }
  if (typeof (file as File & { arrayBuffer?: () => Promise<ArrayBuffer> }).arrayBuffer === 'function') {
    const buffer = await (file as File & { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer()
    return new TextDecoder('utf-8').decode(buffer)
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error(reader.error?.message ?? 'FileReader failed'))
    reader.readAsText(file)
  })
}

/**
 * 从 HTML 中提取所有表格
 * @param html - HTML 文本
 * @returns 表格数据数组（每个表格为行数组的数组）
 */
function extractTablesFromHTML(html: string): string[][][] {
  const tables: string[][][] = []
  const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi
  let tableMatch: RegExpExecArray | null

  while ((tableMatch = tableRegex.exec(html)) !== null) {
    const tableHTML = tableMatch[1] ?? ''
    const rows: string[][] = []
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
    let rowMatch: RegExpExecArray | null

    while ((rowMatch = rowRegex.exec(tableHTML)) !== null) {
      const rowHTML = rowMatch[1] ?? ''
      const cells: string[] = []
      const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi
      let cellMatch: RegExpExecArray | null

      while ((cellMatch = cellRegex.exec(rowHTML)) !== null) {
        const cellText = (cellMatch[1] ?? '')
          .replace(/<[^>]+>/g, '') // 移除内嵌 HTML
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .trim()
        cells.push(cellText)
      }

      if (cells.length > 0) {
        rows.push(cells)
      }
    }

    if (rows.length > 0) {
      tables.push(rows)
    }
  }

  return tables
}

/**
 * 将表格行数据映射为记录对象
 * @param rows - 表格行数据（第一行为表头）
 * @param maxRows - 最大行数
 * @returns 记录数组
 */
function tableRowsToRecords(
  rows: string[][],
  maxRows: number,
): { records: Record<string, unknown>[]; columns: string[] } {
  if (rows.length === 0) {
    return { records: [], columns: [] }
  }

  const headers = rows[0]?.map((h, i) => h || `col_${i}`) ?? []
  const dataRows = rows.slice(1, 1 + maxRows)
  const records: Record<string, unknown>[] = []

  /** 不做数值转换的字段 */
  const stringFields = new Set(['code', 'symbol', 'name', 'date', 'exchange', 'industry'])

  for (const row of dataRows) {
    const record: Record<string, unknown> = {}
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i] ?? `col_${i}`
      const value = row[i] ?? ''
      if (stringFields.has(header.toLowerCase())) {
        record[header] = value
      } else {
        const numValue = Number(value)
        record[header] = value !== '' && !Number.isNaN(numValue) ? numValue : value
      }
    }
    records.push(record)
  }

  return { records, columns: headers }
}

/**
 * 根据列名推断数据类型
 */
function inferDataType(columns: readonly string[]): { dataType: FileImportDataType; targetStore: StoreName } {
  const lower = columns.map(c => c.toLowerCase())
  const hasPrice = lower.some(c => ['open', 'close', 'high', 'low', 'price'].includes(c))
  const hasDate = lower.some(c => ['date', 'time'].includes(c))
  if (hasPrice && hasDate) return { dataType: 'dailyQuotes', targetStore: STORE_NAME.dailyQuotes }

  const hasFinance = lower.some(c => ['revenue', 'profit', 'roe', 'pe'].includes(c))
  if (hasFinance) return { dataType: 'financialReports', targetStore: STORE_NAME.financialReports }

  const hasStock = lower.some(c => ['code', 'symbol', 'name'].includes(c))
  if (hasStock) return { dataType: 'stocks', targetStore: STORE_NAME.stocks }

  return { dataType: 'knowledgeDocs', targetStore: STORE_NAME.localDocs }
}

/**
 * Excel HTML 表格解析器
 */
export const excelParser: FileParser = {
  extensions: ['xlsx', 'xls'],
  dataType: 'auto',

  async parse(file: File, options?: ParseOptions): Promise<ParsedData> {
    const maxRows = options?.maxRows ?? DEFAULT_MAX_ROWS
    const text = await readFileText(file)

    const tables = extractTablesFromHTML(text)
    if (tables.length === 0) {
      logger.warn('[excelParser] 未找到 HTML 表格', { fileName: file.name })
      throw new Error('Excel 文件中未找到 HTML 表格，可能为二进制格式。请使用 CSV/JSON 格式或 Excel "另存为 HTML" 导出。')
    }

    // 取第一个非空表格
    const table = tables[0] ?? []
    const { records, columns } = tableRowsToRecords(table, maxRows)

    const { dataType, targetStore } = options?.expectedType && options?.targetStore
      ? { dataType: options.expectedType, targetStore: options.targetStore }
      : inferDataType(columns)

    logger.info('[excelParser] 解析完成', {
      fileName: file.name,
      tableCount: tables.length,
      totalRows: table.length - 1,
      parsedRows: records.length,
      columns: columns.length,
      dataType,
    })

    return {
      dataType,
      targetStore,
      records,
      parseMeta: {
        totalRows: table.length - 1,
        parsedRows: records.length,
        skippedRows: 0,
        columns,
      },
    }
  },
}
