/**
 * SecondWaveDetector —— 主升浪 + 分级回踩二波检测器
 *
 * 逆向来源：deliverables/strategy-consolidated-and-reviewlaunch-evaluation.md
 * 中的"分级回踩 v3.2"五步法（主升浪后回踩二波型，中线波段，平均持仓 381 天）：
 *   ① 识别主升浪（60日涨幅>50% 或 20日涨幅>30%）
 *   ② 突破必须放量 5 倍以上（缩量突破=假突破剔除）
 *   ③ 分级回踩（5/10/20 日线，缩量止跌；层级越短越强）
 *   ④ 试盘信号（放量长上影）或突破前高（二波启动）
 *   ⑤ MAS 市场宽度加分（本检测器不含，由 RLES 的 marketBreadth 承接）
 *
 * 设计为纯函数，输入日线 K 线数组，输出 SecondWaveSignal（0-100 强度 + 信号类型）。
 * 与 V9 现有 golden_buy（低位价涨=早期启动型）互补，补齐"主升浪后二波"模式检测。
 */

import type { KlineBar } from '@/services/collect'

export type PullbackLevel = 'ma5' | 'ma10' | 'ma20' | 'none'
export type SecondWaveType = 'strong_wave' | 'pullback' | 'trial' | 'none'

export interface SecondWaveOptions {
  /** 主升浪 60 日涨幅阈值，默认 0.5 */
  uptrendPct60?: number
  /** 主升浪 20 日涨幅阈值，默认 0.3 */
  uptrendPct20?: number
  /** 突破放量倍数阈值，默认 5 */
  breakoutVolRatio?: number
  /** 量比计算所用成交量均线窗口，默认 5 */
  volumeWindow?: number
  /** 主升浪/峰值回溯窗口（交易日），默认 60 */
  lookback?: number
  /** 试盘长上影占比阈值，默认 0.6 */
  trialShadowRatio?: number
  /** 试盘成交量相对量比均线倍数，默认 1.5 */
  trialVolMultiple?: number
}

export interface SecondWaveSignal {
  /** 是否命中"主升浪 + 回踩/二波"形态 */
  detected: boolean
  /** 综合强度分 0-100 */
  strength: number
  /** 信号类型 */
  signalType: SecondWaveType
  /** 回踩触及的均线层级（none=未在均线附近止跌） */
  pullbackLevel: PullbackLevel
  /** 60 日累计涨幅（小数，如 0.72） */
  uptrendPct60: number
  /** 20 日累计涨幅 */
  uptrendPct20: number
  /** 主升浪窗口内最大量比 */
  maxVolumeRatio: number
  /** 是否检出放量长上影试盘 */
  hasTrialShadow: boolean
  /** 是否突破前高（二波启动） */
  hasBreakout: boolean
  /** 当前三条均线价位（供 UI 展示） */
  maLevels: { ma5: number; ma10: number; ma20: number }
  /** 人类可读归因明细 */
  details: string[]
}

const DEFAULTS: Required<SecondWaveOptions> = {
  uptrendPct60: 0.5,
  uptrendPct20: 0.3,
  breakoutVolRatio: 5,
  volumeWindow: 5,
  lookback: 60,
  trialShadowRatio: 0.6,
  trialVolMultiple: 1.5,
}

function clamp100(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, n))
}

function smaAt(values: number[], idx: number, period: number): number {
  if (idx < period - 1) return NaN
  let sum = 0
  for (let i = idx - period + 1; i <= idx; i++) sum += values[i]!
  return sum / period
}

/**
 * 检测个股是否处于"主升浪确立后的分级回踩 / 二波启动"形态。
 * @param bars 日线 K 线（按日期升序；函数内部会自动按 date 排序，无需预处理）
 * @param options 可调参数（详见 SecondWaveOptions）
 * @returns SecondWaveSignal
 */
