/**
 * @fileoverview KaiScoreWidget 单元测试
 * @description 验证 KAI 综合评分 Widget 的渲染逻辑、四顶部指标（综合/情绪/趋势/流量）、
 * getScoreLevel 五档等级映射与颜色、维度横向柱状图宽度、细项分布表，以及 data prop 覆盖路径。
 *
 * 覆盖关键点：
 * - 默认 props 渲染 / 标题来自 config
 * - 四顶部指标标签与数值渲染
 * - getScoreLevel 五档（优秀/良好/一般/较弱/差）Badge 文案与颜色令牌
 * - 维度横向柱状图：宽度 = `${dim.score}%`，颜色 = dim.color
 * - 细项分布表：维度名/细项名/得分/权重百分比
 * - data prop 覆盖：传入 data 时以 prop 为准，忽略 MarketDataProvider
 *
 * 颜色断言遵循 AGENTS.md §3.5.5：使用 SCORE_LEVELS 颜色值做 hex→rgb 容错比较。
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { WidgetConfig, MarketData, KaiScore } from '@/types/modules/widget.types'
import { SCORE_LEVELS } from '@/constants/cockpit.constants'
import { buildWidgetConfig } from '../../../tests/fixtures'

// ============================================================
// Mock: MarketDataProvider（KaiScoreWidget 依赖 useMarketData）
// ============================================================
const { mockUseMarketData } = vi.hoisted(() => ({
  mockUseMarketData: vi.fn(),
}))

vi.mock('@/cockpit/providers/MarketDataProvider', () => ({
  useMarketData: mockUseMarketData,
}))

// 延迟导入被测组件，确保 vi.mock 先生效
const KaiScoreWidget = (await import('./KaiScoreWidget')).default

// ============================================================
// 辅助函数
// ============================================================

/** 构建默认 WidgetConfig */
function buildConfig(title = 'KAI 评分'): WidgetConfig {
  return buildWidgetConfig({
    instanceId: 'kai-score-1',
    widgetId: 'kaiScore',
    title,
  })
}

/** 构建一组合理的默认 KaiScore */
function buildKai(overrides: Partial<KaiScore> = {}): KaiScore {
  return {
    totalScore: 85,
    sentiment: 72,
    trend: 64,
    flow: 55,
    dimensions: [
      { name: '动量', score: 75, weight: 0.3, status: '强', color: 'bg-green-500' },
      { name: '情绪', score: 50, weight: 0.2, status: '中', color: 'bg-amber-500' },
    ],
    detailDistribution: [
      { dimensionName: '动量', itemName: '强度', score: 90, weight: 0.25, color: 'bg-green-500' },
      { dimensionName: '情绪', itemName: '活跃度', score: 40, weight: 0.15, color: 'bg-amber-500' },
    ],
    ...overrides,
  }
}

/** 将 KaiScore 包装为 MarketData（仅填本组件读取的字段） */
function toMarketData(kai: KaiScore): MarketData {
  return {
    analysisScores: {
      // 组件仅读取 analysisScores.kai；profile 占位
      profile: { tags: [], metrics: [] },
      kai,
    },
  } as unknown as MarketData
}

/** 配置 mock useMarketData 返回指定 kai */
function setupKai(kai: KaiScore): void {
  mockUseMarketData.mockReturnValue({ data: toMarketData(kai) } as never)
}

