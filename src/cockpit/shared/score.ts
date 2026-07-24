/**
 * @deprecated 评分逻辑已提升为跨模块共享，迁至 `@/lib/utils/score`。
 *
 * 本文件仅保留 re-export 兼容垫片，避免改动 5 个 cockpit widget 的 import；
 * 下个清理周期可将这些 import 直接改为 `@/lib/utils/score` 并删除本文件。
 */
export * from '@/lib/utils/score'
