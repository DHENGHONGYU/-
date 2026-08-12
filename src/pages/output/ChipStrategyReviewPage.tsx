import { memo, useState, useMemo, useCallback, useEffect } from 'react'
import { Link } from 'react-router'
import { ArrowLeft, Filter, Layers, TrendingUp, AlertTriangle, Target, Download, Search, ChevronRight, Gauge, BookOpen, Scale, BarChart3, Activity, RefreshCw, FileText, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/Card'
import { Badge } from '@/components/atoms/Badge'
import { Button } from '@/components/atoms/Button'
import { Input } from '@/components/atoms/Input'
import { Select, SelectItem } from '@/components/atoms/Select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/atoms/Table'
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
} from '@/components/atoms/Breadcrumb'
import { ErrorBoundary } from '@/components/organisms/shared/ErrorBoundary'
import { PageContainer, PageHeader } from '@/components/templates'
import { CandlestickChart, ChipDistributionChart } from '@/components/chart'
import { useToast } from '@/hooks/useToast'
import { useIntentionPoolStore } from '@/store/intentionPoolStore'
import { useResearchPoolStore } from '@/store/researchPoolStore'
import { usePositionPoolStore } from '@/store/positionPoolStore'
import { useChipStrategyCharts } from '@/pages/output/hooks/useChipStrategyCharts'
import { computeTurnoverVolumeEnergy } from '@/services/scoring/v6-engine/calculators/l7_l8'
import type { TurnoverVolumeEnergy } from '@/services/scoring/v6-engine/types'
import type { PoolItem } from '@/types/modules/pool.types'
import { cn } from '@/lib/utils'
import { twBg, twText, twBorder, COLOR_SHADES } from '@/constants/theme.tokens'
import { MOCK_EXAMPLES, type MockExample, type SignalDirection } from '@/fixtures/chipStrategyMockData'

// ============================================================
// 类型定义
// ============================================================

type PositionLevel = 'low' | 'mid' | 'high' | 'any'
type EnergyLevel = 1 | 2 | 3 | 4 | 5

interface ChipSignalRow {
  id: string
  name: string
  turnoverRange: string
  volumeRatioRange: string
  position: PositionLevel
  priceChange: string
  indicatorCombo: string
  signalType: string
  tradeSignal: string
  tradeAction: SignalDirection
  opportunityScore: number
  action: string
  energyLevel: EnergyLevel
  /** 模拟案例：股票代码 */
  mockSymbol?: string
  /** 模拟案例：股票名称 */
  mockName?: string
  /** 模拟案例：换手率实际值 (%) */
  mockTurnover?: number
  /** 模拟案例：量比实际值 */
  mockVolumeRatio?: number
  /** 模拟案例：60日收益率 (%) */
  mockReturn60d?: number
  /** 模拟案例：当日涨跌幅 (%) */
  mockPriceChange?: number
}

// ============================================================
// 12 种主力筹码变动信号数据
// ============================================================

const CHIP_SIGNALS: ChipSignalRow[] = [
  {
    id: 'golden_buy_accumulation',
    name: '温和吸筹',
    turnoverRange: '3% - 5%',
    volumeRatioRange: '> 2.5',
    position: 'low',
    priceChange: '不限',
    indicatorCombo: '换手率(温和) + 量比(显著放量) + 低位/中位',
    signalType: 'accumulation',
    tradeSignal: '黄金买点',
    tradeAction: 'buy',
    opportunityScore: 5.0,
    action: '提前埋伏，需耐心等待启动',
    energyLevel: 3,
    mockSymbol: '300580',
    mockName: '贝斯特',
    mockTurnover: 4.2,
    mockVolumeRatio: 3.1,
    mockReturn60d: -8.5,
    mockPriceChange: 1.8,
  },
  {
    id: 'follow_buy_probing',
    name: '主力试盘',
    turnoverRange: '< 3%',
    volumeRatioRange: '> 5',
    position: 'any',
    priceChange: '不限',
    indicatorCombo: '换手率(低) + 量比(极端放量)',
    signalType: 'probing',
    tradeSignal: '跟进买点',
    tradeAction: 'buy',
    opportunityScore: 4.5,
    action: '加入自选重点盯，次日确认后跟进',
    energyLevel: 2,
    mockSymbol: '688256',
    mockName: '寒武纪',
    mockTurnover: 2.8,
    mockVolumeRatio: 5.6,
    mockReturn60d: 5.2,
    mockPriceChange: 3.5,
  },
  {
    id: 'golden_buy_pullup',
    name: '强势启动',
    turnoverRange: '5% - 10%',
    volumeRatioRange: '> 5',
    position: 'low',
    priceChange: '价涨',
    indicatorCombo: '换手率(活跃) + 量比(极端放量) + 低位 + 价涨',
    signalType: 'pullup',
    tradeSignal: '黄金买点',
    tradeAction: 'buy',
    opportunityScore: 4.5,
    action: '果断上车',
    energyLevel: 5,
    mockSymbol: '300114',
    mockName: '中航电测',
    mockTurnover: 8.5,
    mockVolumeRatio: 6.3,
    mockReturn60d: -7.0,
    mockPriceChange: 7.5,
  },
  {
    id: 'follow_buy_main_wave',
    name: '主升浪加速',
    turnoverRange: '5% - 10%',
    volumeRatioRange: '2.5 - 5',
    position: 'mid',
    priceChange: '价涨',
    indicatorCombo: '换手率(活跃) + 量比(显著放量) + 价涨',
    signalType: 'pullup',
    tradeSignal: '跟进买点',
    tradeAction: 'buy',
    opportunityScore: 4.0,
    action: '上车并守好纪律，别被盘中震荡甩下',
    energyLevel: 4,
    mockSymbol: '000938',
    mockName: '紫光股份',
    mockTurnover: 7.5,
    mockVolumeRatio: 3.2,
    mockReturn60d: 15.6,
    mockPriceChange: 6.2,
  },
  {
    id: 'wait_lockup',
    name: '筹码锁定',
    turnoverRange: '< 1%',
    volumeRatioRange: '< 0.5',
    position: 'any',
    priceChange: '企稳/价涨',
    indicatorCombo: '换手率(极低) + 量比(极度缩量) + 企稳',
    signalType: 'lockup',
    tradeSignal: '观望',
    tradeAction: 'watch',
    opportunityScore: 4.0,
    action: '等待放量突破启动信号，突破时介入',
    energyLevel: 1,
    mockSymbol: '600519',
    mockName: '贵州茅台',
    mockTurnover: 0.3,
    mockVolumeRatio: 0.4,
    mockReturn60d: 3.2,
    mockPriceChange: 0.5,
  },
  {
    id: 'follow_buy_violent',
    name: '暴力吸筹',
    turnoverRange: '> 10%',
    volumeRatioRange: '> 5',
    position: 'low',
    priceChange: '不限',
    indicatorCombo: '换手率(极高) + 量比(极端放量) + 低位',
    signalType: 'accumulation',
    tradeSignal: '跟进买点',
    tradeAction: 'buy',
    opportunityScore: 4.0,
    action: '可跟，但控制仓位',
    energyLevel: 5,
    mockSymbol: '301207',
    mockName: '万邦医药',
    mockTurnover: 49.1,
    mockVolumeRatio: 5.5,
    mockReturn60d: -15.8,
    mockPriceChange: 12.3,
  },
  {
    id: 'hold_healthy',
    name: '健康趋势',
    turnoverRange: '3% - 10%',
    volumeRatioRange: '1.5 - 2.5',
    position: 'any',
    priceChange: '价涨',
    indicatorCombo: '换手率(活跃) + 量比(温和放量) + 价涨',
    signalType: 'pullup',
    tradeSignal: '持有',
    tradeAction: 'hold',
    opportunityScore: 3.5,
    action: '持有/适当介入',
    energyLevel: 3,
    mockSymbol: '002475',
    mockName: '立讯精密',
    mockTurnover: 5.8,
    mockVolumeRatio: 1.8,
    mockReturn60d: 8.5,
    mockPriceChange: 2.3,
  },
  {
    id: 'hold_concentrating',
    name: '筹码集中',
    turnoverRange: '< 10%',
    volumeRatioRange: '稳定',
    position: 'any',
    priceChange: '价涨',
    indicatorCombo: '换手率(稳定, std/mean<0.3) + 价涨',
    signalType: 'lockup',
    tradeSignal: '持有',
    tradeAction: 'hold',
    opportunityScore: 3.5,
    action: '拿住躺赢，主升浪才刚开始',
    energyLevel: 2,
    mockSymbol: '300750',
    mockName: '宁德时代',
    mockTurnover: 8.2,
    mockVolumeRatio: 1.6,
    mockReturn60d: 22.1,
    mockPriceChange: 1.5,
  },
  {
    id: 'escape_fakeup',
    name: '对倒陷阱',
    turnoverRange: '> 5%',
    volumeRatioRange: '< 1.5',
    position: 'any',
    priceChange: '不限',
    indicatorCombo: '换手率(高) + 量比(低) — 量价背离',
    signalType: 'fakeup',
    tradeSignal: '逃离',
    tradeAction: 'escape',
    opportunityScore: 1.5,
    action: '先跑，安全第一',
    energyLevel: 2,
    mockSymbol: '002375',
    mockName: '亚厦股份',
    mockTurnover: 6.8,
    mockVolumeRatio: 1.2,
    mockReturn60d: 18.5,
    mockPriceChange: -0.8,
  },
  {
    id: 'escape_death',
    name: '死亡换手',
    turnoverRange: '> 15%',
    volumeRatioRange: '> 5',
    position: 'high',
    priceChange: '不限',
    indicatorCombo: '换手率(死亡换手) + 量比(极端放量) + 高位',
    signalType: 'distribution',
    tradeSignal: '逃离',
    tradeAction: 'escape',
    opportunityScore: 1.0,
    action: '立即清仓，一股不留',
    energyLevel: 5,
    mockSymbol: '300059',
    mockName: '东方财富',
    mockTurnover: 18.5,
    mockVolumeRatio: 6.2,
    mockReturn60d: 42.3,
    mockPriceChange: -5.6,
  },
  {
    id: 'sell_distribution',
    name: '主力派发',
    turnoverRange: '> 10%',
    volumeRatioRange: '> 2.5',
    position: 'high',
    priceChange: '不限',
    indicatorCombo: '换手率(极高) + 量比(显著放量) + 高位',
    signalType: 'distribution',
    tradeSignal: '黄金卖点',
    tradeAction: 'sell',
    opportunityScore: 1.0,
    action: '坚决回避/清仓',
    energyLevel: 4,
    mockSymbol: '688981',
    mockName: '中芯国际',
    mockTurnover: 12.3,
    mockVolumeRatio: 3.5,
    mockReturn60d: 35.8,
    mockPriceChange: -2.1,
  },
  {
    id: 'reduce_stagnation',
    name: '高位滞涨',
    turnoverRange: '> 5%',
    volumeRatioRange: '不限',
    position: 'high',
    priceChange: '价不涨',
    indicatorCombo: '换手率(高) + 高位 + 价不涨/价跌',
    signalType: 'distribution',
    tradeSignal: '减仓',
    tradeAction: 'sell',
    opportunityScore: 1.0,
    action: '减仓防范风险',
    energyLevel: 3,
    mockSymbol: '601012',
    mockName: '隆基绿能',
    mockTurnover: 6.5,
    mockVolumeRatio: 1.1,
    mockReturn60d: 35.0,
    mockPriceChange: -0.3,
  },
]

