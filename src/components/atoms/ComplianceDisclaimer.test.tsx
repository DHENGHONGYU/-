import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ComplianceDisclaimer } from './ComplianceDisclaimer'

describe('ComplianceDisclaimer', () => {
  it('默认变体渲染风险提示与免责声明', () => {
    render(<ComplianceDisclaimer />)

    expect(screen.getByText('风险提示与免责声明')).toBeInTheDocument()
    expect(screen.getByText(/本系统为个人投研复盘辅助工具/)).toBeInTheDocument()
    expect(screen.getByText(/AI 生成内容基于 LLM/)).toBeInTheDocument()
    expect(screen.getByText(/数据来源包括用户自有数据/)).toBeInTheDocument()
    expect(screen.getByText(/© V9 智能投研复盘系统/)).toBeInTheDocument()
  })

  it('compact 变体仅渲染通用免责声明', () => {
    render(<ComplianceDisclaimer variant="compact" />)

    expect(screen.queryByText('风险提示与免责声明')).not.toBeInTheDocument()
    expect(screen.getByText(/本系统为个人投研复盘辅助工具/)).toBeInTheDocument()
  })

  it('tooltip 变体渲染为段落', () => {
    render(<ComplianceDisclaimer variant="tooltip" />)

    expect(screen.getByText(/本系统为个人投研复盘辅助工具/)).toBeInTheDocument()
    expect(screen.queryByText('风险提示与免责声明')).not.toBeInTheDocument()
  })

  it('extraMessage 渲染额外说明', () => {
    render(<ComplianceDisclaimer extraMessage="额外测试说明" />)

    expect(screen.getByText('额外测试说明')).toBeInTheDocument()
  })
})
