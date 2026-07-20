/**
 * 投研闭环（LoopBanner）类型定义
 *
 * 闭环方法论：采集 → 评分 → 信号 → 交易 → 复盘。
 * LoopBanner 将五个阶段的实时状态（最近事件时间、当日事件计数、健康状态）
 * 可视化为 PortalShell 顶栏下方的 slim 横幅。
 *
 * 本文件位于 src/types/，零依赖，可被所有层引用。
 */

/**
 * 闭环五阶段标识
 *
 * - `collect`：采集（股票池/采集任务/采集测试事件）
 * - `score`：评分（V6/智能/行业评分事件）
 * - `signal`：信号（信号生成/信号质量/轮动信号事件）
 * - `trade`：交易（订单/持仓事件）
 * - `review`：复盘（交易纪律复盘事件）
 */
export type LoopStageId = 'collect' | 'score' | 'signal' | 'trade' | 'review'

/**
 * 阶段健康状态
 *
 * - `idle`：从未收到任何事件（无数据）
 * - `active`：最近事件未超过 stale 阈值（今日有事件或近期有事件）
 * - `stale`：最近事件距今超过 stale 阈值（无新事件）
 */
export type LoopStageHealth = 'idle' | 'active' | 'stale'

/**
 * 单个闭环阶段的运行时状态
 */
export interface LoopStage {
  /** 阶段标识 */
  id: LoopStageId
  /** 阶段显示名（由 config 注入，避免 UI 硬编码） */
  label: string
  /** 健康状态（由 store.refresh 依据阈值重算） */
  health: LoopStageHealth
  /** 最近一次事件时间戳（epoch ms），null 表示从未收到事件 */
  lastEventAt: number | null
  /** 当日（本地时区自然日）事件计数 */
  todayCount: number
}

/**
 * 闭环快照（组件渲染用派生视图）
 */
export interface LoopSnapshot {
  /** 按闭环顺序排列的五阶段状态 */
  stages: readonly LoopStage[]
  /** 快照生成时间戳（epoch ms） */
  updatedAt: number
  /** 闭环达成：五阶段当日均有事件 */
  loopComplete: boolean
}
