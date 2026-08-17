/**
 * @module collectConfig
 * @description 七维采集配置常量定义。
 *
 * 参考 V6 Pro collectConfig.ts 设计，适配 V9 架构：
 * - 10 个采集维度（七维 + 研报中心 + 财务数据 + 热门板块）
 * - 5 个策略模板（价值 / 成长 / 防御 / 周期 / 全维度）
 * - 频率枚举与中文标签映射
 * - 数据源类型与优先级
 * - 全局限流参数
 * - 字段注册表与默认策略
 *
 * @see V6 Pro: cockpit-app/src/data/collectConfig.ts
  * @doc [V9-DOC-DATA-047, V9-DOC-FRONT-020, V9-DOC-DATA-068]
*/

import type {
  UpdateFrequency,
  DataSourceType,
  StorageType,
  DimensionImportance,
  StrategyTemplateId,
  StrategyTemplate,
  DimensionConfig,
  FieldRegistry,
  RetryPolicy,
  TimeoutPolicy,
  FallbackPolicy,
} from '@/types/modules/collection.types'

// Re-export 类型，保持现有导入路径兼容
export type {
  UpdateFrequency,
  DataSourceType,
  StorageType,
  DimensionImportance,
  StrategyTemplateId,
  StrategyTemplate,
  DimensionConfig,
  FieldRegistry,
}

// ============================================================
// 频率枚举
// ============================================================

export const FREQUENCY_LABELS: Record<UpdateFrequency, string> = {
  realtime: '实时',
  '1h': '每小时',
  '3h': '每3小时',
  daily: '每日',
  '2d': '每2天',
  '3d': '每3天',
  weekly: '每周',
  '2w': '每2周',
  biweekly: '每两周',
  monthly: '每月',
  quarterly: '每季度',
  manual: '手动',
}

export const FREQUENCY_MINUTES: Record<UpdateFrequency, number> = {
  realtime: 5,
  '1h': 60,
  '3h': 180,
  daily: 1440,
  '2d': 2880,
  '3d': 4320,
  weekly: 10080,
  '2w': 20160,
  biweekly: 20160,
  monthly: 43200,
  quarterly: 129600,
  manual: 0,
}

// ============================================================
// 数据源类型
// ============================================================

export const DATA_SOURCE_LABELS: Record<DataSourceType, string> = {
  mcp: 'MCP/iFinD',
  akshare: 'AKShare',
  ifind: 'iFinD',
  tushare: 'Tushare',
  yahoo: 'Yahoo',
  tianyancha: '天眼查',
  scholar: '学术',
  cache: '缓存',
}

// ============================================================
// 存储策略
// ============================================================

export const STORAGE_TYPE_LABELS: Record<StorageType, string> = {
  full: '全量存储',
  lightweight: '轻量索引',
}

// ============================================================
// 重要性等级
// ============================================================

export const IMPORTANCE_LABELS: Record<DimensionImportance, string> = {
  critical: '核心',
  high: '高',
  medium: '中',
  low: '低',
}

// ============================================================
// 策略模板
// ============================================================

export const STRATEGY_TEMPLATES: StrategyTemplate[] = [
  {
    id: 'value',
    name: '价值投资',
    description: '低频复盘，聚焦基本面与筹码',
    dimensions: ['01', '02', '03', '14'],
    updateInterval: '2d',
    historyDays: 252,
    sources: ['akshare', 'mcp'],
  },
  {
    id: 'growth',
    name: '成长投资',
    description: '中频复盘，关注行业趋势与新闻',
    dimensions: ['01', '02', '05', '06', '14'],
    updateInterval: '2d',
    historyDays: 126,
    sources: ['akshare', 'mcp'],
  },
  {
    id: 'defense',
    name: '防御配置',
    description: '低频广覆盖，侧重关联指数与长期数据',
    dimensions: ['01', '02', '07', '13'],
    updateInterval: '2w',
    historyDays: 504,
    sources: ['akshare', 'mcp'],
  },
  {
    id: 'cycle',
    name: '周期轮动',
    description: '中频复盘，跟踪行业排名与资金流向',
    dimensions: ['01', '02', '05', '06', '07', '10', '12'],
    updateInterval: '2d',
    historyDays: 252,
    sources: ['akshare'],
  },
  {
    id: 'full',
    name: '全维度',
    description: '全量复盘采集，AKShare免费 + iFinD专业 + KIMI AI增强',
    dimensions: ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16'],
    updateInterval: '2d',
    historyDays: 756,
    sources: ['akshare', 'mcp'],
  },
]

