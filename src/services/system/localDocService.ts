import { STORE_NAME } from '@/config/dbConfig'
import { generateId } from '@/lib/utils'
import type { DataLayerResult, LocalDoc } from '@/data/types'
import { queryList, queryByIndex } from '@/data/dataLayerHelpers'
import { ENVELOPE_ACTION, ENVELOPE_TARGET, MODULE_ID } from '@/config/dbConfig'
import { dataBridge } from '@/core/databridge'
import { EnvelopeFactory } from '@/core/envelope'
import { getLogger } from '@/lib/logger'
import { embedText, findTopK, getEmbeddingStatus } from '@/services/system/localEmbeddingService'
import { nanoid } from 'nanoid'

const logger = getLogger()

/**
 * 通过 DataBridge 保存本地文档
 */
async function saveLocalDocViaBridge(doc: LocalDoc): Promise<DataLayerResult<void>> {
  try {
    const envelope = EnvelopeFactory.create(
      {
        source: MODULE_ID.system,
        target: ENVELOPE_TARGET.db,
        action: ENVELOPE_ACTION.saveLocalDocs,
        traceId: `localdoc-${nanoid(8)}-${doc.id}`,
      },
      doc,
    )
    await dataBridge.forward(envelope)
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('[localDocService] saveLocalDocs failed', { id: doc.id, error: message })
    return { success: false, error: message }
  }
}

export interface FileEntry {
  name: string
  path: string
  size: number
  content: string
  lastModified: number
}

export interface ScanResult {
  files: FileEntry[]
  totalSize: number
  errors: string[]
}

const HARD_CODED_NAME_MAP: Record<string, { symbol: string; name: string }> = {
  茅台: { symbol: '600519.SH', name: '贵州茅台' },
  腾讯: { symbol: '00700.HK', name: '腾讯控股' },
  比亚迪: { symbol: '002594.SZ', name: '比亚迪' },
  宁德: { symbol: '300750.SZ', name: '宁德时代' },
}

const ALLOWED_EXTENSIONS = new Set([
  'txt',
  'md',
  'pdf',
  'doc',
  'docx',
  'html',
  'htm',
])

const BINARY_EXTENSIONS = new Set(['pdf', 'doc', 'docx'])

const MAX_CONTENT_LENGTH = 50_000

interface FileSystemHandleLike {
  readonly kind: 'file' | 'directory'
  readonly name: string
}

interface FileSystemFileHandleLike extends FileSystemHandleLike {
  readonly kind: 'file'
  getFile(): Promise<File>
}

interface FileSystemDirectoryHandleLike extends FileSystemHandleLike {
  readonly kind: 'directory'
  values(): AsyncIterable<FileSystemHandleLike>
}

interface WindowWithFilePicker extends Window {
  showDirectoryPicker(): Promise<FileSystemDirectoryHandleLike>
}

function normalizeName(filename: string): string {
  const base = filename.split(/[\\/]/).pop() ?? filename
  return base.replace(/\.[^.]+$/, '')
}

/**
 * parseSymbolFromFilename
 * @param filename
 */
export function parseSymbolFromFilename(filename: string): { symbol: string; name: string } {
  for (const [key, mapping] of Object.entries(HARD_CODED_NAME_MAP)) {
    if (filename.includes(key)) {
      return mapping
    }
  }

  if (/行业|宏观|策略/.test(filename)) {
    return { symbol: 'ALL', name: normalizeName(filename) }
  }

  const hkMatch = filename.match(/(\d{1,5})\.HK\b/i) ?? filename.match(/hk(\d{1,5})/i)
  if (hkMatch?.[1]) {
    const code = hkMatch[1].padStart(5, '0')
    return { symbol: `${code}.HK`, name: normalizeName(filename) }
  }

  const aShareMatch = filename.match(/(\d{6})/)
  if (aShareMatch?.[1]) {
    const code = aShareMatch[1]
    const prefix = code.startsWith('6') || code.startsWith('5') ? 'SH' : 'SZ'
    return { symbol: `${code}.${prefix}`, name: normalizeName(filename) }
  }

  return { symbol: 'UNKNOWN', name: filename }
}

/**
 * categorizeDocument
 */
export function categorizeDocument(
  filename: string,
  content: string,
): LocalDoc['category'] {
  const text = `${filename} ${content}`.toLowerCase()

  if (/研报|research/.test(text)) return '研报'
  if (/财报|年报|季报/.test(text)) return '财报'
  if (/行业|sector/.test(text)) return '行业分析'
  if (/新闻|news/.test(text)) return '新闻'
  if (/策略|笔记|strategy/.test(text)) return '策略笔记'
  return '其他'
}

/** 摘要提取默认最大长度 */
const DEFAULT_SUMMARY_MAX_LEN = 300

/**
 * extractSummary
 * @param content
 * @param maxLen
 * @returns string
 */
export function extractSummary(content: string, maxLen = DEFAULT_SUMMARY_MAX_LEN): string {
  if (!content) return ''
  return content.slice(0, Math.max(0, maxLen))
}

