/**
 * @fileoverview 评分文档域类型（L1 评分文档业务域）
 *
 * V6 Pro 迁移：评分文档版本库 + 策略快照与版本管理
 *
 * @module data/types/types.scoreDoc
 * @updated 2026-07-07 - PR-1：从 data/types.ts 拆分
/** V6 评分单维度  * @doc [V9-DOC-BACK-012, V9-DOC-BACK-008, V9-DOC-BACK-005, V9-DOC-BACK-010, V9-DOC-PROJ-003]
*/
export interface V6LayerScore {
  score: number
  reason: string
  weight: number
}

/**
 * 单只股票的一次评分文档版本
 *
 * V6 评分引擎为每只股票生成评分文档，每次重新评分会创建新版本。
 * 历史版本保留用于对比分析（changeFromPrev 字段记录与前一版本的差异）。
 *
 * @example
 * ```typescript
 * const doc: ScoreDocVersion = {
 *   docId: '600519_1_1698765432000',
 *   symbol: '600519',
 *   stockName: '贵州茅台',
 *   version: 1,
 *   scoreDate: '2024-10-31',
 *   composite: 85.6,
 *   l3v: 82.3,
 *   layers: { L0: { score: 90, reason: '...', weight: 0.2 } },
 *   recommendation: { key: 'buy', label: '买入', color: '#ef4444' },
 *   targetPrice: { bull: 1900, base: 1800, bear: 1700 },
 *   keyRisks: ['行业竞争加剧'],
 *   keyCatalysts: ['新品发布'],
 *   reportMd: '# 贵州茅台评分报告\n...',
 *   modelUsed: 'gpt-4',
 *   market: 'A股',
 *   createdAt: '2024-10-31T10:00:00Z'
 * }
 * ```
 *
 * @see src/data/dataLayerScoreStores.ts - 数据层存储与查询
 * @see src/services/analysis/scoreDocService.ts - 评分文档服务
 * @see src/store/scoreDocStore.ts - Zustand 状态管理
 */
export interface ScoreDocVersion {
  /** 文档唯一 ID，格式：{symbol}__{version}__{timestamp} */
  docId: string
  /** 股票代码 */
  symbol: string
  /** 股票名称 */
  stockName: string
  /** 版本号，同一股票的评分文档从 1 递增 */
  version: number
  /** 评分日期（YYYY-MM-DD 格式） */
  scoreDate: string
  /** V6 综合评分（0-100） */
  composite: number
  /** L3v 层评分（0-100），V6 引擎的估值安全边际层 */
  l3v: number
  /** 各层评分明细（layerId → V6LayerScore） */
  layers: Record<string, V6LayerScore>
  /** 投资建议（含 key/label/color） */
  recommendation: { key: string; label: string; color: string }
  /** 目标价（bull=乐观/base=中性/bear=悲观） */
  targetPrice: { bull: number; base: number; bear: number }
  /** 关键风险列表 */
  keyRisks: string[]
  /** 关键催化剂列表 */
  keyCatalysts: string[]
  /** 评分报告 Markdown 内容 */
  reportMd: string
  /** 使用的 LLM 模型名称 */
  modelUsed: string
  /** 市场分类（如 'A股'） */
  market: string
  /** 行业分类（可选） */
  industry?: string
  /** 与前一版本的差异对比（仅 version > 1 时存在） */
  changeFromPrev?: {
    /** 综合评分变化量 */
    compositeDelta: number
    /** L3v 评分变化量 */
    l3vDelta: number
    /** 各层评分变化（layerId → 变化值） */
    layerChanges: Record<string, number>
  }
  /** 创建时间（ISO 8601 格式） */
  createdAt: string
}

/**
 * 评分文档库统计信息
 *
 * 用于展示评分文档库的整体概况，包括文档总数、覆盖股票数、
 * 平均评分等聚合指标。由 scoreDocService 定期计算并缓存。
 *
 * @see src/services/analysis/scoreDocService.ts - 计算 logic
 */
