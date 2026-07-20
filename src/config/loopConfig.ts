/**
 * 闭环横幅（LoopBanner）配置
 *
 * 集中管理闭环五阶段的顺序、显示名、stale 阈值、轮询刷新间隔，
 * 以及 EventBus 事件 → 闭环阶段的映射表。禁止在 store/service/UI 中硬编码。
 *
 * 事件名均引用 @/constants/store-channels.constants 的 EVENT_NAMES，
 * 与实际生产侧 withBroadcast 广播的事件保持一致（详见各 store 写操作）。
 *
 * 本文件位于 src/config/，仅可依赖 constants/ 与 types/。
 */

import { EVENT_NAMES } from '@/constants/store-channels.constants'
import type { LoopStageId } from '@/types/modules/loop.types'

/**
 * EventBus 事件 → 闭环阶段映射条目
 */
export interface LoopEventStageMapping {
  /** EventBus 事件名（来自 EVENT_NAMES） */
  event: string
  /** 归属的闭环阶段 */
  stage: LoopStageId
}

/**
 * 闭环配置
 */
export interface LoopConfig {
  /** stale 判定阈值（毫秒）：最近事件距今超过该值视为 stale，默认 24h */
  staleThresholdMs: number
  /** UI 定时刷新间隔（毫秒）：用于重算 stale 状态与相对时间，默认 60s */
  refreshIntervalMs: number
  /** 事件 → 阶段映射表（service 据此订阅 EventBus） */
  eventStageMap: readonly LoopEventStageMapping[]
  /** 阶段展示顺序（采集 → 评分 → 信号 → 交易 → 复盘） */
  stageOrder: readonly LoopStageId[]
  /** 阶段显示名 */
  stageLabels: Readonly<Record<LoopStageId, string>>
}

/** 24 小时（毫秒），stale 默认阈值 */
const DEFAULT_STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000

/** 60 秒（毫秒），UI 定时刷新默认间隔 */
const DEFAULT_REFRESH_INTERVAL_MS = 60 * 1000

/**
 * 获取默认闭环配置
 *
 * @returns 闭环配置对象（每次调用返回新对象，调用方不应原地修改）
 */
export function getDefaultLoopConfig(): LoopConfig {
  return {
    staleThresholdMs: DEFAULT_STALE_THRESHOLD_MS,
    refreshIntervalMs: DEFAULT_REFRESH_INTERVAL_MS,
    stageOrder: ['collect', 'score', 'signal', 'trade', 'review'],
    stageLabels: {
      collect: '采集',
      score: '评分',
      signal: '信号',
      trade: '交易',
      review: '复盘',
    },
    eventStageMap: [
      // 采集：股票池变更 / 采集测试与采集运行时数据变更
      { event: EVENT_NAMES.POOL_CHANGED, stage: 'collect' },
      { event: EVENT_NAMES.STOCKS_CHANGED, stage: 'collect' },
      { event: EVENT_NAMES.DATA_TEST_CHANGED, stage: 'collect' },
      // 评分：V6 个股评分 / 分析评分 / 智能评分 / 行业评分
      { event: EVENT_NAMES.V6_SCORES_CHANGED, stage: 'score' },
      { event: EVENT_NAMES.SCORES_CHANGED, stage: 'score' },
      { event: EVENT_NAMES.INTELLIGENT_SCORES_CHANGED, stage: 'score' },
      { event: EVENT_NAMES.INDUSTRY_SCORES_CHANGED, stage: 'score' },
      // 信号：信号生成 / 信号质量 / 轮动信号触发
      { event: EVENT_NAMES.SIGNALS_CHANGED, stage: 'signal' },
      { event: EVENT_NAMES.SIGNAL_QUALITY_CHANGED, stage: 'signal' },
      { event: EVENT_NAMES.ROTATION_SIGNAL_TRIGGERED, stage: 'signal' },
      // 交易：订单 / 持仓
      { event: EVENT_NAMES.ORDERS_CHANGED, stage: 'trade' },
      { event: EVENT_NAMES.HOLDINGS_CHANGED, stage: 'trade' },
      // 复盘：交易纪律复盘（trade_reviews 存储由 disciplineStore 消费）
      { event: EVENT_NAMES.DISCIPLINE_CHANGED, stage: 'review' },
    ],
  }
}
