/**
 * @module store/riskStore.derived
 * @description riskStore 派生查询函数集合
 *
 * 提供风控模块的派生查询函数集合，负责：
 * 1. **执行决策**：判断当前是否可执行交易
 * 2. **熔断管理**：管理熔断状态机（closed → open → half-open）
 * 3. **风控统计**：聚合风控裁决历史数据
 * 4. **趋势分析**：分析风险趋势变化
 * 5. **聚合分析**：按标的聚合风险统计
 *
 * 设计原则：
 *   1. 纯函数：通过 useRiskStore.getState() 访问状态，不修改状态
 *   2. 性能优化：memoizeByRef 缓存无参数派生（verdicts 引用未变时直接返回缓存）
 *   3. 派生不调用派生：blockedCount 等直接遍历 verdicts，避免调用 latestVerdict
 *   4. 空状态安全：所有派生在空数据时返回合理默认值（0、null、[]）
 *
 * 风控三态判定规则：
 * ┌──────────────┬───────────────┬─────────────┐
 * │ 风险等级     │ 触发条件      │ 交易操作    │
 * ├──────────────┼───────────────┼─────────────┤
 * │ blocked      │ 任意 BLOCK 规则命中 │ 禁止执行   │
 * │ warning      │ 无 BLOCK 规则，但有 WARN 规则命中 │ 允许执行，显示警告 │
 * │ normal       │ 无 BLOCK 和 WARN 规则命中 │ 正常执行   │
 * └──────────────┴───────────────┴─────────────┘
 *
 * 熔断状态机：
 * - closed（闭合）：请求直通，初始状态 / half-open 连续成功后进入
 * - open（开启）：直接拒绝，连续失败达阈值后进入
 * - half-open（半开）：放行探测请求，open 状态超过 resetTimeoutMs 后进入
 *
 * @compliance AGENTS.md §一 分层规则：store 层仅依赖 services 和 core（lib 属于基础设施白名单）
  * @doc [V9-DOC-DATA-032, V9-DOC-DATA-031, V9-DOC-DATA-076, V9-DOC-DATA-075, V9-DOC-DATA-073]
*/

import { useRiskStore } from '@/store/riskStore'
import type { RiskVerdict, RiskTriState } from '@/store/riskStore'
import { memoizeByRef, safeDivide, safeLength } from '@/lib/derivedCache'

// ============================================================
// 类型定义
// ============================================================

/**
 * 风险等级文字描述
 *
 * @typedef {('正常' | '警告' | '阻塞')} RiskLevelText
 */
export type RiskLevelText = '正常' | '警告' | '阻塞'

/**
 * 回路状态文字描述
 *
 * @typedef {('闭合' | '开启' | '半开')} CircuitStateText
 */
export type CircuitStateText = '闭合' | '开启' | '半开'

/**
 * 风险趋势方向
 *
 * @typedef {('worsening' | 'improving' | 'stable')} RiskTrendDirection
 * @description 基于最近 N 次检查中 blocked 比例的变化判断趋势：
 * - worsening：恶化，blocked 比例上升超过 10%
 * - improving：改善，blocked 比例下降超过 10%
 * - stable：平稳，变化在 10% 以内
 */
export type RiskTrendDirection = 'worsening' | 'improving' | 'stable'

/**
 * 单标的风险统计
 *
 * @interface SymbolRiskStats
 * @description 按标的聚合的风控统计数据，用于评估单个标的的风险状况
 * @property {number} totalChecks - 总检查次数
 * @property {number} blockedCount - 阻塞次数
 * @property {number} warningCount - 警告次数
 * @property {number} normalCount - 正常次数
 * @property {RiskTriState} lastTriState - 最近一次检查的三态
 * @property {number} lastCheckedAt - 最近检查时间戳
 */
export interface SymbolRiskStats {
  totalChecks: number
  blockedCount: number
  warningCount: number
  normalCount: number
  lastTriState: RiskTriState
  lastCheckedAt: number
}

/**
 * 裁决时间线条目
 *
 * @interface VerdictTimelineEntry
 * @description 裁决时间线视图的单个条目，包含裁决记录和距上次检查的间隔
 * @property {RiskVerdict} verdict - 裁决记录
 * @property {number} timeGap - 距上次检查的间隔（ms）
 */
export interface VerdictTimelineEntry {
  verdict: RiskVerdict
  timeGap: number
}

// ============================================================
// 派生查询：执行决策（必需）
// ============================================================

