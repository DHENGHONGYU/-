/**
 * RLES 历史样本回测 / 权重标定引擎（Backtest & Calibration）
 *
 * 目的：验证 RLES 新引入的"主升浪二波 + 八级筹码"时机/风险因子是否真的具备
 * 前向预测力（即能否体系化提升择股/择时），而非仅接一个仍受数据源限制的真实市场宽度。
 *
 * 时点（point-in-time）正确性说明：
 *  - detectSecondWave / evaluateChipForStock 完全由 anchor 之前的 K 线切片计算，是**真实时点因子**。
 *  - V6 评分 / 板块轮动 / 市场宽度当前接口均为"评估日当前态"，非历史时点态；
 *    本回测不把它们纳入预测因子（仅作信息列），以保住回测的诚实性。
 *    完整时点回测需要历史 V6 服务，列为后续生产化项。
 *
 * 因此本回测的"被测信号"= 二波检测器(secondWave) + 八级筹码风险(chip)，
 * 构成 timingScore（时机成熟度 + 风险健康度的时点可算组合），用前向 N 日收益验证。
 */

import type { KlineBar } from '@/services/collect'
import { detectSecondWave, type SecondWaveSignal } from './secondWaveDetector'
import { evaluateChipForStock } from './chipBridge'
import { fetchKlineData } from '@/services/collect'

/** 默认回测 K 线数量 */
const DEFAULT_BAR_COUNT = 260

// ── 类型 ───────────────────────────────────────────────────────────
export interface BacktestConfig {
  /** 持有期（交易日），默认 20 */
  forwardDays?: number
  /** anchor 步进（避免样本重叠），默认 max(forwardDays, 10) */
  stride?: number
  /** live 取数根数，默认 260（约 1 年日线） */
  count?: number
}

export interface BacktestSample {
  symbol: string
  /** 评估日（anchor）日期 */
  anchorDate: string
  anchorClose: number
  /** 前向收益 = close[anchor+fd] / close[anchor] - 1 */
  forwardReturn: number
  secondWave: SecondWaveSignal
  chipRiskLevel: string | null
  /** 时点可算的"时机+风险"复合分 0-100 */
  timingScore: number
  /** 二波是否命中（核心被测信号） */
  detected: boolean
}

export interface BacktestTierStat {
  bucket: string
  count: number
  winRate: number
  avgReturn: number
  avgSignal: number
}

export interface BacktestResult {
  symbolCount: number
  sampleCount: number
  forwardDays: number
  /** 全样本：胜率 / 均值收益 / IC（timingScore 与前向收益的 Spearman 秩相关） */
  overall: { winRate: number; avgReturn: number; ic: number }
  /** 按二波命中 vs 未命中拆分 */
  byDetected: { detected: BacktestTierStat; notDetected: BacktestTierStat }
  /** 按二波强度四分位（Q1 弱 → Q4 强） */
  byStrengthQuartile: BacktestTierStat[]
  /** 按时机复合分 tier（priority ≥80 / normal 60-79 / cautious <60） */
  byTimingTier: BacktestTierStat[]
  generatedAt: number
}

// ── 工具 ───────────────────────────────────────────────────────────
function clamp100(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, n))
}

/** 按日期升序归一化（无论后端返回正序/倒序，均得到"最新一根在末尾"） */
export function sortBarsAsc(bars: KlineBar[]): KlineBar[] {
  return [...bars].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
}

function chipRiskToScore(level: string | null): number {
  if (level === 'high') return 40
  if (level === 'medium') return 70
  if (level === 'low') return 100
  return 100 // 未知按良性中性
}

/** 时点复合分：二波强度(60%) + 筹码风险健康度(40%) */
function timingOnlyScore(sw: SecondWaveSignal, chipRiskLevel: string | null): number {
  const swPart = sw.detected ? sw.strength : sw.strength * 0.6
  return clamp100(swPart * 0.6 + chipRiskToScore(chipRiskLevel) * 0.4)
}

function mean(xs: number[]): number {
  if (xs.length === 0) return 0
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

function winRate(xs: number[]): number {
  if (xs.length === 0) return 0
  return xs.filter((r) => r > 0).length / xs.length
}

function rank(arr: number[]): number[] {
  const idx = arr.map((v, i) => [v, i] as [number, number]).sort((a, b) => a[0] - b[0])
  const ranks = new Array<number>(arr.length).fill(0)
  let i = 0
  while (i < idx.length) {
    let j = i
    while (j + 1 < idx.length && idx[j + 1]![0] === idx[i]![0]) j++
    const avg = (i + j) / 2 + 1
    for (let k = i; k <= j; k++) ranks[idx[k]![1]] = avg
    i = j + 1
  }
  return ranks
}

function pearson(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length)
  if (n < 2) return 0
  const mx = mean(x)
  const my = mean(y)
  let num = 0
  let dx = 0
  let dy = 0
  for (let i = 0; i < n; i++) {
    const a = x[i]! - mx
    const b = y[i]! - my
    num += a * b
    dx += a * a
    dy += b * b
  }
  const den = Math.sqrt(dx * dy)
  return den > 0 ? num / den : 0
}

/** Spearman 秩相关（稳健于非线性单调关系） */
export function spearman(xs: number[], ys: number[]): number {
  if (xs.length < 2) return 0
  return pearson(rank(xs), rank(ys))
}

