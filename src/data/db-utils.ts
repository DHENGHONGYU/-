/**
 * @fileoverview 数据层工具函数
 *
 * 从 db.ts 拆分而来（PR-6 步骤 1.1），职责：
 * - 提供 generateId()：基于 nanoid 的唯一 ID 生成器（16 位）
 * - 提供 now()：当前时间戳（毫秒）
 *
 * 设计原则：纯工具函数，零状态，可被任意层安全引入。
 * 通过 db.ts 的 re-export 保持 '@/data/db' 路径向后兼容。
 */
import { nanoid } from 'nanoid'

/**
 * 生成 16 位唯一 ID
 * @returns 16 字符长度的 nanoid 字符串（URL 安全字符集）
 */
export function generateId(): string {
  return nanoid(16)
}

/**
 * 获取当前时间戳（毫秒）
 * @returns Unix 时间戳（毫秒）
 */
export function now(): number {
  return Date.now()
}
