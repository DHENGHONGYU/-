import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockQuery, mockLogger } = vi.hoisted(() => {
  return {
    mockQuery: vi.fn(),
    mockLogger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
  }
})

vi.mock('@/core/databridge', () => ({
  dataBridge: {
    query: mockQuery,
  },
}))

vi.mock('@/lib/logger', () => ({
  getLogger: () => mockLogger,
}))

import { loadRiskVerdicts } from './riskControlService'

describe('riskControlService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('loadRiskVerdicts()', () => {
    it('成功加载并映射为 RiskVerdict 数组', async () => {
      const mockPlans = [
        {
          id: 'plan-001',
          symbol: '600519.SH',
          direction: 'buy',
          quantity: 100,
          targetPrice: 1500,
          createdAt: 2000,
          risk: {
            checks: [
              { severity: 'warning', message: '仓位偏高' },
            ],
            warnings: ['额外警告'],
          },
        },
        {
          id: 'plan-002',
          symbol: '000001.SZ',
          direction: 'sell',
          quantity: 50,
          targetPrice: 10,
          createdAt: 1000,
          risk: {
            checks: [
              { severity: 'blocker', message: '超过单票上限' },
              { severity: 'warning', label: '流动性不足' },
            ],
          },
        },
      ]

      mockQuery.mockResolvedValue({ success: true, data: mockPlans })

      const verdicts = await loadRiskVerdicts()

      expect(verdicts).toHaveLength(2)
      // 按 createdAt 降序排列
      expect(verdicts[0]!.id).toBe('plan-001')
      expect(verdicts[1]!.id).toBe('plan-002')
    })

    it('blocker severity → triState = blocked', async () => {
      mockQuery.mockResolvedValue({
        success: true,
        data: [
          {
            id: 'plan-blocker',
            symbol: '600519.SH',
            direction: 'buy',
            quantity: 100,
            targetPrice: 100,
            createdAt: 1000,
            risk: {
              checks: [{ severity: 'blocker', message: '超限' }],
            },
          },
        ],
      })

      const verdicts = await loadRiskVerdicts()

      expect(verdicts[0]!.triState).toBe('blocked')
      expect(verdicts[0]!.result.ok).toBe(false)
      expect(verdicts[0]!.result.blocks).toContain('超限')
    })

    it('warning severity → triState = warning', async () => {
      mockQuery.mockResolvedValue({
        success: true,
        data: [
          {
            id: 'plan-warning',
            symbol: '600519.SH',
            direction: 'buy',
            quantity: 100,
            targetPrice: 100,
            createdAt: 1000,
            risk: {
              checks: [{ severity: 'warning', message: '注意风险' }],
            },
          },
        ],
      })

      const verdicts = await loadRiskVerdicts()

      expect(verdicts[0]!.triState).toBe('warning')
      expect(verdicts[0]!.result.ok).toBe(true)
      expect(verdicts[0]!.result.warnings).toContain('注意风险')
    })

    it('high severity → triState = warning', async () => {
      mockQuery.mockResolvedValue({
        success: true,
        data: [
          {
            id: 'plan-high',
            symbol: '600519.SH',
            direction: 'buy',
            quantity: 100,
            targetPrice: 100,
            createdAt: 1000,
            risk: {
              checks: [{ severity: 'high', message: '高风险' }],
            },
          },
        ],
      })

      const verdicts = await loadRiskVerdicts()

      expect(verdicts[0]!.triState).toBe('warning')
      expect(verdicts[0]!.result.warnings).toContain('高风险')
    })

    it('低 severity → triState = normal', async () => {
      mockQuery.mockResolvedValue({
        success: true,
        data: [
          {
            id: 'plan-normal',
            symbol: '600519.SH',
            direction: 'buy',
            quantity: 100,
            targetPrice: 100,
            createdAt: 1000,
            risk: {
              checks: [{ severity: 'low', message: '小问题' }],
            },
          },
        ],
      })

      const verdicts = await loadRiskVerdicts()

      expect(verdicts[0]!.triState).toBe('normal')
      expect(verdicts[0]!.result.ok).toBe(true)
      expect(verdicts[0]!.result.warnings).toHaveLength(0)
      expect(verdicts[0]!.result.blocks).toHaveLength(0)
    })

    it('同时有 blocker 和 warning 时，blocker 优先', async () => {
      mockQuery.mockResolvedValue({
        success: true,
        data: [
          {
            id: 'plan-mixed',
            symbol: '600519.SH',
            direction: 'buy',
            quantity: 100,
            targetPrice: 100,
            createdAt: 1000,
            risk: {
              checks: [
                { severity: 'blocker', message: '硬限制' },
                { severity: 'warning', message: '软警告' },
              ],
            },
          },
        ],
      })

      const verdicts = await loadRiskVerdicts()

      expect(verdicts[0]!.triState).toBe('blocked')
      expect(verdicts[0]!.result.blocks).toContain('硬限制')
      expect(verdicts[0]!.result.warnings).toContain('软警告')
    })

    it('risk.warnings 数组也被加入 warnings', async () => {
      mockQuery.mockResolvedValue({
        success: true,
        data: [
          {
            id: 'plan-extrawarn',
            symbol: '600519.SH',
            direction: 'buy',
            quantity: 100,
            targetPrice: 100,
            createdAt: 1000,
            risk: {
              checks: [{ severity: 'info', message: 'info 级' }],
              warnings: ['额外警告1', '额外警告2'],
            },
          },
        ],
      })

      const verdicts = await loadRiskVerdicts()

      expect(verdicts[0]!.result.warnings).toContain('额外警告1')
      expect(verdicts[0]!.result.warnings).toContain('额外警告2')
    })

    it('无 risk 字段时默认为 normal', async () => {
      mockQuery.mockResolvedValue({
        success: true,
        data: [
          {
            id: 'plan-norisk',
            symbol: '600519.SH',
            direction: 'buy',
            quantity: 100,
            targetPrice: 100,
            createdAt: 1000,
          },
        ],
      })

      const verdicts = await loadRiskVerdicts()

      expect(verdicts[0]!.triState).toBe('normal')
      expect(verdicts[0]!.result.ok).toBe(true)
    })

    it('空数组返回空数组', async () => {
      mockQuery.mockResolvedValue({ success: true, data: [] })

      const verdicts = await loadRiskVerdicts()

      expect(verdicts).toEqual([])
    })

    it('data 为 undefined 时返回空数组', async () => {
      mockQuery.mockResolvedValue({ success: true, data: undefined })

      const verdicts = await loadRiskVerdicts()

      expect(verdicts).toEqual([])
    })

    it('查询失败时抛出错误', async () => {
      mockQuery.mockResolvedValue({ success: false, error: '数据库错误' })

      await expect(loadRiskVerdicts()).rejects.toThrow('数据库错误')
    })

    it('查询失败无 error 消息时使用默认消息', async () => {
      mockQuery.mockResolvedValue({ success: false })

      await expect(loadRiskVerdicts()).rejects.toThrow('加载风控裁决记录失败')
    })

    it('返回的 verdict 包含正确的 input 字段', async () => {
      mockQuery.mockResolvedValue({
        success: true,
        data: [
          {
            id: 'plan-input',
            symbol: '600519.SH',
            direction: 'buy',
            quantity: 200,
            targetPrice: 1500.5,
            createdAt: 1000,
            risk: { checks: [] },
          },
        ],
      })

      const verdicts = await loadRiskVerdicts()

      expect(verdicts[0]!.input.symbol).toBe('600519.SH')
      expect(verdicts[0]!.input.direction).toBe('buy')
      expect(verdicts[0]!.input.quantity).toBe(200)
      expect(verdicts[0]!.input.price).toBe(1500.5)
      expect(verdicts[0]!.input.source).toBe('manual')
      expect(verdicts[0]!.input.portfolioValue).toBe(0)
    })

    it('返回的 verdict timestamp 等于 createdAt', async () => {
      mockQuery.mockResolvedValue({
        success: true,
        data: [
          {
            id: 'plan-ts',
            symbol: 'TEST',
            direction: 'buy',
            quantity: 10,
            targetPrice: 100,
            createdAt: 1234567890,
            risk: { checks: [] },
          },
        ],
      })

      const verdicts = await loadRiskVerdicts()

      expect(verdicts[0]!.timestamp).toBe(1234567890)
    })

    it('check 的 label 字段作为消息（无 message 时）', async () => {
      mockQuery.mockResolvedValue({
        success: true,
        data: [
          {
            id: 'plan-label',
            symbol: 'TEST',
            direction: 'buy',
            quantity: 10,
            targetPrice: 100,
            createdAt: 1000,
            risk: {
              checks: [{ severity: 'warning', label: '检查标签' }],
            },
          },
        ],
      })

      const verdicts = await loadRiskVerdicts()

      expect(verdicts[0]!.result.warnings).toContain('检查标签')
    })

    it('message 优先于 label', async () => {
      mockQuery.mockResolvedValue({
        success: true,
        data: [
          {
            id: 'plan-msg-label',
            symbol: 'TEST',
            direction: 'buy',
            quantity: 10,
            targetPrice: 100,
            createdAt: 1000,
            risk: {
              checks: [{ severity: 'blocker', message: '消息内容', label: '标签内容' }],
            },
          },
        ],
      })

      const verdicts = await loadRiskVerdicts()

      expect(verdicts[0]!.result.blocks).toContain('消息内容')
    })

    it('riskChecks 字段（旧格式）也能识别', async () => {
      mockQuery.mockResolvedValue({
        success: true,
        data: [
          {
            id: 'plan-oldformat',
            symbol: 'TEST',
            direction: 'buy',
            quantity: 10,
            targetPrice: 100,
            createdAt: 1000,
            riskChecks: [{ severity: 'blocker', message: '旧格式' }],
          },
        ],
      })

      const verdicts = await loadRiskVerdicts()

      expect(verdicts[0]!.triState).toBe('blocked')
      expect(verdicts[0]!.result.blocks).toContain('旧格式')
    })

    it('按 createdAt 降序排列', async () => {
      mockQuery.mockResolvedValue({
        success: true,
        data: [
          { id: 'p1', symbol: 'TEST', direction: 'buy', quantity: 1, targetPrice: 1, createdAt: 100, risk: { checks: [] } },
          { id: 'p2', symbol: 'TEST', direction: 'buy', quantity: 1, targetPrice: 1, createdAt: 300, risk: { checks: [] } },
          { id: 'p3', symbol: 'TEST', direction: 'buy', quantity: 1, targetPrice: 1, createdAt: 200, risk: { checks: [] } },
        ],
      })

      const verdicts = await loadRiskVerdicts()

      expect(verdicts[0]!.id).toBe('p2')
      expect(verdicts[1]!.id).toBe('p3')
      expect(verdicts[2]!.id).toBe('p1')
    })

    it('symbol 和 direction 正确透传', async () => {
      mockQuery.mockResolvedValue({
        success: true,
        data: [
          {
            id: 'p1',
            symbol: '600519.SH',
            direction: 'sell',
            quantity: 50,
            targetPrice: 1800,
            createdAt: 1000,
            risk: { checks: [] },
          },
        ],
      })

      const verdicts = await loadRiskVerdicts()

      expect(verdicts[0]!.symbol).toBe('600519.SH')
      expect(verdicts[0]!.direction).toBe('sell')
    })
  })
})
