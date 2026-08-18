/**
 * @fileoverview 观察池定期自动复盘调度器 — 投研全链路编排器「缺口②」
 *
 * 长期观察池（intent.watchlist）在「纳入观察池」阶段落地后，若无定期复盘即沦为
 * 死列表：标的评分变化、是否达到研究池门槛都无人跟踪。本模块周期性地对观察池
 * 标的重新执行 V6 评分，计算相较上次复盘的评分漂移，并标记「可晋升研究池」候选
 * （评分越过研究阈值且当前不在研究池）。
 *
 * 设计原则（与 WeeklyReviewScheduler 对齐）：
 * - 观察池读取 / 评分器由调用方注入，保证测试中以 mock 驱动、生产以真实引擎驱动；
 * - 上次复盘快照存于内存（与 WeeklyReviewScheduler 一致，重启即清；持久化列为后续增强）；
 * - 复盘结果经 eventBus 广播（OBSERVATION_REVIEW_COMPLETED）。
 *
 * @module services/orchestration/observationPoolReviewer
 * @created 2026-08-17 - 投研编排器 spec 缺口② 闭环
 */

import { eventBus } from '@/lib/eventBus'
import { EVENT_NAMES } from '@/constants/store-channels.constants'
import { getLogger } from '@/lib/logger'
import { nanoid } from 'nanoid'
import type { PipelineScorer } from './researchPipelineOrchestrator'

const logger = getLogger()

// ---- 类型定义 ----

export interface ObservationReviewConfig {
  /** 是否启用定时自动复盘，默认 false（启用后按 intervalMs 周期执行） */
  enabled?: boolean
  /** 定时检查间隔（毫秒），默认 24h */
  intervalMs?: number
  /** 晋升研究池的评分阈值（V6 0-5 尺度），默认 3.0 */
  promotionThreshold?: number
  /** 是否自动将晋升候选标的入研究池，默认 false（需显式开启，避免误入池污染研究池） */
  autoEnroll?: boolean
}

export type ObservationRecommendation = 'promote' | 'hold' | 'watch'

export interface ObservationReviewItem {
  symbol: string
  name: string
  /** 上次复盘评分；首次复盘为 null */
  previousScore: number | null
  /** 本次复盘评分（V6 0-5 尺度） */
  currentScore: number
  /** 评分漂移 = currentScore - previousScore；首次为 null */
  scoreDelta: number | null
  /** 是否达到研究池评分门槛 */
  meetsResearchThreshold: boolean
  /** 是否可晋升研究池（达门槛 且 当前不在研究池） */
  promotionEligible: boolean
  recommendation: ObservationRecommendation
}

export interface ObservationReviewResult {
  id: string
  generatedAt: number
  items: ObservationReviewItem[]
  /** 可晋升研究池的标的 symbol 列表 */
  promotionCandidates: string[]
  /** 本次复盘实际自动入研究池的标的 symbol 列表（autoEnroll 开启且入池成功） */
  enrolled: string[]
  summary: {
    total: number
    promotionEligible: number
    /** 评分上升（相对上次）数量 */
    improved: number
    /** 评分下降数量 */
    declined: number
    /** 首次复盘或未变化数量 */
    unchanged: number
  }
}

export interface ObservationPoolReviewerDeps {
  /** 读取当前观察池标的（symbol + name） */
  getWatchlist: () => Promise<{ symbol: string; name: string }[]>
  /** V6 评分器 */
  scorer: PipelineScorer
  /** 判定某标的是否已在研究池（用于排除已晋升项）；默认返回 false（保守） */
  isInResearchPool?: (symbol: string) => Promise<boolean> | boolean
  /** 晋升阈值（V6 0-5 尺度），不传则取 config.promotionThreshold */
  promotionThreshold?: number
  /** 复盘快照持久化器（可选；提供则支持跨重启评分漂移比对，否则纯内存态） */
  persister?: ObservationReviewPersister
  /** 晋升动作：将观察池标的入研究池（可选；提供且 autoEnroll 开启时自动入池）。由调用方注入真实 researchPoolStore.addItem */
  enrollToResearchPool?: (symbol: string, name: string) => Promise<void> | void
}

// ---- 复盘快照持久化契约（与数据层 ObservationReviewRecord 解耦；由调用方注入实现） ----

