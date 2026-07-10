/**
 * @fileoverview 板块评分域类型（L1 板块业务域）
 *
 * V6 Pro 迁移：板块评分体系 — 十五五规划 20 大新兴行业
 *
 * @module data/types/types.sector
 * @updated 2026-07-07 - PR-1：从 data/types.ts 拆分
/** 板块评分三维度 */
export interface SectorScoreDimensions {
  /** 十五五规划契合度 0-5 */
  planAlignment: number
  /** 政策支持力度 0-5 */
  policySupport: number
  /** 中美同等热度 0-5 */
  usChinaParity: number
}

/** 中美对比数据 */
export interface SectorUsChinaData {
  chinaShare?: string
  usStatus?: string
  gap?: string
}

/** 板块定义（十五五规划新兴行业） */
export interface SectorDefinition {
  code: string
  name: string
  category: '新兴产业' | '未来产业' | '战略基础'
  description: string
  keywords: string[]
  dimensions: SectorScoreDimensions
  weight: { plan: number; policy: number; parity: number }
  composite: number
  isCore: boolean
  usChina: SectorUsChinaData
  keyStocks: Array<{ symbol: string; name: string }>
  relatedConcepts: string[]
}

/** 板块-股票映射 */
export interface SectorStockMapping {
  sectorCode: string
  sectorName: string
  stockSymbols: string[]
  matchType: 'primary' | 'secondary'
}

/** 板块评分记录（存入 IndexedDB） */
export interface SectorScoreRecord {
  id: string // sectorCode__date
  sectorCode: string
  scoreDate: string
  dimensions: SectorScoreDimensions
  composite: number
  isCore: boolean
  modelUsed: string
  createdAt: string
}
