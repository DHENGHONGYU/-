/**
 * @fileoverview FundFlowWidget 单元测试 (P0 + P1)
 * @description 覆盖防御性 guard 分支 + 正常渲染路径 + 三态（loading/error/empty）。
 *
 * P0 用例：
 * 1. config 为空时渲染"配置未就绪"占位
 * 2. 正常 config 渲染 WidgetStateShell 标题 + 资金流向数据
 *
 * P1 用例：
 * 3. loading 状态显示 Skeleton
 * 4. error 状态显示错误信息 + 重试按钮
 * 5. 空数据状态显示 empty 占位
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { WidgetConfig, MarketData, FundFlowData } from '@/types/modules/widget.types'
import { buildWidgetConfig } from '../../../tests/fixtures'

// ============================================================
// Mock: useMarketData
// ============================================================
const mockUseMarketData = vi.hoisted(() => vi.fn())
vi.mock('@/cockpit/providers/MarketDataProvider', () => ({
  useMarketData: mockUseMarketData,
}))

// 延迟导入，确保 mock 生效
const FundFlowWidget = (await import('./FundFlowWidget')).default

// ============================================================
// 调试日志辅助
// ============================================================
function debugLog(branch: string, context: Record<string, unknown>): void {
  console.log(`[test-debug] FundFlowWidget ${branch}`, context)
}

// ============================================================
// 辅助函数
// ============================================================

/** 构建默认 WidgetConfig */
function buildConfig(title = '资金流向监控'): WidgetConfig {
  return buildWidgetConfig({
    instanceId: 'fund-flow-1',
    title,
    widgetType: 'fundFlow',
  })
}

/** 构建 mock FundFlowData */
function buildFlows(overrides: Partial<FundFlowData>[] = []): FundFlowData[] {
  const defaults: FundFlowData[] = [
    { type: 'north', name: '北向资金', value: 50000, unit: '万' },
    { type: 'main', name: '主力资金', value: -12000, unit: '万' },
  ]
  return defaults.map((d, i) => ({ ...d, ...overrides[i] }))
}

/** 配置 mock useMarketData 返回值 */
function setupMarketData(
  flows: FundFlowData[] = [],
  loading = false,
  error: string | null = null,
): void {
  mockUseMarketData.mockReturnValue({
    data: { fundFlows: flows } as unknown as MarketData,
    loadingMap: { 'fund-flow-1': loading },
    errorMap: error ? { 'fund-flow-1': error } : {},
    refreshWidget: vi.fn(),
  })
}

// ============================================================
// 测试用例
// ============================================================

describe('FundFlowWidget (P0)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ----------------------------------------------------------
  // P0 用例 1：config 为空 → 渲染"配置未就绪"占位
  // ----------------------------------------------------------
  it('config 为空时渲染"配置未就绪"占位', () => {
    debugLog('P0-guard', { config: 'undefined', branch: 'guard' })
    setupMarketData(buildFlows(), false)

    const props = { config: undefined as unknown as WidgetConfig }
    render(<FundFlowWidget {...props} />)

    debugLog('P0-guard 结果', { renderedText: '配置未就绪' })
    expect(screen.getByText('配置未就绪')).toBeInTheDocument()
  })

  // ----------------------------------------------------------
  // P0 用例 2：正常 config → 渲染标题 + 资金流向数据
  // ----------------------------------------------------------
  it('正常 config 渲染 WidgetStateShell 标题 + 资金流向数据', () => {
    const flows = buildFlows()
    debugLog('P0-ready', { flowsCount: flows.length, branch: 'ready' })
    setupMarketData(flows, false)

    render(<FundFlowWidget config={buildConfig()} />)

    debugLog('P0-ready 结果', { title: '资金流向监控', flowNames: flows.map((f) => f.name) })
    expect(screen.getByText('资金流向监控')).toBeInTheDocument()
    expect(screen.getByText('北向资金')).toBeInTheDocument()
    expect(screen.getByText('主力资金')).toBeInTheDocument()
    expect(screen.getByText(/50000/)).toBeInTheDocument()
    expect(screen.getByText(/12000/)).toBeInTheDocument()
  })
})

// ============================================================
// P1 用例：三态覆盖（loading / error / empty）
// ============================================================
describe('FundFlowWidget (P1) — 三态覆盖', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ----------------------------------------------------------
  // P1 用例 1：loading 状态显示 Skeleton
  // ----------------------------------------------------------
  it('loading 状态显示 Skeleton 骨架屏', () => {
    debugLog('P1-loading', { loading: true, branch: 'loading' })
    setupMarketData(buildFlows(), true)

    render(<FundFlowWidget config={buildConfig()} />)

    // loading 状态下不显示数据内容
    expect(screen.queryByText('北向资金')).not.toBeInTheDocument()
    // 显示骨架屏（Skeleton 组件有 animate-pulse 类）
    const skeletons = document.querySelectorAll('.animate-pulse')
    debugLog('P1-loading 结果', { skeletonCount: skeletons.length, dataHidden: true })
    expect(skeletons.length).toBeGreaterThan(0)
  })

  // ----------------------------------------------------------
  // P1 用例 2：error 状态显示错误信息 + 重试按钮
  // ----------------------------------------------------------
  it('error 状态显示错误信息 + 重试按钮', () => {
    const errorMsg = '数据源连接超时'
    debugLog('P1-error', { error: errorMsg, branch: 'error' })
    setupMarketData(buildFlows(), false, errorMsg)

    render(<FundFlowWidget config={buildConfig()} />)

    // WidgetStateShell error 态显示"加载失败"标题 + 错误描述 + 重试按钮
    debugLog('P1-error 结果', { expectedError: errorMsg })
    expect(screen.getByText('加载失败')).toBeInTheDocument()
    expect(screen.getByText(errorMsg)).toBeInTheDocument()
    expect(screen.getByText('重试')).toBeInTheDocument()
  })

  // ----------------------------------------------------------
  // P1 用例 3：空数据状态显示 empty 占位
  // ----------------------------------------------------------
  it('空数据状态显示 empty 占位', () => {
    debugLog('P1-empty', { flowsCount: 0, branch: 'empty' })
    setupMarketData([], false)

    render(<FundFlowWidget config={buildConfig()} />)

    // WidgetStateShell empty 态显示空状态标题和描述
    debugLog('P1-empty 结果', { expectedTitle: '暂无资金流向数据' })
    expect(screen.getByText('暂无资金流向数据')).toBeInTheDocument()
    expect(screen.getByText('当前未获取到主力资金、北向资金等流向数据')).toBeInTheDocument()
  })
})
