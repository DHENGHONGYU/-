import { describe, expect, it, beforeEach } from 'vitest'
import { db } from '@/data/db'
import { dataBridge } from '@/core/databridge'
import { STORE_NAME } from '@/config/dbConfig'
import { SECTOR_DEFINITIONS } from '@/data/sectorDefinitions'
import type { SectorDefinition } from '@/data/types'
import {
  calculateSectorComposite,
  isCoreSector,
  saveAllSectorScores,
  saveSectorScore,
  getSectorScores,
  getCoreSectorScores,
} from '@/services/analysis/sectorScoreService'

describe('sectorScoreService', () => {
  beforeEach(async () => {
    await db.init()
    await db.reset()
    dataBridge.invalidateCache(STORE_NAME.sectorScores)
  })

  it('should calculate composite score from dimensions and weights', () => {
    const definition = SECTOR_DEFINITIONS[0] as SectorDefinition
    const composite = calculateSectorComposite(definition)
    expect(composite).toBeGreaterThan(0)
    expect(composite).toBeLessThanOrEqual(5)
  })

  it('should identify core sector by threshold', () => {
    const highScoreDef = {
      ...SECTOR_DEFINITIONS[0],
      dimensions: { planAlignment: 5, policySupport: 5, usChinaParity: 5 },
    } as SectorDefinition
    expect(isCoreSector(highScoreDef)).toBe(true)

    const lowScoreDef = {
      ...SECTOR_DEFINITIONS[0],
      dimensions: { planAlignment: 1, policySupport: 1, usChinaParity: 1 },
    } as SectorDefinition
    expect(isCoreSector(lowScoreDef)).toBe(false)
  })

  it('should save single sector score', async () => {
    const definition = SECTOR_DEFINITIONS[0] as SectorDefinition
    const result = await saveSectorScore(definition, '2026-06-24')

    expect(result.success).toBe(true)
    expect(result.data?.sectorCode).toBe(definition.code)
    expect(result.data?.composite).toBe(calculateSectorComposite(definition))
  })

  it('should save all sector scores', async () => {
    const result = await saveAllSectorScores('2026-06-24')
    expect(result.success).toBe(true)
    expect(result.data?.length).toBe(SECTOR_DEFINITIONS.length)

    const list = await getSectorScores()
    expect(list.success).toBe(true)
    expect(list.data?.length).toBe(SECTOR_DEFINITIONS.length)
  })

  it('should filter core sectors', async () => {
    await saveAllSectorScores('2026-06-24')
    const result = await getCoreSectorScores()

    expect(result.success).toBe(true)
    expect(result.data?.every((s) => s.isCore)).toBe(true)
  })
})
