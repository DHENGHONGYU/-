/**
 * @module PoolBoardPage
 * @description 输入舱 · 研究候选池总览 + 数据采集进度监控
 *
 * 职责定位：
 * - 展示已纳入研究候选池的所有股票基本信息
 * - 展示每只股票的数据采集进度（七维度完成状态 + 质量评级）
 * - 展示资讯采集统计（时效性 × 高质量双维度）
 * - 提供"去驾驶舱管理"入口
 *
 * 注：研究池的状态管理（流转/分组/批量操作）已迁移至驾驶舱 Widget。
 *
 * @created 2026-07-19
 */

import React from 'react'
import { Button } from '@/components/atoms'
import { Card, CardContent } from '@/components/atoms'
import { Badge } from '@/components/atoms'
import { PageContainer, PageHeader } from '@/components/templates'
import { CollectionProgress } from '@/components/organisms/pool/CollectionProgress'
import { StockNewsStats } from '@/components/organisms/pool/StockNewsStats'
import { useResearchPoolStore } from '@/store/researchPoolStore'
import { useSevenDimConfigStore } from '@/store/sevenDimConfigStore'
import { COLOR_TOKENS, twText, twBg, twBorder, DARK } from '@/constants/theme.tokens'
import { cn } from '@/lib/utils'
import { getLogger } from '@/lib/logger'
import { eventBus } from '@/lib/eventBus'
import { EVENT_NAMES } from '@/constants/store-channels.constants'
import { getBatchCollectionProgress, type CollectionProgress as ProgressType } from '@/services/pool/collectionProgressService'
import { collectPoolSymbols } from '@/services/pool/collectionService'
import type { PoolItem } from '@/types/modules/pool.types'
import type { CollectionConfig, DimensionPipelineConfig } from '@/types/modules/collection.types'
import { STRATEGY_TEMPLATES, DEFAULT_DIMENSIONS } from '@/config/collectConfig'
import { upgradeDimensionsToPipeline } from '@/services/data-collector/collectionPipeline'

/** 全局批量采集进度刷新事件：批量采集进行中触发，通知所有子组件刷新进度 */
export const PROGRESS_REFRESH_EVENT = 'pool:progress-refresh'

// ── Debug：采集中途断连模拟钩子（可在浏览器控制台调用或通过 sessionStorage 设置）
//    触发方式：
//      1) window.__SIMULATE_DISCONNECT__?.()    // 控制台直接调用
//      2) sessionStorage.setItem('POOL_SIMULATE_DISCONNECT', '1')  // 跨代码段通用
//    恢复方式：
//      window.__SIMULATE_RESET__?.() 或 sessionStorage.removeItem('POOL_SIMULATE_DISCONNECT')
declare global {
  interface Window {
    __SIMULATE_DISCONNECT__?: () => void
    __SIMULATE_RESET__?: () => void
  }
}

// ============================================================
// 辅助函数
// ============================================================

function formatMarketCap(cap?: number): string {
  if (cap === undefined || cap === null) return '—'
  if (cap >= 10_000) return `${(cap / 10_000).toFixed(1)}万亿`
  if (cap >= 1) return `${cap.toFixed(0)}亿`
  return `${(cap * 10_000).toFixed(0)}万`
}

const STATUS_LABELS: Record<string, string> = {
  candidate: '候选',
  screened: '初筛',
  deepDive: '深研',
  watching: '跟踪',
  archived: '归档',
}

const STATUS_COLORS: Record<string, string> = {
  candidate: cn(twBg('stone', 100), twText('stone', 700), DARK.bgNeutral800, DARK.textNeutral300),
  screened: cn(twBg('blue', 100), twText('blue', 700), DARK.bgBlue950_30, DARK.textBlue400),
  deepDive: cn(twBg('purple', 100), twText('purple', 700), DARK.bgPurple950_30, DARK.textPurple400),
  watching: cn(twBg('amber', 100), twText('amber', 700), DARK.bgAmber950_30, DARK.textAmber300),
  archived: cn(twBg('stone', 200), twText('stone', 500), DARK.bgNeutral800, DARK.textNeutral500),
}

