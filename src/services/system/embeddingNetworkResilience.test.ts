/**
 * embeddingNetworkResilience.test.ts
 *
 * 网络中断场景测试：验证模型加载重试、降级、并发机制
 *
 * 测试策略：
 *  - 不使用 fake timers（避免 Promise.race + setTimeout 嵌套导致的死锁）
 *  - pipeline 立即 reject/resolve，重试延迟用真实 setTimeout
 *  - 单测超时 120s，覆盖真实重试延迟（2s+4s=6s / 2+2+4+8+16=32s）
 *
 * 覆盖范围：
 *  Suite 1 — localEmbeddingService（模型加载层）
 *    1. pipeline reject → 3次重试 → 返回 error
 *    2. 第1次 reject → 第2次成功 → 返回 768 维向量
 *    3. 全部失败后状态清空 → 下次调用可重新加载
 *    4. 并发: 3个同时调用 → 共享加载 Promise → pipeline 仅 3 次（非 9 次）
 *    5. 并发: 模型加载成功 → 3个调用全部返回 768 维向量
 *    6. 并发(时移): 加载中到达 + 加载完成后到达 → 后者复用缓存不重复发起
 *
 *  Suite 2 — embeddingMigration（迁移脚本层）
 *    7. 后端批量成功 → 直接返回
 *    8. 后端不可用 → 前端 ONNX 降级成功
 *    9. 后端+前端全部失败 → 逐条兜底 → 记录 failures
 *    10. 幂等性：已是 768 维的文档自动跳过
 *
 * @doc [V9-DOC-BACK-012, P0-embedding-upgrade]
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { LocalDoc } from '@/data/types'

// ============================================================
// Mocks
// ============================================================

vi.mock('@xenova/transformers', () => ({
  pipeline: vi.fn(),
}))

vi.mock('@/lib/logger', () => {
  const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
  return { getLogger: () => log }
})

vi.mock('@/config/dbConfig', () => ({
  STORE_NAME: { localDocs: 'local_docs' },
  ENVELOPE_ACTION: { saveLocalDocs: 'SAVE_LOCAL_DOCS' },
  ENVELOPE_TARGET: { db: 'db' },
  MODULE_ID: { system: 'system' },
}))

vi.mock('@/data/dataLayerHelpers', () => ({
  queryList: vi.fn(),
}))

vi.mock('@/core/databridge', () => ({
  dataBridge: { forward: vi.fn().mockResolvedValue(undefined) },
}))

vi.mock('@/core/envelope', () => ({
  EnvelopeFactory: { create: vi.fn(() => ({})) },
}))

vi.mock('@/config/apiPaths', () => ({
  EMBEDDING_SERVICE_URL: 'http://localhost:8001',
}))

vi.mock('nanoid', () => ({
  nanoid: vi.fn((len = 8) => 'a'.repeat(len)),
}))

// ============================================================
// Helpers
// ============================================================

function createMockDocs(count: number, dimension = 384): LocalDoc[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `doc-${i + 1}`,
    name: `研报${i + 1}`,
    content: `这是研报${i + 1}的内容，包含一些金融分析文本。`,
    embedding: new Array(dimension).fill(0.1 * (i + 1)),
    symbol: `00000${i + 1}`,
    category: '研报' as const,
    tags: ['金融', '研报'],
    sourcePath: `/docs/research-${i + 1}.pdf`,
    size: 1024 * (i + 1),
    addedAt: Date.now(),
  } as unknown as LocalDoc))
}

function createMockVectors(count: number): number[][] {
  return Array.from({ length: count }, (_, i) => new Array(768).fill(0.2 * (i + 1)))
}

function createMockPipe() {
  return vi.fn(() => ({
    data: new Array(768).fill(0.1),
    dims: [1, 768],
  }))
}

// ============================================================
// Suite 1: localEmbeddingService — 模型加载重试与并发
// ============================================================

describe('localEmbeddingService — 模型加载重试与并发', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('网络中断: pipeline reject → 3次重试 → 返回 error', async () => {
    const { pipeline } = await import('@xenova/transformers')
    vi.mocked(pipeline).mockRejectedValue(new Error('Network error: ECONNREFUSED'))

    const { embedText } = await import('./localEmbeddingService')
    const result = await embedText('测试文本')

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('模型加载失败')
    }
    expect(pipeline).toHaveBeenCalledTimes(3) // 3 次重试
  }, 30000)

  it('网络恢复: 第1次 reject → 第2次成功 → 返回 768 维向量', async () => {
    const { pipeline } = await import('@xenova/transformers')
    const mockPipe = createMockPipe()

    vi.mocked(pipeline)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(mockPipe as never)

    const { embedText } = await import('./localEmbeddingService')
    const result = await embedText('测试文本')

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.vector.length).toBe(768)
      expect(result.dimension).toBe(768)
    }
    expect(pipeline).toHaveBeenCalledTimes(2)
  }, 30000)

  it('状态清空: 全部失败后 → 下次调用可重新加载', async () => {
    const { pipeline } = await import('@xenova/transformers')

    // 第1次：全部失败
    vi.mocked(pipeline).mockRejectedValue(new Error('Network error'))
    const { embedText } = await import('./localEmbeddingService')
    const r1 = await embedText('测试')
    expect(r1.success).toBe(false)

    // 第2次：成功（状态已清空）
    const mockPipe = createMockPipe()
    vi.mocked(pipeline).mockResolvedValueOnce(mockPipe as never)
    const r2 = await embedText('测试')
    expect(r2.success).toBe(true)
  }, 30000)

  it('并发请求: 3个同时调用 → 共享加载 Promise → pipeline 仅 3 次（非 9 次）', async () => {
    const { pipeline } = await import('@xenova/transformers')
    vi.mocked(pipeline).mockRejectedValue(new Error('Network error'))

    const { embedText } = await import('./localEmbeddingService')

    // 3 个并发调用（共享同一个 pipelineLoadPromise）
    const results = await Promise.all([
      embedText('文本1'),
      embedText('文本2'),
      embedText('文本3'),
    ])

    // 全部失败
    expect(results.every(r => !r.success)).toBe(true)
    // pipeline 仅被调用 3 次（3 次重试），而非 9 次（3 调用 × 3 重试）
    // 因为 3 个调用共享同一个 pipelineLoadPromise
    expect(pipeline).toHaveBeenCalledTimes(3)
  }, 30000)

  it('并发请求: 模型加载成功 → 3个调用全部返回 768 维向量', async () => {
    const { pipeline } = await import('@xenova/transformers')
    const mockPipe = createMockPipe()
    vi.mocked(pipeline).mockResolvedValueOnce(mockPipe as never)

    const { embedText } = await import('./localEmbeddingService')

    // 3 个并发调用
    const results = await Promise.all([
      embedText('文本1'),
      embedText('文本2'),
      embedText('文本3'),
    ])

    // 全部成功
    expect(results.every(r => r.success)).toBe(true)
    if (results[0]?.success) {
      expect(results[0].vector.length).toBe(768)
    }
    if (results[1]?.success) {
      expect(results[1].vector.length).toBe(768)
    }
    if (results[2]?.success) {
      expect(results[2].vector.length).toBe(768)
    }
    // pipeline 仅被调用 1 次（首次加载），后续调用复用 pipelineInstance
    expect(pipeline).toHaveBeenCalledTimes(1)
  }, 30000)

  it('并发请求(时移): 加载中到达 + 加载完成后到达 → 后者复用缓存不重复发起', async () => {
    const { pipeline } = await import('@xenova/transformers')
    const mockPipe = createMockPipe()

    // 用 deferred 控制 pipeline resolve 时机，模拟"加载中"窗口
    let resolvePipeline!: (v: unknown) => void
    const deferred = new Promise<unknown>((resolve) => {
      resolvePipeline = resolve
    })
    vi.mocked(pipeline).mockReturnValueOnce(deferred as never)

    const { embedText } = await import('./localEmbeddingService')

    // 请求1：触发加载（pipeline 处于 pending）
    const p1 = embedText('文本1')
    // 请求2：加载中到达 → 应共享 pipelineLoadPromise，不重复发起
    const p2 = embedText('文本2')

    // 让出微任务，确保 p1/p2 都已进入 await pipelineLoadPromise
    await new Promise((r) => setTimeout(r, 10))

    // 完成 pipeline 加载
    resolvePipeline(mockPipe)

    const [r1, r2] = await Promise.all([p1, p2])
    expect(r1.success).toBe(true)
    expect(r2.success).toBe(true)
    if (r1.success) expect(r1.vector.length).toBe(768)
    if (r2.success) expect(r2.vector.length).toBe(768)

    // 请求3：加载完成后到达 → 复用 pipelineInstance，pipeline 不再被调用
    const r3 = await embedText('文本3')
    expect(r3.success).toBe(true)
    if (r3.success) expect(r3.vector.length).toBe(768)

    // pipeline 仅被调用 1 次：请求1触发加载；请求2共享 Promise；请求3复用缓存
    expect(pipeline).toHaveBeenCalledTimes(1)
  }, 30000)
})

// ============================================================
// Suite 2: embeddingMigration — 网络中断下的重试与降级
// ============================================================

describe('embeddingMigration — 网络中断下的重试与降级', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('后端批量成功: fetch 200 → 直接返回向量', async () => {
    const docs = createMockDocs(3, 384)
    const vectors = createMockVectors(3)

    const { queryList } = await import('@/data/dataLayerHelpers')
    vi.mocked(queryList).mockResolvedValue(docs)

    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('/api/embed/batch')) {
        return { ok: true, json: async () => ({ vectors }) } as Response
      }
      return { ok: true, json: async () => ({ model_loaded: true }) } as Response
    }))

    const { rebuildAllEmbeddings } = await import('./embeddingMigration')
    const result = await rebuildAllEmbeddings()

    expect(result.total).toBe(3)
    expect(result.migrated).toBe(3)
    expect(result.failed).toBe(0)
    expect(result.skipped).toBe(0)
  }, 30000)

  it('后端不可用 → 健康检查失败 × 5 → 前端 ONNX 降级成功', async () => {
    const docs = createMockDocs(2, 384)

    const { queryList } = await import('@/data/dataLayerHelpers')
    vi.mocked(queryList).mockResolvedValue(docs)

    // fetch 全部抛错（网络中断）
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('Failed to fetch: ECONNREFUSED')
    }))

    // pipeline 立即 resolve（前端模型已缓存）
    const { pipeline } = await import('@xenova/transformers')
    const mockPipe = createMockPipe()
    vi.mocked(pipeline).mockResolvedValue(mockPipe as never)

    const { rebuildAllEmbeddings } = await import('./embeddingMigration')
    const progressCalls: Array<{ done: number; total: number }> = []
    const result = await rebuildAllEmbeddings({
      onProgress: (done, total) => progressCalls.push({ done, total }),
    })

    // 前端降级成功
    expect(result.migrated).toBe(2)
    expect(result.failed).toBe(0)
    expect(progressCalls.length).toBeGreaterThanOrEqual(2)
    expect(progressCalls[progressCalls.length - 1]?.done).toBe(2)
  }, 120000)

  it('后端+前端全部失败 → 逐条兜底 → 记录 failures', async () => {
    const docs = createMockDocs(2, 384)

    const { queryList } = await import('@/data/dataLayerHelpers')
    vi.mocked(queryList).mockResolvedValue(docs)

    // fetch 全部失败
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('Failed to fetch: ECONNREFUSED')
    }))

    // pipeline 立即 reject（前端模型未缓存）
    const { pipeline } = await import('@xenova/transformers')
    vi.mocked(pipeline).mockRejectedValue(new Error('Network error: model download failed'))

    const { rebuildAllEmbeddings } = await import('./embeddingMigration')
    const result = await rebuildAllEmbeddings()

    expect(result.migrated).toBe(0)
    expect(result.failed).toBe(2)
    expect(result.failures.length).toBe(2)
    expect(result.failures[0]?.id).toBeDefined()
    expect(result.failures[0]?.error).toBeDefined()
    // pipeline 调用次数：embedViaFrontend(3) + 逐条兜底(3×2=6) = 9 次
    expect(pipeline).toHaveBeenCalledTimes(9)
  }, 120000)

  it('幂等性: 已是 768 维的文档自动跳过', async () => {
    const docs = createMockDocs(3, 768)

    const { queryList } = await import('@/data/dataLayerHelpers')
    vi.mocked(queryList).mockResolvedValue(docs)

    vi.stubGlobal('fetch', vi.fn())

    const { rebuildAllEmbeddings } = await import('./embeddingMigration')
    const result = await rebuildAllEmbeddings()

    expect(result.total).toBe(3)
    expect(result.skipped).toBe(3)
    expect(result.migrated).toBe(0)
    expect(result.failed).toBe(0)
    expect(vi.mocked(fetch)).not.toHaveBeenCalled()
  }, 30000)
})