/**
 * 当前是否可执行交易
 *
 * @returns {boolean} - `true` 表示可执行（triState !== 'blocked'），`false` 表示不可执行
 *
 * @description 判断逻辑：只要当前三态不是 'blocked'，就允许执行交易。
 * warning 状态下交易可执行，但会显示警告信息。
 *
 * @UI ExecutionPlanPanel 提交按钮的禁用判定
 *
 * @example
 * ```typescript
 * const canExecute = isExecutable()
 * if (canExecute) {
 *   // 执行交易
 * } else {
 *   // 显示阻塞原因
 *   const blocks = pendingBlocks()
 * }
 * ```
/**
 * isExecutable
 * @returns boolean
 */
export function isExecutable(): boolean {
  return useRiskStore.getState().triState !== 'blocked'
}

/**
 * 当前风险等级文字描述
 *
 * @returns {RiskLevelText} - 风险等级文字（'正常' | '警告' | '阻塞'）
 *
 * @description 将内部三态转换为用户友好的中文描述。
 *
 * @example
 * ```typescript
 * const levelText = riskLevelText()
 * // '正常' | '警告' | '阻塞'
 * ```
/**
 * riskLevelText
 * @returns RiskLevelText
 */
export function riskLevelText(): RiskLevelText {
  const triState = useRiskStore.getState().triState
  switch (triState) {
    case 'normal': return '正常'
    case 'warning': return '警告'
    case 'blocked': return '阻塞'
  }
}

/**
 * 获取最近一次风控裁决
 *
 * @returns {RiskVerdict | null} - 最近一次裁决记录，无裁决时返回 null
 *
 * @description 返回 verdicts 数组的最后一项。
 * 裁决记录包含完整的风控检查结果（blocks、warnings、triState、symbol、timestamp）。
 *
 * @example
 * ```typescript
 * const latest = latestVerdict()
 * if (latest) {
 *   console.log(latest.triState, latest.result.blocks)
 * }
 * ```
/**
 * latestVerdict
 * @returns RiskVerdict | null
 */
export function latestVerdict(): RiskVerdict | null {
  const verdicts = useRiskStore.getState().verdicts
  if (verdicts.length === 0) return null
  return verdicts[verdicts.length - 1]!
}

/**
 * 获取待解决的阻断原因列表
 *
 * @returns {string[]} - 阻断原因列表，无阻断时返回空数组
 *
 * @description 从最近一次裁决中提取 blocks 字段，用于 UI 显示阻断交易的具体原因。
 *
 * @UI ExecutionPlanPanel 显示阻断原因列表
 *
 * @example
 * ```typescript
 * const blocks = pendingBlocks()
 * if (blocks.length > 0) {
 *   blocks.forEach(block => console.log('阻断原因:', block))
 * }
 * ```
/**
 * pendingBlocks
 * @returns string[]
 */
export function pendingBlocks(): string[] {
  const latest = latestVerdict()
  return latest?.result.blocks ?? []
}

/**
 * 获取待解决的警告列表
 *
 * @returns {string[]} - 警告列表，无警告时返回空数组
 *
 * @description 从最近一次裁决中提取 warnings 字段，用于 UI 显示风险警告信息。
 * 警告不阻止交易执行，但提醒用户注意风险。
 *
 * @example
 * ```typescript
 * const warnings = pendingWarnings()
 * warnings.forEach(warning => console.log('警告:', warning))
 * ```
/**
 * pendingWarnings
 * @returns string[]
 */
export function pendingWarnings(): string[] {
  const latest = latestVerdict()
  return latest?.result.warnings ?? []
}

// ============================================================
// 派生查询：回路状态（必需）
// ============================================================

/**
 * 判断熔断回路是否开启
 *
 * @returns {boolean} - `true` 表示回路开启（阻断所有执行），`false` 表示回路闭合或半开
 *
 * @description 熔断开启时，所有交易请求都会被拒绝，需要人工干预才能恢复。
 *
 * @example
 * ```typescript
 * if (isCircuitOpen()) {
 *   console.log('熔断已开启，请人工干预')
 * }
 * ```
/**
 * isCircuitOpen
 * @returns boolean
 */
export function isCircuitOpen(): boolean {
  return useRiskStore.getState().circuitState === 'open'
}

