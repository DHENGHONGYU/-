/**
 * @fileoverview HotSectorWidget 单元测试
 * @description 验证热门板块策略 Widget 的渲染逻辑、空态、getActionLabel 三动作映射、
 * getScoreColor 五档颜色映射、score.toFixed(2) 显示、五维评分渲染，以及 store 与 data prop 双路径。
 *
 * 覆盖关键点：
 * - 默认 props 渲染 / 标题来自 config（含火焰图标）
 * - 空态（hotSectors.length === 0 → 暂无热门板块策略数据）
 * - getActionLabel：immediate→立即跟进 / probe→试探 / ignore→不追
 * - getScoreColor：score/20 映射五档（优秀/良好/一般/较弱/差）内联色
 * - score 显示：(item.score).toFixed(2)
 * - 五维评分：动量/情绪/技术/估值/综合 名称与数值渲染
 * - store 路径：useDualStrategyStore 直接提供 hotSectors
 * - data prop 路径：data.hotSectors 覆盖 store
 *
 * 颜色断言遵循 AGENTS.md §3.5.5：使用 SCORE_LEVELS 颜色值做 hex→rgb 容错比较。
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { WidgetConfig, HotSectorData } from '@/types/modules/widget.types'
import { SCORE_LEVELS } from '@/constants/cockpit.constants'
import { buildWidgetConfig } from '../../../tests/fixtures'

// ============================================================
// Mock: dualStrategyStore（HotSectorWidget 依赖 useDualStrategyStore）
// ============================================================
const { mockUseDualStrategyStore } = vi.hoisted(() => ({
  mockUseDualStrategyStore: vi.fn(),
}))

vi.mock('@/store/dualStrategyStore', () => ({
  useDualStrategyStore: mockUseDualStrategyStore,
}))

// 延迟导入被测组件，确保 vi.mock 先生效
const HotSectorWidget = (await import('./HotSectorWidget')).default

// ============================================================
// 辅助函数
// ============================================================

/** 构建默认 WidgetConfig */
function buildConfig(title = '热门板块'): WidgetConfig {
  return buildWidgetConfig({
    instanceId: 'hot-sector-1',
    widgetId: 'hotSector',
    title,
  })
}

/** 构建一组合理的默认热门板块数据（三类动作 + 三档分数各覆盖） */
function buildHotSectors(): HotSectorData[] {
  return [
    {
      symbol: '600519',
      name: '贵州茅台',
      score: 4.5,
      action: 'immediate',
      dimensions: { momentum: 4.5, sentiment: 4.0, technical: 3.5, valuation: 3.0, composite: 4.2 },
    },
    {
      symbol: '002230',
      name: '科大讯飞',
      score: 3.2,
      action: 'probe',
      dimensions: { momentum: 3.2, sentiment: 3.0, technical: 2.8, valuation: 2.5, composite: 3.1 },
    },
    {
      symbol: '000858',
      name: '五粮液',
      score: 0.5,
      action: 'ignore',
      dimensions: { momentum: 0.5, sentiment: 0.3, technical: 0.4, valuation: 0.2, composite: 0.3 },
    },
  ]
}

