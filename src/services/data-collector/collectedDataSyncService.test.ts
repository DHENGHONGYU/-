/**
 * collectedDataSyncService 单元测试
 *
 * 重点覆盖纯函数分支：
 *   - buildSummaryMarkdown（汇总报告生成、成功/失败表格、失败详情）
 *   - extractEnabledDimensionCodes（从 CollectionConfig 提取启用维度）
 *   - toCsv/toJson（内部辅助，通过 buildSummaryMarkdown 间接覆盖）
 *   - hasElectronFs（环境探测）
 *
 * 不覆盖：
 *   - collectSymbolFiles / syncCollectedDataToLocal：依赖 DataBridge+IndexedDB，
 *     需集成测试环境，此处用 mock 规避。
 *
 * @module collectedDataSyncService.test
 */

import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  buildSummaryMarkdown,
  extractEnabledDimensionCodes,
  hasElectronFs,
  type BatchMetadata,
  type SymbolMetadata,
} from '@/services/data-collector/collectedDataSyncService'
import { createDefaultCollectionConfig } from '@/services/data-collector/collectionPipeline'
import type { CollectionConfig, DimensionPipelineConfig } from '@/types/modules/collection.types'

// ============================================================
// Fixtures
// ============================================================

function makeBatchMeta(overrides: Partial<BatchMetadata> = {}): BatchMetadata {
  return {
    batchId: 'pool-collect-1700000000000',
    parentTaskId: 'pool-collect-1700000000000',
    startedAt: 1_700_000_000_000,
    completedAt: 1_700_000_060_000,
    symbols: ['000001.SZ', '600000.SH'],
    dimensions: ['01', '02', '05', '09'],
    totalTraces: 8,
    successTraces: 7,
    failedTraces: 1,
    exportedAt: 1_700_000_070_000,
    version: '1.0.0',
    ...overrides,
  }
}

function makeSymbolMetas(): SymbolMetadata[] {
  return [
    {
      symbol: '000001.SZ',
      name: '平安银行',
      industry: '银行',
      dimensions: ['01', '02', '05', '09'],
      traces: [
        { dimensionCode: '01', success: true, source: 'akshare', latencyMs: 120 },
        { dimensionCode: '02', success: true, source: 'akshare', latencyMs: 340 },
        { dimensionCode: '05', success: true, source: 'crawler', latencyMs: 510 },
        { dimensionCode: '09', success: true, source: 'fetcher', latencyMs: 220 },
      ],
      exportedAt: 1_700_000_070_000,
    },
    {
      symbol: '600000.SH',
      name: '浦发银行',
      industry: '银行',
      dimensions: ['01', '02', '05', '09'],
      traces: [
        { dimensionCode: '01', success: true, source: 'akshare', latencyMs: 115 },
        { dimensionCode: '02', success: true, source: 'tencent', latencyMs: 290 },
        { dimensionCode: '05', success: false, source: undefined, latencyMs: 5000, error: 'timeout: source crawler circuit-open' },
        { dimensionCode: '09', success: true, source: 'fetcher', latencyMs: 210 },
      ],
      exportedAt: 1_700_000_071_000,
    },
  ]
}

function makeDimConfig(code: string, name: string, enabled: boolean): DimensionPipelineConfig {
  return {
    code,
    name,
    enabled,
    frequency: 'daily',
    batchSize: 50,
    sources: [],
    cacheTtl: 1440,
    storageType: 'full',
    fields: [],
    importance: 'medium',
    sourcePriority: [],
    concurrency: 5,
    retryPolicy: { maxRetries: 2, backoffMultiplier: 1, initialDelayMs: 1000 },
    timeoutPolicy: { requestTimeoutMs: 5000, dimensionTimeoutMs: 10000 },
    fallbackPolicy: { allowFallback: false, allowMockFallback: false, alertFailureRate: 0 },
  }
}

function makeConfig(enabledCodes: string[]): CollectionConfig {
  const cfg = createDefaultCollectionConfig()
  cfg.dimensions = enabledCodes.map((code) => makeDimConfig(code, `D${code}`, true))
  // 添加两个禁用维度用于验证过滤
  cfg.dimensions.push(
    makeDimConfig('98', 'DISABLED_A', false),
    makeDimConfig('99', 'DISABLED_B', false),
  )
  return cfg
}

// ============================================================
// describe: buildSummaryMarkdown
// ============================================================

