/**
 * @test_id V9-TEST-ST-117
 * @covers_docs [V9-DOC-FIX-P0-001]
 */
const { mockDataBridgeInit, mockInitPWA, mockDataBridgeSubscribe, mockInitOrchestration, mockStopOrchestration, mockGetOrchestratorHealth, mockPermissionRevocationStart, mockPermissionRevocationStop, mockLogger, mockSeedDefaultStocks } = vi.hoisted(() => ({
  mockDataBridgeInit: vi.fn().mockResolvedValue(undefined),
  mockInitPWA: vi.fn(),
  mockDataBridgeSubscribe: vi.fn().mockReturnValue(() => {}),
  mockInitOrchestration: vi.fn(),
  mockStopOrchestration: vi.fn(),
  mockGetOrchestratorHealth: vi.fn().mockReturnValue([]),
  mockPermissionRevocationStart: vi.fn(),
  mockPermissionRevocationStop: vi.fn(),
  mockLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  mockSeedDefaultStocks: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/core/databridge', () => ({
  dataBridge: {
    init: mockDataBridgeInit,
    subscribe: mockDataBridgeSubscribe,
  }
}))
vi.mock('@/services/pwa/registerServiceWorker', () => ({ initPWA: mockInitPWA }))
vi.mock('@/services/orchestration', () => ({
  initOrchestration: mockInitOrchestration,
  stopOrchestration: mockStopOrchestration,
  getOrchestratorHealth: mockGetOrchestratorHealth,
}))
vi.mock('@/services/rbac/permissionRevocationService', () => ({
  permissionRevocationService: {
    start: mockPermissionRevocationStart,
    stop: mockPermissionRevocationStop,
  },
}))
vi.mock('@/config/secretConfig', () => ({
  isTushareTokenConfigured: vi.fn(() => false),
  isQwenApiKeyConfigured: vi.fn(() => false),
  isTushareTokenExpired: vi.fn(() => false),
  isQwenApiKeyExpired: vi.fn(() => false),
  getTushareTokenAgeDays: vi.fn(() => 0),
  getQwenApiKeyAgeDays: vi.fn(() => 0),
}))
vi.mock('@/config/llmConfig', () => ({
  isLlmApiKeyConfigured: vi.fn(() => false),
}))
vi.mock('@/services/system/seedService', () => ({
  seedDefaultStocks: mockSeedDefaultStocks,
}))
vi.mock('@/lib/logger', () => ({
  getLogger: () => mockLogger,
}))

import { initializeApp, shutdownApp } from './bootstrapService'

