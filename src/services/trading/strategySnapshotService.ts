/**
 * 策略快照服务（V6 Pro 迁移）
 *
 * 将股票按核心稀缺 / 热点动量 / 价值 bargain 三策略分组，
 * 生成策略快照并持久化到 IndexedDB 的 strategy_snapshots 存储。
 */

import { STORE_NAME } from '@/config/dbConfig'
import { queryList, sendWriteEnvelope } from '@/data/dataLayerHelpers'
import type {
  DataLayerResult,
  RotationSectorScore,
  Stock,
  StrategyGroupSnapshot,
  StrategySnapshot,
  V6Score,
} from '@/data/types'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

export interface StrategyGroupItem {
  symbol: string
  name: string
  composite: number
  l3v: number
  l1Score?: number
  l3fScore?: number
  l7Score?: number
  resonance?: number
  classification: 'core' | 'hot' | 'value'
  reasons: string[]
}

export interface ClassifyStocksInput {
  stocks: Stock[]
  v6Scores: V6Score[]
  rotationScores: RotationSectorScore[]
}

function pickFactor(factors: Record<string, number> | undefined, keys: string[]): number {
  if (!factors) return 0
  for (const key of keys) {
    if (key in factors) {
      return factors[key] ?? 0
    }
  }
  return 0
}

function buildRotationScoreMap(rotationScores: RotationSectorScore[]): Map<string, RotationSectorScore> {
  const map = new Map<string, RotationSectorScore>()
  for (const score of rotationScores) {
    const keys: string[] = [
      score.sectorCode,
      score.sectorName,
      score.swLevel1,
      score.swLevel2,
      score.swLevel3,
    ].filter((k): k is string => typeof k === 'string' && k.length > 0)
    for (const key of keys) {
      if (!map.has(key)) map.set(key, score)
    }
  }
  return map
}

function getResonance(stock: Stock, rotationScoreMap: Map<string, RotationSectorScore>): number {
  const keys = [stock.industryCode, stock.sector].filter((k): k is string => Boolean(k))
  for (const key of keys) {
    const match = rotationScoreMap.get(key)
    if (match) {
      return match.resonance ?? 0
    }
  }
  return 0
}

function classify(
  stock: Stock,
  v6Score: V6Score | undefined,
  rotationScoreMap: Map<string, RotationSectorScore>,
): StrategyGroupItem | undefined {
  if (!v6Score) return undefined

  const factors = v6Score.factors
  const composite = v6Score.score
  const l3v = pickFactor(factors, ['L3V', '质量'])
  const l1Score = pickFactor(factors, ['L1', '估值'])
  const l3fScore = pickFactor(factors, ['L3F', '质量'])
  const l7Score = pickFactor(factors, ['L7', '情绪'])
  const resonance = getResonance(stock, rotationScoreMap)

  if (composite >= 4.0 && l7Score >= 3.5 && l1Score >= 3.5) {
    return {
      symbol: stock.symbol,
      name: stock.name,
      composite,
      l3v,
      l1Score,
      l7Score,
      resonance,
      classification: 'core',
      reasons: [
        `符合核心稀缺策略：综合分 ${composite.toFixed(2)} ≥ 4.0，估值(L1) ${l1Score.toFixed(2)} ≥ 3.5，情绪(L7) ${l7Score.toFixed(2)} ≥ 3.5`,
      ],
    }
  }

  if (composite >= 3.0 && l3v < 2.5 && resonance >= 60) {
    return {
      symbol: stock.symbol,
      name: stock.name,
      composite,
      l3v,
      l1Score,
      l3fScore,
      l7Score,
      resonance,
      classification: 'hot',
      reasons: [
        `符合热点动量策略：综合分 ${composite.toFixed(2)} ≥ 3.0，估值(L3V) ${l3v.toFixed(2)} < 2.5，板块共振 ${resonance.toFixed(2)} ≥ 60`,
      ],
    }
  }

  if (composite >= 3.0 && l3v < 3.0 && resonance < 50 && l3fScore >= 3.0) {
    return {
      symbol: stock.symbol,
      name: stock.name,
      composite,
      l3v,
      l1Score,
      l3fScore,
      l7Score,
      resonance,
      classification: 'value',
      reasons: [
        `符合价值 bargain 策略：综合分 ${composite.toFixed(2)} ≥ 3.0，估值(L3V) ${l3v.toFixed(2)} < 3.0，板块共振 ${resonance.toFixed(2)} < 50，质量(L3F) ${l3fScore.toFixed(2)} ≥ 3.0`,
      ],
    }
  }

  return undefined
}

