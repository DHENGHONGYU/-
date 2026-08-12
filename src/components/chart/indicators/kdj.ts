/**
 * KDJ 指标计算引擎
 * 
 * KDJ 指标（随机指标）由 George Lane 提出，用于衡量价格与高低价区间的关系
 * 
 * 计算公式：
 * - RSV (Raw Stochastic Value) = (Close - Low_N) / (High_N - Low_N) × 100
 * - K = 2/3 × K(t-1) + 1/3 × RSV(t)
 * - D = 2/3 × D(t-1) + 1/3 × K(t)
 * - J = 3K - 2D
 * 
 * 金叉：K 线从下向上穿越 D 线（看涨信号）
 * 死叉：K 线从上向下穿越 D 线（看跌信号）
 */

import type { Time, LineData } from 'lightweight-charts'
import { COLOR_SHADES } from '@/constants/theme.tokens'
import type { CandlestickChartData } from '../types'

/** KDJ 计算参数 */
export interface KDJParams {
  /** N 周期（默认 9） */
  nPeriod?: number
  /** K 平滑因子（默认 3） */
  kSmooth?: number
  /** D 平滑因子（默认 3） */
  dSmooth?: number
}

/** KDJ 计算结果 */
export interface KDJResult {
  /** K 线数据 */
  k: Array<LineData<Time> | null>
  /** D 线数据 */
  d: Array<LineData<Time> | null>
  /** J 线数据 */
  j: Array<LineData<Time> | null>
}

/**
 * 计算 KDJ 指标
 * 
 * @param data K线数据
 * @param params KDJ 参数
 * @returns KDJ 计算结果
 */