/** hex → rgb 字符串，用于 jsdom 内联样式归一化容错 */
function hexToRgb(hex: string): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgb(${r}, ${g}, ${b})`
}

/** 容错比较内联 style.color */
function expectInlineColor(el: HTMLElement, hex: string): void {
  const actual = el.style.color
  if (actual === hex || actual === hexToRgb(hex)) {
    expect(actual === hex || actual === hexToRgb(hex)).toBe(true)
    return
  }
  expect(actual).toBe(hex)
}

// ============================================================
// 测试套件
// ============================================================
describe('KaiScoreWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupKai(buildKai())
  })

  // ----------------------------------------------------------
  // 默认 / 标题
  // ----------------------------------------------------------
  it('renders widget title from config by default', () => {
    setupKai(buildKai())
    render(<KaiScoreWidget config={buildConfig('KAI 选股评分')} />)

    expect(screen.getByText('KAI 选股评分')).toBeInTheDocument()
  })

  // ----------------------------------------------------------
  // 四顶部指标
  // ----------------------------------------------------------
  it('renders the four top metric labels and values', () => {
    setupKai(buildKai({ totalScore: 85, sentiment: 72, trend: 64, flow: 55 }))
    render(<KaiScoreWidget config={buildConfig()} />)

    expect(screen.getByText('综合评分')).toBeInTheDocument()
    expect(screen.getByText('情绪值')).toBeInTheDocument()
    expect(screen.getByText('趋势值')).toBeInTheDocument()
    expect(screen.getByText('流量值')).toBeInTheDocument()
    expect(screen.getByText('85')).toBeInTheDocument()
    expect(screen.getByText('72')).toBeInTheDocument()
    expect(screen.getByText('64')).toBeInTheDocument()
    expect(screen.getByText('55')).toBeInTheDocument()
  })

  // ----------------------------------------------------------
  // getScoreLevel 五档等级映射
  // ----------------------------------------------------------
  it('maps a high total score (>=80) to 优秀 / EXCELLENT color', () => {
    setupKai(buildKai({ totalScore: 85 }))
    render(<KaiScoreWidget config={buildConfig()} />)

    expect(screen.getByText('优秀')).toBeInTheDocument()
    const value = screen.getByText('85')
    expectInlineColor(value, SCORE_LEVELS.EXCELLENT.color)
  })

  it('maps a mid score (60-80) to 良好 / GOOD color', () => {
    // 其余指标设为互不相同的非良好档，确保「良好」文案唯一
    setupKai(buildKai({ totalScore: 72, sentiment: 33, trend: 22, flow: 11 }))
    render(<KaiScoreWidget config={buildConfig()} />)

    expect(screen.getByText('良好')).toBeInTheDocument()
    const value = screen.getByText('72')
    expectInlineColor(value, SCORE_LEVELS.GOOD.color)
  })

  it('maps a low score (<20) to 差 / BAD color', () => {
    setupKai(buildKai({ totalScore: 15 }))
    render(<KaiScoreWidget config={buildConfig()} />)

    expect(screen.getByText('差')).toBeInTheDocument()
    const value = screen.getByText('15')
    expectInlineColor(value, SCORE_LEVELS.BAD.color)
  })

  it('maps a boundary score exactly at 40 to 一般 / AVERAGE color', () => {
    // 其余指标设为互不相同的非一般档，并避免细项分布表分值撞车，确保「40」「一般」唯一
    setupKai(buildKai({
      totalScore: 40,
      sentiment: 33,
      trend: 22,
      flow: 11,
      detailDistribution: [
        { dimensionName: '动量', itemName: '强度', score: 99, weight: 0.1, color: 'bg-green-500' },
      ],
    }))
    render(<KaiScoreWidget config={buildConfig()} />)

    expect(screen.getByText('一般')).toBeInTheDocument()
    const value = screen.getByText('40')
    expectInlineColor(value, SCORE_LEVELS.AVERAGE.color)
  })

  // ----------------------------------------------------------
  // 维度横向柱状图
  // ----------------------------------------------------------
  it('renders dimension names and bar widths equal to dimension score percent', () => {
    setupKai(buildKai({
      dimensions: [
        { name: '动量', score: 75, weight: 0.3, status: '强', color: 'bg-green-500' },
        { name: '情绪', score: 50, weight: 0.2, status: '中', color: 'bg-amber-500' },
      ],
    }))
    const { container } = render(<KaiScoreWidget config={buildConfig()} />)

    // 维度名在维度区与细项分布表均出现，避免 getByText 命中多个，仅校验分值与柱宽
    expect(screen.getByText('75')).toBeInTheDocument()
    expect(screen.getByText('50')).toBeInTheDocument()

    const widths = Array.from(container.querySelectorAll<HTMLElement>('[style*="width"]')).map(
      (el) => el.style.width,
    )
    expect(widths).toContain('75%')
    expect(widths).toContain('50%')
  })

  // ----------------------------------------------------------
  // 细项分布表
  // ----------------------------------------------------------
  it('renders detail distribution: dimension, item, score and weight%', () => {
    setupKai(buildKai({
      detailDistribution: [
        { dimensionName: '动量', itemName: '强度', score: 90, weight: 0.25, color: 'bg-green-500' },
      ],
    }))
    render(<KaiScoreWidget config={buildConfig()} />)

    // 维度名「动量」在维度区也出现，改用细项名/得分/权重（均唯一）校验
    expect(screen.getByText('强度')).toBeInTheDocument()
    expect(screen.getByText('90')).toBeInTheDocument()
    // weight 0.25 -> 25.0%
    expect(screen.getByText('25.0%')).toBeInTheDocument()
  })

  // ----------------------------------------------------------
  // data prop 覆盖路径
  // ----------------------------------------------------------
  it('prefers the data prop over MarketDataProvider when both are present', () => {
    // MarketDataProvider 返回 85，但 data prop 覆盖为 33（POOR）
    setupKai(buildKai({ totalScore: 85 }))
    const override = toMarketData(buildKai({ totalScore: 33 }))

    render(<KaiScoreWidget config={buildConfig()} data={override} />)

    expect(screen.getByText('33')).toBeInTheDocument()
    // 33 落在 POOR 区间（>=20）：应显示「较弱」
    expect(screen.getByText('较弱')).toBeInTheDocument()
    // 来自 provider 的 85 不应再出现
    expect(screen.queryByText('优秀')).not.toBeInTheDocument()
  })

  // ----------------------------------------------------------
  // 等级锚点（防御 SCORE_LEVELS 被意外修改）
  // ----------------------------------------------------------
  it('SCORE_LEVELS 五档颜色/阈值应与 KaiScoreWidget 的 getScoreLevel 一致', () => {
    expect(SCORE_LEVELS.EXCELLENT.min).toBe(80)
    expect(SCORE_LEVELS.EXCELLENT.color).toBe('#22c55e')
    expect(SCORE_LEVELS.GOOD.min).toBe(60)
    expect(SCORE_LEVELS.GOOD.color).toBe('#3b82f6')
    expect(SCORE_LEVELS.AVERAGE.min).toBe(40)
    expect(SCORE_LEVELS.AVERAGE.color).toBe('#f59e0b')
    expect(SCORE_LEVELS.POOR.min).toBe(20)
    expect(SCORE_LEVELS.POOR.color).toBe('#f97316')
    expect(SCORE_LEVELS.BAD.color).toBe('#ef4444')
  })
})
