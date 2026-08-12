/**
 * @fileoverview Markdown 文件解析器
 *
 * 将 Markdown 文件解析为知识库文档记录，支持：
 * - frontmatter 元数据提取
 * - 标题层级识别
 * - 内容截断
 * - symbol 关联（从标题或 frontmatter 提取）
 *
 * @module services/file-import/parsers/markdownParser
 * @created 2026-07-14 - 双通道整改 P3-1
  * @doc [V9-DOC-BACK-012, V9-DOC-BACK-023, V9-DOC-BACK-033, V9-DOC-BACK-021, V9-DOC-BACK-026]
*/

import { getLogger } from '@/lib/logger'
import { safeRegex } from '@/lib/safeRegex'
import { STORE_NAME } from '@/config/dbConfig'
import type { FileParser, ParseOptions, ParsedData } from '@/types/modules/data-sync.types'

const logger = getLogger()

/** 默认最大内容长度 */
const DEFAULT_MAX_CONTENT_LENGTH = 50_000

/** A 股代码正则 */
const STOCK_CODE_PATTERN = /\b(\d{6})\b/g

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
 * 从 Markdown 内容提取 frontmatter
 * @param content - Markdown 文本
 * @returns frontmatter 对象和剩余内容
 */
function extractFrontmatter(content: string): {
  frontmatter: Record<string, string>
  body: string
} {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n/
  const match = content.match(frontmatterRegex)
  if (!match) {
    return { frontmatter: {}, body: content }
  }

  const fmText = match[1] ?? ''
  const body = content.slice(match[0].length)
  const frontmatter: Record<string, string> = {}

  for (const line of fmText.split('\n')) {
    const colonIdx = line.indexOf(':')
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim()
      const value = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, '')
      if (key && value) {
        frontmatter[key] = value
      }
    }
  }

  return { frontmatter, body }
}

/**
 * 从内容中提取标题
 * @param content - Markdown 文本
 * @returns 第一个一级或二级标题
 */
function extractTitle(content: string): string {
  const titleRegex = /^#{1,2}\s+(.+)$/m
  const match = content.match(titleRegex)
  return match?.[1]?.trim() ?? '未命名文档'
}

/**
 * 从内容中提取关联的股票代码
 * @param content - Markdown 文本
 * @returns 股票代码数组（去重）
 */
function extractStockCodes(content: string): string[] {
  const codes = new Set<string>()
  let match: RegExpExecArray | null
  const pattern = safeRegex(STOCK_CODE_PATTERN.source, 'g')
  while ((match = pattern.exec(content)) !== null) {
    codes.add(match[1] ?? '')
  }
  return Array.from(codes).slice(0, 20)
}

/**
 * Markdown 文件解析器
 */
export const markdownParser: FileParser = {
  extensions: ['md', 'markdown'],
  dataType: 'knowledgeDocs',

  async parse(file: File, _options?: ParseOptions): Promise<ParsedData> {
    const rawText = await readFileText(file)
    const { frontmatter, body } = extractFrontmatter(rawText)

    // 截断内容
    const content = body.length > DEFAULT_MAX_CONTENT_LENGTH
      ? body.slice(0, DEFAULT_MAX_CONTENT_LENGTH) + '\n\n[... 内容已截断]'
      : body

    const title = frontmatter.title ?? extractTitle(body)
    const stockCodes = extractStockCodes(rawText)

    // 构建记录
    const record: Record<string, unknown> = {
      id: `${file.name}-${file.lastModified}`,
      fileName: file.name,
      title,
      content,
      contentHash: '', // 由调用方通过 hashComparator 计算
      fileSize: file.size,
      lastModified: new Date(file.lastModified).toISOString(),
      symbols: stockCodes,
      category: frontmatter.category ?? '策略笔记',
      tags: frontmatter.tags?.split(',').map((t: string) => t.trim()) ?? [],
      source: 'file-import',
    }

    logger.info('[markdownParser] 解析完成', {
      fileName: file.name,
      title,
      contentLength: content.length,
      symbolCount: stockCodes.length,
    })

    return {
      dataType: 'knowledgeDocs',
      targetStore: STORE_NAME.localDocs,
      records: [record],
      parseMeta: {
        totalRows: 1,
        parsedRows: 1,
        skippedRows: 0,
        columns: Object.keys(record),
      },
    }
  },
}
