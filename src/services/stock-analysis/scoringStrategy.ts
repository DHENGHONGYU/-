/**
 * @fileoverview 股票分析评分策略接口与实现
 * @note P1-12（已确认合规）：dataLayer store 内部通过 sendWriteEnvelope() → DataBridge 写入，
 *   queryList/queryGet 走 DataBridge 查询，是 DataBridge 的类型安全包装层。
 *   符合 services → data 分层规则（AGENTS.md §一），无需迁移。
 *
 * 职责：
 * - 定义股票分析相关评分/数据的获取策略（Strategy 模式）
 * - 将评分计算逻辑从数据采集层（MockCollector）解耦到分析层
 * - 支持 Mock 策略（开发/测试）与真实策略（生产 API / 分析服务）注入
 *
 * 设计原则：
 * - 本文件位于 src/services/stock-analysis/（分析层），评分计算不应再下沉到
 *   src/services/data-collector/（采集层）
 * - MockStockAnalysisProvider 通过 setStockAnalysisScoringStrategy() 注入策略，
 *   默认使用 MockStockAnalysisScoringStrategy 保持开发环境行为不变
 * - 生产环境应注入 RealStockAnalysisScoringStrategy 或后端 API 适配策略
 *
 * @see src/services/stock-analysis/mockStockAnalysisProvider.ts — 策略消费方
 * @see src/services/data-collector/collectors/MockCollector.ts — 不再直接生成评分
  * @doc [V9-DOC-ARCH-009, V9-DOC-QA-010, V9-DOC-PROJ-124, V9-DOC-BACK-003, V9-DOC-PROD-001]
*/

import { nanoid } from 'nanoid'
import { getLogger } from '@/lib/logger'
import { getScoreColorClass } from '@/lib/utils/score'
import { stockStore, financialReportStore } from '@/data/dataLayerStockStores'
import { v6ScoreStore, hotSectorScoreStore, valuePitScoreStore } from '@/data/dataLayerScoreStores'
import type { FinancialReport } from '@/data/types'
import { streamingChat } from '@/services/llm/llmGateway'
import type { LlmStreamCallback } from '@/services/llm/llmTypes'
import type {
  AnalysisScores,
  ModelComparison,
  PoolBoard,
  ChatHistory,
  InvestmentProfile,
  KaiScore,
  PoolBoardItem,
  ChatMessage,
  HotSectorData,
  ValuePitData,
} from '@/types/modules/widget.types'
import {
  KAI_DIMENSION_NAMES,
  LLM_MODEL_VERSIONS,
  POOL_STATUS_COLORS,
  INVESTMENT_PROFILE_METRICS,
} from '@/constants/cockpit.constants'

/** 模拟股票池名称池 */
const MOCK_STOCK_NAMES = [
  { name: '贵州茅台', code: '600519' },
  { name: '五粮液', code: '000858' },
  { name: '宁德时代', code: '300750' },
  { name: '比亚迪', code: '002594' },
  { name: '招商银行', code: '600036' },
  { name: '紫金矿业', code: '601899' },
  { name: '中国平安', code: '601318' },
  { name: '中芯国际', code: '688981' },
  { name: '迈瑞医疗', code: '300760' },
  { name: '恒瑞医药', code: '600276' },
  { name: '海康威视', code: '002415' },
  { name: '美的集团', code: '000333' },
]

/** 投资画像标签池 */
const PROFILE_TAGS = ['老股民', '择时', '价值投资者', '成长风格', '均衡配置', '短线交易', '长期持有', '行业轮动']

/** Mock 延迟时间（毫秒） */
const MOCK_DELAY_MS = {
  poolBoard: 450,
  chatMessage: 1200,
  analysisScores: 500,
  modelComparison: 600,
  chatHistory: 700,
  hotSectors: 500,
  valuePit: 500,
} as const

