/**
 * SevenDimConfigPage 组件测试
 *
 * 覆盖场景：
 * 1. 页面渲染：标题、面包屑、分区标题
 * 2. 策略模板卡片：5 个卡片渲染、当前选中标识
 * 3. 维度开关面板：10 个维度行、色块、Badge
 * 4. 模板切换交互：点击卡片切换、维度数变化
 * 5. 维度开关交互：点击 Switch、启用数变化
 * 6. 全局参数：标的数/历史天数输入
 * 7. 额度预估：月调用总量显示
 * 8. 操作按钮：禁用状态、按钮文案
 * 9. 边界测试：全部维度禁用、采集进度条、错误提示
 * 10. 可访问性：语义化标签
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { UI_TEXT } from '@/constants/uiText'
import SevenDimConfigPage from '@/pages/input/SevenDimConfigPage'
import { useSevenDimConfigStore } from '@/store/sevenDimConfigStore'
import { STRATEGY_TEMPLATES, DEFAULT_DIMENSIONS, DIMENSION_COUNT } from '@/config/collectConfig'

// Mock ErrorBoundary
vi.mock('@/components/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// Mock logger
vi.mock('@/lib/logger', () => ({
  getLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}))

beforeEach(() => {
  useSevenDimConfigStore.getState().reset()
})

/**
 * Arrange-Act-Assert 辅助：渲染页面
 */
function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/input/seven-dim']}>
      <SevenDimConfigPage />
    </MemoryRouter>,
  )
}

describe('SevenDimConfigPage - 页面渲染', () => {
  it('渲染主标题 "七维采集配置"', () => {
    renderPage()
    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toHaveTextContent('七维采集配置')
  })

  it('渲染副标题包含 "采集维度"', () => {
    renderPage()
    const matches = screen.getAllByText(/采集维度/)
    expect(matches.length).toBeGreaterThanOrEqual(1)
  })

  it('渲染 "V9 新建" 徽章', () => {
    renderPage()
    expect(screen.getByText('V9 新建')).toBeInTheDocument()
  })

  it('渲染面包屑（首页 → 输入舱 → 七维采集配置）', () => {
    renderPage()
    expect(screen.getByText(UI_TEXT.cockpit.home)).toBeInTheDocument()
    expect(screen.getByText(UI_TEXT.cockpit.inputCabin)).toBeInTheDocument()
    // 七维采集配置同时出现在标题和面包屑中，用 getAllByText
    const matches = screen.getAllByText('七维采集配置')
    expect(matches.length).toBeGreaterThanOrEqual(2)
  })

  it('渲染 "策略模板" 分区标题', () => {
    renderPage()
    expect(screen.getByText('策略模板')).toBeInTheDocument()
  })

  it('渲染 "采集维度" 分区标题', () => {
    renderPage()
    expect(screen.getByText('采集维度')).toBeInTheDocument()
  })

  it('渲染 "全局参数" 卡片标题', () => {
    renderPage()
    expect(screen.getByText('全局参数')).toBeInTheDocument()
  })

  it('渲染 "额度预估" 卡片标题', () => {
    renderPage()
    expect(screen.getByText('额度预估')).toBeInTheDocument()
  })
})

describe('SevenDimConfigPage - 策略模板卡片', () => {
  it('渲染全部 5 个策略模板卡片', () => {
    renderPage()
    for (const template of STRATEGY_TEMPLATES) {
      expect(screen.getByText(template.name)).toBeInTheDocument()
    }
  })

  it('full 模板显示 "当前" 徽章', () => {
    renderPage()
    expect(screen.getByText('当前')).toBeInTheDocument()
  })

  it('每个卡片显示维度数', () => {
    renderPage()
    // full 和 defense 都有不同数量的维度，用 getAllByText
    for (const template of STRATEGY_TEMPLATES) {
      const matches = screen.getAllByText(`${template.dimensions.length} 个维度`)
      expect(matches.length).toBeGreaterThanOrEqual(1)
    }
  })

  it('渲染价值投资描述', () => {
    renderPage()
    expect(screen.getByText(/低频深度采集/)).toBeInTheDocument()
  })

  it('渲染全维度描述', () => {
    renderPage()
    expect(screen.getByText(/高频全量采集/)).toBeInTheDocument()
  })
})

