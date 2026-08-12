/**
 * @fileoverview 批量导入解析层
 *
 * 从 batchImportService.ts 拆分而来，职责：
 * - 定义行级类型（BulkImportRow/BulkImportResult）
 * - 实现文本解析（parseBulkInput）
 * - 实现多格式文件解析（CSV/JSON/Excel HTML/文本退化）
 *
 * 设计原则：
 * - VAL-003 安全增强：限制最大行数、单行长度、严格校验股票代码格式
 * - 纯函数 + 文件 I/O，无副作用，不写 db
 *
 * @module services/input/batchImportParsers
 * @created 2026-07-07 - 从 batchImportService.ts 拆分
  * @doc [V9-DOC-BACK-012, V9-DOC-BACK-023, V9-DOC-BACK-033, V9-DOC-BACK-021, V9-DOC-BACK-026]
*/

import { INPUT_CONFIG } from '@/config/inputConfig'
import type { Stock } from '@/data/types'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

// ============================================================
// 类型定义
// ============================================================

/** 行级状态：有效 / 重复 / 无效 */
export type BulkImportRowStatus = 'valid' | 'duplicate' | 'invalid'

export interface BulkImportRow {
  code: string
  name: string
  symbol: string
  /** 行级校验状态，用于预览高亮与导入过滤 */
  status: BulkImportRowStatus
  /** 状态原因说明（悬浮提示展示） */
  statusReason?: string
}

export interface BulkImportResult {
  total: number
  success: number
  failed: number
  /** 跳过数（已在意向池中，非失败） */
  skipped: number
  errors: Array<{ row: number; raw: string; error: string }>
  stocks: Stock[]
}

// ============================================================
// 常量与工具
// ============================================================

/** 单行原始文本最大长度（防止恶意超长输入） */
export const MAX_LINE_LENGTH = 200

/** 股票名称最大长度 */
export const MAX_NAME_LENGTH = 50

/** BOM 头字符码点 */
export const BOM_CHAR_CODE = 0xfeff

/** A 股代码格式：6 位数字 */
export const STOCK_CODE_PATTERN = /^\d{6}$/

/** 检测交易所：6 开头 → SH，其他 → SZ */
export function detectExchange(code: string): string {
  if (STOCK_CODE_PATTERN.test(code)) {
    return code.startsWith('6') ? 'SH' : 'SZ'
  }
  return ''
}

// ============================================================
// 文本解析
// ============================================================

type RowParser = (parts: string[], line: string) => BulkImportRow | null

const PARSERS: RowParser[] = [
  // 格式1: 6位代码,名称
  (parts) => {
    if (parts.length < 2 || !STOCK_CODE_PATTERN.test(parts[0]!)) return null
    const code = parts[0]!
    const name = parts[1]!.slice(0, MAX_NAME_LENGTH)
    const exchange = detectExchange(code)
    return { code, name, symbol: `${code}.${exchange}`, status: 'valid' }
  },
  // 格式2: 600000.SH,名称
  (parts) => {
    if (parts.length < 2 || !/^\d{6}\.(SH|SZ|BJ)$/i.test(parts[0]!)) return null
    const rawCode = parts[0]!
    const [code, exchange] = rawCode.split('.') as [string, string]
    const name = parts[1]!.slice(0, MAX_NAME_LENGTH)
    return { code, name, symbol: `${code}.${exchange.toUpperCase()}`, status: 'valid' }
  },
  // 格式3: 仅 600000.SH
  (_parts, line) => {
    if (!/^\d{6}\.(SH|SZ|BJ)$/i.test(line)) return null
    const [code, exchange] = line.split('.') as [string, string]
    return { code, name: code, symbol: `${code}.${exchange.toUpperCase()}`, status: 'valid' }
  },
  // 格式4: 仅 6位代码
  (_parts, line) => {
    if (!STOCK_CODE_PATTERN.test(line)) return null
    const code = line
    const exchange = detectExchange(code)
    return { code, name: code, symbol: `${code}.${exchange}`, status: 'valid' }
  },
]

function createInvalidRow(line: string): BulkImportRow {
  return {
    code: line.split(',')[0]?.trim() ?? line,
    name: line.split(',')[1]?.trim() ?? '',
    symbol: '',
    status: 'invalid',
    statusReason: '代码格式不合规（需为 6 位数字）',
  }
}

/**
 * 解析批量导入文本。
 *
 * VAL-003 安全增强：
 * - 限制最大行数（INPUT_CONFIG.bulkImport.maxRows）
 * - 限制单行长度（防止恶意超长输入）
 * - 严格校验股票代码格式（A股6位数字）
 * - 限制股票名称长度
 *
 * 注意：本函数仅做格式解析，返回行状态默认为 'valid'，
 * 重复检测请额外调用 detectDuplicates。
 *
 * @param text - 批量输入原始文本
 * @returns 解析后的行数组
 */