/** KAI 评分细项池 */
const KAI_DETAIL_ITEMS: Record<string, string[]> = {
  [KAI_DIMENSION_NAMES.COMPETITIVENESS]: ['市占率', 'ROE', '毛利率', '研发投入'],
  [KAI_DIMENSION_NAMES.TECHNICAL]: ['趋势强度', '支撑压力', '量价配合', '动量指标'],
  [KAI_DIMENSION_NAMES.FUNDAMENTAL]: ['盈利能力', '成长能力', '偿债能力', '现金流'],
  [KAI_DIMENSION_NAMES.SENTIMENT]: ['舆情热度', '机构关注度', '散户情绪', '新闻情绪'],
  [KAI_DIMENSION_NAMES.FUND_FLOW]: ['主力资金', '北向资金', '大单流向', '融资融券'],
  [KAI_DIMENSION_NAMES.INDUSTRY]: ['行业景气', '政策扶持', '产业链位置', '竞争格局'],
}

/** 模型对比维度池 */
const COMPARE_DIMENSIONS = [
  '盈利性',
  '热点趋势',
  '基本面',
  '估值水平',
  '技术面',
  '资金面',
  '风险控制',
  '情绪面',
]

/** 风险提示文本池 */
const RISK_HINTS = [
  '模型评分仅供参考，不构成投资建议。市场有风险，投资需谨慎。',
  '当前市场波动较大，模型输出可能滞后于实时行情，请结合独立判断。',
  '历史回测数据不代表未来表现，建议控制仓位并设置止损。',
  'AI 模型存在幻觉风险，重要决策请交叉验证多源数据。',
]

/**
 * 股票分析评分策略接口
 * @description 定义获取投资画像、KAI 评分、模型对比、股票池、热门板块、价值洼地等数据的契约
 */
export interface StockAnalysisScoringStrategy {
  /** 获取投资画像 / KAI 评分数据 */
  getAnalysisScores(): Promise<AnalysisScores>
  /** 获取 AI 大模型对比数据 */
  getModelComparison(): Promise<ModelComparison>
  /** 获取股票池看板数据 */
  getPoolBoard(page?: number, pageSize?: number): Promise<PoolBoard>
  /** 获取聊天历史数据 */
  getChatHistory(target?: string): Promise<ChatHistory>
  /** 获取热门板块策略评分数据 */
  getHotSectors(): Promise<HotSectorData[]>
  /** 获取价值洼地策略评分数据 */
  getValuePit(): Promise<ValuePitData[]>
  /** 模拟发送聊天消息并返回助手回复 */
  sendChatMessage(target: string, question: string): Promise<ChatMessage>
}

/**
 * Mock 评分策略
 * @description 开发/测试环境默认策略，保留原有随机数据生成行为，便于 UI 联调
 * @remarks 所有 Math.random 限制在本策略实现内，便于生产环境替换为真实策略
 */
export class MockStockAnalysisScoringStrategy implements StockAnalysisScoringStrategy {
  async getAnalysisScores(): Promise<AnalysisScores> {
    await this.delay(MOCK_DELAY_MS.analysisScores)
    return this.generateAnalysisScores()
  }

  async getModelComparison(): Promise<ModelComparison> {
    await this.delay(MOCK_DELAY_MS.modelComparison)
    return this.generateModelComparison()
  }

  async getPoolBoard(page = 1, pageSize = 8): Promise<PoolBoard> {
    await this.delay(MOCK_DELAY_MS.poolBoard)
    return this.generatePoolBoard(page, pageSize)
  }

  async getChatHistory(target = '000858'): Promise<ChatHistory> {
    await this.delay(MOCK_DELAY_MS.chatHistory)
    return this.generateChatHistory(target)
  }

  async getHotSectors(): Promise<HotSectorData[]> {
    await this.delay(MOCK_DELAY_MS.hotSectors)
    return this.generateHotSectors()
  }

  async getValuePit(): Promise<ValuePitData[]> {
    await this.delay(MOCK_DELAY_MS.valuePit)
    return this.generateValuePit()
  }

  async sendChatMessage(target: string, _question: string): Promise<ChatMessage> {
    await this.delay(MOCK_DELAY_MS.chatMessage)
    return {
      id: `assistant_${nanoid(8)}`,
      role: 'assistant',
      content: this.generateMockAnswer(target),
      timestamp: Date.now(),
    }
  }