// ============================================================
// 个股筹码分析 — 类型与判断引擎
// ============================================================

/** 个股筹码输入（用户从行情软件读取后填入） */
interface StockChipInput {
  symbol: string
  name: string
  turnover: number       // 换手率 %，如 4.2 表示 4.2%
  volumeRatio: number    // 量比，如 3.1
  return60d: number      // 60日收益率 %，如 -8.5
  priceChange: number    // 当日涨跌幅 %，如 1.8
  pe?: number
  pb?: number
  industryCode?: string
  sector?: string
  poolLabel?: string     // 来源池
}

/** 判断依据条目：对照五层框架/7 法则/12 信号 */
interface JudgmentBasis {
  /** 来源：framework(五层框架) / rule(7法则) / signal(12信号) / valuation(估值) */
  source: 'framework' | 'rule' | 'signal' | 'valuation'
  /** 规则名称 */
  name: string
  /** 是否命中 */
  matched: boolean
  /** 详细说明 */
  detail: string
}

/** 个股筹码分析结果 */
interface ChipAnalysisResult {
  /** 位置判断 */
  position: PositionLevel
  positionReason: string
  /** 能量等级（复用 l7_l8 纯函数） */
  energy: TurnoverVolumeEnergy
  /** 量价配合 */
  volumePriceMatch: boolean
  volumePriceReason: string
  /** 匹配的 12 种信号（可能多个） */
  matchedSignals: ChipSignalRow[]
  /** 交易动作 */
  tradeAction: SignalDirection
  /** 交易信号名称 */
  tradeSignal: string
  /** 最终结论 */
  conclusion: string
  /** 操作建议 */
  action: string
  /** 判断依据（逐条对照规则） */
  basis: JudgmentBasis[]
  /** 估值层建议 */
  valuationAdvice?: string
  /** 是否共振买点 */
  isCompositeBuy: boolean
}

/**
 * 位置判断（位置定生死法则）
 * 60日收益>30%为高位，<0为低位，0-30为中位
 */
function judgePosition(return60d: number): { position: PositionLevel; reason: string } {
  if (return60d > 30) {
    return {
      position: 'high',
      reason: `60日收益 ${return60d.toFixed(1)}% > 30% → 高位。高位放量是出货，高位缩量是滞涨，风险大于机会`,
    }
  }
  if (return60d < 0) {
    return {
      position: 'low',
      reason: `60日收益 ${return60d.toFixed(1)}% < 0 → 低位。低位放量是吸筹，低位缩量是筑底，机会大于风险`,
    }
  }
  return {
    position: 'mid',
    reason: `60日收益 ${return60d.toFixed(1)}% ∈ [0, 30%] → 中位。中位信号需结合量价确认方向`,
  }
}

/**
 * 量价配合判断（量在价先法则）
 * 量比>1.5 为放量（配合），<1.5 为缩量（警惕假突破）
 */
function judgeVolumePrice(volumeRatio: number, priceChange: number): { match: boolean; reason: string } {
  if (volumeRatio >= 1.5) {
    return {
      match: true,
      reason: `量比 ${volumeRatio.toFixed(2)} ≥ 1.5 → 放量。${priceChange >= 0 ? '放量上涨属健康，量价配合' : '放量下跌需警惕，但量能活跃'}`,
    }
  }
  return {
    match: false,
    reason: `量比 ${volumeRatio.toFixed(2)} < 1.5 → 缩量。${priceChange >= 0 ? '无量上涨是耍流氓，假突破风险' : '缩量下跌属洗盘，关注支撑'}`,
  }
}

/**
 * 匹配 12 种主力筹码变动信号
 * 按"逃离 > 卖出 > 买入 > 持有 > 观望"优先级匹配（安全第一）
 */
function matchChipSignals(input: StockChipInput, position: PositionLevel): ChipSignalRow[] {
  const { turnover: t, volumeRatio: v, priceChange: pc } = input
  const matched: ChipSignalRow[] = []

  for (const sig of CHIP_SIGNALS) {
    let hit = false
    switch (sig.id) {
      // 逃离类（最高优先级，安全第一）
      case 'escape_death':
        hit = t > 15 && v > 5 && position === 'high'
        break
      case 'escape_fakeup':
        hit = t > 5 && v < 1.5
        break
      // 卖出类
      case 'sell_distribution':
        hit = t > 10 && v > 2.5 && position === 'high'
        break
      case 'reduce_stagnation':
        hit = t > 5 && position === 'high' && pc <= 0
        break
      // 买入类
      case 'follow_buy_violent':
        hit = t > 10 && v > 5 && position === 'low'
        break
      case 'golden_buy_pullup':
        hit = t >= 5 && t <= 10 && v > 5 && position === 'low' && pc > 0
        break
      case 'golden_buy_accumulation':
        hit = t >= 3 && t <= 5 && v > 2.5 && (position === 'low' || position === 'mid')
        break
      case 'follow_buy_main_wave':
        hit = t >= 5 && t <= 10 && v >= 2.5 && v <= 5 && position === 'mid' && pc > 0
        break
      case 'follow_buy_probing':
        hit = t < 3 && v > 5
        break
      // 持有类
      case 'hold_healthy':
        hit = t >= 3 && t <= 10 && v >= 1.5 && v <= 2.5 && pc > 0
        break
      case 'hold_concentrating':
        hit = t < 10 && v >= 1.2 && v <= 2.0 && pc > 0 && (position === 'mid' || position === 'low')
        break
      // 观望类
      case 'wait_lockup':
        hit = t < 1 && v < 0.5
        break
      default:
        hit = false
    }
    if (hit) matched.push(sig)
  }

  // 若无命中，返回默认观望
  if (matched.length === 0) {
    const watch = CHIP_SIGNALS.find((s) => s.id === 'wait_lockup')!
    return [watch]
  }
  return matched
}

/**
 * 对信号矩阵中的 mock 数据反向计算"实际匹配信号"
 * 用于对比模拟数据是否真正命中预期信号，暴露数据与逻辑的偏差
 */
function computeActualMatch(row: ChipSignalRow): {
  matchedNames: string[]
  isExpected: boolean
  isGrayZone: boolean
  grayZoneReason?: string
} {
  if (!row.mockSymbol || row.mockTurnover === undefined || row.mockVolumeRatio === undefined) {
    return { matchedNames: [], isExpected: false, isGrayZone: false }
  }

  const input: StockChipInput = {
    symbol: row.mockSymbol,
    name: row.mockName ?? '',
    turnover: row.mockTurnover,
    volumeRatio: row.mockVolumeRatio,
    return60d: row.mockReturn60d ?? 0,
    priceChange: row.mockPriceChange ?? 0,
  }

  const { position } = judgePosition(input.return60d)
  const actualMatched = matchChipSignals(input, position)
  const matchedNames = actualMatched.map((s) => s.name)

  // 预期信号是否在实际命中列表中
  const isExpected = matchedNames.includes(row.name)

  // 灰色地带判断：实际命中信号与预期不符，或命中默认观望但并非真正的筹码锁定
  const isGrayZone = !isExpected || (matchedNames.length === 1 && matchedNames[0] === '筹码锁定' && row.id !== 'wait_lockup')

  let grayZoneReason: string | undefined
  if (isGrayZone) {
    const reasons: string[] = []
    if (row.mockTurnover > 10 && row.id === 'golden_buy_pullup') {
      reasons.push(`换手率 ${row.mockTurnover}% 超出强势启动阈值 [5%,10%]，实际归为暴力吸筹`)
    }
    if (row.mockTurnover > 10 && row.id === 'follow_buy_main_wave') {
      reasons.push(`换手率 ${row.mockTurnover}% 超出主升浪加速阈值 [5%,10%]，落入灰色地带`)
    }
    if (row.mockVolumeRatio < 1.5 && row.tradeAction !== 'escape') {
      reasons.push(`量比 ${row.mockVolumeRatio} < 1.5，量能不足，未达放量标准`)
    }
    if (position === 'high' && row.tradeAction === 'hold') {
      reasons.push(`60日收益 ${row.mockReturn60d}% > 30% 高位，持有信号需谨慎`)
    }
    if (position === 'high' && row.tradeAction === 'buy') {
      reasons.push(`60日收益 ${row.mockReturn60d}% > 30% 高位，买入信号在高位需减仓或回避`)
    }
    if (row.mockPriceChange !== undefined && row.mockPriceChange <= 0 && row.tradeAction === 'buy') {
      reasons.push(`当日涨跌 ${row.mockPriceChange}% ≤ 0，价跌配合买入信号需警惕`)
    }
    if (reasons.length === 0) {
      reasons.push(`预期 "${row.name}" 但实际命中 "${matchedNames.join('、')}"，指标组合存在偏差`)
    }
    grayZoneReason = reasons.join('；')
  }

  return { matchedNames, isExpected, isGrayZone, grayZoneReason }
}

