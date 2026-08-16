/**
 * 复盘启动分析 Store（RLES）
 *
 * 负责拉取标的的 V6 评分、组装 RLES 输入、调用纯函数引擎 evaluateReviewLaunch，
 * 并持有评估结果。数据获取在 store 内完成，评分计算委托给 rles-engine。
 *
 * 骨架期：D2/D3 的板块增强（rotationScore）与 D3 的二波/MAS 预留因子尚未接入，
 * 引擎内部自动降级为中性值，不影响首版运行。
 */

import { create } from 'zustand'
import { runV6Score } from '@/services/scoring/v6ScoreService'
import { fetchKlineData } from '@/services/collect'
import {
  evaluateReviewLaunch,
  type RlesInput,
  type RlesResult,
} from '@/services/scoring/rles-engine/reviewLaunchEvaluator'
import { detectSecondWave, type SecondWaveSignal } from '@/services/scoring/rles-engine/secondWaveDetector'
import type { V6Score } from '@/data/types/types.score'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

interface ReviewLaunchState {
  symbol: string
  v6Score: V6Score | null
  result: RlesResult | null
  /** 主升浪二波检测器原始信号（供页面展示归因明细） */
  secondWaveSignal: SecondWaveSignal | null
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

      // 二波检测器：拉取日线 K 线（120 根覆盖 60 日主升浪窗口 + MA20 + 试盘回溯）
      let secondWaveSignal: SecondWaveSignal | null = null
      try {
        const kline = await fetchKlineData({ symbol: target, period: 'daily', adjust: 'qfq', count: 120 })
        if (kline && kline.history.length > 0) {
          secondWaveSignal = detectSecondWave(kline.history)
        }
      } catch (kerr) {
        const kmsg = kerr instanceof Error ? kerr.message : String(kerr)
        logger.warn('[reviewLaunchStore] K线获取失败，二波因子降级为中性', { symbol: target, error: kmsg })
      }

      const input: RlesInput = {
        symbol: target,
        v6Score,
        goldenBuyDetected: v6Score?.rating === 'strong_buy',
        secondWaveSignal,
        // rotationScore / chip / marketBreadth 待对应组件落地后接入
      }
      const result = evaluateReviewLaunch(input)
      set({ v6Score, result, secondWaveSignal, loading: false, lastUpdated: Date.now() })
      logger.info('[reviewLaunchStore] 评估完成', {
        symbol: target,
        total: result.total,
        tier: result.tier,
        secondWave: secondWaveSignal
          ? { detected: secondWaveSignal.detected, type: secondWaveSignal.signalType, strength: secondWaveSignal.strength }
          : null,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      set({ loading: false, error: msg })
      logger.error('[reviewLaunchStore] 评估失败', { symbol: target, error: msg })
    }
  },
  reset: () => set({ ...initialState }),
}))
