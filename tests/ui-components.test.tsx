import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Label } from '@/components/atoms/Label'
import { Slider } from '@/components/atoms/Slider'
import { Sheet, SheetContent, SheetTitle, SheetClose } from '@/components/atoms/Sheet'
import { Toggle } from '@/components/atoms/Toggle'
import React from 'react'

// ===================== Label =====================
/**
 * @status known-failing
 * @tracked-in package.json test:known 脚本
 * @reason TODO: 待修复（详见 docs/reports/脚本与测试质量检查报告.md）
 * @skip-reason 此测试为已知失败，已通过 vitest --exclude 跳过；
 *               修复后请移除 @status known-failing 注释并从 test:clean 的 --exclude 列表中删除
 */
describe('Label', () => {
  it('应该渲染 children text', () => {
    render(<Label>用户名</Label>)
    expect(screen.getByText('用户名')).toBeInTheDocument()
  })

  it('应该show optional marker when optional=true', () => {
    render(<Label optional>邮箱</Label>)
    expect(screen.getByText('(可选)')).toBeInTheDocument()
  })

  it('不应该 show optional marker when optional=false', () => {
    render(<Label>必填项</Label>)
    expect(screen.queryByText('(可选)')).not.toBeInTheDocument()
  })

  it('应该forward ref correctly', () => {
    const ref = React.createRef<HTMLLabelElement>()
    render(<Label ref={ref}>测试</Label>)
    expect(ref.current).toBeInstanceOf(HTMLLabelElement)
  })
})

// ===================== Slider =====================
/**
 * @status known-failing
 * @reason TODO: 待修复（详见 docs/reports/脚本与测试质量检查报告.md）
 */
describe('Slider', () => {
  it('应该渲染 with default value 0（受控式，显式传 value=0）', () => {
    // Slider 现为完全受控组件：value 必填，不再支持 defaultValue
    render(<Slider value={0} data-testid="slider" />)
    const slider = screen.getByRole('slider') as HTMLInputElement
    expect(slider).toBeInTheDocument()
    expect(slider.value).toBe('0')
  })

  it('应该渲染 with value prop（受控式，显式传 value=50）', () => {
    render(<Slider value={50} data-testid="slider" />)
    const slider = screen.getByRole('slider') as HTMLInputElement
    expect(slider.value).toBe('50')
  })

  it('应该调用 onValueChange when value changes', async () => {
    const handleChange = vi.fn()
    render(<Slider value={0} onValueChange={handleChange} data-testid="slider" />)
    const slider = screen.getByRole('slider') as HTMLInputElement

    fireEvent.change(slider, { target: { value: '75' } })

    expect(handleChange).toHaveBeenCalledWith(75)
  })

  it('应该是 disabled when disabled prop is true', () => {
    render(<Slider value={0} disabled data-testid="slider" />)
    const slider = screen.getByRole('slider') as HTMLInputElement
    expect(slider).toBeDisabled()
  })

  it('应该respect min and max props', () => {
    render(<Slider min={10} max={90} value={50} data-testid="slider" />)
    const slider = screen.getByRole('slider') as HTMLInputElement
    expect(slider.min).toBe('10')
    expect(slider.max).toBe('90')
  })

  it('应该show tooltip with value 当 showTooltip=true（静态显示非拖拽触发）', () => {
    // Slider v2 showTooltip 是静态开关：只要 true 就始终渲染 tooltip span（不依赖 mouseDown）
    const { rerender } = render(<Slider showTooltip value={50} data-testid="slider" />)
    // 初始即可看到 tooltip 中的 50（span 内有 value 文本）
    expect(screen.getByText('50')).toBeInTheDocument()

    // 使用 rerender 切换到 showTooltip=false（同一组件实例），tooltip 应消失
    rerender(<Slider value={50} data-testid="slider" />)
    expect(screen.queryByText('50')).not.toBeInTheDocument()
  })

  it('应该是 controlled by value prop', () => {
    const { rerender } = render(<Slider value={30} data-testid="slider" />)
    const slider = screen.getByRole('slider') as HTMLInputElement
    expect(slider.value).toBe('30')

    rerender(<Slider value={60} data-testid="slider" />)
    expect(slider.value).toBe('60')
  })
})

// ===================== Sheet =====================
/**
 * @status known-failing
 * @reason TODO: 待修复（详见 docs/reports/脚本与测试质量检查报告.md）
 */
