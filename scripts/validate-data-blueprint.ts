#!/usr/bin/env tsx
/**
 * 扫描 src/config/dbConfig.ts 与 src/data/types.ts，
 * 校验 Store 数量、命名一致性、核心实体映射是否偏离蓝图。
 */
import * as fs from 'node:fs'
import * as path from 'node:path'

const ROOT = process.cwd()
const DB_CONFIG_PATH = path.join(ROOT, 'src', 'config', 'dbConfig.ts')
const TYPES_PATH = path.join(ROOT, 'src', 'data', 'types.ts')

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

function main() {
  if (!fs.existsSync(DB_CONFIG_PATH)) {
    throw new Error(`dbConfig not found: ${DB_CONFIG_PATH}`)
  }
  if (!fs.existsSync(TYPES_PATH)) {
    throw new Error(`types file not found: ${TYPES_PATH}`)
  }

  const dbConfig = fs.readFileSync(DB_CONFIG_PATH, 'utf-8')
  const types = fs.readFileSync(TYPES_PATH, 'utf-8')

  const storeNames = extractStoreNames(dbConfig)
  const interfaces = extractInterfaceNames(types)

  const expectedStores = 24
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
