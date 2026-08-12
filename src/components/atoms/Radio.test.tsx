import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { RadioGroup, Radio } from './Radio'

describe('Radio', () => {
  it('应渲染单选组选项', () => {
    render(
      <RadioGroup defaultValue="a">
        <Radio value="a" label="Option A" />
        <Radio value="b" label="Option B" />
      </RadioGroup>,
    )

    expect(screen.getByRole('radiogroup')).toBeInTheDocument()
    expect(screen.getByLabelText('Option A')).toBeInTheDocument()
    expect(screen.getByLabelText('Option B')).toBeInTheDocument()
  })

  it('默认选中 defaultValue', () => {
    render(
      <RadioGroup defaultValue="b">
        <Radio value="a" label="Option A" />
        <Radio value="b" label="Option B" />
      </RadioGroup>,
    )

    expect(screen.getByLabelText('Option B')).toBeChecked()
    expect(screen.getByLabelText('Option A')).not.toBeChecked()
  })

  it('点击选项触发 onChange', () => {
    const handleChange = vi.fn()
    render(
      <RadioGroup onChange={handleChange}>
        <Radio value="a" label="Option A" />
        <Radio value="b" label="Option B" />
      </RadioGroup>,
    )

    fireEvent.click(screen.getByLabelText('Option B'))
    expect(handleChange).toHaveBeenCalledWith('b')
    expect(screen.getByLabelText('Option B')).toBeChecked()
  })

  it('禁用选项不可选', () => {
    const handleChange = vi.fn()
    render(
      <RadioGroup onChange={handleChange}>
        <Radio value="a" label="Option A" disabled />
        <Radio value="b" label="Option B" />
      </RadioGroup>,
    )

    fireEvent.click(screen.getByLabelText('Option A'))
    expect(handleChange).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Option A')).toBeDisabled()
  })

  it('受控模式跟随 value 变化', () => {
    const { rerender } = render(
      <RadioGroup value="a">
        <Radio value="a" label="Option A" />
        <Radio value="b" label="Option B" />
      </RadioGroup>,
    )

    expect(screen.getByLabelText('Option A')).toBeChecked()

    rerender(
      <RadioGroup value="b">
        <Radio value="a" label="Option A" />
        <Radio value="b" label="Option B" />
      </RadioGroup>,
    )

    expect(screen.getByLabelText('Option B')).toBeChecked()
  })
})