export interface ObservationReviewPersistItem {
  symbol: string
  name: string
  previousScore: number | null
  currentScore: number
  scoreDelta: number | null
  meetsResearchThreshold: boolean
  promotionEligible: boolean
  recommendation: ObservationRecommendation
}

export interface ObservationReviewPersistSummary {
  total: number
  promotionEligible: number
  improved: number
  declined: number
  unchanged: number
}

export interface ObservationReviewPersistRecord {
  reviewId: string
  generatedAt: number
  items: ObservationReviewPersistItem[]
  summary: ObservationReviewPersistSummary
}

export interface ObservationReviewPersister {
  /** 载入上次复盘评分快照（symbol -> score），用于漂移计算；首次/无数据为空 */
  loadLastScores(): Promise<Map<string, number>>
  /** 持久化一次复盘结果 */
  saveReview(record: ObservationReviewPersistRecord): Promise<void>
}

const DEFAULT_CONFIG: Required<ObservationReviewConfig> = {
  enabled: false,
  intervalMs: 24 * 60 * 60 * 1000,
  promotionThreshold: 3.0,
  autoEnroll: false,
}

// ---- 观察池复盘调度器 ----

export class ObservationPoolReviewer {
  private config: Required<ObservationReviewConfig>
  private _active = false
  private timer: ReturnType<typeof setInterval> | null = null
  private reviews: ObservationReviewResult[] = []
  /** 上次复盘快照：symbol -> score */
  private lastScores: Map<string, number> = new Map()
  /** 定时/手动复盘所需的依赖（由调用方注入） */
  private deps: ObservationPoolReviewerDeps | null = null
  /** 是否已从持久化器载入过基线（仅首次载入一次，模拟重启后恢复） */
  private baselineLoaded = false

