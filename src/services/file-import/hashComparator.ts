/**
 * @fileoverview 哈希比对器
 *
 * 基于内容哈希的快速增量检测，用于：
 * - 文件整体哈希比对（与上次导入同文件比较）
 * - 逐记录哈希比对（与现有 IndexedDB 数据比较）
 * - 识别变更记录，支持增量更新
 *
 * @module services/file-import/hashComparator
 * @created 2026-07-14 - 双通道整改 P0-3
  * @doc [V9-DOC-BACK-012, V9-DOC-BACK-023, V9-DOC-BACK-033, V9-DOC-BACK-021, V9-DOC-BACK-026]
*/

import { getLogger } from '@/lib/logger'
import type { HashComparisonResult } from '@/types/modules/data-sync.types'

const logger = getLogger()

/** 需要排除的元数据字段（不参与哈希计算） */
const META_FIELDS_TO_EXCLUDE: ReadonlySet<string> = new Set([
  'lastUpdated',
  'dataVersion',
  'timestamp',
  '_meta',
  'createdAt',
  'updatedAt',
  'id',
])

/**
 * 排序对象 key（确保哈希一致性）
 * @param obj - 原始对象
 * @returns 排序后的对象
 */
function sortObjectKeys(obj: Record<string, unknown>): Record<string, unknown> {
  const sorted: Record<string, unknown> = {}
  for (const key of Object.keys(obj).sort()) {
    if (META_FIELDS_TO_EXCLUDE.has(key)) continue
    const val = obj[key]
    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      sorted[key] = sortObjectKeys(val as Record<string, unknown>)
    } else {
      sorted[key] = val
    }
  }
  return sorted
}

/**
 * 计算单条记录的内容哈希
 *
 * 排除元数据字段（lastUpdated/dataVersion/timestamp 等），
 * 仅对业务字段计算哈希，确保相同业务数据产生相同哈希。
 *
 * @param record - 数据记录
 * @returns SHA-256 十六进制哈希字符串
 */
export async function computeRecordHash(record: Record<string, unknown>): Promise<string> {
  const businessFields = sortObjectKeys(record)
  const jsonStr = JSON.stringify(businessFields)

  if (typeof crypto !== 'undefined' && crypto.subtle != null) {
    const encoder = new TextEncoder()
    const data = encoder.encode(jsonStr)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  // 降级：简单字符串哈希（FNV-1a）
  let hash = 0x811c9dc5
  for (let i = 0; i < jsonStr.length; i++) {
    hash ^= jsonStr.charCodeAt(i)
    hash = (hash * 0x01000193) >>> 0
  }
  return `fnv1a-${hash.toString(16)}`
}

/**
 * 计算文件整体哈希
 * @param file - File 对象
 * @returns SHA-256 十六进制哈希字符串
 */
export async function computeFileHash(file: File): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle != null) {
    let buffer: ArrayBuffer
    if (typeof (file as File & { arrayBuffer?: () => Promise<ArrayBuffer> }).arrayBuffer === 'function') {
      buffer = await (file as File & { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer()
    } else {
      buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as ArrayBuffer)
        reader.onerror = () => {
          if (reader.error) {
            reject(new Error(reader.error.message))
          } else {
            reject(new Error('FileReader failed'))
          }
        }
        reader.readAsArrayBuffer(file)
      })
    }
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }
  return `fallback-${file.size}-${file.name}`
}

/**
 * 将主键值安全转换为字符串
 */
function toPrimaryKeyString(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  return ''
}

/**
 * 比对新数据与现有数据的哈希
 *
 * @param newRecords - 文件中解析的新记录数组
 * @param existingRecords - IndexedDB 中的现有记录数组
 * @param primaryKey - 主键字段名（默认 "symbol"）
 * @returns 哈希比对结果
 */
export async function compareHashes(
  newRecords: readonly Record<string, unknown>[],
  existingRecords: readonly Record<string, unknown>[],
  primaryKey: string = 'symbol',
): Promise<HashComparisonResult> {
  const startTime = performance.now()

  // 计算现有记录的哈希映射
  const existingHashMap = new Map<string, string>()
  for (const record of existingRecords) {
    const key = toPrimaryKeyString(record[primaryKey])
    if (key) {
      const hash = await computeRecordHash(record)
      existingHashMap.set(key, hash)
    }
  }

  // 计算新记录的哈希并比对
  const recordHashes: Array<{
    symbol: string
    existingHash: string
    newHash: string
    changed: boolean
  }> = []
  const changedRecords: string[] = []

  for (const record of newRecords) {
    const key = toPrimaryKeyString(record[primaryKey])
    if (!key) continue

    const newHash = await computeRecordHash(record)
    const existingHash = existingHashMap.get(key) ?? ''
    const changed = existingHash !== newHash

    recordHashes.push({ symbol: key, existingHash, newHash, changed })
    if (changed) {
      changedRecords.push(key)
    }
  }

  const elapsed = performance.now() - startTime
  logger.info('[compareHashes] 哈希比对完成', {
    newCount: newRecords.length,
    existingCount: existingRecords.length,
    changedCount: changedRecords.length,
    elapsedMs: Math.round(elapsed),
  })

  return {
    fileHash: '', // 文件哈希由调用方通过 computeFileHash 单独计算
    fileChanged: true,
    recordHashes,
    changedRecords,
  }
}

/**
 * 创建文件级哈希比对结果
 *
 * @param currentFileHash - 当前文件哈希
 * @param lastImportHash - 上次导入的文件哈希（可选）
 * @param recordComparison - 逐记录比对结果（可选）
 * @returns 完整的哈希比对结果
 */
export function buildFileHashComparison(
  currentFileHash: string,
  lastImportHash?: string,
  recordComparison?: HashComparisonResult,
): HashComparisonResult {
  const fileChanged = (lastImportHash ?? '') === '' || currentFileHash !== lastImportHash

  return {
    fileHash: currentFileHash,
    lastImportHash,
    fileChanged,
    recordHashes: recordComparison?.recordHashes ?? [],
    changedRecords: recordComparison?.changedRecords ?? [],
  }
}