/**
 * 灰色地带日志缓冲区（module 级，跨分析调用累积）
 * 浏览器环境下通过内存缓冲 + Blob 下载实现 debug.log 归档
 * 命名空间：chipStrategyGrayZone
 */
const DEBUG_LOG_NAMESPACE = 'chipStrategyGrayZone'
const debugLogBuffer: string[] = []
let debugLogSessionStart: string | null = null

/** 追加一条 debug 日志（同时输出到控制台便于实时观察） */
function appendDebugLog(content: string): void {
  const ts = new Date().toISOString()
  const line = `[${ts}] ${content}`
  debugLogBuffer.push(line)
  // 同时输出到控制台便于实时观察，但不再使用 console.warn（避免污染控制台）
  // eslint-disable-next-line no-console
  console.log(`%c[${DEBUG_LOG_NAMESPACE}]`, `color: ${COLOR_SHADES.amber.hex[500]}; font-weight: bold;`, line)
}

/** 获取当前 debug.log 全文（含会话头） */
export function getDebugLogContent(): string {
  const header = (debugLogSessionStart ?? '') !== ''
    ? `# 筹码策略复盘 debug.log\n# 会话开始: ${debugLogSessionStart}\n# 会话结束: ${new Date().toISOString()}\n# 日志条数: ${debugLogBuffer.length}\n${'='.repeat(80)}\n\n`
    : `# 筹码策略复盘 debug.log\n# 暂无日志记录\n`
  return header + debugLogBuffer.join('\n\n')
}

/** 清空 debug 日志缓冲区 */
export function clearDebugLog(): void {
  debugLogBuffer.length = 0
  debugLogSessionStart = null
}

/** 返回当前缓冲区日志条数 */
export function getDebugLogCount(): number {
  return debugLogBuffer.length
}

/**
 * 灰色地带日志打印
 * 当个股被判定为"持有"或"观望"但不属于标准信号时，写入独立 debug.log（内存缓冲）便于归档分析
 * 不再使用 console.warn，避免被系统日志淹没
 */
function logGrayZoneDecision(input: StockChipInput, result: ChipAnalysisResult): void {
  const isHoldOrWatch = result.tradeAction === 'hold' || result.tradeAction === 'watch'
  if (!isHoldOrWatch) return

  // 检查是否为灰色地带：实际命中的信号与"标准持有/观望"不完全吻合
  const topSignal = result.matchedSignals[0]
  const isDefaultWatch = topSignal?.id === 'wait_lockup' && (input.turnover >= 1 || input.volumeRatio >= 0.5)
  const isHighPositionHold = result.position === 'high' && result.tradeAction === 'hold'
  const isMidPositionHighTurnover = result.position === 'mid' && input.turnover > 10

  if (!isDefaultWatch && !isHighPositionHold && !isMidPositionHighTurnover) return

  // 首次记录时标记会话开始
  if ((debugLogSessionStart ?? '') === '') {
    debugLogSessionStart = new Date().toISOString()
  }

  // 构建归档日志正文（写入 debug.log）
  const lines: string[] = []
  lines.push(`[灰色地带判定] ${input.name}(${input.symbol}) → ${result.tradeSignal}`)
  lines.push('输入指标: ' + JSON.stringify({
    换手率: `${input.turnover}%`,
    量比: input.volumeRatio,
    '60日收益': `${input.return60d}%`,
    当日涨跌: `${input.priceChange}%`,
    位置: result.position,
    能量等级: `L${result.energy.level} (${result.energy.label})`,
  }, null, 2))
  lines.push('命中信号: ' + result.matchedSignals.map((s) => `${s.name}(${s.tradeSignal})`).join('、'))
  lines.push('量价配合: ' + (result.volumePriceMatch ? '✅ 放量配合' : '⚠️ 缩量/量价背离') + ' — ' + result.volumePriceReason)
  lines.push('操作建议: ' + result.action)

  if (isDefaultWatch) {
    lines.push('⚠️ 灰色地带原因: 未命中任何标准信号，被默认归为"观望"。实际指标不满足筹码锁定条件（换手率≥1%或量比≥0.5），说明该股处于"非标准形态"，需人工研判')
  }
  if (isHighPositionHold) {
    lines.push('⚠️ 灰色地带原因: 高位（60日收益>30%）持有信号风险较高。高位放量可能是主力派发而非健康趋势，建议结合股东人数变化和主力资金流向二次确认')
  }
  if (isMidPositionHighTurnover) {
    lines.push(`⚠️ 灰色地带原因: 中位 + 高换手(${input.turnover}%)组合不属于12种标准信号。换手率>10%在中位既可能是蓄势突破也可能是高位派发前兆，需结合量比和价变方向判断：量比>${input.volumeRatio >= 2.5 ? '2.5(显著放量)→偏多' : '不足2.5(温和)→偏谨慎'}，价变${input.priceChange >= 0 ? '上涨→偏多' : '下跌→偏谨慎'}`)
  }
  lines.push('判断依据链: ' + result.basis.map((b) => `[${b.source}]${b.name}: ${b.matched ? '✅' : '❌'} ${b.detail}`).join('; '))

  // 写入内存缓冲区（同时输出到 console.log 便于实时观察）
  appendDebugLog(lines.join('\n'))
}

/**
 * 个股筹码分析主入口
 * 将五层框架 + 7 法则 + 12 信号作为内在嵌入判断规则，逐项解析筹码状态
 */
function analyzeStockChips(input: StockChipInput): ChipAnalysisResult {
  const basis: JudgmentBasis[] = []

  // === 1. 位置判断（位置定生死法则）===
  const { position, reason: positionReason } = judgePosition(input.return60d)
  basis.push({
    source: 'rule',
    name: '位置定生死',
    matched: true,
    detail: positionReason,
  })

  // === 2. 能量计算（能量分级管理法则，复用 l7_l8 纯函数）===
  // computeTurnoverVolumeEnergy 入参为小数，turnover/100 转换
  const energy = computeTurnoverVolumeEnergy(input.turnover / 100, input.volumeRatio)
  basis.push({
    source: 'rule',
    name: '能量分级管理',
    matched: true,
    detail: `换手率 ${input.turnover}% × 量比 ${input.volumeRatio} = 能量 ${energy.raw}（${energy.label}，L${energy.level}）→ 仓位上限 ${energy.positionCapPct}%，止盈 ${energy.takeProfitPct}%，止损 ${energy.stopLossPct}%`,
  })

  // === 3. 量价配合判断（量在价先法则）===
  const { match: volumePriceMatch, reason: volumePriceReason } = judgeVolumePrice(input.volumeRatio, input.priceChange)
  basis.push({
    source: 'rule',
    name: '量在价先',
    matched: volumePriceMatch,
    detail: volumePriceReason,
  })

  // === 4. 信号匹配（12 种主力筹码变动信号矩阵）===
  const matchedSignals = matchChipSignals(input, position)
  // 取优先级最高的信号（逃离>卖出>买入>持有>观望）
  const priorityMap: Record<SignalDirection, number> = { escape: 5, sell: 4, buy: 3, hold: 2, watch: 1 }
  const topSignal = [...matchedSignals].sort((a, b) => priorityMap[b.tradeAction] - priorityMap[a.tradeAction])[0]!
  basis.push({
    source: 'signal',
    name: topSignal.name,
    matched: true,
    detail: `命中信号矩阵：${topSignal.indicatorCombo} → ${topSignal.tradeSignal}（机会分 ${topSignal.opportunityScore}，能量 L${topSignal.energyLevel}）`,
  })
  if (matchedSignals.length > 1) {
    basis.push({
      source: 'signal',
      name: '共振确认',
      matched: true,
      detail: `共命中 ${matchedSignals.length} 个信号：${matchedSignals.map((s) => s.name).join('、')} → 共振信号胜率 75%+`,
    })
  }

  // === 5. 估值层判断（个股技术层 — 估值买点）===
  let valuationAdvice: string | undefined
  let valuationHit = false
  if (input.pe !== undefined && input.pb !== undefined) {
    if (input.pe < 25 && input.pb < 20) {
      valuationHit = true
      valuationAdvice = `PE ${input.pe} < 25 且 PB ${input.pb} < 20 → 估值买点（buy_safety_margin）`
    } else {
      valuationAdvice = `PE ${input.pe} ${input.pe >= 25 ? '≥ 25' : '< 25'}，PB ${input.pb} ${input.pb >= 20 ? '≥ 20' : '< 20'} → 不满足估值买点`
    }
  }
  basis.push({
    source: 'valuation',
    name: '估值买点',
    matched: valuationHit,
    detail: valuationAdvice ?? '缺少 PE/PB 数据，无法判断估值层',
  })

  // === 6. 对倒陷阱检测（警惕对倒陷阱法则）===
  const isFakeUp = input.turnover > 5 && input.volumeRatio < 1.5
  if (isFakeUp) {
    basis.push({
      source: 'rule',
      name: '警惕对倒陷阱',
      matched: true,
      detail: `高换手 ${input.turnover}% (>5%) + 低量比 ${input.volumeRatio} (<1.5) = 量价背离 → 诱多出货，坚决回避`,
    })
  }

  // === 7. 共振才是机会（7法则之一）===
  const isResonance = matchedSignals.length >= 2 || (topSignal.tradeAction === 'buy' && valuationHit)
  basis.push({
    source: 'rule',
    name: '共振才是机会',
    matched: isResonance,
    detail: isResonance
      ? `单一信号胜率50%，共振信号胜率75%+。当前${matchedSignals.length >= 2 ? `命中 ${matchedSignals.length} 个信号叠加` : '筹码买点+估值买点叠加'} → 属于共振机会`
      : `当前仅命中 ${matchedSignals.length} 个信号，无共振。单一信号胜率约50%，需等待更多信号确认`,
  })

  // === 8. 顺势而为（7法则之一 + 宏观/板块层框架）===
  basis.push({
    source: 'rule',
    name: '顺势而为',
    matched: true,
    detail: `${input.sector ?? input.industryCode ?? '未知板块'} → 只做景气向上板块。大盘决定仓位：牛市80%，震荡50%，熊市20%。熊市中所有启动信号视为反弹`,
  })

  // === 9. 纪律高于预测（7法则之一 + 风控约束层框架）===
  basis.push({
    source: 'rule',
    name: '纪律高于预测',
    matched: true,
    detail: `固定止损7%，移动止损10%。单票仓位 ≤ 25%，总仓位 ≤ 80%，间隔24h，每日 ≤ 5笔。不抱侥幸，跌破即走`,
  })

  // === 10. 宏观/板块层（五层框架第1层 — 天时）===
  basis.push({
    source: 'framework',
    name: '宏观/板块层（天时）',
    matched: true,
    detail: `五维评分：动量强度(35%) + 情绪热度(25%) + 技术突破(20%) + 估值风险(15%) + 大盘环境(5%)。动量+技术突破双高 = 板块启动核心标志`,
  })

  // === 11. 个股技术层（五层框架第2层 — K线形态）===
  basis.push({
    source: 'framework',
    name: '个股技术层（K线形态）',
    matched: true,
    detail: `突破买点：站上MA20 + 放量(量比>1.5) + MACD红柱；回踩买点：低于MA20 8% + RSI<30；共振买点：2+买入信号叠加 → composite_buy，置信度+0.2/信号`,
  })

  // === 12. 筹码层（五层框架第3层 — 量价配合）===
  basis.push({
    source: 'framework',
    name: '筹码层（量价配合）',
    matched: true,
    detail: `能量 = 换手率 × 量比 → L1(冷清)~L5(爆炸)五级。当前 L${energy.level}(${energy.label})，仓位上限 ${energy.positionCapPct}%，止盈 ${energy.takeProfitPct}%，止损 ${energy.stopLossPct}%`,
  })

  // === 13. 共振确认层（五层框架第4层 — 多信号叠加）===
  basis.push({
    source: 'framework',
    name: '共振确认层（多信号叠加）',
    matched: isResonance,
    detail: `技术+筹码+资金三维共振 = 最优标的。V6引擎11层交叉验证加权评分。当前${isResonance ? '存在共振' : '无共振'}`,
  })

  // === 14. 风控约束层（五层框架第5层 — 纪律）===
  basis.push({
    source: 'framework',
    name: '风控约束层（纪律）',
    matched: true,
    detail: `景气恶化线：行业景气度连续两期<45 → 禁止加仓；资金破位线：主力资金流出>3天 → 减仓；回撤风控线：单票亏损>7%或回撤>10% → 止损`,
  })

  // === 共振买点判断 ===
  const isCompositeBuy = topSignal.tradeAction === 'buy' && valuationHit

  // === 最终结论 ===
  let conclusion = ''
  switch (topSignal.tradeAction) {
    case 'buy':
      conclusion = isCompositeBuy
        ? `【共振买点】${input.name}(${input.symbol}) 命中 ${topSignal.name} + 估值买点，技术+筹码+估值三维共振，胜率 75%+`
        : `【买入信号】${input.name}(${input.symbol}) 命中 ${topSignal.name}，${topSignal.action}`
      break
    case 'sell':
      conclusion = `【卖出信号】${input.name}(${input.symbol}) 命中 ${topSignal.name}，${topSignal.action}`
      break
    case 'escape':
      conclusion = `【逃离信号】${input.name}(${input.symbol}) 命中 ${topSignal.name}，${topSignal.action}。安全第一！`
      break
    case 'hold':
      conclusion = `【持有信号】${input.name}(${input.symbol}) 命中 ${topSignal.name}，${topSignal.action}`
      break
    default:
      conclusion = `【观望信号】${input.name}(${input.symbol}) ${topSignal.action}`
  }

  return {
    position,
    positionReason,
    energy,
    volumePriceMatch,
    volumePriceReason,
    matchedSignals,
    tradeAction: topSignal.tradeAction,
    tradeSignal: topSignal.tradeSignal,
    conclusion,
    action: topSignal.action,
    basis,
    valuationAdvice,
    isCompositeBuy,
  }
}

