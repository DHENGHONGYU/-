/**
 * @fileoverview ScoreCalibrator 单元测试
 *
 * vitest globals=true，无需 import describe/it/expect/vi
 * environment=jsdom
 */

// ---- vi.mock 会被 hoisted，工厂内不能引用外部变量 ----

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

vi.mock('@/core/databridge', () => ({
  dataBridge: {
    query: vi.fn().mockResolvedValue({ success: true, data: [] }),
  },
  ENVELOPE_ACTION: { queryList: 'queryList' },
  STORE_NAME: { stocks: 'stocks' },
}))

vi.mock('@/services/useCase/runDualStrategy.useCase', () => ({
  runDualStrategyUseCase: vi.fn().mockResolvedValue({ success: true, data: {} }),
}))

vi.mock('nanoid', () => ({
  nanoid: () => 'mock-id',
}))

// ---- 导入被测模块（vi.mock 之后） ----
import { ScoreCalibrator } from '@/services/orchestration/scoreCalibrator'
import { eventBus } from '@/lib/eventBus'

// ---- 辅助函数 ----
function emitEvent(event: string, payload?: unknown) {
  const cbs = listeners.get(event) ?? []
  cbs.forEach(cb => cb(payload))
}

/** 构造 IntelligentScore 测试数据 */
function makeScore(overrides: {
  overallScore?: number | null
  v6Score?: number | null
  symbol?: string
}): any {
  const result: any = {
    symbol: overrides.symbol ?? '600519',
    configSnapshot: {
      model: 'test',
      baseURL: 'http://test',
    },
    dimensionScores: [],
    summary: '',
    basis: '',
    missingFields: [],
    sourceSnapshot: { stock: undefined, fileNames: [], reportLength: 0 },
  }
  // 只有显式指定 overallScore 时才设置（null 也是有效值）
  if (overrides.overallScore !== undefined) {
    result.overallScore = overrides.overallScore
  } else {
    result.overallScore = 3.5
  }
  // 只有显式指定 v6Score 时才设置（undefined 表示不存在）
  if (overrides.v6Score !== undefined) {
    result.configSnapshot.v6Score = overrides.v6Score
  }
  return result
}