/** 文档分块默认大小（字符数） */
const DEFAULT_CHUNK_SIZE = 800
/** 文档分块默认重叠（字符数） */
const DEFAULT_CHUNK_OVERLAP = 100

/**
 * splitIntoChunks
 */
export function splitIntoChunks(
  text: string,
  chunkSize = DEFAULT_CHUNK_SIZE,
  overlap = DEFAULT_CHUNK_OVERLAP,
): string[] {
  if (chunkSize <= 0) return []
  if (text.length <= chunkSize) return text ? [text] : []

  const chunks: string[] = []
  const step = Math.max(1, chunkSize - overlap)

  for (let i = 0; i < text.length; i += step) {
    chunks.push(text.slice(i, i + chunkSize))
    if (i + chunkSize >= text.length) break
  }

  return chunks
}

/**
 * 读取单个文件内容：二进制文件返回占位文本，超长文本截断到 MAX_CONTENT_LENGTH。
 */
async function readDocContent(file: File, ext: string): Promise<string> {
  if (BINARY_EXTENSIONS.has(ext)) {
    return `[${ext.toUpperCase()}文件: ${file.name}]`
  }
  const text = await file.text()
  return text.length > MAX_CONTENT_LENGTH ? text.slice(0, MAX_CONTENT_LENGTH) : text
}

/**
 * scanFolder
 * @returns Promise<ScanResult | null>
 */
export async function scanFolder(): Promise<ScanResult | null> {
  if (
    typeof window === 'undefined' ||
    typeof (window as unknown as WindowWithFilePicker).showDirectoryPicker !==
      'function'
  ) {
    return null
  }

  const result: ScanResult = { files: [], totalSize: 0, errors: [] }
  const win = window as unknown as WindowWithFilePicker

  async function processFileEntry(
    entry: FileSystemHandleLike,
    entryPath: string,
  ): Promise<void> {
    const dotIndex = entry.name.lastIndexOf('.')
    const ext = dotIndex > 0 ? entry.name.slice(dotIndex + 1).toLowerCase() : ''
    if (!ALLOWED_EXTENSIONS.has(ext)) return

    try {
      const fileHandle = entry as FileSystemFileHandleLike
      const file = await fileHandle.getFile()
      const content = await readDocContent(file, ext)

      result.files.push({
        name: file.name,
        path: entryPath,
        size: file.size,
        content,
        lastModified: file.lastModified,
      })
      result.totalSize += file.size
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      result.errors.push(`Failed to read ${entryPath}: ${message}`)
    }
  }

  async function scanDirectory(
    dirHandle: FileSystemDirectoryHandleLike,
    currentPath: string,
  ): Promise<void> {
    for await (const entry of dirHandle.values()) {
      const entryPath = currentPath ? `${currentPath}/${entry.name}` : entry.name

      if (entry.kind === 'directory') {
        await scanDirectory(entry as FileSystemDirectoryHandleLike, entryPath)
        continue
      }

      if (entry.kind !== 'file') continue

      await processFileEntry(entry, entryPath)
    }
  }

  try {
    const dirHandle = await win.showDirectoryPicker()
    await scanDirectory(dirHandle, dirHandle.name)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    result.errors.push(`Failed to open directory: ${message}`)
  }

  return result
}

/**
 * importFilesToDatabase
 */
export async function importFilesToDatabase(
  scanResult: ScanResult,
): Promise<{ imported: number; errors: string[] }> {
  const errors: string[] = [...scanResult.errors]
  let imported = 0

  for (const file of scanResult.files) {
    const { symbol } = parseSymbolFromFilename(file.name)
    const category = categorizeDocument(file.name, file.content)

    const doc: LocalDoc = {
      id: generateId(),
      symbol,
      name: normalizeName(file.name),
      content: file.content,
      category,
      tags: [category, symbol],
      sourcePath: file.path,
      size: file.size,
      addedAt: Date.now(),
    }

    const saveResult = await saveLocalDocViaBridge(doc)
    if (!saveResult.success) {
      errors.push(`Failed to import ${file.name}: ${saveResult.error}`)
    } else {
      imported += 1
    }
  }

  return { imported, errors }
}

/**
 * createLocalDoc — 创建本地文档（自动生成嵌入向量）
 */
export async function createLocalDoc(
  doc: Omit<LocalDoc, 'id' | 'addedAt'>,
): Promise<DataLayerResult<LocalDoc>> {
  const fullDoc: LocalDoc = { ...doc, id: generateId(), addedAt: Date.now() }

  // 尝试生成嵌入向量（失败不阻塞，仅降级）
  try {
    const status = getEmbeddingStatus()
    if (status.loaded || !status.loading) {
      const embeddingResult = await embedText(fullDoc.content)
      if (embeddingResult.success) {
        fullDoc.embedding = embeddingResult.vector
      }
    }
  } catch { console.warn('[localDocService.ts] 嵌入生成失败不阻断文档创建, using fallback') }

  const result = await saveLocalDocViaBridge(fullDoc)
  if (!result.success) {
    logger.error('createLocalDoc failed', { error: result.error })
    return { success: false, error: result.error }
  }

  return { success: true, data: fullDoc }
}

