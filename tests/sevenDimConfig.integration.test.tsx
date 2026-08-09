/**
 * Flux 三层测试：七维配置页组件集成测试
 *
 * 覆盖完整的用户交互 → Store → UI 更新链路：
 * 1. 切换模板 → Store 维度变化 → UI 计数更新
 * 2. 维度开关 → Store 启用数变化 → UI 更新
 * 3. 错误状态 → Store error → UI 错误提示
 * 4. 采集进度 → Store isCollecting → UI 进度条
 * 5. 全局参数 → 输入修改 → Store 同步
 *
 * 对标：data-flow-integrity-audit SKILL §5.4 Flux/React 单向数据流测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import SevenDimConfigPage from '@/pages/input/SevenDimConfigPage'
import { useSevenDimConfigStore } from '@/store/sevenDimConfigStore'
import { DIMENSION_COUNT } from '@/config/collectConfig'

// Mock logger
vi.mock('@/lib/logger', () => ({
  getLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}))

// Mock ErrorBoundary
vi.mock('@/components/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/input/seven-dim']}>
      <SevenDimConfigPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  useSevenDimConfigStore.getState().reset()
})

describe('Flux 集成测试 — 模板切换 → Store → UI', () => {
  it(`切换模板后维度数从 ${DIMENSION_COUNT} 变为 4`, () => {
    renderPage()
    expect(screen.getByText(`${DIMENSION_COUNT} / ${DIMENSION_COUNT}`)).toBeInTheDocument()

    fireEvent.click(screen.getByText('价值投资'))

    // Store 验证
    expect(useSevenDimConfigStore.getState().dimensions.filter(d => d.enabled).length).toBe(4)
    // UI 验证
    expect(screen.getByText(`4 / ${DIMENSION_COUNT}`)).toBeInTheDocument()
  })

  it('切换模板后 isDirty=true，保存按钮启用', () => {
    renderPage()
    fireEvent.click(screen.getByText('成长投资'))

    expect(useSevenDimConfigStore.getState().isDirty).toBe(true)
    expect(screen.getByText('保存配置')).not.toBeDisabled()
  })

  it('切换模板后重置按钮可恢复默认配置', () => {
    renderPage()
    fireEvent.click(screen.getByText('价值投资'))
    expect(useSevenDimConfigStore.getState().isDirty).toBe(true)

    // 点击重置恢复默认
    fireEvent.click(screen.getByText('重置为默认'))
    expect(useSevenDimConfigStore.getState().isDirty).toBe(false)
    expect(screen.getByText(`${DIMENSION_COUNT} / ${DIMENSION_COUNT}`)).toBeInTheDocument()
  })
})

describe('Flux 集成测试 — 维度开关 → Store → UI', () => {
  it('切换到 value 模板后禁用维度 01，计数从 4 降为 3', () => {
    renderPage()
    fireEvent.click(screen.getByText('价值投资'))
    expect(screen.getByText(`4 / ${DIMENSION_COUNT}`)).toBeInTheDocument()

    const switches = screen.getAllByRole('switch')
    fireEvent.click(switches[0]!) // 禁用第一个维度

    // Store 验证
    expect(useSevenDimConfigStore.getState().dimensions.filter(d => d.enabled).length).toBe(3)
    // UI 验证
    expect(screen.getByText(`3 / ${DIMENSION_COUNT}`)).toBeInTheDocument()
  })
})

describe('Flux 集成测试 — 错误状态 → Store → UI', () => {
  it('Store error 非空时渲染错误提示', () => {
    useSevenDimConfigStore.setState({ error: '采集失败：网络连接超时' })
    renderPage()
    expect(screen.getByText('采集失败：网络连接超时')).toBeInTheDocument()
  })

  it('点击关闭按钮清除 error', () => {
    useSevenDimConfigStore.setState({ error: '测试错误' })
    renderPage()
    fireEvent.click(screen.getByText('关闭'))
    expect(useSevenDimConfigStore.getState().error).toBeNull()
  })
})

describe('Flux 集成测试 — 采集状态 → Store → UI', () => {
  it('isCollecting=true 时渲染进度条和"采集中..."按钮', () => {
    useSevenDimConfigStore.setState({ isCollecting: true, collectProgress: 50 })
    renderPage()

    // UI 验证
    expect(screen.getByText('50%')).toBeInTheDocument()
    const matches = screen.getAllByText(/采集中/)
    expect(matches.length).toBeGreaterThanOrEqual(1)
  })
})

describe('Flux 集成测试 — 全局参数 → Store', () => {
  it('修改标的数量同步更新 Store', () => {
    renderPage()
    const input = screen.getByDisplayValue('40')
    fireEvent.change(input, { target: { value: '100' } })
    expect(useSevenDimConfigStore.getState().symbolCount).toBe(100)
  })

  it('修改历史天数同步更新 Store', () => {
    renderPage()
    const input = screen.getByDisplayValue('252')
    fireEvent.change(input, { target: { value: '500' } })
    expect(useSevenDimConfigStore.getState().historyDays).toBe(500)
  })
})
