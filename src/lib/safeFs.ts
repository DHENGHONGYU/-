/**
 * 安全文件系统操作工具
 *
 * 封装 node:fs 的写操作，自动创建父目录，避免 ENOENT 异常。
 *
 * @module lib/safeFs
 */

import { mkdirSync, writeFileSync, type WriteFileOptions } from 'node:fs'
import { dirname } from 'node:path'

/**
 * 安全写入文件 — 自动创建父目录后再写入
 *
 * 替代直接调用 `writeFileSync`，避免目标目录不存在时抛 ENOENT。
 *
 * @param filePath 目标文件路径
 * @param data 文件内容
 * @param options 编码或选项（默认 'utf-8'）
 *
 * @example
 * ```ts
 * import { safeWriteFileSync } from '@/lib/safeFs'
 *
 * // 自动创建 docs/reports/ 目录
 * safeWriteFileSync('docs/reports/<your-report>.md', content)  // 示例路径，实际文件不存在
 * ```
 */
export function safeWriteFileSync(
  filePath: string,
  data: string | NodeJS.ArrayBufferView,
  options: WriteFileOptions = 'utf-8',
): void {
  mkdirSync(dirname(filePath), { recursive: true })
  writeFileSync(filePath, data, options)
}
