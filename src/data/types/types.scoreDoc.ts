/**
 * @fileoverview 评分文档域类型（L1 评分文档业务域）
 *
 * V6 Pro 迁移：评分文档版本库 + 策略快照与版本管理
 *
 * @module data/types/types.scoreDoc
 * @updated 2026-07-07 - PR-1：从 data/types.ts 拆分
 */

/** V6 评分单维度 */
export interface V6LayerScore {
  score: number
  reason: string
  weight: number
}

/** 单只股票的一次评分文档版本 */
export interface ScoreDocVersion {
  docId: string // symbol__version__timestamp
  symbol: string
  stockName: string
  version: number
  scoreDate: string
  composite: number
  l3v: number
  layers: Record<string, V6LayerScore>
  recommendation: { key: string; label: string; color: string }
  targetPrice: { bull: number; base: number; bear: number }
  keyRisks: string[]
  keyCatalysts: string[]
  reportMd: string
  modelUsed: string
  market: string
  industry?: string
  changeFromPrev?: {
    compositeDelta: number
    l3vDelta: number
    layerChanges: Record<string, number>
  }
  createdAt: string
}

/** 内部文件库统计 */
export interface FileLibraryStats {
  totalDocs: number
  totalStocks: number
  totalVersions: number
  avgComposite: number
  coreStocks: number
  lastUpdate: string
}

/** 策略分组快照 */
export interface StrategyGroupSnapshot {
  count: number
  avgComposite: number
  maxComposite: number
  symbols: string[]
  items: Array<{
    symbol: string
    name: string
    composite: number
    classification: string
  }>
}

/** 策略快照 */
export interface StrategySnapshot {
  id: string
  version: number
  timestamp: number
  date: string
  time: string
  stockCount: number
  scoreCount: number
  rotationCount: number
  core: StrategyGroupSnapshot
  hot: StrategyGroupSnapshot
  value: StrategyGroupSnapshot
  changeFromPrev?: {
    totalChange: number
    coreChange: { added: string[]; removed: string[] }
    hotChange: { added: string[]; removed: string[] }
    valueChange: { added: string[]; removed: string[] }
    scoreChanges?: Array<{
      symbol: string
      name: string
      oldComposite: number
      newComposite: number
      delta: number
    }>
  }
  trigger: string
}
