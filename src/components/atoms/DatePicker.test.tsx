import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { DatePicker } from './DatePicker'

describe('DatePicker', () => {
  it('应渲染 date 输入框', () => {
    render(<DatePicker />)
    expect(screen.getByDisplayValue('')).toHaveAttribute('type', 'date')
  })

  it('将 Date 值格式化为 YYYY-MM-DD', () => {
    render(<DatePicker value={new Date(2026, 6, 15)} />)
    expect(screen.getByDisplayValue('2026-07-15')).toBeInTheDocument()
  })

  it('将 string 值透传给输入框', () => {
    render(<DatePicker value="2026-07-15" />)
    expect(screen.getByDisplayValue('2026-07-15')).toBeInTheDocument()
  })

  it('onChange 在选择日期时被调用', () => {
    const handleChange = vi.fn()
    render(<DatePicker onChange={handleChange} />)

    fireEvent.change(document.querySelector('input[type="date"]')!, { target: { value: '2026-07-16' } })
    expect(handleChange).toHaveBeenCalledWith('2026-07-16')
  })

  it('min/max 支持 Date 与 string', () => {
    render(<DatePicker min="2026-01-01" max={new Date(2026, 11, 31)} />)
    const input = document.querySelector('input[type="date"]') as HTMLInputElement
    expect(input).toHaveAttribute('min', '2026-01-01')
    expect(input).toHaveAttribute('max', '2026-12-31')
  })

  it('禁用状态', () => {
    render(<DatePicker disabled />)
    expect(document.querySelector('input[type="date"]')).toBeDisabled()
  })
})
