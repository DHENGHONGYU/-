/**
 * 复盘启动分析 Store（RLES）
 *
 * 负责拉取标的的 V6 评分、板块轮动、八级筹码、市场宽度与硬风险，组装 RLES 输入，
 * 调用纯函数引擎 evaluateReviewLaunch，并持有评估结果。数据获取在 store 内完成，
 * 评分计算委托给 rles-engine。
 *
 * 已接线因子：
 *  - D2 策略适配度：V6 评分 + 板块景气（fetchSectorScoreForStock → f1Jingqi）
 *  - D3 时机成熟度：V6 评级 + 黄金买点 + 二波检测器 + 板块资金（f2Zijin）+ 市场宽度（fetchMarketBreadthResilient）
 *  - D4 风险健康度：V6 风险 + 八级筹码（evaluateChipForStock）+ 三条禁令（detectHardRisksResilient）
 * 任一数据源缺失时引擎自动中性降级，不阻断首版运行。
 */

import { create } from 'zustand'
import { runV6Score } from '@/services/scoring/v6ScoreService'
import { fetchKlineData, type KlineData } from '@/services/collect'
import {
  evaluateReviewLaunch,
  type RlesInput,
  type RlesResult,
} from '@/services/scoring/rles-engine/reviewLaunchEvaluator'
import { detectSecondWave, type SecondWaveSignal } from '@/services/scoring/rles-engine/secondWaveDetector'
import { fetchMarketBreadthResilient, computeBreadthScore } from '@/services/scoring/rles-engine/breadthFactor'
import { fetchSectorScoreForStock } from '@/services/scoring/rles-engine/sectorScoreBridge'
import { evaluateChipForStock } from '@/services/scoring/rles-engine/chipBridge'
import { detectHardRisksResilient } from '@/services/scoring/rles-engine/hardRiskDetector'
import type { V6Score } from '@/data/types/types.score'
import type { RotationSectorScore } from '@/data/types/types.rotation'
import type { ChipResult } from '@/services/scoring/v6-engine/types'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

interface ReviewLaunchState {
  symbol: string
  v6Score: V6Score | null
  result: RlesResult | null
  /** 主升浪二波检测器原始信号（供页面展示归因明细） */
  secondWaveSignal: SecondWaveSignal | null
  /** 市场宽度分（MAS breadth，0-100；null=未取到） */
  marketBreadth: number | null
  /** 个股所属板块的轮动五因子评分（含 f1Jingqi/f2Zijin） */
  rotationScore: RotationSectorScore | null
  /** 八级筹码结果 */
  chip: ChipResult | null
  /** 三条禁令命中的硬风险标签 */
  hardRisks: string[]
  loading: boolean
  error: string | null
  lastUpdated: number
  setSymbol: (symbol: string) => void
  runEvaluation: (symbol?: string) => Promise<void>
  reset: () => void
}

const initialState = {
  symbol: '' as string,
  v6Score: null as V6Score | null,
  result: null as RlesResult | null,
  secondWaveSignal: null as SecondWaveSignal | null,
  marketBreadth: null as number | null,
  rotationScore: null as RotationSectorScore | null,
  chip: null as ChipResult | null,
  hardRisks: [] as string[],
  loading: false as boolean,
  error: null as string | null,
  lastUpdated: 0 as number,
}

export const useReviewLaunchStore = create<ReviewLaunchState>((set, get) => ({
  ...initialState,
  setSymbol: (symbol) => set({ symbol }),
  runEvaluation: async (symbol) => {
    const target = symbol ?? get().symbol
    if (!target) {
      set({ error: '未指定复盘标的' })
      return
    }
    set({ loading: true, error: null, symbol: target })
    try {
      const v6Res = await runV6Score(target)
      const v6Score = v6Res.success ? (v6Res.data ?? null) : null

      // 日线 K 线（120 根覆盖 60 日主升浪窗口 + MA20 + 试盘回溯），二波与筹码共享
      let kline: KlineData | null = null
      try {
        kline = await fetchKlineData({ symbol: target, period: 'daily', adjust: 'qfq', count: 120 })
      } catch (kerr) {
        const kmsg = kerr instanceof Error ? kerr.message : String(kerr)
        logger.warn('[reviewLaunchStore] K线获取失败，二波/筹码因子降级为中性', { symbol: target, error: kmsg })
      }
      const history = kline && kline.history.length > 0 ? kline.history : null

      // 二波检测器
      const secondWaveSignal: SecondWaveSignal | null = history ? detectSecondWave(history) : null

      // 八级筹码（复用 K 线）
      const chip: ChipResult | null = history ? evaluateChipForStock(target, history) : null

      // 市场宽度（MAS breadth，优先真实源 /api/collect/breadth，失败回退 mock）
      let marketBreadth: number | null = null
      try {
        const breadthInput = await fetchMarketBreadthResilient()
        if (breadthInput) marketBreadth = computeBreadthScore(breadthInput)
      } catch (berr) {
        const bmsg = berr instanceof Error ? berr.message : String(berr)
        logger.warn('[reviewLaunchStore] 市场宽度获取失败，降级为中性', { symbol: target, error: bmsg })
      }

      // 板块轮动（股票→行业名称匹配）
      let rotationScore: RotationSectorScore | null = null
      try {
        rotationScore = await fetchSectorScoreForStock(target)
      } catch (rerr) {
        const rmsg = rerr instanceof Error ? rerr.message : String(rerr)
        logger.warn('[reviewLaunchStore] 板块轮动获取失败，降级为中性', { symbol: target, error: rmsg })
      }

      // 三条禁令硬风险（优先后端 /api/collect/risk 真实源，失败回退显式表 + 名称兜底）
      const hardRisks = await detectHardRisksResilient(target, v6Score?.name)

      const input: RlesInput = {
        symbol: target,
        v6Score,
        goldenBuyDetected: v6Score?.rating === 'strong_buy',
        secondWaveSignal,
        marketBreadth,
        rotationScore,
        chip,
        hardRisks,
      }
      const result = evaluateReviewLaunch(input)
      set({
        v6Score,
        result,
        secondWaveSignal,
        marketBreadth,
        rotationScore,
        chip,
        hardRisks,
        loading: false,
        lastUpdated: Date.now(),
      })
      logger.info('[reviewLaunchStore] 评估完成', {
        symbol: target,
        total: result.total,
        tier: result.tier,
        marketBreadth,
        sectorFit: rotationScore ? rotationScore.f1Jingqi : null,
        chipRisk: chip ? chip.riskLevel : null,
        hardRisks,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      set({ loading: false, error: msg })
      logger.error('[reviewLaunchStore] 评估失败', { symbol: target, error: msg })
    }
  },
  reset: () => set({ ...initialState }),
}))
