/**
 * @test_id V9-TEST-ST-142
 * @covers_docs []
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
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

// dataBridge subscribe mock —— 捕获订阅回调用于测试
const mockSubscribe = vi.hoisted(() => vi.fn())
const mockUnsubscribe = vi.hoisted(() => vi.fn())
const capturedCallback = vi.hoisted(() => ({
  current: null as ((envelope: { meta: { action: string; traceId: string } }) => void) | null,
}))

vi.mock('@/core/databridge', () => ({
  dataBridge: { subscribe: mockSubscribe },
}))

vi.mock('@/config/dbConfig', () => ({
  ENVELOPE_ACTION: { saveLocalDocs: 'SAVE_LOCAL_DOCS' },
}))

vi.mock('@/services/system/localDocService', () => ({
  createLocalDoc: mockCreateLocalDoc,
  listLocalDocs: mockListLocalDocs,
  searchLocalDocs: mockSearchLocalDocs,
  scanFolder: mockScanFolder,
}))

// ============================================================
// Imports
// ============================================================

import { useLocalKnowledgeStore, initLocalKnowledgeStoreSubscriptions, destroyLocalKnowledgeStoreSubscriptions } from './localKnowledgeStore'

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

afterEach(() => {
  // 清理订阅避免跨测试污染
  destroyLocalKnowledgeStoreSubscriptions()
})

beforeEach(() => {
  vi.clearAllMocks()
  // 设置 subscribe mock：捕获回调并返回 unsubscribe 函数
  mockSubscribe.mockImplementation((_channel: string, callback: (envelope: any) => void) => {
    capturedCallback.current = callback
    return mockUnsubscribe
  })
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

  /** @test_id V9-TEST-ST-142-LOAD-NO-ERR-01 */
  it('loadDocs: 失败且无 error 字段时使用默认错误消息', async () => {
    mockListLocalDocs.mockResolvedValue({ success: false })

    await useLocalKnowledgeStore.getState().loadDocs()

    expect(useLocalKnowledgeStore.getState().error).toBe('无法加载本地文档')
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
    mockSearchLocalDocs.mockResolvedValue({ success: false, error: 'Search error' })

    await useLocalKnowledgeStore.getState().searchDocs('test')

    expect(useLocalKnowledgeStore.getState().error).toBe('Search error')
    expect(useLocalKnowledgeStore.getState().loading).toBe(false)
  })

  /** @test_id V9-TEST-ST-142-SEARCH-NO-ERR-01 */
  it('searchDocs: 失败且无 error 字段时使用默认错误消息', async () => {
    mockSearchLocalDocs.mockResolvedValue({ success: false })

    await useLocalKnowledgeStore.getState().searchDocs('test')

    expect(useLocalKnowledgeStore.getState().error).toBe('无法搜索本地文档')
    expect(useLocalKnowledgeStore.getState().loading).toBe(false)
  })

  it('searchDocs: 异常应设置 error', async () => {
    mockSearchLocalDocs.mockRejectedValue(new Error('Search error'))

    await useLocalKnowledgeStore.getState().searchDocs('test')

    expect(useLocalKnowledgeStore.getState().error).toBe('Search error')
    expect(useLocalKnowledgeStore.getState().loading).toBe(false)
  })

  /** @test_id V9-TEST-ST-142-SEARCH-NON-ERR-01 */
  it('searchDocs: 非 Error 异常应使用默认错误消息', async () => {
    mockSearchLocalDocs.mockRejectedValue('非Error字符串')

    await useLocalKnowledgeStore.getState().searchDocs('test')

    expect(useLocalKnowledgeStore.getState().error).toBe('无法搜索本地文档')
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

  /** @test_id V9-TEST-ST-142-SCAN-NON-ERR-01 */
  it('scanFolder: 非 Error 异常应使用默认错误消息', async () => {
    mockScanFolder.mockRejectedValue('非Error字符串')

    await useLocalKnowledgeStore.getState().scanFolder()

    expect(useLocalKnowledgeStore.getState().error).toBe('扫描文件夹失败')
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

  /** @test_id V9-TEST-ST-142-IMPORT-NO-ERR-MSG-01 */
  it('importSampleDocs: createLocalDoc 返回 success=false 但无 error 时使用默认消息', async () => {
    mockCreateLocalDoc.mockResolvedValueOnce({ success: true })
    mockCreateLocalDoc.mockResolvedValueOnce({ success: false }) // 无 error 字段
    mockCreateLocalDoc.mockResolvedValueOnce({ success: true })
    mockListLocalDocs.mockResolvedValue({ success: true, data: [] })

    await useLocalKnowledgeStore.getState().importSampleDocs()

    // lastError 为 undefined → 使用默认消息
    expect(useLocalKnowledgeStore.getState().error).toBe('1 条示例数据导入失败')
  })

  /** @test_id V9-TEST-ST-142-IMPORT-NON-ERR-01 */
  it('importSampleDocs: 非 Error 异常应使用默认错误消息', async () => {
    mockCreateLocalDoc.mockRejectedValue('非Error字符串')

    await useLocalKnowledgeStore.getState().importSampleDocs()

    expect(useLocalKnowledgeStore.getState().error).toBe('无法导入示例数据')
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

// ============================================================
// initLocalKnowledgeStoreSubscriptions / destroyLocalKnowledgeStoreSubscriptions
// 未覆盖行 232-256
// ============================================================

describe('initLocalKnowledgeStoreSubscriptions', () => {
  /** @test_id V9-TEST-ST-142-SUB-INIT-01 */
  it('初始化时订阅 local_docs 频道', () => {
    initLocalKnowledgeStoreSubscriptions()
    expect(mockSubscribe).toHaveBeenCalledWith('local_docs', expect.any(Function))
  })

  /** @test_id V9-TEST-ST-142-SUB-INIT-02 */
  it('收到 saveLocalDocs 事件时记录日志', () => {
    initLocalKnowledgeStoreSubscriptions()
    const cb = capturedCallback.current!
    cb({ meta: { action: 'SAVE_LOCAL_DOCS', traceId: 'trace-001' } })
    expect(mockLogger.info).toHaveBeenCalledWith(
      '[localKnowledgeStore] DataBridge event received: saveLocalDoc',
      { traceId: 'trace-001' },
    )
  })

  /** @test_id V9-TEST-ST-142-SUB-INIT-03 */
  it('收到非 saveLocalDocs 事件时不记录事件日志', () => {
    initLocalKnowledgeStoreSubscriptions()
    const cb = capturedCallback.current!
    cb({ meta: { action: 'OTHER_ACTION', traceId: 'trace-002' } })
    // 不应调用 saveLocalDoc 日志
    expect(mockLogger.info).not.toHaveBeenCalledWith(
      '[localKnowledgeStore] DataBridge event received: saveLocalDoc',
      expect.anything(),
    )
  })

  /** @test_id V9-TEST-ST-142-SUB-INIT-04 */
  it('返回的 cleanup 函数调用 destroyLocalKnowledgeStoreSubscriptions', () => {
    const cleanup = initLocalKnowledgeStoreSubscriptions()
    expect(typeof cleanup).toBe('function')
    cleanup()
    expect(mockUnsubscribe).toHaveBeenCalled()
  })

  /** @test_id V9-TEST-ST-142-SUB-DESTROY-01 */
  it('destroyLocalKnowledgeStoreSubscriptions 调用 unsubscribe 并清空引用', () => {
    initLocalKnowledgeStoreSubscriptions()
    destroyLocalKnowledgeStoreSubscriptions()
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1)
    // 再次 destroy 不应再调用 unsubscribe（引用已清空）
    mockUnsubscribe.mockClear()
    destroyLocalKnowledgeStoreSubscriptions()
    expect(mockUnsubscribe).not.toHaveBeenCalled()
  })

  /** @test_id V9-TEST-ST-142-SUB-DESTROY-02 */
  it('destroyLocalKnowledgeStoreSubscriptions 无订阅时为空操作', () => {
    // afterEach 已清理，确保无订阅状态
    destroyLocalKnowledgeStoreSubscriptions()
    expect(mockUnsubscribe).not.toHaveBeenCalled()
  })

  /** @test_id V9-TEST-ST-142-SUB-REINIT-01 */
  it('重复初始化时先销毁旧订阅再创建新订阅', () => {
    initLocalKnowledgeStoreSubscriptions()
    expect(mockSubscribe).toHaveBeenCalledTimes(1)

    initLocalKnowledgeStoreSubscriptions()
    // init 开头调用 destroy → 第一次的 unsubscribe 被调用
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1)
    expect(mockSubscribe).toHaveBeenCalledTimes(2)
  })
})
