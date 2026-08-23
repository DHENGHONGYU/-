/**
 * @test_id V9-TEST-UT-COLLECTIONPIPELINE-CONTRACT
 * @covers collectionPipeline.ts — 纯函数契约与维度接线完整性
 *
 * 验证目标（P0-3 补单元测试）：
 *   - resolveDimensionMode：16 维度 → mode 映射 + 未知维度兜底
 *   - NON_QUOTE_MODES / DIMENSION_TO_MODE 接线一致性（防「已注册未接线」漂移）
 *   - resolveQuoteChain / resolveKlineChain：优先级排序 + mock 门禁（假绿灯修复）
 *   - getDimensionConfig：按 code 查找
 *   - createDefaultCollectionConfig：默认配置完整性
 *
 * 设计要点：仅测纯函数与常量契约，不 mock 网络/DB，保证快速稳定。
 */

import { describe, it, expect } from 'vitest'
import {
  resolveDimensionMode,
  resolveQuoteChain,
  resolveKlineChain,
  getDimensionConfig,
  createDefaultCollectionConfig,
  NON_QUOTE_MODES,
  DIMENSION_TO_ACTION,
} from '@/services/data-collector/collectionPipeline'
import { DIMENSION_COUNT, DEFAULT_DIMENSIONS } from '@/config/collectConfig'
import type {
  CollectionConfig,
  DimensionPipelineConfig,
  SourcePriorityItem,
  QuoteDataSourceId,
} from '@/types/modules/collection.types'

// ============================================================
// 夹具：构造最小可用的 DimensionPipelineConfig
// ============================================================

function makeDim(overrides: Partial<DimensionPipelineConfig> = {}): DimensionPipelineConfig {
  const base: DimensionPipelineConfig = {
    code: '01',
    name: '基本信息',
    enabled: true,
    frequency: 'daily',
    batchSize: 50,
    sources: ['akshare'],
    cacheTtl: 1440,
    storageType: 'full',
    fields: ['name'],
    importance: 'low',
    sourcePriority: [],
    concurrency: 1,
    retryPolicy: { maxRetries: 2, backoffMultiplier: 2, initialDelayMs: 500 },
    timeoutPolicy: { requestTimeoutMs: 5000, dimensionTimeoutMs: 30000 },
    fallbackPolicy: { allowFallback: true, allowMockFallback: true, alertFailureRate: 80 },
  }
  return { ...base, ...overrides }
}

function priorityItems(items: Array<[QuoteDataSourceId, boolean]>): SourcePriorityItem[] {
  return items.map(([id, enabled], idx) => ({ id, priority: idx + 1, enabled }))
}

// ============================================================
// resolveDimensionMode
// ============================================================

describe('resolveDimensionMode — 维度模式解析', () => {
  it.each([
    ['01', 'quote'],
    ['02', 'kline'],
    ['03', 'chip'],
    ['04', 'news'],
    ['05', 'news'],
    ['06', 'competitor'],
    ['07', 'index'],
    ['08', 'research'],
    ['09', 'financial'],
    ['10', 'sector'],
    ['11', 'technical'],
    ['12', 'fund_flow'],
    ['13', 'institutional'],
    ['14', 'valuation'],
    ['15', 'dividend'],
    ['16', 'consensus'],
  ] as const)('维度 %s 解析为 mode=%s', (code, expectedMode) => {
    expect(resolveDimensionMode(code)).toBe(expectedMode)
  })

  it('未知维度返回 unsupported', () => {
    expect(resolveDimensionMode('99')).toBe('unsupported')
    expect(resolveDimensionMode('')).toBe('unsupported')
  })

  it('DIMENSION_COUNT 与维度定义数量一致（防契约漂移）', () => {
    expect(DIMENSION_COUNT).toBe(DEFAULT_DIMENSIONS.length)
  })
})

// ============================================================
// NON_QUOTE_MODES / DIMENSION_TO_ACTION 接线一致性
// ============================================================

describe('维度接线完整性（防「已注册未接线」漂移）', () => {
  it('所有非行情维度码（03-08、10-16）均有 DIMENSION_TO_ACTION 写入映射', () => {
    // 行情 01/02、财务 09 走专用模式，不在 DIMENSION_TO_ACTION 中
    const nonQuoteDimCodes = DEFAULT_DIMENSIONS
      .map((d) => d.code)
      .filter((code) => !['01', '02', '09'].includes(code))
    expect(nonQuoteDimCodes.length).toBeGreaterThan(0)
    for (const code of nonQuoteDimCodes) {
      expect(DIMENSION_TO_ACTION[code], `维度 ${code} 缺少 DIMENSION_TO_ACTION 映射`).toBeTruthy()
    }
  })

  it('NON_QUOTE_MODES 不包含 quote/kline/financial', () => {
    expect(NON_QUOTE_MODES.has('quote')).toBe(false)
    expect(NON_QUOTE_MODES.has('kline')).toBe(false)
    expect(NON_QUOTE_MODES.has('financial')).toBe(false)
  })

  it('NON_QUOTE_MODES 覆盖全部非行情维度的 mode', () => {
    const expectedNonQuoteModes = [
      'chip', 'news', 'competitor', 'index', 'research',
      'sector', 'technical', 'fund_flow', 'institutional', 'valuation',
      'dividend', 'consensus',
    ]
    for (const mode of expectedNonQuoteModes) {
      expect(NON_QUOTE_MODES.has(mode as never), `NON_QUOTE_MODES 缺少 ${mode}`).toBe(true)
    }
  })
})

