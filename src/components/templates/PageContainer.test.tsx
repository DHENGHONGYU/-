/**
 * PageContainer 组件单元测试
 * 覆盖：默认居中最大宽度、关闭居中、自定义类名透传、子内容渲染
 */
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PageContainer } from '@/components/templates/PageContainer'

describe('PageContainer', () => {
  it('默认渲染并居中（限制最大宽度 1200px）', () => {
    render(<PageContainer><span>内容</span></PageContainer>)
    const main = screen.getByText('内容').closest('main')!
    expect(main).toHaveClass('mx-auto', 'max-w-container')
    expect(main).toHaveClass('w-full', 'p-4')
  })

  it('centered=false 时不限制最大宽度', () => {
    render(<PageContainer centered={false}><span>内容</span></PageContainer>)
    const main = screen.getByText('内容').closest('main')!
    expect(main).not.toHaveClass('mx-auto', 'max-w-container')
    expect(main).toHaveClass('w-full', 'p-4')
  })

  it('透传自定义类名', () => {
    render(<PageContainer className="custom-cls"><span>内容</span></PageContainer>)
    const main = screen.getByText('内容').closest('main')!
    expect(main).toHaveClass('custom-cls')
  })
})