// ============================================================
// 股票卡片
// ============================================================

function StockOverviewCard({ item }: { item: PoolItem }): React.JSX.Element {
  const status = item.status as string
  return (
    <div className={cn('rounded-lg border p-4 transition-shadow hover:shadow-md', twBorder('stone', 200), DARK.borderNeutral700)}>
      {/* ── 头部：代码 + 名称 + 状态 ── */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={cn('font-mono text-sm font-semibold', twText('stone', 800), DARK.textNeutral100)}>
            {item.symbol}
          </p>
          <p className={cn('truncate text-sm', twText('stone', 600), DARK.textNeutral300)}>
            {item.name}
          </p>
        </div>
        <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium', STATUS_COLORS[status] ?? STATUS_COLORS.candidate)}>
          {STATUS_LABELS[status] ?? status}
        </span>
      </div>

      {/* ── 基本信息 ── */}
      <div className={cn('mt-2 grid grid-cols-3 gap-x-3 gap-y-1 rounded-md border px-2.5 py-2 text-xs', twBorder('stone', 100), twBg('stone', 50), DARK.borderNeutral800, DARK.bgNeutral900)}>
        {item.sector && (
          <div>
            <span className={twText('stone', 400)}>行业</span>
            <p className={cn('font-medium', twText('stone', 700), DARK.textNeutral200)}>{item.sector}</p>
          </div>
        )}
        {item.marketCap !== undefined && (
          <div>
            <span className={twText('stone', 400)}>市值</span>
            <p className={cn('font-medium', twText('stone', 700), DARK.textNeutral200)}>{formatMarketCap(item.marketCap)}</p>
          </div>
        )}
        {item.price !== undefined && (
          <div>
            <span className={twText('stone', 400)}>价格</span>
            <p className={cn('font-medium', twText('stone', 700), DARK.textNeutral200)}>{item.price.toFixed(2)}</p>
          </div>
        )}
        {item.pe !== undefined && (
          <div>
            <span className={twText('stone', 400)}>PE</span>
            <p className={cn('font-medium', twText('stone', 700), DARK.textNeutral200)}>{item.pe.toFixed(1)}</p>
          </div>
        )}
        {item.pb !== undefined && (
          <div>
            <span className={twText('stone', 400)}>PB</span>
            <p className={cn('font-medium', twText('stone', 700), DARK.textNeutral200)}>{item.pb.toFixed(1)}</p>
          </div>
        )}
        {item.roe !== undefined && (
          <div>
            <span className={twText('stone', 400)}>ROE</span>
            <p className={cn('font-medium', twText('stone', 700), DARK.textNeutral200)}>{item.roe.toFixed(1)}%</p>
          </div>
        )}
      </div>

      {/* ── 数据采集进度 ── */}
      <div className={cn('mt-3 rounded-md border p-3', twBorder('stone', 100), twBg('stone', 50) + '/50', DARK.borderNeutral800, DARK.bgNeutral900)}>
        <p className={cn('mb-2 text-[10px] font-medium uppercase tracking-wider', twText('stone', 400))}>
          数据采集进度
        </p>
        <CollectionProgress symbol={item.symbol} />
      </div>

      {/* ── 资讯采集统计 ── */}
      <div className={cn('mt-3 rounded-md border p-3', twBorder('stone', 100), twBg('stone', 50) + '/50', DARK.borderNeutral800, DARK.bgNeutral900)}>
        <p className={cn('mb-2 text-[10px] font-medium uppercase tracking-wider', twText('stone', 400))}>
          资讯采集（时效 × 质量）
        </p>
        <StockNewsStats symbol={item.symbol} />
      </div>
    </div>
  )
}

// ============================================================
// 采集概览汇总
// ============================================================

interface PoolCollectionSummary {
  avgPercent: number
  collectedCount: number
  ratingCounts: Record<string, number>
}

function buildSummary(progressMap: Map<string, ProgressType>): PoolCollectionSummary {
  const valid = Array.from(progressMap.values())
  const ratingCounts: Record<string, number> = {}
  let percentSum = 0
  for (const p of valid) {
    percentSum += p.completionPercent
    ratingCounts[p.qualityRating] = (ratingCounts[p.qualityRating] ?? 0) + 1
  }
  return {
    avgPercent: valid.length > 0 ? Math.round(percentSum / valid.length) : 0,
    collectedCount: valid.length,
    ratingCounts,
  }
}

// ============================================================
// 批量采集进度面板
// ============================================================

interface BatchProgressDetail {
  symbol: string
  name: string
  percent: number
  completedDims: number
  totalDims: number
  dimStatuses: { name: string; status: string }[]
}

function BatchCollectionPanel({
  collecting,
  symbols,
  progressMap,
  refreshError,
}: {
  collecting: boolean
  symbols: { symbol: string; name: string }[]
  progressMap: Map<string, ProgressType> | null
  refreshError: string | null
}): React.JSX.Element | null {
  if (!collecting) return null

  // 计算总进度
  let totalCompleted = 0
  let totalDims = 0
  const details: BatchProgressDetail[] = []

  for (const item of symbols) {
    const p = progressMap?.get(item.symbol)
    const completedDims = p?.completedCount ?? 0
    const totalD = p?.totalDimensions ?? 7
    totalCompleted += completedDims
    totalDims += totalD
    details.push({
      symbol: item.symbol,
      name: item.name,
      percent: p?.completionPercent ?? 0,
      completedDims,
      totalDims: totalD,
      dimStatuses: p?.dimensions?.map((d) => ({ name: d.name, status: d.status })) ?? [],
    })
  }

  const overallPercent = totalDims > 0 ? Math.round((totalCompleted / totalDims) * 100) : 0
  const isBroken = !!refreshError

  return (
    <div className={cn(
      'rounded-lg border-2 p-4',
      isBroken
        ? cn(twBorder('red', 300), twBg('red', '50/60'), DARK.borderRed800, DARK.bgRed950_20)
        : cn(twBorder('emerald', 200), twBg('emerald', '50/50'), DARK.borderEmerald800, DARK.bgEmerald950_20),
    )}>
      {/* 总进度条 */}
      <div className="flex items-center gap-3">
        {isBroken ? (
          <span className={cn('text-sm', twText('red', 600))}>⚠</span>
        ) : (
          <div className={cn('h-3 w-3 animate-spin rounded-full border-2', twBorder('emerald', 300), 'border-t-emerald-600')} />
        )}
        <span className={cn('text-sm font-medium', isBroken ? twText('red', 700) : twText('emerald', 700), isBroken ? DARK.textRed300 : DARK.textEmerald300)}>
          {isBroken ? '采集断连，已停止进度更新' : '批量采集进行中'}
        </span>
        <div className={cn('flex-1 h-3 overflow-hidden rounded-full', isBroken ? twBg('red', 100) : twBg('emerald', 100), isBroken ? DARK.bgRed950_50 : DARK.bgEmerald950_50)}>
          <div
            className={cn('h-full rounded-full transition-all duration-700 ease-out', isBroken ? twBg('red', 400) : twBg('emerald', 500))}
            style={{ width: `${overallPercent}%` }}
          />
        </div>
        <span className={cn('text-lg font-bold tabular-nums', isBroken ? twText('red', 700) : twText('emerald', 700), isBroken ? DARK.textRed300 : DARK.textEmerald300)}>
          {overallPercent}%
        </span>
      </div>
      <p className={cn('mt-1 text-xs', twText('stone', 500))}>
        已完成 {totalCompleted} / {totalDims} 个维度 · 共 {symbols.length} 只标的
      </p>
      {/* 断连错误详情 */}
      {refreshError && (
        <div className={cn('mt-2 rounded-md border px-2 py-1.5 text-[11px]', twBorder('red', 200), DARK.borderRed900, DARK.bgNeutral900_60, twText('red', 700), DARK.textRed300)}>
          <span className="font-medium">断连原因：</span>
          <span className="font-mono break-all">{refreshError}</span>
        </div>
      )}

      {/* 每只股票的维度采集状态 */}
      <div className={cn('mt-3 space-y-1.5 rounded-md border p-3', twBorder('emerald', 100), DARK.bgNeutral900Half, DARK.borderEmerald900)}>
        {details.map((d) => (
          <div key={d.symbol} className="flex items-center gap-2 text-xs">
            <span className={cn('w-24 shrink-0 truncate font-mono', twText('stone', 600), DARK.textNeutral300)} title={d.name}>
              {d.symbol}
            </span>
            <span className={cn('w-16 shrink-0 truncate', twText('stone', 500))} title={d.name}>
              {d.name}
            </span>
            {/* 维度圆点：与 CollectionProgress STATUS_CONFIG 保持一致 */}
            <div className="flex flex-1 items-center gap-1">
              {d.dimStatuses.map((dim, i) => {
                const dotClass =
                  dim.status === 'success' ? twBg('emerald', 500) :
                  dim.status === 'partial' ? twBg('amber', 500) :
                  dim.status === 'fail' ? twBg('red', 500) :
                  cn(twBg('stone', 300), DARK.bgNeutral600)
                return (
                  <div
                    key={i}
                    className={cn('h-2 w-2 rounded-full transition-colors duration-300', dotClass)}
                    title={`${dim.name}：${dim.status === 'success' ? '已完成' : dim.status === 'partial' ? '部分' : dim.status === 'fail' ? '失败' : '待采集'}`}
                  />
                )
              })}
            </div>
            {/* 百分比 */}
            <div className={cn('flex items-center gap-1.5', 'w-20 shrink-0 justify-end')}>
              <div className={cn('h-1.5 w-12 overflow-hidden rounded-full', twBg('stone', 200), DARK.bgNeutral700)}>
                <div
                  className={cn('h-full rounded-full transition-all duration-500', twBg('emerald', 500))}
                  style={{ width: `${d.percent}%` }}
                />
              </div>
              <span className={cn('tabular-nums', twText('stone', 600), DARK.textNeutral300)}>
                {d.completedDims}/{d.totalDims}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const RATING_LABELS: Record<string, string> = {
  excellent: '优秀',
  good: '良好',
  fair: '一般',
  poor: '较差',
}

// ============================================================
// 主页面
// ============================================================

const pageLogger = getLogger()

export default function PoolBoardPage(): React.JSX.Element {
  const items = useResearchPoolStore((s) => s.items)
  const loading = useResearchPoolStore((s) => s.loading)
  const refresh = useResearchPoolStore((s) => s.refresh)
  const [summary, setSummary] = React.useState<PoolCollectionSummary | null>(null)
  const [collecting, setCollecting] = React.useState(false)
  const [collectError, setCollectError] = React.useState<string | null>(null)
  const [batchProgressMap, setBatchProgressMap] = React.useState<Map<string, ProgressType> | null>(null)
  const [refreshError, setRefreshError] = React.useState<string | null>(null)

  const handleCollect = React.useCallback(async (): Promise<void> => {
    if (collecting || items.length === 0) return
    let forceDemoFlag = false
    try { forceDemoFlag = typeof sessionStorage !== 'undefined' && sessionStorage.getItem('POOL_FORCE_DEMO') === '1' } catch { /* noop */ }
    pageLogger.info('[PoolBoardPage · handleCollect] 批量采集启动', {
      symbolCount: items.length,
      symbols: items.map((i) => i.symbol),
      mode: forceDemoFlag ? 'DEMO' : 'REAL',
    })
    setCollecting(true)
    setCollectError(null)
    setRefreshError(null)

    // ── Debug：强制批量采集走演示 Mock 模式
    //    sessionStorage.POOL_FORCE_DEMO === '1' 时，所有维度都走 mock 分支
    //    （800–2200ms 随机延迟 + 85%绿 / 10%红 / 5%琥珀 状态分布），
    //    让进度面板能观察到进度条从 0%→100% 流畅增长及圆点颜色切换。
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('POOL_FORCE_DEMO', '1')
      }
    } catch { /* noop */ }

    // 连续刷新失败计数，超过阈值判定为断连
    let consecutiveRefreshFailures = 0
    const REFRESH_FAILURE_THRESHOLD = 3
    let refreshForceStopped = false

    // ── Debug Hook：两种方式触发采集中途断连场景
    //    1) 控制台调用：window.__SIMULATE_DISCONNECT__?.()
    //    2) sessionStorage：sessionStorage.setItem('POOL_SIMULATE_DISCONNECT', '1')
    //    恢复：window.__SIMULATE_RESET__?.() 或 sessionStorage.removeItem('POOL_SIMULATE_DISCONNECT')
    let simFail = false
    let simCallCount = 0
    const checkSimFlag = (): boolean => {
      if (simFail) return true
      try {
        if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('POOL_SIMULATE_DISCONNECT') === '1') {
          simFail = true
        }
      } catch { /* noop */ }
      return simFail
    }
    if (typeof window !== 'undefined') {
      window.__SIMULATE_DISCONNECT__ = () => {
        console.warn('[PoolBoardPage · Debug] ⚡ 采集中途断连模拟已启用（window hook），下次刷新开始抛错')
        simFail = true
        try { sessionStorage.setItem('POOL_SIMULATE_DISCONNECT', '1') } catch { /* noop */ }
      }
      window.__SIMULATE_RESET__ = () => {
        console.info('[PoolBoardPage · Debug] 断连模拟已重置')
        simFail = false
        simCallCount = 0
        try { sessionStorage.removeItem('POOL_SIMULATE_DISCONNECT') } catch { /* noop */ }
      }
    }

    // 进度定时刷新：采集过程中每 1 秒触发一次所有子组件的进度刷新
    let refreshTimer: ReturnType<typeof setInterval> | null = setInterval(() => {
      if (refreshForceStopped) return
      eventBus.emit(PROGRESS_REFRESH_EVENT, {})
      void (async () => {
        try {
          // Debug 模式：模拟断连 —— 连续抛出 IndexedDB 查询失败
          if (checkSimFlag()) {
            simCallCount++
            const errMsg = `IndexedDB 读取失败：transaction aborted (模拟网络断连 #${simCallCount})`
            console.error(`[PoolBoardPage · Debug] 注入进度刷新失败 (${simCallCount}/${REFRESH_FAILURE_THRESHOLD}): ${errMsg}`)
            pageLogger.warn('[PoolBoardPage · handleCollect · Progress] 注入模拟断连错误', {
              attempt: simCallCount,
              threshold: REFRESH_FAILURE_THRESHOLD,
              error: errMsg,
            })
            throw new Error(errMsg)
          }
          const progressMap = await getBatchCollectionProgress(items.map((i) => i.symbol))
          setSummary(buildSummary(progressMap))
          setBatchProgressMap(progressMap)
          consecutiveRefreshFailures = 0
          setRefreshError(null)
          if (consecutiveRefreshFailures === 0) {
            // 每次刷新成功都输出一次进度摘要日志（每秒一次，方便排查卡住的情况）
            const summaryStats = buildSummary(progressMap)
            pageLogger.info('[PoolBoardPage · handleCollect · Progress] 进度刷新成功', {
              avgPercent: summaryStats.avgPercent,
              collectedCount: summaryStats.collectedCount,
              totalSymbols: items.length,
              ratingCounts: summaryStats.ratingCounts,
            })
          }
        } catch (err) {
          consecutiveRefreshFailures++
          const msg = err instanceof Error ? err.message : String(err)
          console.error(`[PoolBoardPage] 进度刷新失败 (${consecutiveRefreshFailures}/${REFRESH_FAILURE_THRESHOLD}):`, err)
          pageLogger.warn('[PoolBoardPage · handleCollect · Progress] 进度刷新失败', {
            attempt: consecutiveRefreshFailures,
            threshold: REFRESH_FAILURE_THRESHOLD,
            error: msg,
          })
          setRefreshError(msg)
          if (consecutiveRefreshFailures >= REFRESH_FAILURE_THRESHOLD) {
            refreshForceStopped = true
            if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null }
            const stopMsg = `⚠ 采集中途断连：进度刷新连续 ${REFRESH_FAILURE_THRESHOLD} 次失败 (${msg})，已停止更新。`
            console.error('[PoolBoardPage] ' + stopMsg)
            pageLogger.error('[PoolBoardPage · handleCollect · Progress] 采集中途断连，已停止进度更新', {
              threshold: REFRESH_FAILURE_THRESHOLD,
              lastError: msg,
              symbolCount: items.length,
            })
            setCollectError(stopMsg)
          }
        }
      })()
    }, 1000)

    try {
      const cfgState = useSevenDimConfigStore.getState()

      // 关键修复：dimensions 为空时（用户未到配置页面），
      // 自动从 STRATEGY_TEMPLATES 的第一个模板加载默认启用维度，
      // 避免抛出"没有可用的采集维度"异常导致采集功能悬空。
      let dims = cfgState.dimensions
      if (!Array.isArray(dims) || dims.length === 0 || dims.every((d) => !d.enabled)) {
        const defaultTemplate = STRATEGY_TEMPLATES.find((t) => t.id === 'value') ?? STRATEGY_TEMPLATES[0]
        if (!defaultTemplate) {
          throw new Error('未找到任何策略模板，无法构建默认维度配置')
        }
        const fallbackDims = upgradeDimensionsToPipeline(
          DEFAULT_DIMENSIONS.map((d) => ({
            ...d,
            enabled: defaultTemplate.dimensions.includes(d.code),
            frequency: defaultTemplate.updateInterval,
            sources: defaultTemplate.sources,
          })) as DimensionPipelineConfig[],
        )
        dims = fallbackDims
        pageLogger.warn('[PoolBoardPage · handleCollect · Config] 维度配置为空，已回退到默认策略模板', {
          activeTemplate: defaultTemplate.id,
          templateName: defaultTemplate.name,
          enabledDimensionCodes: fallbackDims.filter((d) => d.enabled).map((d) => d.code),
        })
        // 尝试写回 store，下次无需再重建
        try {
          useSevenDimConfigStore.setState({ dimensions: fallbackDims, activeTemplate: defaultTemplate.id, isDirty: true })
        } catch { /* ignore */ }
      }

      const activeTemplate = cfgState.activeTemplate ?? 'value'
      const config: CollectionConfig = {
        version: '1.0.0',
        activeTemplate,
        dimensions: dims,
        global: cfgState.global,
        symbolCount: items.length,
        historyDays: cfgState.historyDays ?? 252,
        updatedAt: Date.now(),
      }
      pageLogger.info('[PoolBoardPage · handleCollect · Config] 采集配置构建完成', {
        activeTemplate,
        dimensionCount: dims.length,
        enabledDimensionCodes: dims.filter((d) => d.enabled).map((d) => d.code),
        historyDays: config.historyDays,
      })

      // collectPoolSymbols 内部会 Promise.allSettled + 抛错合并，
      try {
        pageLogger.info('[PoolBoardPage · handleCollect · Main] collectPoolSymbols 开始执行', {
          symbolCount: items.length,
          activeTemplate,
        })
        const collectStart = Date.now()
        await collectPoolSymbols(items.map((i) => i.symbol), config)
        pageLogger.info('[PoolBoardPage · handleCollect · Main] collectPoolSymbols 执行完成', {
          symbolCount: items.length,
          elapsedMs: Date.now() - collectStart,
        })
      } catch (collectErr) {
        const msg = collectErr instanceof Error ? collectErr.message : String(collectErr)
        console.error('[PoolBoardPage] 批量采集主流程异常:', collectErr)
        pageLogger.error('[PoolBoardPage · handleCollect · Main] 批量采集主流程异常（部分维度失败不视为完全失败）', {
          error: msg,
          stack: collectErr instanceof Error ? collectErr.stack : undefined,
        })
        // 部分维度失败不视为完全失败，记录即可
        setCollectError(msg)
      }

      await refresh()
      const progressMap = await getBatchCollectionProgress(items.map((i) => i.symbol))
      const finalSummary = buildSummary(progressMap)
      setSummary(finalSummary)
      pageLogger.info('[PoolBoardPage · handleCollect · Main] 批量采集结束 — 最终结果摘要', {
        avgPercent: finalSummary.avgPercent,
        collectedCount: finalSummary.collectedCount,
        totalSymbols: items.length,
        ratingCounts: finalSummary.ratingCounts,
        status: collectError ? 'ERROR' : refreshForceStopped ? 'DISCONNECTED' : 'SUCCESS',
      })
      // 最终通知所有子组件最后刷新一次
      eventBus.emit(PROGRESS_REFRESH_EVENT, {})
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[PoolBoardPage] 批量采集全局异常:', err)
      pageLogger.error('[PoolBoardPage · handleCollect · Main] 批量采集全局异常', {
        error: msg,
        stack: err instanceof Error ? err.stack : undefined,
      })
      setCollectError(msg)
    } finally {
      if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null }
      // 清理调试钩子，避免全局污染
      if (typeof window !== 'undefined') {
        try { delete (window as unknown as Record<string, unknown>).__SIMULATE_DISCONNECT__ } catch { /* noop */ }
        try { delete (window as unknown as Record<string, unknown>).__SIMULATE_RESET__ } catch { /* noop */ }
      }
      try {
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.removeItem('POOL_FORCE_DEMO')
          sessionStorage.removeItem('POOL_SIMULATE_DISCONNECT')
        }
      } catch { /* noop */ }
      pageLogger.info('[PoolBoardPage · handleCollect · Finally] 批量采集流程收尾完成，定时器/调试钩子已清理', {
        hadCollectError: Boolean(collectError),
        wasForceStopped: refreshForceStopped,
      })
      setCollecting(false)
      setBatchProgressMap(null)
    }
  }, [collecting, items, refresh])

  const stats = React.useMemo(() => {
    const total = items.length
    const statusCounts: Record<string, number> = {}
    for (const item of items) {
      const s = item.status as string
      statusCounts[s] = (statusCounts[s] ?? 0) + 1
    }
    return { total, statusCounts }
  }, [items])

  // 挂载即加载研究池数据；订阅录入/导入事件自动刷新
  React.useEffect(() => {
    void refresh()

    const onChanged = (): void => { void refresh() }
    const offPool = eventBus.on(EVENT_NAMES.POOL_CHANGED, onChanged)
    const offBatch = eventBus.on('BATCH_IMPORT_COMPLETED', onChanged)
    return () => {
      offPool()
      offBatch()
    }
  }, [refresh])

  // 加载全池采集概览
  React.useEffect(() => {
    if (items.length === 0) {
      setSummary(null)
      return
    }
    let cancelled = false
    void (async () => {
      const progressMap = await getBatchCollectionProgress(items.map((i) => i.symbol))
      if (!cancelled) setSummary(buildSummary(progressMap))
    })()
    return () => { cancelled = true }
  }, [items])

  return (
    <PageContainer className="space-y-4">
      <PageHeader
        title="研究候选池"
        description="已纳入研究候选池的股票基本信息与数据采集进度总览"
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={COLOR_TOKENS.info.tailwind}>
              {stats.total} 只标的
            </Badge>
            {Object.entries(stats.statusCounts).map(([status, count]) => (
              <Badge key={status} variant="secondary" className={cn('text-[10px]', twText('stone', 500))}>
                {STATUS_LABELS[status] ?? status} {count}
              </Badge>
            ))}
          </div>
        }
      />

      {/* ── 工具栏 ── */}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void refresh()}
          disabled={loading || collecting}
        >
          {loading ? '刷新中...' : '刷新数据'}
        </Button>
        <Button
          size="sm"
          onClick={() => void handleCollect()}
          disabled={collecting || items.length === 0}
        >
          {collecting ? '采集中...' : '批量采集'}
        </Button>
        <span className={cn('text-xs', twText('stone', 400))}>
          状态管理（流转/分组/批量操作）请在
          <a href="#/cockpit" className={cn('mx-1 underline', COLOR_TOKENS.info.tailwind)}>
            驾驶舱
          </a>
          中操作
        </span>
      </div>
      {collectError && (
        <div className={cn('rounded-md border px-4 py-2 text-xs', twBorder('red', 200), twBg('red', 50), twText('red', 700))}>
          {collectError}
        </div>
      )}

      {/* ── 批量采集进度面板（采集中显示） ── */}
      <BatchCollectionPanel
        collecting={collecting}
        symbols={items.map((i) => ({ symbol: i.symbol, name: i.name }))}
        progressMap={batchProgressMap}
        refreshError={refreshError}
      />

      {/* ── 说明 ── */}
      <div className={cn('rounded-md border px-4 py-3 text-xs', twBorder('stone', 100), twBg('stone', 50) + '/50', DARK.borderNeutral800, DARK.bgNeutral900)}>
        <p className={cn('font-medium', twText('stone', 600), DARK.textNeutral300)}>
          采集进度说明
        </p>
        <ul className={cn('mt-1 space-y-0.5', twText('stone', 500))}>
          <li>七维度采集：基础数据 / K线行情 / 筹码分布 / 事件驱动 / 新闻资讯 / 行业数据 / 指数数据</li>
          <li>质量评级：优秀(≥85%) / 良好(≥70%) / 一般(≥40%) / 较差(&lt;40%)</li>
          <li>资讯双维度：时效性（近1周/1月/3月/全部）× 高质量（sentimentConfidence ≥ 0.7）</li>
        </ul>
      </div>

      {/* ── 全池采集概览 ── */}
      {summary && (
        <div className={cn('rounded-md border px-4 py-3', twBorder('stone', 100), twBg('stone', 50) + '/50', DARK.borderNeutral800, DARK.bgNeutral900)}>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
            <span className={cn('font-medium', twText('stone', 600), DARK.textNeutral300)}>
              采集概览
            </span>
            <span>
              <span className={twText('stone', 400)}>平均完成度 </span>
              <span className={cn('font-semibold', COLOR_TOKENS.info.tailwind)}>{summary.avgPercent}%</span>
            </span>
            <span>
              <span className={twText('stone', 400)}>已采集标的 </span>
              <span className={cn('font-semibold', twText('stone', 700), DARK.textNeutral200)}>{summary.collectedCount}/{items.length}</span>
            </span>
            {Object.entries(summary.ratingCounts).map(([rating, count]) => (
              <span key={rating}>
                <span className={twText('stone', 400)}>{RATING_LABELS[rating] ?? rating} </span>
                <span className={cn('font-semibold', twText('stone', 700), DARK.textNeutral200)}>{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── 股票卡片网格 ── */}
      {items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className={cn('text-lg', twText('stone', 400))}>研究候选池暂无标的</p>
            <p className={cn('mt-2 text-sm', twText('stone', 400))}>
              请先通过"批量导入"功能添加股票到研究候选池
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <StockOverviewCard key={item.symbol} item={item} />
          ))}
        </div>
      )}
    </PageContainer>
  )
}
