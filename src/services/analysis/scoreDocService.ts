/**
 * 评分文档版本库服务（V6 Pro 迁移）
 *
 * 为单只股票保存每次评分的完整 Markdown 报告与维度得分，
 * 自动递增版本号并计算与上一版的差异。
 */

import { dataLayer } from '@/data/dataLayer'
import type { DataLayerResult, FileLibraryStats, ScoreDocVersion, V6LayerScore } from '@/data/types'
import type {
  ScoreComparisonMode,
  ScoreComparisonResult,
  DimensionComparisonItem,
  ScoreComparisonTimelineItem,
} from '@/types/modules/score.types'
import { getLogger } from '@/lib/logger'
import { DEFAULT_THRESHOLDS } from '@/services/scoring/v6-engine/config'
import { COLOR_TOKENS } from '@/constants/theme.tokens'

const logger = getLogger()

export function makeScoreDocId(symbol: string, version: number): string {
  return `${symbol}__V${version}__${Date.now()}`
}

export function buildReportMarkdown(doc: ScoreDocVersion): string {
  const lines: string[] = []
  lines.push(`# ${doc.stockName}（${doc.symbol}）评分报告 V${doc.version}`)
  lines.push(`- 评分日期：${doc.scoreDate}`)
  lines.push(`- 综合评分：${doc.composite.toFixed(2)}`)
  lines.push(`- L3V 评分：${doc.l3v.toFixed(2)}`)
  lines.push(`- 模型：${doc.modelUsed}`)
  lines.push('')

  lines.push('## 维度得分')
  for (const [code, layer] of Object.entries(doc.layers)) {
    lines.push(`- **${code}**：${layer.score.toFixed(2)}（权重 ${layer.weight}）`)
    if (layer.reason) lines.push(`  - 理由：${layer.reason}`)
  }
  lines.push('')

  if (doc.recommendation) {
    lines.push(`## 投资建议：${doc.recommendation.label}`)
  }

  if (doc.targetPrice) {
    lines.push(
      `## 目标价：乐观 ${doc.targetPrice.bull} / 基准 ${doc.targetPrice.base} / 悲观 ${doc.targetPrice.bear}`,
    )
  }

  if (doc.keyRisks?.length) {
    lines.push('## 关键风险')
    for (const risk of doc.keyRisks) lines.push(`- ${risk}`)
  }

  if (doc.keyCatalysts?.length) {
    lines.push('## 关键催化')
    for (const catalyst of doc.keyCatalysts) lines.push(`- ${catalyst}`)
  }

  if (doc.changeFromPrev) {
    lines.push('')
    lines.push('## 与上一版差异')
    lines.push(`- 综合分变化：${doc.changeFromPrev.compositeDelta.toFixed(2)}`)
    lines.push(`- L3V 变化：${doc.changeFromPrev.l3vDelta.toFixed(2)}`)
    for (const [code, delta] of Object.entries(doc.changeFromPrev.layerChanges)) {
      lines.push(`- ${code} 变化：${delta.toFixed(2)}`)
    }
  }

  return lines.join('\n')
}

export interface ScoreDocInput {
  symbol: string
  stockName: string
  scoreDate?: string
  composite: number
  l3v: number
  layers: Record<string, V6LayerScore>
  recommendation?: { key: string; label: string; color: string }
  targetPrice?: { bull: number; base: number; bear: number }
  keyRisks?: string[]
  keyCatalysts?: string[]
  reportMd?: string
  modelUsed?: string
  market?: string
  industry?: string
}

export function validateScoreDocInput(input: ScoreDocInput): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  if (!input.symbol?.trim()) errors.push('symbol 不能为空')
  if (!input.stockName?.trim()) errors.push('stockName 不能为空')
  if (input.composite === undefined || Number.isNaN(input.composite)) errors.push('composite 必须为数字')
  if (input.l3v === undefined || Number.isNaN(input.l3v)) errors.push('l3v 必须为数字')
  if (!input.layers || Object.keys(input.layers).length === 0) errors.push('layers 不能为空')
  return { valid: errors.length === 0, errors }
}

export function buildChangeFromPrev(
  newDoc: Pick<ScoreDocVersion, 'composite' | 'l3v' | 'layers'>,
  prevDoc: ScoreDocVersion,
): NonNullable<ScoreDocVersion['changeFromPrev']> {
  const layerChanges: Record<string, number> = {}
  for (const code of Object.keys(newDoc.layers)) {
    const prevScore = prevDoc.layers[code]?.score ?? 0
    layerChanges[code] = Math.round((newDoc.layers[code]!.score - prevScore) * 100) / 100
  }

  return {
    compositeDelta: Math.round((newDoc.composite - prevDoc.composite) * 100) / 100,
    l3vDelta: Math.round((newDoc.l3v - prevDoc.l3v) * 100) / 100,
    layerChanges,
  }
}