// ============================================================
// resolveQuoteChain — 行情源链解析
// ============================================================

describe('resolveQuoteChain — 行情源链解析', () => {
  it('使用显式 sourcePriority 时按 priority 升序返回启用项', () => {
    const dim = makeDim({
      sourcePriority: priorityItems([
        ['tencent', true],
        ['sina', true],
        ['mock', true],
      ]),
    })
    expect(resolveQuoteChain(dim)).toEqual(['tencent', 'sina', 'mock'])
  })

  it('禁用（enabled=false）的源被过滤', () => {
    const dim = makeDim({
      sourcePriority: priorityItems([
        ['tencent', true],
        ['sina', false],
        ['mock', true],
      ]),
    })
    expect(resolveQuoteChain(dim)).toEqual(['tencent', 'mock'])
  })

  it('priority 乱序时按 priority 重排', () => {
    const items: SourcePriorityItem[] = [
      { id: 'sina', priority: 2, enabled: true },
      { id: 'tencent', priority: 1, enabled: true },
    ]
    const dim = makeDim({ sourcePriority: items })
    expect(resolveQuoteChain(dim)).toEqual(['tencent', 'sina'])
  })

  it('allowMockFallback=false 时剔除 mock（假绿灯修复）', () => {
    const dim = makeDim({
      sourcePriority: priorityItems([
        ['tencent', true],
        ['mock', true],
      ]),
      fallbackPolicy: { allowFallback: true, allowMockFallback: false, alertFailureRate: 80 },
    })
    expect(resolveQuoteChain(dim)).toEqual(['tencent'])
    expect(resolveQuoteChain(dim)).not.toContain('mock')
  })

  it('未配置 fallbackPolicy 时默认保留 mock（向后兼容）', () => {
    const dim = makeDim({
      sourcePriority: priorityItems([
        ['tencent', true],
        ['mock', true],
      ]),
      fallbackPolicy: undefined as unknown as DimensionPipelineConfig['fallbackPolicy'],
    })
    expect(resolveQuoteChain(dim)).toContain('mock')
  })

  it('sourcePriority 为空时从 sources 默认构建链', () => {
    const dim = makeDim({ sourcePriority: [], sources: ['akshare'] })
    const chain = resolveQuoteChain(dim)
    expect(chain.length).toBeGreaterThan(0)
    // akshare 映射链以真实源开头
    expect(chain[0]).not.toBe('mock')
  })
})

// ============================================================
// resolveKlineChain — K 线源链解析
// ============================================================

describe('resolveKlineChain — K 线源链解析', () => {
  it('剔除 mock 后返回真实源，允许 mock 时末尾追加', () => {
    const dim = makeDim({
      sourcePriority: priorityItems([
        ['tencent', true],
        ['sina', true],
        ['mock', true],
      ]),
    })
    expect(resolveKlineChain(dim)).toEqual(['tencent', 'sina', 'mock'])
  })

  it('allowMockFallback=false 时 K 线链不含 mock', () => {
    const dim = makeDim({
      sourcePriority: priorityItems([
        ['tencent', true],
        ['sina', true],
        ['mock', true],
      ]),
      fallbackPolicy: { allowFallback: true, allowMockFallback: false, alertFailureRate: 80 },
    })
    expect(resolveKlineChain(dim)).toEqual(['tencent', 'sina'])
  })

  it('无真实源时按 allowMockFallback 返回 [mock] 或 []', () => {
    const mockOnly = makeDim({ sourcePriority: priorityItems([['mock', true]]) })
    expect(resolveKlineChain(mockOnly)).toEqual(['mock'])

    const noMockAllowed = makeDim({
      sourcePriority: priorityItems([['mock', true]]),
      fallbackPolicy: { allowFallback: true, allowMockFallback: false, alertFailureRate: 80 },
    })
    expect(resolveKlineChain(noMockAllowed)).toEqual([])
  })
})

// ============================================================
// getDimensionConfig
// ============================================================

describe('getDimensionConfig — 按 code 查找维度', () => {
  const config: CollectionConfig = {
    ...createDefaultCollectionConfig(),
    dimensions: [
      makeDim({ code: '01', name: '基本信息' }),
      makeDim({ code: '09', name: '财务数据' }),
    ],
  }

  it('命中返回对应维度', () => {
    expect(getDimensionConfig(config, '01')?.name).toBe('基本信息')
    expect(getDimensionConfig(config, '09')?.name).toBe('财务数据')
  })

  it('未命中返回 undefined', () => {
    expect(getDimensionConfig(config, '99')).toBeUndefined()
  })
})

// ============================================================
// createDefaultCollectionConfig
// ============================================================

describe('createDefaultCollectionConfig — 默认配置完整性', () => {
  const config = createDefaultCollectionConfig()

  it('包含版本与全局策略', () => {
    expect(config.version).toBeTruthy()
    expect(config.global.maxSymbols).toBeGreaterThan(0)
    expect(config.global.defaultBatchSize).toBeGreaterThan(0)
    expect(config.global.defaultTimeoutMs).toBeGreaterThan(0)
    expect(config.global.defaultRetries).toBeGreaterThanOrEqual(0)
  })

  it('包含限流参数', () => {
    expect(config.global.rateLimitPerMinute).toBeGreaterThan(0)
    expect(config.global.rateLimitPerHour).toBeGreaterThan(0)
    expect(config.global.rateLimitPerDay).toBeGreaterThan(0)
  })

  it('historyDays 为正整数（K 线回溯窗口）', () => {
    expect(config.historyDays).toBeGreaterThan(0)
  })
})