// ============================================================
// 辅助函数
// ============================================================

function getPositionLabel(pos: PositionLevel): string {
  const map: Record<PositionLevel, string> = {
    low: '低位',
    mid: '中位',
    high: '高位',
    any: '不限',
  }
  return map[pos]
}

function getEnergyLabel(level: EnergyLevel): string {
  const map: Record<EnergyLevel, string> = {
    1: 'L1 冷清',
    2: 'L2 温和',
    3: 'L3 活跃',
    4: 'L4 激进',
    5: 'L5 爆炸',
  }
  return map[level]
}

function getActionBadgeVariant(action: SignalDirection): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (action) {
    case 'buy':
      return 'default'
    case 'sell':
    case 'escape':
      return 'destructive'
    case 'hold':
      return 'secondary'
    default:
      return 'outline'
  }
}

function getActionColor(action: SignalDirection): string {
  switch (action) {
    case 'buy':
      return twText('red', 600)
    case 'sell':
    case 'escape':
      return twText('green', 600)
    case 'hold':
      return twText('blue', 500)
    default:
      return 'text-muted-foreground'
  }
}

// ============================================================
// 筛选器
// ============================================================

type FilterType = 'all' | 'buy' | 'sell' | 'hold' | 'escape'

const FILTER_OPTIONS: { value: FilterType; label: string; icon: typeof Target }[] = [
  { value: 'all', label: '全部信号', icon: Layers },
  { value: 'buy', label: '买入信号', icon: TrendingUp },
  { value: 'hold', label: '持有信号', icon: Target },
  { value: 'sell', label: '卖出信号', icon: AlertTriangle },
  { value: 'escape', label: '逃离信号', icon: AlertTriangle },
]

// ============================================================
// 策略框架数据
// ============================================================

interface StrategyLayer {
  title: string
  icon: typeof Layers
  items: string[]
}

const STRATEGY_LAYERS: StrategyLayer[] = [
  {
    title: '宏观/板块层（天时）',
    icon: Layers,
    items: [
      '大盘环境：牛市/震荡/熊市判断，熊市中所有启动信号视为反弹',
      '五维评分：动量强度(35%) + 情绪热度(25%) + 技术突破(20%) + 估值风险(15%) + 大盘环境(5%)',
      '动量+技术突破双高 = 板块启动核心标志',
    ],
  },
  {
    title: '个股技术层（K线形态）',
    icon: TrendingUp,
    items: [
      '突破买点：站上MA20 + 放量(量比>1.5) + MACD红柱',
      '回踩买点：低于MA20 8% + RSI<30(超卖)',
      '估值买点：PE<25 且 PB<20',
      '共振买点：2+买入信号叠加 → composite_buy，置信度+0.2/信号',
    ],
  },
  {
    title: '筹码层（量价配合）',
    icon: Target,
    items: [
      '能量 = 换手率 × 量比 → L1(冷清) ~ L5(爆炸) 五级',
      'L5爆炸能量：仓位上限70%，止盈25%，止损10%',
      'L1冷清能量：仓位上限10%，止盈5%，止损2%',
      '12种主力筹码变动模式：从温和吸筹到死亡换手',
    ],
  },
  {
    title: '共振确认层（多信号叠加）',
    icon: Layers,
    items: [
      '单一信号胜率50%，共振信号胜率75%+',
      '技术+筹码+资金三维共振 = 最优标的',
      'V6引擎11层交叉验证加权评分',
    ],
  },
  {
    title: '风控约束层（纪律）',
    icon: AlertTriangle,
    items: [
      '景气恶化线：行业景气度连续两期<45 → 禁止加仓',
      '资金破位线：主力资金流出>3天 → 减仓',
      '回撤风控线：单票亏损>7%或回撤>10% → 止损',
      '仓位限制：单票≤25%，总仓位≤80%，间隔24h，每日≤5笔',
    ],
  },
]

// ============================================================
// 核心经验法则
// ============================================================

const EXPERIENCE_RULES: { title: string; desc: string }[] = [
  { title: '位置定生死', desc: '高位放量是出货，低位放量是吸筹。60日收益>30%为高位，<0为低位' },
  { title: '量在价先', desc: '无量上涨是耍流氓，必须放量突破(量比>1.5)。缩量突破=假突破风险' },
  { title: '能量分级管理', desc: '换手率×量比=L1~L5能量等级。L5可重仓(25%)，L1仅观望' },
  { title: '警惕对倒陷阱', desc: '高换手(>5%) + 低量比(<1.5) = 诱多出货，坚决回避' },
  { title: '共振才是机会', desc: '单一信号胜率50%，共振信号胜率75%+。优先技术+筹码+资金三维共振' },
  { title: '纪律高于预测', desc: '固定止损7%，移动止损10%。不抱侥幸，跌破即走' },
  { title: '顺势而为', desc: '只做景气向上板块。大盘决定仓位：牛市80%，震荡50%，熊市20%' },
]

// ============================================================
// 主组件
// ============================================================

