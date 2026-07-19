/**
 * @module collectionWizardStore.utils
 * @description 数据采集向导工具函数
 *
 * 包含：
 * - 链路追踪 ID 生成
 * - 耗时格式化
 * - 配置 ID 生成
/** 生成链路追踪 ID  * @doc [V9-DOC-DATA-031, V9-DOC-DATA-032, V9-DOC-DATA-076, V9-DOC-DATA-075, V9-DOC-DATA-073]
*/
export function generateTraceId(): string {
  return `trace_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

/** 格式化耗时（< 1s 显示 ms，否则显示 s） */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

/** 生成配置模板 ID（与 collectionWizardPersistence 中的 ID 保持一致） */
export function generateConfigId(): string {
  return `wizard_config_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}
