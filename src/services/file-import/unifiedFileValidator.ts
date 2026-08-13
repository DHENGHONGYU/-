/**
 * @fileoverview 统一文件校验中间件
 *
 * 提供文件上传后的统一校验流程，覆盖：
 * - 扩展名白名单校验
 * - 文件大小限制
 * - MIME 类型交叉校验
 * - 文件签名检测（ZIP/OLE2 拒绝）
 * - 编码检测（BOM/UTF-8/GBK）
 * - 行数限制（CSV/JSON）
 * - 内容哈希计算（SHA-256）
 *
 * @module services/file-import/unifiedFileValidator
 * @created 2026-07-14 - 双通道整改 P0-1
  * @doc [V9-DOC-BACK-012, V9-DOC-BACK-023, V9-DOC-BACK-033, V9-DOC-BACK-021, V9-DOC-BACK-026]
*/

import { getLogger } from '@/lib/logger'
import type {
  FileImportDataType,
  FileMetadata,
  FileValidationError,
  FileValidationResult,
  FileValidationWarning,
} from '@/types/modules/data-sync.types'

const logger = getLogger()

// ============================================================
// 校验常量
// ============================================================

/** 扩展名白名单 */
const ALLOWED_EXTENSIONS: ReadonlySet<string> = new Set([
  'csv', 'txt', 'json', 'xlsx', 'xls', 'md', 'html', 'htm', 'pdf', 'doc', 'docx',
])

/** 业务数据文件大小上限（10MB） */
const MAX_BUSINESS_FILE_SIZE = 10 * 1024 * 1024

/** 研报文档文件大小上限（50MB） */
const MAX_DOC_FILE_SIZE = 50 * 1024 * 1024

/** CSV/JSON 最大行数 */
const MAX_ROW_COUNT = 5000

/** CSV 单行最大长度 */
const MAX_LINE_LENGTH = 500

/** 扩展名到 MIME 类型映射 */
const EXTENSION_MIME_MAP: Readonly<Record<string, string>> = {
  csv: 'text/csv',
  txt: 'text/plain',
  json: 'application/json',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  md: 'text/markdown',
  html: 'text/html',
  htm: 'text/html',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}

/** ZIP 文件签名（PK） */
const ZIP_SIGNATURE = [0x50, 0x4b]

/** OLE2 文件签名（ÐÏ） */
const OLE2_SIGNATURE = [0xd0, 0xcf]

// BOM_CODE moved to detectEncoding logic inline

/** 文档类扩展名（适用 50MB 上限） */
const DOC_EXTENSIONS: ReadonlySet<string> = new Set(['pdf', 'doc', 'docx', 'md', 'html', 'htm'])

// ============================================================
// 工具函数
// ============================================================

/**
 * 从文件名提取扩展名（小写）
 * @param fileName - 文件名
 * @returns 扩展名（不含点），如 "csv"
 */
function extractExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.')
  if (lastDot < 0 || lastDot === fileName.length - 1) return ''
  return fileName.slice(lastDot + 1).toLowerCase()
}

/**
 * 读取文件头部字节用于签名检测
 * @param file - File 对象
 * @param byteCount - 读取字节数
 * @returns 头部字节数组
 */
async function readFileHeader(file: File, byteCount: number): Promise<Uint8Array> {
  // 优先使用 file.slice + arrayBuffer
  if (typeof (file as File & { slice?: (start: number, end: number) => Blob }).slice === 'function') {
    const slice = (file as File & { slice: (start: number, end: number) => Blob }).slice(0, byteCount)
    if (typeof (slice as Blob & { arrayBuffer?: () => Promise<ArrayBuffer> }).arrayBuffer === 'function') {
      const buffer = await (slice as Blob & { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer()
      return new Uint8Array(buffer)
    }
  }
  // 降级：FileReader 读取全部内容，截取头部
  const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(new Error(reader.error?.message ?? 'FileReader failed'))
    reader.readAsArrayBuffer(file)
  })
  return new Uint8Array(buffer.slice(0, byteCount))
}

/**
 * 检测文件签名是否为 ZIP/OLE2（拒绝二进制 Office 文件）
 * @param header - 文件头部字节
 * @returns 是否为被拒绝的签名
 */
function isRejectedSignature(header: Uint8Array): boolean {
  if (header.length < 2) return false
  const byte0 = header[0] ?? 0
  const byte1 = header[1] ?? 0
  const isZip = byte0 === ZIP_SIGNATURE[0] && byte1 === ZIP_SIGNATURE[1]
  const isOle2 = byte0 === OLE2_SIGNATURE[0] && byte1 === OLE2_SIGNATURE[1]
  return isZip || isOle2
}

