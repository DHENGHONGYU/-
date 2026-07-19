/**
 * @test_id V9-TEST-UT-051
 * @covers_docs [V9-DOC-DATA-013, V9-DOC-DATA-051, V9-DOC-DATA-042, V9-DOC-BACK-037]
 */
import { describe, expect, it, beforeEach } from 'vitest'
import { db } from '@/data/db'
import { dataBridge } from '@/core/databridge'
import { STORE_NAME } from '@/config/dbConfig'
import type { ScoreDocVersion } from '@/data/types'
import {
  buildChangeFromPrev,
  buildReportMarkdown,
  exportSymbolMd,
  getFileLibraryStats,
  getRecentVersions,
  getVersion,
  listScoreDocsBySymbol,
  makeScoreDocId,
  saveScoreDoc,
  validateScoreDocInput,
} from '@/services/analysis/scoreDocService'

describe('scoreDocService', () => {
  beforeEach(async () => {
    await db.init()
    await db.reset()
    dataBridge.invalidateCache(STORE_NAME.scoreDocs)
  })

  it('应该验证 required fields', () => {
    const result = validateScoreDocInput({
      symbol: '',
      stockName: '',
      composite: NaN,
      l3v: NaN,
      layers: {},
    })
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('应该生成 doc id with version', () => {
    const id = makeScoreDocId('000001.SZ', 3)
    expect(id.startsWith('000001.SZ__V3__')).toBe(true)
  })

  it('应该保存 first score doc with version 1', async () => {
    const result = await saveScoreDoc({
      symbol: '000001.SZ',
      stockName: '平安银行',
      composite: 4.2,
      l3v: 3.5,
      layers: {
        L1: { score: 4.0, reason: '景气', weight: 0.2 },
        L2: { score: 3.5, reason: '资金', weight: 0.15 },
      },
    })

    expect(result.success).toBe(true)
    expect(result.data?.version).toBe(1)
    expect(result.data?.docId).toContain('000001.SZ__V1__')
    expect(result.data?.changeFromPrev).toBeUndefined()
  })

  it('应该auto increment version and compute change from previous', async () => {
    await saveScoreDoc({
      symbol: '000001.SZ',
      stockName: '平安银行',
      composite: 4.0,
      l3v: 3.5,
      layers: { L1: { score: 4.0, reason: '景气', weight: 0.2 } },
    })

    const result = await saveScoreDoc({
      symbol: '000001.SZ',
      stockName: '平安银行',
      composite: 4.5,
      l3v: 3.8,
      layers: { L1: { score: 4.5, reason: '景气上行', weight: 0.2 } },
    })

    expect(result.success).toBe(true)
    expect(result.data?.version).toBe(2)
    expect(result.data?.changeFromPrev).toBeDefined()
    expect(result.data?.changeFromPrev?.compositeDelta).toBe(0.5)
    expect(result.data?.changeFromPrev?.l3vDelta).toBe(0.3)
    expect(result.data?.changeFromPrev?.layerChanges['L1']).toBe(0.5)
  })

  it('应该build change from previous', () => {
    const prev: ScoreDocVersion = {
      docId: 'x',
      symbol: '000001.SZ',
      stockName: '平安银行',
      version: 1,
      scoreDate: '2026-06-24',
      composite: 4.0,
      l3v: 3.5,
      layers: { L1: { score: 4.0, reason: '', weight: 0.2 } },
      recommendation: { key: 'hold', label: '观望', color: '#9ca3af' },
      targetPrice: { bull: 0, base: 0, bear: 0 },
      keyRisks: [],
      keyCatalysts: [],
      reportMd: '',
      modelUsed: 'v6',
      market: 'SZ',
      createdAt: '',
    }

    const change = buildChangeFromPrev(
      {
        composite: 4.3,
        l3v: 3.6,
        layers: { L1: { score: 4.2, reason: '', weight: 0.2 } },
      },
      prev,
    )

    expect(change.compositeDelta).toBe(0.3)
    expect(change.l3vDelta).toBe(0.1)
    expect(change.layerChanges['L1']).toBe(0.2)
  })

  it('应该生成 markdown report', () => {
    const doc: ScoreDocVersion = {
      docId: 'x',
      symbol: '000001.SZ',
      stockName: '平安银行',
      version: 1,
      scoreDate: '2026-06-24',
      composite: 4.2,
      l3v: 3.5,
      layers: { L1: { score: 4.0, reason: '景气', weight: 0.2 } },
      recommendation: { key: 'buy', label: '买入', color: '#10b981' },
      targetPrice: { bull: 15, base: 12, bear: 10 },
      keyRisks: ['风险1'],
      keyCatalysts: ['催化1'],
      reportMd: '',
      modelUsed: 'v6',
      market: 'SZ',
      createdAt: '',
    }

    const md = buildReportMarkdown(doc)
    expect(md).toContain('平安银行')
    expect(md).toContain('综合评分：4.20')
    expect(md).toContain('投资建议：买入')
    expect(md).toContain('目标价')
    expect(md).toContain('风险1')
    expect(md).toContain('催化1')
  })

  it('应该检索 recent versions', async () => {
    for (let i = 1; i <= 5; i++) {
      await saveScoreDoc({
        symbol: '000001.SZ',
        stockName: '平安银行',
        composite: 4.0 + i * 0.1,
        l3v: 3.5,
        layers: { L1: { score: 4.0, reason: '', weight: 0.2 } },
      })
    }

    const result = await getRecentVersions('000001.SZ', 3)
    expect(result.success).toBe(true)
    expect(result.data?.length).toBe(3)
    expect(result.data?.[0]?.version).toBe(5)
  })

  it('应该export symbol markdown', async () => {
    await saveScoreDoc({
      symbol: '000001.SZ',
      stockName: '平安银行',
      composite: 4.0,
      l3v: 3.5,
      layers: { L1: { score: 4.0, reason: '', weight: 0.2 } },
      reportMd: '# 第一版',
    })
    await saveScoreDoc({
      symbol: '000001.SZ',
      stockName: '平安银行',
      composite: 4.1,
      l3v: 3.5,
      layers: { L1: { score: 4.1, reason: '', weight: 0.2 } },
      reportMd: '# 第二版',
    })

    const result = await exportSymbolMd('000001.SZ')
    expect(result.success).toBe(true)
    expect(result.data).toContain('第一版')
    expect(result.data).toContain('第二版')
  })

  it('应该返回 file library stats', async () => {
    await saveScoreDoc({
      symbol: '000001.SZ',
      stockName: '平安银行',
      composite: 4.2,
      l3v: 3.5,
      layers: { L1: { score: 4.0, reason: '', weight: 0.2 } },
    })
    await saveScoreDoc({
      symbol: '000002.SZ',
      stockName: '万科A',
      composite: 3.8,
      l3v: 3.0,
      layers: { L1: { score: 3.8, reason: '', weight: 0.2 } },
    })

    const result = await getFileLibraryStats()
    expect(result.success).toBe(true)
    expect(result.data?.totalDocs).toBe(2)
    expect(result.data?.totalStocks).toBe(2)
    expect(result.data?.coreStocks).toBe(1)
  })

  it('应该list score docs by symbol', async () => {
    await saveScoreDoc({
      symbol: '000001.SZ',
      stockName: '平安银行',
      composite: 4.0,
      l3v: 3.5,
      layers: { L1: { score: 4.0, reason: '', weight: 0.2 } },
    })

    const result = await listScoreDocsBySymbol('000001.SZ')
    expect(result.success).toBe(true)
    expect(result.data?.length).toBe(1)
  })

  it('应该get specific version', async () => {
    await saveScoreDoc({
      symbol: '000001.SZ',
      stockName: '平安银行',
      composite: 4.0,
      l3v: 3.5,
      layers: { L1: { score: 4.0, reason: '', weight: 0.2 } },
    })
    await saveScoreDoc({
      symbol: '000001.SZ',
      stockName: '平安银行',
      composite: 4.1,
      l3v: 3.5,
      layers: { L1: { score: 4.1, reason: '', weight: 0.2 } },
    })

    const doc = await getVersion('000001.SZ', 2)
    expect(doc?.version).toBe(2)
  })
})
