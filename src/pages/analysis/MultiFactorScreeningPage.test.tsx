/**
 * @module MultiFactorScreeningPage.test
 * @description 多因子筛选页面单元测试：验证挂载加载模板与结果渲染。
 */

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router'
import MultiFactorScreeningPage from './MultiFactorScreeningPage'

const loadSavedTemplatesMock = vi.fn()

vi.mock('@/store/multiFactorScreeningStore', () => ({
  useMultiFactorScreeningStore: vi.fn((selector?: (state: unknown) => unknown) => {
    const state = {
      results: [],
      loading: false,
      error: null,
      loadSavedTemplates: loadSavedTemplatesMock,
    }
    return selector ? selector(state) : state
  }),
}))

vi.mock('@/components/analysis/screening/MultiFactorFilterPanel', () => ({
  MultiFactorFilterPanel: () => <div data-testid="filter-panel">Filter Panel</div>,
}))

function renderWithRouter(ui: React.ReactElement) {
  return render(
    <MemoryRouter initialEntries={['/analysis/multi-factor-screening']}>
      <Routes>
        <Route path="/analysis/multi-factor-screening" element={ui} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('MultiFactorScreeningPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('挂载时加载已保存模板', () => {
    renderWithRouter(<MultiFactorScreeningPage />)
    expect(loadSavedTemplatesMock).toHaveBeenCalled()
    expect(screen.getByText('多因子选股筛选')).toBeInTheDocument()
  })
})
