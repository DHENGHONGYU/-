/**
 * @doc [V9-DOC-BACK-005, V9-DOC-BACK-012, V9-DOC-BACK-010, V9-DOC-PROJ-003, V9-DOC-ARCH-008]
 */
import { getLogger } from '@/lib/logger'
import type { WidgetMeta, WidgetConfig, WidgetRuntimeState, MarketData } from '@/types/modules/widget.types'
import { DEFAULT_WIDGET_CONFIG, WIDGET_DEFAULT_DATA_SOURCE, WIDGET_CROSS_LAYOUT } from '@/constants/cockpit.constants'

const logger = getLogger()

type RegistryListener = (event: { type: string; widgetId?: string; instanceId?: string }) => void

export interface WidgetTemplate {
  meta: WidgetMeta
  /** Widget 组件统一接收 config 与 MarketData；data 可由 MarketDataProvider 注入 */
  component: () => Promise<{ default: React.ComponentType<{ config: WidgetConfig; data?: MarketData }> }>
  configPanel?: () => Promise<{ default: React.ComponentType }>
}

/**
 * WidgetRegistry
 */
export class WidgetRegistry {
  private templates = new Map<string, WidgetTemplate>()
  private instances = new Map<string, WidgetConfig>()
  private runtimeStates = new Map<string, WidgetRuntimeState>()
  private listeners = new Set<RegistryListener>()
  private instanceCounter = 0

  constructor() {
    logger.info('[WidgetRegistry] Initializing...')
    this.registerDefaultWidgets()
  }

