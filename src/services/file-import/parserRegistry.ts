/**
 * @fileoverview 文件解析器注册表
 *
 * 管理文件解析器的注册、查询与分发。
 * 根据文件扩展名自动选择对应的解析器，支持多格式扩展。
 *
 * @module services/file-import/parserRegistry
 * @created 2026-07-14 - 双通道整改 P0-1
  * @doc [V9-DOC-BACK-012, V9-DOC-BACK-023, V9-DOC-BACK-033, V9-DOC-BACK-021, V9-DOC-BACK-026]
*/

import { getLogger } from '@/lib/logger'
import type { FileParser, ParseOptions, ParsedData } from '@/types/modules/data-sync.types'

const logger = getLogger()

// ============================================================
// 注册表核心
// ============================================================

/** 解析器实例映射（扩展名 → 解析器） */
const parserMap = new Map<string, FileParser>()

/**
 * 注册文件解析器
 * @param parser - 解析器实例
 */
export function registerParser(parser: FileParser): void {
  for (const ext of parser.extensions) {
    if (parserMap.has(ext)) {
      logger.warn('[registerParser] 扩展名已注册，将被覆盖', { ext, existing: parserMap.get(ext)?.constructor?.name })
    }
    parserMap.set(ext, parser)
  }
  logger.info('[registerParser] 解析器已注册', {
    extensions: parser.extensions,
    dataType: parser.dataType,
  })
}

/**
 * 根据扩展名获取解析器
 * @param extension - 文件扩展名（不含点，小写）
 * @returns 解析器实例，未找到返回 null
 */
export function getParser(extension: string): FileParser | null {
  const parser = parserMap.get(extension.toLowerCase())
  if (!parser) {
    logger.warn('[getParser] 未找到解析器', { extension })
    return null
  }
  return parser
}

/**
 * 根据文件名获取解析器
 * @param fileName - 文件名
 * @returns 解析器实例，未找到返回 null
 */
export function getParserByFileName(fileName: string): FileParser | null {
  const lastDot = fileName.lastIndexOf('.')
  if (lastDot < 0) return null
  const ext = fileName.slice(lastDot + 1).toLowerCase()
  return getParser(ext)
}

/**
 * 解析文件（自动选择解析器）
 * @param file - File 对象
 * @param options - 解析选项
 * @returns 解析结果
 * @throws 未找到解析器时抛出错误
 */
export async function parseFile(
  file: File,
  options?: ParseOptions,
): Promise<ParsedData> {
  const parser = getParserByFileName(file.name)
  if (!parser) {
    const ext = file.name.split('.').pop() ?? ''
    throw new Error(`不支持文件扩展名 ".${ext}"，支持的格式：${getSupportedExtensions().join(', ')}`)
  }

  logger.info('[parseFile] 开始解析文件', {
    fileName: file.name,
    parser: parser.constructor?.name ?? 'unknown',
    dataType: parser.dataType,
  })

  const result = await parser.parse(file, options)

  logger.info('[parseFile] 解析完成', {
    fileName: file.name,
    totalRows: result.parseMeta.totalRows,
    parsedRows: result.parseMeta.parsedRows,
    skippedRows: result.parseMeta.skippedRows,
  })

  return result
}

/**
 * 获取所有已注册的解析器
 * @returns 解析器数组
 */
export function getAllParsers(): FileParser[] {
  const seen = new Set<FileParser>()
  for (const parser of parserMap.values()) {
    seen.add(parser)
  }
  return Array.from(seen)
}

/**
 * 获取所有支持的扩展名
 * @returns 扩展名数组
 */
export function getSupportedExtensions(): string[] {
  return Array.from(parserMap.keys()).sort()
}

/**
 * 检查扩展名是否支持
 * @param extension - 扩展名
 * @returns 是否支持
 */
export function isExtensionSupported(extension: string): boolean {
  return parserMap.has(extension.toLowerCase())
}

/**
 * 清除所有已注册的解析器（测试用）
 */
export function clearParsers(): void {
  parserMap.clear()
  logger.info('[clearParsers] 所有解析器已清除')
}
