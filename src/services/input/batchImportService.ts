import { addStock, type AddStockOptions } from './inputService'
import { dataLayer } from '@/data/dataLayer'
import { INPUT_CONFIG } from '@/config/inputConfig'
import { getLogger } from '@/lib/logger'
import type { DataLayerResult, Stock } from '@/data/types'

const logger = getLogger()

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

/** 单行原始文本最大长度（防止恶意超长输入） */
const MAX_LINE_LENGTH = 200

/** 股票名称最大长度 */
const MAX_NAME_LENGTH = 50

/** BOM 头字符码点 */
const BOM_CHAR_CODE = 0xfeff

/** A 股代码格式：6 位数字 */
const STOCK_CODE_PATTERN = /^\d{6}$/

function detectExchange(code: string): string {
  if (STOCK_CODE_PATTERN.test(code)) {
    return code.startsWith('6') ? 'SH' : 'SZ'
  }
  return ''
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

/**
 * 检测重复并标记每行状态
 *
 * - 代码格式不合规 → invalid
 * - 与现有候选池重复 / 批次内重复 → duplicate
 * - 其余 → valid
 *
 * @param rows 待检测的行
 * @param existingSymbols 现有候选池 symbol 集合（如 "600519.SH"）
 */
export function detectDuplicates(
  rows: BulkImportRow[],
  existingSymbols: Set<string>,
): BulkImportRow[] {
  logger.info('[batchImport] 检测重复与校验', {
    rowCount: rows.length,
    existingCount: existingSymbols.size,
  })

  const seenInBatch = new Set<string>()

  const result = rows.map((row) => {
    // 代码格式校验
    if (!STOCK_CODE_PATTERN.test(row.code)) {
      return {
        ...row,
        status: 'invalid' as const,
        statusReason: '代码格式不合规（需为 6 位数字）',
      }
    }
    // 与候选池重复
    if (existingSymbols.has(row.symbol)) {
      return {
        ...row,
        status: 'duplicate' as const,
        statusReason: '与候选池已存在重复',
      }
    }
    // 批次内重复
    if (seenInBatch.has(row.symbol)) {
      return {
        ...row,
        status: 'duplicate' as const,
        statusReason: '与本次导入列表内重复',
      }
    }
    seenInBatch.add(row.symbol)
    return { ...row, status: 'valid' as const, statusReason: undefined }
  })

  const counts = result.reduce(
    (acc, r) => {
      acc[r.status]++
      return acc
    },
    { valid: 0, duplicate: 0, invalid: 0 },
  )
  logger.info('[batchImport] 重复检测完成', counts)

  return result
}

/**
 * 下载 CSV 导入模板（含表头与示例数据）
 *
 * 使用 Blob + URL.createObjectURL 触发浏览器下载，附带 BOM 以兼容 Excel。
 */
export function downloadTemplate(): void {
  logger.info('[batchImport] 下载导入模板')
  try {
    const header = INPUT_CONFIG.bulkImport.templateHeader.join(',')
    const examples = INPUT_CONFIG.bulkImport.templateExamples
      .map((e) => `${e.code},${e.name}`)
      .join('\n')
    // BOM 头确保 Excel 正确识别 UTF-8 中文
    const content = `${String.fromCharCode(BOM_CHAR_CODE)}${header}\n${examples}\n`

    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = INPUT_CONFIG.bulkImport.templateFileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  } catch (err) {
    logger.error('[batchImport] 模板下载失败', {
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

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