describe('Sheet', () => {
  it('不应该渲染 when open=false', () => {
    render(
      <Sheet open={false} data-testid="sheet">
        <div>内容</div>
      </Sheet>
    )
    expect(screen.queryByTestId('sheet-overlay')).not.toBeInTheDocument()
  })

  it('应该渲染 when open=true', () => {
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

  it('应该调用 onOpenChange when overlay is clicked', async () => {
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

  it('应该调用 onOpenChange when Escape is pressed', () => {
    const handleChange = vi.fn()
    render(
      <Sheet open={true} onOpenChange={handleChange} data-testid="sheet">
        <div>内容</div>
      </Sheet>
    )

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(handleChange).toHaveBeenCalledWith(false)
  })

  it('应该渲染 SheetClose button with X icon', () => {
    render(<SheetClose data-testid="sheet-close" />)
    expect(screen.getByTestId('sheet-close')).toBeInTheDocument()
    expect(screen.getByText('Close')).toBeInTheDocument()
  })

  it('应该渲染 different sides correctly', () => {
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
/**
 * @status known-failing
 * @reason TODO: 待修复（详见 docs/reports/脚本与测试质量检查报告.md）
 */
describe('Toggle', () => {
  const user = userEvent.setup()

  it('应该渲染 children', () => {
    render(<Toggle pressed={false}>开关</Toggle>)
    expect(screen.getByRole('button', { name: '开关' })).toBeInTheDocument()
  })

  it('应该有 aria-pressed=false when pressed=false（受控模式）', () => {
    // Toggle 现为完全受控组件：pressed 必填，defaultPressed 已移除
    render(<Toggle pressed={false}>开关</Toggle>)
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false')
  })

  it('应该有 aria-pressed=true when pressed=true（受控模式）', () => {
    render(<Toggle pressed={true}>开关</Toggle>)
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true')
  })

  it('应该调用 onPressedChange when clicked（受控式，按下切反值）', async () => {
    const handleChange = vi.fn()
    const { rerender } = render(
      <Toggle pressed={false} onPressedChange={handleChange}>开关</Toggle>,
    )

    await user.click(screen.getByRole('button'))
    // pressed=false → !pressed=true
    expect(handleChange).toHaveBeenNthCalledWith(1, true)

    // 受控模式：父组件需回传 pressed 更新
    rerender(
      <Toggle pressed={true} onPressedChange={handleChange}>开关</Toggle>,
    )
    await user.click(screen.getByRole('button'))
    // pressed=true → !pressed=false
    expect(handleChange).toHaveBeenNthCalledWith(2, false)
  })

  it('应该是 controlled by pressed prop', async () => {
    const handleChange = vi.fn()
    const { rerender } = render(<Toggle pressed={false} onPressedChange={handleChange}>开关</Toggle>)

    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false')

    await user.click(screen.getByRole('button'))
    expect(handleChange).toHaveBeenCalledWith(true)

    rerender(<Toggle pressed={true} onPressedChange={handleChange}>开关</Toggle>)
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true')
  })

  it('应该apply variant styles correctly', () => {
    const { rerender } = render(<Toggle pressed={false} variant="default">默认</Toggle>)
    // variant=default + 未 pressed = bg-secondary（Apple 商务风令牌 v2）
    expect(screen.getByRole('button')).toHaveClass('bg-secondary')

    rerender(<Toggle pressed={false} variant="outline">轮廓</Toggle>)
    expect(screen.getByRole('button')).toHaveClass('border')
  })

  it('应该apply default control size（THEME_TOKENS.controlSizes.md = h-10）', () => {
    // Toggle 默认使用 THEME_TOKENS.controlSizes.md，不通过 size prop 切换
    const { rerender } = render(<Toggle pressed={false}>默认控件高度</Toggle>)
    expect(screen.getByRole('button')).toHaveClass('h-10')

    // pressed 态 → bg-primary
    rerender(<Toggle pressed={true}>按下态</Toggle>)
    expect(screen.getByRole('button')).toHaveClass('bg-primary')
  })

  it('应该是 disabled when disabled prop is true', () => {
    render(<Toggle pressed={false} disabled>禁用</Toggle>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('应该forward onClick handler', async () => {
    const handleClick = vi.fn()
    render(<Toggle pressed={false} onClick={handleClick}>点击</Toggle>)

    await user.click(screen.getByRole('button'))
    expect(handleClick).toHaveBeenCalled()
  })
})
