/**
 * @test_id V9-TEST-ST-117
 * @covers_docs []
 */
const { mockDataBridgeInit, mockInitPWA, mockDataBridgeSubscribe, mockInitOrchestration, mockStopOrchestration, mockPermissionRevocationStart, mockPermissionRevocationStop, mockLogger } = vi.hoisted(() => ({
  mockDataBridgeInit: vi.fn().mockResolvedValue(undefined),
  mockInitPWA: vi.fn(),
  mockDataBridgeSubscribe: vi.fn().mockReturnValue(() => {}),
  mockInitOrchestration: vi.fn(),
  mockStopOrchestration: vi.fn(),
  mockPermissionRevocationStart: vi.fn(),
  mockPermissionRevocationStop: vi.fn(),
  mockLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
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
  seedDefaultStocks: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/lib/logger', () => ({
  getLogger: () => mockLogger,
}))

import { initializeApp, shutdownApp } from './bootstrapService'

describe('bootstrapService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockInitOrchestration.mockImplementation(() => {})
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
})