/**
 * 判断是否需要人工干预
 *
 * @returns {boolean} - `true` 表示需要人工干预（circuitState === 'open'），`false` 表示不需要
 *
 * @description 熔断开启时需要人工检查系统状态，确认安全后手动恢复。
 *
 * @example
 * ```typescript
 * if (needsManualIntervention()) {
 *   // 显示人工干预提示
 * }
 * ```
/**
 * needsManualIntervention
 * @returns boolean
 */
export function needsManualIntervention(): boolean {
  return useRiskStore.getState().circuitState === 'open'
}

/**
 * 获取熔断回路状态文字描述
 *
 * @returns {CircuitStateText} - 回路状态文字（'闭合' | '开启' | '半开'）
 *
 * @description 将内部熔断状态转换为用户友好的中文描述。
 *
 * @example
 * ```typescript
 * const stateText = circuitStateText()
 * // '闭合' | '开启' | '半开'
 * ```
/**
 * circuitStateText
 * @returns CircuitStateText
 */
export function circuitStateText(): CircuitStateText {
  const state = useRiskStore.getState().circuitState
  switch (state) {
    case 'closed': return '闭合'
    case 'open': return '开启'
    case 'half-open': return '半开'
  }
}

/**
 * 判断熔断回路是否处于半开状态
 *
 * @returns {boolean} - `true` 表示半开状态（可尝试恢复），`false` 表示其他状态
 *
 * @description 半开状态下会放行少量探测请求，验证系统是否已恢复正常。
 * 如果探测请求成功，回路会转为闭合状态；如果失败，回路会重新转为开启状态。
 *
 * @example
 * ```typescript
 * if (isCircuitHalfOpen()) {
 *   // 放行探测请求
 * }
 * ```
/**
 * isCircuitHalfOpen
 * @returns boolean
 */
export function isCircuitHalfOpen(): boolean {
  return useRiskStore.getState().circuitState === 'half-open'
}

// ============================================================
// 派生查询：风控统计（memoizeByRef 缓存）
// ============================================================

/**
 * 风控统计聚合
 *
 * @param {readonly RiskVerdict[]} verdicts - 裁决记录数组
 * @returns {{ blockedCount: number; warningCount: number; normalCount: number; total: number }} - 统计结果
 *
 * @description 单次遍历 verdicts 完成所有计数，避免多次遍历带来的性能开销。
 * 使用 memoizeByRef 缓存，当 verdicts 引用未变时直接返回缓存结果。
 *
 * @performance 时间复杂度 O(n)，空间复杂度 O(1)
 *
 * @example
 * ```typescript
 * const stats = verdictStats(verdicts)
 * console.log(`阻断率: ${stats.blockedCount / stats.total}`)
 * ```
/**
 * verdictStats
 */
export const verdictStats = memoizeByRef((verdicts: readonly RiskVerdict[]) => {
  let blockedCount = 0
  let warningCount = 0
  let normalCount = 0
  for (const v of verdicts) {
    if (v.triState === 'blocked') blockedCount++
    else if (v.triState === 'warning') warningCount++
    else normalCount++
  }
  return { blockedCount, warningCount, normalCount, total: verdicts.length }
}, 'verdictStats')

/**
 * 获取阻断次数
 *
 * @returns {number} - 阻断次数
 *
 * @description 通过 verdictStats 获取统计结果中的 blockedCount。
 * 使用 memoizeByRef 缓存，性能优化。
 */
export function blockedCount(): number {
  return verdictStats(useRiskStore.getState().verdicts).blockedCount
}

/**
 * 获取警告次数
 *
 * @returns {number} - 警告次数
 *
 * @description 通过 verdictStats 获取统计结果中的 warningCount。
 * 使用 memoizeByRef 缓存，性能优化。
 */
export function warningCount(): number {
  return verdictStats(useRiskStore.getState().verdicts).warningCount
}

/**
 * 获取正常次数
 *
 * @returns {number} - 正常次数
 *
 * @description 通过 verdictStats 获取统计结果中的 normalCount。
 * 使用 memoizeByRef 缓存，性能优化。
 */
export function normalCount(): number {
  return verdictStats(useRiskStore.getState().verdicts).normalCount
}

/**
 * 获取阻断比例
 *
 * @returns {number} - 阻断比例（0-1），无裁决时返回 0
 *
 * @description 阻断次数除以裁决总数，使用 safeDivide 处理除数为 0 的情况。
 *
 * @example
 * ```typescript
 * const rate = blockedRate()
 * if (rate > 0.5) {
 *   console.log('阻断率超过 50%')
 * }
 * ```
/**
 * blockedRate
 * @returns number
 */