describe('buildSummaryMarkdown', () => {
  it('应包含批量标识、导出时间、统计数字', () => {
    const meta = makeBatchMeta()
    const md = buildSummaryMarkdown(meta, makeSymbolMetas())
    expect(md).toContain('# 批量采集资料汇总 — pool-collect-1700000000000')
    expect(md).toContain('- **股票数量**: 2')
    expect(md).toContain('- **采集维度**: 4 (01, 02, 05, 09)')
    expect(md).toContain('- **总采集链路**: 8 条')
    expect(md).toContain('  - 成功: 7 条')
    expect(md).toContain('  - 失败: 1 条')
    expect(md).toContain('- **成功率**: 88%')
  })

  it('应生成各股票明细表格，含状态标记', () => {
    const md = buildSummaryMarkdown(makeBatchMeta(), makeSymbolMetas())
    // 表头
    expect(md).toContain('| 代码 | 名称 | 已采集维度 | 成功链路 | 失败链路 | 状态 |')
    // 000001.SZ 全部成功 → ✅
    expect(md).toContain('| 000001.SZ | 平安银行 | 01/02/05/09 | 4 | 0 | ✅ 全部成功 |')
    // 600000.SH 有 1 个失败 → ⚠️
    expect(md).toContain('| 600000.SH | 浦发银行 | 01/02/05/09 | 3 | 1 | ⚠️ 部分失败 |')
  })

  it('失败链路详情应列出维度标签与错误信息', () => {
    const md = buildSummaryMarkdown(makeBatchMeta(), makeSymbolMetas())
    expect(md).toContain('## 失败链路详情')
    expect(md).toContain('- **600000.SH** [热点新闻]: timeout: source crawler circuit-open')
  })

  it('零失败时应显示"无失败记录"占位符', () => {
    const metasAllOk: SymbolMetadata[] = makeSymbolMetas().map((m) => ({
      ...m,
      traces: m.traces.map((t) => ({ ...t, success: true, error: undefined })),
    }))
    const meta = makeBatchMeta({ totalTraces: 8, successTraces: 8, failedTraces: 0 })
    const md = buildSummaryMarkdown(meta, metasAllOk)
    expect(md).toContain('- **成功率**: 100%')
    expect(md).toContain('_无失败记录_')
    expect(md).not.toContain('热点新闻')
  })

  it('空 symbolMetas 时应生成零成功率与空表格', () => {
    const meta = makeBatchMeta({ symbols: [], totalTraces: 0, successTraces: 0, failedTraces: 0 })
    const md = buildSummaryMarkdown(meta, [])
    expect(md).toContain('- **股票数量**: 0')
    expect(md).toContain('- **成功率**: 0%')
    expect(md).toContain('_无失败记录_')
  })

  it('股票信息缺失时应使用占位符 "-"', () => {
    const metasNoName: SymbolMetadata[] = [
      {
        symbol: 'UNKNOWN',
        dimensions: ['01'],
        traces: [{ dimensionCode: '01', success: true, latencyMs: 0 }],
        exportedAt: 0,
      },
    ]
    const meta = makeBatchMeta({ symbols: ['UNKNOWN'], dimensions: ['01'], totalTraces: 1, successTraces: 1, failedTraces: 0 })
    const md = buildSummaryMarkdown(meta, metasNoName)
    expect(md).toContain('| UNKNOWN | - | 01 | 1 | 0 | ✅ 全部成功 |')
  })

  it('成功率计算应四舍五入（954/1000 = 95.4% → 95%，955/1000 = 95.5% → 96%）', () => {
    // 95.4% 四舍五入 → 95
    const metaFloor = makeBatchMeta({ totalTraces: 1000, successTraces: 954, failedTraces: 46 })
    expect(buildSummaryMarkdown(metaFloor, [])).toContain('- **成功率**: 95%')
    // 95.5% 四舍五入 → 96
    const metaCeil = makeBatchMeta({ totalTraces: 1000, successTraces: 955, failedTraces: 45 })
    expect(buildSummaryMarkdown(metaCeil, [])).toContain('- **成功率**: 96%')
  })
})

// ============================================================
// describe: extractEnabledDimensionCodes
// ============================================================

describe('extractEnabledDimensionCodes', () => {
  it('应从 config.dimensions 过滤只保留 enabled=true 的 code', () => {
    const cfg = makeConfig(['01', '02', '08'])
    const codes = extractEnabledDimensionCodes(cfg)
    expect(codes).toEqual(['01', '02', '08'])
    expect(codes).not.toContain('98')
    expect(codes).not.toContain('99')
  })

  it('config.dimensions 为空时应回退到 DEFAULT_DIMENSIONS 默认配置', () => {
    const cfg = createDefaultCollectionConfig()
    cfg.dimensions = []
    const codes = extractEnabledDimensionCodes(cfg)
    // 默认配置中 DEFAULT_DIMENSIONS 至少包含 01-08/09，且都为 enabled
    expect(Array.isArray(codes)).toBe(true)
    expect(codes.length).toBeGreaterThanOrEqual(8)
    expect(codes).toContain('01')
    expect(codes).toContain('02')
  })

  it('当 config.dimensions 全为禁用时应返回空数组', () => {
    const cfg = createDefaultCollectionConfig()
    cfg.dimensions = [
      makeDimConfig('01', 'X', false),
      makeDimConfig('02', 'Y', false),
    ]
    expect(extractEnabledDimensionCodes(cfg)).toEqual([])
  })

  it('应保留原始顺序，不做去重（尊重 config 顺序）', () => {
    const cfg = makeConfig(['09', '01', '05'])
    expect(extractEnabledDimensionCodes(cfg)).toEqual(['09', '01', '05'])
  })
})

// ============================================================
// describe: hasElectronFs 环境探测
// ============================================================

describe('hasElectronFs', () => {
  const origWindow = globalThis.window

  afterEach(() => {
    // 还原 window
    if (origWindow !== undefined) {
      (globalThis as unknown as { window: unknown }).window = origWindow
    } else {
      delete (globalThis as unknown as { window?: unknown }).window
    }
  })

  it('Node 环境（无 window）应返回 false', () => {
    // Vitest 默认运行在 jsdom，但我们显式删除
    delete (globalThis as unknown as { window?: unknown }).window
    expect(hasElectronFs()).toBe(false)
  })

  it('window 存在但无 fileSync 属性时应返回 false', () => {
    (globalThis as unknown as { window: Record<string, unknown> }).window = {}
    expect(hasElectronFs()).toBe(false)
  })

  it('window.fileSync 存在时应返回 true', () => {
    (globalThis as unknown as { window: Record<string, unknown> }).window = {
      fileSync: {
        writeFiles: vi.fn(),
      },
    }
    expect(hasElectronFs()).toBe(true)
  })
})
