/**
 * @fileoverview V9 统一数据字典（Single Source of Truth）
 *
 * 集中定义所有 IndexedDB ObjectStore 的完整字段、类型、约束与关系。
 * 解决 P0-1：字段定义分散、缺乏统一数据字典的问题。
 *
 * 设计原则：
 * - 每个 Store 一条记录，包含 keyPath、索引、字段定义、外键关系
 * - 类型引用均指向 src/types/ 中的权威类型定义
 * - 与 dbConfig.ts 的 STORE_NAME 枚举保持 1:1 对应
 * - 与 db-schema.ts 的 createSchema() 保持同步
 *
 * @doc [V9-DOC-DATA-001, V9-DOC-DATA-047]
 * @created 2026-08-17 — P0-1 修复
 *
 * ============================================================
 * P1 命名规范（2026-08-17 修复）
 * ============================================================
 *
 * 1. 时间字段命名规范（P1-R2）
 *    - createdAt / updatedAt：记录创建/更新时间（用于审计追踪）
 *    - 禁止使用裸 timestamp 作为字段名（语义模糊）
 *    - 业务时间字段使用动词过去分词 + At 格式：
 *      generatedAt, publishedAt, bookmarkedAt, detectedAt, startedAt,
 *      calculatedAt, analyzedAt, appliedAt, addedAt, reportDate
 *    - 索引命名统一使用 kebab-case：by-created-at, by-updated-at
 *
 * 2. id 字段类型规范（P1-R3）
 *    - 新 Store 统一使用 string 类型 id（nanoid 生成）
 *    - 禁止新增 autoIncrement: true（number 类型 id）
 *    - 现有 autoIncrement Store（intelligentScores, industryScores,
 *      researchLogs, executionLogs, missingReports）标记为 @deprecated-id
 *    - 特殊 keyPath（symbol, docId, reportId, traceId, runId, scheduleId）例外
 *
 * 3. version 字段语义（P1-R4）
 *    - scoreDocs.version：评分文档版本号（v1, v2, ...）
 *    - strategySnapshots.version：策略快照版本号（唯一索引）
 *    - schemaMigrations.version：DB Schema 迁移版本号
 *    - 各 Store 使用独立版本号，互不冲突
 *
 * 4. source 字段语义（P1-R5）
 *    - news.source：资讯来源 URL
 *    - profileItems.source：数据采集来源（akshare / ifind / tushare）
 *    - traceRecords.source：采集链路来源
 *    - 同名字段不同语义是合法的，需在字段描述中明确说明
 *
 * 5. 索引命名规范（P1-N1）
 *    - 统一使用 kebab-case：by-symbol, by-created-at, by-symbol-version
 *    - 格式：by-{field-name}（多字段用 - 连接）
 *    - 已修复 3 处 camelCase 违规（v34）：by-fileName→by-file-name,
 *      by-generatedAt→by-generated-at, by-createdAt→by-created-at
 *
 * 6. Store 命名规范（P1-N3）
 *    - 物理 Store 名：snake_case（如 daily_quotes）
 *    - JS 常量名：camelCase（如 dailyQuotes）
 *    - 索引名：kebab-case（如 by-symbol）
 *    - 通过 STORE_NAME 枚举统一映射，禁止跨层直接使用物理名
 *
 * ============================================================
 * P2 Store 合并方案（2026-08-17）
 * ============================================================
 *
 * 当前现状：50 个 Store（27 基线 + 23 增量），部分可合并以降低维护复杂度。
 *
 * 【合并候选 1】newsBookmarks → news（低风险）✅ 已完成 2026-08-17
 *   - newsBookmarks 仅存 { id, bookmarkedAt }，本质是 News 的收藏标记
 *   - 方案：News 类型新增 bookmarkedAt?: number 字段，删除 newsBookmarks Store
 *   - 影响范围：8 文件（config/dbSchema/dataLayer/dataLayerInternalStores/
 *     indexedDBProvider/storeChannels/dataDictionary）
 *   - 状态：@completed 已合并，newsBookmarks Store 已删除
 *
 * 【合并候选 2】workflowTriggers → workflowSchedules（中风险）
 *   - workflowTriggers 与 workflowSchedules 均为调度配置，字段高度重叠
 *   - 方案：WorkflowSchedule 新增 triggerType/triggerConfig 字段
 *   - 影响范围：13 文件（含 databridge/cascadeConfig/MCP server）
 *   - 状态：@deferred 待专项迁移 Sprint
 *
 * 【合并候选 3】executionLogs → executionPlans（中风险）
 *   - executionLogs 是 executionPlans 的执行日志子项
 *   - 方案：ExecutionPlan 新增 logs?: ExecutionLog[] 字段
 *   - 影响范围：16 文件（含 databridge/cascadeConfig/rolePermissionMapper/
 *     MCP server/mcpAuditLogger）
 *   - 状态：@deferred 待专项迁移 Sprint
 *
 * 【合并候选 4】scoreEvidence → scoreDocs（中风险）
 *   - scoreEvidence 是 scoreDocs 的评分证据附件
 *   - 方案：ScoreDoc 新增 evidence?: ScoreEvidence[] 字段
 *   - 影响范围：待评估
 *   - 状态：@deferred 待评估
 *
 * 【合并候选 5】collectionHistory → collectConfig（中风险）
 *   - collectionHistory 是 collectConfig 的采集历史记录
 *   - 方案：CollectConfig 新增 history?: CollectionRecord[] 字段
 *   - 影响范围：待评估
 *   - 状态：@deferred 待评估
 *
 * 【不推荐合并】
 *   - hotSectorScores + valuePitScores：keyPath 不同（date vs symbol）
 *   - rotationScores + sectorScores：keyPath 不同（id vs date）
 *   - 跨域合并：语义差异大，强行合并会引入冗余 type 字段
 *
 * 执行原则：
 *   1. 优先合并 1:1 附属关系（如 newsBookmarks 附属 news）
 *   2. 禁止合并 keyPath 不同的 Store
 *   3. 合并后需全量数据迁移 + 消费者更新 + 测试验证
 *   4. 每次合并独立提交，不可批量合并
 */

import { STORE_NAME } from '@/config/dbConfig'
import type { StoreName } from '@/config/dbConfig'

// ============================================================
// 字段定义
// ============================================================

/** 单个字段定义 */
export interface FieldDef {
  /** 字段名 */
  name: string
  /** TypeScript 类型 */
  type: string
  /** 是否必填 */
  required: boolean
  /** 字段描述 */
  description: string
  /** 示例值 */
  example?: string
  /** 默认值 */
  default?: string
  /** 是否为外键（引用其他 Store） */
  foreignKey?: {
    store: StoreName
    field: string
  }
}

/** 索引定义 */
export interface IndexDef {
  /** 索引名 */
  name: string
  /** 索引键路径 */
  keyPath: string | string[]
  /** 是否唯一 */
  unique: boolean
  /** 索引描述 */
  description: string
}

/** 单个 Store 的完整定义 */
export interface StoreDef {
  /** Store 物理名（对应 STORE_NAME 枚举值） */
  name: StoreName
  /** 主键路径 */
  keyPath: string | null
  /** 是否自增主键 */
  autoIncrement: boolean
  /** 引入版本 */
  introducedAt: string
  /** 所属功能域 */
  domain: string
  /** 描述 */
  description: string
  /** 字段列表 */
  fields: FieldDef[]
  /** 索引列表 */
  indexes: IndexDef[]
  /** 依赖的父 Store（本 Store 的外键指向） */
  dependsOn: Array<{
    store: StoreName
    field: string
    description: string
  }>
  /** 对应的 TypeScript 类型（src/types/ 中的导出类型） */
  tsType?: string
  /** 类型定义文件路径 */
  tsTypeFile?: string
}

// ============================================================
// 全量数据字典（50 个 Store）
// ============================================================

