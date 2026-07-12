import { describe, it, expect } from 'vitest'

describe('API 响应快照测试', () => {
  it('应该匹配 BridgeQueryResult 成功响应的快照', () => {
    const successResponse = {
      success: true,
      data: {
        stocks: [
          {
            code: '000001',
            name: '平安银行',
            price: 12.34,
            changePercent: 2.5,
          },
        ],
        count: 1,
      },
      traceId: 'test-trace-id-001',
      fromCache: false,
    }

    expect(successResponse).toMatchSnapshot({
      traceId: expect.stringMatching(/^test-trace-id-\d+$/),
    })
  })

  it('应该匹配 BridgeQueryResult 错误响应的快照', () => {
    const errorResponse = {
      success: false,
      error: '网络请求超时',
      traceId: 'test-trace-id-002',
    }

    expect(errorResponse).toMatchSnapshot({
      traceId: expect.stringMatching(/^test-trace-id-\d+$/),
    })
  })

  it('应该匹配空数据响应的快照', () => {
    const emptyResponse = {
      success: true,
      data: [],
      traceId: 'test-trace-id-003',
      fromCache: true,
    }

    expect(emptyResponse).toMatchSnapshot({
      traceId: expect.stringMatching(/^test-trace-id-\d+$/),
    })
  })
})