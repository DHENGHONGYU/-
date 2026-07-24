/**
 * @fileoverview 催化事件追踪器 — 监听新闻事件，自动识别并记录催化事件
 *
 * 通过关键词匹配解析新闻标题和内容，识别催化类型（财报/政策/行业/公告/技术突破/管理层），
 * 评估影响方向（positive/negative/neutral）和影响程度（1-5），记录并广播催化事件。
 *
 * @module services/orchestration/catalystTracker
 * @created 2026-07-25 - P1 编排器扩展
 */

import { eventBus } from '@/lib/eventBus'
import { EVENT_NAMES } from '@/constants/store-channels.constants'
import { getLogger } from '@/lib/logger'
import { nanoid } from 'nanoid'

const logger = getLogger()

// ---- 类型定义 ----

export type CatalystType = 'earnings' | 'policy' | 'industry' | 'announcement' | 'tech_breakthrough' | 'management'
export type CatalystImpact = 'positive' | 'negative' | 'neutral'

export interface CatalystEvent {
  id: string
  symbol: string
  type: CatalystType
  title: string
  impact: CatalystImpact
  impactScore: number       // 1-5
  detectedAt: number
  source: string
  description: string
  strategyResponse?: string
}

export interface CatalystTrackerConfig {
  /** 是否自动检测催化事件（默认 true） */
  autoDetect?: boolean
  /** 最低记录阈值（默认 3），低于此分数的催化事件不记录 */
  minImpactScore?: number
  /** 关注的股票列表，空数组表示关注全部（默认 []） */
  watchSymbols?: string[]
}

// ---- 关键词映射 ----

/** 催化类型关键词映射 */
const CATALYST_TYPE_KEYWORDS: Record<CatalystType, string[]> = {
  earnings: ['财报', '业绩', '营收', '利润', 'EPS', '业绩预告', '业绩修正'],
  policy: ['政策', '监管', '审批', '许可', '法规', '补贴', '税收'],
  industry: ['行业', '板块', '趋势', '竞争', '市场', '份额'],
  announcement: ['公告', '公示', '声明', '决议', '计划'],
  tech_breakthrough: ['技术', '研发', '专利', '突破', '创新', '芯片', '算法'],
  management: ['管理层', '董事', '高管', '人事', '变动', '辞职', '任命'],
}

/** 正面影响关键词 */
const POSITIVE_KEYWORDS = ['增长', '超预期', '突破', '上涨', '利好', '提升', '创新高']

/** 负面影响关键词 */
const NEGATIVE_KEYWORDS = ['下降', '低预期', '下跌', '利空', '减持', '风险', '预警', '处罚']

// ---- 默认配置 ----

const DEFAULT_CONFIG: Required<CatalystTrackerConfig> = {
  autoDetect: true,
  minImpactScore: 3,
  watchSymbols: [],
}

// ---- 催化事件追踪器 ----

export class CatalystTracker {
  private config: Required<CatalystTrackerConfig>
  private unsubscribers: (() => void)[] = []
  private _active = false
  /** 按 symbol 索引的催化事件列表 */
  private catalysts: Map<string, CatalystEvent[]> = new Map()
  /** 全量催化事件列表（保持插入顺序） */
  private allCatalystsList: CatalystEvent[] = []