// ── 核心：单标的样本采集 ──────────────────────────────────────────
/**
 * 对单只标的的日线，沿时间轴滑动 anchor，生成一组时点样本。
 * 每个样本：anchor 之前切片算二波+筹码 + anchor 之后 forwardDays 算前向收益。
 */
export function collectSamplesFromBars(
  symbol: string,
  bars: KlineBar[],
  config: BacktestConfig = {},
): BacktestSample[] {
  const sorted = sortBarsAsc(bars)
  const fd = config.forwardDays ?? 20
  const stride = config.stride ?? Math.max(fd, 10)
  const N = sorted.length
  const minAnchor = Math.max(25, fd) // 二波需 ≥25 根；且需 fd 根前向
  const samples: BacktestSample[] = []

  for (let a = minAnchor; a + fd < N; a += stride) {
    const slice = sorted.slice(0, a + 1)
    const sw = detectSecondWave(slice)
    const chip = evaluateChipForStock(symbol, slice)
    const anchorBar = sorted[a]!
    const fwdBar = sorted[a + fd]!
    const anchorClose = anchorBar.close
    const forwardReturn = anchorClose > 0 ? fwdBar.close / anchorClose - 1 : 0
    const chipRiskLevel = chip?.riskLevel ?? null
    samples.push({
      symbol,
      anchorDate: anchorBar.date,
      anchorClose,
      forwardReturn,
      secondWave: sw,
      chipRiskLevel,
      timingScore: timingOnlyScore(sw, chipRiskLevel),
      detected: sw.detected,
    })
  }
  return samples
}

// ── 聚合统计 ──────────────────────────────────────────────────────
function statFor(bucket: string, xs: BacktestSample[]): BacktestTierStat {
  return {
    bucket,
    count: xs.length,
    winRate: winRate(xs.map((s) => s.forwardReturn)),
    avgReturn: mean(xs.map((s) => s.forwardReturn)),
    avgSignal: mean(xs.map((s) => s.timingScore)),
  }
}

function quartileBuckets(samples: BacktestSample[]): BacktestTierStat[] {
  if (samples.length === 0) return []
  const sorted = [...samples].sort((a, b) => a.secondWave.strength - b.secondWave.strength)
  const q = Math.ceil(sorted.length / 4)
  const out: BacktestTierStat[] = []
  for (let i = 0; i < 4; i++) {
    const slice = sorted.slice(i * q, (i + 1) * q)
    if (slice.length === 0) continue
    out.push(statFor(`Q${i + 1}（弱→强）`, slice))
  }
  return out
}

function timingTierBuckets(samples: BacktestSample[]): BacktestTierStat[] {
  const pri = samples.filter((s) => s.timingScore >= 80)
  const nor = samples.filter((s) => s.timingScore >= 60 && s.timingScore < 80)
  const cau = samples.filter((s) => s.timingScore < 60)
  return [
    statFor('priority(≥80)', pri),
    statFor('normal(60-79)', nor),
    statFor('cautious(<60)', cau),
  ]
}

export function aggregate(samples: BacktestSample[], forwardDays: number): BacktestResult {
  const detected = samples.filter((s) => s.detected)
  const notDetected = samples.filter((s) => !s.detected)
  const symbols = new Set(samples.map((s) => s.symbol))
  return {
    symbolCount: symbols.size,
    sampleCount: samples.length,
    forwardDays,
    overall: {
      winRate: winRate(samples.map((s) => s.forwardReturn)),
      avgReturn: mean(samples.map((s) => s.forwardReturn)),
      ic: spearman(
        samples.map((s) => s.timingScore),
        samples.map((s) => s.forwardReturn),
      ),
    },
    byDetected: {
      detected: statFor('二波命中', detected),
      notDetected: statFor('二波未命中', notDetected),
    },
    byStrengthQuartile: quartileBuckets(samples),
    byTimingTier: timingTierBuckets(samples),
    generatedAt: Date.now(),
  }
}

// ── 编排：纯函数入口（注入 bars） ─────────────────────────────────
export function runBacktest(
  inputs: { symbol: string; bars: KlineBar[] }[],
  config: BacktestConfig = {},
): BacktestResult {
  const fd = config.forwardDays ?? 20
  const all: BacktestSample[] = []
  for (const { symbol, bars } of inputs) {
    if (!bars || bars.length < 60) continue
    all.push(...collectSamplesFromBars(symbol, bars, config))
  }
  return aggregate(all, fd)
}

// ── live 入口（需后端 K 线服务可用） ─────────────────────────────
export async function fetchBarsLive(symbol: string, count = DEFAULT_BAR_COUNT): Promise<KlineBar[]> {
  const d = await fetchKlineData({ symbol, period: 'daily', adjust: 'qfq', count })
  if (!d) return []
  const merged = d.latest ? [...d.history, d.latest] : [...d.history]
  return merged
}

export async function runLiveBacktest(
  symbols: string[],
  config: BacktestConfig = {},
): Promise<BacktestResult> {
  const fd = config.forwardDays ?? 20
  const all: BacktestSample[] = []
  for (const symbol of symbols) {
    const bars = await fetchBarsLive(symbol, config.count ?? DEFAULT_BAR_COUNT)
    if (bars.length < 60) continue
    all.push(...collectSamplesFromBars(symbol, bars, config))
  }
  return aggregate(all, fd)
}