/**
 * classifyStocks
 */
export function classifyStocks(input: ClassifyStocksInput): StrategyGroupItem[] {
  const { stocks, v6Scores, rotationScores } = input
  const v6ScoreMap = new Map(v6Scores.map((score) => [score.symbol, score]))
  const rotationScoreMap = buildRotationScoreMap(rotationScores)

  const items: StrategyGroupItem[] = []
  for (const stock of stocks) {
    const item = classify(stock, v6ScoreMap.get(stock.symbol), rotationScoreMap)
    if (item) {
      items.push(item)
    }
  }
  return items
}

/**
 * buildGroupSnapshot
 * @param items
 * @returns StrategyGroupSnapshot
 */
export function buildGroupSnapshot(items: StrategyGroupItem[]): StrategyGroupSnapshot {
  const count = items.length
  const composites = items.map((item) => item.composite)
  const avgComposite = count > 0 ? Math.round((composites.reduce((a, b) => a + b, 0) / count) * 100) / 100 : 0
  const maxComposite = count > 0 ? Math.max(...composites) : 0
  const symbols = items.map((item) => item.symbol)
  const snapshotItems = items.map((item) => ({
    symbol: item.symbol,
    name: item.name,
    composite: item.composite,
    classification: item.classification,
  }))

  return {
    count,
    avgComposite,
    maxComposite,
    symbols,
    items: snapshotItems,
  }
}

function snapshotItemMap(snapshot: StrategyGroupSnapshot): Map<string, { name: string; composite: number }> {
  return new Map(snapshot.items.map((item) => [item.symbol, { name: item.name, composite: item.composite }]))
}

function diffSymbols(prev: string[], current: string[]): { added: string[]; removed: string[] } {
  const prevSet = new Set(prev)
  const currentSet = new Set(current)
  const added = current.filter((symbol) => !prevSet.has(symbol))
  const removed = prev.filter((symbol) => !currentSet.has(symbol))
  return { added, removed }
}

/**
 * buildChangeLog
 */
export function buildChangeLog(
  prev: StrategySnapshot | undefined,
  current: { core: StrategyGroupSnapshot; hot: StrategyGroupSnapshot; value: StrategyGroupSnapshot; stockCount: number },
): NonNullable<StrategySnapshot['changeFromPrev']> {
  const prevCore = prev?.core
  const prevHot = prev?.hot
  const prevValue = prev?.value

  const prevTotal = (prevCore?.count ?? 0) + (prevHot?.count ?? 0) + (prevValue?.count ?? 0)
  const currentTotal = current.core.count + current.hot.count + current.value.count
  const totalChange = currentTotal - prevTotal

  const coreChange = diffSymbols(prevCore?.symbols ?? [], current.core.symbols)
  const hotChange = diffSymbols(prevHot?.symbols ?? [], current.hot.symbols)
  const valueChange = diffSymbols(prevValue?.symbols ?? [], current.value.symbols)

  const currentMap = new Map<string, { name: string; composite: number }>([
    ...snapshotItemMap(current.core),
    ...snapshotItemMap(current.hot),
    ...snapshotItemMap(current.value),
  ])

  const emptySnapshot: StrategyGroupSnapshot = { count: 0, avgComposite: 0, maxComposite: 0, symbols: [], items: [] }
  const prevMap = new Map<string, { name: string; composite: number }>([
    ...snapshotItemMap(prevCore ?? emptySnapshot),
    ...snapshotItemMap(prevHot ?? emptySnapshot),
    ...snapshotItemMap(prevValue ?? emptySnapshot),
  ])

  const scoreChanges: Array<{ symbol: string; name: string; oldComposite: number; newComposite: number; delta: number }> =
    []
  for (const [symbol, currentItem] of currentMap.entries()) {
    const prevItem = prevMap.get(symbol)
    if (!prevItem) continue
    const delta = Math.round((currentItem.composite - prevItem.composite) * 100) / 100
    if (Math.abs(delta) >= 0.3) {
      scoreChanges.push({
        symbol,
        name: currentItem.name,
        oldComposite: prevItem.composite,
        newComposite: currentItem.composite,
        delta,
      })
    }
  }

  return {
    totalChange,
    coreChange,
    hotChange,
    valueChange,
    scoreChanges,
  }
}

