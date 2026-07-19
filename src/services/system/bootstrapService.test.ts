/**
 * @test_id V9-TEST-ST-117
 * @covers_docs []
 */
const { mockDataBridgeInit, mockInitPWA, mockDataBridgeSubscribe } = vi.hoisted(() => ({
  mockDataBridgeInit: vi.fn().mockResolvedValue(undefined),
  mockInitPWA: vi.fn(),
  mockDataBridgeSubscribe: vi.fn().mockReturnValue(() => {}),
}))

vi.mock('@/core/databridge', () => ({
  dataBridge: {
    init: mockDataBridgeInit,
    subscribe: mockDataBridgeSubscribe,
  }
}))
vi.mock('@/services/pwa/registerServiceWorker', () => ({ initPWA: mockInitPWA }))

import { initializeApp } from './bootstrapService'

describe('bootstrapService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
})