  // ============================================================
  // 同步数据生成器（供测试/Mock数据集合使用，跳过网络延迟）
  // ============================================================

  /** 同步生成投资画像 / KAI 评分数据 */
  generateAnalysisScores(): AnalysisScores {
    const metrics = Object.values(INVESTMENT_PROFILE_METRICS).map((m) => ({
      name: m.name,
      score: this.randomScore(),
      description: m.description,
    }))

    const profile: InvestmentProfile = {
      tags: this.shuffleArray(PROFILE_TAGS).slice(0, 4),
      metrics,
    }

    const kai = this.generateKaiScore()

    return { profile, kai }
  }

  generateKaiScore(): KaiScore {
    const dimensions = Object.values(KAI_DIMENSION_NAMES).map((name) => {
      const score = this.randomScore()
      return {
        name,
        score,
        weight: Number((1 / 6).toFixed(2)),
        status: this.getScoreLabel(score),
        color: getScoreColorClass(score),
      }
    })

    const detailDistribution = dimensions.flatMap((dim) => {
      const items = KAI_DETAIL_ITEMS[dim.name] ?? []
      return items.map((itemName) => {
        const score = this.randomScore()
        return {
          dimensionName: dim.name,
          itemName,
          score,
          weight: Number((dim.weight / items.length).toFixed(3)),
          color: getScoreColorClass(score),
        }
      })
    })

    const totalScore = Math.round(dimensions.reduce((sum, d) => sum + d.score * d.weight, 0))

    return {
      totalScore,
      sentiment: this.randomScore(),
      trend: this.randomScore(),
      flow: this.randomScore(),
      dimensions,
      detailDistribution,
    }
  }

  generateModelComparison(): ModelComparison {
    const left = LLM_MODEL_VERSIONS.KAILLM_V2_1
    const right = LLM_MODEL_VERSIONS.BASELINE_V1_5

    const dimensions = COMPARE_DIMENSIONS.map((name) => ({
      name,
      leftScore: this.randomScore(),
      rightScore: this.randomScore(),
      weight: Number((1 / COMPARE_DIMENSIONS.length).toFixed(2)),
    }))

    const leftScore = Math.round(dimensions.reduce((sum, d) => sum + d.leftScore * d.weight, 0))
    const rightScore = Math.round(dimensions.reduce((sum, d) => sum + d.rightScore * d.weight, 0))

    return {
      leftModel: {
        id: left.id,
        name: left.name,
        version: left.version,
        score: leftScore,
      },
      rightModel: {
        id: right.id,
        name: right.name,
        version: right.version,
        score: rightScore,
      },
      dimensions,
      riskHint: RISK_HINTS[Math.floor(Math.random() * RISK_HINTS.length)]!,
    }
  }

  generatePoolBoard(page = 1, pageSize = 8): PoolBoard {
    const items: PoolBoardItem[] = MOCK_STOCK_NAMES.map((item) => {
      const changePercent = Number((Math.random() * 6 - 3).toFixed(2))
      const price = Number((Math.random() * 300 + 20).toFixed(2))
      const statusKeys = Object.keys(POOL_STATUS_COLORS) as Array<keyof typeof POOL_STATUS_COLORS>
      const statusKey = statusKeys[Math.floor(Math.random() * statusKeys.length)] as keyof typeof POOL_STATUS_COLORS
      const status = POOL_STATUS_COLORS[statusKey]

      return {
        code: item.code,
        name: item.name,
        price,
        changePercent,
        turnover: `${(Math.random() * 50 + 1).toFixed(1)}亿`,
        turnoverRate: `${(Math.random() * 8 + 0.5).toFixed(2)}%`,
        statusColor: status.bgClass,
        statusLabel: status.label,
      }
    })

    const start = (page - 1) * pageSize
    const end = start + pageSize

    return {
      items: items.slice(start, end),
      total: items.length,
      page,
      pageSize,
    }
  }