export function detectSecondWave(
  bars: KlineBar[],
  options?: SecondWaveOptions,
): SecondWaveSignal {
  const opts = { ...DEFAULTS, ...options }
  const details: string[] = []

  // 防御：数据不足（连 MA20 都算不出）直接降级
  if (!bars || bars.length < 25) {
    return {
      detected: false,
      strength: 0,
      signalType: 'none',
      pullbackLevel: 'none',
      uptrendPct60: 0,
      uptrendPct20: 0,
      maxVolumeRatio: 0,
      hasTrialShadow: false,
      hasBreakout: false,
      maLevels: { ma5: 0, ma10: 0, ma20: 0 },
      details: [`K线不足（${bars?.length ?? 0} 根），无法判定主升浪`],
    }
  }

  // 按日期升序，确保最新一根在末尾
  const sorted = [...bars].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  const n = sorted.length
  const closes = sorted.map((b) => b.close)
  const highs = sorted.map((b) => b.high)
  const lows = sorted.map((b) => b.low)
  const opens = sorted.map((b) => b.open)
  const vols = sorted.map((b) => b.volume)
  const last = n - 1
  const closeLast = closes[last]! // 长度已≥25，索引必然存在

  // 均线
  const ma5: number[] = closes.map((_, i) => smaAt(closes, i, 5))
  const ma10: number[] = closes.map((_, i) => smaAt(closes, i, 10))
  const ma20: number[] = closes.map((_, i) => smaAt(closes, i, 20))
  const volMa5: number[] = vols.map((_, i) => smaAt(vols, i, opts.volumeWindow))

  // ① 主升浪识别
  const p60 = last - 60
  const p20 = last - 20
  const base60 = p60 >= 0 ? closes[p60]! : closes[0]!
  const base20 = p20 >= 0 ? closes[p20]! : closes[0]!
  const uptrendPct60 = base60 > 0 ? (closeLast - base60) / base60 : 0
  const uptrendPct20 = base20 > 0 ? (closeLast - base20) / base20 : 0
  const inMainUptrend = uptrendPct60 >= opts.uptrendPct60 || uptrendPct20 >= opts.uptrendPct20

  // ② 突破放量（量比 = 当日量 / 前一日量比均线）
  let maxVolumeRatio = 0
  for (let i = opts.volumeWindow; i <= last; i++) {
    const base = volMa5[i - 1]
    if (base && base > 0) {
      const r = vols[i]! / base
      if (r > maxVolumeRatio) maxVolumeRatio = r
    }
  }

  // ③ 分级回踩（回溯窗口内最高收盘价作为锚）
  const wLo = Math.max(0, last - opts.lookback)
  let peakIdx = wLo
  for (let i = wLo; i <= last; i++) if (closes[i]! > closes[peakIdx]!) peakIdx = i
  const peakClose = closes[peakIdx]!
  const drawdown = peakClose > 0 ? (peakClose - closeLast) / peakClose : 0 // 0=在峰值，>0=已回撤
  const hadPullback = drawdown > 0.03 && drawdown < 0.35 // 有实质回撤但未崩

  const m5 = ma5[last]!
  const m10 = ma10[last]!
  const m20 = ma20[last]!
  let pullbackLevel: PullbackLevel = 'none'
  if (Number.isFinite(m5) && closeLast >= m5 * 0.985) pullbackLevel = 'ma5'
  else if (Number.isFinite(m10) && closeLast >= m10 * 0.985) pullbackLevel = 'ma10'
  else if (Number.isFinite(m20) && closeLast >= m20 * 0.985) pullbackLevel = 'ma20'

  // ④ 试盘长上影 / 突破前高
  let hasTrialShadow = false
  const trialLo = Math.max(0, last - 15)
  for (let i = trialLo; i <= last; i++) {
    const rng = highs[i]! - lows[i]!
    if (rng <= 0) continue
    const upper = (highs[i]! - Math.max(opens[i]!, closes[i]!)) / rng
    const vbase = volMa5[i - 1] ?? 0
    if (upper >= opts.trialShadowRatio && vbase > 0 && vols[i]! >= vbase * opts.trialVolMultiple) {
      hasTrialShadow = true
      break
    }
  }
  const priorHi = Math.max(...highs.slice(wLo, Math.max(wLo, last - 2))) // 排除最近 2 根，避免自比
  const hasBreakout = highs[last]! >= priorHi

  // 信号类型归类
  let signalType: SecondWaveType = 'none'
  if (inMainUptrend && (hasTrialShadow || hasBreakout)) signalType = 'strong_wave'
  else if (inMainUptrend && hadPullback && pullbackLevel !== 'none') signalType = 'pullback'
  else if (inMainUptrend) signalType = 'trial'
  else signalType = 'none'

  // 强度评分
  let strength = 0
  if (!inMainUptrend) {
    strength = 20
    details.push(`未处主升浪：60日+${(uptrendPct60 * 100).toFixed(0)}% / 20日+${(uptrendPct20 * 100).toFixed(0)}%（阈值 ${opts.uptrendPct60 * 100}% / ${opts.uptrendPct20 * 100}%）`)
  } else {
    strength = 45
    details.push(`处主升浪：60日+${(uptrendPct60 * 100).toFixed(0)}% / 20日+${(uptrendPct20 * 100).toFixed(0)}%`)
    if (maxVolumeRatio >= opts.breakoutVolRatio) {
      strength += 15
      details.push(`突破放量 ${maxVolumeRatio.toFixed(1)}倍 ≥ ${opts.breakoutVolRatio}倍（确认主力介入）`)
    } else if (maxVolumeRatio >= 3) {
      strength += 6
      details.push(`量比温和 ${maxVolumeRatio.toFixed(1)}倍`)
    }
    if (hadPullback && pullbackLevel !== 'none') {
      const pb = pullbackLevel === 'ma5' ? 20 : pullbackLevel === 'ma10' ? 14 : 8
      strength += pb
      details.push(`分级回踩至 ${pullbackLevel.toUpperCase()} 线（峰值回撤 ${(drawdown * 100).toFixed(0)}%）`)
    } else if (hadPullback) {
      strength += 2
      details.push(`有回撤但远离均线（${pullbackLevel}）`)
    }
    if (hasTrialShadow || hasBreakout) {
      strength += 12
      details.push(hasBreakout ? '突破前高 → 二波启动' : '放量长上影试盘 → 二波启动')
    }
  }
  strength = clamp100(strength)

  // 命中判定：主升浪 +（有效回踩 或 试盘/突破）+ 量能至少温和确认
  const detected =
    inMainUptrend &&
    ((hadPullback && pullbackLevel !== 'none') || hasTrialShadow || hasBreakout) &&
    maxVolumeRatio >= 3

  return {
    detected,
    strength,
    signalType,
    pullbackLevel,
    uptrendPct60,
    uptrendPct20,
    maxVolumeRatio,
    hasTrialShadow,
    hasBreakout,
    maLevels: {
      ma5: Number.isFinite(m5) ? m5 : 0,
      ma10: Number.isFinite(m10) ? m10 : 0,
      ma20: Number.isFinite(m20) ? m20 : 0,
    },
    details,
  }
}