  constructor(config?: ObservationReviewConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /** 配置复盘依赖（观察池读取 + 评分器） */
  configure(deps: ObservationPoolReviewerDeps): void {
    this.deps = deps
  }

  get active(): boolean {
    return this._active
  }

  get configured(): boolean {
    return this.deps !== null
  }

  /** 启动调度器（启用定时时挂定时器；未配置依赖则定时为空转告警） */
  start(): void {
    if (this._active) return
    this._active = true
    if (this.config.enabled) this.startTimer()
    logger.info('[ObservationPoolReviewer] 已启动', {
      enabled: this.config.enabled,
      intervalMs: this.config.intervalMs,
      configured: this.configured,
    })
  }

  /** 停止调度器 */
  stop(): void {
    this.stopTimer()
    this._active = false
    logger.info('[ObservationPoolReviewer] 已停止')
  }

  private startTimer(): void {
    if (this.timer) return
    this.timer = setInterval(() => {
      void this.tick()
    }, this.config.intervalMs)
    logger.info('[ObservationPoolReviewer] 定时检查器已启动')
  }

  private stopTimer(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  /** 定时触发：未配置依赖时跳过并告警 */
  private async tick(): Promise<void> {
    if (!this.deps) {
      logger.warn('[ObservationPoolReviewer] 未配置 deps，跳过定时复盘')
      return
    }
    await this.run(this.deps)
  }

  /** 手动触发一次复盘（可覆盖依赖） */
  async manualTrigger(deps?: ObservationPoolReviewerDeps): Promise<ObservationReviewResult> {
    const effective = deps ?? this.deps
    if (!effective) {
      throw new Error('[ObservationPoolReviewer] 未配置 deps，无法执行复盘')
    }
    return this.run(effective)
  }

  /** 执行一次观察池复盘 */
  async run(deps: ObservationPoolReviewerDeps): Promise<ObservationReviewResult> {
    const threshold = deps.promotionThreshold ?? this.config.promotionThreshold
    const watchlist = await deps.getWatchlist()

    // 载入跨重启基线（仅首次）：若提供持久化器则从库恢复上次评分快照，使重启后仍能计算漂移
    if (deps.persister && !this.baselineLoaded) {
      try {
        const restored = await deps.persister.loadLastScores()
        if (this.lastScores.size === 0) this.lastScores = restored
      } catch {
        // 持久化不可用（测试/未初始化）时不阻断复盘
      }
      this.baselineLoaded = true
    }

    const items: ObservationReviewItem[] = []
    const promotionCandidates: string[] = []

    for (const w of watchlist) {
      const sr = await deps.scorer.run(w.symbol)
      const currentScore = sr.data?.score ?? 0
      const prev = this.lastScores.get(w.symbol) ?? null
      const scoreDelta = prev === null ? null : currentScore - prev
      const meets = currentScore >= threshold
      const inResearch = deps.isInResearchPool ? await deps.isInResearchPool(w.symbol) : false
      const promotionEligible = meets && !inResearch
      const recommendation: ObservationRecommendation = promotionEligible
        ? 'promote'
        : meets
          ? 'hold'
          : 'watch'
      if (promotionEligible) promotionCandidates.push(w.symbol)
      items.push({
        symbol: w.symbol,
        name: w.name,
        previousScore: prev,
        currentScore,
        scoreDelta,
        meetsResearchThreshold: meets,
        promotionEligible,
        recommendation,
      })
      // 更新快照（无论是否晋升，均记录当前评分用于下次漂移计算）
      this.lastScores.set(w.symbol, currentScore)
    }

    const improved = items.filter((i) => i.scoreDelta !== null && i.scoreDelta > 0).length
    const declined = items.filter((i) => i.scoreDelta !== null && i.scoreDelta < 0).length
    const unchanged = items.filter((i) => i.scoreDelta === null || i.scoreDelta === 0).length

    // 自动入池：autoEnroll 开启且注入 enrollToResearchPool 时，将晋升候选标的一一入研究池。
    // researchPoolStore.addItem 自带 DB 去重，重复入池安全返回 false，不阻断复盘。
    const enrolled: string[] = []
    if (this.config.autoEnroll && deps.enrollToResearchPool) {
      for (const item of items) {
        if (!item.promotionEligible) continue
        try {
          await deps.enrollToResearchPool(item.symbol, item.name)
          enrolled.push(item.symbol)
          logger.info('[ObservationPoolReviewer] 自动晋升入研究池', { symbol: item.symbol, name: item.name })
        } catch (err) {
          logger.warn('[ObservationPoolReviewer] 自动入研究池失败（已跳过，不阻断复盘）', {
            symbol: item.symbol,
            error: err instanceof Error ? err.message : String(err),
          })
        }
      }
    }

    const result: ObservationReviewResult = {
      id: nanoid(12),
      generatedAt: Date.now(),
      items,
      promotionCandidates,
      enrolled,
      summary: {
        total: items.length,
        promotionEligible: promotionCandidates.length,
        improved,
        declined,
        unchanged,
      },
    }

    // 持久化复盘快照（支持跨重启评分漂移比对；失败不阻断复盘）
    if (deps.persister) {
      const record: ObservationReviewPersistRecord = {
        reviewId: result.id,
        generatedAt: result.generatedAt,
        items: result.items.map((i) => ({ ...i })),
        summary: result.summary,
      }
      try {
        await deps.persister.saveReview(record)
      } catch {
        // 持久化失败（测试/未初始化）时不阻断复盘
      }
    }

    this.reviews.push(result)
    logger.info('[ObservationPoolReviewer] 复盘完成', {
      total: items.length,
      promotionEligible: promotionCandidates.length,
      improved,
      declined,
    })
    eventBus.emit(EVENT_NAMES.OBSERVATION_REVIEW_COMPLETED, result)
    return result
  }

  /** 获取最近一次复盘结果 */
  getLastReview(): ObservationReviewResult | null {
    return this.reviews.length > 0 ? (this.reviews[this.reviews.length - 1] ?? null) : null
  }

  /** 获取全部复盘结果 */
  getAllReviews(): ObservationReviewResult[] {
    return [...this.reviews]
  }

  /** 清空所有数据 */
  clear(): void {
    this.reviews = []
    this.lastScores.clear()
    this.baselineLoaded = false
    logger.info('[ObservationPoolReviewer] 已清空')
  }
}

// ---- 全局单例 ----

let _instance: ObservationPoolReviewer | null = null

export function getObservationPoolReviewer(config?: ObservationReviewConfig): ObservationPoolReviewer {
  _instance ??= new ObservationPoolReviewer(config)
  return _instance
}

export function startObservationPoolReviewer(
  config?: ObservationReviewConfig,
  deps?: ObservationPoolReviewerDeps,
): ObservationPoolReviewer {
  const reviewer = getObservationPoolReviewer(config)
  if (deps) reviewer.configure(deps)
  reviewer.start()
  return reviewer
}