// ============================================================
// 采集维度默认配置
// ============================================================

export const DEFAULT_DIMENSIONS: DimensionConfig[] = [
  // ===== AKShare 免费源 (8 维度) — 复盘频率 =====
  {
    code: '01',
    name: '基本信息',
    enabled: true,
    frequency: 'monthly',
    batchSize: 50,
    sources: ['akshare'],
    cacheTtl: 43200,
    storageType: 'full',
    fields: ['name', 'industry', 'marketCap', 'pe', 'pb', 'roe'],
    importance: 'low',
  },
  {
    code: '02',
    name: 'K线数据',
    enabled: true,
    frequency: '2d',
    batchSize: 100,
    sources: ['akshare'],
    cacheTtl: 2880,
    storageType: 'full',
    fields: ['open', 'close', 'high', 'low', 'volume', 'amount', 'ma5', 'ma20', 'ma60'],
    importance: 'critical',
  },
  {
    code: '03',
    name: '筹码分布',
    enabled: true,
    frequency: 'weekly',
    batchSize: 50,
    sources: ['akshare'],
    cacheTtl: 10080,
    storageType: 'full',
    fields: ['chipDistribution', 'holderCount', 'costDistribution'],
    importance: 'high',
  },
  {
    code: '06',
    name: '行业竞品',
    enabled: true,
    frequency: '2w',
    batchSize: 20,
    sources: ['akshare'],
    cacheTtl: 20160,
    storageType: 'lightweight',
    fields: ['industryRank', 'competitors', 'marketShare'],
    importance: 'medium',
  },
  {
    code: '07',
    name: '关联指数',
    enabled: true,
    frequency: '2w',
    batchSize: 30,
    sources: ['akshare'],
    cacheTtl: 20160,
    storageType: 'lightweight',
    fields: ['indexCode', 'etfCode', 'correlation', 'fundFlow'],
    importance: 'low',
  },
  {
    code: '10',
    name: '热门板块',
    enabled: true,
    frequency: '2d',
    batchSize: 20,
    sources: ['akshare'],
    cacheTtl: 2880,
    storageType: 'full',
    fields: ['sectorCode', 'sectorName', 'score', 'signal', 'alertLevel', 'f1Jingqi', 'f2Zijin', 'f3Guzhi', 'f5Nengliang', 'total'],
    importance: 'high',
  },
  {
    code: '11',
    name: '技术指标',
    enabled: true,
    frequency: '2d',
    batchSize: 50,
    sources: ['akshare'],
    cacheTtl: 2880,
    storageType: 'full',
    fields: ['macd', 'kdj', 'rsi', 'boll', 'ma5', 'ma10', 'ma20', 'ma60', 'volumeRatio'],
    importance: 'high',
  },
  {
    code: '12',
    name: '资金流向',
    enabled: true,
    frequency: '2d',
    batchSize: 30,
    sources: ['akshare'],
    cacheTtl: 2880,
    storageType: 'full',
    fields: ['mainNetInflow', 'superLargeNetInflow', 'largeNetInflow', 'mediumNetInflow', 'smallNetInflow', 'mainInflowRatio', 'turnoverRate'],
    importance: 'high',
  },
  // ===== iFinD MCP 专业源 (5 维度) — 复盘频率 =====
  {
    code: '04',
    name: '重大事项',
    enabled: true,
    frequency: '2d',
    batchSize: 30,
    sources: ['mcp'],
    cacheTtl: 2880,
    storageType: 'lightweight',
    fields: ['announcements', 'notices', 'reports'],
    importance: 'high',
  },
  {
    code: '08',
    name: '研报中心',
    enabled: true,
    frequency: '2d',
    batchSize: 20,
    sources: ['mcp'],
    cacheTtl: 2880,
    storageType: 'lightweight',
    fields: ['reportTitle', 'rating', 'targetPrice', 'analyst', 'summary'],
    importance: 'critical',
  },
  {
    code: '09',
    name: '财务数据',
    enabled: true,
    frequency: 'quarterly',
    batchSize: 20,
    sources: ['mcp'],
    cacheTtl: 43200,
    storageType: 'full',
    fields: ['revenue', 'netProfit', 'grossMargin', 'netMargin', 'operatingCF', 'rdRatio', 'reportDate', 'eps', 'bps', 'roe'],
    importance: 'critical',
  },
  {
    code: '13',
    name: '机构持仓',
    enabled: true,
    frequency: '2w',
    batchSize: 30,
    sources: ['mcp'],
    cacheTtl: 20160,
    storageType: 'full',
    fields: ['fundHolding', 'northBoundHolding', 'socialSecurityHolding', 'insuranceHolding', 'qfiiHolding', 'institutionalRatio', 'holdingChange', 'top10Shareholders'],
    importance: 'high',
  },
  {
    code: '14',
    name: '估值分析',
    enabled: true,
    frequency: '2w',
    batchSize: 20,
    sources: ['mcp'],
    cacheTtl: 20160,
    storageType: 'full',
    fields: ['dcfValue', 'peBand', 'pbBand', 'peg', 'evEbitda', 'dividendYield', 'fairValueRange', 'marginOfSafety'],
    importance: 'critical',
  },
  // ===== KIMI AI 增强 (1 维度) — 复盘频率 =====
  {
    code: '05',
    name: '热点新闻',
    enabled: true,
    frequency: '2d',
    batchSize: 50,
    sources: ['mcp'],
    cacheTtl: 1440,
    storageType: 'lightweight',
    fields: ['title', 'summary', 'source', 'url', 'publishedAt', 'sentiment', 'relevance'],
    importance: 'medium',
  },
  // ===== P0 新增维度 (2 维度) =====
  {
    code: '15',
    name: '分红股本',
    enabled: true,
    frequency: 'weekly',
    batchSize: 30,
    sources: ['tushare', 'ifind'],
    cacheTtl: 10080,
    storageType: 'full',
    fields: ['dividendYield', 'totalDividend3Y', 'payoutRatio3Y', 'dividendHistory', 'totalShares', 'floatShares', 'nextUnlockDate', 'nextUnlockShares', 'hasBuybackPlan', 'hasRightsIssue'],
    importance: 'high',
  },
  {
    code: '16',
    name: '一致预期',
    enabled: true,
    frequency: 'weekly',
    batchSize: 20,
    sources: ['ifind'],
    cacheTtl: 10080,
    storageType: 'full',
    fields: ['revenueEstimate', 'netProfitEstimate', 'epsEstimate', 'analystCount', 'consensusRating', 'consensusTargetPrice', 'targetPriceHigh', 'targetPriceLow', 'ratingTrend', 'ratingDistribution'],
    importance: 'critical',
  },
]