  private registerDefaultWidgets(): void {
    const widgets: WidgetTemplate[] = [
      {
        meta: {
          id: 'marketIndices',
          name: DEFAULT_WIDGET_CONFIG.marketIndices.title,
          category: DEFAULT_WIDGET_CONFIG.marketIndices.category,
          description: '展示大盘指数实时数据',
          defaultSize: DEFAULT_WIDGET_CONFIG.marketIndices.size,
          defaultDataSource: WIDGET_DEFAULT_DATA_SOURCE.marketIndices,
        },
        component: () => import('@/cockpit/widgets/MarketIndicesWidget'),
      },
      {
        meta: {
          id: 'sectorHeatmap',
          name: DEFAULT_WIDGET_CONFIG.sectorHeatmap.title,
          category: DEFAULT_WIDGET_CONFIG.sectorHeatmap.category,
          description: '展示板块涨跌幅热力图',
          defaultSize: DEFAULT_WIDGET_CONFIG.sectorHeatmap.size,
          defaultDataSource: WIDGET_DEFAULT_DATA_SOURCE.sectorHeatmap,
        },
        component: () => import('@/cockpit/widgets/SectorHeatmapWidget'),
      },
      {
        meta: {
          id: 'fundFlow',
          name: DEFAULT_WIDGET_CONFIG.fundFlow.title,
          category: DEFAULT_WIDGET_CONFIG.fundFlow.category,
          description: '展示资金流向数据',
          defaultSize: DEFAULT_WIDGET_CONFIG.fundFlow.size,
          defaultDataSource: WIDGET_DEFAULT_DATA_SOURCE.fundFlow,
        },
        component: () => import('@/cockpit/widgets/FundFlowWidget'),
      },
      {
        meta: {
          id: 'marketSentiment',
          name: DEFAULT_WIDGET_CONFIG.marketSentiment.title,
          category: DEFAULT_WIDGET_CONFIG.marketSentiment.category,
          description: '展示市场情绪指标',
          defaultSize: DEFAULT_WIDGET_CONFIG.marketSentiment.size,
          defaultDataSource: WIDGET_DEFAULT_DATA_SOURCE.marketSentiment,
        },
        component: () => import('@/cockpit/widgets/MarketSentimentWidget'),
      },
      {
        meta: {
          id: 'watchlist',
          name: DEFAULT_WIDGET_CONFIG.watchlist.title,
          category: DEFAULT_WIDGET_CONFIG.watchlist.category,
          description: '展示自选股列表',
          defaultSize: DEFAULT_WIDGET_CONFIG.watchlist.size,
          defaultDataSource: WIDGET_DEFAULT_DATA_SOURCE.watchlist,
        },
        component: () => import('@/cockpit/widgets/WatchlistWidget'),
      },
      {
        meta: {
          id: 'portfolioOverview',
          name: DEFAULT_WIDGET_CONFIG.portfolioOverview.title,
          category: DEFAULT_WIDGET_CONFIG.portfolioOverview.category,
          description: '展示持仓概览',
          defaultSize: DEFAULT_WIDGET_CONFIG.portfolioOverview.size,
          defaultDataSource: WIDGET_DEFAULT_DATA_SOURCE.portfolioOverview,
        },
        component: () => import('@/cockpit/widgets/PortfolioOverviewWidget'),
      },
      {
        meta: {
          id: 'aiTradeReview',
          name: DEFAULT_WIDGET_CONFIG.aiTradeReview.title,
          category: DEFAULT_WIDGET_CONFIG.aiTradeReview.category,
          description: 'AI 交易复盘分析',
          defaultSize: DEFAULT_WIDGET_CONFIG.aiTradeReview.size,
          defaultDataSource: WIDGET_DEFAULT_DATA_SOURCE.aiTradeReview,
        },
        component: () => import('@/cockpit/widgets/AITradeReviewWidget'),
      },
      // ============================================================
      // 新增金融业务 Widget 注册
      // ============================================================
      {
        meta: {
          id: 'investmentProfile',
          name: DEFAULT_WIDGET_CONFIG.investmentProfile.title,
          category: DEFAULT_WIDGET_CONFIG.investmentProfile.category,
          description: '投资画像/分析中心',
          defaultSize: DEFAULT_WIDGET_CONFIG.investmentProfile.size,
          defaultDataSource: WIDGET_DEFAULT_DATA_SOURCE.investmentProfile,
        },
        component: () => import('@/cockpit/widgets/InvestmentProfileWidget'),
      },
      {
        meta: {
          id: 'poolBoard',
          name: DEFAULT_WIDGET_CONFIG.poolBoard.title,
          category: DEFAULT_WIDGET_CONFIG.poolBoard.category,
          description: '股票池看板（分页/添加/监控）',
          defaultSize: DEFAULT_WIDGET_CONFIG.poolBoard.size,
          defaultDataSource: WIDGET_DEFAULT_DATA_SOURCE.poolBoard,
        },
        component: () => import('@/cockpit/widgets/PoolBoardWidget'),
      },
      {
        meta: {
          id: 'kaiScore',
          name: DEFAULT_WIDGET_CONFIG.kaiScore.title,
          category: DEFAULT_WIDGET_CONFIG.kaiScore.category,
          description: 'KAI 选股综合评分图谱',
          defaultSize: DEFAULT_WIDGET_CONFIG.kaiScore.size,
          defaultDataSource: WIDGET_DEFAULT_DATA_SOURCE.kaiScore,
        },
        component: () => import('@/cockpit/widgets/KaiScoreWidget'),
      },
      {
        meta: {
          id: 'modelCompare',
          name: DEFAULT_WIDGET_CONFIG.modelCompare.title,
          category: DEFAULT_WIDGET_CONFIG.modelCompare.category,
          description: 'AI 大模型智能对比',
          defaultSize: DEFAULT_WIDGET_CONFIG.modelCompare.size,
          defaultDataSource: WIDGET_DEFAULT_DATA_SOURCE.modelCompare,
        },
        component: () => import('@/cockpit/widgets/ModelCompareWidget'),
      },
      {
        meta: {
          id: 'stockChat',
          name: DEFAULT_WIDGET_CONFIG.stockChat.title,
          category: DEFAULT_WIDGET_CONFIG.stockChat.category,
          description: '个股/市场深度分析聊天',
          defaultSize: DEFAULT_WIDGET_CONFIG.stockChat.size,
          defaultDataSource: WIDGET_DEFAULT_DATA_SOURCE.stockChat,
        },
        component: () => import('@/cockpit/widgets/StockChatWidget'),
      },
      {
        meta: {
          id: 'hotSector',
          name: DEFAULT_WIDGET_CONFIG.hotSector.title,
          category: DEFAULT_WIDGET_CONFIG.hotSector.category,
          description: '热门板块策略评分与相关标的',
          defaultSize: DEFAULT_WIDGET_CONFIG.hotSector.size,
          defaultDataSource: WIDGET_DEFAULT_DATA_SOURCE.hotSector,
        },
        component: () => import('@/cockpit/widgets/HotSectorWidget'),
      },
      {
        meta: {
          id: 'valuePit',
          name: DEFAULT_WIDGET_CONFIG.valuePit.title,
          category: DEFAULT_WIDGET_CONFIG.valuePit.category,
          description: '价值洼地候选、五维评分与轮动信号状态',
          defaultSize: DEFAULT_WIDGET_CONFIG.valuePit.size,
          defaultDataSource: WIDGET_DEFAULT_DATA_SOURCE.valuePit,
        },
        component: () => import('@/cockpit/widgets/ValuePitWidget'),
      },
      {
        meta: {
          id: 'signalQuality',
          name: DEFAULT_WIDGET_CONFIG.signalQuality.title,
          category: DEFAULT_WIDGET_CONFIG.signalQuality.category,
          description: '信号质量复盘仪表盘，展示准确率/胜率/Sharpe 等绩效指标',
          defaultSize: DEFAULT_WIDGET_CONFIG.signalQuality.size,
          defaultDataSource: WIDGET_DEFAULT_DATA_SOURCE.signalQuality,
        },
        component: () => import('@/cockpit/widgets/SignalQualityDashboardWidget'),
      },
      // ============================================================
      // 系统监控与高级分析 Widget 注册
      // ============================================================
      {
        meta: {
          id: 'agentPerformance',
          name: DEFAULT_WIDGET_CONFIG.agentPerformance.title,
          category: DEFAULT_WIDGET_CONFIG.agentPerformance.category,
          description: '智能体性能追踪与健康状态监控',
          defaultSize: DEFAULT_WIDGET_CONFIG.agentPerformance.size,
          defaultDataSource: WIDGET_DEFAULT_DATA_SOURCE.agentPerformance,
        },
        component: () => import('@/cockpit/widgets/AgentPerformanceWidget'),
      },
      {
        meta: {
          id: 'pnlAnalysis',
          name: DEFAULT_WIDGET_CONFIG.pnlAnalysis.title,
          category: DEFAULT_WIDGET_CONFIG.pnlAnalysis.category,
          description: '交易盈亏归因分析与趋势追踪',
          defaultSize: DEFAULT_WIDGET_CONFIG.pnlAnalysis.size,
          defaultDataSource: WIDGET_DEFAULT_DATA_SOURCE.pnlAnalysis,
        },
        component: () => import('@/cockpit/widgets/PnLAnalysisWidget'),
      },
      {
        meta: {
          id: 'positionControl',
          name: DEFAULT_WIDGET_CONFIG.positionControl.title,
          category: DEFAULT_WIDGET_CONFIG.positionControl.category,
          description: '仓位管理与风险控制面板',
          defaultSize: DEFAULT_WIDGET_CONFIG.positionControl.size,
          defaultDataSource: WIDGET_DEFAULT_DATA_SOURCE.positionControl,
        },
        component: () => import('@/cockpit/widgets/PositionControlWidget'),
      },
      {
        meta: {
          id: 'riskMonitor',
          name: DEFAULT_WIDGET_CONFIG.riskMonitor.title,
          category: DEFAULT_WIDGET_CONFIG.riskMonitor.category,
          description: '实时风险指标监控与预警',
          defaultSize: DEFAULT_WIDGET_CONFIG.riskMonitor.size,
          defaultDataSource: WIDGET_DEFAULT_DATA_SOURCE.riskMonitor,
        },
        component: () => import('@/cockpit/widgets/RiskMonitorWidget'),
      },
      {
        meta: {
          id: 'signalMonitor',
          name: DEFAULT_WIDGET_CONFIG.signalMonitor.title,
          category: DEFAULT_WIDGET_CONFIG.signalMonitor.category,
          description: '交易信号实时追踪与置信度评估',
          defaultSize: DEFAULT_WIDGET_CONFIG.signalMonitor.size,
          defaultDataSource: WIDGET_DEFAULT_DATA_SOURCE.signalMonitor,
        },
        component: () => import('@/cockpit/widgets/SignalMonitorWidget'),
      },
      {
        meta: {
          id: 'industryChain',
          name: DEFAULT_WIDGET_CONFIG.industryChain.title,
          category: DEFAULT_WIDGET_CONFIG.industryChain.category,
          description: '19 个行业节点上下游产业链关系图谱',
          defaultSize: DEFAULT_WIDGET_CONFIG.industryChain.size,
          defaultDataSource: WIDGET_DEFAULT_DATA_SOURCE.industryChain,
        },
        component: () => import('@/cockpit/widgets/IndustryChainWidget'),
      },
      {
        meta: {
          id: 'catalystEvent',
          name: DEFAULT_WIDGET_CONFIG.catalystEvent.title,
          category: DEFAULT_WIDGET_CONFIG.catalystEvent.category,
          description: '催化剂事件监控：业绩发布、政策会议、解禁、分红等',
          defaultSize: DEFAULT_WIDGET_CONFIG.catalystEvent.size,
          defaultDataSource: WIDGET_DEFAULT_DATA_SOURCE.catalystEvent,
        },
        component: () => import('@/cockpit/widgets/CatalystEventWidget'),
      },
      {
        meta: {
          id: 'keyDataCalendar',
          name: DEFAULT_WIDGET_CONFIG.keyDataCalendar.title,
          category: DEFAULT_WIDGET_CONFIG.keyDataCalendar.category,
          description: '核心经济数据日历：CPI、GDP、PMI、社融等发布时间与预期',
          defaultSize: DEFAULT_WIDGET_CONFIG.keyDataCalendar.size,
          defaultDataSource: WIDGET_DEFAULT_DATA_SOURCE.keyDataCalendar,
        },
        component: () => import('@/cockpit/widgets/KeyDataCalendarWidget'),
      },
    ]

    // 注入纵横交叉布局元数据（domain + perspective）
    widgets.forEach((widget) => {
      const crossLayout = WIDGET_CROSS_LAYOUT[widget.meta.id]
      if (crossLayout) {
        widget.meta.domain = crossLayout.domain
        widget.meta.perspective = crossLayout.perspective
      }
    })

    widgets.forEach((widget) => this.register(widget))
    this.createDefaultInstances()
  }

