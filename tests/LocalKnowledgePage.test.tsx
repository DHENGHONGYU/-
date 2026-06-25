import { describe, expect, it, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import LocalKnowledgePage from '@/pages/input/LocalKnowledgePage'
import { db } from '@/data/db'
import { useToast } from '@/hooks/useToast'
import * as localDocService from '@/services/system/localDocService'

vi.mock('@/hooks/useToast', () => ({
  useToast: vi.fn(() => ({ toast: vi.fn() })),
}))

describe('LocalKnowledgePage', () => {
  beforeEach(async () => {
    await db.init()
    await db.reset()
  })

  it('renders tabs', () => {
    render(
      <MemoryRouter>
        <LocalKnowledgePage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: '本地知识库' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '浏览' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '搜索' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '统计' })).toBeInTheDocument()
  })

  it('imports sample docs and shows them in browse tab', async () => {
    render(
      <MemoryRouter>
        <LocalKnowledgePage />
      </MemoryRouter>,
    )

    expect(screen.getByText('暂无文档，点击“导入示例数据”进行测试。')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '导入示例数据' }))

    expect(await screen.findByText('贵州茅台2024年研报')).toBeInTheDocument()
    expect(screen.getByText('腾讯控股财报摘要')).toBeInTheDocument()
    expect(screen.getByText('新能源行业策略笔记')).toBeInTheDocument()
  })

  it('search tab finds docs by keyword', async () => {
    vi.spyOn(localDocService, 'createLocalDoc').mockResolvedValue({
      success: true,
      data: {} as never,
    })
    vi.spyOn(localDocService, 'listLocalDocs').mockResolvedValue({
      success: true,
      data: [
        {
          id: '1',
          addedAt: 1,
          symbol: '600519.SH',
          name: '贵州茅台2024年研报',
          content: '贵州茅台2024年业绩稳健增长。',
          category: '研报',
          tags: ['白酒'],
          sourcePath: '',
          size: 0,
        },
        {
          id: '2',
          addedAt: 2,
          symbol: '00700.HK',
          name: '腾讯控股财报摘要',
          content: '腾讯控股最新季度财报显示。',
          category: '财报',
          tags: ['互联网'],
          sourcePath: '',
          size: 0,
        },
      ],
    })
    vi.spyOn(localDocService, 'searchLocalDocs').mockResolvedValue({
      success: true,
      data: [
        {
          id: '1',
          addedAt: 1,
          symbol: '600519.SH',
          name: '贵州茅台2024年研报',
          content: '贵州茅台2024年业绩稳健增长。',
          category: '研报',
          tags: ['白酒'],
          sourcePath: '',
          size: 0,
        },
      ],
    })

    render(
      <MemoryRouter>
        <LocalKnowledgePage />
      </MemoryRouter>,
    )

    await userEvent.click(screen.getByRole('button', { name: '导入示例数据' }))
    await screen.findByText('贵州茅台2024年研报')

    await userEvent.click(screen.getByRole('tab', { name: '搜索' }))

    const searchInput = screen.getByPlaceholderText('输入关键词搜索文档、股票代码或标签')
    await userEvent.type(searchInput, '茅台')
    await userEvent.click(screen.getByRole('button', { name: '搜索' }))

    expect(await screen.findByText('贵州茅台2024年研报')).toBeInTheDocument()
    expect(screen.queryByText('腾讯控股财报摘要')).not.toBeInTheDocument()
  })

  it('stats tab shows counts', async () => {
    vi.spyOn(localDocService, 'createLocalDoc').mockResolvedValue({
      success: true,
      data: {} as never,
    })
    vi.spyOn(localDocService, 'listLocalDocs').mockResolvedValue({
      success: true,
      data: [
        {
          id: '1',
          addedAt: 1,
          symbol: '600519.SH',
          name: '贵州茅台2024年研报',
          content: '',
          category: '研报',
          tags: [],
          sourcePath: '',
          size: 0,
        },
        {
          id: '2',
          addedAt: 2,
          symbol: '00700.HK',
          name: '腾讯控股财报摘要',
          content: '',
          category: '财报',
          tags: [],
          sourcePath: '',
          size: 0,
        },
        {
          id: '3',
          addedAt: 3,
          symbol: 'ALL',
          name: '新能源行业策略笔记',
          content: '',
          category: '策略笔记',
          tags: [],
          sourcePath: '',
          size: 0,
        },
      ],
    })

    render(
      <MemoryRouter>
        <LocalKnowledgePage />
      </MemoryRouter>,
    )

    await userEvent.click(screen.getByRole('button', { name: '导入示例数据' }))
    await screen.findByText('贵州茅台2024年研报')

    await userEvent.click(screen.getByRole('tab', { name: '统计' }))

    const statCards = await screen.findAllByText('3')
    expect(statCards.length).toBeGreaterThanOrEqual(2)

    expect(screen.getByText('研报: 1')).toBeInTheDocument()
    expect(screen.getByText('财报: 1')).toBeInTheDocument()
    expect(screen.getByText('策略笔记: 1')).toBeInTheDocument()
  })

  it('disables import and search buttons while importing', async () => {
    vi.spyOn(localDocService, 'createLocalDoc').mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ success: true, data: {} as never }), 100)),
    )

    render(
      <MemoryRouter>
        <LocalKnowledgePage />
      </MemoryRouter>,
    )

    const importBtn = screen.getByRole('button', { name: '导入示例数据' })
    await userEvent.click(importBtn)

    await waitFor(() => {
      expect(importBtn).toBeDisabled()
      expect(screen.getByRole('button', { name: '导入文件夹' })).toBeDisabled()
    })
  })

  it('shows error toast when import fails', async () => {
    const toast = vi.fn()
    vi.mocked(useToast).mockReturnValue({ toast, toasts: [], dismiss: vi.fn() })
    vi.spyOn(localDocService, 'createLocalDoc').mockResolvedValue({
      success: false,
      error: '写入失败',
    })

    render(
      <MemoryRouter>
        <LocalKnowledgePage />
      </MemoryRouter>,
    )

    await userEvent.click(screen.getByRole('button', { name: '导入示例数据' }))

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'error', title: '导入失败' }),
      )
    })
  })

  it('shows error toast when search fails', async () => {
    const toast = vi.fn()
    vi.mocked(useToast).mockReturnValue({ toast, toasts: [], dismiss: vi.fn() })
    vi.spyOn(localDocService, 'searchLocalDocs').mockResolvedValue({
      success: false,
      error: '索引不可用',
    })

    render(
      <MemoryRouter>
        <LocalKnowledgePage />
      </MemoryRouter>,
    )

    await userEvent.click(screen.getByRole('tab', { name: '搜索' }))
    await userEvent.type(screen.getByPlaceholderText('输入关键词搜索文档、股票代码或标签'), '茅台')
    await userEvent.click(screen.getByRole('button', { name: '搜索' }))

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'error', title: '搜索失败' }),
      )
    })
  })
})