// ---- 测试 ----
describe('ScoreCalibrator', () => {
  let calibrator: ScoreCalibrator

  beforeEach(() => {
    listeners.clear()
    vi.clearAllMocks()
    calibrator = new ScoreCalibrator()
  })

  afterEach(() => {
    listeners.clear()
  })

  describe('生命周期', () => {
    it('start() 后 active=true，stop() 后 active=false 并清空缓存', () => {
      expect(calibrator.active).toBe(false)

      calibrator.start()
      expect(calibrator.active).toBe(true)

      emitEvent('analysis:score:completed', {
        symbol: '600519',
        score: makeScore({ overallScore: 3.5, v6Score: 3.8 }),
      })

      expect(calibrator.getAllCalibrations().length).toBe(1)

      calibrator.stop()
      expect(calibrator.active).toBe(false)
      expect(calibrator.getAllCalibrations().length).toBe(0)
    })
  })

  describe('双轨校对', () => {
    it('V6 + LLM 双轨 — 加权计算 finalScore，偏差超阈值标记 needsManualReview', () => {
      calibrator.start()

      const v6Score = 3.8
      const llmScore = 4.2
      const expectedDeviation = Math.abs(v6Score - llmScore) // 0.4
      // maxDeviation 默认 0.5, 0.4 < 0.5 → needsManualReview=false

      emitEvent('analysis:score:completed', {
        symbol: '600519',
        score: makeScore({ overallScore: llmScore, v6Score }),
      })

      const result = calibrator.getAllCalibrations()[0]
      expect(result.v6Score).toBe(v6Score)
      expect(result.llmScore).toBe(llmScore)
      expect(result.deviation).toBe(expectedDeviation)
      expect(result.needsManualReview).toBe(false) // 0.4 < 0.5

      // v6Weight=0.6, finalScore = 3.8*0.6 + 4.2*0.4 = 2.28 + 1.68 = 3.96
      expect(result.finalScore).toBeCloseTo(3.96, 2)
    })

    it('仅 V6 分 — finalScore = v6Score', () => {
      calibrator.start()

      emitEvent('analysis:score:completed', {
        symbol: '600519',
        score: makeScore({ overallScore: null, v6Score: 3.5 }),
      })

      const result = calibrator.getAllCalibrations()[0]
      expect(result.v6Score).toBe(3.5)
      expect(result.llmScore).toBeNull()
      expect(result.finalScore).toBe(3.5)
      expect(result.needsManualReview).toBe(false)
    })

    it('仅 LLM 分 — finalScore = llmScore', () => {
      calibrator.start()

      emitEvent('analysis:score:completed', {
        symbol: '600519',
        score: makeScore({ overallScore: 3.8, v6Score: undefined }),
      })

      const result = calibrator.getAllCalibrations()[0]
      expect(result.v6Score).toBeNull()
      expect(result.llmScore).toBe(3.8)
      expect(result.finalScore).toBe(3.8)
    })

    it('双轨均无 — finalScore = 0', () => {
      calibrator.start()

      emitEvent('analysis:score:completed', {
        symbol: '600519',
        score: makeScore({ overallScore: null, v6Score: undefined }),
      })

      const result = calibrator.getAllCalibrations()[0]
      expect(result.v6Score).toBeNull()
      expect(result.llmScore).toBeNull()
      expect(result.finalScore).toBe(0)
    })
  })

  describe('评级与分层', () => {
    it('score >= 4.0 → strong_buy + core-scarce', () => {
      calibrator.start()

      emitEvent('analysis:score:completed', {
        symbol: '600519',
        score: makeScore({ overallScore: 4.5, v6Score: 4.0 }),
      })

      const result = calibrator.getAllCalibrations()[0]
      // v6Weight=0.6: 4.0*0.6 + 4.5*0.4 = 2.4 + 1.8 = 4.2
      expect(result.finalScore).toBeCloseTo(4.2, 2)
      expect(result.rating).toBe('strong_buy')
      expect(result.strategyTier).toBe('core-scarce')
    })

    it('score >= 3.5 → buy + value-bargain', () => {
      calibrator.start()

      emitEvent('analysis:score:completed', {
        symbol: '600519',
        score: makeScore({ overallScore: 3.8, v6Score: 3.6 }),
      })

      const result = calibrator.getAllCalibrations()[0]
      // 3.6*0.6 + 3.8*0.4 = 2.16 + 1.52 = 3.68
      expect(result.finalScore).toBeCloseTo(3.68, 2)
      expect(result.rating).toBe('buy')
      expect(result.strategyTier).toBe('value-bargain')
    })

    it('score >= 3.2 → hold + hot-momentum', () => {
      calibrator.start()

      emitEvent('analysis:score:completed', {
        symbol: '600519',
        score: makeScore({ overallScore: 3.3, v6Score: 3.4 }),
      })

      const result = calibrator.getAllCalibrations()[0]
      // 3.4*0.6 + 3.3*0.4 = 2.04 + 1.32 = 3.36
      expect(result.finalScore).toBeCloseTo(3.36, 2)
      expect(result.rating).toBe('hold')
      expect(result.strategyTier).toBe('hot-momentum')
    })

    it('score < 3.2 → sell/watch', () => {
      calibrator.start()

      emitEvent('analysis:score:completed', {
        symbol: '600519',
        score: makeScore({ overallScore: 2.5, v6Score: 2.8 }),
      })

      const result = calibrator.getAllCalibrations()[0]
      // 2.8*0.6 + 2.5*0.4 = 1.68 + 1.0 = 2.68
      expect(result.finalScore).toBeCloseTo(2.68, 2)
      expect(result.rating).toBe('sell')
      expect(result.strategyTier).toBe('watch')
    })
  })

  describe('事件链路', () => {
    it('收到 ANALYSIS_SCORE_COMPLETED 后 emit SCORE_CALIBRATOR_ITEM', () => {
      calibrator.start()

      emitEvent('analysis:score:completed', {
        symbol: '600519',
        score: makeScore({ overallScore: 3.5, v6Score: 3.8 }),
      })

      expect(eventBus.emit).toHaveBeenCalledWith(
        'score:calibrator:item',
        expect.objectContaining({
          symbol: '600519',
        }),
      )
    })

    it('全部评分完成后触发策略分层', async () => {
      calibrator.start()

      // 修改 mock 让 dataBridge.query 返回股票数据
      const { dataBridge } = await import('@/core/databridge')
      vi.mocked(dataBridge.query).mockResolvedValue({
        success: true,
        data: [{ symbol: '600519', name: '贵州茅台' }],
      })

      emitEvent('analysis:score:completed', {
        symbol: '600519',
        score: makeScore({ overallScore: 3.5, v6Score: 3.8 }),
      })

      // 策略分层是异步的
      await vi.waitFor(() => {
        expect(eventBus.emit).toHaveBeenCalledWith(
          'strategy:classification:start',
          expect.objectContaining({ count: 1 }),
        )
      })

      await vi.waitFor(() => {
        expect(eventBus.emit).toHaveBeenCalledWith(
          'strategy:classification:done',
          expect.objectContaining({
            calibrations: expect.arrayContaining([
              expect.objectContaining({ symbol: '600519' }),
            ]),
          }),
        )
      })
    })

    it('策略分层失败时 emit STRATEGY_CLASSIFICATION_ERROR', async () => {
      calibrator.start()

      const { dataBridge } = await import('@/core/databridge')
      vi.mocked(dataBridge.query).mockResolvedValue({
        success: true,
        data: [{ symbol: '600519', name: '贵州茅台' }],
      })

      const { runDualStrategyUseCase } = await import('@/services/useCase/runDualStrategy.useCase')
      vi.mocked(runDualStrategyUseCase).mockRejectedValue(new Error('策略引擎崩溃'))

      emitEvent('analysis:score:completed', {
        symbol: '600519',
        score: makeScore({ overallScore: 3.5, v6Score: 3.8 }),
      })

      await vi.waitFor(() => {
        expect(eventBus.emit).toHaveBeenCalledWith(
          'strategy:classification:error',
          expect.objectContaining({
            error: expect.stringContaining('策略引擎崩溃'),
          }),
        )
      })
    })
  })

  describe('查询方法', () => {
    it('getAllCalibrations 返回所有校对结果', () => {
      calibrator.start()

      emitEvent('analysis:score:completed', {
        symbol: '600519',
        score: makeScore({ overallScore: 3.5, v6Score: 3.8 }),
      })

      emitEvent('analysis:score:completed', {
        symbol: '000858',
        score: {
          ...makeScore({ overallScore: 4.0, v6Score: 4.2 }),
          symbol: '000858',
        },
      })

      const all = calibrator.getAllCalibrations()
      expect(all).toHaveLength(2)
      expect(all.map(r => r.symbol)).toEqual(['600519', '000858'])
    })

    it('getManualReviewList 过滤 needsManualReview=true', () => {
      // 使用 maxDeviation=0.1 让偏差更容易触发
      calibrator = new ScoreCalibrator({ maxDeviation: 0.1 })
      calibrator.start()

      // 偏差 = |3.8 - 4.5| = 0.7 >= 0.1 → needsManualReview=true
      emitEvent('analysis:score:completed', {
        symbol: '600519',
        score: makeScore({ overallScore: 4.5, v6Score: 3.8 }),
      })

      // 仅 LLM 评分，偏差 = null → needsManualReview=false
      emitEvent('analysis:score:completed', {
        symbol: '300750',
        score: makeScore({ overallScore: 3.5, v6Score: undefined }),
      })

      const reviewList = calibrator.getManualReviewList()
      expect(reviewList.length).toBe(1)
      expect(reviewList[0].symbol).toBe('600519')
    })
  })
})
