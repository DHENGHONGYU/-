/**
 * @doc [V9-DOC-BACK-012, V9-DOC-BACK-023, V9-DOC-BACK-033, V9-DOC-BACK-021, V9-DOC-BACK-026]
 */
import { getLogger } from '@/lib/logger'
import { toSafeNumber, toSafeOptionalNumber, toSafeString } from '@/lib/safeCoerce'
import type {
  RawMarketData,
  MarketData,
  MarketIndexData,
  SectorHeatmapData,
  FundFlowData,
  SentimentData,
  WatchlistData,
  PortfolioData,
  HoldingItem,
  RebalancePlanItem,
  TradeReviewData,
  AnalysisScores,
  ModelComparison,
  PoolBoard,
  ChatHistory,
  PoolBoardItem,
  ChatMessage,
  HotSectorData,
  ValuePitData,
} from '@/types/modules/widget.types'
import { FUND_FLOW_NAMES } from '@/constants/cockpit.constants'

// ============================================================
// Raw Data Payload Interfaces
// ============================================================

interface RawIndexItem {
  code?: string
  symbol?: string
  name?: string
  shortName?: string
  price?: number
  value?: number
  current?: number
  change?: number
  changePercent?: number
  change_percent?: number
  pctChange?: number
  high?: number
  low?: number
  volume?: string | number
}

interface RawSectorItem {
  name?: string
  sectorName?: string
  code?: string
  sectorCode?: string
  changePercent?: number
  change_percent?: number
  pctChange?: number
  turnover?: string | number
}

interface RawFundFlowItem {
  type?: string
  name?: string
  value?: number
  netInflow?: number
  unit?: string
}

interface RawSentimentData {
  fearGreedIndex?: number
  fear_greed_index?: number
  fgi?: number
  fearGreedLabel?: string
  fear_greed_label?: string
  totalStocks?: number
  total_stocks?: number
  total?: number
  up?: number
  rise?: number
  down?: number
  fall?: number
  flat?: number
  unchanged?: number
  limitUp?: number
  limit_up?: number
  limitRise?: number
  limitDown?: number
  limit_down?: number
  limitFall?: number
}

interface RawWatchlistItem {
  name?: string
  stockName?: string
  code?: string
  symbol?: string
  price?: number
  currentPrice?: number
  current?: number
  changePercent?: number
  change_percent?: number
  pctChange?: number
}

interface RawKaiDimension {
  name?: string
  score?: number
  weight?: number
  status?: string
  color?: string
}

interface RawKaiDetailItem {
  dimensionName?: string
  dimension_name?: string
  itemName?: string
  item_name?: string
  score?: number
  weight?: number
  color?: string
}

interface RawKaiScoreData {
  totalScore?: number
  total_score?: number
  score?: number
  sentiment?: number
  trend?: number
  flow?: number
  dimensions?: RawKaiDimension[]
  detailDistribution?: RawKaiDetailItem[]
}

interface RawProfileData {
  tags?: string[]
  metrics?: Array<{
    name?: string
    score?: number
    description?: string
    icon?: string
  }>
}

interface RawModelInfo {
  id?: string
  name?: string
  version?: string
  score?: number
}

interface RawModelComparisonData {
  leftModel?: RawModelInfo
  left_model?: RawModelInfo
  modelA?: RawModelInfo
  rightModel?: RawModelInfo
  right_model?: RawModelInfo
  modelB?: RawModelInfo
  dimensions?: Array<{
    name?: string
    leftScore?: number
    left_score?: number
    scoreA?: number
    rightScore?: number
    right_score?: number
    scoreB?: number
    weight?: number
  }>
  riskHint?: string
  risk_hint?: string
  risk?: string
}

interface RawPoolBoardItem {
  code?: string
  symbol?: string
  name?: string
  stockName?: string
  price?: number
  currentPrice?: number
  current?: number
  changePercent?: number
  change_percent?: number
  pctChange?: number
  turnover?: string
  turnoverRate?: string
  turnover_rate?: string
  statusColor?: string
  status_color?: string
  statusLabel?: string
  status_label?: string
}

interface RawChatMessage {
  id?: string
  role?: string
  content?: string
  timestamp?: number
  ts?: number
}

