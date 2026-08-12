/**
 * @fileoverview JSON 文件解析器
 *
 * 将 JSON 文件解析为结构化记录，支持：
 * - 数组格式（每元素为一条记录）
 * - 对象格式（含 data/records/items 字段）
 * - 嵌套结构展平
 * - 数据类型自动推断
 *
 * @module services/file-import/parsers/jsonParser
 * @created 2026-07-14 - 双通道整改 P0-2
  * @doc [V9-DOC-BACK-012, V9-DOC-BACK-023, V9-DOC-BACK-033, V9-DOC-BACK-021, V9-DOC-BACK-026]
*/

import { getLogger } from '@/lib/logger'
import { STORE_NAME } from '@/config/dbConfig'
import type { FileParser, FileImportDataType, ParseOptions, ParsedData } from '@/types/modules/data-sync.types'
import type { StoreName } from '@/config/dbConfig'

const logger = getLogger()

/** 默认最大行数 */
const DEFAULT_MAX_ROWS = 5000

/**
 * 读取文件文本（兼容 jsdom 环境）
 * @param file - File 对象
 * @returns 文件文本内容
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

/** 数组提取候选字段名 */
const ARRAY_FIELD_CANDIDATES = ['data', 'records', 'items', 'list', 'rows', 'results'] as const

/** 数据类型标记字段名 */
const TYPE_FIELD_CANDIDATES = ['dataType', 'type', 'type', 'store', 'targetStore'] as const

/**
 * 从 JSON 对象中提取记录数组
 * @param obj - 解析后的 JSON 对象
 * @returns 记录数组
 */
function extractRecords(obj: unknown): Record<string, unknown>[] {
  // 直接是数组
  if (Array.isArray(obj)) {
    return obj.filter(r => r !== null && typeof r === 'object') as Record<string, unknown>[]
  }

  // 是对象，查找数组字段
  if (obj !== null && typeof obj === 'object') {
    const record = obj as Record<string, unknown>

    // 查找候选数组字段
    for (const field of ARRAY_FIELD_CANDIDATES) {
      if (Array.isArray(record[field])) {
        return record[field].filter(
          (r: unknown) => r !== null && typeof r === 'object',
        ) as Record<string, unknown>[]
      }
    }

    // 单条记录（包装为数组）
    return [record]
  }

  return []
}

/**
 * 从 JSON 对象中推断数据类型
 * @param obj - 解析后的 JSON 对象
 * @param records - 提取的记录数组
 * @returns 数据类型和目标 store
 */
function inferTypeFromJSON(
  obj: unknown,
  records: readonly Record<string, unknown>[],
): { dataType: FileImportDataType; targetStore: StoreName } {
  // 检查顶层类型标记
  if (obj !== null && typeof obj === 'object') {
    const record = obj as Record<string, unknown>
    for (const field of TYPE_FIELD_CANDIDATES) {
      if (typeof record[field] === 'string') {
        const typeStr = record[field]
        if (typeStr === 'stocks') return { dataType: 'stocks', targetStore: STORE_NAME.stocks }
        if (typeStr === 'dailyQuotes') return { dataType: 'dailyQuotes', targetStore: STORE_NAME.dailyQuotes }
        if (typeStr === 'financialReports') return { dataType: 'financialReports', targetStore: STORE_NAME.financialReports }
      }
    }
  }

  // 根据记录字段推断
  if (records.length > 0) {
    const firstRecord = records[0]
    if (firstRecord) {
      const keys = Object.keys(firstRecord).map(k => k.toLowerCase())

      // 行情/K线
      const hasPriceCols = keys.some(k =>
        ['open', 'close', 'high', 'low', 'price'].includes(k),
      )
      const hasDateCol = keys.some(k => ['date', 'time'].includes(k))
      if (hasPriceCols && hasDateCol) {
        return { dataType: 'dailyQuotes', targetStore: STORE_NAME.dailyQuotes }
      }

      // 财务
      const hasFinanceCols = keys.some(k =>
        ['revenue', 'profit', 'roe', 'pe', 'pb'].includes(k),
      )
      if (hasFinanceCols) {
        return { dataType: 'financialReports', targetStore: STORE_NAME.financialReports }
      }

      // 股票
      const hasStockCols = keys.some(k =>
        ['code', 'symbol', 'name'].includes(k),
      )
      if (hasStockCols) {
        return { dataType: 'stocks', targetStore: STORE_NAME.stocks }
      }
    }
  }

  return { dataType: 'knowledgeDocs', targetStore: STORE_NAME.localDocs }
}

/**
 * 收集所有出现过的列名
 * @param records - 记录数组
 * @returns 列名数组
 */
function collectColumns(records: readonly Record<string, unknown>[]): string[] {
  const columnSet = new Set<string>()
  for (const record of records) {
    for (const key of Object.keys(record)) {
      columnSet.add(key)
    }
  }
  return Array.from(columnSet)
}

/**
 * JSON 文件解析器
 *
 * 支持数组格式和对象格式（含 data/records/items 字段）。
 */
export const jsonParser: FileParser = {
  extensions: ['json'],
  dataType: 'auto',

  async parse(file: File, options?: ParseOptions): Promise<ParsedData> {
    const maxRows = options?.maxRows ?? DEFAULT_MAX_ROWS
    const rawText = await readFileText(file)

    let parsed: unknown
    try {
      parsed = JSON.parse(rawText)
    } catch (e) {
      logger.error('[jsonParser] JSON 解析失败', { fileName: file.name, error: String(e) })
      throw new Error(`JSON 解析失败：${String(e)}`)
    }

    // 提取记录
    const allRecords = extractRecords(parsed)
    const records = allRecords.slice(0, maxRows)
    const skipped = allRecords.length - records.length

    // 推断类型
    const { dataType, targetStore } = options?.expectedType && options?.targetStore
      ? { dataType: options.expectedType, targetStore: options.targetStore }
      : inferTypeFromJSON(parsed, records)

    const columns = collectColumns(records)

    logger.info('[jsonParser] 解析完成', {
      fileName: file.name,
      totalRows: allRecords.length,
      parsedRows: records.length,
      skippedRows: skipped,
      dataType,
      columns: columns.length,
    })

    return {
      dataType,
      targetStore,
      records,
      parseMeta: {
        totalRows: allRecords.length,
        parsedRows: records.length,
        skippedRows: skipped,
        columns,
      },
    }
  },
}