  constructor(config?: CatalystTrackerConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /** 启动追踪器 — 订阅新闻加载事件 */
  start(): void {
    if (this._active) return
    this._active = true

    const unsub = eventBus.on(EVENT_NAMES.NEWS_ARTICLE_LOADED, (payload: unknown) => {
      if (!this.config.autoDetect) return
      this.handleNewsLoaded(payload)
    })

    this.unsubscribers.push(unsub)
    logger.info('[CatalystTracker] 已启动，监听新闻事件')
  }

  /** 停止追踪器 */
  stop(): void {
    this.unsubscribers.forEach((fn) => fn())
    this.unsubscribers = []
    this._active = false
    logger.info('[CatalystTracker] 已停止')
  }

  get active(): boolean {
    return this._active
  }

  // ---- 事件处理 ----

  /** 处理新闻加载事件 */
  private handleNewsLoaded(payload: unknown): void {
    const p = payload as {
      articles?: Array<{
        symbol?: string
        title?: string
        content?: string
        source?: string
        publishTime?: string | number
      }>
      article?: {
        symbol?: string
        title?: string
        content?: string
        source?: string
        publishTime?: string | number
      }
    }

    const articles = p.articles ?? (p.article ? [p.article] : [])
    if (articles.length === 0) return

    for (const article of articles) {
      const symbol = article.symbol ?? ''
      const title = article.title ?? ''
      const content = article.content ?? ''

      // 如果配置了关注列表且 symbol 不在列表中，跳过
      if (this.config.watchSymbols.length > 0 && symbol && !this.config.watchSymbols.includes(symbol)) {
        continue
      }

      const detected = this.detectCatalyst(symbol, title, content, article.source ?? '')
      if (detected) {
        this.recordCatalyst(detected)
      }
    }
  }

  /** 通过关键词匹配识别催化事件 */
  private detectCatalyst(
    symbol: string,
    title: string,
    content: string,
    source: string,
  ): CatalystEvent | null {
    const text = `${title} ${content}`.toLowerCase()

    // 识别催化类型
    let matchedType: CatalystType | null = null
    let matchCount = 0

    for (const [type, keywords] of Object.entries(CATALYST_TYPE_KEYWORDS) as [CatalystType, string[]][]) {
      const count = keywords.reduce((acc, kw) => acc + (text.includes(kw) ? 1 : 0), 0)
      if (count > matchCount) {
        matchCount = count
        matchedType = type
      }
    }

    if (!matchedType || matchCount === 0) return null

    // 评估影响方向
    const positiveHits = POSITIVE_KEYWORDS.filter((kw) => text.includes(kw)).length
    const negativeHits = NEGATIVE_KEYWORDS.filter((kw) => text.includes(kw)).length

    let impact: CatalystImpact = 'neutral'
    if (positiveHits > negativeHits) {
      impact = 'positive'
    } else if (negativeHits > positiveHits) {
      impact = 'negative'
    }

    // 评估影响程度（1-5）
    const impactScore = this.calculateImpactScore(impact, matchCount, positiveHits, negativeHits)

    // 低于阈值不记录
    if (impactScore < this.config.minImpactScore) return null

    return {
      id: nanoid(12),
      symbol,
      type: matchedType,
      title,
      impact,
      impactScore,
      detectedAt: Date.now(),
      source,
      description: content.slice(0, 200),
    }
  }

  /** 计算影响程度分数 */
  private calculateImpactScore(
    impact: CatalystImpact,
    typeMatchCount: number,
    positiveHits: number,
    negativeHits: number,
  ): number {
    let score = 1

    // 基础分：类型关键词命中数
    score += Math.min(typeMatchCount, 3)

    // 方向一致性加分
    if (impact === 'positive' && positiveHits >= 2) {
      score += 1
    } else if (impact === 'negative' && negativeHits >= 2) {
      score += 1
    }

    // neutral 类型的催化事件分数上限为 2
    if (impact === 'neutral') {
      score = Math.min(score, 2)
    }

    return Math.min(Math.max(score, 1), 5) as CatalystEvent['impactScore']
  }

  /** 记录催化事件并广播 */
  private recordCatalyst(event: CatalystEvent): void {
    // 存入 symbol 索引
    if (!this.catalysts.has(event.symbol)) {
      this.catalysts.set(event.symbol, [])
    }
    this.catalysts.get(event.symbol)!.push(event)

    // 存入全量列表
    this.allCatalystsList.push(event)

    logger.info('[CatalystTracker] 检测到催化事件', {
      symbol: event.symbol,
      type: event.type,
      impact: event.impact,
      score: event.impactScore,
      title: event.title.slice(0, 30),
    })

    // 广播催化事件
    eventBus.emit(EVENT_NAMES.CATALYST_DETECTED, event)

    // 如果有策略响应，额外广播
    if (event.strategyResponse) {
      eventBus.emit(EVENT_NAMES.CATALYST_STRATEGY_RESPONSE, event)
    }
  }

  // ---- 查询接口 ----

  /** 获取指定股票的催化事件列表 */
  getCatalysts(symbol: string): CatalystEvent[] {
    return this.catalysts.get(symbol) ?? []
  }

  /** 获取全部催化事件列表 */
  getAllCatalysts(): CatalystEvent[] {
    return [...this.allCatalystsList]
  }

  /** 获取高影响催化事件 */
  getHighImpactCatalysts(minScore: number): CatalystEvent[] {
    return this.allCatalystsList.filter((e) => e.impactScore >= minScore)
  }

  /** 清空所有催化事件 */
  clear(): void {
    this.catalysts.clear()
    this.allCatalystsList = []
    logger.info('[CatalystTracker] 已清空催化事件')
  }
}

// ---- 全局单例 ----

let _instance: CatalystTracker | null = null

export function getCatalystTracker(config?: CatalystTrackerConfig): CatalystTracker {
  if (!_instance) _instance = new CatalystTracker(config)
  return _instance
}

export function startCatalystTracker(config?: CatalystTrackerConfig): CatalystTracker {
  const tracker = getCatalystTracker(config)
  tracker.start()
  return tracker
}