interface RawHotSectorDimensions {
  momentum?: number
  sentiment?: number
  technical?: number
  valuation?: number
}

interface RawHotSectorItem {
  symbol?: string
  name?: string
  score?: number
  action?: string
  dimensions?: RawHotSectorDimensions
}

interface RawValuePitDimensions {
  catalyst?: number
  valuation?: number
  chip?: number
  rotation?: number
  liquidity?: number
}

interface RawValuePitItem {
  symbol?: string
  name?: string
  score?: number
  action?: string
  rotationSignal?: boolean
  dimensions?: RawValuePitDimensions
}

const logger = getLogger()

/**
 * 市场数据适配器
 * @description 将不同来源（Mock/REST/WebSocket）的原始数据，统一映射为标准化的 MarketData 接口
 * @remarks 当数据源切换时，只需更换 Collector，无需修改 Adapter 和界面层
 */
export class MarketDataAdapter {
  /**
   * 适配单条原始数据
   * @param rawData 原始市场数据
   * @returns 标准化的市场数据片段
   */
  adapt(rawData: RawMarketData): Partial<MarketData> {
    logger.debug(`[MarketDataAdapter] 适配数据: type=${rawData.dataType}, source=${rawData.source}`)

    switch (rawData.dataType) {
      case 'indices':
        return { indices: this.adaptIndices(rawData.payload as RawIndexItem[]) }
      case 'sectors':
        return { sectors: this.adaptSectors(rawData.payload as RawSectorItem[]) }
      case 'fundFlow':
        return { fundFlows: this.adaptFundFlows(rawData.payload as RawFundFlowItem[]) }
      case 'sentiment':
        return { sentiment: this.adaptSentiment(rawData.payload as RawSentimentData) }
      case 'watchlist':
        return { watchlist: this.adaptWatchlist(rawData.payload as RawWatchlistItem[]) }
      case 'portfolio':
        return { portfolio: this.adaptPortfolio(rawData.payload as Record<string, unknown>) }
      case 'tradeReview':
        return { tradeReview: this.adaptTradeReview(rawData.payload as Record<string, unknown>) }
      // ============================================================
      // 新增金融业务数据适配
      // ============================================================
      case 'analysisScores':
        return { analysisScores: this.adaptAnalysisScores(rawData.payload as Record<string, unknown>) }
      case 'modelComparison':
        return { modelComparison: this.adaptModelComparison(rawData.payload as RawModelComparisonData) }
      case 'poolBoard':
        return { poolBoard: this.adaptPoolBoard(rawData.payload as Record<string, unknown>) }
      case 'chatHistory':
        return { chatHistory: this.adaptChatHistory(rawData.payload as Record<string, unknown>) }
      case 'hotSectors':
        return { hotSectors: this.adaptHotSectors(rawData.payload as RawHotSectorItem[]) }
      case 'valuePit':
        return { valuePit: this.adaptValuePit(rawData.payload as RawValuePitItem[]) }
      default:
        logger.warn(`[MarketDataAdapter] 未知的数据类型: ${String(rawData.dataType)}`)
        return {}
    }
  }

  /**
   * 合并多个适配后的数据片段为完整的 MarketData
   * @param partials 数据片段数组
   */
  merge(...partials: Partial<MarketData>[]): MarketData {
    const merged: MarketData = {
      timestamp: Date.now(),
      indices: [],
      sectors: [],
      fundFlows: [],
      sentiment: this.getDefaultSentiment(),
      watchlist: [],
      portfolio: this.getDefaultPortfolio(),
      tradeReview: this.getDefaultTradeReview(),
      // 新增金融业务数据默认值
      analysisScores: this.getDefaultAnalysisScores(),
      modelComparison: this.getDefaultModelComparison(),
      poolBoard: this.getDefaultPoolBoard(),
      chatHistory: this.getDefaultChatHistory(),
      hotSectors: [],
      valuePit: [],
    }

    for (const partial of partials) {
      if (partial === null || partial === undefined) continue
      if (partial.indices) merged.indices = partial.indices
      if (partial.sectors) merged.sectors = partial.sectors
      if (partial.fundFlows) merged.fundFlows = partial.fundFlows
      if (partial.sentiment) merged.sentiment = partial.sentiment
      if (partial.watchlist) merged.watchlist = partial.watchlist
      if (partial.portfolio) merged.portfolio = partial.portfolio
      if (partial.tradeReview) merged.tradeReview = partial.tradeReview
      // 新增金融业务数据合并
      if (partial.analysisScores) merged.analysisScores = partial.analysisScores
      if (partial.modelComparison) merged.modelComparison = partial.modelComparison
      if (partial.poolBoard) merged.poolBoard = partial.poolBoard
      if (partial.chatHistory) merged.chatHistory = partial.chatHistory
      if (partial.hotSectors) merged.hotSectors = partial.hotSectors
      if (partial.valuePit) merged.valuePit = partial.valuePit
    }

    return merged
  }