export function blockedRate(): number {
  const stats = verdictStats(useRiskStore.getState().verdicts)
  return safeDivide(stats.blockedCount, stats.total)
}

/**
 * 获取裁决总数
 *
 * @returns {number} - 裁决总数，无裁决时返回 0
 *
 * @description 使用 safeLength 处理空数组的情况。
 */
export function verdictsCount(): number {
  return safeLength(useRiskStore.getState().verdicts)
}

// ============================================================
// 派生查询：趋势分析
// ============================================================

/**
 * 获取风险趋势序列
 *
 * @param {number} [limit=10] - 取最近 N 次检查
 * @returns {RiskTriState[]} - 三态序列，按时间顺序排列
 *
 * @description 返回最近 N 次风控检查的三态序列，用于趋势分析和可视化展示。
 *
 * @example
 * ```typescript
 * const trend = riskTrend(10)
 * // ['normal', 'normal', 'warning', 'blocked', 'normal', ...]
 * ```
/**
 * riskTrend
 * @param limit
 * @returns RiskTriState[]
 */
export function riskTrend(limit: number = 10): RiskTriState[] {
  const verdicts = useRiskStore.getState().verdicts
  return verdicts.slice(-limit).map(v => v.triState)
}

/**
 * 判断风险趋势方向
 *
 * @returns {RiskTrendDirection} - 趋势方向（'worsening' | 'improving' | 'stable'）
 *
 * @description 基于最近 10 次检查中 blocked 比例的变化判断趋势：
 * 1. 将趋势序列分为前后两半
 * 2. 分别计算两半的 blocked 比例
 * 3. 计算比例差：后半段比例 - 前半段比例
 * 4. 如果差值 > 0.1（10%），判定为恶化（worsening）
 * 5. 如果差值 < -0.1（-10%），判定为改善（improving）
 * 6. 否则判定为平稳（stable）
 *
 * @note 趋势判断需要至少 4 次检查数据，否则返回 'stable'
 *
 * @example
 * ```typescript
 * const direction = riskTrendDirection()
 * if (direction === 'worsening') {
 *   console.log('风险正在恶化')
 * } else if (direction === 'improving') {
 *   console.log('风险正在改善')
 * }
 * ```
/**
 * riskTrendDirection
 * @returns RiskTrendDirection
 */
export function riskTrendDirection(): RiskTrendDirection {
  const trend = riskTrend(10)
  if (trend.length < 4) return 'stable'

  const half = Math.floor(trend.length / 2)
  const firstHalf = trend.slice(0, half)
  const secondHalf = trend.slice(half)

  const firstBlockedRate = safeDivide(
    firstHalf.filter(t => t === 'blocked').length,
    firstHalf.length
  )
  const secondBlockedRate = safeDivide(
    secondHalf.filter(t => t === 'blocked').length,
    secondHalf.length
  )

  const diff = secondBlockedRate - firstBlockedRate
  if (diff > 0.1) return 'worsening'
  if (diff < -0.1) return 'improving'
  return 'stable'
}

/**
 * 获取裁决时间线视图
 *
 * @param {number} [limit=20] - 取最近 N 条裁决
 * @returns {VerdictTimelineEntry[]} - 时间线条目数组，按时间顺序排列
 *
 * @description 将裁决记录按时间排序，计算每条裁决与上一条的时间间隔。
 * 用于 UI 展示裁决历史和检查频率。
 *
 * @example
 * ```typescript
 * const timeline = verdictsTimeline(20)
 * timeline.forEach(entry => {
 *   console.log(`${entry.verdict.triState} - 间隔: ${entry.timeGap}ms`)
 * })
 * ```
/**
 * verdictsTimeline
 * @param limit
 * @returns VerdictTimelineEntry[]
 */
export function verdictsTimeline(limit: number = 20): VerdictTimelineEntry[] {
  const verdicts = useRiskStore.getState().verdicts
  const sorted = [...verdicts].sort((a, b) => a.timestamp - b.timestamp)
  const result: VerdictTimelineEntry[] = []
  let lastTimestamp = 0
  for (const verdict of sorted.slice(-limit)) {
    result.push({
      verdict,
      timeGap: verdict.timestamp - lastTimestamp,
    })
    lastTimestamp = verdict.timestamp
  }
  return result
}