/** 采集维度总数（从 DEFAULT_DIMENSIONS 自动派生，禁止硬编码） */
export const DIMENSION_COUNT = DEFAULT_DIMENSIONS.length

/** 全部维度 code 列表（从 DEFAULT_DIMENSIONS 自动派生） */
export const ALL_DIMENSION_CODES = DEFAULT_DIMENSIONS.map((d) => d.code)

// ============================================================
// 维度颜色映射（用于 UI 标识）
// ============================================================

export const DIMENSION_COLORS: Record<string, string> = {
  '01': 'bg-blue-500',
  '02': 'bg-green-500',
  '03': 'bg-purple-500',
  '04': 'bg-orange-500',
  '05': 'bg-cyan-500',
  '06': 'bg-pink-500',
  '07': 'bg-indigo-500',
  '08': 'bg-red-500',
  '09': 'bg-teal-500',
  '10': 'bg-amber-500',
  '11': 'bg-lime-500',
  '12': 'bg-rose-500',
  '13': 'bg-violet-500',
  '14': 'bg-emerald-500',
  '15': 'bg-yellow-500',
  '16': 'bg-sky-500',
}

export const IMPORTANCE_BADGE_VARIANT: Record<DimensionImportance, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  critical: 'destructive',
  high: 'default',
  medium: 'secondary',
  low: 'outline',
}

