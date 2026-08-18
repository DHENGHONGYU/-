#!/usr/bin/env tsx
/**
 * 扫描 src/config/dbConfig.ts 与 src/data/types/ 目录下所有 .ts，
 * 校验 Store 数量、命名一致性、核心实体映射是否偏离蓝图。
 */
import * as fs from 'node:fs'
import * as path from 'path'

const ROOT = process.cwd()
const DB_CONFIG_PATH = path.join(ROOT, 'src', 'config', 'dbConfig.ts')
const TYPES_DIR = path.join(ROOT, 'src', 'data', 'types')
const MODULE_TYPES_DIR = path.join(ROOT, 'src', 'types', 'modules')
const SERVICES_DIR = path.join(ROOT, 'src', 'services')

function extractStoreNames(content: string): string[] {
  const match = content.match(/export const STORE_NAME = \{[\s\S]*?\} as const/)
  if (!match) throw new Error('STORE_NAME not found')
  const keys = match[0].match(/\w+:/g) ?? []
  return keys.map((k) => k.replace(':', ''))
}

function extractInterfaceNames(content: string): string[] {
  const matches = content.match(/export interface (\w+)/g) ?? []
  return matches.map((m) => m.replace('export interface ', ''))
}

function collectInterfaceNames(dir: string): string[] {
  const names: string[] = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      names.push(...collectInterfaceNames(full))
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      names.push(...extractInterfaceNames(fs.readFileSync(full, 'utf-8')))
    }
  }
  return names
}

function main() {
  if (!fs.existsSync(DB_CONFIG_PATH)) {
    throw new Error(`dbConfig not found: ${DB_CONFIG_PATH}`)
  }
  if (!fs.existsSync(TYPES_DIR)) {
    throw new Error(`types dir not found: ${TYPES_DIR}`)
  }

  const dbConfig = fs.readFileSync(DB_CONFIG_PATH, 'utf-8')

  const storeNames = extractStoreNames(dbConfig)
  const interfaces = collectInterfaceNames(TYPES_DIR)
  if (fs.existsSync(MODULE_TYPES_DIR)) {
    interfaces.push(...collectInterfaceNames(MODULE_TYPES_DIR))
  }
  if (fs.existsSync(SERVICES_DIR)) {
    // 扫描 services 层 *.types.ts 中定义的数据实体接口（如 TradeReviewRecord）
    interfaces.push(...collectInterfaceNames(SERVICES_DIR))
  }

  // 真实 Store 数量以 src/config/dbConfig.ts 的 STORE_NAME 为准（当前 53）。
  // 早期硬编码 41 已过期，导致校验恒红；此处与权威值对齐（含 v33 报告资产化 2 项、v34 筛选结果集 1 项、v35 观察池复盘 1 项及并发新增项）。
  // 注意：本脚本仅做"数量+核心实体存在性"粗校验，细粒度 schema↔类型一致性由 validate-data-consistency.ts 兜底。
  // 若确有新增/删除 store，请同步更新此硬编码值（作为"意外增减 store"的护栏）。
  const expectedStores = 53
  if (storeNames.length !== expectedStores) {
    throw new Error(`Store count mismatch: expected ${expectedStores}, got ${storeNames.length}`)
  }

  const requiredInterfaces = [
    'Stock',
    'DailyQuotes',
    'V6Score',
    'IntelligentScore',
    'IndustryScore',
    'HotSectorScore',
    'ValuePitScore',
    'RotationSectorScore',
    'SectorScoreRecord',
    'ScoreDocVersion',
    'StrategySnapshot',
    'LocalDoc',
    'NewsArticle',
    'NewsStockMap',
    'SentimentCache',
    'Order',
    'Signal',
    'Watchlist',
    'ResearchLog',
    'ExecutionPlan',
    'ExecutionLog',
    'MissingReport',
    'Portfolio',
    'TradeReviewRecord',
  'FinancialReport',
  'CustomAgent',
]

  const missing = requiredInterfaces.filter((i) => !interfaces.includes(i))
  if (missing.length > 0) {
    throw new Error(`Missing required interfaces: ${missing.join(', ')}`)
  }

  console.log('[validate-data-blueprint] ✅ Blueprint consistency check passed')
  console.log(`  Stores: ${storeNames.length}`)
  console.log(`  Interfaces: ${interfaces.length}`)
}

main()
