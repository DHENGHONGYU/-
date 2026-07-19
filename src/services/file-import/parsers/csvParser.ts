/**
 * @fileoverview CSV 文件解析器
 *
 * 将 CSV/TXT 文件解析为结构化记录，支持：
 * - 自动分隔符检测（逗号/分号/制表符）
 * - BOM 头处理
 * - 表头识别与列映射
 * - 股票代码/行情/K线/财务数据自动推断
 *
 * @module services/file-import/parsers/csvParser
 * @created 2026-07-14 - 双通道整改 P0-2
  * @doc [V9-DOC-BACK-012, V9-DOC-BACK-023, V9-DOC-BACK-033, V9-DOC-BACK-021, V9-DOC-BACK-026]
*/

import { getLogger } from '@/lib/logger'
import { STORE_NAME } from '@/config/dbConfig'
import type { FileParser, FileImportDataType, ParseOptions, ParsedData } from '@/types/modules/data-sync.types'

const logger = getLogger()

// ============================================================
// 常量
// ============================================================

/** BOM 头码点 */
const BOM_CODE = 0xfeff

/** 默认最大行数 */
const DEFAULT_MAX_ROWS = 5000

/** 候选分隔符（按优先级） */
const CANDIDATE_DELIMITERS = [',', '\t', ';', '|'] as const

// ============================================================
// 工具函数
// ============================================================

/**
 * 读取文件文本（兼容 jsdom 环境）
 * @param file - File 对象
 * @returns 文件文本内容
 */
async function readFileText(file: File): Promise<string> {
  // 优先使用 File.text()（现代浏览器）
  if (typeof (file as File & { text?: () => Promise<string> }).text === 'function') {
    return (file as File & { text: () => Promise<string> }).text()
  }
  // 降级 1：arrayBuffer + TextDecoder
  if (typeof (file as File & { arrayBuffer?: () => Promise<ArrayBuffer> }).arrayBuffer === 'function') {
    const buffer = await (file as File & { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer()
    return new TextDecoder('utf-8').decode(buffer)
  }
  // 降级 2：FileReader（jsdom 兼容）
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error(reader.error?.message ?? 'FileReader failed'))
    reader.readAsText(file)
  })
}

/**
 * 移除 BOM 头
 * @param text - 原始文本
 * @returns 移除 BOM 后的文本
 */
function stripBOM(text: string): string {
  if (text.charCodeAt(0) === BOM_CODE) {
    return text.slice(1)
  }
  return text
}

/**
 * 自动检测分隔符
 * @param firstLine - 第一行文本
 * @returns 检测到的分隔符
 */
function detectDelimiter(firstLine: string): string {
  let bestDelimiter = ','
  let bestScore = 0

  for (const delim of CANDIDATE_DELIMITERS) {
    const count = firstLine.split(delim).length - 1
    if (count > bestScore) {
      bestScore = count
      bestDelimiter = delim
    }
  }

  return bestDelimiter
}

/**
 * 解析单行 CSV（支持引号包裹）
 * @param line - 单行文本
 * @param delimiter - 分隔符
 * @returns 字段数组
 */
function parseCSVLine(line: string, delimiter: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === delimiter && !inQuotes) {
      fields.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }

  fields.push(current.trim())
  return fields
}

/**
 * 根据列名推断数据类型
 * @param headers - 表头数组
 * @returns 推断的数据类型和目标 store
 */
function inferDataTypeFromHeaders(
  headers: readonly string[],
): { dataType: FileImportDataType; targetStore: string } {
  const lowerHeaders = headers.map(h => h.toLowerCase())

  // 行情/K线特征列
  const hasPriceCols = lowerHeaders.some(h =>
    ['open', 'close', 'high', 'low', 'price', '开盘', '收盘', '最高', '最低'].some(k => h.includes(k)),
  )
  const hasDateCol = lowerHeaders.some(h =>
    ['date', 'time', '日期', '时间'].some(k => h.includes(k)),
  )

  if (hasPriceCols && hasDateCol) {
    return { dataType: 'dailyQuotes', targetStore: STORE_NAME.dailyQuotes }
  }

  // 财务特征列
  const hasFinanceCols = lowerHeaders.some(h =>
    ['revenue', 'profit', 'roe', 'pe', 'pb', '营收', '利润', '净资产收益率'].some(k => h.includes(k)),
  )
  if (hasFinanceCols) {
    return { dataType: 'financialReports', targetStore: STORE_NAME.financialReports }
  }

  // 股票基本信息
  const hasStockCols = lowerHeaders.some(h =>
    ['code', 'symbol', '代码', '名称', 'name'].some(k => h.includes(k)),
  )
  if (hasStockCols) {
    return { dataType: 'stocks', targetStore: STORE_NAME.stocks }
  }

  // 默认：知识文档
  return { dataType: 'knowledgeDocs', targetStore: STORE_NAME.localDocs }
}

