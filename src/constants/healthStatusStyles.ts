/**
 * 健康度仪表盘状态样式（集中管理，避免在页面层出现裸 Tailwind 色类）
  * @doc []
*/
export const HEALTH_STATUS_CLASSES: Record<string, string> = {
  healthy: 'border-emerald-500/30 bg-emerald-500/5',
  warning: 'border-amber-500/30 bg-amber-500/5',
  critical: 'border-rose-500/30 bg-rose-500/5',
  default: 'border-muted',
}
