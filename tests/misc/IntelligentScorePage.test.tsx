/**
 * IntelligentScorePage 组件测试
 *
 * 注意：此测试文件需要完全重写以匹配当前组件实现
 * 当前组件使用 useIntelligentScoreStore 而非自定义 hook
 */

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import IntelligentScorePage from '@/pages/analysis/IntelligentScorePage'

describe('IntelligentScorePage', () => {
  // ================================================================
  // 基础渲染测试
  // ================================================================

  it('组件正常渲染', () => {
    render(
      <MemoryRouter>
        <IntelligentScorePage />
      </MemoryRouter>,
    )
    // 验证组件渲染了内容（检查页面标题 PageHeader title="V6 个股智能评分"）
    expect(screen.getAllByText(/V6 个股智能评分/).length).toBeGreaterThan(0)
  })

  // ================================================================
  // TODO: 需要完整重写的测试
  // ================================================================
  // 当前组件使用 useIntelligentScoreStore，需要使用 store.setState() 来设置测试状态
  // 而不是 mock hook
})
