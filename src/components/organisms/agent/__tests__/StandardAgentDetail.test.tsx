import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import StandardAgentDetail from '../StandardAgentDetail'
import { getAgentComponent } from '@/agents/agentComponentRegistry'

function renderDetail(agentId: string) {
  return render(
    <MemoryRouter>
      <StandardAgentDetail agentId={agentId} />
    </MemoryRouter>,
  )
}

describe('StandardAgentDetail', () => {
  it('渲染已知 Agent 的显示名与关联功能链接', () => {
    const entry = getAgentComponent('news-analyzer-agent')!
    renderDetail('news-analyzer-agent')

    expect(screen.getByRole('heading', { name: entry.displayName })).toBeInTheDocument()
    const link = screen.getByRole('link', { name: new RegExp(entry.detailLink!.label) })
    expect(link).toHaveAttribute('href', entry.detailLink!.to)
  })

  it('未知 Agent 不崩溃（兜底显示）', () => {
    renderDetail('unknown-agent')
    expect(screen.getByRole('heading', { name: '未知智能体' })).toBeInTheDocument()
  })
})