export interface FileLibraryStats {
  /** 评分文档总数（含所有版本） */
  totalDocs: number
  /** 覆盖的独立股票数量 */
  totalStocks: number
  /** 所有股票的版本总数 */
  totalVersions: number
  /** 所有最新版本的平均综合评分 */
  avgComposite: number
  /** 核心股票池数量（composite >= 80） */
  coreStocks: number
  /** 最后更新时间（ISO 8601 格式） */
  lastUpdate: string
}

/**
 * 策略分组快照
 *
 * 策略快照（StrategySnapshot）中的一个分组统计，包含该分组下的
 * 股票列表、平均评分、最高评分等信息。用于核心/热门/价值三个策略分组。
 */
export interface StrategyGroupSnapshot {
  /** 分组内股票数量 */
  count: number
  /** 分组内平均综合评分 */
  avgComposite: number
  /** 分组内最高综合评分 */
  maxComposite: number
  /** 分组内股票代码列表 */
  symbols: string[]
  /** 分组内股票明细列表 */
  items: Array<{
    /** 股票代码 */
    symbol: string
    /** 股票名称 */
    name: string
    /** 综合评分 */
    composite: number
    /** 策略分类（如 'core' | 'hot' | 'value'） */
    classification: string
  }>
}

/**
 * 策略分组单项（策略快照内标的明细）
 *
 * 由 strategySnapshotService.classifyStocks 生成，用于策略导出、展示和回测。
 * 原 @/services/trading/strategySnapshotService.ts 定义，P1-12 迁移到 data/types
 * 以解除 domain/export 对 services 的类型依赖。
 */
export interface StrategyGroupItem {
  /** 股票代码 */
  symbol: string
  /** 股票名称 */
  name: string
  /** 综合评分 */
  composite: number
  /** L3b 估值水平评分 */
  l3v: number
  /** L1 护城河评分 */
  l1Score?: number
  /** L3a 财务健康评分 */
  l3fScore?: number
  /** L7 第二曲线评分 */
  l7Score?: number
  /** 板块共振系数 */
  resonance?: number
  /** 策略分类 */
  classification: 'core' | 'hot' | 'value'
  /** 入选原因列表 */
  reasons: string[]
}

/**
 * 策略快照
 *
 * 记录某一时间点的策略分组状态，包含核心/热门/价值三个分组的股票列表
 * 和评分信息。用于策略回测、历史对比和触发条件记录。
 *
 * @see src/services/analysis/scoreDocService.ts - 快照生成 logic
 */
export interface StrategySnapshot {
  /** 快照唯一 ID */
  id: string
  /** 快照版本号 */
  version: number
  /** 快照时间戳（毫秒） */
  timestamp: number
  /** 快照日期（YYYY-MM-DD） */
  date: string
  /** 快照时间（HH:mm:ss） */
  time: string
  /** 快照内股票总数 */
  stockCount: number
  /** 快照内评分文档总数 */
  scoreCount: number
  /** 轮动信号触发次数 */
  rotationCount: number
  /** 核心策略分组 */
  core: StrategyGroupSnapshot
  /** 热门策略分组 */
  hot: StrategyGroupSnapshot
  /** 价值策略分组 */
  value: StrategyGroupSnapshot
  /** 与前一快照的差异对比 */
  changeFromPrev?: {
    /** 总变化量 */
    totalChange: number
    /** 核心分组变化（added=新增/removed=移除） */
    coreChange: { added: string[]; removed: string[] }
    /** 热门分组变化 */
    hotChange: { added: string[]; removed: string[] }
    /** 价值分组变化 */
    valueChange: { added: string[]; removed: string[] }
    /** 评分变化明细 */
    scoreChanges?: Array<{
      /** 股票代码 */
      symbol: string
      /** 股票名称 */
      name: string
      /** 旧综合评分 */
      oldComposite: number
      /** 新综合评分 */
      newComposite: number
      /** 评分变化量 */
      delta: number
    }>
  }
  /** 触发快照生成的原因（如 'manual' | 'scheduled' | 'rotation_signal'） */
  trigger: string
}