/**
 * 检测文件编码
 * @param file - File 对象
 * @returns 编码类型
 */
async function detectEncoding(file: File): Promise<'utf-8' | 'gbk' | 'unknown'> {
  try {
    const header = await readFileHeader(file, Math.min(file.size, 4096))
    const bytes = header

    // 检测 BOM
    if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
      return 'utf-8'
    }
    if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
      return 'utf-8' // UTF-16LE，归类为 utf-8
    }

    // 简单 GBK 检测：高字节占比高且非 UTF-8 多字节序列
    let highByteCount = 0
    let validUtf8 = true
    for (let i = 0; i < bytes.length; i++) {
      const byte = bytes[i] ?? 0
      if (byte > 0x7f) {
        highByteCount++
        // 粗略 UTF-8 多字节序列校验
        if ((byte & 0xe0) === 0xc0 && i + 1 < bytes.length) {
          const nextByte = bytes[i + 1] ?? 0
          if ((nextByte & 0xc0) !== 0x80) validUtf8 = false
          i++
        } else if ((byte & 0xf0) === 0xe0 && i + 2 < bytes.length) {
          const next1 = bytes[i + 1] ?? 0
          const next2 = bytes[i + 2] ?? 0
          if ((next1 & 0xc0) !== 0x80 || (next2 & 0xc0) !== 0x80) validUtf8 = false
          i += 2
        } else {
          validUtf8 = false
        }
      }
    }

    if (validUtf8 && highByteCount > 0) return 'utf-8'
    if (highByteCount > bytes.length * 0.1) return 'gbk'
    return 'utf-8' // 纯 ASCII 归为 utf-8
  } catch (err) { console.warn('[unifiedFileValidator.ts]', err);
    return 'unknown'
  }
}

/**
 * 计算 SHA-256 哈希
 * @param file - File 对象
 * @returns 十六进制哈希字符串
 */
async function computeSHA256(file: File): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle != null) {
    let buffer: ArrayBuffer
    if (typeof (file as File & { arrayBuffer?: () => Promise<ArrayBuffer> }).arrayBuffer === 'function') {
      buffer = await (file as File & { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer()
    } else {
      // FileReader 降级
      buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as ArrayBuffer)
        reader.onerror = () => reject(new Error(reader.error?.message ?? 'FileReader failed'))
        reader.readAsArrayBuffer(file)
      })
    }
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }
  // 降级：使用文件大小+名称+修改时间作为伪哈希
  logger.warn('[computeSHA256] crypto.subtle 不可用，使用降级哈希')
  return `fallback-${file.size}-${file.name}-${file.lastModified}`
}

/**
 * 统计 CSV/JSON 行数
 * @param file - File 对象
 * @param encoding - 文件编码
 * @returns 行数
 */
async function countRows(file: File, encoding: 'utf-8' | 'gbk' | 'unknown'): Promise<number> {
  try {
    let text: string
    if (typeof (file as File & { text?: () => Promise<string> }).text === 'function') {
      text = await (file as File & { text: () => Promise<string> }).text()
    } else if (typeof (file as File & { arrayBuffer?: () => Promise<ArrayBuffer> }).arrayBuffer === 'function') {
      const buffer = await (file as File & { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer()
      text = new TextDecoder('utf-8').decode(buffer)
    } else {
      // FileReader 降级（jsdom 兼容）
      text = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => reject(new Error(reader.error?.message ?? 'FileReader failed'))
        reader.readAsText(file)
      })
    }
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0)
    return lines.length
  } catch {
    logger.warn('[countRows] 无法读取文件文本', { encoding })
    return 0
  }
}

/**
 * 根据扩展名推断数据类型
 * @param ext - 扩展名
 * @returns 推断的数据类型
 */
function inferDataType(ext: string): FileImportDataType {
  if (ext === 'json') return 'auto'
  if (ext === 'csv' || ext === 'txt') return 'auto'
  if (ext === 'xlsx' || ext === 'xls') return 'stocks'
  if (ext === 'md') return 'knowledgeDocs'
  if (ext === 'pdf' || ext === 'doc' || ext === 'docx') return 'researchReports'
  return 'auto'
}

// ============================================================
// 主校验入口
// ============================================================

/**
 * 统一文件校验
 *
 * 执行完整的文件校验流程，返回校验结果与元数据。
 *
 * @param file - 待校验的 File 对象
 * @param expectedType - 期望的数据类型（可选，用于交叉校验）
 * @returns 校验结果
 *
 * @example
 * ```typescript
 * const result = await validateFile(file, 'stocks')
 * if (!result.valid) {
 *   console.error(result.errors)
 * }
 * ```
 */
