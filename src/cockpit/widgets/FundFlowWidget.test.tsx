/**
 * @fileoverview FundFlowWidget 单元测试 (P0)
 * @description 覆盖防御性 guard 分支 + 正常渲染路径。
 *
 * P0 用例：
 * 1. config 为空时渲染"配置未就绪"占位
 * 2. 正常 config 渲染 WidgetStateShell 标题 + 资金流向数据
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
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
    // useMarketData 仍需返回有效值（hooks 必须无条件调用）
    setupMarketData(buildFlows(), false)

    const props = { config: undefined as unknown as WidgetConfig }
    render(<FundFlowWidget {...props} />)

    expect(screen.getByText('配置未就绪')).toBeInTheDocument()
  })

  // ----------------------------------------------------------
  // P0 用例 2：正常 config → 渲染标题 + 资金流向数据
  // ----------------------------------------------------------
  it('正常 config 渲染 WidgetStateShell 标题 + 资金流向数据', () => {
    const flows = buildFlows()
    setupMarketData(flows, false)

    render(<FundFlowWidget config={buildConfig()} />)

    // 标题渲染
    expect(screen.getByText('资金流向监控')).toBeInTheDocument()
    // 资金流向名称渲染
    expect(screen.getByText('北向资金')).toBeInTheDocument()
    expect(screen.getByText('主力资金')).toBeInTheDocument()
    // 数值渲染（正值带 + 前缀）
    expect(screen.getByText(/50000/)).toBeInTheDocument()
    expect(screen.getByText(/12000/)).toBeInTheDocument()
  })
})
