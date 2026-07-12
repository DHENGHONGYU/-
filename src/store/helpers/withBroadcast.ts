/**
 * @module store/helpers/withBroadcast
 * @lifecycle @Global
 * @description Store 写操作广播工具（向后兼容 re-export）
 *
 * 实际实现已迁移至 @/lib/withBroadcast，此处保留 re-export 以维持向后兼容。
 * 新代码请直接使用 @/lib/withBroadcast。
 *
 * @deprecated 请直接从 '@/lib/withBroadcast' 导入
 */

export { withBroadcast, createBroadcaster } from '@/lib/withBroadcast'