// ============================================================
// 字段注册表
// ============================================================

export const FIELD_REGISTRY: FieldRegistry = {
  '01': [
    { id: 'name', name: '名称', description: '股票名称', dimensions: ['01'] },
    { id: 'industry', name: '行业', description: '所属行业', dimensions: ['01'] },
    { id: 'marketCap', name: '市值', description: '总市值', dimensions: ['01'] },
    { id: 'pe', name: 'PE', description: '市盈率', dimensions: ['01'] },
    { id: 'pb', name: 'PB', description: '市净率', dimensions: ['01'] },
    { id: 'roe', name: 'ROE', description: '净资产收益率', dimensions: ['01'] },
  ],
  '02': [
    { id: 'open', name: '开盘价', description: '日线开盘价', dimensions: ['02'] },
    { id: 'close', name: '收盘价', description: '日线收盘价', dimensions: ['02'] },
    { id: 'high', name: '最高价', description: '日线最高价', dimensions: ['02'] },
    { id: 'low', name: '最低价', description: '日线最低价', dimensions: ['02'] },
    { id: 'volume', name: '成交量', description: '日线成交量', dimensions: ['02'] },
    { id: 'amount', name: '成交额', description: '日线成交额', dimensions: ['02'] },
    { id: 'ma5', name: 'MA5', description: '5 日均线', dimensions: ['02'] },
    { id: 'ma20', name: 'MA20', description: '20 日均线', dimensions: ['02'] },
    { id: 'ma60', name: 'MA60', description: '60 日均线', dimensions: ['02'] },
  ],
  '03': [
    { id: 'chipDistribution', name: '筹码分布', description: '筹码分布数据', dimensions: ['03'] },
    { id: 'holderCount', name: '股东户数', description: '股东户数', dimensions: ['03'] },
    { id: 'costDistribution', name: '成本分布', description: '成本分布', dimensions: ['03'] },
  ],
  '04': [
    { id: 'announcements', name: '公告', description: '公司公告', dimensions: ['04'] },
    { id: 'notices', name: '通知', description: '交易所通知', dimensions: ['04'] },
    { id: 'reports', name: '报告', description: '定期报告', dimensions: ['04'] },
  ],
  '05': [
    { id: 'title', name: '标题', description: '新闻标题', dimensions: ['05'] },
    { id: 'summary', name: '摘要', description: '新闻摘要', dimensions: ['05'] },
    { id: 'source', name: '来源', description: '新闻来源', dimensions: ['05'] },
    { id: 'url', name: '链接', description: '原文链接', dimensions: ['05'] },
    { id: 'publishedAt', name: '发布时间', description: '新闻发布时间', dimensions: ['05'] },
  ],
  '06': [
    { id: 'industryRank', name: '行业排名', description: '行业内排名', dimensions: ['06'] },
    { id: 'competitors', name: '竞品', description: '主要竞争对手', dimensions: ['06'] },
    { id: 'marketShare', name: '市场份额', description: '市场份额', dimensions: ['06'] },
  ],
  '07': [
    { id: 'indexCode', name: '指数代码', description: '关联指数代码', dimensions: ['07'] },
    { id: 'etfCode', name: 'ETF 代码', description: '关联 ETF 代码', dimensions: ['07'] },
    { id: 'correlation', name: '相关性', description: '与指数相关性', dimensions: ['07'] },
    { id: 'fundFlow', name: '资金流向', description: '板块资金流向', dimensions: ['07'] },
  ],
  '08': [
    { id: 'reportTitle', name: '研报标题', description: '研报标题', dimensions: ['08'] },
    { id: 'rating', name: '评级', description: '机构评级', dimensions: ['08'] },
    { id: 'targetPrice', name: '目标价', description: '目标价', dimensions: ['08'] },
    { id: 'analyst', name: '分析师', description: '分析师', dimensions: ['08'] },
    { id: 'summary', name: '摘要', description: '研报摘要', dimensions: ['08'] },
  ],
  '10': [
    { id: 'sectorCode', name: '板块代码', description: '申万二级板块代码', dimensions: ['10'] },
    { id: 'sectorName', name: '板块名称', description: '申万二级板块名称', dimensions: ['10'] },
    { id: 'score', name: '综合评分', description: '板块轮动综合评分(0-5)', dimensions: ['10'] },
    { id: 'signal', name: '信号', description: '板块轮动信号(强势上攻/震荡上行/观望/弱势)', dimensions: ['10'] },
    { id: 'alertLevel', name: '预警等级', description: '预警等级(正常/关注/预警)', dimensions: ['10'] },
    { id: 'f1Jingqi', name: '景气因子', description: '近5日涨幅(0-100)', dimensions: ['10'] },
    { id: 'f2Zijin', name: '资金因子', description: '近5日均成交额/前20日均成交额(0-100)', dimensions: ['10'] },
    { id: 'f3Guzhi', name: '估值因子', description: 'PE分位反向(0-100)', dimensions: ['10'] },
    { id: 'f5Nengliang', name: '量能因子', description: '近5日均成交量/前20日均成交量(0-100)', dimensions: ['10'] },
    { id: 'total', name: '综合得分', description: '五因子加权综合得分(0-100)', dimensions: ['10'] },
  ],
  '11': [
    { id: 'macd', name: 'MACD', description: 'MACD指标(DIF/DEA/柱)', dimensions: ['11'] },
    { id: 'kdj', name: 'KDJ', description: 'KDJ指标(K/D/J)', dimensions: ['11'] },
    { id: 'rsi', name: 'RSI', description: '相对强弱指标(6/12/24)', dimensions: ['11'] },
    { id: 'boll', name: 'BOLL', description: '布林带(上轨/中轨/下轨)', dimensions: ['11'] },
    { id: 'ma5', name: 'MA5', description: '5日均线', dimensions: ['11'] },
    { id: 'ma10', name: 'MA10', description: '10日均线', dimensions: ['11'] },
    { id: 'ma20', name: 'MA20', description: '20日均线', dimensions: ['11'] },
    { id: 'ma60', name: 'MA60', description: '60日均线', dimensions: ['11'] },
    { id: 'volumeRatio', name: '量比', description: '当日成交量/5日均量', dimensions: ['11'] },
  ],
  '12': [
    { id: 'mainNetInflow', name: '主力净流入', description: '主力资金净流入(万元)', dimensions: ['12'] },
    { id: 'superLargeNetInflow', name: '超大单净流入', description: '超大单净流入(万元)', dimensions: ['12'] },
    { id: 'largeNetInflow', name: '大单净流入', description: '大单净流入(万元)', dimensions: ['12'] },
    { id: 'mediumNetInflow', name: '中单净流入', description: '中单净流入(万元)', dimensions: ['12'] },
    { id: 'smallNetInflow', name: '小单净流入', description: '小单净流入(万元)', dimensions: ['12'] },
    { id: 'mainInflowRatio', name: '主力流入比', description: '主力净流入/成交额(%)', dimensions: ['12'] },
    { id: 'turnoverRate', name: '换手率', description: '当日换手率(%)', dimensions: ['12'] },
  ],
  '13': [
    { id: 'fundHolding', name: '基金持仓', description: '基金持仓比例(%)', dimensions: ['13'] },
    { id: 'northBoundHolding', name: '北向持仓', description: '北向资金持仓比例(%)', dimensions: ['13'] },
    { id: 'socialSecurityHolding', name: '社保持仓', description: '社保基金持仓比例(%)', dimensions: ['13'] },
    { id: 'insuranceHolding', name: '保险持仓', description: '保险资金持仓比例(%)', dimensions: ['13'] },
    { id: 'qfiiHolding', name: 'QFII持仓', description: 'QFII持仓比例(%)', dimensions: ['13'] },
    { id: 'institutionalRatio', name: '机构占比', description: '机构持股占总股本比例(%)', dimensions: ['13'] },
    { id: 'holdingChange', name: '持仓变化', description: '机构持仓环比变化(%)', dimensions: ['13'] },
    { id: 'top10Shareholders', name: '前十大股东', description: '前十大股东持股明细', dimensions: ['13'] },
  ],
  '14': [
    { id: 'dcfValue', name: 'DCF估值', description: '自由现金流折现估值(元)', dimensions: ['14'] },
    { id: 'peBand', name: 'PE Band', description: '历史PE估值区间', dimensions: ['14'] },
    { id: 'pbBand', name: 'PB Band', description: '历史PB估值区间', dimensions: ['14'] },
    { id: 'peg', name: 'PEG', description: '市盈率/盈利增长率', dimensions: ['14'] },
    { id: 'evEbitda', name: 'EV/EBITDA', description: '企业价值/息税折旧摊销前利润', dimensions: ['14'] },
    { id: 'dividendYield', name: '股息率', description: '近12个月股息率(%)', dimensions: ['14'] },
    { id: 'fairValueRange', name: '合理估值区间', description: '综合估值合理区间(元)', dimensions: ['14'] },
    { id: 'marginOfSafety', name: '安全边际', description: '当前价格/合理估值的安全边际(%)', dimensions: ['14'] },
  ],
  '15': [
    { id: 'dividendYield', name: '股息率', description: '近12个月股息率(%)', dimensions: ['15'] },
    { id: 'totalDividend3Y', name: '3年累计分红', description: '近3年累计分红金额(亿元)', dimensions: ['15'] },
    { id: 'payoutRatio3Y', name: '3年分红率', description: '近3年平均分红率(%)', dimensions: ['15'] },
    { id: 'dividendHistory', name: '分红记录', description: '历史分红明细', dimensions: ['15'] },
    { id: 'totalShares', name: '总股本', description: '总股本(亿股)', dimensions: ['15'] },
    { id: 'floatShares', name: '流通股本', description: '流通股本(亿股)', dimensions: ['15'] },
    { id: 'nextUnlockDate', name: '解禁日期', description: '下一批限售股解禁日期', dimensions: ['15'] },
    { id: 'nextUnlockShares', name: '解禁数量', description: '下一批解禁数量(亿股)', dimensions: ['15'] },
    { id: 'hasBuybackPlan', name: '回购计划', description: '是否有回购计划', dimensions: ['15'] },
    { id: 'hasRightsIssue', name: '增发计划', description: '是否有增发计划', dimensions: ['15'] },
  ],
  '16': [
    { id: 'revenueEstimate', name: '营收预测', description: '一致预期营收(亿元)', dimensions: ['16'] },
    { id: 'netProfitEstimate', name: '净利预测', description: '一致预期净利润(亿元)', dimensions: ['16'] },
    { id: 'epsEstimate', name: 'EPS预测', description: '一致预期每股收益(元)', dimensions: ['16'] },
    { id: 'analystCount', name: '分析师数', description: '覆盖分析师数量', dimensions: ['16'] },
    { id: 'consensusRating', name: '综合评级', description: '综合评级(1=买入,5=卖出)', dimensions: ['16'] },
    { id: 'consensusTargetPrice', name: '综合目标价', description: '一致预期目标价(元)', dimensions: ['16'] },
    { id: 'targetPriceHigh', name: '目标价最高', description: '最高目标价(元)', dimensions: ['16'] },
    { id: 'targetPriceLow', name: '目标价最低', description: '最低目标价(元)', dimensions: ['16'] },
    { id: 'ratingTrend', name: '评级趋势', description: '最近评级变动趋势', dimensions: ['16'] },
    { id: 'ratingDistribution', name: '评级分布', description: '各评级数量分布', dimensions: ['16'] },
  ],
}

