/**
 * DensityToggle 单元测试
 *
 * 覆盖场景：
 * 1. 默认渲染三段（紧凑 / 标准 / 宽松）且默认 active 为 normal
 * 2. 点击「紧凑」调用 context.setDensity('compact')，并在消费组件中反映
 * 3. 点击「宽松」切换为 expanded，消费组件反映最新 spacing
 * 4. DensityToggle 使用语义化 token，不出现硬编码调色板类名
 */

import { describe, expect, it, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DensityProvider, useDensity } from '@/components/cockpit/DensityContext'
import { DensityToggle } from '@/components/cockpit/DensityToggle'

// 消费组件：读取密度配置并将 spacing 渲染到 DOM，便于断言密度变化已向下传递
function ConsumerProbe(): React.JSX.Element {
  const { density, config } = useDensity()
  return (
    <div data-testid="probe" data-density={density}>
      {config.spacing}
    </div>
  )
}

function renderFixture(): void {
  render(
    <DensityProvider>
      <DensityToggle />
      <ConsumerProbe />
    </DensityProvider>,
  )
}

describe('DensityToggle', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('默认渲染三段且 normal 为 active', () => {
    renderFixture()
    expect(screen.getByRole('button', { name: '紧凑' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '标准' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '宽松' })).toBeInTheDocument()

    const normalBtn = screen.getByRole('button', { name: '标准' })
    expect(normalBtn.getAttribute('aria-pressed')).toBe('true')

    expect(screen.getByTestId('probe')).toHaveAttribute('data-density', 'normal')
    expect(screen.getByTestId('probe')).toHaveTextContent('gap-2')
  })

  it('点击「紧凑」更新 context 且消费组件反映 compact spacing', () => {
    renderFixture()
    fireEvent.click(screen.getByRole('button', { name: '紧凑' }))

    expect(screen.getByRole('button', { name: '紧凑' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '标准' })).toHaveAttribute('aria-pressed', 'false')

    const probe = screen.getByTestId('probe')
    expect(probe).toHaveAttribute('data-density', 'compact')
    expect(probe).toHaveTextContent('gap-1')
  })

  it('点击「宽松」切换为 expanded 且消费组件反映', () => {
    renderFixture()
    fireEvent.click(screen.getByRole('button', { name: '宽松' }))

    expect(screen.getByTestId('probe')).toHaveAttribute('data-density', 'expanded')
    expect(screen.getByTestId('probe')).toHaveTextContent('gap-3')
  })

  it('使用语义化 token 而非硬编码调色板类名', () => {
    const { container } = render(
      <DensityProvider>
        <DensityToggle />
      </DensityProvider>,
    )
    const html = container.innerHTML
    expect(html).not.toMatch(/text-red-\d+|bg-red-\d+|text-blue-\d+|bg-blue-\d+/)
    expect(html).toMatch(/bg-muted/)
  })
})
