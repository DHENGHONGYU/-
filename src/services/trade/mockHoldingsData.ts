/**
 * @module MockHoldingsData
 * @description 交易持仓模块 Mock 数据生成器。提供本地开发时使用的模拟持仓数据，
 * 支持分页、筛选、搜索等完整查询逻辑。
 *
 * 注意：此文件被 vite.config.ts 的 mock 中间件动态导入，
 * 因此不能使用 @/ 别名导入，所有类型和常量均内联定义。
 */

// ============================================================
// 内联类型（避免 @/ 别名导入在 vite.config 上下文中无法解析）
// ============================================================

type StrategyType = 'CORE' | 'HOT' | 'VALUE'

const STRATEGY_TYPE = {
  CORE: 'CORE' as const,
  HOT: 'HOT' as const,
  VALUE: 'VALUE' as const,
}

const TRADE_DIRECTION = {
  BUY: 'BUY' as const,
  SELL: 'SELL' as const,
  ALL: 'ALL' as const,
}

interface HoldingItem {
  code: string
  name: string
  quantity: number
  currentPrice: number
  avgCost: number
  floatingPnl: number
  floatingPnlPercent: number
  marketValueRatio: number
  strategyId: string
  strategyType: StrategyType
}

interface HoldingsListData {
  total: number
  list: HoldingItem[]
}

interface HoldingsQueryParams {
  page: number
  pageSize: number
  startDate: string
  endDate: string
  direction: string
  keyword: string
}

interface TradeActionResponse {
  code: number
  success: boolean
  message: string
}

// ============================================================
// 模拟股票池
// ============================================================

interface StockTemplate {
  code: string
  name: string
  strategyType: StrategyType
  strategyId: string
}

const STOCK_POOL: StockTemplate[] = [
  // 核心仓 - 蓝筹股
  { code: '600519', name: '贵州茅台', strategyType: STRATEGY_TYPE.CORE, strategyId: 'CORE-001' },
  { code: '000858', name: '五粮液', strategyType: STRATEGY_TYPE.CORE, strategyId: 'CORE-001' },
  { code: '600036', name: '招商银行', strategyType: STRATEGY_TYPE.CORE, strategyId: 'CORE-002' },
  { code: '601318', name: '中国平安', strategyType: STRATEGY_TYPE.CORE, strategyId: 'CORE-002' },
  { code: '600276', name: '恒瑞医药', strategyType: STRATEGY_TYPE.CORE, strategyId: 'CORE-003' },
  { code: '000333', name: '美的集团', strategyType: STRATEGY_TYPE.CORE, strategyId: 'CORE-003' },
  { code: '600900', name: '长江电力', strategyType: STRATEGY_TYPE.CORE, strategyId: 'CORE-004' },
  { code: '601888', name: '中国中免', strategyType: STRATEGY_TYPE.CORE, strategyId: 'CORE-004' },

  // 热点短线
  { code: '300750', name: '宁德时代', strategyType: STRATEGY_TYPE.HOT, strategyId: 'HOT-001' },
  { code: '002594', name: '比亚迪', strategyType: STRATEGY_TYPE.HOT, strategyId: 'HOT-001' },
  { code: '300124', name: '汇川技术', strategyType: STRATEGY_TYPE.HOT, strategyId: 'HOT-002' },
  { code: '688981', name: '中芯国际', strategyType: STRATEGY_TYPE.HOT, strategyId: 'HOT-002' },
  { code: '300274', name: '阳光电源', strategyType: STRATEGY_TYPE.HOT, strategyId: 'HOT-003' },
  { code: '002475', name: '立讯精密', strategyType: STRATEGY_TYPE.HOT, strategyId: 'HOT-003' },
  { code: '300059', name: '东方财富', strategyType: STRATEGY_TYPE.HOT, strategyId: 'HOT-004' },
  { code: '688111', name: '金山办公', strategyType: STRATEGY_TYPE.HOT, strategyId: 'HOT-004' },

  // 价值洼地
  { code: '601166', name: '兴业银行', strategyType: STRATEGY_TYPE.VALUE, strategyId: 'VAL-001' },
  { code: '600585', name: '海螺水泥', strategyType: STRATEGY_TYPE.VALUE, strategyId: 'VAL-001' },
  { code: '000002', name: '万科A', strategyType: STRATEGY_TYPE.VALUE, strategyId: 'VAL-002' },
  { code: '601088', name: '中国神华', strategyType: STRATEGY_TYPE.VALUE, strategyId: 'VAL-002' },
  { code: '600028', name: '中国石化', strategyType: STRATEGY_TYPE.VALUE, strategyId: 'VAL-003' },
  { code: '601857', name: '中国石油', strategyType: STRATEGY_TYPE.VALUE, strategyId: 'VAL-003' },
  { code: '600019', name: '宝钢股份', strategyType: STRATEGY_TYPE.VALUE, strategyId: 'VAL-004' },
  { code: '000651', name: '格力电器', strategyType: STRATEGY_TYPE.VALUE, strategyId: 'VAL-004' },
  { code: '601398', name: '工商银行', strategyType: STRATEGY_TYPE.VALUE, strategyId: 'VAL-005' },
]