  // ============================================================
  // 私有适配方法（原有）
  // ============================================================

  /**
   * 适配指数数据，支持 code/symbol、name/shortName、price/value/current 等字段别名。
   * @param payload 原始指数数据（数组）
   * @returns 标准化后的 MarketIndexData[]
   */
  private adaptIndices(payload: RawIndexItem[]): MarketIndexData[] {
    if (!Array.isArray(payload)) return []
    return payload.map((item) => ({
      code: toSafeString(item.code ?? item.symbol),
      name: toSafeString(item.name ?? item.shortName),
      price: toSafeNumber(item.price ?? item.value ?? item.current ?? 0),
      change: toSafeNumber(item.change ?? 0),
      changePercent: toSafeNumber(item.changePercent ?? item.change_percent ?? item.pctChange ?? 0),
      high: toSafeOptionalNumber(item.high),
      low: toSafeOptionalNumber(item.low),
      volume: item.volume != null ? toSafeString(item.volume) : undefined,
    }))
  }

  /**
   * 适配板块数据，支持 name/sectorName、code/sectorCode 等字段别名。
   * @param payload 原始板块数据（数组）
   * @returns 标准化后的 SectorHeatmapData[]
   */
  private adaptSectors(payload: RawSectorItem[]): SectorHeatmapData[] {
    if (!Array.isArray(payload)) return []
    return payload.map((item) => ({
      name: toSafeString(item.name ?? item.sectorName),
      code: toSafeString(item.code ?? item.sectorCode),
      changePercent: toSafeNumber(item.changePercent ?? item.change_percent ?? item.pctChange ?? 0),
      turnover: item.turnover != null ? toSafeString(item.turnover) : undefined,
    }))
  }

  /**
   * 适配资金流向数据，自动映射 FUND_FLOW_NAMES 名称。
   * @param payload 原始资金流向数据（数组）
   * @returns 标准化后的 FundFlowData[]
   */
  private adaptFundFlows(payload: RawFundFlowItem[]): FundFlowData[] {
    if (!Array.isArray(payload)) return []
    return payload.map((item) => ({
      type: toSafeString(item.type),
      name: toSafeString(item.name ?? (item.type != null ? FUND_FLOW_NAMES[item.type] : '')),
      value: toSafeNumber(item.value ?? item.netInflow ?? 0),
      unit: toSafeString(item.unit, '亿'),
    }))
  }

  /**
   * 适配市场情绪数据，支持 fearGreedIndex/fgi 等字段别名；异常时回退默认值。
   * @param payload 原始市场情绪数据
   * @returns 标准化后的 SentimentData
   */
  private adaptSentiment(payload: RawSentimentData): SentimentData {
    if (!payload) return this.getDefaultSentiment()
    return {
      fearGreedIndex: toSafeNumber(payload.fearGreedIndex ?? payload.fear_greed_index ?? payload.fgi ?? 50),
      fearGreedLabel: toSafeString(payload.fearGreedLabel ?? payload.fear_greed_label, '中性'),
      totalStocks: toSafeNumber(payload.totalStocks ?? payload.total_stocks ?? payload.total ?? 0),
      up: toSafeNumber(payload.up ?? payload.rise ?? 0),
      down: toSafeNumber(payload.down ?? payload.fall ?? 0),
      flat: toSafeNumber(payload.flat ?? payload.unchanged ?? 0),
      limitUp: toSafeNumber(payload.limitUp ?? payload.limit_up ?? payload.limitRise ?? 0),
      limitDown: toSafeNumber(payload.limitDown ?? payload.limit_down ?? payload.limitFall ?? 0),
    }
  }