  private createDefaultInstances(): void {
    const defaultLayout = [
      // ============================================================
      // L1: 投资总览 — "市场怎样？我的持仓怎样？"（首屏可见）
      // ============================================================
      { widgetId: 'marketIndices',     position: { x: 0, y: 0 } },   // 大盘指数
      { widgetId: 'sectorHeatmap',     position: { x: 0, y: 2 } },   // 板块热力图
      { widgetId: 'fundFlow',          position: { x: 2, y: 2 } },   // 资金流向
      { widgetId: 'portfolioOverview', position: { x: 0, y: 4 } },   // 持仓概览

      // ============================================================
      // L2: 策略与时机 — "何时行动？什么催化剂？什么数据？"
      // ============================================================
      { widgetId: 'catalystEvent',     position: { x: 0, y: 6 } },   // 催化剂事件
      { widgetId: 'keyDataCalendar',   position: { x: 2, y: 6 } },   // 核心数据日历
      { widgetId: 'marketSentiment',   position: { x: 0, y: 8 } },   // 市场情绪
      { widgetId: 'signalQuality',     position: { x: 2, y: 8 } },   // 信号质量复盘

      // ============================================================
      // L3: 智能研判 — "该关注什么？哪些标的有机会？"
      // ============================================================
      { widgetId: 'kaiScore',          position: { x: 0, y: 10 } },  // KAI选股综合评分
      { widgetId: 'poolBoard',         position: { x: 0, y: 13 } },  // 股票池看板
      { widgetId: 'hotSector',         position: { x: 0, y: 15 } },  // 热门板块策略
      { widgetId: 'valuePit',          position: { x: 0, y: 17 } },  // 价值洼地策略
      { widgetId: 'investmentProfile', position: { x: 0, y: 19 } },  // 投资画像

      // ============================================================
      // L4: AI 辅助 — "AI 怎么看？"
      // ============================================================
      { widgetId: 'modelCompare',      position: { x: 0, y: 21 } },  // AI大模型智能对比
      { widgetId: 'aiTradeReview',     position: { x: 0, y: 24 } },  // AI交易复盘
      { widgetId: 'stockChat',         position: { x: 0, y: 27 } },  // 深度分析助手

      // ============================================================
      // L5: 持仓与风控 — "风险如何？仓位怎样？" ⚠️ [仅供研究跟踪，非交易建议]
      // ============================================================
      { widgetId: 'pnlAnalysis',       position: { x: 0, y: 31 } },  // 盈亏分析
      { widgetId: 'positionControl',   position: { x: 2, y: 31 } },  // 仓位控制
      { widgetId: 'riskMonitor',       position: { x: 0, y: 33 } },  // 风险监控
      { widgetId: 'watchlist',         position: { x: 0, y: 35 } },  // 自选股
      { widgetId: 'industryChain',     position: { x: 2, y: 33 } },  // 产业链图谱
      { widgetId: 'signalMonitor',     position: { x: 0, y: 37 } },  // 信号监控
      { widgetId: 'agentPerformance',  position: { x: 0, y: 39 } },  // 智能体性能
    ]

    defaultLayout.forEach((item) => {
      this.createInstance(item.widgetId, { position: item.position })
    })

    logger.info(`[WidgetRegistry] Created ${defaultLayout.length} default instances`)
  }