/** 评分文档差异结构(用于历史版本对比面板) */
export interface ScoreDocDiff {
  newerVersion: number
  olderVersion: number
  compositeDelta: number
  l3vDelta: number
  layerChanges: Array<{
    code: string
    oldScore: number
    newScore: number
    delta: number
  }>
  addedLayers: string[]
  removedLayers: string[]
  ratingChanged: boolean
  oldRating: string
  newRating: string
}

/**
 * 计算两个评分文档版本的完整差异(供 ScoreHistoryPanel 等使用)。
 * 与 buildChangeFromPrev 的区别:本函数额外提供新增/删除维度、评级变化信息。
 */
export function buildScoreDocDiff(
  newer: ScoreDocVersion,
  older: ScoreDocVersion,
): ScoreDocDiff {
  const olderCodes = new Set(Object.keys(older.layers))
  const newerCodes = new Set(Object.keys(newer.layers))

  const addedLayers = [...newerCodes].filter((c) => !olderCodes.has(c))
  const removedLayers = [...olderCodes].filter((c) => !newerCodes.has(c))

  const layerChanges: ScoreDocDiff['layerChanges'] = []

  // 新版本中存在的层(含新增)
  for (const code of newerCodes) {
    const oldScore = older.layers[code]?.score ?? 0
    const newScore = newer.layers[code]!.score
    layerChanges.push({
      code,
      oldScore,
      newScore,
      delta: Math.round((newScore - oldScore) * 100) / 100,
    })
  }

  // 已删除的层(newScore=0,delta=-oldScore)
  for (const code of removedLayers) {
    const oldScore = older.layers[code]!.score
    layerChanges.push({
      code,
      oldScore,
      newScore: 0,
      delta: Math.round(-oldScore * 100) / 100,
    })
  }

  const oldRating = older.recommendation?.label ?? ''
  const newRating = newer.recommendation?.label ?? ''

  return {
    newerVersion: newer.version,
    olderVersion: older.version,
    compositeDelta: Math.round((newer.composite - older.composite) * 100) / 100,
    l3vDelta: Math.round((newer.l3v - older.l3v) * 100) / 100,
    layerChanges,
    addedLayers,
    removedLayers,
    ratingChanged: oldRating !== newRating,
    oldRating,
    newRating,
  }
}

export async function getNextVersion(symbol: string): Promise<number> {
  const versions = await dataLayer.scoreDocs.listBySymbol(symbol)
  if (versions.length === 0) return 1
  return Math.max(...versions.map((d) => d.version)) + 1
}

export async function saveScoreDoc(input: ScoreDocInput): Promise<DataLayerResult<ScoreDocVersion>> {
  const validation = validateScoreDocInput(input)
  if (!validation.valid) {
    return { success: false, error: validation.errors.join('; ') }
  }

  try {
    const version = await getNextVersion(input.symbol)
    const scoreDate = input.scoreDate ?? new Date().toISOString().slice(0, 10)

    const prevDoc = version > 1 ? await getVersion(input.symbol, version - 1) : undefined

    const baseDoc: Omit<ScoreDocVersion, 'docId' | 'changeFromPrev'> & {
      changeFromPrev?: ScoreDocVersion['changeFromPrev']
    } = {
      symbol: input.symbol,
      stockName: input.stockName,
      version,
      scoreDate,
      composite: input.composite,
      l3v: input.l3v,
      layers: input.layers,
      recommendation: input.recommendation ?? { key: 'hold', label: '观望', color: COLOR_TOKENS.neutral.hex },
      targetPrice: input.targetPrice ?? { bull: 0, base: 0, bear: 0 },
      keyRisks: input.keyRisks ?? [],
      keyCatalysts: input.keyCatalysts ?? [],
      reportMd: input.reportMd ?? buildReportMarkdown({
        ...input,
        version,
        scoreDate,
        docId: '',
        createdAt: new Date().toISOString(),
        recommendation: input.recommendation ?? { key: 'hold', label: '观望', color: COLOR_TOKENS.neutral.hex },
        targetPrice: input.targetPrice ?? { bull: 0, base: 0, bear: 0 },
        keyRisks: input.keyRisks ?? [],
        keyCatalysts: input.keyCatalysts ?? [],
        modelUsed: input.modelUsed ?? 'v6-score-doc',
        market: input.market ?? '',
        industry: input.industry ?? '',
      } as ScoreDocVersion),
      modelUsed: input.modelUsed ?? 'v6-score-doc',
      market: input.market ?? '',
      industry: input.industry ?? '',
      createdAt: new Date().toISOString(),
    }

    const changeFromPrev = prevDoc ? buildChangeFromPrev(baseDoc, prevDoc) : undefined

    const doc: ScoreDocVersion = {
      ...baseDoc,
      docId: makeScoreDocId(input.symbol, version),
      changeFromPrev,
    }

    // 如果没有外部传入 reportMd，使用自动生成的（已包含差异）
    if (!input.reportMd) {
      doc.reportMd = buildReportMarkdown(doc)
    }

    const result = await dataLayer.scoreDocs.save(doc)
    if (!result.success) {
      return { success: false, error: result.error }
    }
    return { success: true, data: doc }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('保存评分文档失败', { symbol: input.symbol, error: message })
    return { success: false, error: message }
  }
}