describe('bootstrapService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockInitOrchestration.mockImplementation(() => {})
    mockSeedDefaultStocks.mockResolvedValue(undefined)
  })

  it('initializeApp: 调用 dataBridge.init', async () => {
    await initializeApp()
    expect(mockDataBridgeInit).toHaveBeenCalledTimes(1)
  })

  it('initializeApp: 调用 initPWA', async () => {
    await initializeApp()
    expect(mockInitPWA).toHaveBeenCalledTimes(1)
  })

  it('initializeApp: 按正确顺序调用（dataBridge.init → initPWA）', async () => {
    await initializeApp()
    expect(mockDataBridgeInit).toHaveBeenCalledTimes(1)
    expect(mockInitPWA).toHaveBeenCalledTimes(1)
    const dbCallOrder = mockDataBridgeInit.mock.invocationCallOrder[0]!
    const pwaCallOrder = mockInitPWA.mock.invocationCallOrder[0]!
    expect(dbCallOrder).toBeLessThan(pwaCallOrder)
  })

  it('initializeApp: dataBridge.init 失败时抛出异常', async () => {
    const error = new Error('db init failed')
    mockDataBridgeInit.mockRejectedValueOnce(error)

    await expect(initializeApp()).rejects.toThrow('db init failed')
    expect(mockInitPWA).not.toHaveBeenCalled()
  })

  it('initializeApp: dataBridge.init 返回 Promise.resolve', async () => {
    mockDataBridgeInit.mockResolvedValueOnce(undefined)

    await expect(initializeApp()).resolves.toBeUndefined()
    expect(mockDataBridgeInit).toHaveBeenCalled()
  })

  it('initializeApp: initPWA 在 dataBridge.init 完成后调用', async () => {
    await initializeApp()

    const dbInitCallOrder = mockDataBridgeInit.mock.invocationCallOrder[0]!
    const pwaInitCallOrder = mockInitPWA.mock.invocationCallOrder[0]!

    expect(pwaInitCallOrder).toBeGreaterThan(dbInitCallOrder)
  })

  it('initializeApp: 调用 initOrchestration', async () => {
    await initializeApp()
    expect(mockInitOrchestration).toHaveBeenCalledTimes(1)
  })

  it('initializeApp: 编排器启动成功时记录 INFO 日志', async () => {
    await initializeApp()
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('编排器服务启动成功'),
    )
  })

  it('initializeApp: 编排器启动失败时记录 ERROR 日志且不抛出', async () => {
    mockInitOrchestration.mockImplementation(() => {
      throw new Error('Orchestrator init failed')
    })

    await expect(initializeApp()).resolves.toBeUndefined()
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('编排器服务启动失败'),
      expect.objectContaining({ error: 'Orchestrator init failed' }),
    )
  })

  it('initializeApp: 启动链路依次记录所有 INFO 日志', async () => {
    await initializeApp()
    const infoMessages = mockLogger.info.mock.calls.map(c => c[0])
    expect(infoMessages).toEqual(
      expect.arrayContaining([
        expect.stringContaining('IndexedDB initialized via DataBridge'),
        expect.stringContaining('PWA initialization triggered'),
        expect.stringContaining('RBAC permission revocation service started'),
        expect.stringContaining('编排器服务启动成功'),
      ]),
    )
  })

  it('initializeApp: 安全密钥未配置时输出 WARN 日志', async () => {
    await initializeApp()
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('主 LLM API Key 未配置'),
    )
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Tushare Token 未配置'),
    )
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Qwen API Key 未配置'),
    )
  })

  it('shutdownApp: 停止编排器并记录日志', () => {
    shutdownApp()
    expect(mockStopOrchestration).toHaveBeenCalledTimes(1)
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('编排器服务已停止'),
    )
  })

  it('shutdownApp: 停止 RBAC 服务并记录日志', () => {
    shutdownApp()
    expect(mockPermissionRevocationStop).toHaveBeenCalledTimes(1)
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('RBAC permission revocation service stopped'),
    )
  })

  describe('P0-1: 种子数据失败 UI 降级', () => {
    it('种子数据持续失败耗尽重试后调用 onSeedFailure 回调', async () => {
      const onSeedFailure = vi.fn()
      mockSeedDefaultStocks.mockRejectedValue(new Error('IndexedDB 写入失败'))

      await initializeApp({ hooks: { onSeedFailure } })

      await vi.waitFor(() => {
        expect(onSeedFailure).toHaveBeenCalledOnce()
        expect(onSeedFailure).toHaveBeenCalledWith(
          'IndexedDB 写入失败',
          expect.any(Number),
        )
      }, { timeout: 5000 })
    })

    it('种子数据重试成功后不调用 onSeedFailure', async () => {
      const onSeedFailure = vi.fn()
      let callCount = 0
      mockSeedDefaultStocks.mockImplementation(async () => {
        callCount++
        if (callCount < 3) throw new Error('临时失败')
        return Promise.resolve()
      })

      await initializeApp({ hooks: { onSeedFailure } })

      await vi.waitFor(() => {
        expect(onSeedFailure).not.toHaveBeenCalled()
      }, { timeout: 5000 })
    })

    it('重试耗尽后 onSeedFailure 被调用且重试次数正确', async () => {
      const onSeedFailure = vi.fn()
      mockSeedDefaultStocks.mockRejectedValue(new Error('持续失败'))

      await initializeApp({ hooks: { onSeedFailure } })

      await vi.waitFor(() => {
        expect(onSeedFailure).toHaveBeenCalledWith(
          expect.stringContaining('持续失败'),
          2, // MAX_SEED_RETRIES = 2
        )
      }, { timeout: 5000 })
    })
  })

  describe('P0-2: 编排器失败回调', () => {
    it('编排器启动失败时调用 onOrchestrationFailure 回调', async () => {
      const onOrchestrationFailure = vi.fn()
      mockInitOrchestration.mockImplementation(() => {
        throw new Error('编排器崩溃')
      })

      await initializeApp({ hooks: { onOrchestrationFailure } })

      expect(onOrchestrationFailure).toHaveBeenCalledWith('编排器崩溃')
    })

    it('编排器启动成功时不调用 onOrchestrationFailure', async () => {
      const onOrchestrationFailure = vi.fn()

      await initializeApp({ hooks: { onOrchestrationFailure } })

      expect(onOrchestrationFailure).not.toHaveBeenCalled()
    })

    it('编排器部分失败通过健康检查触发 onOrchestrationFailure', async () => {
      const onOrchestrationFailure = vi.fn()
      mockGetOrchestratorHealth.mockReturnValueOnce([
        { name: 'CatalystTracker', status: 'failed', lastStartTime: null, errorMessage: '初始化超时' },
      ])

      await initializeApp({ hooks: { onOrchestrationFailure } })

      expect(onOrchestrationFailure).toHaveBeenCalledWith(
        expect.stringContaining('CatalystTracker'),
      )
      expect(onOrchestrationFailure).toHaveBeenCalledWith(
        expect.stringContaining('初始化超时'),
      )
    })
  })

  describe('P0-3: 内存降级模式', () => {
    it('useMemoryFallback=true 时跳过 dataBridge.init 调用', async () => {
      await initializeApp({ useMemoryFallback: true })

      expect(mockDataBridgeInit).not.toHaveBeenCalled()
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('使用内存降级模式'),
      )
    })

    it('useMemoryFallback=false 时正常调用 dataBridge.init', async () => {
      await initializeApp({ useMemoryFallback: false })

      expect(mockDataBridgeInit).toHaveBeenCalledTimes(1)
    })

    it('dataBridge.init 失败时调用 onDataBridgeInitFailure 回调', async () => {
      const onDataBridgeInitFailure = vi.fn()
      mockDataBridgeInit.mockRejectedValueOnce(new Error('IDB 不可用'))

      await expect(
        initializeApp({ hooks: { onDataBridgeInitFailure } }),
      ).rejects.toThrow('IDB 不可用')

      expect(onDataBridgeInitFailure).toHaveBeenCalledWith('IDB 不可用')
    })

    it('dataBridge.init 成功时不调用 onDataBridgeInitFailure', async () => {
      const onDataBridgeInitFailure = vi.fn()

      await initializeApp({ hooks: { onDataBridgeInitFailure } })

      expect(onDataBridgeInitFailure).not.toHaveBeenCalled()
    })
  })
})