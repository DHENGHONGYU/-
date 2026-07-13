/**
 * @fileoverview 股票分析评分策略接口与实现
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
 */

import { nanoid } from 'nanoid'
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
    await this.delay(500)
    return this.generateAnalysisScores()
  }

  async getModelComparison(): Promise<ModelComparison> {
    await this.delay(600)
    return this.generateModelComparison()
  }

  async getPoolBoard(page = 1, pageSize = 8): Promise<PoolBoard> {
    await this.delay(450)
    return this.generatePoolBoard(page, pageSize)
  }

  async getChatHistory(target = '000858'): Promise<ChatHistory> {
    await this.delay(700)
    return this.generateChatHistory(target)
  }

  async getHotSectors(): Promise<HotSectorData[]> {
    await this.delay(500)
    return this.generateHotSectors()
  }

  async getValuePit(): Promise<ValuePitData[]> {
    await this.delay(500)
    return this.generateValuePit()
  }

  async sendChatMessage(target: string, _question: string): Promise<ChatMessage> {
    await this.delay(1200)
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
        color: this.getScoreColor(score),
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
          color: this.getScoreColor(score),
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

  private getScoreColor(score: number): string {
    if (score >= 80) return 'bg-green-500'
    if (score >= 60) return 'bg-blue-500'
    if (score >= 40) return 'bg-amber-500'
    return 'bg-red-500'
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
 * 真实评分策略（占位实现）
 * @description 生产环境应注入此策略，将评分计算委托给真实分析服务或后端 API
 * @remarks 当前为框架占位，具体实现需根据后端接口/分析服务契约填充
 */
export class RealStockAnalysisScoringStrategy implements StockAnalysisScoringStrategy {
  async getAnalysisScores(): Promise<AnalysisScores> {
    // TODO: 接入真实用户画像量化模型或行为分析服务
    throw new Error('RealStockAnalysisScoringStrategy.getAnalysisScores() not implemented')
  }

  async getModelComparison(): Promise<ModelComparison> {
    // TODO: 接入多模型推理服务
    throw new Error('RealStockAnalysisScoringStrategy.getModelComparison() not implemented')
  }

  async getPoolBoard(_page = 1, _pageSize = 8): Promise<PoolBoard> {
    // TODO: 接入证券行情 API 获取自选股/监控池实时行情
    throw new Error('RealStockAnalysisScoringStrategy.getPoolBoard() not implemented')
  }

  async getChatHistory(_target = '000858'): Promise<ChatHistory> {
    // TODO: 接入大模型对话接口
    throw new Error('RealStockAnalysisScoringStrategy.getChatHistory() not implemented')
  }

  async getHotSectors(): Promise<HotSectorData[]> {
    // TODO: 接入 dualStrategyEngine / 热门板块分析服务
    throw new Error('RealStockAnalysisScoringStrategy.getHotSectors() not implemented')
  }

  async getValuePit(): Promise<ValuePitData[]> {
    // TODO: 接入 dualStrategyEngine / 价值洼地分析服务
    throw new Error('RealStockAnalysisScoringStrategy.getValuePit() not implemented')
  }

  async sendChatMessage(_target: string, _question: string): Promise<ChatMessage> {
    // TODO: 接入 LLM 推理接口（流式 SSE 或 REST 全量返回）
    throw new Error('RealStockAnalysisScoringStrategy.sendChatMessage() not implemented')
  }
}
