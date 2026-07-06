/**
 * IntelligentScoreExplanation 组件测试
 *
 * 覆盖：雷达图渲染、关键因子高亮、思维链展开/收起、loading/error/empty 三态、
 *       LLM 输出经 sanitizeLlmOutput 净化
 */

import { describe, test, expect } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { UI_TEXT } from '@/constants/uiText'
import { IntelligentScoreExplanation } from '../IntelligentScoreExplanation'
import type { IntelligentScore } from '@/data/types'

function createResult(overrides: Partial<IntelligentScore> = {}): IntelligentScore {
  return {
    symbol: 'TEST',
    overallScore: 4,
    dimensionScores: [
      { name: '估值', score: 4.5, rationale: '', evidence: [], weight: 1 },
      { name: '成长', score: 3, rationale: '', evidence: [], weight: 1 },
      { name: '护城河', score: null, rationale: '', evidence: [], weight: 1 },
    ],
    summary: '基本面稳健',
    basis: '基于财报与研报',
    missingFields: [],
    sourceSnapshot: { stock: undefined, fileNames: [], reportLength: 0 },
    configSnapshot: { model: 'gpt-4o', baseURL: '' },
    modelResponse: '## 推理\n估值偏低。<script>alert(1)</script>',
    dataVersion: 1,
    scoredAt: Date.now(),
    ...overrides,
  }
}

describe('IntelligentScoreExplanation', () => {
  test('loading 状态展示加载 UI', () => {
    render(<IntelligentScoreExplanation loading />)
    expect(screen.getByText(/加载中/i)).toBeInTheDocument()
  })

  test('error 状态展示错误', () => {
    render(<IntelligentScoreExplanation error="解释加载失败" />)
    expect(screen.getByText(new RegExp(UI_TEXT.analysis.scoreExplanation.loadingFailed, 'i'))).toBeInTheDocument()
  })

  test('空结果展示 empty 状态', () => {
    render(<IntelligentScoreExplanation />)
    expect(screen.getByText(new RegExp(UI_TEXT.analysis.scoreExplanation.noData, 'i'))).toBeInTheDocument()
  })

  test('渲染雷达图与关键因子', () => {
    render(<IntelligentScoreExplanation result={createResult()} />)
    expect(document.querySelector('.recharts-responsive-container')).toBeInTheDocument()
    expect(screen.getByText(new RegExp(UI_TEXT.analysis.factor.keyFactor, 'i'))).toBeInTheDocument()
    expect(screen.getByText(new RegExp(UI_TEXT.analysis.factor.value, 'i'))).toBeInTheDocument()
  })

  test('思维链默认折叠，点击展开显示净化后的内容', async () => {
    render(<IntelligentScoreExplanation result={createResult()} />)

    const toggle = screen.getByRole('button', { name: /展开思维链/i })
    expect(toggle).toBeInTheDocument()
    expect(screen.queryByText(new RegExp(UI_TEXT.analysis.news.reasoning, 'i'))).not.toBeInTheDocument()
    expect(screen.queryByText('<script>alert(1)</script>')).not.toBeInTheDocument()

    fireEvent.click(toggle)

    await waitFor(() => {
      expect(screen.getByText(new RegExp(UI_TEXT.analysis.news.reasoning, 'i'))).toBeInTheDocument()
    })
    expect(screen.queryByText(/<script>/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /收起思维链/i })).toBeInTheDocument()
  })
})
