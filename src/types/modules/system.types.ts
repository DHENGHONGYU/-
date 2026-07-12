/**
 * @module system.types
 * @description 系统模块类型定义（监控日志、架构可视化、迁移）
 */

// ============================================================
// 监控日志类型
// ============================================================

/** 监控日志级别 */
export type MonitorLogLevel = 'info' | 'warn' | 'error' | 'critical'

/** 监控日志来源 */
export type MonitorLogSource = 'engine' | 'agent' | 'system' | 'dataflow'

/** 监控日志条目 */
export interface MonitorLogEntry {
  id: string
  timestamp: number
  level: MonitorLogLevel
  source: MonitorLogSource
  message: string
  context: Record<string, unknown>
}

/** 监控日志过滤条件 */
export interface MonitorLogFilter {
  level?: MonitorLogLevel
  source?: MonitorLogSource
  limit?: number
}

// ============================================================
// 架构可视化类型
// ============================================================

/** 架构分层节点 */
export interface ArchitectureNode {
  id: string
  name: string
  description: string
  modules: string[]
  color: string
  status: 'healthy' | 'warning' | 'critical' | 'unknown'
  moduleCount: number
}

/** 分层间连接关系 */
export interface ArchitectureConnection {
  from: string
  to: string
  label: string
}

/** V6 引擎层节点 */
export interface EngineLayerNode {
  id: string
  name: string
  deterministic: boolean
  llmEnhanceable: boolean
  weight: number
  status: 'active' | 'idle' | 'error'
}

/** Agent 可视化节点 */
export interface AgentNode {
  id: string
  name: string
  status: string
  type: string
}

/** 架构快照 */
export interface ArchitectureSnapshot {
  layers: ArchitectureNode[]
  connections: ArchitectureConnection[]
  engineLayers: EngineLayerNode[]
  agentNodes: AgentNode[]
  timestamp: number
}

// ============================================================
// 迁移类型
// ============================================================

/** V6 导出形状 */
export interface V6ExportShape {
  stocks?: unknown[]
  daily_quotes?: unknown[]
  v6_scores?: unknown[]
  orders?: unknown[]
  sector_scores?: unknown[]
  rotation_scores?: unknown[]
  score_docs?: unknown[]
  strategy_snapshots?: unknown[]
  local_docs?: unknown[]
  news?: unknown[]
  news_stock_map?: unknown[]
  sentiment_cache?: unknown[]
  v6_reports?: unknown[]
  score_history?: unknown[]
  concepts?: unknown[]
  strategies?: unknown[]
}

/** V9 导入形状 */
export interface V9ImportShape {
  stocks: unknown[]
  dailyQuotes: unknown[]
  v6Scores: unknown[]
  scoreDocsFromScores: unknown[]
  orders: unknown[]
  sectorScores: unknown[]
  rotationScores: unknown[]
  scoreDocs: unknown[]
  strategySnapshots: unknown[]
  localDocs: unknown[]
  news: unknown[]
  newsStockMaps: unknown[]
  sentimentCache: unknown[]
}

/** 迁移报告 */
export interface MigrationReport {
  success: boolean
  durationMs: number
  summary: {
    totalStores: number
    importedRecords: number
    skippedRecords: number
    failedRecords: number
  }
  details: Array<{
    store: string
    total: number
    success: number
    skipped: number
    failed: number
    errors?: Array<{ index: number; id?: string; error: string }>
  }>
}