describe('SevenDimConfigPage - 维度开关面板', () => {
  it('渲染全部 10 个维度行', () => {
    renderPage()
    for (const dim of DEFAULT_DIMENSIONS) {
      expect(screen.getByText(new RegExp(`${dim.code}.*${dim.name}`))).toBeInTheDocument()
    }
  })

  it('渲染维度计数 Badge "10 / 10"', () => {
    renderPage()
    expect(screen.getByText(`${DIMENSION_COUNT} / ${DIMENSION_COUNT}`)).toBeInTheDocument()
  })

  it('渲染 "已启用 10 / 10 个维度" 描述', () => {
    renderPage()
    expect(screen.getByText(new RegExp(`已启用 ${DIMENSION_COUNT}`))).toBeInTheDocument()
  })

  it('渲染重要性 Badge（核心/高/中/低）', () => {
    renderPage()
    expect(screen.getAllByText(UI_TEXT.common.core).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('高').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('中').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('低').length).toBeGreaterThanOrEqual(1)
  })

  it('渲染频率标签', () => {
    renderPage()
    // value 模板下启用维度频率为 daily → "每日"，用 getAllByText
    const matches = screen.getAllByText(/每日/)
    expect(matches.length).toBeGreaterThanOrEqual(1)
  })

  it('渲染数据源标签（AKShare）', () => {
    renderPage()
    // 多个维度使用 AKShare，用 getAllByText
    const matches = screen.getAllByText(/AKShare/)
    expect(matches.length).toBeGreaterThanOrEqual(1)
  })

  it('渲染存储策略标签', () => {
    renderPage()
    expect(screen.getAllByText(/全量存储/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/轻量索引/).length).toBeGreaterThanOrEqual(1)
  })

  it('启用维度显示字段标签', () => {
    renderPage()
    // 01 维度启用，应显示 name/industry 等 fields
    expect(screen.getAllByText('name').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('industry').length).toBeGreaterThanOrEqual(1)
  })
})

describe('SevenDimConfigPage - 模板切换交互', () => {
  it('点击 "全维度" 卡片切换到 full 模板', () => {
    renderPage()
    // 初始为 full（10/10），先切换到 value（4/10）
    fireEvent.click(screen.getByText('价值投资'))
    expect(screen.getByText(`4 / ${DIMENSION_COUNT}`)).toBeInTheDocument()

    // 点击全维度卡片切换回 full
    fireEvent.click(screen.getByText(UI_TEXT.input.dashboard.allDimensions))

    // 切换后 10/10
    expect(screen.getByText(`${DIMENSION_COUNT} / ${DIMENSION_COUNT}`)).toBeInTheDocument()
  })

  it('切换到 growth 模板后维度数变为 5', () => {
    renderPage()
    fireEvent.click(screen.getByText('成长投资'))
    expect(screen.getByText(`5 / ${DIMENSION_COUNT}`)).toBeInTheDocument()
  })

  it('切换到 defense 模板后维度数变为 4', () => {
    renderPage()
    fireEvent.click(screen.getByText('防御配置'))
    expect(screen.getByText(`4 / ${DIMENSION_COUNT}`)).toBeInTheDocument()
  })

  it('切换到 cycle 模板后维度数变为 6', () => {
    renderPage()
    fireEvent.click(screen.getByText('周期轮动'))
    expect(screen.getByText(`6 / ${DIMENSION_COUNT}`)).toBeInTheDocument()
  })

  it('切换模板后 "当前" 徽章移动到新模板', () => {
    renderPage()
    fireEvent.click(screen.getByText('成长投资'))
    // 仍然只有一个 "当前" 徽章
    expect(screen.getAllByText('当前')).toHaveLength(1)
  })

  it('切回 value 模板后维度数恢复 4', () => {
    renderPage()
    fireEvent.click(screen.getByText(UI_TEXT.input.dashboard.allDimensions))
    expect(screen.getByText(`${DIMENSION_COUNT} / ${DIMENSION_COUNT}`)).toBeInTheDocument()
    fireEvent.click(screen.getByText('价值投资'))
    expect(screen.getByText(`4 / ${DIMENSION_COUNT}`)).toBeInTheDocument()
  })
})