/**
 * 将行数据映射为记录对象
 * @param fields - 字段值数组
 * @param headers - 表头数组
 * @returns 记录对象
 */
function mapRowToRecord(
  fields: readonly string[],
  headers: readonly string[],
): Record<string, unknown> {
  const record: Record<string, unknown> = {}
  /** 不做数值转换的字段名（保持字符串） */
  const STRING_FIELDS: ReadonlySet<string> = new Set([
    'code', 'symbol', 'stockcode', 'stock_code', '代码', '股票代码',
    'name', 'stockname', 'stock_name', '名称', '股票名称',
    'date', 'trade_date', 'tradedate', '日期', '交易日期',
    'exchange', 'market', '行业', 'industry',
  ])

  for (let i = 0; i < headers.length; i++) {
    const header = headers[i] ?? `col_${i}`
    const value = fields[i] ?? ''
    const lowerHeader = header.toLowerCase()

    // 字符串字段保持原样
    if (STRING_FIELDS.has(lowerHeader)) {
      record[header] = value
      continue
    }

    // 尝试数值转换（仅对非字符串字段）
    const numValue = Number(value)
    record[header] = value !== '' && !Number.isNaN(numValue) && value.trim() !== ''
      ? numValue
      : value
  }
  return record
}

// ============================================================
// CSV 解析器实现
// ============================================================

/**
 * CSV 文件解析器
 *
 * 支持 CSV/TXT 格式，自动检测分隔符和列类型。
 */
export const csvParser: FileParser = {
  extensions: ['csv', 'txt'],
  dataType: 'auto',

  async parse(file: File, options?: ParseOptions): Promise<ParsedData> {
    const maxRows = options?.maxRows ?? DEFAULT_MAX_ROWS
    const rawText = await readFileText(file)
    const text = stripBOM(rawText)

    const allLines = text.split(/\r?\n/).filter(l => l.trim().length > 0)
    if (allLines.length === 0) {
      logger.warn('[csvParser] 文件为空或无有效行', { fileName: file.name })
      return {
        dataType: 'stocks',
        targetStore: STORE_NAME.stocks as unknown as import('@/config/dbConfig').StoreName,
        records: [],
        parseMeta: { totalRows: 0, parsedRows: 0, skippedRows: 0, columns: [] },
      }
    }

    // 检测分隔符
    const firstLine = allLines[0] ?? ''
    const delimiter = options?.delimiter ?? detectDelimiter(firstLine)

    // 解析表头
    const headers = parseCSVLine(firstLine, delimiter)
    logger.info('[csvParser] 表头解析', { fileName: file.name, columns: headers, delimiter })

    // 推断数据类型
    const { dataType, targetStore } = options?.expectedType && options?.targetStore
      ? { dataType: options.expectedType, targetStore: options.targetStore }
      : inferDataTypeFromHeaders(headers)

    // 解析数据行
    const dataLines = allLines.slice(1, 1 + maxRows)
    const records: Record<string, unknown>[] = []
    let skipped = 0

    for (const line of dataLines) {
      if (line.trim().length === 0) {
        skipped++
        continue
      }
      const fields = parseCSVLine(line, delimiter)
      if (fields.length < headers.length) {
        logger.warn('[csvParser] 行字段数不足，跳过', { line, expected: headers.length, actual: fields.length })
        skipped++
        continue
      }
      records.push(mapRowToRecord(fields, headers))
    }

    logger.info('[csvParser] 解析完成', {
      fileName: file.name,
      totalRows: allLines.length - 1,
      parsedRows: records.length,
      skippedRows: skipped,
      dataType,
    })

    return {
      dataType,
      targetStore: targetStore as import('@/config/dbConfig').StoreName,
      records,
      parseMeta: {
        totalRows: allLines.length - 1,
        parsedRows: records.length,
        skippedRows: skipped,
        columns: headers,
      },
    }
  },
}
