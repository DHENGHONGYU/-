/**
 * 筹码策略复盘 — 模拟案例 Seed 数据
 *
 * 提供筹码策略复盘页（ChipStrategyReviewPage）的默认模拟个股案例，
 * 覆盖买/卖/持/观/逃五大交易动作及灰色地带边界场景，用于人工研判对照与边界验证。
 *
 * @module src/fixtures/chipStrategyMockData
 * @doc [V9-DOC-FRONT-CHIP-STRATEGY]
 */

/** 交易动作方向 */
export type SignalDirection = 'buy' | 'sell' | 'hold' | 'watch' | 'escape'

/** 示例场景：股票基本信息 + 筹码指标 */
export interface MockExample {
  /** 场景标签 */
  scenario: string
  /** 预期命中信号 */
  expectedSignal: string
  /** 预期交易动作 */
  expectedAction: SignalDirection
  /** 股票信息（用于下拉菜单） */
  stock: {
    symbol: string
    name: string
    price: number
    pe: number
    pb: number
    sector: string
  }
  /** 筹码指标（用于自动填充输入框） */
  chip: {
    turnover: number
    volumeRatio: number
    return60d: number
    priceChange: number
  }
}

/**
 * 筹码策略模拟案例集合
 *
 * 覆盖 12 种主力筹码变动信号的典型场景 + 灰色地带边界场景：
 * - 温和吸筹 / 强势启动 / 暴力吸筹 → 买入
 * - 高位反弹 / 健康趋势 → 持有
 * - 筹码锁定 / 高位回调 → 观望
 * - 死亡换手 / 对倒陷阱 → 逃离
 * - 底部放量横盘 → 灰色地带（不命中标准信号，需人工研判）
 */
export const MOCK_EXAMPLES: MockExample[] = [
  {
    scenario: '温和吸筹',
    expectedSignal: '黄金买点',
    expectedAction: 'buy',
    stock: { symbol: '300580', name: '贝斯特', price: 28.5, pe: 22.3, pb: 3.5, sector: '汽车零部件' },
    chip: { turnover: 4.2, volumeRatio: 3.1, return60d: -8.5, priceChange: 1.8 },
  },
  {
    scenario: '强势启动',
    expectedSignal: '黄金买点',
    expectedAction: 'buy',
    stock: { symbol: '300114', name: '中航电测', price: 46.8, pe: 58.2, pb: 6.1, sector: '军工电子' },
    chip: { turnover: 8.5, volumeRatio: 6.3, return60d: -7.0, priceChange: 7.5 },
  },
  {
    scenario: '暴力吸筹（陇神戎发）',
    expectedSignal: '跟进买点',
    expectedAction: 'buy',
    stock: { symbol: '300534', name: '陇神戎发', price: 16.4, pe: 52.3, pb: 6.8, sector: '中药' },
    chip: { turnover: 37.0, volumeRatio: 6.8, return60d: -12.3, priceChange: 10.3 },
  },
  {
    scenario: '高位反弹（紫光股份）',
    expectedSignal: '持有',
    expectedAction: 'hold',
    stock: { symbol: '000938', name: '紫光股份', price: 36.9, pe: 38.5, pb: 3.2, sector: 'IT服务' },
    chip: { turnover: 15.0, volumeRatio: 3.2, return60d: 15.6, priceChange: 7.6 },
  },
  {
    scenario: '高位回调（中控技术）',
    expectedSignal: '观望',
    expectedAction: 'watch',
    stock: { symbol: '688777', name: '中控技术', price: 103.5, pe: 62.0, pb: 12.5, sector: '工业软件' },
    chip: { turnover: 2.5, volumeRatio: 1.1, return60d: 40.0, priceChange: -1.0 },
  },
  {
    scenario: '筹码锁定',
    expectedSignal: '观望',
    expectedAction: 'watch',
    stock: { symbol: '600519', name: '贵州茅台', price: 1685, pe: 30.5, pb: 8.1, sector: '白酒' },
    chip: { turnover: 0.3, volumeRatio: 0.4, return60d: 3.2, priceChange: 0.5 },
  },
  {
    scenario: '健康趋势',
    expectedSignal: '持有',
    expectedAction: 'hold',
    stock: { symbol: '002475', name: '立讯精密', price: 38.2, pe: 28.6, pb: 6.0, sector: '消费电子' },
    chip: { turnover: 5.8, volumeRatio: 1.8, return60d: 8.5, priceChange: 2.3 },
  },
  {
    scenario: '死亡换手',
    expectedSignal: '逃离',
    expectedAction: 'escape',
    stock: { symbol: '300059', name: '东方财富', price: 15.8, pe: 35.2, pb: 4.1, sector: '证券' },
    chip: { turnover: 18.5, volumeRatio: 6.2, return60d: 42.3, priceChange: -5.6 },
  },
  {
    scenario: '对倒陷阱',
    expectedSignal: '逃离',
    expectedAction: 'escape',
    stock: { symbol: '002375', name: '亚厦股份', price: 8.5, pe: 15.2, pb: 1.8, sector: '建筑装饰' },
    chip: { turnover: 6.8, volumeRatio: 1.2, return60d: 18.5, priceChange: -0.8 },
  },
  {
    scenario: '底部放量横盘（边界案例）',
    expectedSignal: '观望',
    expectedAction: 'watch',
    stock: { symbol: '601633', name: '长安汽车', price: 12.8, pe: 18.5, pb: 1.8, sector: '汽车整车' },
    chip: { turnover: 6.5, volumeRatio: 2.2, return60d: -5.0, priceChange: 0.0 },
  },
]