describe('SevenDimConfigPage - 维度开关交互', () => {
  it('点击维度 Switch 切换启用状态', () => {
    renderPage()
    // 先切换到 value 模板（4/10），否则 full 模板无从禁用
    fireEvent.click(screen.getByText('价值投资'))
    expect(screen.getByText(`4 / ${DIMENSION_COUNT}`)).toBeInTheDocument()

    // 找到第一个 checkbox（维度 01 的 Switch）
    const switches = screen.getAllByRole('switch')
    expect(switches.length).toBeGreaterThanOrEqual(DIMENSION_COUNT)

    // 点击禁用维度 01（从启用→禁用）
    fireEvent.click(switches[0]!)
    expect(screen.getByText(`3 / ${DIMENSION_COUNT}`)).toBeInTheDocument()
  })

  it('启用未启用维度后计数增加', () => {
    renderPage()
    // 先切换到 value 模板，其中 05 默认未启用
    fireEvent.click(screen.getByText('价值投资'))
    const switches = screen.getAllByRole('switch')

    // 维度 05 在 value 模板下未启用，索引为 4
    fireEvent.click(switches[4]!)
    expect(screen.getByText(`5 / ${DIMENSION_COUNT}`)).toBeInTheDocument()
  })

  it('连续切换同一维度恢复原状', () => {
    renderPage()
    // 先切换到 value 模板
    fireEvent.click(screen.getByText('价值投资'))
    expect(screen.getByText(`4 / ${DIMENSION_COUNT}`)).toBeInTheDocument()
    const switches = screen.getAllByRole('switch')
    fireEvent.click(switches[0]!)
    expect(screen.getByText(`3 / ${DIMENSION_COUNT}`)).toBeInTheDocument()
    fireEvent.click(switches[0]!)
    expect(screen.getByText(`4 / ${DIMENSION_COUNT}`)).toBeInTheDocument()
  })
})

describe('SevenDimConfigPage - 全局参数', () => {
  it('渲染标的数量输入框（初始值 40）', () => {
    renderPage()
    const input = screen.getByDisplayValue('40')
    expect(input).toBeInTheDocument()
  })

  it('渲染历史天数输入框（初始值 252）', () => {
    renderPage()
    const input = screen.getByDisplayValue('252')
    expect(input).toBeInTheDocument()
  })

  it('渲染上限提示', () => {
    renderPage()
    expect(screen.getByText(/上限 500/)).toBeInTheDocument()
  })

  it('修改标的数量更新 Store', () => {
    renderPage()
    const symbolInput = screen.getByDisplayValue('40')
    fireEvent.change(symbolInput, { target: { value: '100' } })
    expect(useSevenDimConfigStore.getState().symbolCount).toBe(100)
  })

  it('修改历史天数更新 Store', () => {
    renderPage()
    const historyInput = screen.getByDisplayValue('252')
    fireEvent.change(historyInput, { target: { value: '500' } })
    expect(useSevenDimConfigStore.getState().historyDays).toBe(500)
  })
})

describe('SevenDimConfigPage - 额度预估', () => {
  it('渲染 "月调用总量" 标签', () => {
    renderPage()
    expect(screen.getByText('月调用总量')).toBeInTheDocument()
  })

  it('渲染月调用数值（大于 0）', () => {
    renderPage()
    const estimate = useSevenDimConfigStore.getState().monthlyCallEstimate()
    expect(screen.getByText(estimate.toLocaleString())).toBeInTheDocument()
  })

  it('渲染 "AKShare 额度" 行', () => {
    renderPage()
    expect(screen.getByText('AKShare 额度')).toBeInTheDocument()
  })

  it('渲染 "免费无限" Badge', () => {
    renderPage()
    expect(screen.getByText('免费无限')).toBeInTheDocument()
  })

  it('渲染日调用上限值', () => {
    renderPage()
    const label = screen.getByText('日调用上限')
    expect(label).toBeInTheDocument()
    const value = label.nextElementSibling ?? label.parentElement?.querySelector('span:last-child')
    expect(value?.textContent).toBe('2000')
  })

  it('渲染额度使用率', () => {
    renderPage()
    expect(screen.getByText(/%/)).toBeInTheDocument()
  })
})

