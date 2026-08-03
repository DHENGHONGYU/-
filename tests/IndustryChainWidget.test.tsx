/**
 * @fileoverview IndustryChainWidget 产业链图谱渲染测试
 * @description 验证产业链图谱组件的核心渲染行为：
 *  1. 标题和关系图例正确渲染
 *  2. SVG 图谱渲染列标签（上游/中游/下游/横向）
 *  3. 节点和连线正确渲染
 *  4. 相关标的 badge 展示
 *
 * @since v2.7.0 - 2026-07-20
 * @doc cockpit-industrychain
 */
import { describe, expect, it, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

// ============================================================
// Mock logger（组件依赖）
// ============================================================
vi.mock('@/lib/logger', () => ({
  getLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

// ============================================================
// 导入被测组件（在所有 mock 之后）
// ============================================================
const { IndustryChainWidget } = await import('@/cockpit/widgets/IndustryChainWidget')

// ============================================================
// 测试套件
// ============================================================
describe('IndustryChainWidget', () => {
  afterEach(() => {
    cleanup()
  })

  // ----------------------------------------------------------
  // 基础渲染
  // ----------------------------------------------------------
  it('渲染标题"产业链图谱"', () => {
    render(<IndustryChainWidget />)
    expect(screen.getByText('产业链图谱')).toBeDefined()
  })

  it('渲染关系图例（供应/竞争/协同/替代）', () => {
    render(<IndustryChainWidget />)
    expect(screen.getByText('供应')).toBeDefined()
    expect(screen.getByText('竞争')).toBeDefined()
    expect(screen.getByText('协同')).toBeDefined()
    expect(screen.getByText('替代')).toBeDefined()
  })

  // ----------------------------------------------------------
  // SVG 列标签
  // ----------------------------------------------------------
  it('SVG 渲染四列标签（上游/中游/下游/横向）', () => {
    render(<IndustryChainWidget />)
    expect(screen.getByText('上游')).toBeDefined()
    expect(screen.getByText('中游')).toBeDefined()
    expect(screen.getByText('下游')).toBeDefined()
    expect(screen.getByText('横向')).toBeDefined()
  })

  // ----------------------------------------------------------
  // 节点渲染
  // ----------------------------------------------------------
  it('渲染上游节点（集成电路/量子信息/新能源/新材料）', () => {
    render(<IndustryChainWidget />)
    expect(screen.getByText('集成电路')).toBeDefined()
    expect(screen.getByText('量子信息')).toBeDefined()
    expect(screen.getByText('新能源')).toBeDefined()
    expect(screen.getByText('新材料')).toBeDefined()
  })

  it('渲染中游节点（云计算/大数据/物联网等）', () => {
    render(<IndustryChainWidget />)
    expect(screen.getByText('云计算')).toBeDefined()
    expect(screen.getByText('大数据')).toBeDefined()
    expect(screen.getByText('物联网')).toBeDefined()
  })

  it('渲染下游节点（新能源汽车/机器人等）', () => {
    render(<IndustryChainWidget />)
    expect(screen.getByText('新能源汽车')).toBeDefined()
    expect(screen.getByText('机器人')).toBeDefined()
  })

  // ----------------------------------------------------------
  // 相关标的展示
  // ----------------------------------------------------------
  it('渲染"相关标的"区域', () => {
    render(<IndustryChainWidget />)
    expect(screen.getByText('相关标的')).toBeDefined()
  })

  it('相关标的包含中芯国际和宁德时代', () => {
    render(<IndustryChainWidget />)
    expect(screen.getByText(/中芯国际/)).toBeDefined()
    expect(screen.getByText(/宁德时代/)).toBeDefined()
  })

  // ----------------------------------------------------------
  // SVG 结构
  // ----------------------------------------------------------
  it('渲染 SVG 图谱容器', () => {
    const { container } = render(<IndustryChainWidget />)
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
  })

  it('SVG 包含节点圆圈', () => {
    const { container } = render(<IndustryChainWidget />)
    const circles = container.querySelectorAll('svg circle')
    expect(circles.length).toBeGreaterThan(0)
  })

  it('SVG 包含连线', () => {
    const { container } = render(<IndustryChainWidget />)
    const lines = container.querySelectorAll('svg line')
    expect(lines.length).toBeGreaterThan(0)
  })

  it('组件渲染不崩溃（冒烟测试）', () => {
    const { container } = render(<IndustryChainWidget />)
    expect(container.firstChild).not.toBeNull()
  })
})