export default memo(function ChipStrategyReviewPage(): React.JSX.Element {
  const [filter, setFilter] = useState<FilterType>('all')
  const { toast } = useToast()

  // === 个股筹码分析 state ===
  const [selectedSymbol, setSelectedSymbol] = useState<string>('')
  const [turnover, setTurnover] = useState<string>('')
  const [volumeRatio, setVolumeRatio] = useState<string>('')
  const [return60d, setReturn60d] = useState<string>('')
  const [priceChange, setPriceChange] = useState<string>('')
  const [analysisResult, setAnalysisResult] = useState<ChipAnalysisResult | null>(null)
  // 灰色地带日志条数（用于按钮 badge 实时展示）
  const [debugLogCount, setDebugLogCount] = useState<number>(0)

  // 三个股票池合并（下拉式菜单数据源）
  const intentionItems = useIntentionPoolStore((s) => s.items)
  const researchItems = useResearchPoolStore((s) => s.items)
  const positionItems = usePositionPoolStore((s) => s.items)
  const refreshIntention = useIntentionPoolStore((s) => s.refresh)
  const refreshResearch = useResearchPoolStore((s) => s.refresh)
  const refreshPosition = usePositionPoolStore((s) => s.refresh)

  useEffect(() => {
    void refreshIntention()
    void refreshResearch()
    void refreshPosition()
  }, [refreshIntention, refreshResearch, refreshPosition])

  // 将 MOCK_EXAMPLES 转为 PoolItem 格式，合并到下拉菜单
  const mockPoolItems = useMemo<PoolItem[]>(() => MOCK_EXAMPLES.map((ex) => ({
    symbol: ex.stock.symbol,
    name: ex.stock.name,
    pool: 'intention',
    status: 'screening',
    price: ex.stock.price,
    pe: ex.stock.pe,
    pb: ex.stock.pb,
    roe: undefined,
    marketCap: undefined,
    source: 'manual',
    dataVersion: 0,
    ingestedAt: Date.now(),
    updatedAt: Date.now(),
    industryCode: undefined,
    theme: [],
    sector: ex.stock.sector,
    group: 'mock',
    screenReason: ex.scenario,
  })), [])

  // 模拟示例的筹码指标索引
  const mockChipMap = useMemo(() => {
    const m = new Map<string, MockExample>()
    for (const ex of MOCK_EXAMPLES) m.set(ex.stock.symbol, ex)
    return m
  }, [])

  // 合并去重：模拟示例 > 持仓池 > 研究池 > 意向池
  const poolOptions = useMemo(() => {
    const map = new Map<string, { item: PoolItem; label: string }>()
    for (const item of mockPoolItems) {
      map.set(item.symbol, { item, label: '模拟示例' })
    }
    for (const item of positionItems) {
      map.set(item.symbol, { item, label: '持仓池' })
    }
    for (const item of researchItems) {
      if (!map.has(item.symbol)) map.set(item.symbol, { item, label: '研究池' })
    }
    for (const item of intentionItems) {
      if (!map.has(item.symbol)) map.set(item.symbol, { item, label: '意向池' })
    }
    return Array.from(map.values()).sort((a, b) => {
      // 模拟示例排在最前
      if (a.label === '模拟示例' && b.label !== '模拟示例') return -1
      if (a.label !== '模拟示例' && b.label === '模拟示例') return 1
      return a.item.symbol.localeCompare(b.item.symbol)
    })
  }, [mockPoolItems, intentionItems, researchItems, positionItems])

  // 当前选中的股票
  const selectedOption = useMemo(
    () => poolOptions.find((o) => o.item.symbol === selectedSymbol) ?? null,
    [poolOptions, selectedSymbol],
  )

  // 选择股票时，若为模拟示例则自动填充筹码指标
  const handleSelectStock = useCallback((symbol: string) => {
    setSelectedSymbol(symbol)
    setAnalysisResult(null)
    const mock = mockChipMap.get(symbol)
    if (mock) {
      setTurnover(String(mock.chip.turnover))
      setVolumeRatio(String(mock.chip.volumeRatio))
      setReturn60d(String(mock.chip.return60d))
      setPriceChange(String(mock.chip.priceChange))
    }
  }, [mockChipMap])

  // 触发分析
  const handleAnalyze = useCallback(() => {
    if (!selectedOption) {
      toast({ title: '请先选择股票', variant: 'error' })
      return
    }
    const t = parseFloat(turnover)
    const v = parseFloat(volumeRatio)
    const r60 = parseFloat(return60d)
    const pc = parseFloat(priceChange)
    if (Number.isNaN(t) || Number.isNaN(v) || Number.isNaN(r60) || Number.isNaN(pc)) {
      toast({ title: '请填入有效的换手率/量比/60日收益/当日涨跌', variant: 'error' })
      return
    }
    const input: StockChipInput = {
      symbol: selectedOption.item.symbol,
      name: selectedOption.item.name,
      turnover: t,
      volumeRatio: v,
      return60d: r60,
      priceChange: pc,
      pe: selectedOption.item.pe,
      pb: selectedOption.item.pb,
      industryCode: selectedOption.item.industryCode,
      sector: selectedOption.item.sector,
      poolLabel: selectedOption.label,
    }
    const result = analyzeStockChips(input)
    // 灰色地带日志打印：持有/观望信号的详细原因记录到 debug.log（内存缓冲）
    logGrayZoneDecision(input, result)
    // 同步刷新日志条数 badge
    setDebugLogCount(getDebugLogCount())
    setAnalysisResult(result)
    toast({
      title: '分析完成',
      description: `${selectedOption.item.name} → ${result.tradeSignal}`,
    })
  }, [selectedOption, turnover, volumeRatio, return60d, priceChange, toast])

  // 重置
  const handleReset = useCallback(() => {
    setSelectedSymbol('')
    setTurnover('')
    setVolumeRatio('')
    setReturn60d('')
    setPriceChange('')
    setAnalysisResult(null)
  }, [])

  // === K线图 + 筹码分布图数据（随 symbol 变动自动加载）===
  const chartData = useChipStrategyCharts(
    selectedSymbol || null,
    selectedOption?.item.price,
    turnover ? parseFloat(turnover) : undefined,
    return60d ? parseFloat(return60d) : undefined,
    analysisResult?.tradeAction,
  )

  const filteredSignals = useMemo(() => {
    if (filter === 'all') return CHIP_SIGNALS
    return CHIP_SIGNALS.filter((s) => {
      if (filter === 'buy') return s.tradeAction === 'buy'
      if (filter === 'sell') return s.tradeAction === 'sell'
      if (filter === 'hold') return s.tradeAction === 'hold'
      if (filter === 'escape') return s.tradeAction === 'escape'
      return true
    })
  }, [filter])

  const buyCount = CHIP_SIGNALS.filter((s) => s.tradeAction === 'buy').length
  const sellCount = CHIP_SIGNALS.filter((s) => s.tradeAction === 'sell').length
  const holdCount = CHIP_SIGNALS.filter((s) => s.tradeAction === 'hold').length
  const escapeCount = CHIP_SIGNALS.filter((s) => s.tradeAction === 'escape').length

  /** 导出筹码信号矩阵到 Excel */
  const handleExportExcel = useCallback(async () => {
    try {
      const XLSX = await import('xlsx')
      const wb = XLSX.utils.book_new()

      // Sheet1: 筹码信号矩阵
      const signalRows = filteredSignals.map((s, i) => {
        const actual = computeActualMatch(s)
        return {
          序号: i + 1,
          信号名称: s.name,
          换手率范围: s.turnoverRange,
          量比范围: s.volumeRatioRange,
          位置要求: getPositionLabel(s.position),
          价格变化: s.priceChange,
          指标组合: s.indicatorCombo,
          信号类型: s.signalType,
          交易信号: s.tradeSignal,
          交易动作: s.tradeAction,
          机会评分: s.opportunityScore,
          能量等级: getEnergyLabel(s.energyLevel),
          操作建议: s.action,
          模拟案例代码: s.mockSymbol ?? '-',
          模拟案例名称: s.mockName ?? '-',
          '换手率(%)': s.mockTurnover ?? '-',
          量比: s.mockVolumeRatio ?? '-',
          '60日收益(%)': s.mockReturn60d ?? '-',
          '当日涨跌(%)': s.mockPriceChange ?? '-',
          实际匹配信号: actual.matchedNames.join('、') || '-',
          是否一致: actual.isExpected ? '✓ 一致' : actual.isGrayZone ? '⚠ 灰色地带' : '✗ 不一致',
          灰色地带原因: actual.grayZoneReason ?? '-',
        }
      })
      const ws1 = XLSX.utils.json_to_sheet(signalRows)
      ws1['!cols'] = [
        { wch: 6 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 10 },
        { wch: 10 }, { wch: 40 }, { wch: 14 }, { wch: 12 }, { wch: 10 },
        { wch: 10 }, { wch: 12 }, { wch: 28 }, { wch: 14 }, { wch: 14 },
        { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 14 },
      ]
      XLSX.utils.book_append_sheet(wb, ws1, '筹码信号矩阵')

      // Sheet2: 能量等级仓位对照
      const energyRows = [
        { 能量等级: 'L1 冷清', 能量阈值: '< 0.005', 示例: '0.5% × 1.0', 仓位上限: '10%', 止盈间距: '5%', 止损间距: '2%', 交易风格: '观望待突破' },
        { 能量等级: 'L2 温和', 能量阈值: '0.005 - 0.03', 示例: '2% × 1.5', 仓位上限: '20%', 止盈间距: '8%', 止损间距: '3%', 交易风格: '价值型突破' },
        { 能量等级: 'L3 活跃', 能量阈值: '0.03 - 0.08', 示例: '4% × 2.0', 仓位上限: '35%', 止盈间距: '12%', 止损间距: '5%', 交易风格: '稳健型突破' },
        { 能量等级: 'L4 激进', 能量阈值: '0.08 - 0.15', 示例: '6% × 2.5', 仓位上限: '50%', 止盈间距: '18%', 止损间距: '7%', 交易风格: '动量型突破' },
        { 能量等级: 'L5 爆炸', 能量阈值: '> 0.15', 示例: '8% × 3.0', 仓位上限: '70%', 止盈间距: '25%', 止损间距: '10%', 交易风格: '狙击型突破' },
      ]
      const ws2 = XLSX.utils.json_to_sheet(energyRows)
      ws2['!cols'] = [
        { wch: 12 }, { wch: 16 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 16 },
      ]
      XLSX.utils.book_append_sheet(wb, ws2, '能量等级对照')

      // Sheet3: 核心经验法则
      const ruleRows = EXPERIENCE_RULES.map((r, i) => ({
        序号: i + 1,
        法则名称: r.title,
        详细说明: r.desc,
      }))
      const ws3 = XLSX.utils.json_to_sheet(ruleRows)
      ws3['!cols'] = [{ wch: 6 }, { wch: 16 }, { wch: 60 }]
      XLSX.utils.book_append_sheet(wb, ws3, '核心经验法则')

      // Sheet4: 行情启动五层判断框架（作为内在嵌入标准导出）
      const layerRows = STRATEGY_LAYERS.flatMap((layer, i) =>
        layer.items.map((item, j) => ({
          层级序号: i + 1,
          层级名称: layer.title,
          条目序号: j + 1,
          判断规则: item,
        })),
      )
      const ws4 = XLSX.utils.json_to_sheet(layerRows)
      ws4['!cols'] = [{ wch: 8 }, { wch: 20 }, { wch: 8 }, { wch: 60 }]
      XLSX.utils.book_append_sheet(wb, ws4, '五层判断框架')

      const filename = `筹码策略复盘_${new Date().toISOString().slice(0, 10)}.xlsx`
      XLSX.writeFile(wb, filename)
      toast({ title: '导出成功', description: `已导出 ${filteredSignals.length} 条信号到 ${filename}` })
    } catch (err) {
      toast({ title: '导出失败', description: err instanceof Error ? err.message : '未知错误', variant: 'error' })
    }
  }, [filteredSignals, toast])

  /** 下载 debug.log（灰色地带判定归档） */
  const handleDownloadDebugLog = useCallback(() => {
    try {
      const count = getDebugLogCount()
      if (count === 0) {
        toast({ title: '暂无日志', description: '还没有灰色地带判定日志，请先分析个股后重试', variant: 'warning' })
        return
      }
      const content = getDebugLogContent()
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `debug_${DEBUG_LOG_NAMESPACE}_${new Date().toISOString().slice(0, 10)}.log`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast({ title: '下载成功', description: `已下载 ${count} 条灰色地带判定日志` })
    } catch (err) {
      toast({ title: '下载失败', description: err instanceof Error ? err.message : '未知错误', variant: 'error' })
    }
  }, [toast])

  /** 清空 debug 日志缓冲区 */
  const handleClearDebugLog = useCallback(() => {
    const count = getDebugLogCount()
    clearDebugLog()
    setDebugLogCount(0)
    toast({ title: '已清空', description: `已清空 ${count} 条灰色地带判定日志` })
  }, [toast])

  return (
    <ErrorBoundary>
      <PageContainer className="space-y-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/">首页</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/output">输出舱</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbItem>
              <BreadcrumbPage>筹码与交易策略复盘</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <PageHeader
          title="筹码与交易策略复盘舱"
          description="基于换手率、量比、筹码分布、K线形态的核心指标体系分析"
          actions={
            <Button variant="outline" size="sm" asChild>
              <Link to="/output">
                <ArrowLeft className="mr-2 h-4 w-4" />
                返回
              </Link>
            </Button>
          }
        />

        {/* === 个股筹码分析（下拉式菜单 + 判断引擎）=== */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              个股筹码逐项分析与判断
              <Badge variant="outline" className="ml-2 text-xs">
                股票池共 {poolOptions.length} 只
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 说明 */}
            <div className={cn('rounded-md border border-dashed p-3 text-xs text-muted-foreground leading-relaxed', twBorder('blue', 300), twBg('blue', 50))}>
              <span className="font-medium text-foreground">使用说明：</span>
              从下方下拉菜单选择股票池中的个股，填入当日行情软件读取的换手率/量比/60日收益/当日涨跌（PE/PB/行业自动从股票池带入），
              系统将<strong>五层判断框架 + 7 条核心经验法则 + 12 种主力筹码信号矩阵</strong>作为内在嵌入判断规则，
              逐项解析该股筹码状态并给出买点/卖点/持仓/逃离判断，判断依据逐条对照上述原则给出结论。
            </div>

            {/* 下拉菜单 + 输入区 */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">选择股票（下拉式）</label>
                <Select
                  value={selectedSymbol}
                  onValueChange={handleSelectStock}
                  className="w-full"
                >
                  <SelectItem value="">— 请选择股票池个股 —</SelectItem>
                  <optgroup label="📋 模拟示例（6 种典型场景）">
                    {poolOptions.filter((o) => o.label === '模拟示例').map((opt) => (
                      <SelectItem key={opt.item.symbol} value={opt.item.symbol}>
                        {opt.item.name} · {MOCK_EXAMPLES.find((m) => m.stock.symbol === opt.item.symbol)?.scenario}
                      </SelectItem>
                    ))}
                  </optgroup>
                  <optgroup label="📊 股票池数据">
                    {poolOptions.filter((o) => o.label !== '模拟示例').map((opt) => (
                      <SelectItem key={opt.item.symbol} value={opt.item.symbol}>
                        {opt.item.name} ({opt.item.symbol}) · {opt.label}
                        {(opt.item.sector ?? '') !== '' ? ` · ${opt.item.sector}` : ''}
                      </SelectItem>
                    ))}
                  </optgroup>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">换手率 (%)</label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="如 4.2"
                  value={turnover}
                  onChange={(e) => setTurnover(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">量比</label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="如 3.1"
                  value={volumeRatio}
                  onChange={(e) => setVolumeRatio(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">60日收益率 (%)</label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="如 -8.5"
                  value={return60d}
                  onChange={(e) => setReturn60d(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">当日涨跌幅 (%)</label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="如 1.8"
                  value={priceChange}
                  onChange={(e) => setPriceChange(e.target.value)}
                />
              </div>
              <div className="flex items-end gap-2">
                <Button onClick={handleAnalyze} size="sm" className="flex-1">
                  <Search className="mr-1 h-3.5 w-3.5" />
                  逐项分析
                </Button>
                <Button onClick={handleReset} variant="outline" size="sm">
                  重置
                </Button>
              </div>
            </div>

            {/* 快速示例场景按钮（点击即载入该示例到输入框）*/}
            <div className="rounded-md border border-dashed bg-muted/30 p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium">
                <BookOpen className="h-3.5 w-3.5" />
                快速载入示例场景（点击按钮自动填入筹码指标 + 分析）
              </div>
              <div className="flex flex-wrap gap-2">
                {MOCK_EXAMPLES.map((ex) => (
                  <Button
                    key={ex.stock.symbol}
                    size="sm"
                    variant={ex.expectedAction === 'buy' ? 'default' : ex.expectedAction === 'escape' ? 'danger' : 'outline'}
                    onClick={() => {
                      handleSelectStock(ex.stock.symbol)
                      setTurnover(String(ex.chip.turnover))
                      setVolumeRatio(String(ex.chip.volumeRatio))
                      setReturn60d(String(ex.chip.return60d))
                      setPriceChange(String(ex.chip.priceChange))
                      // 延迟一拍后自动分析，确保 state 更新完成
                      setTimeout(() => {
                        const t = ex.chip.turnover
                        const v = ex.chip.volumeRatio
                        const r60 = ex.chip.return60d
                        const pc = ex.chip.priceChange
                        const input: StockChipInput = {
                          symbol: ex.stock.symbol,
                          name: ex.stock.name,
                          turnover: t,
                          volumeRatio: v,
                          return60d: r60,
                          priceChange: pc,
                          pe: ex.stock.pe,
                          pb: ex.stock.pb,
                          industryCode: undefined,
                          sector: ex.stock.sector,
                          poolLabel: '模拟示例',
                        }
                        const result = analyzeStockChips(input)
                        // 灰色地带日志打印：持有/观望信号的详细原因记录到 debug.log（内存缓冲）
                        logGrayZoneDecision(input, result)
                        // 同步刷新日志条数 badge
                        setDebugLogCount(getDebugLogCount())
                        setAnalysisResult(result)
                        toast({
                          title: `示例分析完成：${ex.scenario}`,
                          description: `${ex.stock.name} → ${result.tradeSignal}`,
                        })
                      }, 50)
                    }}
                    className="text-xs"
                  >
                    {ex.scenario}
                  </Button>
                ))}
              </div>
            </div>

            {/* 选中股票的基本信息 */}
            {selectedOption && (
              <div className="rounded-md border bg-muted/30 p-3">
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <span className="font-medium text-sm">
                    {selectedOption.item.name} ({selectedOption.item.symbol})
                  </span>
                  <Badge variant="outline" className="text-xs">{selectedOption.label}</Badge>
                  {(selectedOption.item.sector ?? '') !== '' && (
                    <Badge variant="secondary" className="text-xs">{selectedOption.item.sector}</Badge>
                  )}
                  {selectedOption.item.pe !== undefined && (
                    <span className="text-muted-foreground">PE: <span className={cn('font-medium', (selectedOption.item.pe < 25) ? twText('red', 600) : twText('green', 600))}>{selectedOption.item.pe.toFixed(1)}</span></span>
                  )}
                  {selectedOption.item.pb !== undefined && (
                    <span className="text-muted-foreground">PB: <span className={cn('font-medium', (selectedOption.item.pb < 20) ? twText('red', 600) : twText('green', 600))}>{selectedOption.item.pb.toFixed(2)}</span></span>
                  )}
                  {selectedOption.item.price !== undefined && (
                    <span className="text-muted-foreground">现价: ¥{selectedOption.item.price.toFixed(2)}</span>
                  )}
                </div>
                {selectedOption.label === '模拟示例' && (() => {
                  const mock = MOCK_EXAMPLES.find((m) => m.stock.symbol === selectedOption.item.symbol)
                  if (!mock) return null
                  return (
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span>换手率 {mock.chip.turnover}%</span>
                      <span>量比 {mock.chip.volumeRatio}</span>
                      <span>60日 {mock.chip.return60d}%</span>
                      <span>涨跌 {mock.chip.priceChange}%</span>
                      <span className="font-medium">预期：{mock.expectedSignal}（{mock.expectedAction === 'buy' ? '买入' : mock.expectedAction === 'escape' ? '逃离' : mock.expectedAction === 'hold' ? '持有' : '观望'}）</span>
                    </div>
                  )
                })()}
              </div>
            )}

            {/* === K线图 + 筹码分布图（随股票变动自动加载）=== */}
            {selectedSymbol && (
              <div className="grid gap-4 lg:grid-cols-2">
                {/* K线图 */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <BarChart3 className="h-4 w-4" />
                        K线图
                        {chartData.klineDataSource === 'demo' && (
                          <Badge variant="outline" className={cn('text-xs', twText('amber', 600))}>模拟数据</Badge>
                        )}
                        {chartData.klineDataSource === 'real' && (
                          <Badge variant="outline" className={cn('text-xs', twText('green', 600))}>实时数据</Badge>
                        )}
                      </CardTitle>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={chartData.refresh}
                        disabled={chartData.klineLoading}
                      >
                        <RefreshCw className={cn('h-3.5 w-3.5', chartData.klineLoading && 'animate-spin')} />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {chartData.klineLoading ? (
                      <div className="flex items-center justify-center h-[400px] text-sm text-muted-foreground">
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        加载 K 线数据中...
                      </div>
                    ) : chartData.klineData.length > 0 ? (
                      <CandlestickChart
                        data={chartData.klineData}
                        height={400}
                        markers={chartData.markers}
                        showVolume
                        showToolbar={false}
                      />
                    ) : (
                      <div className="flex items-center justify-center h-[400px] text-sm text-muted-foreground">
                        暂无 K 线数据
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* 筹码分布图 */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <Activity className="h-4 w-4" />
                        筹码分布
                        {chartData.chipDataSource === 'demo' && (
                          <Badge variant="outline" className={cn('text-xs', twText('amber', 600))}>模拟数据</Badge>
                        )}
                        {chartData.chipDataSource === 'real' && (
                          <Badge variant="outline" className={cn('text-xs', twText('green', 600))}>实时数据</Badge>
                        )}
                      </CardTitle>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={chartData.refresh}
                        disabled={chartData.chipLoading}
                      >
                        <RefreshCw className={cn('h-3.5 w-3.5', chartData.chipLoading && 'animate-spin')} />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {chartData.chipLoading ? (
                      <div className="flex items-center justify-center h-[400px] text-sm text-muted-foreground">
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        加载筹码数据中...
                      </div>
                    ) : chartData.chipData ? (
                      <ChipDistributionChart
                        data={chartData.chipData}
                        height={400}
                        tradePoints={chartData.chipTradePoints}
                      />
                    ) : (
                      <div className="flex items-center justify-center h-[400px] text-sm text-muted-foreground">
                        暂无筹码数据
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* 分析结果 */}
            {analysisResult && (
              <div className="space-y-4">
                {/* 最终结论 */}
                <div className={cn(
                  'rounded-md border-2 p-4',
                  analysisResult.tradeAction === 'buy'
                    ? cn(twBorder('red', 300), twBg('red', 50))
                    : analysisResult.tradeAction === 'sell' || analysisResult.tradeAction === 'escape'
                      ? cn(twBorder('green', 300), twBg('green', 50))
                      : analysisResult.tradeAction === 'hold'
                        ? cn(twBorder('blue', 300), twBg('blue', 50))
                        : cn(twBorder('gray', 300), twBg('gray', 50))
                )}>
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-full text-white',
                      analysisResult.tradeAction === 'buy'
                        ? twBg('red', 500)
                        : analysisResult.tradeAction === 'sell' || analysisResult.tradeAction === 'escape'
                          ? twBg('green', 500)
                          : analysisResult.tradeAction === 'hold'
                            ? twBg('blue', 500)
                            : twBg('gray', 500)
                    )}>
                      {analysisResult.tradeAction === 'buy' ? <TrendingUp className="h-5 w-5" />
                        : analysisResult.tradeAction === 'escape' ? <AlertTriangle className="h-5 w-5" />
                          : analysisResult.tradeAction === 'sell' ? <Target className="h-5 w-5" />
                            : analysisResult.tradeAction === 'hold' ? <Gauge className="h-5 w-5" />
                              : <BookOpen className="h-5 w-5" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={getActionBadgeVariant(analysisResult.tradeAction)} className="text-sm">
                          {analysisResult.tradeSignal}
                        </Badge>
                        {analysisResult.isCompositeBuy && (
                          <Badge variant="default" className="text-xs">共振买点</Badge>
                        )}
                      </div>
                      <p className={cn('mt-2 text-base font-semibold', getActionColor(analysisResult.tradeAction))}>
                        {analysisResult.conclusion}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">操作建议：{analysisResult.action}</p>
                    </div>
                  </div>
                </div>

                {/* 筹码状态四维解析 */}
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-md border p-3 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Scale className="h-3.5 w-3.5" /> 位置判断
                    </div>
                    <Badge variant="outline" className="text-xs">{getPositionLabel(analysisResult.position)}</Badge>
                    <p className="text-xs text-muted-foreground leading-relaxed">{analysisResult.positionReason}</p>
                  </div>
                  <div className="rounded-md border p-3 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Gauge className="h-3.5 w-3.5" /> 能量等级
                    </div>
                    <Badge variant={analysisResult.energy.level >= 4 ? 'default' : 'secondary'} className="text-xs">
                      L{analysisResult.energy.level} {analysisResult.energy.label}
                    </Badge>
                    <p className="text-xs text-muted-foreground">
                      仓位≤{analysisResult.energy.positionCapPct}% · 止盈{analysisResult.energy.takeProfitPct}% · 止损{analysisResult.energy.stopLossPct}%
                    </p>
                  </div>
                  <div className="rounded-md border p-3 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <TrendingUp className="h-3.5 w-3.5" /> 量价配合
                    </div>
                    <Badge variant={analysisResult.volumePriceMatch ? 'default' : 'outline'} className="text-xs">
                      {analysisResult.volumePriceMatch ? '放量配合' : '缩量背离'}
                    </Badge>
                    <p className="text-xs text-muted-foreground leading-relaxed">{analysisResult.volumePriceReason}</p>
                  </div>
                  <div className="rounded-md border p-3 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Target className="h-3.5 w-3.5" /> 估值层
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {analysisResult.valuationAdvice ?? '缺少 PE/PB 数据'}
                    </p>
                  </div>
                </div>

                {/* 命中的信号 */}
                <div className="rounded-md border p-3 space-y-2">
                  <div className="text-xs font-medium">命中信号矩阵（共 {analysisResult.matchedSignals.length} 个）</div>
                  <div className="flex flex-wrap gap-2">
                    {analysisResult.matchedSignals.map((sig) => (
                      <div key={sig.id} className={cn('rounded border px-2 py-1 text-xs', twBorder('gray', 200))}>
                        <span className="font-medium">{sig.name}</span>
                        <span className="text-muted-foreground ml-1">· {sig.tradeSignal}</span>
                        <span className={cn('ml-1', getActionColor(sig.tradeAction))}>· {sig.action}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 判断依据（逐条对照规则）*/}
                <div className="rounded-md border p-3 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-medium">
                    <ChevronRight className="h-3.5 w-3.5" />
                    判断依据（逐条对照五层框架/7法则/12信号/估值层）
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-24">来源</TableHead>
                        <TableHead className="w-36">规则名称</TableHead>
                        <TableHead className="w-16">命中</TableHead>
                        <TableHead>详细说明</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {analysisResult.basis.map((b, i) => (
                        <TableRow key={i}>
                          <TableCell>
                            <Badge
                              variant={b.source === 'framework' ? 'default' : b.source === 'rule' ? 'secondary' : 'outline'}
                              className={cn(
                                'text-xs',
                                b.source === 'framework' && twText('blue', 700),
                                b.source === 'rule' && twText('orange', 600),
                                b.source === 'signal' && twText('purple', 700),
                                b.source === 'valuation' && twText('green', 700),
                              )}
                            >
                              {b.source === 'framework' ? '五层框架' : b.source === 'rule' ? '7法则' : b.source === 'signal' ? '12信号' : '估值层'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs font-medium">{b.name}</TableCell>
                          <TableCell>
                            <Badge variant={b.matched ? 'default' : 'outline'} className="text-xs">
                              {b.matched ? '✓ 命中' : '未命中'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground leading-relaxed">{b.detail}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="flex flex-wrap gap-2 pt-2 text-xs text-muted-foreground border-t">
                    <span className="flex items-center gap-1"><Badge variant="default" className={cn('text-xs', twText('blue', 700))}>五层框架</Badge> 行情启动判断框架（5层）</span>
                    <span className="flex items-center gap-1"><Badge variant="secondary" className={cn('text-xs', twText('orange', 600))}>7法则</Badge> 核心经验法则（7条）</span>
                    <span className="flex items-center gap-1"><Badge variant="outline" className={cn('text-xs', twText('purple', 700))}>12信号</Badge> 主力筹码变动信号矩阵（12种）</span>
                    <span className="flex items-center gap-1"><Badge variant="outline" className={cn('text-xs', twText('green', 700))}>估值层</Badge> PE/PB 估值判断</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 概览统计 */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">买入信号</p>
                  <p className={cn('text-2xl font-bold', twText('red', 600))}>{buyCount}</p>
                </div>
                <TrendingUp className={cn('h-8 w-8', twText('red', 400))} />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">卖出信号</p>
                  <p className={cn('text-2xl font-bold', twText('green', 600))}>{sellCount}</p>
                </div>
                <Target className={cn('h-8 w-8', twText('green', 400))} />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">持有信号</p>
                  <p className={cn('text-2xl font-bold', twText('blue', 500))}>{holdCount}</p>
                </div>
                <Layers className={cn('h-8 w-8', twText('blue', 400))} />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">逃离信号</p>
                  <p className={cn('text-2xl font-bold', twText('amber', 600))}>{escapeCount}</p>
                </div>
                <AlertTriangle className={cn('h-8 w-8', twText('amber', 400))} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 筹码信号矩阵表 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                主力筹码变动信号矩阵（12种模式）
              </CardTitle>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  {FILTER_OPTIONS.map((opt) => {
                    const Icon = opt.icon
                    return (
                      <Button
                        key={opt.value}
                        variant={filter === opt.value ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setFilter(opt.value)}
                      >
                        <Icon className="mr-1 h-3.5 w-3.5" />
                        {opt.label}
                      </Button>
                    )
                  })}
                </div>
                <Button variant="outline" size="sm" onClick={handleExportExcel}>
                  <Download className="mr-1 h-3.5 w-3.5" />
                  导出 Excel
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadDebugLog}
                  className={cn(debugLogCount > 0 && cn(twBorder('orange', 400), twText('orange', 700)))}
                >
                  <FileText className="mr-1 h-3.5 w-3.5" />
                  下载 debug.log
                  {debugLogCount > 0 && (
                    <Badge variant="outline" className={cn('ml-1 text-[10px] px-1 py-0', cn(twBg('orange', 100), twText('orange', 700), twBorder('orange', 300)))}>
                      {debugLogCount}
                    </Badge>
                  )}
                </Button>
                {debugLogCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={handleClearDebugLog} title="清空 debug 日志缓冲区">
                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                    清空
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">信号名称</TableHead>
                  <TableHead className="w-20">换手率</TableHead>
                  <TableHead className="w-20">量比</TableHead>
                  <TableHead className="w-16">位置</TableHead>
                  <TableHead className="w-20">价变</TableHead>
                  <TableHead>指标组合</TableHead>
                  <TableHead className="w-20">交易信号</TableHead>
                  <TableHead className="w-16">机会分</TableHead>
                  <TableHead className="w-20">能量级</TableHead>
                  <TableHead className="w-40">操作建议</TableHead>
                  <TableHead className="w-32">模拟案例</TableHead>
                  <TableHead className="w-36">实际匹配信号</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSignals.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell>
                      <span className={cn(
                        'inline-block rounded px-1.5 py-0.5 text-xs font-medium',
                        row.turnoverRange.includes('> 10') || row.turnoverRange.includes('> 15')
                          ? cn(twBg('red', 100), twText('red', 700))
                          : row.turnoverRange.includes('< 1') || row.turnoverRange.includes('< 3')
                            ? cn(twBg('blue', 100), twText('blue', 700))
                            : cn(twBg('gray', 100), twText('gray', 700))
                      )}>
                        {row.turnoverRange}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={cn(
                        'inline-block rounded px-1.5 py-0.5 text-xs font-medium',
                        row.volumeRatioRange.includes('> 5')
                          ? cn(twBg('orange', 100), twText('orange', 700))
                          : row.volumeRatioRange.includes('< 0.5') || row.volumeRatioRange.includes('< 1.5')
                            ? cn(twBg('gray', 100), twText('gray', 600))
                            : cn(twBg('blue', 100), twText('blue', 700))
                      )}>
                        {row.volumeRatioRange}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {getPositionLabel(row.position)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{row.priceChange}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-xs">{row.indicatorCombo}</TableCell>
                    <TableCell>
                      <Badge variant={getActionBadgeVariant(row.tradeAction)} className="text-xs">
                        {row.tradeSignal}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className={cn(
                        'text-sm font-bold',
                        row.opportunityScore >= 4 ? twText('red', 600)
                          : row.opportunityScore <= 1.5 ? twText('green', 600)
                            : twText('blue', 500)
                      )}>
                        {row.opportunityScore.toFixed(1)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {getEnergyLabel(row.energyLevel)}
                      </Badge>
                    </TableCell>
                    <TableCell className={cn('text-xs font-medium', getActionColor(row.tradeAction))}>
                      {row.action}
                    </TableCell>
                    <TableCell>
                      {(row.mockSymbol ?? '') !== '' ? (
                        <div className="space-y-0.5">
                          <div className="text-xs font-medium">
                            {row.mockName} <span className="text-muted-foreground">({row.mockSymbol})</span>
                          </div>
                          <div className="flex gap-1 text-[10px] text-muted-foreground">
                            <span>换{row.mockTurnover}%</span>
                            <span>量{row.mockVolumeRatio}</span>
                            <span className={cn(row.mockPriceChange !== undefined && row.mockPriceChange >= 0 ? twText('red', 600) : twText('green', 600))}>
                              {row.mockPriceChange !== undefined ? `${row.mockPriceChange >= 0 ? '+' : ''}${row.mockPriceChange}%` : ''}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const actual = computeActualMatch(row)
                        if ((row.mockSymbol ?? '') === '') {
                          return <span className="text-xs text-muted-foreground">-</span>
                        }
                        return (
                          <div className="space-y-0.5">
                            {actual.isExpected ? (
                              <Badge variant="outline" className={cn('text-xs', twText('green', 600))}>
                                ✓ {actual.matchedNames.join('、')}
                              </Badge>
                            ) : actual.isGrayZone ? (
                              <>
                                <Badge variant="outline" className={cn('text-xs', twText('orange', 600))}>
                                  ⚠ {actual.matchedNames.join('、')}
                                </Badge>
                                {(actual.grayZoneReason ?? '') !== '' && (
                                  <p className={cn('text-[10px] leading-tight', twText('orange', 600))}>{actual.grayZoneReason}</p>
                                )}
                              </>
                            ) : (
                              <Badge variant="outline" className={cn('text-xs', twText('red', 600))}>
                                ✗ {actual.matchedNames.join('、')}
                              </Badge>
                            )}
                          </div>
                        )
                      })()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* 对倒陷阱 vs 暴力吸筹 对比 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              易混淆信号对比：对倒陷阱 vs 暴力吸筹
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">对比维度</TableHead>
                  <TableHead>对倒陷阱</TableHead>
                  <TableHead>暴力吸筹</TableHead>
                  <TableHead className="w-32">区别核心</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  { dim: '换手率', fake: '≥ 5% (活跃)', violent: '≥ 10% (极高)', diff: '暴力更高' },
                  { dim: '量比', fake: '< 1.5 (低)', violent: '≥ 5 (极高)', diff: '关键分水岭' },
                  { dim: '位置', fake: '不限', violent: '必须低位', diff: '安全垫' },
                  { dim: '指标组合', fake: '高换手 + 低量比 (背离)', violent: '高换手 + 高量比 (共振)', diff: '背离 vs 共振' },
                  { dim: '机会评分', fake: '1.5 (极低)', violent: '4.0 (较高)', diff: '完全相反' },
                  { dim: '交易信号', fake: 'escape (逃离)', violent: 'follow_buy (跟进)', diff: '操作相反' },
                  { dim: '资金方向', fake: 'neutral (无新增)', violent: 'inflow (流入)', diff: '资金性质' },
                  { dim: '操作建议', fake: '先跑，安全第一', violent: '可跟，控仓', diff: '' },
                ].map((row, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{row.dim}</TableCell>
                    <TableCell className={cn('text-sm', twText('green', 600))}>{row.fake}</TableCell>
                    <TableCell className={cn('text-sm', twText('red', 600))}>{row.violent}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{row.diff}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="mt-4 rounded-md bg-muted p-3 text-sm">
              <span className="font-medium">判断口诀：</span>
              <span className="text-muted-foreground"> 高换手低量比，不跑就是傻；高换手高量比，低位才是宝。</span>
            </div>
          </CardContent>
        </Card>

        {/* 能量等级仓位对照 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              能量等级 × 仓位/止盈/止损 对照表
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>能量等级</TableHead>
                  <TableHead>能量阈值</TableHead>
                  <TableHead>示例</TableHead>
                  <TableHead>仓位上限</TableHead>
                  <TableHead>止盈间距</TableHead>
                  <TableHead>止损间距</TableHead>
                  <TableHead>交易风格</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  { level: 'L1 冷清', threshold: '< 0.005', example: '0.5% × 1.0', posCap: '10%', tp: '5%', sl: '2%', style: '观望待突破' },
                  { level: 'L2 温和', threshold: '0.005 - 0.03', example: '2% × 1.5', posCap: '20%', tp: '8%', sl: '3%', style: '价值型突破' },
                  { level: 'L3 活跃', threshold: '0.03 - 0.08', example: '4% × 2.0', posCap: '35%', tp: '12%', sl: '5%', style: '稳健型突破' },
                  { level: 'L4 激进', threshold: '0.08 - 0.15', example: '6% × 2.5', posCap: '50%', tp: '18%', sl: '7%', style: '动量型突破' },
                  { level: 'L5 爆炸', threshold: '> 0.15', example: '8% × 3.0', posCap: '70%', tp: '25%', sl: '10%', style: '狙击型突破' },
                ].map((row, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">
                      <Badge variant={i >= 3 ? 'default' : 'secondary'} className="text-xs">{row.level}</Badge>
                    </TableCell>
                    <TableCell className="text-xs font-mono">{row.threshold}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{row.example}</TableCell>
                    <TableCell>
                      <span className={cn('text-sm font-bold', twText('red', 600))}>{row.posCap}</span>
                    </TableCell>
                    <TableCell className="text-sm">{row.tp}</TableCell>
                    <TableCell className="text-sm">{row.sl}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{row.style}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* 风控约束 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              风控约束（三条禁令 + 仓位纪律）
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <div className={cn('rounded-md border p-4 space-y-2', twBorder('red', 200))}>
                <div className="flex items-center gap-2">
                  <span className={cn('flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white', twBg('red', 500))}>!</span>
                  <h4 className="text-sm font-medium">景气恶化线</h4>
                </div>
                <p className="text-xs text-muted-foreground">行业景气度连续两期 &lt; 45 → 禁止加仓</p>
              </div>
              <div className={cn('rounded-md border p-4 space-y-2', twBorder('orange', 200))}>
                <div className="flex items-center gap-2">
                  <span className={cn('flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white', twBg('orange', 500))}>!</span>
                  <h4 className="text-sm font-medium">资金破位线</h4>
                </div>
                <p className="text-xs text-muted-foreground">主力资金流出 &gt; 3天 → 减仓</p>
              </div>
              <div className={cn('rounded-md border p-4 space-y-2', twBorder('amber', 200))}>
                <div className="flex items-center gap-2">
                  <span className={cn('flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white', twBg('amber', 500))}>!</span>
                  <h4 className="text-sm font-medium">回撤风控线</h4>
                </div>
                <p className="text-xs text-muted-foreground">单票亏损 &gt; 7% 或回撤 &gt; 10% → 止损</p>
              </div>
              <div className={cn('rounded-md border p-4 space-y-2', twBorder('blue', 200))}>
                <div className="flex items-center gap-2">
                  <span className={cn('flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white', twBg('blue', 500))}>i</span>
                  <h4 className="text-sm font-medium">仓位纪律</h4>
                </div>
                <p className="text-xs text-muted-foreground">单票≤25%，总仓位≤80%，间隔24h，每日≤5笔</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </PageContainer>
    </ErrorBoundary>
  )
})