// ============================================================
// 默认策略
// ============================================================

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 2,
  backoffMultiplier: 2,
  initialDelayMs: 500,
}

export const DEFAULT_TIMEOUT_POLICY: TimeoutPolicy = {
  requestTimeoutMs: 5000,
  dimensionTimeoutMs: 30000,
}

export const DEFAULT_FALLBACK_POLICY: FallbackPolicy = {
  allowFallback: true,
  // 生产环境禁止 Mock 数据回退，避免 API 失败时静默切换到假数据
  allowMockFallback: !import.meta.env.PROD,
  alertFailureRate: 80,
}

// ============================================================
// 全局限流参数
// ============================================================

export const GLOBAL_LIMITS = {
  /** 最大标的数 */
  maxSymbols: 500,
  /** 默认批量大小 */
  defaultBatchSize: 50,
  /** 每分钟限流 */
  rateLimitPerMinute: 10,
  /** 每小时限流 */
  rateLimitPerHour: 200,
  /** 每天限流 */
  rateLimitPerDay: 2000,
  /** L1 缓存 TTL（秒） */
  l1CacheTtl: 300,
} as const

// ============================================================
// 额度预估计算
// ============================================================

/**
 * 计算单维度月调用次数
 * @param dimension 维度配置
 * @param symbolCount 标的数
 * @returns 月调用次数
 */
