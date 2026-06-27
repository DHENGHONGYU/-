import { getLogger } from '@/lib/logger'
import type { WidgetMeta, WidgetConfig, WidgetRuntimeState, MarketData } from '@/types/modules/widget.types'
import { DEFAULT_WIDGET_CONFIG, WIDGET_DEFAULT_DATA_SOURCE } from '@/constants/cockpit.constants'

const logger = getLogger()

type RegistryListener = (event: { type: string; widgetId?: string; instanceId?: string }) => void

export interface WidgetTemplate {
  meta: WidgetMeta
  /** Widget 组件统一接收 config 与 MarketData；data 可由 MarketDataProvider 注入 */
  component: () => Promise<{ default: React.ComponentType<{ config: WidgetConfig; data?: MarketData }> }>
  configPanel?: () => Promise<{ default: React.ComponentType }>
}

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
          id: 'stockPool',
          name: DEFAULT_WIDGET_CONFIG.stockPool.title,
          category: DEFAULT_WIDGET_CONFIG.stockPool.category,
          description: '股票池管理与监控列表',
          defaultSize: DEFAULT_WIDGET_CONFIG.stockPool.size,
          defaultDataSource: WIDGET_DEFAULT_DATA_SOURCE.stockPool,
        },
        component: () => import('@/cockpit/widgets/StockPoolWidget'),
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
    ]

    widgets.forEach((widget) => this.register(widget))
    this.createDefaultInstances()
  }

  private createDefaultInstances(): void {
    const defaultLayout = [
      { widgetId: 'marketIndices', position: { x: 0, y: 0 } },
      { widgetId: 'sectorHeatmap', position: { x: 0, y: 2 } },
      { widgetId: 'fundFlow', position: { x: 0, y: 4 } },
      { widgetId: 'marketSentiment', position: { x: 2, y: 4 } },
      { widgetId: 'watchlist', position: { x: 0, y: 6 } },
      { widgetId: 'portfolioOverview', position: { x: 0, y: 8 } },
      { widgetId: 'aiTradeReview', position: { x: 0, y: 10 } },
      // ============================================================
      // 新增金融业务 Widget 默认布局
      // ============================================================
      { widgetId: 'investmentProfile', position: { x: 0, y: 13 } },
      { widgetId: 'stockPool', position: { x: 0, y: 15 } },
      { widgetId: 'kaiScore', position: { x: 0, y: 17 } },
      { widgetId: 'modelCompare', position: { x: 0, y: 20 } },
      { widgetId: 'stockChat', position: { x: 0, y: 23 } },
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

export const widgetRegistry = new WidgetRegistry()