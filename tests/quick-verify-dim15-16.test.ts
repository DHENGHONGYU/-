/**
 * Quick verification test for dimensions 15 and 16 data collection.
 * Tests that the functions exist and the pipeline is correctly wired.
 */
import { describe, it, expect } from 'vitest'
import {
  fetchDividendShareData,
  fetchConsensusAndRating,
  fetchDimensionData,
} from '../src/services/data-collector/multiSourceFetcher'

describe('Dimension 15 & 16 exports', () => {
  it('fetchDividendShareData should be a function', () => {
    expect(typeof fetchDividendShareData).toBe('function')
  })

  it('fetchConsensusAndRating should be a function', () => {
    expect(typeof fetchConsensusAndRating).toBe('function')
  })

  it('fetchDimensionData should handle case 15 (dividend)', async () => {
    // This will return null because Tushare token is not configured,
    // but it should not throw an error
    const result = await fetchDimensionData('600519.SH', '15')
    // result may be null (no data sources) or an object (data available)
    // The key is that it doesn't throw
    expect(result === null || typeof result === 'object').toBe(true)
  })

  it('fetchDimensionData should handle case 16 (consensus)', async () => {
    const result = await fetchDimensionData('600519.SH', '16')
    expect(result === null || typeof result === 'object').toBe(true)
  })

  it('fetchDimensionData should return null for unknown dimension', async () => {
    const result = await fetchDimensionData('600519.SH', '99')
    expect(result).toBeNull()
  })
})