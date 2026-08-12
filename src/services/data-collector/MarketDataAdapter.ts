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
        return { indices: this.adaptIndices(rawData.payload) }
      case 'sectors':
        return { sectors: this.adaptSectors(rawData.payload) }
      case 'fundFlow':
        return { fundFlows: this.adaptFundFlows(rawData.payload) }
      case 'sentiment':
        return { sentiment: this.adaptSentiment(rawData.payload) }
      case 'watchlist':
        return { watchlist: this.adaptWatchlist(rawData.payload) }
      case 'portfolio':
        return { portfolio: this.adaptPortfolio(rawData.payload) }
      case 'tradeReview':
        return { tradeReview: this.adaptTradeReview(rawData.payload) }
      // ============================================================
      // 新增金融业务数据适配
      // ============================================================
      case 'analysisScores':
        return { analysisScores: this.adaptAnalysisScores(rawData.payload) }
      case 'modelComparison':
        return { modelComparison: this.adaptModelComparison(rawData.payload) }
      case 'poolBoard':
        return { poolBoard: this.adaptPoolBoard(rawData.payload) }
      case 'chatHistory':
        return { chatHistory: this.adaptChatHistory(rawData.payload) }
      case 'hotSectors':
        return { hotSectors: this.adaptHotSectors(rawData.payload) }
      case 'valuePit':
        return { valuePit: this.adaptValuePit(rawData.payload) }
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
  private adaptIndices(payload: unknown): MarketIndexData[] {
    if (!Array.isArray(payload)) {
      logger.warn('[MarketDataAdapter] indices payload 不是数组')
      return []
    }

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
  private adaptSectors(payload: unknown): SectorHeatmapData[] {
    if (!Array.isArray(payload)) {
      logger.warn('[MarketDataAdapter] sectors payload 不是数组')
      return []
    }

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
  private adaptFundFlows(payload: unknown): FundFlowData[] {
    if (!Array.isArray(payload)) {
      logger.warn('[MarketDataAdapter] fundFlows payload 不是数组')
      return []
    }

    return payload.map((item) => ({
      type: toSafeString(item.type),
      name: toSafeString(item.name ?? FUND_FLOW_NAMES[item.type]),
      value: toSafeNumber(item.value ?? item.netInflow ?? 0),
      unit: toSafeString(item.unit, '亿'),
    }))
  }

  /**
   * 适配市场情绪数据，支持 fearGreedIndex/fgi 等字段别名；异常时回退默认值。
   * @param payload 原始市场情绪数据
   * @returns 标准化后的 SentimentData
   */
  private adaptSentiment(payload: unknown): SentimentData {
    if (payload === null || payload === undefined || typeof payload !== 'object') {
      logger.warn('[MarketDataAdapter] sentiment payload 不是对象')
      return this.getDefaultSentiment()
    }

    const p = payload as Record<string, unknown>

    return {
      fearGreedIndex: toSafeNumber(p.fearGreedIndex ?? p.fear_greed_index ?? p.fgi ?? 50),
      fearGreedLabel: toSafeString(p.fearGreedLabel ?? p.fear_greed_label, '中性'),
      totalStocks: toSafeNumber(p.totalStocks ?? p.total_stocks ?? p.total ?? 0),
      up: toSafeNumber(p.up ?? p.rise ?? 0),
      down: toSafeNumber(p.down ?? p.fall ?? 0),
      flat: toSafeNumber(p.flat ?? p.unchanged ?? 0),
      limitUp: toSafeNumber(p.limitUp ?? p.limit_up ?? p.limitRise ?? 0),
      limitDown: toSafeNumber(p.limitDown ?? p.limit_down ?? p.limitFall ?? 0),
    }
  }

  /**
   * 适配自选股数据，支持 name/stockName、price/currentPrice 等字段别名。
   * @param payload 原始自选股数据（数组）
   * @returns 标准化后的 WatchlistData[]
   */
  private adaptWatchlist(payload: unknown): WatchlistData[] {
    if (!Array.isArray(payload)) {
      logger.warn('[MarketDataAdapter] watchlist payload 不是数组')
      return []
    }

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
  private adaptPortfolio(payload: unknown): PortfolioData {
    if (payload === null || payload === undefined || typeof payload !== 'object') {
      logger.warn('[MarketDataAdapter] portfolio payload 不是对象')
      return this.getDefaultPortfolio()
    }

    const p = payload as Record<string, unknown>

    return {
      totalAssets: toSafeString(p.totalAssets ?? p.total_assets, '0'),
      availableFunds: toSafeString(p.availableFunds ?? p.available_funds, '0'),
      todayPnL: toSafeString(p.todayPnL ?? p.today_pnl ?? p.todayProfit, '0'),
      todayPnLPercent: toSafeNumber(p.todayPnLPercent ?? p.today_pnl_percent ?? p.todayProfitPct ?? 0),
      totalPnL: toSafeString(p.totalPnL ?? p.total_pnl ?? p.totalProfit, '0'),
      totalPnLPercent: toSafeNumber(p.totalPnLPercent ?? p.total_pnl_percent ?? p.totalProfitPct ?? 0),
      holdings: toSafeNumber(p.holdings ?? p.holdingCount ?? p.positionCount ?? 0),
      holdingsList: Array.isArray(p.holdingsList) ? p.holdingsList : [],
      rebalancePlan: Array.isArray(p.rebalancePlan) ? p.rebalancePlan : [],
      equityCurve: Array.isArray(p.equityCurve)
        ? (p.equityCurve as number[])
        : Array.isArray(p.equity_curve)
          ? (p.equity_curve as number[])
          : [],
      maxDrawdown: toSafeNumber(p.maxDrawdown ?? p.max_drawdown ?? p.maxDrawdownPct ?? 0),
      sharpeRatio: toSafeNumber(p.sharpeRatio ?? p.sharpe_ratio ?? 0),
    }
  }

  /**
   * 适配交易复盘数据，支持 winRate/win_rate/winPct 等字段别名；异常时回退默认值。
   * @param payload 原始交易复盘数据
   * @returns 标准化后的 TradeReviewData
   */
  private adaptTradeReview(payload: unknown): TradeReviewData {
    if (payload === null || payload === undefined || typeof payload !== 'object') {
      logger.warn('[MarketDataAdapter] tradeReview payload 不是对象')
      return this.getDefaultTradeReview()
    }

    const p = payload as Record<string, unknown>

    return {
      totalTrades: toSafeNumber(p.totalTrades ?? p.total_trades ?? p.total ?? 0),
      profitable: toSafeNumber(p.profitable ?? p.profitCount ?? 0),
      losing: toSafeNumber(p.losing ?? p.lossCount ?? 0),
      winRate: toSafeNumber(p.winRate ?? p.win_rate ?? p.winPct ?? 0),
      profitLossRatio: toSafeNumber(p.profitLossRatio ?? p.profit_loss_ratio ?? p.plRatio ?? 0),
      disciplineScore: toSafeNumber(p.disciplineScore ?? p.discipline_score ?? p.score ?? 0),
    }
  }

  // ============================================================
  // 新增金融业务适配方法
  // ============================================================

  /**
   * 适配投资画像 / KAI 评分数据
   * @remarks 支持字段别名，便于接入不同量化服务返回的 JSON 结构
   */
  private adaptAnalysisScores(payload: unknown): AnalysisScores {
    if (payload === null || payload === undefined || typeof payload !== 'object') {
      logger.warn('[MarketDataAdapter] analysisScores payload 不是对象')
      return this.getDefaultAnalysisScores()
    }

    const p = payload as Record<string, unknown>

    return {
      profile: this.adaptProfile(p.profile ?? p.userProfile ?? {}),
      kai: this.adaptKaiScore(p.kai ?? p.score ?? {}),
    }
  }

  /**
   * 适配投资画像数据，包含 tags 与 metrics 字段。
   * @param payload 原始画像数据
   * @returns 标准化后的 AnalysisScores['profile']
   */
  private adaptProfile(payload: unknown): AnalysisScores['profile'] {
    if (payload === null || payload === undefined || typeof payload !== 'object') {
      return { tags: [], metrics: [] }
    }

    const p = payload as Record<string, unknown>
    const metrics = Array.isArray(p.metrics) ? p.metrics : []

    return {
      tags: Array.isArray(p.tags) ? p.tags.map((t) => toSafeString(t)) : [],
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
  private adaptKaiScore(payload: unknown): AnalysisScores['kai'] {
    if (payload === null || payload === undefined || typeof payload !== 'object') {
      return this.getDefaultAnalysisScores().kai
    }

    const p = payload as Record<string, unknown>
    const dimensions = Array.isArray(p.dimensions) ? p.dimensions : []
    const detailDistribution = Array.isArray(p.detailDistribution) ? p.detailDistribution : []

    return {
      totalScore: toSafeNumber(p.totalScore ?? p.total_score ?? p.score ?? 0),
      sentiment: toSafeNumber(p.sentiment ?? 0),
      trend: toSafeNumber(p.trend ?? 0),
      flow: toSafeNumber(p.flow ?? 0),
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
  private adaptModelComparison(payload: unknown): ModelComparison {
    if (payload === null || payload === undefined || typeof payload !== 'object') {
      logger.warn('[MarketDataAdapter] modelComparison payload 不是对象')
      return this.getDefaultModelComparison()
    }

    const p = payload as Record<string, unknown>
    const dimensions = Array.isArray(p.dimensions) ? p.dimensions : []

    return {
      leftModel: this.adaptModelInfo(p.leftModel ?? p.left_model ?? p.modelA ?? {}),
      rightModel: this.adaptModelInfo(p.rightModel ?? p.right_model ?? p.modelB ?? {}),
      dimensions: dimensions.map((item) => ({
        name: toSafeString(item.name),
        leftScore: toSafeNumber(item.leftScore ?? item.left_score ?? item.scoreA ?? 0),
        rightScore: toSafeNumber(item.rightScore ?? item.right_score ?? item.scoreB ?? 0),
        weight: toSafeNumber(item.weight ?? 0),
      })),
      riskHint: toSafeString(p.riskHint ?? p.risk_hint ?? p.risk),
    }
  }

  /**
   * 适配单个模型信息，包含 id、name、version、score 字段。
   * @param payload 原始模型信息
   * @returns 标准化后的 ModelComparison['leftModel']
   */
  private adaptModelInfo(payload: unknown): ModelComparison['leftModel'] {
    if (payload === null || payload === undefined || typeof payload !== 'object') {
      return { id: '', name: '', version: '', score: 0 }
    }

    const p = payload as Record<string, unknown>
    return {
      id: toSafeString(p.id),
      name: toSafeString(p.name),
      version: toSafeString(p.version),
      score: toSafeNumber(p.score ?? 0),
    }
  }

  /**
   * 适配股票池数据
   */
  private adaptPoolBoard(payload: unknown): PoolBoard {
    if (payload === null || payload === undefined || typeof payload !== 'object') {
      logger.warn('[MarketDataAdapter] poolBoard payload 不是对象')
      return this.getDefaultPoolBoard()
    }

    const p = payload as Record<string, unknown>
    const items = Array.isArray(p.items) ? p.items : Array.isArray(p.stocks) ? p.stocks : []

    return {
      items: items.map((item) => this.adaptPoolBoardItem(item)),
      total: toSafeNumber(p.total ?? items.length),
      page: toSafeNumber(p.page ?? 1),
      pageSize: toSafeNumber(p.pageSize ?? p.page_size ?? p.limit ?? 10),
    }
  }

  /**
   * 适配单个股票池条目，支持 code/symbol、name/stockName 等字段别名。
   * @param item 单个股票池原始条目
   * @returns 标准化后的 PoolBoardItem
   */
  private adaptPoolBoardItem(item: unknown): PoolBoardItem {
    const it = item as Record<string, unknown>
    return {
      code: toSafeString(it.code ?? it.symbol),
      name: toSafeString(it.name ?? it.stockName),
      price: toSafeNumber(it.price ?? it.currentPrice ?? it.current ?? 0),
      changePercent: toSafeNumber(it.changePercent ?? it.change_percent ?? it.pctChange ?? 0),
      turnover: toSafeString(it.turnover),
      turnoverRate: toSafeString(it.turnoverRate ?? it.turnover_rate),
      statusColor: toSafeString(it.statusColor ?? it.status_color, 'bg-gray-400'),
      statusLabel: toSafeString(it.statusLabel ?? it.status_label),
    }
  }

  /**
   * 适配聊天历史数据
   */
  private adaptChatHistory(payload: unknown): ChatHistory {
    if (payload === null || payload === undefined || typeof payload !== 'object') {
      logger.warn('[MarketDataAdapter] chatHistory payload 不是对象')
      return this.getDefaultChatHistory()
    }

    const p = payload as Record<string, unknown>
    const messages = Array.isArray(p.messages) ? p.messages : []

    return {
      target: toSafeString(p.target),
      targetType: (p.targetType ?? p.target_type ?? 'stock') as ChatHistory['targetType'],
      messages: messages.map((item) => this.adaptChatMessage(item)),
    }
  }

  /**
   * 适配单条聊天消息，支持 id、role、content、timestamp/ts 等字段别名。
   * @param item 单条原始消息
   * @returns 标准化后的 ChatMessage
   */
  private adaptChatMessage(item: unknown): ChatMessage {
    const it = item as Record<string, unknown>
    return {
      id: toSafeString(it.id),
      role: (it.role ?? 'assistant') as ChatMessage['role'],
      content: toSafeString(it.content),
      timestamp: toSafeNumber(it.timestamp ?? it.ts ?? Date.now()),
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
  private adaptHotSectors(payload: unknown): HotSectorData[] {
    if (!Array.isArray(payload)) {
      logger.warn('[MarketDataAdapter] hotSectors payload 不是数组')
      return []
    }

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
  private adaptValuePit(payload: unknown): ValuePitData[] {
    if (!Array.isArray(payload)) {
      logger.warn('[MarketDataAdapter] valuePit payload 不是数组')
      return []
    }

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
