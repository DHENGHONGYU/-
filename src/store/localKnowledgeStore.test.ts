/**
 * @test_id V9-TEST-ST-142
 * @covers_docs []
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'
import type { LocalDoc } from '@/data/types'

// ============================================================
// vi.hoisted mocks
// ============================================================

const mockLogger = vi.hoisted(() => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }))
vi.mock('@/lib/logger', () => ({ getLogger: () => mockLogger }))

const mockListLocalDocs = vi.hoisted(() => vi.fn())
const mockSearchLocalDocs = vi.hoisted(() => vi.fn())
const mockScanFolder = vi.hoisted(() => vi.fn())
const mockCreateLocalDoc = vi.hoisted(() => vi.fn())

vi.mock('@/services/system/localDocService', () => ({
  createLocalDoc: mockCreateLocalDoc,
  listLocalDocs: mockListLocalDocs,
  searchLocalDocs: mockSearchLocalDocs,
  scanFolder: mockScanFolder,
}))

// ============================================================
// Imports
// ============================================================

import { useLocalKnowledgeStore } from './localKnowledgeStore'

// ============================================================
// Helpers
// ============================================================

function createMockDoc(overrides: Partial<LocalDoc> = {}): LocalDoc {
  return {
    id: 'doc-1',
    symbol: '600519.SH',
    name: '贵州茅台2024年研报',
    content: '内容',
    category: '研报',
    tags: ['白酒'],
    sourcePath: '/samples/贵州茅台2024年研报.md',
    size: 2048,
    addedAt: Date.now(),
    ...overrides,
  }
}

// ============================================================
// Setup
// ============================================================

beforeEach(() => {
  vi.clearAllMocks()
  useLocalKnowledgeStore.setState({
    activeTab: 'browse',
    docs: [],
    symbolFilter: '全部',
    keyword: '',
    searchResults: [],
    message: null,
    loading: false,
    error: null,
  })
})

// ============================================================
// useLocalKnowledgeStore
// ============================================================

describe('useLocalKnowledgeStore', () => {
  it('初始状态验证', () => {
    const state = useLocalKnowledgeStore.getState()
    expect(state.activeTab).toBe('browse')
    expect(state.docs).toEqual([])
    expect(state.symbolFilter).toBe('全部')
    expect(state.keyword).toBe('')
    expect(state.searchResults).toEqual([])
    expect(state.message).toBeNull()
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
  })

  it('setActiveTab: 切换标签页', () => {
    useLocalKnowledgeStore.getState().setActiveTab('search')
    expect(useLocalKnowledgeStore.getState().activeTab).toBe('search')

    useLocalKnowledgeStore.getState().setActiveTab('stats')
    expect(useLocalKnowledgeStore.getState().activeTab).toBe('stats')
  })

  it('loadDocs: 成功加载（不传 filter 时使用当前 symbolFilter）', async () => {
    const docs = [createMockDoc(), createMockDoc({ id: 'doc-2', symbol: '00700.HK' })]
    mockListLocalDocs.mockResolvedValue({ success: true, data: docs })

    await useLocalKnowledgeStore.getState().loadDocs()

    const state = useLocalKnowledgeStore.getState()
    expect(state.docs).toEqual(docs)
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
    expect(mockListLocalDocs).toHaveBeenCalledWith(undefined) // '全部' => undefined
  })

  it('loadDocs: 传入特定 filter', async () => {
    mockListLocalDocs.mockResolvedValue({ success: true, data: [] })

    await useLocalKnowledgeStore.getState().loadDocs('600519.SH')

    expect(mockListLocalDocs).toHaveBeenCalledWith('600519.SH')
  })

  it('loadDocs: 使用 symbolFilter 作为后备', async () => {
    useLocalKnowledgeStore.setState({ symbolFilter: '00700.HK' })
    mockListLocalDocs.mockResolvedValue({ success: true, data: [] })

    await useLocalKnowledgeStore.getState().loadDocs()

    expect(mockListLocalDocs).toHaveBeenCalledWith('00700.HK')
  })

  it('loadDocs: 失败应设置 error', async () => {
    mockListLocalDocs.mockResolvedValue({ success: false, error: '列表加载失败' })

    await useLocalKnowledgeStore.getState().loadDocs()

    expect(useLocalKnowledgeStore.getState().error).toBe('列表加载失败')
    expect(useLocalKnowledgeStore.getState().loading).toBe(false)
  })

  it('loadDocs: 异常应设置 error', async () => {
    mockListLocalDocs.mockRejectedValue(new Error('Network error'))

    await useLocalKnowledgeStore.getState().loadDocs()

    expect(useLocalKnowledgeStore.getState().error).toBe('Network error')
    expect(useLocalKnowledgeStore.getState().loading).toBe(false)
  })

  it('loadDocs: 非 Error 异常应使用默认错误消息', async () => {
    mockListLocalDocs.mockRejectedValue('timeout')

    await useLocalKnowledgeStore.getState().loadDocs()

    expect(useLocalKnowledgeStore.getState().error).toBe('无法加载本地文档')
  })

  it('searchDocs: 成功搜索', async () => {
    const results = [createMockDoc()]
    mockSearchLocalDocs.mockResolvedValue({ success: true, data: results })

    await useLocalKnowledgeStore.getState().searchDocs('茅台')

    const state = useLocalKnowledgeStore.getState()
    expect(state.searchResults).toEqual(results)
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
  })

  it('searchDocs: 失败应设置 error', async () => {
    mockSearchLocalDocs.mockResolvedValue({ success: false, error: '搜索失败' })

    await useLocalKnowledgeStore.getState().searchDocs('test')

    expect(useLocalKnowledgeStore.getState().error).toBe('搜索失败')
    expect(useLocalKnowledgeStore.getState().loading).toBe(false)
  })

  it('searchDocs: 异常应设置 error', async () => {
    mockSearchLocalDocs.mockRejectedValue(new Error('Search error'))

    await useLocalKnowledgeStore.getState().searchDocs('test')

    expect(useLocalKnowledgeStore.getState().error).toBe('Search error')
    expect(useLocalKnowledgeStore.getState().loading).toBe(false)
  })

  it('scanFolder: 浏览器不支持 File System Access API', async () => {
    mockScanFolder.mockResolvedValue(null)

    await useLocalKnowledgeStore.getState().scanFolder()

    expect(useLocalKnowledgeStore.getState().message).toContain('File System Access API')
  })

  it('scanFolder: 未找到支持文件', async () => {
    mockScanFolder.mockResolvedValue({ files: [], totalSize: 0, errors: [] })

    await useLocalKnowledgeStore.getState().scanFolder()

    expect(useLocalKnowledgeStore.getState().message).toContain('未在选择的文件夹中找到支持的文件')
  })

  it('scanFolder: 扫描完成', async () => {
    mockScanFolder.mockResolvedValue({ files: [{ name: 'a.md', path: '/a.md', size: 100, content: '', lastModified: 0 }], totalSize: 100, errors: [] })

    await useLocalKnowledgeStore.getState().scanFolder()

    expect(useLocalKnowledgeStore.getState().message).toContain('扫描完成，发现 1 个文件')
  })

  it('scanFolder: 异常应设置 error', async () => {
    mockScanFolder.mockRejectedValue(new Error('Scan error'))

    await useLocalKnowledgeStore.getState().scanFolder()

    expect(useLocalKnowledgeStore.getState().error).toBe('Scan error')
  })

  it('scanFolder: 有错误但无文件时应提示扫描完成 0 个文件', async () => {
    mockScanFolder.mockResolvedValue({ files: [], totalSize: 0, errors: ['err'] })

    await useLocalKnowledgeStore.getState().scanFolder()

    expect(useLocalKnowledgeStore.getState().message).toContain('扫描完成，发现 0 个文件')
  })

  it('importSampleDocs: 全部成功', async () => {
    mockCreateLocalDoc.mockResolvedValue({ success: true })
    mockListLocalDocs.mockResolvedValue({ success: true, data: [] })

    await useLocalKnowledgeStore.getState().importSampleDocs()

    const state = useLocalKnowledgeStore.getState()
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
    expect(state.message).toBe('示例数据导入成功')
    expect(mockCreateLocalDoc).toHaveBeenCalledTimes(3)
  })

  it('importSampleDocs: 部分失败应设置 error', async () => {
    mockCreateLocalDoc.mockResolvedValueOnce({ success: true })
    mockCreateLocalDoc.mockResolvedValueOnce({ success: false, error: '重复数据' })
    mockCreateLocalDoc.mockResolvedValueOnce({ success: true })
    mockListLocalDocs.mockResolvedValue({ success: true, data: [] })

    await useLocalKnowledgeStore.getState().importSampleDocs()

    const state = useLocalKnowledgeStore.getState()
    expect(state.loading).toBe(false)
    expect(state.error).toBe('重复数据')
  })

  it('importSampleDocs: 异常应设置 error', async () => {
    mockCreateLocalDoc.mockRejectedValue(new Error('Import error'))

    await useLocalKnowledgeStore.getState().importSampleDocs()

    expect(useLocalKnowledgeStore.getState().error).toBe('Import error')
    expect(useLocalKnowledgeStore.getState().loading).toBe(false)
  })

  it('setSymbolFilter: 更新过滤条件', () => {
    useLocalKnowledgeStore.getState().setSymbolFilter('600519.SH')
    expect(useLocalKnowledgeStore.getState().symbolFilter).toBe('600519.SH')
  })

  it('setKeyword: 更新关键词', () => {
    useLocalKnowledgeStore.getState().setKeyword('茅台')
    expect(useLocalKnowledgeStore.getState().keyword).toBe('茅台')
  })

  it('setMessage: 设置消息并在 duration 后清除', async () => {
    vi.useFakeTimers()
    useLocalKnowledgeStore.getState().setMessage('提示消息', 1000)

    expect(useLocalKnowledgeStore.getState().message).toBe('提示消息')

    vi.advanceTimersByTime(1001)
    expect(useLocalKnowledgeStore.getState().message).toBeNull()

    vi.useRealTimers()
  })

  it('setMessage: durationMs=0 时不自动清除', async () => {
    vi.useFakeTimers()
    useLocalKnowledgeStore.getState().setMessage('持久消息', 0)

    vi.advanceTimersByTime(10000)
    expect(useLocalKnowledgeStore.getState().message).toBe('持久消息')

    vi.useRealTimers()
  })

  it('clearMessage: 立即清除消息', () => {
    useLocalKnowledgeStore.getState().setMessage('test')
    useLocalKnowledgeStore.getState().clearMessage()
    expect(useLocalKnowledgeStore.getState().message).toBeNull()
  })

  it('setMessage: 新消息覆盖旧消息定时器', async () => {
    vi.useFakeTimers()
    useLocalKnowledgeStore.getState().setMessage('旧消息', 1000)
    useLocalKnowledgeStore.getState().setMessage('新消息', 2000)

    vi.advanceTimersByTime(1001)
    expect(useLocalKnowledgeStore.getState().message).toBe('新消息')

    vi.advanceTimersByTime(1000)
    expect(useLocalKnowledgeStore.getState().message).toBeNull()

    vi.useRealTimers()
  })
})
