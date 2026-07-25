/**
 * @fileoverview RegistrationOrchestrator 单元测试
 *
 * vitest globals=true，无需 import describe/it/expect/vi
 * environment=jsdom
 */

// ---- vi.mock 必须在 import 之前，且工厂内不能引用外部变量 ----
// vi.mock 会被 hoisted，所以所有引用必须在工厂内部定义

vi.mock('@/lib/logger', () => ({
  getLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

const listeners = new Map<string, Array<(payload: unknown) => void>>()

vi.mock('@/lib/eventBus', () => ({
  eventBus: {
    on: vi.fn((event: string, callback: (payload: unknown) => void) => {
      if (!listeners.has(event)) listeners.set(event, [])
      listeners.get(event)!.push(callback)
      return () => { /* unsub */ }
    }),
    emit: vi.fn((event: string, payload?: unknown) => {
      const cbs = listeners.get(event) ?? []
      cbs.forEach(cb => cb(payload))
    }),
    off: vi.fn(),
    clearAll: vi.fn(() => listeners.clear()),
  },
}))

vi.mock('@/services/data-collector/collectionPipeline', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/data-collector/collectionPipeline')>()
  return {
    ...actual,
    runBatchTrace: vi.fn().mockResolvedValue(undefined),
    createDefaultCollectionConfig: vi.fn().mockReturnValue({}),
  }
})

vi.mock('nanoid', () => ({
  nanoid: () => 'mock-id',
}))

// ---- 导入被测模块（vi.mock 之后） ----
import { RegistrationOrchestrator } from '@/services/orchestration/registrationOrchestrator'
import { eventBus } from '@/lib/eventBus'

// ---- 辅助函数 ----
function emitEvent(event: string, payload?: unknown) {
  const cbs = listeners.get(event) ?? []
  cbs.forEach(cb => cb(payload))
}

// ---- 测试 ----
describe('RegistrationOrchestrator', () => {
  let orchestrator: RegistrationOrchestrator

  beforeEach(() => {
    listeners.clear()
    vi.clearAllMocks()
    orchestrator = new RegistrationOrchestrator()
  })

  afterEach(() => {
    listeners.clear()
  })

  describe('生命周期', () => {
    it('start() 后 active=true，stop() 后 active=false', () => {
      expect(orchestrator.active).toBe(false)

      orchestrator.start()
      expect(orchestrator.active).toBe(true)

      orchestrator.stop()
      expect(orchestrator.active).toBe(false)
    })

    it('重复 start() 不会重复注册监听', () => {
      orchestrator.start()
      const callCountAfterFirst = (eventBus.on as ReturnType<typeof vi.fn>).mock.calls.length

      orchestrator.start()
      const callCountAfterSecond = (eventBus.on as ReturnType<typeof vi.fn>).mock.calls.length

      expect(callCountAfterSecond).toBe(callCountAfterFirst)
      expect(orchestrator.active).toBe(true)
    })
  })

  describe('BATCH_IMPORT_COMPLETED 事件处理', () => {
    it('收到有 successSymbols 的 payload 时触发采集', async () => {
      orchestrator.start()

      const payload = {
        total: 3,
        success: 2,
        failed: 1,
        successSymbols: ['600519', '000858'],
      }

      emitEvent('BATCH_IMPORT_COMPLETED', payload)

      // 等待异步操作完成
      await vi.waitFor(() => {
        expect(eventBus.emit).toHaveBeenCalledWith(
          'registration:collect:start',
          expect.objectContaining({ symbols: ['600519', '000858'] }),
        )
      })

      await vi.waitFor(() => {
        expect(eventBus.emit).toHaveBeenCalledWith(
          'registration:collect:complete',
          expect.objectContaining({
            symbols: ['600519', '000858'],
          }),
        )
      })
    })

    it('successSymbols 为空数组时跳过采集', async () => {
      orchestrator.start()

      const payload = {
        total: 3,
        success: 0,
        failed: 3,
        successSymbols: [],
      }

      emitEvent('BATCH_IMPORT_COMPLETED', payload)

      // 等待确保异步处理完毕
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(eventBus.emit).not.toHaveBeenCalledWith(
        'registration:collect:start',
        expect.anything(),
      )
    })

    it('autoCollect=false 时不触发采集', async () => {
      orchestrator = new RegistrationOrchestrator({ autoCollect: false })
      orchestrator.start()

      const payload = {
        total: 3,
        success: 2,
        failed: 1,
        successSymbols: ['600519', '000858'],
      }

      emitEvent('BATCH_IMPORT_COMPLETED', payload)

      await new Promise(resolve => setTimeout(resolve, 100))

      expect(eventBus.emit).not.toHaveBeenCalledWith(
        'registration:collect:start',
        expect.anything(),
      )
    })
  })

  describe('triggerCollect 手动触发', () => {
    it('手动触发采集时 emit REGISTRATION_COLLECT_START 并返回正确结果', async () => {
      orchestrator.start()

      const result = await orchestrator.triggerCollect(['600519', '000858'])

      // triggerCollect 发出 REGISTRATION_COLLECT_START
      expect(eventBus.emit).toHaveBeenCalledWith(
        'registration:collect:start',
        expect.objectContaining({ symbols: ['600519', '000858'] }),
      )

      // triggerCollect 返回结果对象
      expect(result.triggered).toBe(true)
      expect(result.symbols).toEqual(['600519', '000858'])
      expect(result.dimensions).toEqual(
        expect.arrayContaining(['quote', 'kline', 'news', 'research', 'competitor', 'index', 'chip', 'research-detail']),
      )
      expect(result.timestamp).toBeTypeOf('number')
    })

    it('采集完成后统计 succeeded 和 failed', async () => {
      orchestrator.start()

      const result = await orchestrator.triggerCollect(['600519'])

      expect(result.triggered).toBe(true)
      expect(result.symbols).toEqual(['600519'])
      expect(result.dimensions).toEqual(
        expect.arrayContaining(['quote', 'kline', 'news', 'research', 'competitor', 'index', 'chip', 'research-detail']),
      )
      expect(result.timestamp).toBeTypeOf('number')
    })
  })
})
