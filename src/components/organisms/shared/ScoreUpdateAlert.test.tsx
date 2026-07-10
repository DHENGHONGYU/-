/**
 * ScoreUpdateAlert 组件单元测试
 *
 * 覆盖场景：
 * 1. 尚未评分状态（lastScoredAt 为 undefined）
 * 2. 已超期一周显示警告
 * 3. 超过半周但不满一周显示提醒
 * 4. 一周内显示评分较新提示
 * 5. 刷新按钮点击触发 onRefresh
 * 6. loading 状态显示不同按钮文字
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { UI_TEXT } from '@/constants/uiText'
import { ScoreUpdateAlert } from '@/components/ScoreUpdateAlert'

describe('ScoreUpdateAlert', () => {
  const onRefresh = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('尚未评分时显示"尚未评分"', () => {
    render(<ScoreUpdateAlert lastScoredAt={undefined} onRefresh={onRefresh} />)
    expect(screen.getByText(UI_TEXT.analysis.score.notScored)).toBeInTheDocument()
    expect(screen.getByText(/建议每周至少运行两次大模型评分/)).toBeInTheDocument()
  })

  it('尚未评分时显示"立即评分"按钮', () => {
    render(<ScoreUpdateAlert lastScoredAt={undefined} onRefresh={onRefresh} />)
    expect(screen.getByRole('button', { name: '立即评分' })).toBeInTheDocument()
  })

  it('点击"立即评分"触发 onRefresh', () => {
    render(<ScoreUpdateAlert lastScoredAt={undefined} onRefresh={onRefresh} />)
    fireEvent.click(screen.getByRole('button', { name: '立即评分' }))
    expect(onRefresh).toHaveBeenCalledTimes(1)
  })

  it('loading 状态时按钮显示"评分中..."', () => {
    render(<ScoreUpdateAlert lastScoredAt={undefined} onRefresh={onRefresh} loading={true} />)
    expect(screen.getByRole('button', { name: '评分中...' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '评分中...' })).toBeDisabled()
  })

  it('超过一周显示"已超期 X 天未更新"', () => {
    const eightDaysAgo = Date.now() - (8 * 24 * 60 * 60 * 1000)
    render(<ScoreUpdateAlert lastScoredAt={eightDaysAgo} onRefresh={onRefresh} />)
    expect(screen.getByText(/已超期 \d+ 天未更新/)).toBeInTheDocument()
  })

  it('超过一周时显示"重新评分"按钮', () => {
    const eightDaysAgo = Date.now() - (8 * 24 * 60 * 60 * 1000)
    render(<ScoreUpdateAlert lastScoredAt={eightDaysAgo} onRefresh={onRefresh} />)
    expect(screen.getByRole('button', { name: '重新评分' })).toBeInTheDocument()
  })

  it('超过半周但不满一周显示"建议更新"', () => {
    const fiveDaysAgo = Date.now() - (5 * 24 * 60 * 60 * 1000)
    render(<ScoreUpdateAlert lastScoredAt={fiveDaysAgo} onRefresh={onRefresh} />)
    expect(screen.getByText(/建议更新/)).toBeInTheDocument()
  })

  it('一周内显示评分较新提示', () => {
    const threeDaysAgo = Date.now() - (3 * 24 * 60 * 60 * 1000)
    render(<ScoreUpdateAlert lastScoredAt={threeDaysAgo} onRefresh={onRefresh} />)
    expect(screen.getByText(new RegExp(UI_TEXT.analysis.score.isFresh))).toBeInTheDocument()
  })

  it('刷新按钮在超期状态下触发 onRefresh', () => {
    const eightDaysAgo = Date.now() - (8 * 24 * 60 * 60 * 1000)
    render(<ScoreUpdateAlert lastScoredAt={eightDaysAgo} onRefresh={onRefresh} />)
    fireEvent.click(screen.getByRole('button', { name: '重新评分' }))
    expect(onRefresh).toHaveBeenCalledTimes(1)
  })

  it('一周内评分不显示操作按钮', () => {
    const threeDaysAgo = Date.now() - (3 * 24 * 60 * 60 * 1000)
    render(<ScoreUpdateAlert lastScoredAt={threeDaysAgo} onRefresh={onRefresh} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