export const DATA_DICTIONARY: Record<StoreName, StoreDef> = {
  // ── 股票池域 ──
  [STORE_NAME.stocks]: {
    name: STORE_NAME.stocks,
    keyPath: 'symbol',
    autoIncrement: false,
    introducedAt: 'v1',
    domain: '股票池',
    description: '股票基础信息实体，系统最核心的基础数据',
    tsType: 'Stock',
    tsTypeFile: 'src/types/modules/pool.types.ts',
    fields: [
      { name: 'symbol', type: 'string', required: true, description: '股票代码（带市场后缀）', example: '600519.SH' },
      { name: 'name', type: 'string', required: true, description: '股票简称', example: '贵州茅台' },
      { name: 'price', type: 'number', required: false, description: '当前价格（元）', example: '1680.50' },
      { name: 'pe', type: 'number', required: false, description: '市盈率（TTM）', example: '28.5' },
      { name: 'pb', type: 'number', required: false, description: '市净率', example: '8.2' },
      { name: 'roe', type: 'number', required: false, description: '净资产收益率（%）', example: '24.3' },
      { name: 'marketCap', type: 'number', required: false, description: '总市值（亿元）', example: '21000' },
      { name: 'researchStatus', type: 'ResearchStatus', required: true, description: '研究状态', example: 'deepDive', default: 'candidate' },
      { name: 'source', type: 'DataSource', required: true, description: '数据来源', example: 'akshare', default: 'manual' },
      { name: 'dataVersion', type: 'number', required: true, description: '数据版本号（乐观锁）', default: '1' },
      { name: 'dataQuality', type: 'StockDataQuality', required: false, description: '数据质量标记' },
      { name: 'ingestedAt', type: 'number', required: false, description: '首次入库时间戳' },
      { name: 'updatedAt', type: 'number', required: false, description: '最后更新时间戳' },
      { name: 'industryCode', type: 'string', required: false, description: '行业代码（申万分类）', example: '801120' },
      { name: 'theme', type: 'string[]', required: false, description: '主题标签', example: '["AI算力","半导体"]' },
      { name: 'sector', type: 'string', required: false, description: '板块名称', example: '白酒' },
      { name: 'group', type: 'string', required: false, description: '股票池分组名称', example: '核心持仓', default: '默认分组' },
      { name: 'pool', type: 'PoolType', required: false, description: '股票池类型（v29 三分拆）', default: 'research' },
    ],
    indexes: [
      { name: 'by-status', keyPath: 'researchStatus', unique: false, description: '按研究状态筛选' },
      { name: 'by-group', keyPath: 'group', unique: false, description: '按分组筛选' },
      { name: 'by-pool', keyPath: 'pool', unique: false, description: '按股票池类型筛选' },
    ],
    dependsOn: [],
  },

  // ── 评分域 ──
  [STORE_NAME.v6Scores]: {
    name: STORE_NAME.v6Scores,
    keyPath: 'symbol',
    autoIncrement: false,
    introducedAt: 'v1',
    domain: '评分',
    description: 'V6 分层递进式评分结果（L1-L8 层）',
    tsType: 'V6Score',
    tsTypeFile: 'src/types/modules/score.types.ts',
    fields: [
      { name: 'symbol', type: 'string', required: true, description: '股票代码', example: '600519.SH', foreignKey: { store: STORE_NAME.stocks, field: 'symbol' } },
      { name: 'composite', type: 'number', required: false, description: '综合评分', example: '85.5' },
      { name: 'confidence', type: 'number', required: false, description: '置信度（0-1）', example: '0.92' },
      { name: 'calculatedAt', type: 'number', required: false, description: '计算时间戳' },
      { name: 'algorithmVersion', type: 'string', required: false, description: '算法版本', example: 'v9-auto' },
      { name: 'layers', type: 'Record<string, DimensionScore>', required: false, description: 'L1-L8 分层评分详情' },
    ],
    indexes: [],
    dependsOn: [
      { store: STORE_NAME.stocks, field: 'symbol', description: '1:1 评分↔股票' },
    ],
  },

  [STORE_NAME.intelligentScores]: {
    name: STORE_NAME.intelligentScores,
    keyPath: 'id',
    autoIncrement: true,
    introducedAt: 'v1',
    domain: '评分',
    description: 'LLM 智能评分历史记录（1:N）',
    tsType: 'IntelligentScore',
    tsTypeFile: 'src/types/modules/score.types.ts',
    fields: [
      { name: 'id', type: 'number', required: true, description: '自增主键' },
      { name: 'symbol', type: 'string', required: true, description: '股票代码', foreignKey: { store: STORE_NAME.stocks, field: 'symbol' } },
      { name: 'score', type: 'number', required: false, description: '智能评分', example: '82.3' },
      { name: 'model', type: 'string', required: false, description: '使用的 LLM 模型', example: 'gpt-4' },
      { name: 'calculatedAt', type: 'number', required: false, description: '评分时间戳' },
    ],
    indexes: [
      { name: 'by-symbol', keyPath: 'symbol', unique: false, description: '按股票代码查询评分历史' },
    ],
    dependsOn: [
      { store: STORE_NAME.stocks, field: 'symbol', description: '1:N 智能评分历史↔股票' },
    ],
  },

  [STORE_NAME.industryScores]: {
    name: STORE_NAME.industryScores,
    keyPath: 'id',
    autoIncrement: true,
    introducedAt: 'v1',
    domain: '评分',
    description: '行业评分记录',
    tsType: 'IndustryScore',
    tsTypeFile: 'src/types/modules/score.types.ts',
    fields: [
      { name: 'id', type: 'number', required: true, description: '自增主键' },
      { name: 'code', type: 'string', required: true, description: '行业代码', example: '801120' },
      { name: 'name', type: 'string', required: false, description: '行业名称', example: '食品饮料' },
      { name: 'composite', type: 'number', required: false, description: '行业综合评分' },
      { name: 'calculatedAt', type: 'number', required: false, description: '计算时间戳' },
    ],
    indexes: [
      { name: 'by-code', keyPath: 'code', unique: false, description: '按行业代码查询' },
    ],
    dependsOn: [],
  },

  [STORE_NAME.scoreDocs]: {
    name: STORE_NAME.scoreDocs,
    keyPath: 'docId',
    autoIncrement: false,
    introducedAt: 'v6',
    domain: '评分',
    description: '评分文档版本库',
    tsType: 'ScoreDocVersion',
    tsTypeFile: 'src/data/types/types.scoreDoc.ts',
    fields: [
      { name: 'docId', type: 'string', required: true, description: '文档唯一 ID' },
      { name: 'symbol', type: 'string', required: true, description: '股票代码', foreignKey: { store: STORE_NAME.stocks, field: 'symbol' } },
      { name: 'version', type: 'number', required: true, description: '评分文档版本号' },
      { name: 'composite', type: 'number', required: false, description: '综合评分' },
      { name: 'content', type: 'string', required: false, description: '评分报告内容（Markdown）' },
      { name: 'createdAt', type: 'number', required: false, description: '创建时间戳' },
    ],
    indexes: [
      { name: 'by-symbol', keyPath: 'symbol', unique: false, description: '按股票代码查询' },
      { name: 'by-symbol-version', keyPath: ['symbol', 'version'], unique: true, description: '股票+版本唯一' },
      { name: 'by-composite', keyPath: 'composite', unique: false, description: '按综合评分排序' },
    ],
    dependsOn: [
      { store: STORE_NAME.stocks, field: 'symbol', description: 'N:1 评分文档↔股票' },
    ],
  },

  [STORE_NAME.scoreEvidence]: {
    name: STORE_NAME.scoreEvidence,
    keyPath: 'id',
    autoIncrement: false,
    introducedAt: 'v32',
    domain: '评分',
    description: '评分证据链（ADR-010 八域资料体系）',
    tsType: 'ScoreEvidence',
    tsTypeFile: 'src/types/modules/score.types.ts',
    fields: [
      { name: 'id', type: 'string', required: true, description: '证据项唯一 ID' },
      { name: 'symbol', type: 'string', required: true, description: '股票代码', foreignKey: { store: STORE_NAME.stocks, field: 'symbol' } },
      { name: 'layer', type: 'string', required: true, description: '评分层级（L1-L8）' },
      { name: 'profileItemId', type: 'string', required: false, description: '关联资料条目 ID', foreignKey: { store: STORE_NAME.profileItems, field: 'id' } },
      { name: 'weight', type: 'number', required: false, description: '证据权重', example: '0.15' },
      { name: 'content', type: 'string', required: false, description: '证据内容' },
    ],
    indexes: [
      { name: 'by-symbol', keyPath: 'symbol', unique: false, description: '按股票代码查询' },
      { name: 'by-symbol-layer', keyPath: ['symbol', 'layer'], unique: false, description: '按股票+层级查询' },
      { name: 'by-profile-item', keyPath: 'profileItemId', unique: false, description: '按资料条目查询' },
      { name: 'by-weight', keyPath: 'weight', unique: false, description: '按权重排序' },
    ],
    dependsOn: [
      { store: STORE_NAME.stocks, field: 'symbol', description: 'N:1 证据↔股票' },
      { store: STORE_NAME.profileItems, field: 'profileItemId', description: 'N:1 证据↔资料条目' },
    ],
  },

  // ── 行情域 ──
  [STORE_NAME.dailyQuotes]: {
    name: STORE_NAME.dailyQuotes,
    keyPath: 'symbol',
    autoIncrement: false,
    introducedAt: 'v4',
    domain: '行情',
    description: '日线行情/K线数据',
    tsType: 'DailyQuotes',
    tsTypeFile: 'src/data/types/types.marketData.ts',
    fields: [
      { name: 'symbol', type: 'string', required: true, description: '股票代码', foreignKey: { store: STORE_NAME.stocks, field: 'symbol' } },
      { name: 'klineData', type: 'KlineBar[]', required: false, description: 'K线数据数组' },
      { name: 'updatedAt', type: 'number', required: false, description: '最后更新时间戳' },
    ],
    indexes: [],
    dependsOn: [
      { store: STORE_NAME.stocks, field: 'symbol', description: '1:1 行情↔股票' },
    ],
  },

  // ── 财务域 ──
  [STORE_NAME.financialReports]: {
    name: STORE_NAME.financialReports,
    keyPath: 'symbol',
    autoIncrement: false,
    introducedAt: 'v22',
    domain: '财务',
    description: '财务数据报告（利润表/资产负债表/现金流量表）',
    tsType: 'FinancialReport',
    tsTypeFile: 'src/data/types/types.stock.ts',
    fields: [
      { name: 'symbol', type: 'string', required: true, description: '股票代码', foreignKey: { store: STORE_NAME.stocks, field: 'symbol' } },
      { name: 'reportDate', type: 'string', required: false, description: '报告日期', example: '2025-12-31' },
      { name: 'updatedAt', type: 'number', required: false, description: '更新时间戳' },
      { name: 'incomeStatement', type: 'object', required: false, description: '利润表数据' },
      { name: 'balanceSheet', type: 'object', required: false, description: '资产负债表数据' },
      { name: 'cashFlow', type: 'object', required: false, description: '现金流量表数据' },
    ],
    indexes: [
      { name: 'by-symbol', keyPath: 'symbol', unique: true, description: '按股票代码查询（唯一）' },
      { name: 'by-report-date', keyPath: 'reportDate', unique: false, description: '按报告日期查询' },
      { name: 'by-updated-at', keyPath: 'updatedAt', unique: false, description: '按更新时间排序' },
    ],
    dependsOn: [
      { store: STORE_NAME.stocks, field: 'symbol', description: '1:1 财报↔股票' },
    ],
  },

  // ── 交易域 ──
  [STORE_NAME.orders]: {
    name: STORE_NAME.orders,
    keyPath: 'id',
    autoIncrement: false,
    introducedAt: 'v1',
    domain: '交易',
    description: '交易订单记录',
    tsType: 'Order',
    tsTypeFile: 'src/types/modules/trade.types.ts',
    fields: [
      { name: 'id', type: 'string', required: true, description: '订单唯一 ID' },
      { name: 'symbol', type: 'string', required: true, description: '股票代码', foreignKey: { store: STORE_NAME.stocks, field: 'symbol' } },
      { name: 'direction', type: 'OrderDirection', required: true, description: '交易方向（buy/sell）' },
      { name: 'quantity', type: 'number', required: true, description: '交易数量（股）' },
      { name: 'price', type: 'number', required: true, description: '成交价格（元）' },
      { name: 'amount', type: 'number', required: true, description: '成交金额（元）' },
      { name: 'status', type: 'OrderStatus', required: true, description: '订单状态', default: 'pending' },
      { name: 'accountType', type: 'AccountType', required: true, description: '账户类型', default: 'paper' },
      { name: 'createdAt', type: 'number', required: true, description: '创建时间戳' },
      { name: 'planStopLoss', type: 'number', required: false, description: '计划止损价' },
      { name: 'planTakeProfit', type: 'number', required: false, description: '计划止盈价' },
      { name: 'planPositionPct', type: 'number', required: false, description: '计划仓位占比（0-1）' },
      { name: 'planFollowed', type: 'boolean', required: false, description: '是否按计划执行' },
      { name: 'maxDrawdown', type: 'number', required: false, description: '最大回撤金额' },
      { name: 'maxFloatingProfit', type: 'number', required: false, description: '最大浮动盈利' },
      { name: 'profitCaptureRate', type: 'number', required: false, description: '盈利捕获率（0-1）' },
      { name: 'errors', type: 'string[]', required: false, description: '复盘错误列表' },
      { name: 'reviewNoteId', type: 'string', required: false, description: '关联复盘笔记 ID' },
    ],
    indexes: [],
    dependsOn: [
      { store: STORE_NAME.stocks, field: 'symbol', description: 'N:1 订单↔股票' },
    ],
  },

  [STORE_NAME.signals]: {
    name: STORE_NAME.signals,
    keyPath: 'id',
    autoIncrement: false,
    introducedAt: 'v1',
    domain: '交易',
    description: '交易信号',
    tsType: 'Signal',
    tsTypeFile: 'src/data/types/types.signal.ts',
    fields: [
      { name: 'id', type: 'string', required: true, description: '信号唯一 ID' },
      { name: 'symbol', type: 'string', required: true, description: '股票代码', foreignKey: { store: STORE_NAME.stocks, field: 'symbol' } },
      { name: 'type', type: 'string', required: true, description: '信号类型', example: 'buy' },
      { name: 'strength', type: 'number', required: false, description: '信号强度', example: '0.85' },
      { name: 'confidence', type: 'number', required: false, description: '置信度', example: '0.9' },
      { name: 'reason', type: 'string', required: false, description: '信号原因' },
      { name: 'createdAt', type: 'number', required: false, description: '创建时间戳' },
    ],
    indexes: [],
    dependsOn: [
      { store: STORE_NAME.stocks, field: 'symbol', description: 'N:1 信号↔股票' },
    ],
  },

  [STORE_NAME.tradeReviews]: {
    name: STORE_NAME.tradeReviews,
    keyPath: 'id',
    autoIncrement: false,
    introducedAt: 'v17',
    domain: '交易',
    description: '交易纪律复盘报告',
    tsType: 'ReviewReport',
    tsTypeFile: 'src/types/modules/tradeReview.types.ts',
    fields: [
      { name: 'id', type: 'string', required: true, description: '复盘报告 ID' },
      { name: 'generatedAt', type: 'number', required: false, description: '报告生成时间戳' },
      { name: 'disciplineScore', type: 'number', required: false, description: '纪律评分' },
      { name: 'errors', type: 'TradeErrorType[]', required: false, description: '错误分类列表' },
      { name: 'psychProfile', type: 'PsychProfile', required: false, description: '心理画像' },
      { name: 'actionPlan', type: 'ActionPlan', required: false, description: '改进计划' },
    ],
    indexes: [
      { name: 'by-generated-at', keyPath: 'generatedAt', unique: false, description: '按生成时间排序' },
    ],
    dependsOn: [],
  },

  // ── 执行域 ──
  [STORE_NAME.executionPlans]: {
    name: STORE_NAME.executionPlans,
    keyPath: 'id',
    autoIncrement: false,
    introducedAt: 'v16',
    domain: '执行',
    description: '交易执行计划',
    tsType: 'ExecutionPlan',
    tsTypeFile: 'src/data/types/types.execution.ts',
    fields: [
      { name: 'id', type: 'string', required: true, description: '执行计划 ID' },
      { name: 'signalId', type: 'string', required: false, description: '关联信号 ID', foreignKey: { store: STORE_NAME.signals, field: 'id' } },
      { name: 'symbol', type: 'string', required: true, description: '股票代码', foreignKey: { store: STORE_NAME.stocks, field: 'symbol' } },
      { name: 'phase', type: 'ExecutionPhase', required: true, description: '执行阶段' },
      { name: 'createdAt', type: 'number', required: false, description: '创建时间戳' },
      { name: 'riskChecks', type: 'RiskCheckItem[]', required: false, description: '风险检查项' },
    ],
    indexes: [
      { name: 'by-signal', keyPath: 'signalId', unique: false, description: '按信号 ID 查询' },
      { name: 'by-symbol', keyPath: 'symbol', unique: false, description: '按股票代码查询' },
      { name: 'by-phase', keyPath: 'phase', unique: false, description: '按执行阶段查询' },
      { name: 'by-created-at', keyPath: 'createdAt', unique: false, description: '按创建时间排序' },
    ],
    dependsOn: [
      { store: STORE_NAME.stocks, field: 'symbol', description: 'N:1 执行计划↔股票' },
      { store: STORE_NAME.signals, field: 'signalId', description: 'N:1 执行计划↔信号' },
    ],
  },

  [STORE_NAME.executionLogs]: {
    name: STORE_NAME.executionLogs,
    keyPath: 'id',
    autoIncrement: true,
    introducedAt: 'v15',
    domain: '执行',
    description: '执行日志（append-only）',
    tsType: 'ExecutionLog',
    tsTypeFile: 'src/data/types/types.execution.ts',
    fields: [
      { name: 'id', type: 'number', required: true, description: '自增主键' },
      { name: 'planId', type: 'string', required: false, description: '关联执行计划 ID', foreignKey: { store: STORE_NAME.executionPlans, field: 'id' } },
      { name: 'symbol', type: 'string', required: false, description: '股票代码', foreignKey: { store: STORE_NAME.stocks, field: 'symbol' } },
      { name: 'timestamp', type: 'number', required: false, description: '执行时间戳' },
      { name: 'action', type: 'string', required: false, description: '执行动作' },
      { name: 'result', type: 'string', required: false, description: '执行结果' },
    ],
    indexes: [
      { name: 'by-plan', keyPath: 'planId', unique: false, description: '按执行计划查询' },
      { name: 'by-symbol', keyPath: 'symbol', unique: false, description: '按股票代码查询' },
      { name: 'by-timestamp', keyPath: 'timestamp', unique: false, description: '按时间戳排序' },
    ],
    dependsOn: [
      { store: STORE_NAME.executionPlans, field: 'planId', description: 'N:1 日志↔执行计划' },
      { store: STORE_NAME.stocks, field: 'symbol', description: 'N:1 日志↔股票' },
    ],
  },

  [STORE_NAME.missingReports]: {
    name: STORE_NAME.missingReports,
    keyPath: 'id',
    autoIncrement: true,
    introducedAt: 'v15',
    domain: '执行',
    description: '缺失报告登记',
    tsType: 'MissingReport',
    tsTypeFile: 'src/data/types/types.execution.ts',
    fields: [
      { name: 'id', type: 'number', required: true, description: '自增主键' },
      { name: 'symbol', type: 'string', required: true, description: '股票代码', foreignKey: { store: STORE_NAME.stocks, field: 'symbol' } },
      { name: 'severity', type: 'string', required: true, description: '严重程度' },
      { name: 'detectedAt', type: 'number', required: false, description: '检测时间戳' },
      { name: 'retryCount', type: 'number', required: false, description: '重试次数', default: '0' },
    ],
    indexes: [
      { name: 'by-symbol', keyPath: 'symbol', unique: false, description: '按股票代码查询' },
      { name: 'by-severity', keyPath: 'severity', unique: false, description: '按严重程度查询' },
      { name: 'by-detected-at', keyPath: 'detectedAt', unique: false, description: '按检测时间排序' },
    ],
    dependsOn: [
      { store: STORE_NAME.stocks, field: 'symbol', description: 'N:1 缺失报告↔股票' },
    ],
  },

  [STORE_NAME.portfolios]: {
    name: STORE_NAME.portfolios,
    keyPath: 'id',
    autoIncrement: false,
    introducedAt: 'v16',
    domain: '组合',
    description: '投资组合',
    tsType: 'Portfolio',
    tsTypeFile: 'src/data/types/types.portfolio.ts',
    fields: [
      { name: 'id', type: 'string', required: true, description: '组合 ID' },
      { name: 'theme', type: 'string', required: false, description: '组合主题', example: 'AI算力精选' },
      { name: 'updatedAt', type: 'number', required: false, description: '更新时间戳' },
      { name: 'holdings', type: 'PortfolioHolding[]', required: false, description: '持仓列表' },
    ],
    indexes: [
      { name: 'by-theme', keyPath: 'theme', unique: false, description: '按主题查询' },
      { name: 'by-updated-at', keyPath: 'updatedAt', unique: false, description: '按更新时间排序' },
    ],
    dependsOn: [],
  },

  // ── 策略域 ──
  [STORE_NAME.rotationScores]: {
    name: STORE_NAME.rotationScores,
    keyPath: 'id',
    autoIncrement: false,
    introducedAt: 'v6',
    domain: '策略',
    description: '板块轮动评分',
    tsType: 'RotationSectorScore',
    tsTypeFile: 'src/data/types/types.rotation.ts',
    fields: [
      { name: 'id', type: 'string', required: true, description: '轮动评分 ID' },
      { name: 'sectorCode', type: 'string', required: true, description: '板块代码' },
      { name: 'scoreDate', type: 'string', required: true, description: '评分日期' },
      { name: 'total', type: 'number', required: false, description: '总分' },
      { name: 'resonance', type: 'number', required: false, description: '共振度' },
      { name: 'factors', type: 'RotationFactor[]', required: false, description: '轮动因子详情' },
    ],
    indexes: [
      { name: 'by-sector-date', keyPath: ['sectorCode', 'scoreDate'], unique: true, description: '板块+日期唯一' },
      { name: 'by-sector', keyPath: 'sectorCode', unique: false, description: '按板块查询' },
      { name: 'by-total', keyPath: 'total', unique: false, description: '按总分排序' },
      { name: 'by-resonance', keyPath: 'resonance', unique: false, description: '按共振度排序' },
    ],
    dependsOn: [],
  },

  [STORE_NAME.sectorScores]: {
    name: STORE_NAME.sectorScores,
    keyPath: 'id',
    autoIncrement: false,
    introducedAt: 'v6',
    domain: '策略',
    description: '十五五板块评分',
    tsType: 'SectorScoreRecord',
    tsTypeFile: 'src/data/types/types.sector.ts',
    fields: [
      { name: 'id', type: 'string', required: true, description: '板块评分 ID' },
      { name: 'sectorCode', type: 'string', required: true, description: '板块代码' },
      { name: 'composite', type: 'number', required: false, description: '综合评分' },
      { name: 'isCore', type: 'boolean', required: false, description: '是否核心板块' },
      { name: 'dimensions', type: 'SectorScoreDimensions', required: false, description: '各维度评分' },
    ],
    indexes: [
      { name: 'by-sector', keyPath: 'sectorCode', unique: false, description: '按板块代码查询' },
      { name: 'by-composite', keyPath: 'composite', unique: false, description: '按综合评分排序' },
      { name: 'by-is-core', keyPath: 'isCore', unique: false, description: '按核心板块筛选' },
    ],
    dependsOn: [],
  },

  [STORE_NAME.strategySnapshots]: {
    name: STORE_NAME.strategySnapshots,
    keyPath: 'id',
    autoIncrement: false,
    introducedAt: 'v6',
    domain: '策略',
    description: '策略快照',
    tsType: 'StrategySnapshot',
    tsTypeFile: 'src/data/types/types.scoreDoc.ts',
    fields: [
      { name: 'id', type: 'string', required: true, description: '快照 ID' },
      { name: 'version', type: 'string', required: true, description: '快照版本号' },
      { name: 'date', type: 'string', required: false, description: '快照日期' },
      { name: 'timestamp', type: 'number', required: false, description: '快照时间戳' },
      { name: 'data', type: 'object', required: false, description: '快照数据' },
    ],
    indexes: [
      { name: 'by-version', keyPath: 'version', unique: true, description: '版本唯一' },
      { name: 'by-date', keyPath: 'date', unique: false, description: '按日期查询' },
      { name: 'by-timestamp', keyPath: 'timestamp', unique: false, description: '按时间戳排序' },
    ],
    dependsOn: [],
  },

  [STORE_NAME.hotSectorScores]: {
    name: STORE_NAME.hotSectorScores,
    keyPath: 'symbol',
    autoIncrement: false,
    introducedAt: 'v14',
    domain: '策略',
    description: '热门板块策略评分（双策略体系）',
    tsType: 'HotSectorScore',
    tsTypeFile: 'src/data/types/types.strategy.ts',
    fields: [
      { name: 'symbol', type: 'string', required: true, description: '股票代码', foreignKey: { store: STORE_NAME.stocks, field: 'symbol' } },
      { name: 'calculatedAt', type: 'number', required: false, description: '计算时间戳' },
      { name: 'marketEnv', type: 'number', required: false, description: '市场环境评分', example: '78.5' },
      { name: 'dimensions', type: 'HotSectorDimensionScores', required: false, description: '五维评分详情' },
    ],
    indexes: [
      { name: 'by-calculated-at', keyPath: 'calculatedAt', unique: false, description: '按计算时间排序' },
    ],
    dependsOn: [
      { store: STORE_NAME.stocks, field: 'symbol', description: '1:1 热门板块评分↔股票' },
    ],
  },

  [STORE_NAME.valuePitScores]: {
    name: STORE_NAME.valuePitScores,
    keyPath: 'symbol',
    autoIncrement: false,
    introducedAt: 'v14',
    domain: '策略',
    description: '价值洼地策略评分（双策略体系）',
    tsType: 'ValuePitScore',
    tsTypeFile: 'src/data/types/types.strategy.ts',
    fields: [
      { name: 'symbol', type: 'string', required: true, description: '股票代码', foreignKey: { store: STORE_NAME.stocks, field: 'symbol' } },
      { name: 'calculatedAt', type: 'number', required: false, description: '计算时间戳' },
      { name: 'dimensions', type: 'ValuePitDimensionScores', required: false, description: '五维评分详情' },
    ],
    indexes: [
      { name: 'by-calculated-at', keyPath: 'calculatedAt', unique: false, description: '按计算时间排序' },
    ],
    dependsOn: [
      { store: STORE_NAME.stocks, field: 'symbol', description: '1:1 价值洼地评分↔股票' },
    ],
  },

  // ── 观察域 ──
  [STORE_NAME.watchlists]: {
    name: STORE_NAME.watchlists,
    keyPath: 'id',
    autoIncrement: false,
    introducedAt: 'v1',
    domain: '观察',
    description: '自选股观察列表快照',
    tsType: 'Watchlist',
    tsTypeFile: 'src/data/types/types.order.ts',
    fields: [
      { name: 'id', type: 'string', required: true, description: '快照 ID' },
      { name: 'symbols', type: 'string[]', required: false, description: '股票代码列表' },
      { name: 'createdAt', type: 'number', required: false, description: '创建时间戳' },
    ],
    indexes: [],
    dependsOn: [],
  },

  // ── 知识库域 ──
  [STORE_NAME.localDocs]: {
    name: STORE_NAME.localDocs,
    keyPath: 'id',
    autoIncrement: false,
    introducedAt: 'v6',
    domain: '知识库',
    description: '本地知识库文档（含嵌入向量）',
    tsType: 'LocalDoc',
    tsTypeFile: 'src/data/types/types.knowledge.ts',
    fields: [
      { name: 'id', type: 'string', required: true, description: '文档 ID' },
      { name: 'name', type: 'string', required: false, description: '文档名称' },
      { name: 'symbol', type: 'string', required: false, description: '关联股票代码', foreignKey: { store: STORE_NAME.stocks, field: 'symbol' } },
      { name: 'category', type: 'string', required: false, description: '文档分类', example: 'research_report' },
      { name: 'content', type: 'string', required: false, description: '文档内容' },
      { name: 'embedding', type: 'number[]', required: false, description: '嵌入向量（768d）' },
      { name: 'addedAt', type: 'number', required: false, description: '添加时间戳' },
    ],
    indexes: [
      { name: 'by-symbol', keyPath: 'symbol', unique: false, description: '按股票代码查询' },
      { name: 'by-category', keyPath: 'category', unique: false, description: '按分类查询' },
      { name: 'by-added-at', keyPath: 'addedAt', unique: false, description: '按添加时间排序' },
    ],
    dependsOn: [
      { store: STORE_NAME.stocks, field: 'symbol', description: 'N:1 文档↔股票' },
    ],
  },

  [STORE_NAME.researchLogs]: {
    name: STORE_NAME.researchLogs,
    keyPath: 'id',
    autoIncrement: true,
    introducedAt: 'v1',
    domain: '审计',
    description: '研究日志/审计日志',
    tsType: 'ResearchLog',
    tsTypeFile: 'src/data/types/types.signal.ts',
    fields: [
      { name: 'id', type: 'number', required: true, description: '自增主键' },
      { name: 'symbol', type: 'string', required: false, description: '股票代码' },
      { name: 'action', type: 'string', required: false, description: '操作类型' },
      { name: 'timestamp', type: 'number', required: false, description: '审计时间戳' },
      { name: 'traceId', type: 'string', required: false, description: '追踪 ID' },
      { name: 'details', type: 'object', required: false, description: '操作详情' },
    ],
    indexes: [],
    dependsOn: [],
  },

  // ── 资讯域 ──
  [STORE_NAME.news]: {
    name: STORE_NAME.news,
    keyPath: 'id',
    autoIncrement: false,
    introducedAt: 'v6',
    domain: '资讯',
    description: '新闻资讯文章',
    tsType: 'NewsArticle',
    tsTypeFile: 'src/data/types/types.knowledge.ts',
    fields: [
      { name: 'id', type: 'string', required: true, description: '资讯 ID' },
      { name: 'title', type: 'string', required: false, description: '标题' },
      { name: 'content', type: 'string', required: false, description: '正文内容' },
      { name: 'source', type: 'string', required: false, description: '来源', example: 'eastmoney' },
      { name: 'category', type: 'string', required: false, description: '分类', example: 'announcement' },
      { name: 'publishTime', type: 'number', required: false, description: '发布时间戳' },
      { name: 'hash', type: 'string', required: false, description: '内容哈希（去重）' },
      { name: 'url', type: 'string', required: false, description: '原文链接' },
    ],
    indexes: [
      { name: 'by-source', keyPath: 'source', unique: false, description: '按来源筛选' },
      { name: 'by-category', keyPath: 'category', unique: false, description: '按分类筛选' },
      { name: 'by-publish-time', keyPath: 'publishTime', unique: false, description: '按发布时间排序' },
      { name: 'by-hash', keyPath: 'hash', unique: true, description: '内容哈希唯一（去重）' },
    ],
    dependsOn: [],
  },

  [STORE_NAME.newsStockMap]: {
    name: STORE_NAME.newsStockMap,
    keyPath: 'id',
    autoIncrement: false,
    introducedAt: 'v6',
    domain: '资讯',
    description: '新闻-股票关联映射',
    tsType: 'NewsStockMap',
    tsTypeFile: 'src/data/types/types.knowledge.ts',
    fields: [
      { name: 'id', type: 'string', required: true, description: '映射 ID' },
      { name: 'newsId', type: 'string', required: true, description: '新闻 ID', foreignKey: { store: STORE_NAME.news, field: 'id' } },
      { name: 'symbol', type: 'string', required: true, description: '股票代码', foreignKey: { store: STORE_NAME.stocks, field: 'symbol' } },
    ],
    indexes: [
      { name: 'by-symbol', keyPath: 'symbol', unique: false, description: '按股票代码查询' },
      { name: 'by-news', keyPath: 'newsId', unique: false, description: '按新闻 ID 查询' },
    ],
    dependsOn: [
      { store: STORE_NAME.news, field: 'newsId', description: 'N:1 映射↔新闻' },
      { store: STORE_NAME.stocks, field: 'symbol', description: 'N:1 映射↔股票' },
    ],
  },

  [STORE_NAME.sentimentCache]: {
    name: STORE_NAME.sentimentCache,
    keyPath: 'id',
    autoIncrement: false,
    introducedAt: 'v6',
    domain: '资讯',
    description: '情感分析缓存',
    tsType: 'SentimentCache',
    tsTypeFile: 'src/data/types/types.knowledge.ts',
    fields: [
      { name: 'id', type: 'string', required: true, description: '缓存 ID' },
      { name: 'contentHash', type: 'string', required: true, description: '内容哈希' },
      { name: 'sentiment', type: 'string', required: false, description: '情感标签', example: 'positive' },
      { name: 'score', type: 'number', required: false, description: '情感分数', example: '0.75' },
      { name: 'analyzedAt', type: 'number', required: false, description: '分析时间戳' },
    ],
    indexes: [
      { name: 'by-content-hash', keyPath: 'contentHash', unique: true, description: '内容哈希唯一' },
      { name: 'by-analyzed-at', keyPath: 'analyzedAt', unique: false, description: '按分析时间排序' },
    ],
    dependsOn: [],
  },

  // ── 资料域（八域资料体系 ADR-010） ──
  [STORE_NAME.profileItems]: {
    name: STORE_NAME.profileItems,
    keyPath: 'id',
    autoIncrement: false,
    introducedAt: 'v32',
    domain: '资料',
    description: '八域资料条目',
    tsType: 'ProfileItem',
    tsTypeFile: 'src/types/modules/collection.types.ts',
    fields: [
      { name: 'id', type: 'string', required: true, description: '资料条目 ID' },
      { name: 'symbol', type: 'string', required: true, description: '股票代码', foreignKey: { store: STORE_NAME.stocks, field: 'symbol' } },
      { name: 'domain', type: 'string', required: true, description: '所属域（01-08）', example: '01' },
      { name: 'qualityScore', type: 'number', required: false, description: '数据质量评分' },
      { name: 'itemType', type: 'string', required: false, description: '条目类型', example: 'financial' },
      { name: 'dataHash', type: 'string', required: false, description: '数据哈希' },
      { name: 'publishedAt', type: 'number', required: false, description: '发布时间戳' },
      { name: 'source', type: 'string', required: false, description: '数据来源', example: 'akshare' },
      { name: 'content', type: 'object', required: false, description: '条目内容' },
    ],
    indexes: [
      { name: 'by-symbol', keyPath: 'symbol', unique: false, description: '按股票代码查询' },
      { name: 'by-symbol-domain-quality', keyPath: ['symbol', 'domain', 'qualityScore'], unique: false, description: '按股票+域+质量排序' },
      { name: 'by-symbol-type', keyPath: ['symbol', 'itemType'], unique: false, description: '按股票+类型查询' },
      { name: 'by-hash', keyPath: 'dataHash', unique: false, description: '按数据哈希查询' },
      { name: 'by-published-at', keyPath: 'publishedAt', unique: false, description: '按发布时间排序' },
      { name: 'by-source', keyPath: 'source', unique: false, description: '按数据来源查询' },
    ],
    dependsOn: [
      { store: STORE_NAME.stocks, field: 'symbol', description: 'N:1 资料条目↔股票' },
    ],
  },

  [STORE_NAME.stockProfiles]: {
    name: STORE_NAME.stockProfiles,
    keyPath: 'symbol',
    autoIncrement: false,
    introducedAt: 'v32',
    domain: '资料',
    description: '股票资料包元数据',
    tsType: 'StockProfile',
    tsTypeFile: 'src/types/modules/collection.types.ts',
    fields: [
      { name: 'symbol', type: 'string', required: true, description: '股票代码', foreignKey: { store: STORE_NAME.stocks, field: 'symbol' } },
      { name: 'lastUpdatedAt', type: 'number', required: false, description: '最后更新时间戳' },
      { name: 'evidenceCoverage', type: 'number', required: false, description: '证据覆盖率（0-1）' },
      { name: 'domainCounts', type: 'Record<string, number>', required: false, description: '各域条目数量' },
    ],
    indexes: [
      { name: 'by-updated-at', keyPath: 'lastUpdatedAt', unique: false, description: '按更新时间排序' },
      { name: 'by-coverage', keyPath: 'evidenceCoverage', unique: false, description: '按覆盖率排序' },
    ],
    dependsOn: [
      { store: STORE_NAME.stocks, field: 'symbol', description: '1:1 资料包↔股票' },
    ],
  },

  [STORE_NAME.profileTags]: {
    name: STORE_NAME.profileTags,
    keyPath: 'id',
    autoIncrement: false,
    introducedAt: 'v32',
    domain: '资料',
    description: '资料标签库',
    fields: [
      { name: 'id', type: 'string', required: true, description: '标签 ID' },
      { name: 'category', type: 'string', required: false, description: '标签分类', example: 'industry' },
      { name: 'name', type: 'string', required: true, description: '标签名称', example: 'AI算力' },
      { name: 'usageCount', type: 'number', required: false, description: '使用次数', default: '0' },
      { name: 'parentId', type: 'string', required: false, description: '父标签 ID' },
    ],
    indexes: [
      { name: 'by-category', keyPath: 'category', unique: false, description: '按分类查询' },
      { name: 'by-name', keyPath: 'name', unique: true, description: '标签名唯一' },
      { name: 'by-usage', keyPath: 'usageCount', unique: false, description: '按使用次数排序' },
      { name: 'by-parent', keyPath: 'parentId', unique: false, description: '按父标签查询' },
    ],
    dependsOn: [],
  },

  // ── 采集域 ──
  [STORE_NAME.collectConfig]: {
    name: STORE_NAME.collectConfig,
    keyPath: 'id',
    autoIncrement: false,
    introducedAt: 'v25',
    domain: '采集',
    description: '采集策略配置',
    fields: [
      { name: 'id', type: 'string', required: true, description: '配置 ID' },
      { name: 'updatedAt', type: 'number', required: false, description: '更新时间戳' },
      { name: 'dimensions', type: 'string[]', required: false, description: '采集维度列表' },
      { name: 'sources', type: 'string[]', required: false, description: '数据源列表' },
      { name: 'schedule', type: 'object', required: false, description: '调度配置' },
    ],
    indexes: [
      { name: 'by-updated-at', keyPath: 'updatedAt', unique: false, description: '按更新时间排序' },
    ],
    dependsOn: [],
  },

  [STORE_NAME.traceRecords]: {
    name: STORE_NAME.traceRecords,
    keyPath: 'traceId',
    autoIncrement: false,
    introducedAt: 'v27',
    domain: '采集',
    description: '采集链路追踪记录',
    fields: [
      { name: 'traceId', type: 'string', required: true, description: '追踪 ID' },
      { name: 'symbol', type: 'string', required: false, description: '股票代码', foreignKey: { store: STORE_NAME.stocks, field: 'symbol' } },
      { name: 'dimensionCode', type: 'string', required: false, description: '采集维度编码' },
      { name: 'startedAt', type: 'number', required: false, description: '开始时间戳' },
      { name: 'result', type: 'string', required: false, description: '采集结果' },
      { name: 'error', type: 'string', required: false, description: '错误信息' },
    ],
    indexes: [
      { name: 'by-symbol', keyPath: 'symbol', unique: false, description: '按股票代码查询' },
      { name: 'by-dimension', keyPath: 'dimensionCode', unique: false, description: '按维度查询' },
      { name: 'by-started-at', keyPath: 'startedAt', unique: false, description: '按开始时间排序' },
      { name: 'by-result', keyPath: 'result', unique: false, description: '按结果状态查询' },
    ],
    dependsOn: [
      { store: STORE_NAME.stocks, field: 'symbol', description: 'N:1 追踪↔股票' },
    ],
  },

  [STORE_NAME.collectionHistory]: {
    name: STORE_NAME.collectionHistory,
    keyPath: 'id',
    autoIncrement: false,
    introducedAt: 'v31',
    domain: '采集',
    description: '采集/更新历史',
    fields: [
      { name: 'id', type: 'string', required: true, description: '历史记录 ID' },
      { name: 'timestamp', type: 'number', required: false, description: '时间戳' },
      { name: 'date', type: 'string', required: false, description: '日期', example: '2026-08-17' },
      { name: 'channel', type: 'string', required: false, description: '采集通道', example: 'ifind' },
      { name: 'status', type: 'string', required: false, description: '采集状态', example: 'success' },
      { name: 'symbol', type: 'string', required: false, description: '股票代码（非索引字段）' },
    ],
    indexes: [
      { name: 'by-timestamp', keyPath: 'timestamp', unique: false, description: '按时间戳排序' },
      { name: 'by-date', keyPath: 'date', unique: false, description: '按日期查询' },
      { name: 'by-channel', keyPath: 'channel', unique: false, description: '按通道查询' },
      { name: 'by-status', keyPath: 'status', unique: false, description: '按状态查询' },
    ],
    dependsOn: [],
  },

  [STORE_NAME.conflictLog]: {
    name: STORE_NAME.conflictLog,
    keyPath: 'id',
    autoIncrement: false,
    introducedAt: 'v31',
    domain: '采集',
    description: '冲突日志',
    fields: [
      { name: 'id', type: 'string', required: true, description: '冲突日志 ID' },
      { name: 'timestamp', type: 'number', required: false, description: '冲突时间戳' },
      { name: 'symbol', type: 'string', required: false, description: '股票代码', foreignKey: { store: STORE_NAME.stocks, field: 'symbol' } },
      { name: 'resolution', type: 'string', required: false, description: '解决方式', example: 'auto_merge' },
      { name: 'details', type: 'object', required: false, description: '冲突详情' },
    ],
    indexes: [
      { name: 'by-timestamp', keyPath: 'timestamp', unique: false, description: '按时间戳排序' },
      { name: 'by-symbol', keyPath: 'symbol', unique: false, description: '按股票代码查询' },
      { name: 'by-resolution', keyPath: 'resolution', unique: false, description: '按解决方式查询' },
    ],
    dependsOn: [
      { store: STORE_NAME.stocks, field: 'symbol', description: 'N:1 冲突日志↔股票' },
    ],
  },

  [STORE_NAME.fileImportRecords]: {
    name: STORE_NAME.fileImportRecords,
    keyPath: 'id',
    autoIncrement: false,
    introducedAt: 'v31',
    domain: '采集',
    description: '文件导入记录',
    fields: [
      { name: 'id', type: 'string', required: true, description: '导入记录 ID' },
      { name: 'timestamp', type: 'number', required: false, description: '导入时间戳' },
      { name: 'fileHash', type: 'string', required: false, description: '文件哈希' },
      { name: 'fileName', type: 'string', required: false, description: '文件名' },
      { name: 'symbol', type: 'string', required: false, description: '关联股票代码' },
    ],
    indexes: [
      { name: 'by-timestamp', keyPath: 'timestamp', unique: false, description: '按时间戳排序' },
      { name: 'by-hash', keyPath: 'fileHash', unique: false, description: '按文件哈希查询' },
      { name: 'by-file-name', keyPath: 'fileName', unique: false, description: '按文件名查询' },
    ],
    dependsOn: [],
  },

  [STORE_NAME.proofreadReports]: {
    name: STORE_NAME.proofreadReports,
    keyPath: 'meta.reportId',
    autoIncrement: false,
    introducedAt: 'v31',
    domain: '采集',
    description: '校对报告',
    fields: [
      { name: 'meta.reportId', type: 'string', required: true, description: '报告 ID（嵌套 keyPath）' },
      { name: 'meta.generatedAt', type: 'number', required: false, description: '生成时间戳' },
      { name: 'meta.fileHash', type: 'string', required: false, description: '文件哈希' },
      { name: 'content', type: 'object', required: false, description: '校对内容' },
    ],
    indexes: [
      { name: 'by-timestamp', keyPath: 'meta.generatedAt', unique: false, description: '按生成时间排序' },
      { name: 'by-fileHash', keyPath: 'meta.fileHash', unique: false, description: '按文件哈希查询' },
    ],
    dependsOn: [],
  },

  [STORE_NAME.scheduleConfigs]: {
    name: STORE_NAME.scheduleConfigs,
    keyPath: 'scheduleId',
    autoIncrement: false,
    introducedAt: 'v31',
    domain: '采集',
    description: '调度配置',
    fields: [
      { name: 'scheduleId', type: 'string', required: true, description: '调度 ID' },
      { name: 'enabled', type: 'boolean', required: false, description: '是否启用', default: 'true' },
      { name: 'nextRunAt', type: 'number', required: false, description: '下次运行时间戳' },
      { name: 'cronExpression', type: 'string', required: false, description: 'Cron 表达式' },
    ],
    indexes: [
      { name: 'by-enabled', keyPath: 'enabled', unique: false, description: '按启用状态查询' },
      { name: 'by-nextRun', keyPath: 'nextRunAt', unique: false, description: '按下次运行时间排序' },
    ],
    dependsOn: [],
  },

  // ── 工作流域 ──
  [STORE_NAME.workflowDefs]: {
    name: STORE_NAME.workflowDefs,
    keyPath: 'id',
    autoIncrement: false,
    introducedAt: 'v28',
    domain: '工作流',
    description: '工作流定义',
    tsType: 'WorkflowDefinition',
    tsTypeFile: 'src/types/modules/workflow.types.ts',
    fields: [
      { name: 'id', type: 'string', required: true, description: '工作流 ID' },
      { name: 'name', type: 'string', required: false, description: '工作流名称' },
      { name: 'updatedAt', type: 'number', required: false, description: '更新时间戳' },
      { name: 'steps', type: 'object[]', required: false, description: '工作流步骤' },
    ],
    indexes: [
      { name: 'by-updated-at', keyPath: 'updatedAt', unique: false, description: '按更新时间排序' },
      { name: 'by-name', keyPath: 'name', unique: false, description: '按名称查询' },
    ],
    dependsOn: [],
  },

  [STORE_NAME.workflowSchedules]: {
    name: STORE_NAME.workflowSchedules,
    keyPath: 'id',
    autoIncrement: false,
    introducedAt: 'v28',
    domain: '工作流',
    description: '定时调度定义',
    fields: [
      { name: 'id', type: 'string', required: true, description: '调度 ID' },
      { name: 'workflowId', type: 'string', required: true, description: '工作流 ID', foreignKey: { store: STORE_NAME.workflowDefs, field: 'id' } },
      { name: 'enabled', type: 'boolean', required: false, description: '是否启用', default: 'true' },
      { name: 'cronExpression', type: 'string', required: false, description: 'Cron 表达式' },
    ],
    indexes: [
      { name: 'by-workflow-id', keyPath: 'workflowId', unique: false, description: '按工作流 ID 查询' },
      { name: 'by-enabled', keyPath: 'enabled', unique: false, description: '按启用状态查询' },
    ],
    dependsOn: [
      { store: STORE_NAME.workflowDefs, field: 'workflowId', description: 'N:1 调度↔工作流定义' },
    ],
  },

  [STORE_NAME.workflowTriggers]: {
    name: STORE_NAME.workflowTriggers,
    keyPath: 'id',
    autoIncrement: false,
    introducedAt: 'v28',
    domain: '工作流',
    description: '事件触发器定义',
    fields: [
      { name: 'id', type: 'string', required: true, description: '触发器 ID' },
      { name: 'workflowId', type: 'string', required: true, description: '工作流 ID', foreignKey: { store: STORE_NAME.workflowDefs, field: 'id' } },
      { name: 'event', type: 'string', required: true, description: '触发事件名' },
      { name: 'enabled', type: 'boolean', required: false, description: '是否启用', default: 'true' },
    ],
    indexes: [
      { name: 'by-workflow-id', keyPath: 'workflowId', unique: false, description: '按工作流 ID 查询' },
      { name: 'by-event', keyPath: 'event', unique: false, description: '按事件名查询' },
      { name: 'by-enabled', keyPath: 'enabled', unique: false, description: '按启用状态查询' },
    ],
    dependsOn: [
      { store: STORE_NAME.workflowDefs, field: 'workflowId', description: 'N:1 触发器↔工作流定义' },
    ],
  },

  [STORE_NAME.workflowRuns]: {
    name: STORE_NAME.workflowRuns,
    keyPath: 'runId',
    autoIncrement: false,
    introducedAt: 'v28',
    domain: '工作流',
    description: '工作流运行实例',
    fields: [
      { name: 'runId', type: 'string', required: true, description: '运行实例 ID' },
      { name: 'workflowId', type: 'string', required: true, description: '工作流 ID', foreignKey: { store: STORE_NAME.workflowDefs, field: 'id' } },
      { name: 'status', type: 'string', required: false, description: '运行状态', example: 'running' },
      { name: 'createdAt', type: 'number', required: false, description: '创建时间戳' },
      { name: 'checkpoint', type: 'object', required: false, description: '断点数据' },
    ],
    indexes: [
      { name: 'by-workflow-id', keyPath: 'workflowId', unique: false, description: '按工作流 ID 查询' },
      { name: 'by-status', keyPath: 'status', unique: false, description: '按状态查询' },
      { name: 'by-created-at', keyPath: 'createdAt', unique: false, description: '按创建时间排序' },
    ],
    dependsOn: [
      { store: STORE_NAME.workflowDefs, field: 'workflowId', description: 'N:1 运行实例↔工作流定义' },
    ],
  },

  // ── 分析域 ──
  [STORE_NAME.analysisResults]: {
    name: STORE_NAME.analysisResults,
    keyPath: 'docId',
    autoIncrement: false,
    introducedAt: 'v30',
    domain: '分析',
    description: '分析结果（AnalysisOrchestrator 持久化）',
    fields: [
      { name: 'docId', type: 'string', required: true, description: '分析文档 ID' },
      { name: 'symbol', type: 'string', required: true, description: '股票代码', foreignKey: { store: STORE_NAME.stocks, field: 'symbol' } },
      { name: 'version', type: 'number', required: false, description: '分析版本号' },
      { name: 'createdAt', type: 'number', required: false, description: '创建时间戳' },
      { name: 'conclusion', type: 'string', required: false, description: '分析结论' },
      { name: 'content', type: 'string', required: false, description: '分析报告内容' },
    ],
    indexes: [
      { name: 'by-symbol', keyPath: 'symbol', unique: false, description: '按股票代码查询' },
      { name: 'by-symbol-version', keyPath: ['symbol', 'version'], unique: true, description: '股票+版本唯一' },
      { name: 'by-created-at', keyPath: 'createdAt', unique: false, description: '按创建时间排序' },
    ],
    dependsOn: [
      { store: STORE_NAME.stocks, field: 'symbol', description: 'N:1 分析结果↔股票' },
    ],
  },

  // ── 报告域 ──
  [STORE_NAME.generatedReports]: {
    name: STORE_NAME.generatedReports,
    keyPath: 'reportId',
    autoIncrement: false,
    introducedAt: 'v33',
    domain: '报告',
    description: '已生成报告历史（P1 报告资产化）',
    fields: [
      { name: 'reportId', type: 'string', required: true, description: '报告 ID' },
      { name: 'symbol', type: 'string', required: false, description: '股票代码', foreignKey: { store: STORE_NAME.stocks, field: 'symbol' } },
      { name: 'generatedAt', type: 'number', required: false, description: '生成时间戳' },
      { name: 'templateId', type: 'string', required: false, description: '模板 ID', foreignKey: { store: STORE_NAME.reportTemplates, field: 'templateId' } },
      { name: 'content', type: 'string', required: false, description: '报告内容（Markdown/HTML）' },
      { name: 'format', type: 'string', required: false, description: '报告格式', example: 'markdown' },
    ],
    indexes: [
      { name: 'by-symbol', keyPath: 'symbol', unique: false, description: '按股票代码查询' },
      { name: 'by-generated-at', keyPath: 'generatedAt', unique: false, description: '按生成时间排序' },
      { name: 'by-template', keyPath: 'templateId', unique: false, description: '按模板 ID 查询' },
    ],
    dependsOn: [
      { store: STORE_NAME.stocks, field: 'symbol', description: 'N:1 报告↔股票' },
    ],
  },

  [STORE_NAME.reportTemplates]: {
    name: STORE_NAME.reportTemplates,
    keyPath: 'templateId',
    autoIncrement: false,
    introducedAt: 'v33',
    domain: '报告',
    description: '报告模板库',
    fields: [
      { name: 'templateId', type: 'string', required: true, description: '模板 ID' },
      { name: 'name', type: 'string', required: false, description: '模板名称', example: '标准研报模板' },
      { name: 'content', type: 'string', required: false, description: '模板内容' },
      { name: 'description', type: 'string', required: false, description: '模板描述' },
    ],
    indexes: [
      { name: 'by-name', keyPath: 'name', unique: false, description: '按模板名查询' },
    ],
    dependsOn: [],
  },

  // ── 筛选域 ──
  [STORE_NAME.screeningResults]: {
    name: STORE_NAME.screeningResults,
    keyPath: 'runId',
    autoIncrement: false,
    introducedAt: 'v34',
    domain: '筛选',
    description: '多因子筛选结果集持久化',
    fields: [
      { name: 'runId', type: 'string', required: true, description: '筛选运行 ID' },
      { name: 'symbol', type: 'string', required: true, description: '股票代码', foreignKey: { store: STORE_NAME.stocks, field: 'symbol' } },
      { name: 'createdAt', type: 'number', required: false, description: '创建时间戳' },
      { name: 'factors', type: 'object', required: false, description: '筛选因子与权重' },
      { name: 'score', type: 'number', required: false, description: '筛选得分' },
      { name: 'rank', type: 'number', required: false, description: '排名' },
    ],
    indexes: [
      { name: 'by-symbol', keyPath: 'symbol', unique: false, description: '按股票代码查询' },
      { name: 'by-created-at', keyPath: 'createdAt', unique: false, description: '按创建时间排序' },
    ],
    dependsOn: [
      { store: STORE_NAME.stocks, field: 'symbol', description: 'N:1 筛选结果↔股票' },
    ],
  },

  // ── 智能体域 ──
  [STORE_NAME.customAgents]: {
    name: STORE_NAME.customAgents,
    keyPath: 'id',
    autoIncrement: false,
    introducedAt: 'v26',
    domain: '智能体',
    description: '用户自定义智能体',
    tsType: 'CustomAgent',
    tsTypeFile: 'src/types/modules/agent.types.ts',
    fields: [
      { name: 'id', type: 'string', required: true, description: '智能体 ID（nanoid）' },
      { name: 'type', type: 'string', required: false, description: '智能体类型', example: 'stock_analyst' },
      { name: 'name', type: 'string', required: false, description: '智能体名称' },
      { name: 'updatedAt', type: 'number', required: false, description: '更新时间戳' },
      { name: 'systemPrompt', type: 'string', required: false, description: '系统提示词' },
      { name: 'model', type: 'string', required: false, description: '使用的模型', example: 'gpt-4' },
      { name: 'tools', type: 'string[]', required: false, description: '可用工具列表' },
    ],
    indexes: [
      { name: 'by-type', keyPath: 'type', unique: false, description: '按类型筛选' },
      { name: 'by-updated-at', keyPath: 'updatedAt', unique: false, description: '按更新时间排序' },
    ],
    dependsOn: [],
  },

  // ── 权限域（RBAC 6 表） ──
  [STORE_NAME.rbacUsers]: {
    name: STORE_NAME.rbacUsers,
    keyPath: null,
    autoIncrement: false,
    introducedAt: 'v24',
    domain: '权限',
    description: 'RBAC 用户表',
    tsTypeFile: 'src/types/modules/rbac.types.ts',
    fields: [
      { name: 'id', type: 'string', required: true, description: '用户 ID' },
      { name: 'name', type: 'string', required: false, description: '用户名' },
      { name: 'email', type: 'string', required: false, description: '邮箱' },
      { name: 'createdAt', type: 'number', required: false, description: '创建时间戳' },
    ],
    indexes: [],
    dependsOn: [],
  },

  [STORE_NAME.rbacRoles]: {
    name: STORE_NAME.rbacRoles,
    keyPath: null,
    autoIncrement: false,
    introducedAt: 'v24',
    domain: '权限',
    description: 'RBAC 角色表',
    tsTypeFile: 'src/types/modules/rbac.types.ts',
    fields: [
      { name: 'id', type: 'string', required: true, description: '角色 ID' },
      { name: 'name', type: 'string', required: false, description: '角色名称', example: 'admin' },
      { name: 'description', type: 'string', required: false, description: '角色描述' },
    ],
    indexes: [],
    dependsOn: [],
  },

  [STORE_NAME.rbacPermissions]: {
    name: STORE_NAME.rbacPermissions,
    keyPath: null,
    autoIncrement: false,
    introducedAt: 'v24',
    domain: '权限',
    description: 'RBAC 权限表',
    tsTypeFile: 'src/types/modules/rbac.types.ts',
    fields: [
      { name: 'id', type: 'string', required: true, description: '权限 ID' },
      { name: 'name', type: 'string', required: false, description: '权限名称', example: 'read:stocks' },
      { name: 'resource', type: 'string', required: false, description: '资源标识' },
      { name: 'action', type: 'string', required: false, description: '操作类型' },
    ],
    indexes: [],
    dependsOn: [],
  },

  [STORE_NAME.rbacUserRoles]: {
    name: STORE_NAME.rbacUserRoles,
    keyPath: null,
    autoIncrement: false,
    introducedAt: 'v24',
    domain: '权限',
    description: 'RBAC 用户-角色映射表',
    tsTypeFile: 'src/types/modules/rbac.types.ts',
    fields: [
      { name: 'id', type: 'string', required: true, description: '映射 ID' },
      { name: 'userId', type: 'string', required: true, description: '用户 ID', foreignKey: { store: STORE_NAME.rbacUsers, field: 'id' } },
      { name: 'roleId', type: 'string', required: true, description: '角色 ID', foreignKey: { store: STORE_NAME.rbacRoles, field: 'id' } },
    ],
    indexes: [],
    dependsOn: [
      { store: STORE_NAME.rbacUsers, field: 'userId', description: 'N:1 映射↔用户' },
      { store: STORE_NAME.rbacRoles, field: 'roleId', description: 'N:1 映射↔角色' },
    ],
  },

  [STORE_NAME.rbacRolePermissions]: {
    name: STORE_NAME.rbacRolePermissions,
    keyPath: null,
    autoIncrement: false,
    introducedAt: 'v24',
    domain: '权限',
    description: 'RBAC 角色-权限映射表',
    tsTypeFile: 'src/types/modules/rbac.types.ts',
    fields: [
      { name: 'id', type: 'string', required: true, description: '映射 ID' },
      { name: 'roleId', type: 'string', required: true, description: '角色 ID', foreignKey: { store: STORE_NAME.rbacRoles, field: 'id' } },
      { name: 'permissionId', type: 'string', required: true, description: '权限 ID', foreignKey: { store: STORE_NAME.rbacPermissions, field: 'id' } },
    ],
    indexes: [],
    dependsOn: [
      { store: STORE_NAME.rbacRoles, field: 'roleId', description: 'N:1 映射↔角色' },
      { store: STORE_NAME.rbacPermissions, field: 'permissionId', description: 'N:1 映射↔权限' },
    ],
  },

  [STORE_NAME.rbacPermissionAuditLogs]: {
    name: STORE_NAME.rbacPermissionAuditLogs,
    keyPath: null,
    autoIncrement: false,
    introducedAt: 'v24',
    domain: '权限',
    description: 'RBAC 权限审计日志（append-only）',
    tsTypeFile: 'src/types/modules/rbac.types.ts',
    fields: [
      { name: 'id', type: 'string', required: true, description: '日志 ID' },
      { name: 'userId', type: 'string', required: false, description: '操作用户 ID' },
      { name: 'action', type: 'string', required: false, description: '审计动作' },
      { name: 'timestamp', type: 'number', required: false, description: '审计时间戳' },
      { name: 'details', type: 'object', required: false, description: '审计详情' },
    ],
    indexes: [],
    dependsOn: [],
  },

  // ── 系统域 ──
  [STORE_NAME.schemaMigrations]: {
    name: STORE_NAME.schemaMigrations,
    keyPath: 'id',
    autoIncrement: false,
    introducedAt: 'v23',
    domain: '系统',
    description: 'Schema 迁移追踪（D-01 迁移框架）',
    fields: [
      { name: 'id', type: 'string', required: true, description: '迁移 ID（如 v23→v24）' },
      { name: 'appliedAt', type: 'number', required: false, description: '应用时间戳' },
      { name: 'description', type: 'string', required: false, description: '迁移描述' },
    ],
    indexes: [],
    dependsOn: [],
  },

  [STORE_NAME.observationReviews]: {
    name: STORE_NAME.observationReviews,
    keyPath: 'reviewId',
    autoIncrement: false,
    introducedAt: 'v35',
    domain: '观察池',
    description: '观察池复盘快照（v35 新增，spec 缺口② 闭环，替代纯内存态 lastScores，支持跨重启评分漂移比对与晋升候选跟踪）',
    tsType: 'ObservationReviewRecord',
    tsTypeFile: 'src/data/dataLayerContentStores.ts',
    fields: [
      { name: 'reviewId', type: 'string', required: true, description: '复盘运行唯一 ID（主键）' },
      { name: 'generatedAt', type: 'number', required: true, description: '生成时间戳' },
      { name: 'items', type: 'array', required: true, description: '复盘快照条目数组（含 symbol/评分漂移/推荐）' },
      { name: 'summary', type: 'object', required: true, description: '复盘汇总（总数/可晋升/改善/下滑/不变）' },
      { name: 'sourceModule', type: 'string', required: false, description: '来源模块' },
    ],
    indexes: [
      { name: 'by-generated-at', keyPath: 'generatedAt', unique: false, description: '按生成时间排序' },
      { name: 'by-symbol', keyPath: 'items.symbol', unique: false, description: '按条目内 symbol 查询' },
    ],
    dependsOn: [],
  },
}

