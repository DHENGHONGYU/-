/**
 * @fileoverview dataLayer 共享辅助函数（向后兼容层）
 *
 * D1 迁移：实现已提升到 @/core/databridgeQueries，明确归属 DataBridge 体系
 * 新代码应直接从 '@/core/databridgeQueries' 导入
 *
 * 历史：从 dataLayer.ts 拆分而来，提供 createTraceId / sendWriteEnvelope / queryGet / queryList / queryByIndex
 * 现仅为 re-export，保持调用方零修改兼容
 */
export { createTraceId } from '@/lib/utils'
export {
  sendWriteEnvelope,
  queryGet,
  queryList,
  queryByIndex,
} from '@/core/databridgeQueries'
