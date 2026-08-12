/**
 * @fileoverview 数据层工具函数（向后兼容层）
 *
 * 从 db.ts 拆分而来（PR-6 步骤 1.1），职责：
 * - 提供 generateId()：基于 nanoid 的唯一 ID 生成器（16 位）
 * - 提供 now()：当前时间戳（毫秒）
 *
 * D3 迁移：实现已提升到 @/lib/utils，此处为向后兼容 re-export
 * 新代码应直接从 '@/lib/utils' 导入
  * @doc []
*/
export { generateId, now } from '@/lib/utils'
