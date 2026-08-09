/**
 * @fileoverview ModelCompareWidget 单元测试 (P1)
 * @description 覆盖 instanceId 不匹配 loadingMap 时的默认行为 + 基础渲染验证。
 *
 * 注意：ModelCompareWidget.tsx 源码使用 `!!loadingMap[config.instanceId]`（非 `?? true`），
 * 当 instanceId 不在 loadingMap 中时，loading 默认为 false（非 true）。
 *
 * P1 用例：
 * 1. instanceId 不匹配 loadingMap 时 loading 默认 false → 显示 ready 状态
 * 2. 正常渲染验证：有完整数据时渲染模型卡片 + 维度对比
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import type { WidgetConfig, MarketData, ModelComparison } from '@/types/modules/widget.types'
import { buildWidgetConfig } from '../../../tests/fixtures'

// ============================================================
// Mock: useMarketData
// ============================================================
const mockUseMarketData = vi.hoisted(() => vi.fn())
vi.mock('@/cockpit/providers/MarketDataProvider', () => ({
  useMarketData: mockUseMarketData,
}))

// 延迟导入，确保 mock 生效
const ModelCompareWidget = (await import('./ModelCompareWidget')).default

// ============================================================
// 调试日志辅助
// ============================================================
function debugLog(branch: string, context: Record<string, unknown>): void {
  console.log(`[test-debug] ModelCompareWidget ${branch}`, context)
}

// ============================================================
// 辅助函数
// ============================================================

/** 构建默认 WidgetConfig */
function buildConfig(title = 'AI 大模型对比', instanceId = 'model-compare-1'): WidgetConfig {
  return buildWidgetConfig({
    instanceId,
    title,
    widgetType: 'modelCompare',
  })
}

/** 构建 mock ModelComparison 数据 */
function buildComparison(overrides: Partial<ModelComparison> = {}): ModelComparison {
  return {
    leftModel: { id: 'kaillm-v2.1', name: 'KAILLM v2.1', version: 'v2.1', score: 85 },
    rightModel: { id: 'baseline-v1.5', name: '基准模型 v1.5', version: 'v1.5', score: 72 },
    dimensions: [
      { name: '推理能力', leftScore: 90, rightScore: 75, weight: 0.4 },
      { name: '响应速度', leftScore: 70, rightScore: 85, weight: 0.3 },
    ],
    riskHint: '模型对比结果仅供参考，不构成投资建议',
    ...overrides,
  }
}

/** 配置 mock useMarketData 返回值 */
function setupMarketData(
  comparison: ModelComparison,
  loadingMap: Record<string, boolean> = {},
  errorMap: Record<string, string | null> = {},
): void {
  mockUseMarketData.mockReturnValue({
    data: { modelComparison: comparison } as unknown as MarketData,
    loadingMap,
    errorMap,
    refreshWidget: vi.fn(),
  })
}

// ============================================================
// 测试用例
// ============================================================

describe('ModelCompareWidget (P1)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ----------------------------------------------------------
  // P1 用例 1：instanceId 不匹配 loadingMap 时 loading 默认 false
  // 源码：const loading = !!loadingMap[config.instanceId]
  // 当 instanceId 不在 loadingMap 中 → !!undefined → false → ready 状态
  // ----------------------------------------------------------
  it('instanceId 不匹配 loadingMap 时 loading 默认 false → 显示 ready 状态', () => {
    const comparison = buildComparison()
    // config.instanceId = 'mismatched-id'，但 loadingMap 只有 'model-compare-1'
    debugLog('P1-instanceId不匹配', {
      configInstanceId: 'mismatched-id',
      loadingMapKey: 'model-compare-1',
      expectedLoading: false,
      branch: 'instanceId-mismatch',
    })
    setupMarketData(comparison, { 'model-compare-1': true })

    render(<ModelCompareWidget config={buildConfig('AI 大模型对比', 'mismatched-id')} />)

    // loading=false → 显示 ready 内容（模型名称），不显示骨架屏
    debugLog('P1-instanceId不匹配 结果', { readyContent: true, loadingSkipped: true })
    expect(screen.getByText('AI 大模型对比')).toBeInTheDocument()
    expect(screen.getAllByText('KAILLM v2.1').length).toBeGreaterThan(0)
    // 不应显示加载骨架屏文案
    expect(screen.queryByText('加载模型对比…')).not.toBeInTheDocument()
  })

  // ----------------------------------------------------------
  // P1 用例 2：正常渲染验证 — 有完整数据时渲染模型卡片 + 维度对比
  // ----------------------------------------------------------
  it('正常渲染验证：有完整数据时渲染模型卡片 + 维度对比', () => {
    const comparison = buildComparison()
    debugLog('P1-ready', {
      leftModel: comparison.leftModel.name,
      rightModel: comparison.rightModel.name,
      dimensionsCount: comparison.dimensions.length,
      branch: 'ready',
    })
    setupMarketData(comparison, { 'model-compare-1': false })

    render(<ModelCompareWidget config={buildConfig()} />)

    debugLog('P1-ready 结果', {
      title: 'AI 大模型对比',
      leftScore: 85,
      rightScore: 72,
      dimensions: comparison.dimensions.map((d) => d.name),
    })
    expect(screen.getByText('AI 大模型对比')).toBeInTheDocument()
    expect(screen.getAllByText('KAILLM v2.1').length).toBeGreaterThan(0)
    expect(screen.getAllByText('基准模型 v1.5').length).toBeGreaterThan(0)
    expect(screen.getByText('推理能力')).toBeInTheDocument()
    expect(screen.getByText('响应速度')).toBeInTheDocument()
    // 评分等级 Badge（85 >= 80 → "优秀"）
    expect(screen.getByText('优秀')).toBeInTheDocument()
    // 风险提示
    expect(screen.getByText(/模型对比结果仅供参考/)).toBeInTheDocument()
  })

  // ----------------------------------------------------------
  // P1 用例 3：loading 状态匹配时显示骨架屏
  // 验证 instanceId 匹配 loadingMap 时 loading=true
  // ----------------------------------------------------------
  it('instanceId 匹配 loadingMap 时 loading=true → 显示骨架屏', () => {
    const comparison = buildComparison()
    debugLog('P1-loading匹配', {
      configInstanceId: 'model-compare-1',
      loadingMapValue: true,
      expectedLoading: true,
      branch: 'loading-match',
    })
    setupMarketData(comparison, { 'model-compare-1': true })

    render(<ModelCompareWidget config={buildConfig()} />)

    // loading=true → 不显示 ready 内容（维度名称）
    expect(screen.queryByText('推理能力')).not.toBeInTheDocument()
    debugLog('P1-loading匹配 结果', { readyContentHidden: true })
  })
})