export function estimateMonthlyCalls(dimension: DimensionConfig, symbolCount: number): number {
  if (!dimension.enabled || dimension.frequency === 'manual') return 0
  const minutesPerMonth = 43200
  const intervalMinutes = FREQUENCY_MINUTES[dimension.frequency]
  if (intervalMinutes === 0) return 0
  const callsPerSymbolPerMonth = Math.ceil(minutesPerMonth / intervalMinutes)
  return callsPerSymbolPerMonth * Math.ceil(symbolCount / dimension.batchSize)
}

/**
 * 计算全部启用维度的月调用总量
 */
export function estimateTotalMonthlyCalls(dimensions: DimensionConfig[], symbolCount: number): number {
  return dimensions.reduce((total, dim) => total + estimateMonthlyCalls(dim, symbolCount), 0)
}

// ============================================================
// 数据源连通性测试端点（配置层，供 ApiTestDialog 消费）
// ============================================================

export interface TestApiEndpoint {
  id: string
  name: string
  testApi: string
}

export const TEST_API_ENDPOINTS: TestApiEndpoint[] = [
  { id: 'mcp', name: 'MCP/iFinD', testApi: '/api/test/mcp' },
  { id: 'akshare', name: 'AKShare', testApi: '/api/test/akshare' },
  { id: 'ifind', name: 'iFinD', testApi: '/api/test/ifind' },
  { id: 'yahoo', name: 'Yahoo', testApi: '/api/test/yahoo' },
  { id: 'tianyancha', name: '天眼查', testApi: '/api/test/tianyancha' },
  { id: 'scholar', name: '学术', testApi: '/api/test/scholar' },
]