  register(template: WidgetTemplate): boolean {
    const { id } = template.meta
    logger.debug(`[WidgetRegistry] register() called: widgetId="${id}"`)

    if (this.templates.has(id)) {
      logger.warn(`[WidgetRegistry] Widget "${id}" already registered, overwriting`)
    }

    this.templates.set(id, template)
    logger.info(`[WidgetRegistry] Widget registered: id="${id}", name="${template.meta.name}", category="${template.meta.category}"`)
    this._emit({ type: 'registered', widgetId: id })
    return true
  }

  createInstance(widgetId: string, overrides?: Partial<Omit<WidgetConfig, 'instanceId' | 'widgetId'>>): WidgetConfig | null {
    logger.debug(`[WidgetRegistry] createInstance() called: widgetId="${widgetId}"`)

    const template = this.templates.get(widgetId)
    if (!template) {
      logger.error(`[WidgetRegistry] createInstance failed: Widget "${widgetId}" not found`)
      return null
    }

    this.instanceCounter++
    const instanceId = `${widgetId}_${this.instanceCounter}`
    const config: WidgetConfig = {
      instanceId,
      widgetId,
      size: overrides?.size ?? template.meta.defaultSize,
      position: overrides?.position,
      title: overrides?.title ?? template.meta.name,
      settings: { ...template.meta.defaultConfig, ...overrides?.settings },
      visible: overrides?.visible ?? true,
      collapsed: overrides?.collapsed ?? false,
      dataSource: overrides?.dataSource ?? template.meta.defaultDataSource,
    }

    this.instances.set(instanceId, config)
    this.runtimeStates.set(instanceId, { instanceId, widgetId, status: 'idle' })

    logger.info(`[WidgetRegistry] Instance created: instanceId="${instanceId}", widgetId="${widgetId}", size=${config.size.cols}x${config.size.rows}`)
    this._emit({ type: 'instanceAdded', widgetId, instanceId })
    return config
  }