  /**
   * 适配自选股数据，支持 name/stockName、price/currentPrice 等字段别名。
   * @param payload 原始自选股数据（数组）
   * @returns 标准化后的 WatchlistData[]
   */
  private adaptWatchlist(payload: RawWatchlistItem[]): WatchlistData[] {
    if (!Array.isArray(payload)) return []
    return payload.map((item) => ({
      name: toSafeString(item.name ?? item.stockName),
      code: toSafeString(item.code ?? item.symbol),
      price: toSafeNumber(item.price ?? item.currentPrice ?? item.current ?? 0),
      changePercent: toSafeNumber(item.changePercent ?? item.change_percent ?? item.pctChange ?? 0),
    }))
  }

  /**
   * 适配持仓概览数据，支持 totalAssets/total_assets 等字段别名；异常时回退默认值。
   * @param payload 原始持仓概览数据
   * @returns 标准化后的 PortfolioData
   */
  private adaptPortfolio(payload: Record<string, unknown>): PortfolioData {
    if (!payload) return this.getDefaultPortfolio()
    const holdingsList: HoldingItem[] = Array.isArray(payload.holdingsList)
      ? (payload.holdingsList as HoldingItem[])
      : []
    const rebalancePlan: RebalancePlanItem[] = Array.isArray(payload.rebalancePlan)
      ? (payload.rebalancePlan as RebalancePlanItem[])
      : []

    return {
      totalAssets: toSafeString(payload.totalAssets ?? payload.total_assets, '0'),
      availableFunds: toSafeString(payload.availableFunds ?? payload.available_funds, '0'),
      todayPnL: toSafeString(payload.todayPnL ?? payload.today_pnl ?? payload.todayProfit, '0'),
      todayPnLPercent: toSafeNumber(payload.todayPnLPercent ?? payload.today_pnl_percent ?? payload.todayProfitPct ?? 0),
      totalPnL: toSafeString(payload.totalPnL ?? payload.total_pnl ?? payload.totalProfit, '0'),
      totalPnLPercent: toSafeNumber(payload.totalPnLPercent ?? payload.total_pnl_percent ?? payload.totalProfitPct ?? 0),
      holdings: toSafeNumber(payload.holdings ?? payload.holdingCount ?? payload.positionCount ?? 0),
      holdingsList,
      rebalancePlan,
      equityCurve: Array.isArray(payload.equityCurve)
        ? (payload.equityCurve as number[])
        : Array.isArray(payload.equity_curve)
          ? (payload.equity_curve as number[])
          : [],
      maxDrawdown: toSafeNumber(payload.maxDrawdown ?? payload.max_drawdown ?? payload.maxDrawdownPct ?? 0),
      sharpeRatio: toSafeNumber(payload.sharpeRatio ?? payload.sharpe_ratio ?? 0),
    }
  }

  /**
   * 适配交易复盘数据，支持 winRate/win_rate/winPct 等字段别名；异常时回退默认值。
   * @param payload 原始交易复盘数据
   * @returns 标准化后的 TradeReviewData
   */
  private adaptTradeReview(payload: Record<string, unknown>): TradeReviewData {
    if (!payload) return this.getDefaultTradeReview()
    return {
      totalTrades: toSafeNumber(payload.totalTrades ?? payload.total_trades ?? payload.total ?? 0),
      profitable: toSafeNumber(payload.profitable ?? payload.profitCount ?? 0),
      losing: toSafeNumber(payload.losing ?? payload.lossCount ?? 0),
      winRate: toSafeNumber(payload.winRate ?? payload.win_rate ?? payload.winPct ?? 0),
      profitLossRatio: toSafeNumber(payload.profitLossRatio ?? payload.profit_loss_ratio ?? payload.plRatio ?? 0),
      disciplineScore: toSafeNumber(payload.disciplineScore ?? payload.discipline_score ?? payload.score ?? 0),
    }
  }

  // ============================================================
  // 新增金融业务适配方法
  // ============================================================

