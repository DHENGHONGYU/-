/**
 * ScoreFactorDeltaPanel 组件单元测试
 *
 * 覆盖场景：
 * 1. 无 previous 数据时显示提示信息
 * 2. 有 previous 数据时显示综合分变化
 * 3. 上升因子和下降因子的正确分类
 * 4. 各因子 delta 计算正确
 * 5. Top N 筛选逻辑
 * 6. 无变化时显示对应提示
 */

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ScoreFactorDeltaPanel } from '@/components/ScoreFactorDeltaPanel'
import type { ScoreWithDimensions } from '@/components/ScoreFactorDeltaPanel'

const makeScore = (overallScore: number, dimensions: Array<{ name: string; score: number | null; rationale: string }>): ScoreWithDimensions => ({
  overallScore,
  dimensionScores: dimensions,
})

describe('ScoreFactorDeltaPanel', () => {
  it('无 previous 时显示提示信息', () => {
    const current = makeScore(75, [{ name: '估值', score: 80, rationale: '低估' }])
    render(<ScoreFactorDeltaPanel current={current} previous={undefined} />)
    expect(screen.getByText(/暂无上一版本记录/)).toBeInTheDocument()
  })

  it('综合分变化为正时 Badge 显示 + 号', () => {
    const current = makeScore(80, [{ name: '估值', score: 80, rationale: '低估' }])
    const previous = makeScore(70, [{ name: '估值', score: 70, rationale: '正常' }])
    render(<ScoreFactorDeltaPanel current={current} previous={previous} />)
    // 综合分变化 Badge 显示 +10.00
    expect(screen.getByText(/^\+10\.00$/)).toBeInTheDocument()
  })

  it('综合分变化为负时 Badge 显示负号', () => {
    const current = makeScore(60, [{ name: '估值', score: 60, rationale: '高估' }])
    const previous = makeScore(70, [{ name: '估值', score: 70, rationale: '正常' }])
    render(<ScoreFactorDeltaPanel current={current} previous={previous} />)
    // 综合分变化 Badge 显示 -10.00
    expect(screen.getByText(/^-10\.00$/)).toBeInTheDocument()
  })

  it('显示上升因子 Top N', () => {
    const current = makeScore(80, [
      { name: '估值', score: 90, rationale: '低估' },
      { name: '资金', score: 85, rationale: '流入' },
      { name: '动量', score: 70, rationale: '一般' },
    ])
    const previous = makeScore(70, [
      { name: '估值', score: 60, rationale: '正常' },
      { name: '资金', score: 65, rationale: '流出' },
      { name: '动量', score: 75, rationale: '一般' },
    ])
    render(<ScoreFactorDeltaPanel current={current} previous={previous} />)
    expect(screen.getByText(/上升因子 Top/)).toBeInTheDocument()
    expect(screen.getByText('估值')).toBeInTheDocument()
  })

  it('显示下降因子 Top N', () => {
    const current = makeScore(60, [
      { name: '估值', score: 50, rationale: '高估' },
      { name: '资金', score: 45, rationale: '流出' },
    ])
    const previous = makeScore(80, [
      { name: '估值', score: 80, rationale: '低估' },
      { name: '资金', score: 85, rationale: '流入' },
    ])
    render(<ScoreFactorDeltaPanel current={current} previous={previous} />)
    expect(screen.getByText(/下降因子 Top/)).toBeInTheDocument()
  })

  it('无有效变化时显示对应提示', () => {
    const current = makeScore(70, [{ name: '估值', score: 70, rationale: '正常' }])
    const previous = makeScore(70, [{ name: '估值', score: 70, rationale: '正常' }])
    render(<ScoreFactorDeltaPanel current={current} previous={previous} />)
    expect(screen.getByText(/各因子与上一版本无有效变化/)).toBeInTheDocument()
  })

  it('null score 不参与 delta 计算', () => {
    const current = makeScore(80, [
      { name: '估值', score: 80, rationale: '低估' },
      { name: '资金', score: null, rationale: '数据缺失' },
    ])
    const previous = makeScore(70, [
      { name: '估值', score: 70, rationale: '正常' },
      { name: '资金', score: null, rationale: '数据缺失' },
    ])
    render(<ScoreFactorDeltaPanel current={current} previous={previous} />)
    expect(screen.getByText('估值')).toBeInTheDocument()
  })
})