  removeInstance(instanceId: string): boolean {
    logger.debug(`[WidgetRegistry] removeInstance() called: instanceId="${instanceId}"`)

    const config = this.instances.get(instanceId)
    if (!config) {
      logger.warn(`[WidgetRegistry] removeInstance failed: Instance "${instanceId}" not found`)
      return false
    }

    const widgetId = config.widgetId
    this.instances.delete(instanceId)
    this.runtimeStates.delete(instanceId)

    logger.info(`[WidgetRegistry] Instance removed: instanceId="${instanceId}", widgetId="${widgetId}"`)
    this._emit({ type: 'instanceRemoved', widgetId, instanceId })
    return true
  }

  getTemplate(widgetId: string): WidgetTemplate | undefined {
    const template = this.templates.get(widgetId)
    if (!template) {
      logger.debug(`[WidgetRegistry] getTemplate() not found: widgetId="${widgetId}"`)
    } else {
      logger.debug(`[WidgetRegistry] getTemplate() found: widgetId="${widgetId}"`)
    }
    return template
  }

  getInstance(instanceId: string): WidgetConfig | undefined {
    const config = this.instances.get(instanceId)
    if (!config) {
      logger.debug(`[WidgetRegistry] getInstance() not found: instanceId="${instanceId}"`)
    } else {
      logger.debug(`[WidgetRegistry] getInstance() found: instanceId="${instanceId}", widgetId="${config.widgetId}"`)
    }
    return config
  }