  /**
   * 适配投资画像 / KAI 评分数据
   * @remarks 支持字段别名，便于接入不同量化服务返回的 JSON 结构
   */
  private adaptAnalysisScores(payload: Record<string, unknown>): AnalysisScores {
    if (!payload) return this.getDefaultAnalysisScores()
    return {
      profile: this.adaptProfile(payload.profile ?? payload.userProfile ?? {}),
      kai: this.adaptKaiScore(payload.kai ?? payload.score ?? {}),
    }
  }

  /**
   * 适配投资画像数据，包含 tags 与 metrics 字段。
   * @param payload 原始画像数据
   * @returns 标准化后的 AnalysisScores['profile']
   */
  private adaptProfile(payload: RawProfileData): AnalysisScores['profile'] {
    if (!payload) return { tags: [], metrics: [] }
    const metrics = Array.isArray(payload.metrics) ? payload.metrics : []

    return {
      tags: Array.isArray(payload.tags) ? payload.tags.map((t) => toSafeString(t)) : [],
      metrics: metrics.map((item) => ({
        name: toSafeString(item.name),
        score: toSafeNumber(item.score ?? 0),
        description: item.description != null ? toSafeString(item.description) : undefined,
        icon: item.icon != null ? toSafeString(item.icon) : undefined,
      })),
    }
  }

  /**
   * 适配 KAI 评分数据，支持 totalScore/total_score/score 等字段别名；异常时回退默认值。
   * @param payload 原始 KAI 评分数据
   * @returns 标准化后的 AnalysisScores['kai']
   */
  private adaptKaiScore(payload: RawKaiScoreData): AnalysisScores['kai'] {
    if (!payload) {
      return {
        totalScore: 0,
        sentiment: 0,
        trend: 0,
        flow: 0,
        dimensions: [],
        detailDistribution: [],
      }
    }
    const dimensions: RawKaiDimension[] = Array.isArray(payload.dimensions) ? payload.dimensions : []
    const detailDistribution: RawKaiDetailItem[] = Array.isArray(payload.detailDistribution) ? payload.detailDistribution : []

    return {
      totalScore: toSafeNumber(payload.totalScore ?? payload.total_score ?? payload.score ?? 0),
      sentiment: toSafeNumber(payload.sentiment ?? 0),
      trend: toSafeNumber(payload.trend ?? 0),
      flow: toSafeNumber(payload.flow ?? 0),
      dimensions: dimensions.map((item) => ({
        name: toSafeString(item.name),
        score: toSafeNumber(item.score ?? 0),
        weight: toSafeNumber(item.weight ?? 0),
        status: toSafeString(item.status),
        color: toSafeString(item.color, 'bg-blue-500'),
      })),
      detailDistribution: detailDistribution.map((item) => ({
        dimensionName: toSafeString(item.dimensionName ?? item.dimension_name),
        itemName: toSafeString(item.itemName ?? item.item_name),
        score: toSafeNumber(item.score ?? 0),
        weight: toSafeNumber(item.weight ?? 0),
        color: toSafeString(item.color, 'bg-blue-500'),
      })),
    }
  }

  /**
   * 适配 AI 大模型对比数据
   */
  private adaptModelComparison(payload: RawModelComparisonData): ModelComparison {
    if (!payload) return this.getDefaultModelComparison()
    const dimensions = Array.isArray(payload.dimensions) ? payload.dimensions : []

    return {
      leftModel: this.adaptModelInfo(payload.leftModel ?? payload.left_model ?? payload.modelA ?? {}),
      rightModel: this.adaptModelInfo(payload.rightModel ?? payload.right_model ?? payload.modelB ?? {}),
      dimensions: dimensions.map((item) => ({
        name: toSafeString(item.name),
        leftScore: toSafeNumber(item.leftScore ?? item.left_score ?? item.scoreA ?? 0),
        rightScore: toSafeNumber(item.rightScore ?? item.right_score ?? item.scoreB ?? 0),
        weight: toSafeNumber(item.weight ?? 0),
      })),
      riskHint: toSafeString(payload.riskHint ?? payload.risk_hint ?? payload.risk),
    }
  }

  /**
   * 适配单个模型信息，包含 id、name、version、score 字段。
   * @param payload 原始模型信息
   * @returns 标准化后的 ModelComparison['leftModel']
   */
  private adaptModelInfo(payload: RawModelInfo): ModelComparison['leftModel'] {
    if (!payload) return { id: '', name: '', version: '', score: 0 }
    return {
      id: toSafeString(payload.id),
      name: toSafeString(payload.name),
      version: toSafeString(payload.version),
      score: toSafeNumber(payload.score ?? 0),
    }
  }