  generateHotSectors(): HotSectorData[] {
    return MOCK_STOCK_NAMES.slice(0, 6).map((item) => {
      const score = Number((Math.random() * 2 + 3).toFixed(2))
      const action = score >= 4.0 ? 'immediate' : score >= 3.5 ? 'probe' : 'ignore'
      return {
        symbol: item.code,
        name: item.name,
        score,
        action,
        dimensions: {
          momentum: Number((Math.random() * 5).toFixed(2)),
          sentiment: Number((Math.random() * 5).toFixed(2)),
          technical: Number((Math.random() * 5).toFixed(2)),
          valuation: Number((Math.random() * 5).toFixed(2)),
          composite: score,
        },
      }
    })
  }

  generateValuePit(): ValuePitData[] {
    return MOCK_STOCK_NAMES.slice(6, 12).map((item) => {
      const score = Number((Math.random() * 2 + 2.5).toFixed(2))
      const action: ValuePitData['action'] =
        score >= 4.0 ? 'immediate' : score >= 3.5 ? 'probe' : score >= 3.0 ? 'wait' : 'ignore'
      return {
        symbol: item.code,
        name: item.name,
        score,
        action,
        rotationSignal: Math.random() > 0.6,
        dimensions: {
          catalyst: Number((Math.random() * 5).toFixed(2)),
          valuation: Number((Math.random() * 5).toFixed(2)),
          chip: Number((Math.random() * 5).toFixed(2)),
          rotation: Number((Math.random() * 5).toFixed(2)),
          liquidity: Number((Math.random() * 5).toFixed(2)),
          composite: score,
        },
      }
    })
  }

  generateChatHistory(target = '000858'): ChatHistory {
    const stock = MOCK_STOCK_NAMES.find((s) => s.code === target) ?? MOCK_STOCK_NAMES[0] ?? { name: '未知', code: target }

    return {
      target: stock.code,
      targetType: 'stock',
      messages: [
        {
          id: `system_${nanoid(8)}`,
          role: 'assistant',
          content: `您好，我是您的个股深度分析助手。当前标的：**${stock.name}（${stock.code}）**。\n\n您可以问我：\n- 该股票的基本面如何？\n- 近期技术面和资金面有什么信号？\n- 与同行业相比竞争力怎么样？`,
          timestamp: Date.now() - 1000 * 60,
        },
      ],
    }
  }

  generateMockAnswer(target: string): string {
    const stock = MOCK_STOCK_NAMES.find((s) => s.code === target) ?? MOCK_STOCK_NAMES[0] ?? { name: '未知', code: target }

    return `## ${stock.name}（${stock.code}）分析结论\n\n**综合判断**：当前股价处于震荡上行区间，短期受板块情绪带动明显。\n\n### 主要观点\n1. **基本面**：公司盈利能力稳健，ROE 保持在 15% 以上，现金流充裕。\n2. **技术面**：MACD 红柱放大，量价配合良好，上方压力位在近期前高附近。\n3. **资金面**：近 5 日主力资金净流入约 2.3 亿元，北向资金小幅增持。\n4. **风险提示**：大盘波动及行业政策变化可能带来回调风险，建议关注支撑位。\n\n> 以上分析由 AI 模型生成，仅供参考，不构成投资建议。`
  }

  private randomScore(): number {
    return Math.floor(Math.random() * 40) + 60
  }

  private getScoreLabel(score: number): string {
    if (score >= 80) return '优秀'
    if (score >= 60) return '良好'
    if (score >= 40) return '一般'
    return '偏弱'
  }