describe('SevenDimConfigPage - 操作按钮', () => {
  it('渲染 "开始采集" 按钮', () => {
    renderPage()
    expect(screen.getByText('开始采集')).toBeInTheDocument()
  })

  it('渲染 "保存配置" 按钮', () => {
    renderPage()
    expect(screen.getByText('保存配置')).toBeInTheDocument()
  })

  it('渲染 "重置为默认" 按钮', () => {
    renderPage()
    expect(screen.getByText('重置为默认')).toBeInTheDocument()
  })

  it('初始状态保存按钮禁用（isDirty=false）', () => {
    renderPage()
    const saveButton = screen.getByText('保存配置')
    expect(saveButton).toBeDisabled()
  })

  it('修改维度后保存按钮启用', () => {
    renderPage()
    fireEvent.click(screen.getByText('成长投资'))
    expect(screen.getByText('保存配置')).not.toBeDisabled()
  })

  it('点击重置按钮恢复默认配置', () => {
    renderPage()
    // 先切换到 value 模板偏离默认
    fireEvent.click(screen.getByText('价值投资'))
    expect(screen.getByText(`4 / ${DIMENSION_COUNT}`)).toBeInTheDocument()
    // 点击重置
    fireEvent.click(screen.getByText('重置为默认'))
    expect(screen.getByText(`${DIMENSION_COUNT} / ${DIMENSION_COUNT}`)).toBeInTheDocument()
  })
})

describe('SevenDimConfigPage - 边界测试', () => {
  it('全部维度禁用时 "开始采集" 按钮禁用', () => {
    renderPage()
    // 禁用全部 10 个维度（full 模板默认全部启用）
    const switches = screen.getAllByRole('switch')
    for (let i = 0; i < DIMENSION_COUNT; i++) {
      fireEvent.click(switches[i]!)
    }
    expect(screen.getByText(`0 / ${DIMENSION_COUNT}`)).toBeInTheDocument()
    expect(screen.getByText('开始采集')).toBeDisabled()
  })

  it('Store error 状态时渲染错误提示', () => {
    useSevenDimConfigStore.setState({ error: '测试错误信息' })
    renderPage()
    expect(screen.getByText('测试错误信息')).toBeInTheDocument()
    expect(screen.getByText(UI_TEXT.common.close)).toBeInTheDocument()
  })

  it('点击关闭按钮清除错误', () => {
    useSevenDimConfigStore.setState({ error: '测试错误' })
    renderPage()
    fireEvent.click(screen.getByText(UI_TEXT.common.close))
    expect(useSevenDimConfigStore.getState().error).toBe(null)
  })

  it('isCollecting 时渲染进度条', () => {
    useSevenDimConfigStore.setState({ isCollecting: true, collectProgress: 50 })
    renderPage()
    // "采集中..." 同时出现在按钮和进度条标签中，用 getAllByText
    const matches = screen.getAllByText(/采集中/)
    expect(matches.length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('50%')).toBeInTheDocument()
  })

  it('isCollecting 时按钮文案变为 "采集中..."', () => {
    useSevenDimConfigStore.setState({ isCollecting: true })
    renderPage()
    const matches = screen.getAllByText(/采集中/)
    expect(matches.length).toBeGreaterThanOrEqual(1)
  })

  it('isSaving 时按钮文案变为 "保存中..."', () => {
    useSevenDimConfigStore.setState({ isSaving: true, isDirty: true })
    renderPage()
    expect(screen.getByText('保存中...')).toBeInTheDocument()
  })

  it('isSaving 时渲染不可交互提示', () => {
    useSevenDimConfigStore.setState({ isSaving: true })
    renderPage()
    expect(screen.getByText(/配置保存中/)).toBeInTheDocument()
  })

  it('isCollecting 时渲染采集中状态', () => {
    useSevenDimConfigStore.setState({ isCollecting: true })
    renderPage()
    expect(screen.getAllByText(/采集中/).length).toBeGreaterThanOrEqual(1)
  })
})

describe('SevenDimConfigPage - 可访问性', () => {
  it('主标题使用 h1 标签', () => {
    renderPage()
    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toHaveTextContent('七维采集配置')
  })

  it('分区标题使用 h2 标签', () => {
    renderPage()
    const headings = screen.getAllByRole('heading', { level: 2 })
    expect(headings.length).toBeGreaterThanOrEqual(1)
  })

  it('标的数量输入框有 Label', () => {
    renderPage()
    expect(screen.getByText('标的数量')).toBeInTheDocument()
  })

  it('历史天数输入框有 Label', () => {
    renderPage()
    expect(screen.getByText('历史天数')).toBeInTheDocument()
  })

  it('面包屑首页链接指向根路径', () => {
    renderPage()
    const homeLink = screen.getByText(UI_TEXT.cockpit.home).closest('a')
    expect(homeLink).toHaveAttribute('href', '/')
  })

  it('面包屑输入舱链接指向 /input', () => {
    renderPage()
    const inputLink = screen.getByText(UI_TEXT.cockpit.inputCabin).closest('a')
    expect(inputLink).toHaveAttribute('href', '/input')
  })
})
