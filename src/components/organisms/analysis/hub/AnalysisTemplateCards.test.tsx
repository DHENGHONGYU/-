/**
 * @module AnalysisTemplateCards.test
 * @description 分析舱模板快捷入口卡片组单元测试。
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router'
import { UI_TEXT } from '@/constants/uiText'
import { AnalysisTemplateCards } from './AnalysisTemplateCards'
import { ANALYSIS_TEMPLATES } from '@/config/analysisTemplatesConfig'

function renderWithRouter(ui: React.ReactElement) {
  return render(
    <MemoryRouter initialEntries={['/analysis']}>
      <Routes>
        <Route path="/analysis" element={ui} />
        <Route path="/analysis/intelligent-score" element={<div>Stock Score</div>} />
        <Route path="/analysis/industry-score" element={<div>Industry Score</div>} />
        <Route path="/analysis/backtest" element={<div>Backtest</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('AnalysisTemplateCards', () => {
  it('渲染所有模板卡片与默认标题', () => {
    renderWithRouter(<AnalysisTemplateCards />)

    expect(screen.getByText(UI_TEXT.analysis.template.quickEntry)).toBeInTheDocument()
    for (const template of ANALYSIS_TEMPLATES) {
      expect(screen.getByText(template.title)).toBeInTheDocument()
      expect(screen.getByText(template.description)).toBeInTheDocument()
    }
  })

  it('每个卡片链接携带模板参数', () => {
    renderWithRouter(<AnalysisTemplateCards />)

    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(ANALYSIS_TEMPLATES.length)

    for (let i = 0; i < ANALYSIS_TEMPLATES.length; i++) {
      const template = ANALYSIS_TEMPLATES[i]!
      expect(links[i]!).toHaveAttribute('href', `${template.path}?template=${template.params.template}`)
    }
  })
})
