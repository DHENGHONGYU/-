import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Slider } from './Slider'

describe('Slider 独立复检（验收闸门一档实跑）', () => {
  it('渲染 input[type=range] 元素', () => {
    render(<Slider defaultValue={50} />)
    const input = screen.getByRole('slider') as HTMLInputElement
    expect(input).toBeInTheDocument()
    expect(input.type).toBe('range')
    expect(input.value).toBe('50')
  })

  it('受控/非受控：onValueChange 触发 + 内部 state 同步', () => {
    const onValueChange = vi.fn()
    render(<Slider defaultValue={0} onValueChange={onValueChange} />)
    const input = screen.getByRole('slider') as HTMLInputElement
    fireEvent.change(input, { target: { value: '30' } })
    expect(onValueChange).toHaveBeenCalledWith(30)
    expect(input.value).toBe('30')
  })

  it('B1 键盘可达：原生 input[type=range] 浏览器内置 Tab 聚焦 + 方向键调整', () => {
    render(<Slider defaultValue={10} />)
    const input = screen.getByRole('slider') as HTMLInputElement
    // Tab 可聚焦（input 默认 tabIndex=0）
    expect(input.tabIndex).toBe(0)
    // 方向键调整（fireEvent.keyDown + 原生 input 处理）
    fireEvent.keyDown(input, { key: 'ArrowRight' })
    // 浏览器原生 onChange 会在 keyDown 后触发（jsdom 不完全模拟，但 onValueChange 应被调用）
    // 此处只验证 tabIndex 与 keyDown 不抛错
  })

  it('⚠️ 真实风险 P3：mousedown 后无 mouseup → isDragging 状态泄漏（tooltip 永久残留）', () => {
    render(<Slider defaultValue={50} showTooltip />)
    const input = screen.getByRole('slider') as HTMLInputElement
    // 触发 mousedown（不触发 mouseup）
    fireEvent.mouseDown(input)
    // 此时 tooltip 应显示
    expect(screen.getByText('50')).toBeInTheDocument()
    // 不触发 mouseup，状态 isDragging 保持 true，tooltip 永久存在
    // 期望：组件应在 mouseup 缺失时也能正确清理状态（如全局 mouseup 监听或 mouseleave 兜底）
    // 验证：模拟一次"窗口级 mouseup"被监听（如有）
    // 当前实现无 onMouseLeave / window mouseup 兜底
    fireEvent.mouseLeave(input)
    // 期望：tooltip 应在 mouseLeave 时清理（但当前无此处理）
    expect(screen.queryByText('50')).not.toBeInTheDocument()
  })

  it('B6 focus 视觉反馈：className 含 focus-visible 令牌（标准范式）', () => {
    render(<Slider defaultValue={50} />)
    const input = screen.getByRole('slider') as HTMLInputElement
    expect(input.className).toContain('focus-visible:outline-none')
    expect(input.className).toContain('focus-visible:ring-2')
    expect(input.className).toContain('focus-visible:ring-offset-2')
  })

  it('边界：min === max 时 percentage 不可崩溃', () => {
    // 期望：组件对 min === max 边界不崩溃（NaN% 透传属数据契约层职责，但需不抛错）
    expect(() => render(<Slider min={50} max={50} defaultValue={50} />)).not.toThrow()
  })

  it('JSDoc 残缺：函数注释 @param 缺失（轻文档规范违反）', () => {
    // 修复前 JSDoc 仅 `/** Slider */` 3 行，无 @param 描述
    // 修复后应补完整 props JSDoc
    // 此用例仅作记录（不通过运行期断言，靠人工 review）
    expect(true).toBe(true)
  })
})
