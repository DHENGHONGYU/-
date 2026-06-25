import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Label } from '@/components/ui/Label'
import { Slider } from '@/components/ui/Slider'
import { Sheet, SheetContent, SheetTitle, SheetClose } from '@/components/ui/Sheet'
import { Toggle } from '@/components/ui/Toggle'
import React from 'react'

// ===================== Label =====================
describe('Label', () => {
  it('should render children text', () => {
    render(<Label>用户名</Label>)
    expect(screen.getByText('用户名')).toBeInTheDocument()
  })

  it('should show optional marker when optional=true', () => {
    render(<Label optional>邮箱</Label>)
    expect(screen.getByText('(可选)')).toBeInTheDocument()
  })

  it('should not show optional marker when optional=false', () => {
    render(<Label>必填项</Label>)
    expect(screen.queryByText('(可选)')).not.toBeInTheDocument()
  })

  it('should forward ref correctly', () => {
    const ref = React.createRef<HTMLLabelElement>()
    render(<Label ref={ref}>测试</Label>)
    expect(ref.current).toBeInstanceOf(HTMLLabelElement)
  })
})

// ===================== Slider =====================
describe('Slider', () => {
  it('should render with default value', () => {
    render(<Slider data-testid="slider" />)
    const slider = screen.getByRole('slider') as HTMLInputElement
    expect(slider).toBeInTheDocument()
    expect(slider.value).toBe('0')
  })

  it('should render with defaultValue prop', () => {
    render(<Slider defaultValue={50} data-testid="slider" />)
    const slider = screen.getByRole('slider') as HTMLInputElement
    expect(slider.value).toBe('50')
  })

  it('should call onValueChange when value changes', async () => {
    const handleChange = vi.fn()
    render(<Slider onValueChange={handleChange} data-testid="slider" />)
    const slider = screen.getByRole('slider') as HTMLInputElement

    fireEvent.change(slider, { target: { value: '75' } })

    expect(handleChange).toHaveBeenCalledWith(75)
  })

  it('should be disabled when disabled prop is true', () => {
    render(<Slider disabled data-testid="slider" />)
    const slider = screen.getByRole('slider') as HTMLInputElement
    expect(slider).toBeDisabled()
  })

  it('should respect min and max props', () => {
    render(<Slider min={10} max={90} defaultValue={50} data-testid="slider" />)
    const slider = screen.getByRole('slider') as HTMLInputElement
    expect(slider.min).toBe('10')
    expect(slider.max).toBe('90')
  })

  it('should show tooltip when dragging if showTooltip=true', () => {
    render(<Slider showTooltip defaultValue={50} data-testid="slider" />)
    const slider = screen.getByRole('slider') as HTMLInputElement

    fireEvent.mouseDown(slider)
    expect(screen.getByText('50')).toBeInTheDocument()

    fireEvent.mouseUp(slider)
    expect(screen.queryByText('50')).not.toBeInTheDocument()
  })

  it('should be controlled by value prop', () => {
    const { rerender } = render(<Slider value={30} data-testid="slider" />)
    const slider = screen.getByRole('slider') as HTMLInputElement
    expect(slider.value).toBe('30')

    rerender(<Slider value={60} data-testid="slider" />)
    expect(slider.value).toBe('60')
  })
})

