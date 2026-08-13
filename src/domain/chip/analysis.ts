import { computeTurnoverVolumeEnergy } from '@/domain/scoring/energy'
import type { SignalDirection } from '@/fixtures/chipStrategyMockData'
import type {
  PositionLevel,
  ChipSignalRow,
  StockChipInput,
  JudgmentBasis,
  ChipAnalysisResult,
} from './types'
import { CHIP_SIGNALS, STRATEGY_LAYERS, EXPERIENCE_RULES } from './types'
import { getPositionLabel, getEnergyLabel } from './helpers'
import { appendDebugLog, markDebugLogSessionStart } from './debugLog'

/**
 * 位置判断（位置定生死法则）
 * 60日收益>30%为高位，<0为低位，0-30为中位
 */
export function judgePosition(return60d: number): { position: PositionLevel; reason: string } {
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
export function judgeVolumePrice(volumeRatio: number, priceChange: number): { match: boolean; reason: string } {
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
export function matchChipSignals(input: StockChipInput, position: PositionLevel): ChipSignalRow[] {
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
export function computeActualMatch(row: ChipSignalRow): {
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
 * 灰色地带日志打印
 * 当个股被判定为"持有"或"观望"但不属于标准信号时，写入独立 debug.log（内存缓冲）便于归档分析
 * 不再使用 console.warn，避免被系统日志淹没
 */
export function logGrayZoneDecision(input: StockChipInput, result: ChipAnalysisResult): void {
  const isHoldOrWatch = result.tradeAction === 'hold' || result.tradeAction === 'watch'
  if (!isHoldOrWatch) return

  // 检查是否为灰色地带：实际命中的信号与"标准持有/观望"不完全吻合
  const topSignal = result.matchedSignals[0]
  const isDefaultWatch = topSignal?.id === 'wait_lockup' && (input.turnover >= 1 || input.volumeRatio >= 0.5)
  const isHighPositionHold = result.position === 'high' && result.tradeAction === 'hold'
  const isMidPositionHighTurnover = result.position === 'mid' && input.turnover > 10

  if (!isDefaultWatch && !isHighPositionHold && !isMidPositionHighTurnover) return

  // 首次记录时标记会话开始
  markDebugLogSessionStart()

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
export function analyzeStockChips(input: StockChipInput): ChipAnalysisResult {
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


/**
 * 导出筹码信号矩阵到 Excel
 * 生成包含信号矩阵、能量等级对照、经验法则、五层框架的多 Sheet Excel 文件
 */
export async function exportChipStrategyExcel(filteredSignals: ChipSignalRow[]): Promise<{ count: number; filename: string }> {
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
  return { count: filteredSignals.length, filename }
}