export function parseBulkInput(text: string): BulkImportRow[] {
  const results: BulkImportRow[] = []

  logger.info('[batchImport] 开始解析批量输入文本', { textLength: text.length })

  const lines = text
    .split(INPUT_CONFIG.bulkImport.lineSeparators)
    .map((s) => s.trim().slice(0, MAX_LINE_LENGTH))
    .filter(Boolean)
    .slice(0, INPUT_CONFIG.bulkImport.maxRows)

  logger.info('[batchImport] 输入行解析', { totalLines: lines.length, maxRows: INPUT_CONFIG.bulkImport.maxRows })

  let parsedCount = 0
  let skippedCount = 0

  for (const line of lines) {
    const parts = line.split(INPUT_CONFIG.bulkImport.inlineSeparators).filter(Boolean)
    logger.debug('[batchImport] 解析单行', { rawLine: line, partCount: parts.length })

    const parsed = PARSERS.reduce<BulkImportRow | null>((acc, parser) => acc ?? parser(parts, line), null)

    if (parsed) {
      results.push(parsed)
      parsedCount++
      logger.debug('[batchImport] 格式匹配成功', { code: parsed.code, name: parsed.name, symbol: parsed.symbol })
    } else {
      results.push(createInvalidRow(line))
      skippedCount++
      logger.debug('[batchImport] 行匹配失败（标记为无效）', { rawLine: line })
    }
  }

  logger.info('[batchImport] 批量输入解析完成', { totalLines: lines.length, parsed: parsedCount, skipped: skippedCount, resultCount: results.length })

  return results
}

// ============================================================
// A-1: 多格式文件解析
// ============================================================

/** 使用 FileReader 读取文件为文本，自动剥离 BOM 头 */
function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      let text = typeof result === 'string' ? result : ''
      // BOM 头检测与移除
      if (text.charCodeAt(0) === BOM_CHAR_CODE) {
        text = text.slice(1)
      }
      resolve(text)
    }
    reader.onerror = () => reject(reader.error ?? new Error('文件读取失败'))
    reader.readAsText(file)
  })
}

/** 处理 CSV 引号状态中的字符，返回是否已消费该字符 */
function handleQuotedChar(
  line: string,
  i: number,
  current: string,
): { current: string; nextIndex: number; inQuotes: boolean } {
  const char = line[i]!
  if (char === '"') {
    if (line[i + 1] === '"') {
      return { current: current + '"', nextIndex: i + 1, inQuotes: true }
    }
    return { current, nextIndex: i, inQuotes: false }
  }
  return { current: current + char, nextIndex: i, inQuotes: true }
}

/** 解析单行 CSV，支持引号包裹与转义双引号 */
function parseCsvLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]!
    if (inQuotes) {
      const result = handleQuotedChar(line, i, current)
      current = result.current
      i = result.nextIndex
      inQuotes = result.inQuotes
      continue
    }
    if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      fields.push(current)
      current = ''
    } else {
      current += char
    }
  }
  fields.push(current)
  return fields
}

/** 判断是否为表头行（包含"代码"/"名称"/"code"/"name"） */
function isHeaderLine(line: string | undefined): boolean {
  if (!line) return false
  const lower = line.toLowerCase()
  return (
    lower.includes('代码') ||
    lower.includes('名称') ||
    lower.includes('code') ||
    lower.includes('name')
  )
}

/** 从字段中提取股票代码（支持纯数字或带交易所后缀格式） */
function extractStockCode(field: string): string | null {
  const trimmed = field.trim()
  if (STOCK_CODE_PATTERN.test(trimmed)) {
    return trimmed
  }
  const match = trimmed.match(/^(\d{6})\.(SH|SZ|BJ)$/i)
  if (match?.[1]) {
    return match[1]
  }
  return null
}

/** 将原始字段数组转换为 BulkImportRow */
function buildRowFromFields(fields: string[]): BulkImportRow | null {
  let code: string | null = null
  let name = ''
  let exchange = ''

  for (let i = 0; i < fields.length; i++) {
    const candidate = extractStockCode(fields[i]!)
    if (!candidate) continue
    code = candidate
    const rawField = fields[i]!.trim()
    exchange = resolveExchange(code, rawField)
    if (i + 1 < fields.length) {
      name = fields[i + 1]!.trim().slice(0, MAX_NAME_LENGTH)
    }
    break
  }

  if (!code) return null
  if (!name) name = code

  return { code, name, symbol: `${code}.${exchange}`, status: 'valid' }
}