/**
 * getNextVersion
 * @returns Promise<number>
 */
export async function getNextVersion(): Promise<number> {
  const latestResult = await getLatestSnapshot()
  if (!latestResult.success || !latestResult.data) {
    return 1
  }
  return latestResult.data.version + 1
}

/**
 * saveStrategySnapshot
 */
export async function saveStrategySnapshot(
  input: ClassifyStocksInput,
  trigger = 'manual',
): Promise<DataLayerResult<StrategySnapshot>> {
  try {
    const items = classifyStocks(input)
    const coreItems = items.filter((item) => item.classification === 'core')
    const hotItems = items.filter((item) => item.classification === 'hot')
    const valueItems = items.filter((item) => item.classification === 'value')

    const core = buildGroupSnapshot(coreItems)
    const hot = buildGroupSnapshot(hotItems)
    const value = buildGroupSnapshot(valueItems)

    const prevResult = await getLatestSnapshot()
    const prevSnapshot = prevResult.success ? prevResult.data : undefined

    const changeFromPrev = buildChangeLog(prevSnapshot, {
      core,
      hot,
      value,
      stockCount: input.stocks.length,
    })

    const nextVersion = await getNextVersion()
    const timestamp = Date.now()

    const snapshot: StrategySnapshot = {
      id: `snapshot_${timestamp}`,
      version: nextVersion,
      timestamp,
      date: new Date().toISOString().slice(0, 10),
      time: new Date().toTimeString().slice(0, 8),
      stockCount: input.stocks.length,
      scoreCount: input.v6Scores.length,
      rotationCount: input.rotationScores.length,
      core,
      hot,
      value,
      changeFromPrev,
      trigger,
    }

    const result = await sendWriteEnvelope('saveStrategySnapshots', snapshot, 'tradinghub')
    if (!result.success) {
      return { success: false, error: result.error }
    }
    return { success: true, data: snapshot }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('保存策略快照失败', { error: message })
    return { success: false, error: message }
  }
}

/**
 * getLatestSnapshot
 * @returns Promise<DataLayerResult<StrategySnapshot | undefined>>
 */
export async function getLatestSnapshot(): Promise<DataLayerResult<StrategySnapshot | undefined>> {
  try {
    const list = await queryList<StrategySnapshot>(STORE_NAME.strategySnapshots)
    const sorted = list.sort((a, b) => b.timestamp - a.timestamp)
    return { success: true, data: sorted[0] }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('获取最新策略快照失败', { error: message })
    return { success: false, error: message }
  }
}

/**
 * listSnapshots
 * @param limit?
 * @returns Promise<DataLayerResult<StrategySnapshot[]>>
 */
export async function listSnapshots(limit?: number): Promise<DataLayerResult<StrategySnapshot[]>> {
  try {
    const list = await queryList<StrategySnapshot>(STORE_NAME.strategySnapshots)
    const sorted = list.sort((a, b) => b.timestamp - a.timestamp)
    return { success: true, data: limit ? sorted.slice(0, limit) : sorted }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('列出策略快照失败', { error: message })
    return { success: false, error: message }
  }
}