function calculateMatchScore(doc: LocalDoc, normalizedKeyword: string): number {
  const symbolLower = doc.symbol.toLowerCase()
  if (symbolLower === normalizedKeyword) return 3

  const nameLower = doc.name.toLowerCase()
  const categoryLower = doc.category.toLowerCase()
  const tagsLower = doc.tags.join(' ').toLowerCase()
  if (
    nameLower.includes(normalizedKeyword) ||
    categoryLower.includes(normalizedKeyword) ||
    tagsLower.includes(normalizedKeyword)
  ) {
    return 2
  }

  const contentLower = doc.content.toLowerCase()
  if (contentLower.includes(normalizedKeyword)) return 1

  return 0
}

/**
 * searchLocalDocs
 */
export async function searchLocalDocs(
  keyword: string,
): Promise<DataLayerResult<LocalDoc[]>> {
  try {
    const all = await queryList<LocalDoc>(STORE_NAME.localDocs)
    const normalizedKeyword = keyword.trim().toLowerCase()

    if (!normalizedKeyword) {
      return { success: true, data: all }
    }

    const scored = all
      .map((doc) => ({ doc, score: calculateMatchScore(doc, normalizedKeyword) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((item) => item.doc)

    return { success: true, data: scored }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('searchLocalDocs failed', { error: message })
    return { success: false, error: message }
  }
}

/**
 * searchLocalDocsSemantic — 语义搜索本地知识库
 *
 * 使用向量嵌入 + 余弦相似度进行语义检索。
 * 当嵌入不可用时静默降级为关键词搜索。
 */
export async function searchLocalDocsSemantic(
  query: string,
  topK: number = 5,
  symbol?: string,
): Promise<DataLayerResult<LocalDoc[]>> {
  try {
    const all = await queryList<LocalDoc>(STORE_NAME.localDocs)
    let docs = all

    // 按标的筛选
    if (symbol) {
      docs = docs.filter((d) => d.symbol === symbol || d.symbol === 'ALL')
    }

    if (docs.length === 0) {
      return { success: true, data: [] }
    }

    // 尝试语义检索
    try {
      const queryResult = await embedText(query)
      if (queryResult.success) {
        const candidates = docs
          .filter((d) => d.embedding && d.embedding.length > 0)
          .map((d) => ({ id: d.id, vector: d.embedding! }))

        if (candidates.length > 0) {
          const hits = findTopK(queryResult.vector, candidates, topK)
          const hitIds = new Set(hits.map((h) => h.id))
          const semanticDocs = hits
            .map((h) => docs.find((d) => d.id === h.id))
            .filter((d): d is LocalDoc => d !== undefined)

          // 补充：未命中嵌入但关键词匹配的文档
          const fallbackDocs = docs.filter((d) => !hitIds.has(d.id))

          return { success: true, data: [...semanticDocs, ...fallbackDocs].slice(0, topK) }
        }
      }
    } catch {
      // 嵌入检索失败，静默降级
      logger.warn('[localDocService] 语义检索不可用，回退关键词搜索')
    }

    // 降级：纯关键词搜索
    const normalizedQuery = query.trim().toLowerCase()
    const keywordHits = docs
      .map((doc) => ({ doc, score: calculateMatchScore(doc, normalizedQuery) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((item) => item.doc)
      .slice(0, topK)

    return { success: true, data: keywordHits }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('searchLocalDocsSemantic failed', { error: message })
    return { success: false, error: message }
  }
}

/**
 * batchEmbedLocalDocs — 为没有嵌入向量的文档批量生成嵌入（后台任务）
 * @param limit 每次处理的最大文档数
 */
export async function batchEmbedLocalDocs(limit: number = 10): Promise<{ processed: number; failed: number }> {
  try {
    const all = await queryList<LocalDoc>(STORE_NAME.localDocs)
    const pending = all.filter((d) => !d.embedding || d.embedding.length === 0).slice(0, limit)

    let processed = 0
    let failed = 0

    for (const doc of pending) {
      try {
        const result = await embedText(doc.content)
        if (result.success) {
          doc.embedding = result.vector
          const saveResult = await saveLocalDocViaBridge(doc)
          if (saveResult.success) {
            processed++
          } else {
            failed++
          }
        } else {
          failed++
        }
      } catch {
        failed++
      }
    }

    logger.info('[localDocService] batchEmbedLocalDocs 完成', { processed, failed, total: pending.length })
    return { processed, failed }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('[localDocService] batchEmbedLocalDocs 失败', { error: message })
    return { processed: 0, failed: 0 }
  }
}

/**
 * listLocalDocs
 */
export async function listLocalDocs(
  symbol?: string,
): Promise<DataLayerResult<LocalDoc[]>> {
  try {
    const docs =
      symbol !== undefined && symbol.trim() !== ''
        ? await queryByIndex<LocalDoc>(STORE_NAME.localDocs, 'by-symbol', symbol)
        : await queryList<LocalDoc>(STORE_NAME.localDocs)
    return { success: true, data: docs }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('listLocalDocs failed', { error: message })
    return { success: false, error: message }
  }
}
