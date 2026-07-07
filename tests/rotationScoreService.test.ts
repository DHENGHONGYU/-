import { describe, expect, it, beforeEach } from 'vitest'
import { db } from '@/data/db'
import { dataBridge } from '@/core/databridge'
import { STORE_NAME } from '@/config/dbConfig'
import {
  calculateResonance,
  calculateSectorScore,
  determineDeclineNature,
  getAlertLevel,
  getScoreBucket,
  getSignalGrade,
  saveDefaultRotationScores,
  saveRotationScore,
  getRotationScores,
} from '@/services/analysis/rotationScoreService'

describe('rotationScoreService', () => {
  beforeEach(async () => {
    await db.init()
    await db.reset()
    dataBridge.invalidateCache(STORE_NAME.rotationScores)
  })

  it('should calculate sector score from sub scores', () => {
    const scores = {
      F1A: 15, F1B: 8, F1C: 7, F1D: 5, F1E: 5,
      F2A: 10, F2B: 10, F2C: 5, F2D: 5,
      F3A: 8, F3B: 4, F3C: 3,
      F4A: 5, F4B: 5,
      F5A: 3, F5B: 2,
    }
    const result = calculateSectorScore(scores)
    expect(result.f1).toBe(40)
    expect(result.f2).toBe(30)
    expect(result.f3).toBe(15)
    expect(result.f4).toBe(10)
    expect(result.f5).toBe(5)
    expect(result.total).toBe(100)
  })

  it('should clamp f5 to non-negative', () => {
    const scores = { F5A: -2, F5B: 1 }
    const result = calculateSectorScore(scores)
    expect(result.f5).toBe(0)
  })

  it('should calculate resonance with double resonance bonus', () => {
    const resonance = calculateResonance(85, 35, 25)
    expect(resonance).toBe(10)
  })

  it('should return correct signal grade', () => {
    expect(getSignalGrade(9).label).toBe('强信号')
    expect(getSignalGrade(5).label).toBe('中信号')
    expect(getSignalGrade(0).label).toBe('无信号')
  })

  it('should return correct score bucket', () => {
    expect(getScoreBucket(80).label).toBe('聚焦主升区')
    expect(getScoreBucket(60).label).toBe('埋伏建仓区')
    expect(getScoreBucket(40).label).toBe('回避区')
  })

  it('should determine alert level', () => {
    expect(getAlertLevel(60, 20).name).toBe('常态锁仓')
    expect(getAlertLevel(40, -1).name).toBe('橙色降仓')
    expect(getAlertLevel(30, -5).name).toBe('红色清仓')
  })

  it('should determine decline nature', () => {
    expect(determineDeclineNature('恶化', '下降', 60, 10).type).toBe('杀逻辑')
    expect(determineDeclineNature('稳定', '稳定', 40, -1).type).toBe('杀业绩')
    expect(determineDeclineNature('稳定', '稳定', 35, 10).type).toBe('杀估值')
  })

  it('should save rotation score', async () => {
    const result = await saveRotationScore({
      sectorCode: 'AI',
      sectorName: '人工智能',
      scoreDate: '2026-06-24',
      subScores: {
        F1A: 15, F1B: 8, F1C: 7, F1D: 5, F1E: 5,
        F2A: 10, F2B: 10, F2C: 5, F2D: 5,
        F3A: 8, F3B: 4, F3C: 3,
        F4A: 5, F4B: 5,
        F5A: 3, F5B: 2,
      },
    })

    expect(result.success).toBe(true)
    expect(result.data?.total).toBe(100)
    expect(result.data?.resonance).toBe(10)
  })

  it('should reject invalid sub scores', async () => {
    const result = await saveRotationScore({
      sectorCode: 'AI',
      sectorName: '人工智能',
      scoreDate: '2026-06-24',
      subScores: { F1A: 999 },
    })

    expect(result.success).toBe(false)
  })

  it('should save default rotation scores for all sector definitions', async () => {
    const result = await saveDefaultRotationScores('2026-06-24')
    expect(result.success).toBe(true)
    expect(result.data?.length).toBeGreaterThan(0)

    const list = await getRotationScores()
    expect(list.success).toBe(true)
    expect(list.data?.length).toBe(result.data?.length)
  })
})
