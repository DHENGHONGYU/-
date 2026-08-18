/**
 * @fileoverview IndustryChainWidget 渲染测试
 * @description 验证产业链图谱（静态 SVG 可视化）的核心渲染行为：
 *  1. 标题与关系图例（供应/竞争/协同/替代）
 *  2. SVG 图谱正确渲染上中下游/横向列标签与节点（id + 名称）
 *  3. 示例标的（相关标的）徽章渲染节点对应的股票名称
 *
 * 注：当前组件为只读静态 SVG 图谱，不再包含下拉切换、实时行情拉取与价格展示，
 * 因此原 v2 交互用例已对齐为断言组件「当前」实际渲染的内容。
 *
 * @since v2.7.0 - 2026-07-20
 * @doc cockpit-industrychain-v2
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

// ============================================================
// 导入被测组件（静态 SVG 图谱）
// ============================================================
const { IndustryChainWidget } = await import('@/cockpit/widgets/IndustryChainWidget')

// ============================================================
// 辅助：断言 SVG <text> 中包含指定子串（RTL getByText 对 SVG 文本支持不稳）
// ============================================================
function expectSvgText(substr: string): void {
  const texts = Array.from(document.querySelectorAll('svg text')).map((t) => t.textContent ?? '')
  expect(texts.some((t) => t.includes(substr))).toBe(true)
}

// ============================================================
// 测试套件
// ============================================================
describe('IndustryChainWidget', () => {
  beforeEach(() => {
    // 无需 mock：静态组件仅依赖本地 INDUSTRY_CHAIN 常量
  })

  afterEach(() => {
    cleanup()
  })

  // ----------------------------------------------------------
  // 基础渲染
  // ----------------------------------------------------------
  it('渲染标题', () => {
    render(<IndustryChainWidget />)
    expect(screen.getByText('产业链图谱')).toBeDefined()
  })

  it('默认渲染上游层级列标签', () => {
    render(<IndustryChainWidget />)
    // 静态图谱始终渲染上游列标签
    expectSvgText('上游')
  })

  it('渲染关系图例（供应/竞争/协同/替代）', () => {
    render(<IndustryChainWidget />)

    expect(screen.getByText('供应')).toBeDefined()
    expect(screen.getByText('竞争')).toBeDefined()
    expect(screen.getByText('协同')).toBeDefined()
    expect(screen.getByText('替代')).toBeDefined()
  })

  // ----------------------------------------------------------
  // 层级列标签（静态图谱同时渲染全部层级）
  // ----------------------------------------------------------
  it('渲染中游层级列标签', () => {
    render(<IndustryChainWidget />)
    expectSvgText('中游')
  })

  it('渲染下游层级列标签', () => {
    render(<IndustryChainWidget />)
    expectSvgText('下游')
  })

  it('渲染横向层级列标签', () => {
    render(<IndustryChainWidget />)
    expectSvgText('横向')
  })

  it('渲染全部四个层级列标签', () => {
    render(<IndustryChainWidget />)
    expectSvgText('上游')
    expectSvgText('中游')
    expectSvgText('下游')
    expectSvgText('横向')
  })

  // ----------------------------------------------------------
  // 核心示例标的展示
  // ----------------------------------------------------------
  it('渲染核心标的区域标题', () => {
    render(<IndustryChainWidget />)
    // 当前组件以「相关标的」呈现示例标的徽章区域
    expect(screen.getByText('相关标的')).toBeDefined()
  })

  it('渲染示例标的徽章（上游核心标的名称）', () => {
    render(<IndustryChainWidget />)

    // 上游节点的示例标的来自本地 INDUSTRY_CHAIN 数据，直接静态渲染
    expect(screen.getByText(/中芯国际/)).toBeDefined()
    expect(screen.getByText(/宁德时代/)).toBeDefined()
  })

  it('示例标的徽章包含所属节点与股票名称', () => {
    render(<IndustryChainWidget />)
    // 徽章格式：节点名: 股票名（如「集成电路: 中芯国际」）
    expect(screen.getByText(/集成电路: 中芯国际/)).toBeDefined()
  })

  // ----------------------------------------------------------
  // SVG 节点渲染
  // ----------------------------------------------------------
  it('渲染产业链节点名称（含无示例标的的节点）', () => {
    render(<IndustryChainWidget />)
    // 量子信息(QT)节点无示例标的，但节点名称仍随 SVG 渲染
    expectSvgText('量子信息')
  })

  it('渲染产业链节点 ID', () => {
    render(<IndustryChainWidget />)
    // 集成电路节点 id 为 IC
    expectSvgText('IC')
  })

  it('组件渲染不崩溃', () => {
    render(<IndustryChainWidget />)
    expect(screen.getByText('产业链图谱')).toBeDefined()
  })
})