  getAllInstances(): WidgetConfig[] {
    const instances = Array.from(this.instances.values())
    logger.debug(`[WidgetRegistry] getAllInstances(): count=${instances.length}`)
    return instances
  }

  updateRuntimeState(instanceId: string, state: Partial<WidgetRuntimeState>): boolean {
    logger.debug(`[WidgetRegistry] updateRuntimeState() called: instanceId="${instanceId}", state=${JSON.stringify(state)}`)

    const existing = this.runtimeStates.get(instanceId)
    if (!existing) {
      logger.warn(`[WidgetRegistry] updateRuntimeState failed: Instance "${instanceId}" not found`)
      return false
    }

    const newState = { ...existing, ...state, instanceId, widgetId: existing.widgetId }
    this.runtimeStates.set(instanceId, newState)

    if (state.status) {
      logger.info(`[WidgetRegistry] Runtime state updated: instanceId="${instanceId}", status="${state.status}"`)
    }

    return true
  }

  getRuntimeState(instanceId: string): WidgetRuntimeState | undefined {
    const state = this.runtimeStates.get(instanceId)
    if (!state) {
      logger.debug(`[WidgetRegistry] getRuntimeState() not found: instanceId="${instanceId}"`)
    } else {
      logger.debug(`[WidgetRegistry] getRuntimeState() found: instanceId="${instanceId}", status="${state.status}"`)
    }
    return state
  }

  subscribe(listener: RegistryListener): () => void {
    this.listeners.add(listener)
    logger.debug(`[WidgetRegistry] Listener added, total=${this.listeners.size}`)

    return () => {
      this.listeners.delete(listener)
      logger.debug(`[WidgetRegistry] Listener removed, total=${this.listeners.size}`)
    }
  }

  private _emit(event: { type: string; widgetId?: string; instanceId?: string }): void {
    logger.debug(`[WidgetRegistry] _emit(): type="${event.type}", widgetId="${event.widgetId}", instanceId="${event.instanceId}"`)
    this.listeners.forEach((listener) => {
      try { listener(event) } catch (err) { logger.error('[WidgetRegistry] Listener error', { error: err }) }
    })
  }

  getStats() {
    const stats = {
      templates: this.templates.size,
      instances: this.instances.size,
      states: Array.from(this.runtimeStates.entries()).map(([id, s]) => ({ instanceId: id, status: s.status })),
    }
    logger.debug(`[WidgetRegistry] getStats(): ${JSON.stringify(stats)}`)
    return stats
  }
}

/**
 * widgetRegistry
 */
export const widgetRegistry = new WidgetRegistry()