export async function validateFile(
  file: File,
  expectedType?: FileImportDataType,
): Promise<FileValidationResult> {
  const errors: FileValidationError[] = []
  const warnings: FileValidationWarning[] = []

  const ext = extractExtension(file.name)

  // 1. 扩展名校验
  if (!ext) {
    errors.push({
      code: 'MISSING_EXTENSION',
      message: `文件 "${file.name}" 缺少扩展名`,
    })
  } else if (!ALLOWED_EXTENSIONS.has(ext)) {
    errors.push({
      code: 'INVALID_EXTENSION',
      message: `不支持的文件扩展名 ".${ext}"，支持：${Array.from(ALLOWED_EXTENSIONS).join(', ')}`,
      field: 'extension',
      value: ext,
    })
  }

  // 2. 文件大小校验
  const maxSize = DOC_EXTENSIONS.has(ext) ? MAX_DOC_FILE_SIZE : MAX_BUSINESS_FILE_SIZE
  if (file.size === 0) {
    errors.push({
      code: 'EMPTY_FILE',
      message: '文件为空',
      field: 'size',
      value: 0,
    })
  } else if (file.size > maxSize) {
    errors.push({
      code: 'FILE_TOO_LARGE',
      message: `文件大小 ${(file.size / 1024 / 1024).toFixed(2)}MB 超过上限 ${(maxSize / 1024 / 1024).toFixed(0)}MB`,
      field: 'size',
      value: file.size,
    })
  }

  // 3. MIME 类型交叉校验
  const expectedMime = EXTENSION_MIME_MAP[ext]
  if ((expectedMime ?? '') !== '' && (file.type ?? '') !== '' && file.type !== expectedMime) {
    warnings.push({
      code: 'MIME_MISMATCH',
      message: `MIME 类型 "${file.type}" 与扩展名 ".${ext}" 预期 "${expectedMime}" 不匹配`,
      suggestion: '请确认文件内容与扩展名一致',
    })
  }

  // 4. 文件签名检测（仅对业务数据文件）
  if (file.size > 0 && !DOC_EXTENSIONS.has(ext)) {
    const header = await readFileHeader(file, 4)
    if (isRejectedSignature(header)) {
      errors.push({
        code: 'REJECTED_SIGNATURE',
        message: '检测到 ZIP/OLE2 文件签名，不支持二进制 Office 文件，请使用 CSV/JSON 格式',
        field: 'signature',
      })
    }
  }

  // 5. 编码检测
  const encoding = await detectEncoding(file)
  if (encoding === 'gbk') {
    warnings.push({
      code: 'GBK_ENCODING_DETECTED',
      message: '检测到 GBK 编码，系统将自动转换为 UTF-8',
      suggestion: '建议使用 UTF-8 编码保存文件',
    })
  }

  // 6. 行数统计（CSV/JSON/TXT）
  let rowCount: number | undefined
  if (['csv', 'txt', 'json'].includes(ext) && file.size > 0) {
    rowCount = await countRows(file, encoding)
    if (rowCount > MAX_ROW_COUNT) {
      errors.push({
        code: 'TOO_MANY_ROWS',
        message: `行数 ${rowCount} 超过上限 ${MAX_ROW_COUNT}`,
        field: 'rowCount',
        value: rowCount,
      })
    }
  }

  // 7. 计算哈希
  const hash = await computeSHA256(file)

  // 8. 推断数据类型
  const dataType = expectedType ?? inferDataType(ext)

  // 构建元数据
  const metadata: FileMetadata = {
    fileName: file.name,
    fileSize: file.size,
    fileType: dataType,
    mimeType: file.type ?? expectedMime ?? 'unknown',
    encoding,
    rowCount,
    hash,
  }

  const valid = errors.length === 0

  logger.info('[validateFile] 文件校验完成', {
    fileName: file.name,
    valid,
    errorCount: errors.length,
    warningCount: warnings.length,
  })

  return { valid, errors, warnings, metadata }
}

/**
 * 批量校验文件
 * @param files - File 对象数组
 * @param expectedType - 期望的数据类型
 * @returns 每个文件的校验结果数组
 */
export async function validateFiles(
  files: readonly File[],
  expectedType?: FileImportDataType,
): Promise<FileValidationResult[]> {
  return Promise.all(files.map(f => validateFile(f, expectedType)))
}

// ============================================================
// 导出常量（供外部引用）
// ============================================================

export {
  ALLOWED_EXTENSIONS,
  MAX_BUSINESS_FILE_SIZE,
  MAX_DOC_FILE_SIZE,
  MAX_ROW_COUNT,
  MAX_LINE_LENGTH,
}