// ============================================================
// 工具函数
// ============================================================

/**
 * 获取指定 Store 的完整定义
 */
export function getStoreDef(storeName: StoreName): StoreDef | undefined {
  return DATA_DICTIONARY[storeName]
}

/**
 * 获取所有 Store 列表（按功能域分组）
 */
export function getStoresByDomain(): Record<string, StoreDef[]> {
  const domains: Record<string, StoreDef[]> = {}
  for (const store of Object.values(DATA_DICTIONARY)) {
    domains[store.domain] ??= []
    domains[store.domain]!.push(store)
  }
  return domains
}

/**
 * 获取所有外键关系（Store → 依赖的父 Store）
 */
export function getForeignKeyRelations(): Array<{ child: StoreName; parent: StoreName; field: string; description: string }> {
  const relations: Array<{ child: StoreName; parent: StoreName; field: string; description: string }> = []
  for (const store of Object.values(DATA_DICTIONARY)) {
    for (const dep of store.dependsOn) {
      relations.push({ child: store.name, parent: dep.store, field: dep.field, description: dep.description })
    }
  }
  return relations
}

/**
 * 获取所有 Store 数量统计
 */
export function getDataDictionaryStats(): { totalStores: number; totalFields: number; totalIndexes: number; domainCount: number } {
  const stores = Object.values(DATA_DICTIONARY)
  let totalFields = 0
  let totalIndexes = 0
  const domains = new Set<string>()
  for (const store of stores) {
    totalFields += store.fields.length
    totalIndexes += store.indexes.length
    domains.add(store.domain)
  }
  return { totalStores: stores.length, totalFields, totalIndexes, domainCount: domains.size }
}