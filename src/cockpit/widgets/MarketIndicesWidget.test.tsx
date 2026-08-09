/**
 * @fileoverview MarketIndicesWidget 单元测试 (P0 + P1)
 * @description 覆盖防御性 guard 分支 + 正常渲染路径 + 三态（loading/error/empty）。
 *
 * P0 用例：
 * 1. config 为空时渲染"配置未就绪"占位
 * 2. 正常 config 渲染 WidgetStateShell 标题 + 大盘指数数据
 *
 * P1 用例：
 * 3. loading 状态显示 Skeleton（2x2 grid）
 * 4. error 状态显示错误信息 + 重试按钮
 * 5. 空数据状态显示 empty 占位
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import type { WidgetConfig, MarketData, MarketIndexData } from '@/types/modules/widget.types'
import { buildWidgetConfig } from '../../../tests/fixtures'

// ============================================================
// Mock: useMarketData
// ============================================================
const mockUseMarketData = vi.hoisted(() => vi.fn())
vi.mock('@/cockpit/providers/MarketDataProvider', () => ({
  useMarketData: mockUseMarketData,
}))

// 延迟导入，确保 mock 生效
const MarketIndicesWidget = (await import('./MarketIndicesWidget')).default

// ============================================================
// 调试日志辅助
// ============================================================
function debugLog(branch: string, context: Record<string, unknown>): void {
  console.log(`[test-debug] MarketIndicesWidget ${branch}`, context)
}

// ============================================================
// 辅助函数
// ============================================================

/** 构建默认 WidgetConfig */
function buildConfig(title = '大盘行情监控'): WidgetConfig {
  return buildWidgetConfig({
    instanceId: 'market-indices-1',
    title,
    widgetType: 'marketIndices',
  })
}

/** 构建 mock MarketIndexData */
function buildIndices(overrides: Partial<MarketIndexData>[] = []): MarketIndexData[] {
  const defaults: MarketIndexData[] = [
    { code: '000001', name: '上证指数', price: 3200.5, change: 15.3, changePercent: 0.48, high: 3210, low: 3190, volume: '3500亿' },
    { code: '399001', name: '深证成指', price: 10500.2, change: -20.1, changePercent: -0.19, high: 10530, low: 10480, volume: '4200亿' },
  ]
  return defaults.map((d, i) => ({ ...d, ...overrides[i] }))
}

/** 配置 mock useMarketData 返回值 */
function setupMarketData(
  indices: MarketIndexData[] = [],
  loading = false,
  error: string | null = null,
): void {
  mockUseMarketData.mockReturnValue({
    data: { indices } as unknown as MarketData,
    loadingMap: { 'market-indices-1': loading },
    errorMap: error ? { 'market-indices-1': error } : {},
    refreshWidget: vi.fn(),
  })
}

// ============================================================
// 测试用例
// ============================================================

describe('MarketIndicesWidget (P0)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ----------------------------------------------------------
  // P0 用例 1：config 为空 → 渲染"配置未就绪"占位
  // ----------------------------------------------------------
  it('config 为空时渲染"配置未就绪"占位', () => {
    debugLog('P0-guard', { config: 'undefined', branch: 'guard' })
    setupMarketData(buildIndices(), false)

    const props = { config: undefined as unknown as WidgetConfig }
    render(<MarketIndicesWidget {...props} />)

    debugLog('P0-guard 结果', { renderedText: '配置未就绪' })
    expect(screen.getByText('配置未就绪')).toBeInTheDocument()
  })

  // ----------------------------------------------------------
  // P0 用例 2：正常 config → 渲染标题 + 大盘指数数据
  // ----------------------------------------------------------
  it('正常 config 渲染 WidgetStateShell 标题 + 大盘指数数据', () => {
    const indices = buildIndices()
    debugLog('P0-ready', { indicesCount: indices.length, branch: 'ready' })
    setupMarketData(indices, false)

    render(<MarketIndicesWidget config={buildConfig()} />)

    debugLog('P0-ready 结果', { title: '大盘行情监控', indexNames: indices.map((i) => i.name) })
    expect(screen.getByText('大盘行情监控')).toBeInTheDocument()
    expect(screen.getByText('上证指数')).toBeInTheDocument()
    expect(screen.getByText('深证成指')).toBeInTheDocument()
    expect(screen.getByText('3200.50')).toBeInTheDocument()
    expect(screen.getByText('10500.20')).toBeInTheDocument()
  })
})

// ============================================================
// P1 用例：三态覆盖（loading / error / empty）
// ============================================================
describe('MarketIndicesWidget (P1) — 三态覆盖', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ----------------------------------------------------------
  // P1 用例 1：loading 状态显示 Skeleton（2x2 grid）
  // ----------------------------------------------------------
  it('loading 状态显示 Skeleton 骨架屏', () => {
    debugLog('P1-loading', { loading: true, branch: 'loading' })
    setupMarketData(buildIndices(), true)

    render(<MarketIndicesWidget config={buildConfig()} />)

    // loading 状态下不显示数据内容
    expect(screen.queryByText('上证指数')).not.toBeInTheDocument()
    // 显示骨架屏
    const skeletons = document.querySelectorAll('.animate-pulse')
    debugLog('P1-loading 结果', { skeletonCount: skeletons.length, dataHidden: true })
    expect(skeletons.length).toBeGreaterThan(0)
  })

  // ----------------------------------------------------------
  // P1 用例 2：error 状态显示错误信息 + 重试按钮
  // ----------------------------------------------------------
  it('error 状态显示错误信息 + 重试按钮', () => {
    const errorMsg = '行情数据源不可用'
    debugLog('P1-error', { error: errorMsg, branch: 'error' })
    setupMarketData(buildIndices(), false, errorMsg)

    render(<MarketIndicesWidget config={buildConfig()} />)

    debugLog('P1-error 结果', { expectedError: errorMsg })
    expect(screen.getByText('加载失败')).toBeInTheDocument()
    expect(screen.getByText(errorMsg)).toBeInTheDocument()
    expect(screen.getByText('重试')).toBeInTheDocument()
  })

  // ----------------------------------------------------------
  // P1 用例 3：空数据状态显示 empty 占位
  // ----------------------------------------------------------
  it('空数据状态显示 empty 占位', () => {
    debugLog('P1-empty', { indicesCount: 0, branch: 'empty' })
    setupMarketData([], false)

    render(<MarketIndicesWidget config={buildConfig()} />)

    debugLog('P1-empty 结果', { expectedTitle: '暂无大盘行情' })
    expect(screen.getByText('暂无大盘行情')).toBeInTheDocument()
    expect(screen.getByText('当前未获取到指数数据，请检查数据源或稍后重试')).toBeInTheDocument()
  })
})