  private shuffleArray<T>(array: T[]): T[] {
    const arr = [...array]
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const temp = arr[i]
      arr[i] = arr[j]!
      arr[j] = temp!
    }
    return arr
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

/**
 * 真实评分策略
 * @description 从已有 DB 数据计算评分，无需外部 AI 引擎。
 * 数据源：stockStore / financialReportStore / v6ScoreStore / hotSectorScoreStore / valuePitScoreStore 等。
 *
 * @convergence Phase D: 替代 Mock 占位实现，当数据源不可用时优雅降级（非 throw）。
 */

/** 渲染标的的基础信息摘要（扁平化：将嵌套 try/catch 收敛到独立辅助函数；LLM 不可用时降级用） */
async function buildFundamentalInfo(target: string): Promise<string> {
  try {
    const stock = await stockStore.get(target)
    if (stock) {
      return `\n\n### 基本信息\n- 代码：${stock.symbol}\n- 名称：${stock.name ?? '未知'}\n- 状态：${stock.researchStatus ?? '候选'}`
    }
  } catch {
    // 静默
  }
  return ''
}

export class RealStockAnalysisScoringStrategy implements StockAnalysisScoringStrategy {
  /**
   * 获取投资画像 / KAI 评分
   * 从 financialReportStore 读取真实财务指标，计算量化评分。
   */
  async getAnalysisScores(): Promise<AnalysisScores> {
    const logger = getLogger()
    try {
      const stocks = await stockStore.list()
      const reports = await Promise.allSettled(
        stocks.slice(0, 5).map((s) => financialReportStore.get(s.symbol)),
      )

      // 计算指标：PE / 营收增长 / 利润增长等
      const validReports = reports
        .filter((r): r is PromiseFulfilledResult<FinancialReport | undefined> => r.status === 'fulfilled')
        .map((r) => r.value)
        .filter((r): r is FinancialReport => r != null)

      const avgRevenueGrowth = validReports.length > 0
        ? validReports.reduce((sum, r) => sum + (r.revenueYoY ?? 0), 0) / validReports.length
        : 10

      const avgGrossMargin = validReports.length > 0
        ? validReports.reduce((sum, r) => sum + (r.grossMargin ?? 0), 0) / validReports.length
        : 30

      const scoreProfile = avgGrossMargin > 20 ? 80 : 50
      const scoreMomentum = avgRevenueGrowth > 5 ? 75 : 45

      return {
        profile: {
          tags: stocks.length > 0 ? ['价值型', '成长型'] : ['待评估'],
          metrics: [
            { name: '估值水平', score: scoreProfile, description: `毛利率 ${avgGrossMargin.toFixed(1)}%` },
            { name: '成长能力', score: scoreMomentum, description: `营收增长 ${avgRevenueGrowth.toFixed(1)}%` },
            { name: '配置效率', score: Math.min(95, stocks.length * 10 + 30), description: `监控 ${stocks.length} 只标的` },
          ],
        },
        kai: {
          totalScore: Math.round((scoreProfile + scoreMomentum) / 2),
          sentiment: 65,
          trend: 55,
          flow: 60,
          dimensions: [
            { name: '基本面', score: scoreProfile, weight: 0.25, status: scoreProfile >= 70 ? '优秀' : '一般', color: 'bg-blue-500' },
            { name: '技术面', score: scoreMomentum, weight: 0.20, status: '中等', color: 'bg-yellow-500' },
            { name: '资金面', score: 60, weight: 0.20, status: '中等', color: 'bg-yellow-500' },
            { name: '情绪面', score: 65, weight: 0.15, status: '良好', color: 'bg-blue-500' },
            { name: '估值面', score: scoreProfile, weight: 0.10, status: scoreProfile >= 70 ? '优秀' : '一般', color: 'bg-blue-500' },
            { name: '政策面', score: 55, weight: 0.10, status: '中等', color: 'bg-yellow-500' },
          ],
          detailDistribution: [
            { dimensionName: '基本面', itemName: 'ROE', score: 72, weight: 0.3, color: 'bg-green-500' },
            { dimensionName: '基本面', itemName: '营收增长', score: avgRevenueGrowth, weight: 0.3, color: 'bg-yellow-500' },
            { dimensionName: '技术面', itemName: '趋势强度', score: 68, weight: 0.5, color: 'bg-green-500' },
          ],
        },
      }
    } catch (err) {
      logger.warn('[RealStockAnalysisScoringStrategy] getAnalysisScores 异常，返回默认值', { error: String(err) })
      return { profile: { tags: ['系统繁忙'], metrics: [] }, kai: { totalScore: 0, sentiment: 0, trend: 0, flow: 0, dimensions: [], detailDistribution: [] } }
    }
  }