/** 从原始字段解析交易所代码：优先后缀 (.SH/.SZ/.BJ)，否则按代码规则推断 */
function resolveExchange(code: string, rawField: string): string {
  const match = rawField.match(/\.(SH|SZ|BJ)$/i)
  return match?.[1] ? match[1].toUpperCase() : detectExchange(code)
}

/** 解析 CSV 文本为 BulkImportRow[] */
export function parseCsvText(text: string): BulkImportRow[] {
  const results: BulkImportRow[] = []
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, INPUT_CONFIG.bulkImport.maxRows)

  logger.info('[batchImport] 开始解析 CSV 文本', { totalLines: lines.length, maxRows: INPUT_CONFIG.bulkImport.maxRows })

  const startIdx = isHeaderLine(lines[0]) ? 1 : 0
  const hasHeader = startIdx === 1
  logger.info('[batchImport] 表头检测', { hasHeader, header: hasHeader ? lines[0] : '无表头' })

  let parsedCount = 0
  let skippedCount = 0

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i]!
    const lineNum = i + 1
    const fields = parseCsvLine(line)

    logger.debug('[batchImport] 解析行', { lineNum, rawLine: line, fieldCount: fields.length, fields })

    const row = buildRowFromFields(fields)
    if (row) {
      results.push(row)
      parsedCount++
      logger.debug('[batchImport] 行解析成功', { lineNum, code: row.code, name: row.name, symbol: row.symbol })
    } else {
      skippedCount++
      logger.debug('[batchImport] 行解析失败（跳过）', { lineNum, rawLine: line })
    }
  }

  logger.info('[batchImport] CSV 文本解析完成', { totalLines: lines.length, parsed: parsedCount, skipped: skippedCount, hasHeader })

  return results
}

/**
 * 解析 CSV 文件
 *
 * 支持 BOM 头检测、引号包裹字段、表头自动跳过。
 */
export async function parseCsvFile(file: File): Promise<BulkImportRow[]> {
  logger.info('[batchImport] 解析 CSV 文件', { name: file.name, size: file.size })
  try {
    const text = await readFileAsText(file)
    const rows = parseCsvText(text)
    logger.info('[batchImport] CSV 解析完成', { name: file.name, rowCount: rows.length })
    return rows
  } catch (err) {
    logger.error('[batchImport] CSV 解析失败', {
      name: file.name,
      error: err instanceof Error ? err.message : String(err),
    })
    throw err
  }
}

/** 将单个 JSON 对象转换为 BulkImportRow，返回 null 表示无效 */
function parseJsonRow(item: unknown, maxRows: number, currentCount: number): BulkImportRow | null {
  if (currentCount >= maxRows) return null
  if (!item || typeof item !== 'object') return null

  const obj = item as Record<string, unknown>
  const rawCode = obj.code ?? obj.symbol ?? ''
  const code = (typeof rawCode === 'string' ? rawCode : JSON.stringify(rawCode)).trim()
  const rawName = obj.name ?? ''
  const name = (typeof rawName === 'string' ? rawName : JSON.stringify(rawName)).trim()

  if (!STOCK_CODE_PATTERN.test(code)) return null

  const exchange = detectExchange(code)
  return {
    code,
    name: name || code,
    symbol: `${code}.${exchange}`,
    status: 'valid',
  }
}

/**
 * 解析 JSON 文件
 *
 * 支持两种格式：
 * - 数组：[{"code":"600519","name":"贵州茅台"}, ...]
 * - 对象：{"stocks": [{"code":"600519","name":"贵州茅台"}]}
 */
function parseJsonRows(rawList: unknown[]): BulkImportRow[] {
  const results: BulkImportRow[] = []
  for (let i = 0; i < rawList.length && i < INPUT_CONFIG.bulkImport.maxRows; i++) {
    const row = parseJsonRow(rawList[i], INPUT_CONFIG.bulkImport.maxRows, i)
    if (row) results.push(row)
  }
  return results
}

/**
 * 解析上传的 JSON 批量导入文件。
 * @param file 上传的 File 对象
 * @returns 解析后的批量导入行数组
 */
export async function parseJsonFile(file: File): Promise<BulkImportRow[]> {
  logger.info('[batchImport] 解析 JSON 文件', { name: file.name, size: file.size })
  try {
    const text = await readFileAsText(file)
    const data: unknown = JSON.parse(text)

    let rawList: unknown[]
    if (Array.isArray(data)) {
      rawList = data
    } else if (
      data &&
      typeof data === 'object' &&
      Array.isArray((data as Record<string, unknown>).stocks)
    ) {
      rawList = (data as Record<string, unknown>).stocks as unknown[]
    } else {
      throw new Error('JSON 格式不支持：需为数组或 { stocks: [...] } 结构')
    }

    const results = parseJsonRows(rawList)

    logger.info('[batchImport] JSON 解析完成', { name: file.name, rowCount: results.length })
    return results
  } catch (err) {
    logger.error('[batchImport] JSON 解析失败', {
      name: file.name,
      error: err instanceof Error ? err.message : String(err),
    })
    throw err
  }
}