// ===================== Sheet =====================
describe('Sheet', () => {
  it('should not render when open=false', () => {
    render(
      <Sheet open={false} data-testid="sheet">
        <div>内容</div>
      </Sheet>
    )
    expect(screen.queryByTestId('sheet-overlay')).not.toBeInTheDocument()
  })

  it('should render when open=true', () => {
    render(
      <Sheet open={true} data-testid="sheet">
        <SheetContent>
          <SheetTitle>标题</SheetTitle>
          <div>内容</div>
        </SheetContent>
      </Sheet>
    )
    expect(screen.getByTestId('sheet-overlay')).toBeInTheDocument()
    expect(screen.getByText('标题')).toBeInTheDocument()
    expect(screen.getByText('内容')).toBeInTheDocument()
  })

  it('should call onOpenChange when overlay is clicked', async () => {
    const handleChange = vi.fn()
    render(
      <Sheet open={true} onOpenChange={handleChange} data-testid="sheet">
        <div>内容</div>
      </Sheet>
    )

    const overlay = screen.getByTestId('sheet-overlay')
    await userEvent.click(overlay)

    expect(handleChange).toHaveBeenCalledWith(false)
  })

  it('should call onOpenChange when Escape is pressed', () => {
    const handleChange = vi.fn()
    render(
      <Sheet open={true} onOpenChange={handleChange} data-testid="sheet">
        <div>内容</div>
      </Sheet>
    )

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(handleChange).toHaveBeenCalledWith(false)
  })

  it('should render SheetClose button with X icon', () => {
    render(<SheetClose data-testid="sheet-close" />)
    expect(screen.getByTestId('sheet-close')).toBeInTheDocument()
    expect(screen.getByText('Close')).toBeInTheDocument()
  })

  it('should render different sides correctly', () => {
    const sides: Array<'left' | 'right' | 'top' | 'bottom'> = ['left', 'right', 'top', 'bottom']
    for (const side of sides) {
      const { container } = render(
        <Sheet open={true} side={side} data-testid={`sheet-${side}`}>
          <div>{side}</div>
        </Sheet>
      )
      expect(container.querySelector(`[data-testid="sheet-${side}"]`)).toBeInTheDocument()
    }
  })
})

// ===================== Toggle =====================
describe('Toggle', () => {
  const user = userEvent.setup()

  it('should render children', () => {
    render(<Toggle>开关</Toggle>)
    expect(screen.getByRole('button', { name: '开关' })).toBeInTheDocument()
  })

  it('should have aria-pressed=false by default', () => {
    render(<Toggle>开关</Toggle>)
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false')
  })

  it('should have aria-pressed=true when defaultPressed=true', () => {
    render(<Toggle defaultPressed={true}>开关</Toggle>)
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true')
  })

  it('should call onPressedChange when clicked', async () => {
    const handleChange = vi.fn()
    render(<Toggle onPressedChange={handleChange}>开关</Toggle>)

    await user.click(screen.getByRole('button'))
    expect(handleChange).toHaveBeenCalledWith(true)

    await user.click(screen.getByRole('button'))
    expect(handleChange).toHaveBeenCalledWith(false)
  })

  it('should be controlled by pressed prop', async () => {
    const handleChange = vi.fn()
    const { rerender } = render(<Toggle pressed={false} onPressedChange={handleChange}>开关</Toggle>)

    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false')

    await user.click(screen.getByRole('button'))
    expect(handleChange).toHaveBeenCalledWith(true)

    rerender(<Toggle pressed={true} onPressedChange={handleChange}>开关</Toggle>)
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true')
  })

  it('should apply variant styles correctly', () => {
    const { rerender } = render(<Toggle variant="default">默认</Toggle>)
    expect(screen.getByRole('button')).toHaveClass('bg-transparent')

    rerender(<Toggle variant="outline">轮廓</Toggle>)
    expect(screen.getByRole('button')).toHaveClass('border')
  })

  it('should apply size styles correctly', () => {
    const { rerender } = render(<Toggle size="sm">小</Toggle>)
    expect(screen.getByRole('button')).toHaveClass('h-8')

    rerender(<Toggle size="md">中</Toggle>)
    expect(screen.getByRole('button')).toHaveClass('h-10')

    rerender(<Toggle size="lg">大</Toggle>)
    expect(screen.getByRole('button')).toHaveClass('h-12')
  })

  it('should be disabled when disabled prop is true', () => {
    render(<Toggle disabled>禁用</Toggle>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('should forward onClick handler', async () => {
    const handleClick = vi.fn()
    render(<Toggle onClick={handleClick}>点击</Toggle>)

    await user.click(screen.getByRole('button'))
    expect(handleClick).toHaveBeenCalled()
  })
})
