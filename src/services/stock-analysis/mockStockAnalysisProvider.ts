import { nanoid } from 'nanoid'

import type {
  AnalysisScores,
  ModelComparison,
  StockPool,
  ChatHistory,
  InvestmentProfile,
  KaiScore,
  StockPoolItem,
  ChatMessage,
  HotSectorData,
  ValuePitData,
} from '@/types/modules/widget.types'
import {
  KAI_DIMENSION_NAMES,
  LLM_MODEL_VERSIONS,
  STOCK_POOL_STATUS_COLORS,
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
 * 股票分析业务 Mock 数据提供者
 * @description 为投资画像、KAI 评分、模型对比、股票池、智能聊天等 Widget 提供模拟数据
 * @remarks 开发环境默认使用；生产环境切换为 REST/WebSocket Collector 后，此文件仅用于单元测试
 */
export class MockStockAnalysisProvider {
  /**
   * 获取投资画像 / 分析评分数据
   * @description 未来替换为真实 API：调用用户画像量化模型或行为分析服务
   */
  static getAnalysisScores(): Promise<AnalysisScores> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(generateAnalysisScores()), 500)
    })
  }

  /**
   * 获取 AI 大模型对比数据
   * @description 未来替换为真实 API：调用多模型推理服务，返回各维度评分与风险提示
   */
  static getModelComparison(): Promise<ModelComparison> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(generateModelComparison()), 600)
    })
  }

  /**
   * 获取股票池数据
   * @description 未来替换为真实 API：调用证券行情 API 获取自选股/监控池实时行情
   */
  static getStockPool(page = 1, pageSize = 8): Promise<StockPool> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(generateStockPool(page, pageSize)), 450)
    })
  }

  /**
   * 获取聊天历史数据
   * @description 未来替换为真实 API：调用大模型对话接口，支持流式/全量返回 Markdown 分析结果
   */
  static getChatHistory(target = '000858'): Promise<ChatHistory> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(generateChatHistory(target)), 700)
    })
  }

  /**
   * 获取热门板块策略评分数据
   * @description 未来替换为真实 API：调用 dualStrategyEngine 输出
   */
  static getHotSectors(): Promise<HotSectorData[]> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(generateHotSectors()), 500)
    })
  }

  /**
   * 获取价值洼地策略评分数据
   * @description 未来替换为真实 API：调用 dualStrategyEngine 输出
   */
  static getValuePit(): Promise<ValuePitData[]> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(generateValuePit()), 500)
    })
  }

  /**
   * 模拟发送聊天消息并返回助手回复
   * @description 未来替换为真实 API：调用 LLM 推理接口（流式 SSE 或 REST 全量返回）
   */
  static sendChatMessage(target: string, _question: string): Promise<ChatMessage> {
    return new Promise((resolve) => {
      setTimeout(
        () =>
          resolve({
            id: `assistant_${nanoid(8)}`,
            role: 'assistant',
            content: generateMockAnswer(target),
            timestamp: Date.now(),
          }),
        1200
      )
    })
  }
}

// ============================================================
// 数据生成器（内部使用）
// ============================================================

function generateAnalysisScores(): AnalysisScores {
  const metrics = Object.values(INVESTMENT_PROFILE_METRICS).map((m) => ({
    name: m.name,
    score: randomScore(),
    description: m.description,
  }))

  const profile: InvestmentProfile = {
    tags: shuffleArray(PROFILE_TAGS).slice(0, 4),
    metrics,
  }

  const kai = generateKaiScore()

  return { profile, kai }
}

function generateKaiScore(): KaiScore {
  const dimensions = Object.values(KAI_DIMENSION_NAMES).map((name) => {
    const score = randomScore()
    return {
      name,
      score,
      weight: Number((1 / 6).toFixed(2)),
      status: getScoreLabel(score),
      color: getScoreColor(score),
    }
  })

  const detailDistribution = dimensions.flatMap((dim) => {
    const items = KAI_DETAIL_ITEMS[dim.name] ?? []
    return items.map((itemName) => {
      const score = randomScore()
      return {
        dimensionName: dim.name,
        itemName,
        score,
        weight: Number((dim.weight / items.length).toFixed(3)),
        color: getScoreColor(score),
      }
    })
  })

  const totalScore = Math.round(dimensions.reduce((sum, d) => sum + d.score * d.weight, 0))

  return {
    totalScore,
    sentiment: randomScore(),
    trend: randomScore(),
    flow: randomScore(),
    dimensions,
    detailDistribution,
  }
}

function generateModelComparison(): ModelComparison {
  const left = LLM_MODEL_VERSIONS.KAILLM_V2_1
  const right = LLM_MODEL_VERSIONS.BASELINE_V1_5

  const dimensions = COMPARE_DIMENSIONS.map((name) => ({
    name,
    leftScore: randomScore(),
    rightScore: randomScore(),
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

function generateStockPool(page = 1, pageSize = 8): StockPool {
  const stocks: StockPoolItem[] = MOCK_STOCK_NAMES.map((item) => {
    const changePercent = Number((Math.random() * 6 - 3).toFixed(2))
    const price = Number((Math.random() * 300 + 20).toFixed(2))
    const statusKeys = Object.keys(STOCK_POOL_STATUS_COLORS) as Array<keyof typeof STOCK_POOL_STATUS_COLORS>
    const statusKey = statusKeys[Math.floor(Math.random() * statusKeys.length)] as keyof typeof STOCK_POOL_STATUS_COLORS
    const status = STOCK_POOL_STATUS_COLORS[statusKey]

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
    stocks: stocks.slice(start, end),
    total: stocks.length,
    page,
    pageSize,
  }
}

function generateHotSectors(): HotSectorData[] {
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

function generateValuePit(): ValuePitData[] {
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

function generateChatHistory(target = '000858'): ChatHistory {
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
  const stock = MOCK_STOCK_NAMES.find((s) => s.code === target) || MOCK_STOCK_NAMES[0] || { name: '未知', code: target }

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

function generateMockAnswer(target: string): string {
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
  const stock = MOCK_STOCK_NAMES.find((s) => s.code === target) || MOCK_STOCK_NAMES[0] || { name: '未知', code: target }

  return `## ${stock.name}（${stock.code}）分析结论\n\n**综合判断**：当前股价处于震荡上行区间，短期受板块情绪带动明显。\n\n### 主要观点\n1. **基本面**：公司盈利能力稳健，ROE 保持在 15% 以上，现金流充裕。\n2. **技术面**：MACD 红柱放大，量价配合良好，上方压力位在近期前高附近。\n3. **资金面**：近 5 日主力资金净流入约 2.3 亿元，北向资金小幅增持。\n4. **风险提示**：大盘波动及行业政策变化可能带来回调风险，建议关注支撑位。\n\n> 以上分析由 AI 模型生成，仅供参考，不构成投资建议。`
}

// ============================================================
// 工具函数
// ============================================================

function randomScore(): number {
  return Math.floor(Math.random() * 40) + 60
}

function getScoreLabel(score: number): string {
  if (score >= 80) return '优秀'
  if (score >= 60) return '良好'
  if (score >= 40) return '一般'
  return '偏弱'
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'bg-green-500'
  if (score >= 60) return 'bg-blue-500'
  if (score >= 40) return 'bg-amber-500'
  return 'bg-red-500'
}

function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = arr[i]
    arr[i] = arr[j]!
    arr[j] = temp!
  }
  return arr
}