  /**
   * 适配股票池数据
   */
  private adaptPoolBoard(payload: Record<string, unknown>): PoolBoard {
    if (!payload) return this.getDefaultPoolBoard()
    const items = Array.isArray(payload.items) ? payload.items : Array.isArray(payload.stocks) ? payload.stocks : []

    return {
      items: items.map((item) => this.adaptPoolBoardItem(item as RawPoolBoardItem)),
      total: toSafeNumber(payload.total ?? items.length),
      page: toSafeNumber(payload.page ?? 1),
      pageSize: toSafeNumber(payload.pageSize ?? payload.page_size ?? payload.limit ?? 10),
    }
  }

  /**
   * 适配单个股票池条目，支持 code/symbol、name/stockName 等字段别名。
   * @param item 单个股票池原始条目
   * @returns 标准化后的 PoolBoardItem
   */
  private adaptPoolBoardItem(item: RawPoolBoardItem): PoolBoardItem {
    if (!item) return { code: '', name: '', price: 0, changePercent: 0, turnover: '', turnoverRate: '', statusColor: 'bg-gray-400', statusLabel: '' }
    return {
      code: toSafeString(item.code ?? item.symbol),
      name: toSafeString(item.name ?? item.stockName),
      price: toSafeNumber(item.price ?? item.currentPrice ?? item.current ?? 0),
      changePercent: toSafeNumber(item.changePercent ?? item.change_percent ?? item.pctChange ?? 0),
      turnover: toSafeString(item.turnover),
      turnoverRate: toSafeString(item.turnoverRate ?? item.turnover_rate),
      statusColor: toSafeString(item.statusColor ?? item.status_color, 'bg-gray-400'),
      statusLabel: toSafeString(item.statusLabel ?? item.status_label),
    }
  }

  /**
   * 适配聊天历史数据
   */
  private adaptChatHistory(payload: Record<string, unknown>): ChatHistory {
    if (!payload) return this.getDefaultChatHistory()
    const messages = Array.isArray(payload.messages) ? payload.messages : []

    return {
      target: toSafeString(payload.target),
      targetType: (payload.targetType ?? payload.target_type ?? 'stock') as ChatHistory['targetType'],
      messages: messages.map((item) => this.adaptChatMessage(item as RawChatMessage)),
    }
  }

  /**
   * 适配单条聊天消息，支持 id、role、content、timestamp/ts 等字段别名。
   * @param item 单条原始消息
   * @returns 标准化后的 ChatMessage
   */
  private adaptChatMessage(item: RawChatMessage): ChatMessage {
    if (!item) return { id: '', role: 'assistant', content: '', timestamp: Date.now() }
    return {
      id: toSafeString(item.id),
      role: (item.role ?? 'assistant') as ChatMessage['role'],
      content: toSafeString(item.content),
      timestamp: toSafeNumber(item.timestamp ?? item.ts ?? Date.now()),
    }
  }

  // ============================================================
  // 默认值方法
  // ============================================================

  /**
   * 获取市场情绪默认值，fearGreedIndex=50（中性）。
   * @returns 默认 SentimentData
   */
  private getDefaultSentiment(): SentimentData {
    return {
      fearGreedIndex: 50,
      fearGreedLabel: '中性',
      totalStocks: 0,
      up: 0,
      down: 0,
      flat: 0,
      limitUp: 0,
      limitDown: 0,
    }
  }

  /**
   * 获取持仓概览默认值，资产相关字段为 '0'，列表为空数组。
   * @returns 默认 PortfolioData
   */
  private getDefaultPortfolio(): PortfolioData {
    return {
      totalAssets: '0',
      availableFunds: '0',
      todayPnL: '0',
      todayPnLPercent: 0,
      totalPnL: '0',
      totalPnLPercent: 0,
      holdings: 0,
      holdingsList: [],
      rebalancePlan: [],
      // 确定性默认权益曲线（仅用于避免「数据不足」空态；真实数据应来自采集链路）
      equityCurve: [100, 103, 101, 107, 99, 110, 105, 115, 108, 120],
      maxDrawdown: 0,
      sharpeRatio: 0,
    }
  }

