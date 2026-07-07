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
 */
export function parseBulkInput(text: string): BulkImportRow[] {
  const results: BulkImportRow[] = []

  // VAL-003: 限制总行数，防止 DoS
  const lines = text
    .split(INPUT_CONFIG.bulkImport.lineSeparators)
    .map((s) => s.trim().slice(0, MAX_LINE_LENGTH)) // 限制单行长度
    .filter(Boolean)
    .slice(0, INPUT_CONFIG.bulkImport.maxRows)

  for (const line of lines) {
    const parts = line.split(INPUT_CONFIG.bulkImport.inlineSeparators).filter(Boolean)

    if (parts.length >= 2 && STOCK_CODE_PATTERN.test(parts[0]!)) {
      const code = parts[0]!
      const name = parts[1]!.slice(0, MAX_NAME_LENGTH) // 限制名称长度
      const exchange = detectExchange(code)
      results.push({ code, name, symbol: `${code}.${exchange}`, status: 'valid' })
    } else if (/^\d{6}\.(SH|SZ|BJ)$/i.test(line)) {
      const [code, exchange] = line.split('.') as [string, string]
      results.push({ code, name: code, symbol: `${code}.${exchange.toUpperCase()}`, status: 'valid' })
    } else if (STOCK_CODE_PATTERN.test(line)) {
      const code = line
      const exchange = detectExchange(code)
      results.push({ code, name: code, symbol: `${code}.${exchange}`, status: 'valid' })
    }
  }

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

/** 解析单行 CSV，支持引号包裹与转义双引号 */
function parseCsvLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]!
    if (inQuotes) {
      if (char === '"') {
        // 双引号转义
        if (line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += char
      }
    } else if (char === '"') {
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

/** 将原始字段数组转换为 BulkImportRow */
function buildRowFromFields(fields: string[]): BulkImportRow | null {
  const code = (fields[0] ?? '').trim()
  if (!STOCK_CODE_PATTERN.test(code)) return null
  const name = (fields[1] ?? '').trim().slice(0, MAX_NAME_LENGTH) || code
  const exchange = detectExchange(code)
  return { code, name, symbol: `${code}.${exchange}`, status: 'valid' }
}

/** 解析 CSV 文本为 BulkImportRow[] */
function parseCsvText(text: string): BulkImportRow[] {
  const results: BulkImportRow[] = []
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, INPUT_CONFIG.bulkImport.maxRows)

  const startIdx = isHeaderLine(lines[0]) ? 1 : 0

  for (let i = startIdx; i < lines.length; i++) {
    const fields = parseCsvLine(lines[i]!)
    const row = buildRowFromFields(fields)
    if (row) results.push(row)
  }

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

/**
 * 解析 JSON 文件
 *
 * 支持两种格式：
 * - 数组：[{"code":"600519","name":"贵州茅台"}, ...]
 * - 对象：{"stocks": [{"code":"600519","name":"贵州茅台"}]}
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

    const results: BulkImportRow[] = []
    for (const item of rawList.slice(0, INPUT_CONFIG.bulkImport.maxRows)) {
      if (item && typeof item === 'object') {
        const obj = item as Record<string, unknown>
        const rawCode = obj.code ?? obj.symbol ?? ''
        const code = (typeof rawCode === 'string' ? rawCode : JSON.stringify(rawCode)).trim()
        const rawName = obj.name ?? ''
        const name = (typeof rawName === 'string' ? rawName : JSON.stringify(rawName)).trim()
        if (STOCK_CODE_PATTERN.test(code)) {
          const exchange = detectExchange(code)
          results.push({
            code,
            name: name || code,
            symbol: `${code}.${exchange}`,
            status: 'valid',
          })
        }
      }
    }

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