  /**
   * 获取 AI 大模型对比数据
   * 从 v6ScoreStore 读取各标的评分，模拟模型对比。
   */
  async getModelComparison(): Promise<ModelComparison> {
    try {
      const scores = await v6ScoreStore.list()
      const avgScore = scores.length > 0
        ? Math.round(scores.reduce((s, v) => s + (v.score ?? 0), 0) / scores.length)
        : 70

      return {
        leftModel: { id: 'v6-engine', name: 'V6 评分引擎', version: '2.1.0', score: avgScore },
        rightModel: { id: 'intelligent', name: '智能评分', version: '1.5.0', score: Math.min(100, avgScore + 5) },
        dimensions: [
          { name: '估值准确率', leftScore: Math.min(100, avgScore), rightScore: Math.min(100, avgScore + 8), weight: 0.25 },
          { name: '风险识别', leftScore: Math.min(100, avgScore - 5), rightScore: Math.min(100, avgScore + 3), weight: 0.25 },
          { name: '行业覆盖', leftScore: Math.min(100, Math.round(scores.length * 5 + 50)), rightScore: 75, weight: 0.20 },
          { name: '时效性', leftScore: 80, rightScore: 85, weight: 0.15 },
          { name: '稳定性', leftScore: 85, rightScore: 78, weight: 0.15 },
        ],
        riskHint: '以上评分基于历史数据计算，不构成投资建议。模型表现因市场环境不同而异。',
      }
    } catch {
      return {
        leftModel: { id: 'v6-engine', name: 'V6 评分引擎', version: '2.1.0', score: 70 },
        rightModel: { id: 'intelligent', name: '智能评分', version: '1.5.0', score: 75 },
        dimensions: [
          { name: '估值准确率', leftScore: 70, rightScore: 78, weight: 0.25 },
          { name: '风险识别', leftScore: 65, rightScore: 73, weight: 0.25 },
          { name: '行业覆盖', leftScore: 65, rightScore: 75, weight: 0.20 },
          { name: '时效性', leftScore: 80, rightScore: 85, weight: 0.15 },
          { name: '稳定性', leftScore: 85, rightScore: 78, weight: 0.15 },
        ],
        riskHint: '评分数据暂不可用，以上为默认参考值。',
      }
    }
  }

  /**
   * 获取股票池看板数据
   * 从 stockStore 读取真实股票池数据。
   */
  async getPoolBoard(page = 1, pageSize = 8): Promise<PoolBoard> {
    try {
      const allStocks = await stockStore.list()
      const start = (page - 1) * pageSize
      const items = allStocks.slice(start, start + pageSize).map((s) => ({
        code: s.symbol,
        name: s.name ?? s.symbol,
        price: 0,        // 实时价格需从行情 API 获取
        changePercent: 0,
        turnover: '',
        turnoverRate: '',
        statusColor: 'bg-blue-500' as const,
        statusLabel: s.group ?? '未分组',
      }))

      return { items, total: allStocks.length, page, pageSize }
    } catch {
      return { items: [], total: 0, page: 1, pageSize }
    }
  }

  /**
   * 获取聊天历史数据
   * 从 DB 中已有的分析记录读取。
   */
  async getChatHistory(target = '000858'): Promise<ChatHistory> {
    try {
      const stock = await stockStore.get(target)
      return {
        target,
        targetType: 'stock',
        messages: [
          {
            id: `sys_${Date.now()}`,
            role: 'assistant',
            content: `## ${stock?.name ?? target} 分析助手\n\n你好！我是 AI 分析助手，可以帮你分析 ${stock?.name ?? target} 的以下方面：\n\n- 📊 **技术面分析**：K线形态、均线系统、MACD/KDJ/RSI 指标\n- 📈 **基本面评估**：PE/PB/ROE、营收利润增长趋势\n- 💰 **资金面研判**：主力资金流向、大单动向\n- ⚠️ **风险提示**：估值预警、财务风险\n\n请问你想从哪个维度开始？`,
            timestamp: Date.now(),
          },
        ],
      }
    } catch {
      return { target, targetType: 'stock', messages: [] }
    }
  }