export function computeKDJ(
  data: CandlestickChartData[],
  params: KDJParams = {},
): KDJResult {
  const { nPeriod = 9, kSmooth = 3, dSmooth = 3 } = params
  
  if (process.env.NODE_ENV === 'development') {
    console.log('[KDJ] 开始计算', {
      dataLength: data.length,
      nPeriod,
      kSmooth,
      dSmooth,
    })
  }
  
  // 数据校验
  if (data.length === 0) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[KDJ] 数据为空，返回空结果')
    }
    return { k: [], d: [], j: [] }
  }
  
  // 数据有效性检查
  if (process.env.NODE_ENV === 'development') {
    const invalidData = data.filter((d) => {
      return !d.time || typeof d.high !== 'number' || typeof d.low !== 'number' || typeof d.close !== 'number'
    })
    if (invalidData.length > 0) {
      console.error('[KDJ] 发现无效数据点', {
        invalidCount: invalidData.length,
        firstInvalidIndex: data.indexOf(invalidData[0]!),
      })
    }
  }
  
  // 计算 RSV (Raw Stochastic Value)
  const rsv: number[] = []
  
  for (let i = 0; i < data.length; i++) {
    if (i < nPeriod - 1) {
      rsv.push(50) // 前 N-1 个数据点使用默认值 50
      continue
    }
    
    // 计算 N 周期内的最高价和最低价
    let highN = -Infinity
    let lowN = Infinity
    
    for (let j = i - nPeriod + 1; j <= i; j++) {
      highN = Math.max(highN, data[j]!.high)
      lowN = Math.min(lowN, data[j]!.low)
    }
    
    const close = data[i]!.close
    
    // RSV = (Close - Low_N) / (High_N - Low_N) × 100
    if (highN === lowN) {
      rsv.push(50) // 避免除以零
    } else {
      rsv.push(((close - lowN) / (highN - lowN)) * 100)
    }
  }
  
  if (process.env.NODE_ENV === 'development') {
    console.log('[KDJ] RSV 计算完成', {
      length: rsv.length,
      first: rsv[0]?.toFixed(2),
      last: rsv[rsv.length - 1]?.toFixed(2),
      min: Math.min(...rsv).toFixed(2),
      max: Math.max(...rsv).toFixed(2),
    })
  }
  
  // 计算 K、D、J 线
  const kValues: number[] = []
  const dValues: number[] = []
  const jValues: number[] = []
  
  // 初始值使用 50
  let kPrev = 50
  let dPrev = 50
  
  for (let i = 0; i < rsv.length; i++) {
    const rsvValue = rsv[i]!
    
    // K = 2/3 × K(t-1) + 1/3 × RSV(t)
    const k = ((kSmooth - 1) / kSmooth) * kPrev + (1 / kSmooth) * rsvValue
    kValues.push(k)
    
    // D = 2/3 × D(t-1) + 1/3 × K(t)
    const d = ((dSmooth - 1) / dSmooth) * dPrev + (1 / dSmooth) * k
    dValues.push(d)
    
    // J = 3K - 2D
    const j = 3 * k - 2 * d
    jValues.push(j)
    
    kPrev = k
    dPrev = d
  }
  
  if (process.env.NODE_ENV === 'development') {
    console.log('[KDJ] K/D/J 计算完成', {
      kLast: kValues[kValues.length - 1]?.toFixed(2),
      dLast: dValues[dValues.length - 1]?.toFixed(2),
      jLast: jValues[jValues.length - 1]?.toFixed(2),
      kRange: `[${Math.min(...kValues).toFixed(2)}, ${Math.max(...kValues).toFixed(2)}]`,
      dRange: `[${Math.min(...dValues).toFixed(2)}, ${Math.max(...dValues).toFixed(2)}]`,
      jRange: `[${Math.min(...jValues).toFixed(2)}, ${Math.max(...jValues).toFixed(2)}]`,
    })
  }
  
  // 转换为 lightweight-charts 数据格式
  // 前 nPeriod - 1 个数据点为预热期，标记为 null
  const warmupPeriod = nPeriod - 1
  
  if (process.env.NODE_ENV === 'development') {
    console.log('[KDJ] 开始数据格式转换', {
      warmupPeriod,
      totalDataPoints: data.length,
      validPointsAfterWarmup: data.length - warmupPeriod,
    })
  }
  
  const k: Array<LineData<Time> | null> = data.map((item, i) => {
    if (i < warmupPeriod) return null
    return { time: item.time as Time, value: kValues[i]! }
  })
  
  const d: Array<LineData<Time> | null> = data.map((item, i) => {
    if (i < warmupPeriod) return null
    return { time: item.time as Time, value: dValues[i]! }
  })
  
  const j: Array<LineData<Time> | null> = data.map((item, i) => {
    if (i < warmupPeriod) return null
    return { time: item.time as Time, value: jValues[i]! }
  })
  
  if (process.env.NODE_ENV === 'development') {
    const validCount = k.filter((d) => d !== null).length
    console.log('[KDJ] 数据转换完成', {
      warmupPeriod,
      validCount,
      totalLength: data.length,
      nullCount: data.length - validCount,
    })
    
    // 数据对齐验证
    const kValidTimes = k.filter((d) => d !== null).map((d) => d!.time)
    const dValidTimes = d.filter((d) => d !== null).map((d) => d!.time)
    const jValidTimes = j.filter((d) => d !== null).map((d) => d!.time)
    
    const allTimesMatch = 
      kValidTimes.length === dValidTimes.length &&
      kValidTimes.length === jValidTimes.length &&
      kValidTimes.every((t, i) => t === dValidTimes[i] && t === jValidTimes[i])
    
    if (!allTimesMatch) {
      console.error('[KDJ] 数据对齐失败！K/D/J 时间戳不一致', {
        kCount: kValidTimes.length,
        dCount: dValidTimes.length,
        jCount: jValidTimes.length,
      })
    } else {
      console.log('[KDJ] 数据对齐验证通过', {
        validPoints: validCount,
        firstTime: kValidTimes[0],
        lastTime: kValidTimes[kValidTimes.length - 1],
      })
    }
    
    // 输出前 5 个有效数据点用于验证
    const firstValidData = k
      .map((kVal, i) => ({
        time: kVal?.time,
        k: kVal?.value,
        d: d[i]?.value,
        j: j[i]?.value,
      }))
      .filter((d) => d.k !== undefined && d.d !== undefined && d.j !== undefined)
      .slice(0, 5)
    
    console.log('[KDJ] 前 5 个有效数据点', firstValidData)
  }
  
  return { k, d, j }
}

/**
 * 获取 KDJ 最新值（用于实时显示）
 */
export function getLatestKDJ(
  data: CandlestickChartData[],
  params: KDJParams = {},
): { k: number; d: number; j: number } | null {
  const result = computeKDJ(data, params)
  
  // 找到最后一个非空值
  let lastValidIndex = -1
  for (let i = result.k.length - 1; i >= 0; i--) {
    if (result.k[i] !== null && result.d[i] !== null && result.j[i] !== null) {
      lastValidIndex = i
      break
    }
  }
  
  if (lastValidIndex === -1) return null
  
  return {
    k: result.k[lastValidIndex]!.value,
    d: result.d[lastValidIndex]!.value,
    j: result.j[lastValidIndex]!.value,
  }
}

/**
 * KDJ 颜色配置
 */
export const KDJ_COLORS = {
  k: COLOR_SHADES.blue[500], // K 线颜色：蓝色
  d: COLOR_SHADES.orange[500], // D 线颜色：橙色
  j: COLOR_SHADES.purple[500], // J 线颜色：紫色
} as const