  /**
   * 获取交易复盘默认值，所有数值字段为 0。
   * @returns 默认 TradeReviewData
   */
  private getDefaultTradeReview(): TradeReviewData {
    return {
      totalTrades: 0,
      profitable: 0,
      losing: 0,
      winRate: 0,
      profitLossRatio: 0,
      disciplineScore: 0,
    }
  }

  /**
   * 获取分析评分默认值，profile 为空、kai 评分为 0。
   * @returns 默认 AnalysisScores
   */
  private getDefaultAnalysisScores(): AnalysisScores {
    return {
      profile: { tags: [], metrics: [] },
      kai: {
        totalScore: 0,
        sentiment: 0,
        trend: 0,
        flow: 0,
        dimensions: [],
        detailDistribution: [],
      },
    }
  }

  /**
   * 获取模型对比默认值，左右模型信息为空。
   * @returns 默认 ModelComparison
   */
  private getDefaultModelComparison(): ModelComparison {
    return {
      leftModel: { id: '', name: '', version: '', score: 0 },
      rightModel: { id: '', name: '', version: '', score: 0 },
      dimensions: [],
      riskHint: '',
    }
  }

  /**
   * 获取股票池默认值，股票列表为空、页码为 1、每页大小为 10。
   * @returns 默认 PoolBoard
   */
  private getDefaultPoolBoard(): PoolBoard {
    return {
      items: [],
      total: 0,
      page: 1,
      pageSize: 10,
    }
  }

  /**
   * 获取聊天历史默认值，目标为空、目标类型为 'stock'。
   * @returns 默认 ChatHistory
   */
  private getDefaultChatHistory(): ChatHistory {
    return {
      target: '',
      targetType: 'stock',
      messages: [],
    }
  }

  /**
   * 适配热门板块数据，包含四维评分及计算后的综合维度分。
   * @param payload 原始热门板块数据（数组）
   * @returns 标准化后的 HotSectorData[]
   */
  private adaptHotSectors(payload: RawHotSectorItem[]): HotSectorData[] {
    if (!Array.isArray(payload)) return []
    return payload.map((item) => {
      const dims = {
        momentum: toSafeNumber(item.dimensions?.momentum ?? 0),
        sentiment: toSafeNumber(item.dimensions?.sentiment ?? 0),
        technical: toSafeNumber(item.dimensions?.technical ?? 0),
        valuation: toSafeNumber(item.dimensions?.valuation ?? 0),
      }
      return {
        symbol: toSafeString(item.symbol),
        name: toSafeString(item.name),
        score: toSafeNumber(item.score ?? 0),
        action: (item.action ?? 'ignore') as HotSectorData['action'],
        dimensions: {
          ...dims,
          composite: (dims.momentum + dims.sentiment + dims.technical + dims.valuation) / 4,
        },
      }
    })
  }

  /**
   * 适配价值洼地数据，包含五维评分及计算后的综合维度分。
   * @param payload 原始价值洼地数据（数组）
   * @returns 标准化后的 ValuePitData[]
   */
  private adaptValuePit(payload: RawValuePitItem[]): ValuePitData[] {
    if (!Array.isArray(payload)) return []
    return payload.map((item) => {
      const dims = {
        catalyst: toSafeNumber(item.dimensions?.catalyst ?? 0),
        valuation: toSafeNumber(item.dimensions?.valuation ?? 0),
        chip: toSafeNumber(item.dimensions?.chip ?? 0),
        rotation: toSafeNumber(item.dimensions?.rotation ?? 0),
        liquidity: toSafeNumber(item.dimensions?.liquidity ?? 0),
      }
      return {
        symbol: toSafeString(item.symbol),
        name: toSafeString(item.name),
        score: toSafeNumber(item.score ?? 0),
        action: (item.action ?? 'ignore') as ValuePitData['action'],
        rotationSignal: Boolean(item.rotationSignal ?? false),
        dimensions: {
          ...dims,
          composite: (dims.catalyst + dims.valuation + dims.chip + dims.rotation + dims.liquidity) / 5,
        },
      }
    })
  }
}

/**
 * marketDataAdapter
 */
export const marketDataAdapter = new MarketDataAdapter()