// ============================================================
// 确定性随机数生成器（保证每次生成数据一致）
// ============================================================

function seededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0xffffffff
  }
}

const rand = seededRandom(42)

// ============================================================
// 生成完整持仓数据
// ============================================================

function generateHoldings(): HoldingItem[] {
  return STOCK_POOL.map((stock) => {
    const basePrice = 10 + rand() * 200
    const currentPrice = Math.round(basePrice * 100) / 100
    const costDeviation = (rand() - 0.45) * 0.3 // -45% ~ +55% 偏离
    const avgCost = Math.round(currentPrice * (1 - costDeviation) * 100) / 100
    const quantity = Math.floor(1000 + rand() * 50000)
    const floatingPnl = Math.round((currentPrice - avgCost) * quantity * 100) / 100
    const floatingPnlPercent = Math.round(((currentPrice - avgCost) / avgCost) * 10000) / 100
    const marketValueRatio = Math.round(rand() * 15 * 100) / 100

    return {
      code: stock.code,
      name: stock.name,
      quantity,
      currentPrice,
      avgCost,
      floatingPnl,
      floatingPnlPercent,
      marketValueRatio,
      strategyId: stock.strategyId,
      strategyType: stock.strategyType,
    }
  })
}

/** 全量持仓数据（25 条） */
const ALL_HOLDINGS: HoldingItem[] = generateHoldings()

// ============================================================
// Mock API 实现
// ============================================================

/**
 * 模拟获取持仓列表（支持分页、筛选、搜索）
 */
export function mockFetchHoldings(params: HoldingsQueryParams): {
  code: number
  data: HoldingsListData
  message: string
} {
  let filtered = [...ALL_HOLDINGS]

  // 按交易方向筛选（基于 strategyType 模拟：CORE=BUY, HOT=BUY, VALUE=SELL）
  if (params.direction === TRADE_DIRECTION.BUY) {
    filtered = filtered.filter(
      (item) =>
        item.strategyType === STRATEGY_TYPE.CORE ||
        item.strategyType === STRATEGY_TYPE.HOT,
    )
  } else if (params.direction === TRADE_DIRECTION.SELL) {
    filtered = filtered.filter((item) => item.strategyType === STRATEGY_TYPE.VALUE)
  }

  // 关键字搜索
  if (params.keyword) {
    const kw = params.keyword.toLowerCase()
    filtered = filtered.filter(
      (item) =>
        item.code.includes(kw) || item.name.toLowerCase().includes(kw),
    )
  }

  const total = filtered.length
  const start = (params.page - 1) * params.pageSize
  const list = filtered.slice(start, start + params.pageSize)

  return {
    code: 200,
    data: { total, list },
    message: 'success',
  }
}

/**
 * 模拟执行交易操作
 */
export function mockExecuteTradeAction(
  code: string,
  action: string,
  quantity?: number,
): TradeActionResponse {
  const success = Math.random() > 0.1
  const actionLabel = action === 'ADD_POSITION' ? '补仓' : '平仓'
  const qtyInfo = quantity ? `，数量：${quantity}` : ''

  return {
    code: success ? 200 : 500,
    success,
    message: success
      ? `${actionLabel}操作成功：${code}${qtyInfo}`
      : `${actionLabel}操作失败：交易系统繁忙，请稍后重试`,
  }
}

/**
 * 模拟导出 Excel（生成 CSV 文本）
 */
export function mockExportCSV(params?: HoldingsQueryParams): string {
  let data = [...ALL_HOLDINGS]

  if (params) {
    if (params.direction === TRADE_DIRECTION.BUY) {
      data = data.filter(
        (item) =>
          item.strategyType === STRATEGY_TYPE.CORE ||
          item.strategyType === STRATEGY_TYPE.HOT,
      )
    } else if (params.direction === TRADE_DIRECTION.SELL) {
      data = data.filter((item) => item.strategyType === STRATEGY_TYPE.VALUE)
    }

    if (params.keyword) {
      const kw = params.keyword.toLowerCase()
      data = data.filter(
        (item) =>
          item.code.includes(kw) || item.name.toLowerCase().includes(kw),
      )
    }
  }

  const headers = [
    '证券代码', '证券名称', '持仓数量', '当前价格', '成本均价',
    '浮动盈亏', '盈亏比例(%)', '市值占比(%)', '策略类型',
  ]
  const rows = data.map((item) =>
    [
      item.code,
      item.name,
      item.quantity,
      item.currentPrice.toFixed(2),
      item.avgCost.toFixed(2),
      item.floatingPnl.toFixed(2),
      item.floatingPnlPercent.toFixed(2),
      item.marketValueRatio.toFixed(2),
      item.strategyType,
    ].join(','),
  )
  return '\uFEFF' + [headers.join(','), ...rows].join('\n')
}