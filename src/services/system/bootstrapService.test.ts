const { mockDbInit, mockInitAgentSystem } = vi.hoisted(() => ({
  mockDbInit: vi.fn().mockResolvedValue(undefined),
  mockInitAgentSystem: vi.fn()
}))

vi.mock('@/data/db', () => ({ db: { init: mockDbInit } }))
vi.mock('@/agents', () => ({ initAgentSystem: mockInitAgentSystem }))

import { initializeApp } from './bootstrapService'

describe('bootstrapService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('initializeApp: 调用 db.init', async () => {
    await initializeApp()
    expect(mockDbInit).toHaveBeenCalledTimes(1)
  })

  it('initializeApp: 调用 initAgentSystem', async () => {
    await initializeApp()
    expect(mockInitAgentSystem).toHaveBeenCalledTimes(1)
  })

  it('initializeApp: 按正确顺序调用（先 db.init，后 initAgentSystem）', async () => {
    await initializeApp()
    expect(mockDbInit).toHaveBeenCalledTimes(1)
    expect(mockInitAgentSystem).toHaveBeenCalledTimes(1)
    // db.init 的调用序号应小于 initAgentSystem
    const dbCallOrder = mockDbInit.mock.invocationCallOrder[0]!
    const agentCallOrder = mockInitAgentSystem.mock.invocationCallOrder[0]!
    expect(dbCallOrder).toBeLessThan(agentCallOrder)
  })

  it('initializeApp: db.init 失败时抛出异常', async () => {
    const error = new Error('db init failed')
    mockDbInit.mockRejectedValueOnce(error)

    await expect(initializeApp()).rejects.toThrow('db init failed')
    expect(mockInitAgentSystem).not.toHaveBeenCalled()
  })

  it('initializeApp: db.init 返回 Promise.resolve', async () => {
    mockDbInit.mockResolvedValueOnce(undefined)

    await expect(initializeApp()).resolves.toBeUndefined()
    expect(mockDbInit).toHaveBeenCalled()
  })

  it('initializeApp: initAgentSystem 在 db.init 完成后调用', async () => {
    await initializeApp()

    const dbInitCallOrder = mockDbInit.mock.invocationCallOrder[0]!
    const agentInitCallOrder = mockInitAgentSystem.mock.invocationCallOrder[0]!

    expect(agentInitCallOrder).toBeGreaterThan(dbInitCallOrder)
  })
})