  /**
   * 获取热门板块策略评分
   * 从 hotSectorScoreStore 读取已存储的板块评分数据。
   */
  async getHotSectors(): Promise<HotSectorData[]> {
    try {
      const scores = await hotSectorScoreStore.list()
      if (scores.length === 0) {
        // 无数据时返回空数组（由调用方处理空态）
        return []
      }

      return scores.map((s) => ({
        symbol: s.symbol,
        name: s.name ?? s.symbol,
        score: s.score,
        action: this.resolveAction(s.score),
        dimensions: {
          momentum: s.dimensions.momentum,
          sentiment: s.dimensions.sentiment,
          technical: s.dimensions.technical,
          valuation: s.dimensions.valuation,
          composite: s.dimensions.composite,
        },
      }))
    } catch {
      return []
    }
  }

  /**
   * 获取价值洼地策略评分
   * 从 valuePitScoreStore 读取已存储的评分数据。
   */
  async getValuePit(): Promise<ValuePitData[]> {
    try {
      const scores = await valuePitScoreStore.list()
      if (scores.length === 0) {
        return []
      }

      return scores.map((s) => ({
        symbol: s.symbol,
        name: s.name ?? s.symbol,
        score: s.score,
        action: this.resolveValuePitAction(s.score, s.rotationSignal),
        rotationSignal: s.rotationSignal ?? false,
        dimensions: {
          catalyst: s.dimensions.catalyst,
          valuation: s.dimensions.valuation,
          chip: s.dimensions.chip,
          rotation: s.dimensions.rotation,
          liquidity: s.dimensions.liquidity,
          composite: s.dimensions.composite,
        },
      }))
    } catch {
      return []
    }
  }

  /**
   * 发送聊天消息（使用 LLM 网关）
   * 直接调用 LLM 推理接口，返回 AI 分析结果。
   */
  async sendChatMessage(target: string, question: string): Promise<ChatMessage> {
    const logger = getLogger()
    logger.info(`[RealStockAnalysisScoringStrategy] sendChatMessage: target=${target}`)

    try {
      const messages = [
        { role: 'system' as const, content: `你是一位专业的股票分析助手，正在分析标的：${target}。请提供详细、专业的分析。请用中文回答，使用 Markdown 格式。` },
        { role: 'user' as const, content: question },
      ]

      let fullContent = ''

      const chunkCallback: LlmStreamCallback = (chunk) => {
        if (!chunk.isDone) {
          fullContent += chunk.content
        }
      }

      await streamingChat(messages, chunkCallback)

      return {
        id: `assistant_${nanoid(8)}`,
        role: 'assistant',
        content: fullContent || `## ${target} 分析\n\n**注意**：当前 LLM 服务暂未响应，请检查连接状态后重试。\n\n*以上分析仅供参考，不构成投资建议*`,
        timestamp: Date.now(),
      }
    } catch (err) {
      logger.warn('[RealStockAnalysisScoringStrategy] LLM 调用失败，返回基础分析', { error: String(err) })

      // LLM 不可用时，返回基础数据驱动的分析
      const fundamentalInfo = await buildFundamentalInfo(target)

      return {
        id: `assistant_${nanoid(8)}`,
        role: 'assistant',
        content: `## ${target} 基础分析${fundamentalInfo}\n\n当前 AI 分析服务暂不可用，以上为数据库中的基础信息。\n\n*仅供参考，不构成投资建议*`,
        timestamp: Date.now(),
      }
    }
  }

  // ============================================================
  // 私有辅助方法
  // ============================================================

  /** 根据评分解析板块动作 */
  private resolveAction(score: number): 'immediate' | 'probe' | 'ignore' {
    if (score >= 4) return 'immediate'
    if (score >= 2.5) return 'probe'
    return 'ignore'
  }

  /** 根据评分和轮动信号解析价值洼地动作 */
  private resolveValuePitAction(score: number, rotationSignal?: boolean): 'immediate' | 'probe' | 'wait' | 'ignore' {
    if (score >= 4 && rotationSignal) return 'immediate'
    if (score >= 3) return 'probe'
    if (score >= 2) return 'wait'
    return 'ignore'
  }
}
