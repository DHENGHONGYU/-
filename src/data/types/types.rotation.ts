/**
 * @fileoverview 板块轮动域类型（L1 轮动业务域）
 *
 * V6 Pro 迁移：板块轮动量化策略
 *
 * @module data/types/types.rotation
 * @updated 2026-07-07 - PR-1：从 data/types.ts 拆分
/** 市场风格周期  * @doc [V9-DOC-BACK-012, V9-DOC-QA-066]
*/
export type MarketStyle = 'growth' | 'value' | 'balanced'

/** 轮动因子子指标 */
export interface RotationSubFactor {
  code: string
  name: string
  score: number
  calcMethod: string
  dataSource: string
  freq: string
  fullRule: string
  midRule: string
  zeroRule: string
  redLine?: string
}

/** 轮动因子 */
export interface RotationFactor {
  code: string
  name: string
  weight: number
  maxScore: number
  subCount: number
  role: string
  color: string
  subs: RotationSubFactor[]
}

/** 轮动信号分级 */
export interface RotationSignalGrade {
  minResonance: number
  maxResonance: number
  label: string
  signalType: string
  position: string
  action: string
  color: string
  bg: string
}

/** 综合得分分档 */
export interface RotationScoreBucket {
  min: number
  label: string
  pos: string
  desc: string
  color: string
}

/** 高景气抛售预警 */
export interface RotationAlertLevel {
  code: string
  name: string
  color: string
  condition: string
  action: string
}

/** 下跌性质判定结果 */
export interface DeclineNature {
  type: '杀逻辑' | '杀业绩' | '杀估值'
  severity: '严重' | '中等' | '轻微'
  action: string
  color: string
}

/** 板块轮动评分记录（存入 IndexedDB） */
export interface RotationSectorScore {
  id: string // sectorCode__date
  sectorCode: string
  sectorName: string
  swLevel1?: string
  swLevel2?: string
  swLevel3?: string
  scoreDate: string
  /** 景气因子得分 */
  f1Jingqi: number
  /** 资金因子得分 */
  f2Zijin: number
  /** 估值因子得分 */
  f3Guzhi: number
  /** β+相关系数得分 */
  f4Beta: number
  /** 量能因子得分 */
  f5Nengliang: number
  /** 综合总分 0-100 */
  total: number
  /** 共振强度 0-10 */
  resonance: number
  /** 信号标签 */
  signal: string
  /** 预警等级 */
  alertLevel: string
  /** 下跌性质 */
  declineType: string
  /** 相关股票池标的 */
  poolStocks: Array<{ symbol: string; name: string; v6Composite?: number }>
  /** 分析报告 */
  analysisReport?: string
  modelUsed: string
  createdAt: string
}