// ============================================================
// 派生查询：按 symbol 聚合
// ============================================================

/**
 * 按标的聚合风险统计
 *
 * @param {string} symbol - 股票代码
 * @returns {SymbolRiskStats} - 该标的的风险统计数据
 *
 * @description 过滤指定标的的所有裁决记录，统计各状态次数，并记录最近一次检查的状态和时间。
 *
 * @example
 * ```typescript
 * const stats = symbolRiskStats('000001')
 * console.log(`000001 阻断率: ${stats.blockedCount / stats.totalChecks}`)
 * ```
/**
 * symbolRiskStats
 * @param symbol
 * @returns SymbolRiskStats
 */
export function symbolRiskStats(symbol: string): SymbolRiskStats {
  const verdicts = useRiskStore.getState().verdicts
  const symbolVerdicts = verdicts.filter(v => v.symbol === symbol)

  let blockedCnt = 0
  let warningCnt = 0
  let normalCnt = 0
  let lastTriState: RiskTriState = 'normal'
  let lastCheckedAt = 0

  for (const v of symbolVerdicts) {
    if (v.triState === 'blocked') blockedCnt++
    else if (v.triState === 'warning') warningCnt++
    else normalCnt++

    if (v.timestamp > lastCheckedAt) {
      lastCheckedAt = v.timestamp
      lastTriState = v.triState
    }
  }

  return {
    totalChecks: symbolVerdicts.length,
    blockedCount: blockedCnt,
    warningCount: warningCnt,
    normalCount: normalCnt,
    lastTriState,
    lastCheckedAt,
  }
}

// ============================================================
// React Hook 形式派生（可选）
// ============================================================

/**
 * Hook：订阅当前是否可执行交易
 *
 * @returns {boolean} - 当前是否可执行
 *
 * @description 自动订阅 triState 变化，当状态变化时自动重新渲染。
 * 与 isExecutable() 的区别：此 Hook 会触发组件重新渲染。
 *
 * @UI ExecutionPlanPanel 提交按钮禁用状态
 *
 * @example
 * ```tsx
 * const canExecute = useIsExecutable()
 * return <Button disabled={!canExecute}>提交</Button>
 * ```
/**
 * useIsExecutable
 * @returns boolean
 */
export function useIsExecutable(): boolean {
  return useRiskStore(state => state.triState !== 'blocked')
}

/**
 * Hook：订阅当前风险等级文字
 *
 * @returns {RiskLevelText} - 当前风险等级文字
 *
 * @description 自动订阅 triState 变化，当状态变化时自动重新渲染。
 *
 * @UI RiskMonitorWidget 风险等级显示
 *
 * @example
 * ```tsx
 * const levelText = useRiskLevelText()
 * return <span>{levelText}</span>
 * ```
/**
 * useRiskLevelText
 * @returns RiskLevelText
 */
export function useRiskLevelText(): RiskLevelText {
  const triState = useRiskStore(state => state.triState)
  switch (triState) {
    case 'normal': return '正常'
    case 'warning': return '警告'
    case 'blocked': return '阻塞'
  }
}

/**
 * Hook：订阅熔断回路是否开启
 *
 * @returns {boolean} - 回路是否开启
 *
 * @description 自动订阅 circuitState 变化，当状态变化时自动重新渲染。
 *
 * @UI RiskMonitorWidget 熔断状态指示
 *
 * @example
 * ```tsx
 * const circuitOpen = useIsCircuitOpen()
 * return <StatusIndicator open={circuitOpen} />
 * ```
/**
 * useIsCircuitOpen
 * @returns boolean
 */
export function useIsCircuitOpen(): boolean {
  return useRiskStore(state => state.circuitState === 'open')
}

/**
 * Hook：订阅待解决的阻断原因列表
 *
 * @returns {string[]} - 阻断原因列表
 *
 * @description 自动订阅 verdicts 变化，当裁决更新时自动重新渲染。
 *
 * @UI ExecutionPlanPanel 阻断原因列表
 *
 * @example
 * ```tsx
 * const blocks = usePendingBlocks()
 * return blocks.map(block => <Warning key={block}>{block}</Warning>)
 * ```
/**
 * usePendingBlocks
 * @returns string[]
 */
export function usePendingBlocks(): string[] {
  const verdicts = useRiskStore(state => state.verdicts)
  if (verdicts.length === 0) return []
  return verdicts[verdicts.length - 1]!.result.blocks
}