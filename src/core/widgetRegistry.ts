/**
 * @module core/widgetRegistry
 * @description WidgetRegistry 核心层导出（从 cockpit/core/widgetRegistry 迁移）
 * @migration 2026-07-06 跨层违规修复：store 层禁止直接导入 cockpit 层
 * @remarks 此文件仅做 re-export，实际实现仍在 cockpit/core/widgetRegistry.ts
 */
export { widgetRegistry, WidgetRegistry } from '@/cockpit/core/widgetRegistry'
export type { WidgetTemplate } from '@/cockpit/core/widgetRegistry'