export async function getVersion(
  symbol: string,
  version: number,
): Promise<ScoreDocVersion | undefined> {
  const versions = await dataLayer.scoreDocs.listBySymbol(symbol)
  return versions.find((d) => d.version === version)
}

export async function getRecentVersions(
  symbol: string,
  limit = 4,
): Promise<DataLayerResult<ScoreDocVersion[]>> {
  try {
    const versions = await dataLayer.scoreDocs.listBySymbol(symbol)
    const sorted = versions.sort((a, b) => b.version - a.version).slice(0, limit)
    return { success: true, data: sorted }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: message }
  }
}

export async function exportSymbolMd(symbol: string): Promise<DataLayerResult<string>> {
  try {
    const versions = await dataLayer.scoreDocs.listBySymbol(symbol)
    if (versions.length === 0) return { success: true, data: '' }

    const sorted = versions.sort((a, b) => b.version - a.version)
    const combined = sorted.map((d) => d.reportMd).join('\n\n---\n\n')
    return { success: true, data: combined }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: message }
  }
}

export async function getFileLibraryStats(): Promise<DataLayerResult<FileLibraryStats>> {
  try {
    const all = await dataLayer.scoreDocs.list()
    const symbols = new Set(all.map((d) => d.symbol))
    const totalComposite = all.reduce((sum, d) => sum + d.composite, 0)
    const coreStocks = all.filter((d) => d.composite >= DEFAULT_THRESHOLDS.rating.strongBuy).length

    return {
      success: true,
      data: {
        totalDocs: all.length,
        totalStocks: symbols.size,
        totalVersions: all.length,
        avgComposite: all.length > 0 ? Math.round((totalComposite / all.length) * 100) / 100 : 0,
        coreStocks,
        lastUpdate: all.length > 0 ? all.sort((a, b) => b.version - a.version)[0]!.createdAt : '',
      },
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: message }
  }
}

export async function listScoreDocsBySymbol(
  symbol: string,
): Promise<DataLayerResult<ScoreDocVersion[]>> {
  try {
    const list = await dataLayer.scoreDocs.listBySymbol(symbol)
    return { success: true, data: list }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: message }
  }
}