// ============================================================
// 维度接口映射（配置层，供 CollectionPlanPanel 消费）
// ============================================================

export interface DimensionApiMapping {
  code: string
  name: string
  api: string
  method: string
  cache: string
}

export const DIMENSION_API_MAPPING: DimensionApiMapping[] = [
  { code: '01', name: '基本信息', api: '/api/stock/basic', method: 'GET', cache: '43200s' },
  { code: '02', name: 'K线数据', api: '/api/stock/kline', method: 'GET', cache: '1440s' },
  { code: '03', name: '筹码分布', api: '/api/stock/chip', method: 'GET', cache: '4320s' },
  { code: '04', name: '重大事项', api: '/api/stock/news', method: 'GET', cache: '1440s' },
  { code: '05', name: '热点新闻', api: '/api/news/hot', method: 'GET', cache: '720s' },
  { code: '06', name: '行业竞品', api: '/api/industry/competitors', method: 'GET', cache: '10080s' },
  { code: '07', name: '关联指数', api: '/api/index/correlation', method: 'GET', cache: '10080s' },
  { code: '08', name: '研报中心', api: '/api/research/reports', method: 'GET', cache: '1440s' },
  { code: '09', name: '财务数据', api: '/api/stock/financial', method: 'GET', cache: '43200s' },
  { code: '10', name: '热门板块', api: '/api/strategy/hot-sectors', method: 'GET', cache: '1440s' },
  { code: '11', name: '技术指标', api: '/api/stock/technical', method: 'GET', cache: '1440s' },
  { code: '12', name: '资金流向', api: '/api/stock/fundflow', method: 'GET', cache: '1440s' },
  { code: '13', name: '机构持仓', api: '/api/stock/holdings', method: 'GET', cache: '10080s' },
  { code: '14', name: '估值分析', api: '/api/stock/valuation', method: 'GET', cache: '10080s' },
  { code: '15', name: '分红股本', api: '/api/stock/dividend-share', method: 'GET', cache: '10080s' },
  { code: '16', name: '一致预期', api: '/api/stock/consensus', method: 'GET', cache: '10080s' },
]
