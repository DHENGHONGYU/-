/**
 * RLES 权重标定样本篮（多形态确定性合成 K 线）
 *
 * 用途：在「后端 K 线 8000 端口不在线 / 真实源缺接口」的隔离环境下，仍能用回测引擎
 * runBacktest（注入模式）验证「主升浪二波 + 八级筹码」因子是否具备前向预测力，
 * 并据此提出 WEIGHTS 与加成系数的标定建议。
 *
 * 设计原则：
 *  - 完全确定性（LCG 伪随机 + 固定种子），可复现、可单测，不依赖 Math.random。
 *  - 覆盖多形态：winner（强趋势二波友好 + 后续正收益）/ flat（横盘无二波）/
 *    decline（下跌无二波）/ st（名称含ST，震荡偏弱）。
 *  - 形态刻意拉开区分度，使 byDetected / byTimingTier 能暴露因子有效性。
 *
 * 注意：这是「因子有效性验证」用的代理样本，不是真实历史行情；真实标定须用
 * runLiveBacktest（接 fetchKlineData，需后端在线）替换本样本篮。
 */

import type { KlineBar } from '@/services/collect'

/** 线性同余伪随机（确定性） */
function lcg(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    return s / 0x7fffffff
  }
}

function fmtDate(i: number): string {
  // 从 2023-01-02 起逐日（跳过周末近似，仅用于排序，不强求交易日历）
  const base = new Date(Date.UTC(2023, 0, 2))
  base.setUTCDate(base.getUTCDate() + i)
  const y = base.getUTCFullYear()
  const m = String(base.getUTCMonth() + 1).padStart(2, '0')
  const d = String(base.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

interface BuildOpts {
  n?: number
  seed?: number
  /** 基础日涨幅（小数） */
  baseRet?: number
  /** 周期性放量突破（5倍量+涨）间隔 */
  surgeEvery?: number
  /** 周期性缩量回踩（-2.5%）间隔 */
  pullbackEvery?: number
  /** 周期性试盘长上影间隔 */
  shadowEvery?: number
  /** 整体趋势漂移（正=上涨，负=下跌，0=横盘） */
  drift?: number
}

function buildBars(opts: BuildOpts): KlineBar[] {
  const n = opts.n ?? 260
  const rand = lcg(opts.seed ?? 12345)
  const baseRet = opts.baseRet ?? 0.015
  const surgeEvery = opts.surgeEvery ?? 25
  const pullbackEvery = opts.pullbackEvery ?? 13
  const shadowEvery = opts.shadowEvery ?? 25
  const drift = opts.drift ?? 0

  const bars: KlineBar[] = []
  let close = 10
  const baseVol = 1_000_000

  for (let i = 0; i < n; i++) {
    // 趋势漂移叠加基础波动
    let ret = baseRet + drift + (rand() - 0.5) * 0.004
    const open = close
    let volume = baseVol * (1 + rand() * 0.2)
    let high = Math.max(open, close) * (1 + 0.006)
    let low = Math.min(open, close) * (1 - 0.006)

    // 放量突破日（5倍量 + 涨 3%）
    if (i % surgeEvery === 20) {
      volume = baseVol * 5
      ret = 0.03
    }
    // 缩量回踩日（-2.5%，满足 close<ma10 且 <avgVol*0.8）
    if (i % pullbackEvery === 11) {
      ret = -0.025
      volume = baseVol * 0.7
    }
    close = open * (1 + ret)
    high = Math.max(open, close) * (1 + 0.006)
    low = Math.min(open, close) * (1 - 0.006)
    // 试盘长上影（high 明显抬高，与 surge 错位）
    if (i % shadowEvery === 7) {
      high = close * 1.15
    }

    bars.push({
      date: fmtDate(i),
      open: round2(open),
      high: round2(high),
      low: round2(low),
      close: round2(close),
      volume: Math.round(volume),
      amount: Math.round(volume * close),
    })
  }
  return bars
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export interface BasketEntry {
  symbol: string
  name?: string
  bars: KlineBar[]
}

/**
 * 构建标定样本篮：多形态标的，刻意拉开「二波命中组 vs 未命中组」的前向收益区分度。
 * winner 组构造为二波友好 + 锚点后持续正收益；flat/decline 组无二波 + 收益平淡/负。
 */
export function buildSampleBasket(): BasketEntry[] {
  const entries: BasketEntry[] = []
  // 6 只赢家股（强趋势 + 二波友好 + 后续正收益）
  for (let k = 0; k < 6; k++) {
    entries.push({
      symbol: `WIN${k + 1}`,
      name: `赢家科技${k + 1}`,
      bars: buildBars({ seed: 1000 + k * 137, baseRet: 0.016, surgeEvery: 25, pullbackEvery: 13, shadowEvery: 25, drift: 0.0006 }),
    })
  }
  // 4 只横盘股（无趋势 / 无二波，收益≈0）
  for (let k = 0; k < 4; k++) {
    entries.push({
      symbol: `FLAT${k + 1}`,
      name: `横盘实业${k + 1}`,
      bars: buildBars({ seed: 2000 + k * 91, baseRet: 0.0, surgeEvery: 999, pullbackEvery: 999, shadowEvery: 999, drift: 0 }),
    })
  }
  // 3 只下跌股（无二波，收益负）
  for (let k = 0; k < 3; k++) {
    entries.push({
      symbol: `DOWN${k + 1}`,
      name: `下行材料${k + 1}`,
      bars: buildBars({ seed: 3000 + k * 53, baseRet: -0.004, surgeEvery: 999, pullbackEvery: 999, shadowEvery: 999, drift: -0.006 }),
    })
  }
  // 2 只 ST 股（名称含ST，震荡偏弱）
  for (let k = 0; k < 2; k++) {
    entries.push({
      symbol: `ST0${k + 1}`,
      name: `ST风险${k + 1}`,
      bars: buildBars({ seed: 4000 + k * 77, baseRet: -0.002, surgeEvery: 999, pullbackEvery: 999, shadowEvery: 999, drift: -0.002 }),
    })
  }
  return entries
}
