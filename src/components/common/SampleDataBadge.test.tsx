import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { SampleDataBadge } from './SampleDataBadge'

describe('SampleDataBadge', () => {
  it('渲染「示例数据」标记', () => {
    render(<SampleDataBadge />)

    // 默认文案为「示例数据」
    expect(screen.getByText('示例数据')).toBeInTheDocument()
  })

  it('支持覆盖文案', () => {
    render(<SampleDataBadge label="演示数据" />)

    expect(screen.getByText('演示数据')).toBeInTheDocument()
    expect(screen.queryByText('示例数据')).not.toBeInTheDocument()
  })
})
