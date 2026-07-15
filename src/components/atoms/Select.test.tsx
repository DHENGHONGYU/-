import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Select, SelectItem } from './Select'

describe('Select', () => {
  it('应渲染 select 与选项', () => {
    render(
      <Select>
        <SelectItem value="a">Option A</SelectItem>
        <SelectItem value="b">Option B</SelectItem>
      </Select>,
    )

    expect(screen.getByRole('combobox')).toBeInTheDocument()
    expect(screen.getByText('Option A')).toBeInTheDocument()
    expect(screen.getByText('Option B')).toBeInTheDocument()
  })

  it('onValueChange 在选择变更时被调用', () => {
    const handleChange = vi.fn()
    render(
      <Select onValueChange={handleChange}>
        <SelectItem value="a">Option A</SelectItem>
        <SelectItem value="b">Option B</SelectItem>
      </Select>,
    )

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'b' } })
    expect(handleChange).toHaveBeenCalledWith('b')
  })

  it('原生 onChange 事件仍被触发', () => {
    const handleChange = vi.fn()
    render(
      <Select onChange={handleChange}>
        <SelectItem value="a">Option A</SelectItem>
      </Select>,
    )

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'a' } })
    expect(handleChange).toHaveBeenCalledTimes(1)
  })

  it('禁用状态应用 disabled 样式', () => {
    render(
      <Select disabled>
        <SelectItem value="a">Option A</SelectItem>
      </Select>,
    )

    expect(screen.getByRole('combobox')).toBeDisabled()
  })
})
