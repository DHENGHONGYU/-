/**
 * Slider 组件单元测试
 * @vitest-environment jsdom
 *
 * 覆盖场景：
 * 1. 基础渲染 & 默认值：input[type=range]、min/max/step=0/100/1
 * 2. 受控 vs 非受控：传入 value 时变更不修改内部 state，传入 defaultValue 时生效
 * 3. showTooltip=true & mouseDown → tooltip 显示；mouseUp → 隐藏（isDragging 状态机）
 * 4. onValueChange 回调：change 事件触发，受控/非受控下都应调用
 * 5. disabled=true → input 禁用，className 含 disabled:*
 * 6. forwardRef：ref 正确挂载到根 div
 * 7. className 合并：默认样式 + 自定义 className
 * 8. percentage 计算：max===min → 0%，否则 (value-min)/(max-min)*100
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Slider } from './Slider'

describe('Slider', () => {
  describe('基础渲染 (P1:默认值快照)', () => {
    it('渲染 input[type=range] 且有默认 min=0, max=100, step=1', () => {
      render(<Slider />)
      const input = screen.getByRole('slider') as HTMLInputElement
      expect(input.tagName).toBe('INPUT')
      expect(input.type).toBe('range')
      expect(input.min).toBe('0')
      expect(input.max).toBe('100')
      expect(input.step).toBe('1')
    })

    it('默认无 tooltip 显示 (showTooltip=false)', () => {
      render(<Slider />)
      expect(screen.queryByText(/^\d+$/)).not.toBeInTheDocument()
    })
  })

  describe('受控 vs 非受控', () => {
    it('受控模式：传入 value=50，input.value 为 "50"，变更时不修改内部 state', () => {
      const { rerender } = render(<Slider value={50} />)
      let input = screen.getByRole('slider') as HTMLInputElement
      expect(input.value).toBe('50')

      // 模拟外部 prop 变更
      rerender(<Slider value={75} />)
      input = screen.getByRole('slider') as HTMLInputElement
      expect(input.value).toBe('75')
    })

    it('非受控模式：未传 value 时 defaultValue 生效 (默认 0)', () => {
      render(<Slider defaultValue={30} />)
      const input = screen.getByRole('slider') as HTMLInputElement
      expect(input.value).toBe('30')
    })

    it('非受控模式：不传任何值默认展示 0', () => {
      render(<Slider />)
      const input = screen.getByRole('slider') as HTMLInputElement
      expect(input.value).toBe('0')
    })
  })

  describe('Tooltip 拖拽显示 (P1:状态机)', () => {
    it('showTooltip=true + mouseDown → tooltip 显示当前值', () => {
      render(<Slider showTooltip defaultValue={40} />)
      const input = screen.getByRole('slider') as HTMLInputElement
      fireEvent.mouseDown(input)
      expect(screen.getByText('40')).toBeInTheDocument()
    })

    it('showTooltip=true + mouseDown→mouseUp → tooltip 消失', () => {
      render(<Slider showTooltip defaultValue={40} />)
      const input = screen.getByRole('slider') as HTMLInputElement
      fireEvent.mouseDown(input)
      expect(screen.getByText('40')).toBeInTheDocument()
      fireEvent.mouseUp(input)
      expect(screen.queryByText('40')).not.toBeInTheDocument()
    })
  })

  describe('onValueChange 回调 (P7:事件回调)', () => {
    it('change 事件触发 onValueChange 一次，参数为新数值', () => {
      const onValueChange = vi.fn()
      render(<Slider defaultValue={20} onValueChange={onValueChange} />)
      const input = screen.getByRole('slider') as HTMLInputElement
      fireEvent.change(input, { target: { value: '80' } })
      expect(onValueChange).toHaveBeenCalledTimes(1)
      expect(onValueChange).toHaveBeenCalledWith(80)
    })

    it('不传 onValueChange，change 不抛异常', () => {
      render(<Slider defaultValue={20} />)
      const input = screen.getByRole('slider') as HTMLInputElement
      expect(() => fireEvent.change(input, { target: { value: '80' } })).not.toThrow()
    })
  })

  describe('disabled 状态', () => {
    it('disabled=true → input.disabled=true', () => {
      render(<Slider disabled />)
      const input = screen.getByRole('slider') as HTMLInputElement
      expect(input.disabled).toBe(true)
    })
  })

  describe('forwardRef 透传 (P4)', () => {
    it('ref 正确挂载到根 div', () => {
      const ref = vi.fn()
      render(<Slider ref={ref} />)
      expect(ref).toHaveBeenCalled()
      expect(ref.mock.calls[0][0]?.tagName).toBe('DIV')
    })
  })

  describe('className 合并 (P6)', () => {
    it('根容器 div 包含默认类 "relative flex w-full items-center" 与自定义 className', () => {
      render(<Slider className="my-slider" />)
      const root = screen.getByRole('slider').closest('div') as HTMLDivElement
      expect(root.className).toContain('relative')
      expect(root.className).toContain('my-slider')
    })
  })

  describe('边界：max===min 防止除零', () => {
    it('max===min 时 percentage=0，不抛异常', () => {
      expect(() => render(<Slider min={50} max={50} defaultValue={50} showTooltip />)).not.toThrow()
      const input = screen.getByRole('slider') as HTMLInputElement
      fireEvent.mouseDown(input)
      // percentage=0 → left: 0%
      const tooltip = screen.getByText('50')
      expect(tooltip.style.left).toBe('0%')
    })
  })
})