/** 配置 mock store 返回指定 hotSectors（忽略 selector 参数） */
function setupStore(hotSectors: HotSectorData[]): void {
  mockUseDualStrategyStore.mockReturnValue(hotSectors as never)
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
describe('HotSectorWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupStore(buildHotSectors())
  })

  // ----------------------------------------------------------
  // 默认 / 标题（store 路径）
  // ----------------------------------------------------------
  it('renders widget title from config via store path by default', () => {
    setupStore(buildHotSectors())
    render(<HotSectorWidget config={buildConfig('热门板块策略')} />)

    expect(screen.getByText('热门板块策略')).toBeInTheDocument()
  })

  // ----------------------------------------------------------
  // 空态
  // ----------------------------------------------------------
  it('renders empty state when hotSectors is empty (store path)', () => {
    setupStore([])
    render(<HotSectorWidget config={buildConfig()} />)

    expect(screen.getByText('暂无热门板块策略')).toBeInTheDocument()
  })

  it('renders empty state when data prop hotSectors is empty', () => {
    setupStore(buildHotSectors())
    render(<HotSectorWidget config={buildConfig()} data={{ hotSectors: [] }} />)

    expect(screen.getByText('暂无热门板块策略')).toBeInTheDocument()
  })

  // ----------------------------------------------------------
  // getActionLabel 三动作
  // ----------------------------------------------------------
  it('maps action immediate/probe/ignore to correct labels', () => {
    setupStore(buildHotSectors())
    render(<HotSectorWidget config={buildConfig()} />)

    expect(screen.getByText('立即跟进')).toBeInTheDocument()
    expect(screen.getByText('试探')).toBeInTheDocument()
    expect(screen.getByText('不追')).toBeInTheDocument()
  })

  // ----------------------------------------------------------
  // getScoreColor 五档颜色
  // ----------------------------------------------------------
  it('colors score 4.5 (>=4) with EXCELLENT color', () => {
    setupStore(buildHotSectors())
    render(<HotSectorWidget config={buildConfig()} />)

    const value = screen.getByText('4.50')
    expect(value).toBeInTheDocument()
    expectInlineColor(value, SCORE_LEVELS.EXCELLENT.color)
  })

  it('colors score 3.2 (>=3) with GOOD color', () => {
    setupStore(buildHotSectors())
    render(<HotSectorWidget config={buildConfig()} />)

    const value = screen.getByText('3.20')
    expect(value).toBeInTheDocument()
    expectInlineColor(value, SCORE_LEVELS.GOOD.color)
  })

  it('colors score 0.5 (<1) with BAD color', () => {
    setupStore(buildHotSectors())
    render(<HotSectorWidget config={buildConfig()} />)

    const value = screen.getByText('0.50')
    expect(value).toBeInTheDocument()
    expectInlineColor(value, SCORE_LEVELS.BAD.color)
  })

  it('colors a boundary score of 2.0 (>=2) with AVERAGE color', () => {
    setupStore([
      {
        symbol: 'X',
        name: '边界股',
        score: 2.0,
        action: 'probe',
        dimensions: { momentum: 2, sentiment: 2, technical: 2, valuation: 2, composite: 2 },
      },
    ])
    render(<HotSectorWidget config={buildConfig()} />)

    const value = screen.getByText('2.00')
    expect(value).toBeInTheDocument()
    expectInlineColor(value, SCORE_LEVELS.AVERAGE.color)
  })

  // ----------------------------------------------------------
  // score.toFixed(2) 显示
  // ----------------------------------------------------------
  it('renders score with two decimal places', () => {
    setupStore(buildHotSectors())
    render(<HotSectorWidget config={buildConfig()} />)

    expect(screen.getByText('4.50')).toBeInTheDocument()
    expect(screen.getByText('0.50')).toBeInTheDocument()
  })

  // ----------------------------------------------------------
  // 五维评分渲染
  // ----------------------------------------------------------
  it('renders the five dimension names and their values (toFixed 1)', () => {
    setupStore(buildHotSectors())
    render(<HotSectorWidget config={buildConfig()} />)

    // 维度中文名在每个板块各出现一次（3 个板块）→ 用 getAllByText 校验数量
    expect(screen.getAllByText('动量')).toHaveLength(3)
    expect(screen.getAllByText('情绪')).toHaveLength(3)
    expect(screen.getAllByText('技术')).toHaveLength(3)
    expect(screen.getAllByText('估值')).toHaveLength(3)
    // 茅台 momentum=4.5 → "4.5"，composite=4.2 → "4.2"（数值唯一）
    expect(screen.getByText('4.5')).toBeInTheDocument()
    expect(screen.getByText('4.2')).toBeInTheDocument()
  })

  // ----------------------------------------------------------
  // data prop 覆盖路径
  // ----------------------------------------------------------
  it('prefers data prop hotSectors over store', () => {
    // store 提供 3 条，data prop 仅 1 条（贵州茅台）
    setupStore(buildHotSectors())
    render(
      <HotSectorWidget
        config={buildConfig()}
        data={{
          hotSectors: [
            {
              symbol: '600519',
              name: '贵州茅台',
              score: 4.5,
              action: 'immediate',
              dimensions: { momentum: 4.5, sentiment: 4.0, technical: 3.5, valuation: 3.0, composite: 4.2 },
            },
          ],
        }}
      />,
    )

    // 仅渲染 data prop 提供的 1 条
    expect(screen.getByText('贵州茅台')).toBeInTheDocument()
    expect(screen.queryByText('科大讯飞')).not.toBeInTheDocument()
    expect(screen.queryByText('五粮液')).not.toBeInTheDocument()
  })

  // ----------------------------------------------------------
  // 等级锚点（防御 getScoreColor 阈值与 SCORE_LEVELS 不同步）
  // ----------------------------------------------------------
  it('getScoreColor 阈值（score/20）应与 SCORE_LEVELS.min 一致', () => {
    // 源码: score >= SCORE_LEVELS.X.min / 20
    expect(SCORE_LEVELS.EXCELLENT.min / 20).toBe(4)
    expect(SCORE_LEVELS.GOOD.min / 20).toBe(3)
    expect(SCORE_LEVELS.AVERAGE.min / 20).toBe(2)
    expect(SCORE_LEVELS.POOR.min / 20).toBe(1)
    expect(SCORE_LEVELS.EXCELLENT.color).toBe('#22c55e')
    expect(SCORE_LEVELS.GOOD.color).toBe('#3b82f6')
    expect(SCORE_LEVELS.AVERAGE.color).toBe('#f59e0b')
    expect(SCORE_LEVELS.POOR.color).toBe('#f97316')
    expect(SCORE_LEVELS.BAD.color).toBe('#ef4444')
  })
})