export function buildScoreComparison(
  leftDoc: ScoreDocVersion,
  rightDoc: ScoreDocVersion,
  mode: ScoreComparisonMode,
): ScoreComparisonResult {
  const leftCodes = new Set(Object.keys(leftDoc.layers))
  const rightCodes = new Set(Object.keys(rightDoc.layers))

  const addedDimensions = [...rightCodes].filter((c) => !leftCodes.has(c))
  const removedDimensions = [...leftCodes].filter((c) => !rightCodes.has(c))

  const dimensions: DimensionComparisonItem[] = []

  for (const code of rightCodes) {
    const leftLayer = leftDoc.layers[code]
    const rightLayer = rightDoc.layers[code]!
    const leftScore = leftLayer?.score ?? 0
    const rightScore = rightLayer.score
    dimensions.push({
      code,
      leftScore,
      rightScore,
      delta: Math.round((rightScore - leftScore) * 100) / 100,
      leftWeight: leftLayer?.weight ?? 0,
      rightWeight: rightLayer.weight,
      leftReason: leftLayer?.reason ?? '',
      rightReason: rightLayer.reason,
    })
  }

  for (const code of removedDimensions) {
    const leftLayer = leftDoc.layers[code]!
    dimensions.push({
      code,
      leftScore: leftLayer.score,
      rightScore: 0,
      delta: Math.round(-leftLayer.score * 100) / 100,
      leftWeight: leftLayer.weight,
      rightWeight: 0,
      leftReason: leftLayer.reason,
      rightReason: '',
    })
  }

  const sortedByDeltaAbs = [...dimensions].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
  const topRisingDimensions = sortedByDeltaAbs.filter((d) => d.delta > 0).slice(0, 5)
  const topFallingDimensions = sortedByDeltaAbs.filter((d) => d.delta < 0).slice(0, 5)

  const oldRating = leftDoc.recommendation?.label ?? ''
  const newRating = rightDoc.recommendation?.label ?? ''

  return {
    mode,
    left: {
      symbol: leftDoc.symbol,
      stockName: leftDoc.stockName,
      version: leftDoc.version,
      scoreDate: leftDoc.scoreDate,
      composite: leftDoc.composite,
      l3v: leftDoc.l3v,
      recommendation: leftDoc.recommendation,
      modelUsed: leftDoc.modelUsed,
    },
    right: {
      symbol: rightDoc.symbol,
      stockName: rightDoc.stockName,
      version: rightDoc.version,
      scoreDate: rightDoc.scoreDate,
      composite: rightDoc.composite,
      l3v: rightDoc.l3v,
      recommendation: rightDoc.recommendation,
      modelUsed: rightDoc.modelUsed,
    },
    compositeDelta: Math.round((rightDoc.composite - leftDoc.composite) * 100) / 100,
    l3vDelta: Math.round((rightDoc.l3v - leftDoc.l3v) * 100) / 100,
    dimensions,
    ratingChanged: oldRating !== newRating,
    addedDimensions,
    removedDimensions,
    topRisingDimensions,
    topFallingDimensions,
  }
}

export function buildScoreTimeline(versions: ScoreDocVersion[]): ScoreComparisonTimelineItem[] {
  const sorted = [...versions].sort((a, b) => a.version - b.version)
  return sorted.map((v, i) => ({
    version: v.version,
    scoreDate: v.scoreDate,
    composite: v.composite,
    changeFromPrev: i === 0 ? null : v.composite - sorted[i - 1]!.composite,
  }))
}

export async function compareTwoVersions(
  symbol: string,
  leftVersion: number,
  rightVersion: number,
): Promise<DataLayerResult<ScoreComparisonResult>> {
  try {
    const versions = await dataLayer.scoreDocs.listBySymbol(symbol)
    const leftDoc = versions.find((v) => v.version === leftVersion)
    const rightDoc = versions.find((v) => v.version === rightVersion)

    if (!leftDoc) {
      return { success: false, error: `未找到版本 V${leftVersion}` }
    }
    if (!rightDoc) {
      return { success: false, error: `未找到版本 V${rightVersion}` }
    }

    const result = buildScoreComparison(leftDoc, rightDoc, 'same-stock-versions')
    return { success: true, data: result }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('比对评分版本失败', { symbol, leftVersion, rightVersion, error: message })
    return { success: false, error: message }
  }
}

export async function compareTwoStocksLatest(
  leftSymbol: string,
  rightSymbol: string,
): Promise<DataLayerResult<ScoreComparisonResult>> {
  try {
    const [leftVersions, rightVersions] = await Promise.all([
      dataLayer.scoreDocs.listBySymbol(leftSymbol),
      dataLayer.scoreDocs.listBySymbol(rightSymbol),
    ])

    const leftSorted = [...leftVersions].sort((a, b) => b.version - a.version)
    const rightSorted = [...rightVersions].sort((a, b) => b.version - a.version)

    const leftDoc = leftSorted[0]
    const rightDoc = rightSorted[0]

    if (!leftDoc) {
      return { success: false, error: `股票 ${leftSymbol} 暂无评分文档` }
    }
    if (!rightDoc) {
      return { success: false, error: `股票 ${rightSymbol} 暂无评分文档` }
    }

    const result = buildScoreComparison(leftDoc, rightDoc, 'cross-stock-latest')
    return { success: true, data: result }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('比对两只股票最新评分失败', { leftSymbol, rightSymbol, error: message })
    return { success: false, error: message }
  }
}

export async function getScoreTimeline(
  symbol: string,
): Promise<DataLayerResult<ScoreComparisonTimelineItem[]>> {
  try {
    const versions = await dataLayer.scoreDocs.listBySymbol(symbol)
    const timeline = buildScoreTimeline(versions)
    return { success: true, data: timeline }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('获取评分时间轴失败', { symbol, error: message })
    return { success: false, error: message }
  }
}