/** 解析 HTML 表格（Excel "另存为 .xls" 常生成 HTML 格式） */
function parseExcelHtmlTable(text: string): BulkImportRow[] {
  const results: BulkImportRow[] = []
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
  const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi
  let trMatch: RegExpExecArray | null
  let firstRow = true

  while ((trMatch = trRegex.exec(text)) !== null) {
    const rowHtml = trMatch[1] ?? ''
    const cells: string[] = []
    let tdMatch: RegExpExecArray | null
    while ((tdMatch = tdRegex.exec(rowHtml)) !== null) {
      const cellText = (tdMatch[1] ?? '')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .trim()
      cells.push(cellText)
    }
    // 重置 tdRegex 的 lastIndex（同一正则对象在循环中复用）
    tdRegex.lastIndex = 0

    if (cells.length === 0) continue

    // 跳过表头行（首格非 6 位数字）
    if (firstRow && !STOCK_CODE_PATTERN.test(cells[0] ?? '')) {
      firstRow = false
      continue
    }
    firstRow = false

    const row = buildRowFromFields(cells)
    if (row) results.push(row)

    if (results.length >= INPUT_CONFIG.bulkImport.maxRows) break
  }

  return results
}

/**
 * 解析 Excel 文件
 *
 * 由于不引入 xlsx 第三方库，采用纯 JS 实现：
 * - 检测文件签名，二进制 .xlsx(ZIP) / .xls(OLE2) 无法解析时给出明确提示
 * - 支持 Excel "另存为 .xls" 生成的 HTML 表格格式
 * - 退化为 CSV 文本解析
 */
export async function parseExcelFile(file: File): Promise<BulkImportRow[]> {
  logger.info('[batchImport] 解析 Excel 文件', { name: file.name, size: file.size })
  try {
    const buffer = await file.arrayBuffer()
    const bytes = new Uint8Array(buffer)

    // 文件签名检测
    // .xlsx (ZIP): 50 4B 03 04
    // .xls  (OLE2): D0 CF 11 E0
    const isZip =
      bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b
    const isOle2 =
      bytes.length >= 4 &&
      bytes[0] === 0xd0 &&
      bytes[1] === 0xcf &&
      bytes[2] === 0x11 &&
      bytes[3] === 0xe0

    if (isZip || isOle2) {
      logger.warn('[batchImport] 不支持二进制 Excel 格式，建议导出为 CSV', {
        name: file.name,
        isZip,
        isOle2,
      })
      throw new Error('暂不支持二进制 .xlsx/.xls 格式，请将文件另存为 CSV 格式后重试')
    }

    // 尝试作为 HTML 表格格式解析（Excel "另存为 .xls" 常生成 HTML）
    const text = new TextDecoder('utf-8').decode(bytes)
    const hasTable = /<table[\s>]/i.test(text)

    if (hasTable) {
      const rows = parseExcelHtmlTable(text)
      logger.info('[batchImport] Excel(HTML 表格) 解析完成', {
        name: file.name,
        rowCount: rows.length,
      })
      return rows
    }

    // 退化为 CSV 文本解析
    const rows = parseCsvText(text)
    logger.info('[batchImport] Excel(文本退化) 解析完成', {
      name: file.name,
      rowCount: rows.length,
    })
    return rows
  } catch (err) {
    logger.error('[batchImport] Excel 解析失败', {
      name: file.name,
      error: err instanceof Error ? err.message : String(err),
    })
    throw err
  }
}

/**
 * 文件解析统一入口
 *
 * 根据文件扩展名分发到对应解析器，支持 .csv/.txt/.json/.xlsx/.xls。
 */
export async function parseFile(file: File): Promise<BulkImportRow[]> {
  logger.info('[batchImport] 解析文件', {
    name: file.name,
    size: file.size,
    type: file.type,
  })

  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''

  try {
    switch (ext) {
      case 'csv':
      case 'txt':
        return await parseCsvFile(file)
      case 'json':
        return await parseJsonFile(file)
      case 'xlsx':
      case 'xls':
        return await parseExcelFile(file)
      default: {
        logger.warn('[batchImport] 不支持的文件格式', { name: file.name, ext })
        throw new Error(
          `不支持的文件格式：.${ext}，请使用 ${INPUT_CONFIG.bulkImport.supportedFileExtensions.join('/')} 之一`,
        )
      }
    }
  } catch (err) {
    logger.error('[batchImport] 文件解析失败', {
      name: file.name,
      error: err instanceof Error ? err.message : String(err),
    })
    throw err
  }
}
