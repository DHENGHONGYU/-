/**
 * @test_id V9-TEST-UT-111
 * @covers_docs []
 */
import { describe, it, expect } from 'vitest'
import { z } from 'zod'

describe('数据 Schema 快照测试', () => {
  const StockSchema = z.object({
    code: z.string().min(1),
    name: z.string().min(1),
    price: z.number().positive(),
    changePercent: z.number(),
    volume: z.number().nonnegative(),
    marketCap: z.number().nonnegative().optional(),
  })

  it('应该匹配 Stock Schema 验证有效数据的快照', () => {
    const validStock = {
      code: '600519',
      name: '贵州茅台',
      price: 1688.0,
      changePercent: 1.25,
      volume: 100000,
      marketCap: 2100000000000,
    }

    const result = StockSchema.safeParse(validStock)
    expect(result).toMatchSnapshot({
      success: true,
    })
  })

  it('应该匹配 Stock Schema 验证无效数据的快照', () => {
    const invalidStock = {
      code: '',
      name: '',
      price: -100,
      changePercent: 'invalid',
      volume: 'high',
    }

    const result = StockSchema.safeParse(invalidStock)
    expect(result.success).toBe(false)
    expect(result.error?.issues).toMatchSnapshot()
  })

  it('应该匹配质量门禁配置的快照', () => {
    const qualityGateConfig = {
      thresholds: {
        minCoverage: 0.8,
        minFreshness: 60,
        maxBrokenLinks: 0,
        minContractMatch: 1.0,
      },
      checks: [
        { name: 'lint', tier: 'P0' as const, blocking: true },
        { name: 'typecheck', tier: 'P0' as const, blocking: true },
        { name: 'test', tier: 'P0' as const, blocking: true },
        { name: 'audit:layers', tier: 'P1' as const, blocking: false },
        { name: 'audit:dependencies', tier: 'P1' as const, blocking: false },
      ],
    }

    expect(qualityGateConfig).toMatchSnapshot()
  })
})