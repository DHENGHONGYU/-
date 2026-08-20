/**
 * VectorConsistencyRankingCard — Phase 2 · 向量一致性排名卡片
 *
 * 挂在分析舱主页（SimilarStockRecallCard 下方，V6 评分卡上方），
 * 通过纯函数 sidecar buildConsistencyRanking 计算 α·V6 + (1-α)·cosine
 * 的融合分数排序。始终只读 analysisStore，绝不修改原始 scores。
 *
 * 能力：
 *   · 接收 props.sharedResearchTarget 作为研究目标（来自 Phase 1 召回卡的
 *     用户输入，避免重复输入两次同一句话）。用户仍可在本卡的输入框内
 *     手动微调；本地输入优先于共享值（本地非空时忽略共享）。
 *   · 滑杆式 α 权重 — 左侧"更看重 V6 分数" / 右侧"更看重语义匹配"，
 *     实时重算排序（无需重新嵌入，O(n) 融合计算瞬时完成）。
 *   · 顶部三 stat：候选总数 / 已向量化 / 已评分（向量/评分覆盖可视）。
 *   · 结果行：名次徽章 + 代码 + 名称 + 行业 + [V6%条] + [向量%条] +
 *            融合分数（醒目大字）+ "立即评分" / "已评分"按钮状态。
 *
 * @module components/organisms/analysis/VectorConsistencyRankingCard
 */

import React, {
  useState,
  useCallback,
  useEffect,
  useRef,
} from 'react'
import { Button } from '@/components/atoms/Button'
import { Input } from '@/components/atoms/Input'
import { Badge } from '@/components/atoms/Badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/atoms/Card'
import { useToast } from '@/hooks/useToast.tsx'
import { useAnalysisStore } from '@/store/analysisStore'
import type { AnalysisCandidate } from '@/types/modules/analysis.types'
import type { Stock } from '@/data/types'
import { getLogger } from '@/lib/logger'
import { cn } from '@/lib/utils'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  DatabaseZap,
  Gauge,
  Loader2,
  Search,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import {
  buildConsistencyRanking,
  fuseScores,
  normalizeV6Score,
  type ConsistencyRankItem,
  type ConsistencyRankingStatus,
} from '@/services/analysis/vectorConsistencyRankingService'

const logger = getLogger()

/** 融合分 → Badge variant */
function fusedScoreVariant(score: number): 'success' | 'default' | 'secondary' | 'warning' {
  if (score >= 0.70) return 'success'
  if (score >= 0.50) return 'default'
  if (score >= 0.30) return 'secondary'
  return 'warning'
}

/** 颜色条宽度百分比 */
function pct(v: number): string {
  return `${Math.max(4, Math.round(Math.max(0, Math.min(1, v)) * 100))}%`
}

interface Props {
  /** 共享研究目标 — 来自 SimilarStockRecallCard。本地输入一旦非空则覆盖。 */
  sharedResearchTarget?: string
}

export default function VectorConsistencyRankingCard({
  sharedResearchTarget = '',
}: Props): React.JSX.Element {
  const { toast } = useToast()

  // 直接订阅 analysisStore 的输入源（candidates / stocks / scores / scope），
  // 并在"加载意向候选池/加载全部"按钮触发时自动重排。
  const scope = useAnalysisStore((s) => s.scope)
  const candidates = useAnalysisStore((s) => s.candidates)
  const stocks = useAnalysisStore((s) => s.stocks)
  const scores = useAnalysisStore((s) => s.scores)
  const loadingAny = useAnalysisStore((s) => s.loading)
  const handleScore = useAnalysisStore((s) => s.handleScore)

  // α 滑杆（V6 权重）
  const [alpha, setAlpha] = useState<number>(0.7)
  // 本地研究目标（独立 state，避免共享值被直接覆盖）
  const [localTarget, setLocalTarget] = useState<string>('')
  // 实际用于计算的 target：本地非空用本地，否则用 sharedResearchTarget
  const effectiveTarget = localTarget.length > 0 ? localTarget : sharedResearchTarget
  // effectTargetRef：用于判断 effectiveTarget 变化是否需要触发完整重算
  const effectTargetRef = useRef<string>('')

  // 当前结果
  const [ranking, setRanking] = useState<ConsistencyRankItem[]>([])
  const [status, setStatus] = useState<ConsistencyRankingStatus | null>(null)
  const [reason, setReason] = useState<string>('')
  const [stats, setStats] = useState<{
    candidateTotal: number
    vectorizedCount: number
    scoredCount: number
  } | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [elapsedMs, setElapsedMs] = useState<number | null>(null)

  // 完整执行：嵌入 → 收集向量 → 构建排名（开销较大）
  const runFullBuild = useCallback(
    async (target: string) => {
      setLoading(true)
      setReason('')
      try {
        const items: Array<AnalysisCandidate | Stock> =
          scope === 'intention' ? candidates : stocks

        const res = await buildConsistencyRanking(
          target,
          items,
          scores,
          scope === 'intention' ? 'intention' : 'all',
          alpha,
        )

        setStatus(res.status)
        setRanking(res.items)
        setReason(res.reason ?? '')
        setElapsedMs(res.elapsedMs)
        setStats({
          candidateTotal: res.candidateTotal,
          vectorizedCount: res.vectorizedCount,
          scoredCount: res.scoredCount,
        })

        if (res.status === 'embed-failed') {
          toast({
            variant: 'warning',
            title: '嵌入暂未就绪',
            description: res.reason,
          })
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        logger.error('[ConsistencyRankingCard] 构建异常', { error: msg })
        setStatus('error')
        setReason(msg)
        toast({ variant: 'error', title: '向量一致性排名失败', description: msg })
      } finally {
        setLoading(false)
      }
    },
    [alpha, candidates, scope, scores, stocks, toast],
  )

  // 仅融合重算：仅滑杆变化 → 不需要重新嵌入/读向量，O(n) 即时融合重排
  const recalcFusedOnly = useCallback((): void => {
    if (ranking.length === 0) return
    const remapped: ConsistencyRankItem[] = ranking.map((r) => {
      const fused = fuseScores(r.normalizedV6, r.cosineScore, effectiveTarget.length > 0 ? alpha : 1)
      return { ...r, fusedScore: fused, alphaSnapshot: effectiveTarget.length > 0 ? alpha : 1 }
    })
    remapped.sort((a, b) => b.fusedScore - a.fusedScore
      || b.cosineScore - a.cosineScore
      || b.normalizedV6 - a.normalizedV6
      || a.symbol.localeCompare(b.symbol))
    setRanking(remapped)
  }, [ranking, alpha, effectiveTarget])

  // effect 1：候选/分数/作用域/有效研究目标 变化 → 触发完整构建
  // 并在组件首次挂载时（若候选已存在）执行一次。
  useEffect(() => {
    const hasData = (scope === 'intention' ? candidates.length : stocks.length) > 0
    if (!hasData) {
      setRanking([])
      setStatus('empty-candidates')
      setStats({ candidateTotal: 0, vectorizedCount: 0, scoredCount: 0 })
      return
    }
    effectTargetRef.current = effectiveTarget
    void runFullBuild(effectiveTarget)
    // 仅在 数据源 或 有效研究目标变化时触发（alpha 变化走 recalcFusedOnly）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveTarget, scope, candidates.length, stocks.length, scores.length])

  // effect 2：滑杆 α 变化 → 仅融合重排
  useEffect(() => {
    recalcFusedOnly()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alpha])

  const onClickScore = useCallback(
    (symbol: string) => {
      void handleScore(symbol)
    },
    [handleScore],
  )

  // 共享 target → 本地未输入时提示用户实际使用的是哪个研究方向
  const isUsingShared = localTarget.length === 0 && sharedResearchTarget.length > 0

  // 渲染用：滑杆上的刻度文案与步长（0.1 一档）
  const alphaPercent = Math.round(alpha * 100)
  const cosinePercent = 100 - alphaPercent

  return (
    <Card className="shadow-sm border-border/40">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Gauge className="h-4 w-4 text-primary" />
              向量一致性 · 融合排名
              <Badge variant="outline" className="h-5 border-primary/30 bg-primary/5 text-[10px] font-medium text-primary">
                Phase 2
              </Badge>
            </CardTitle>
            <CardDescription className="mt-1.5 max-w-[640px] text-xs leading-relaxed">
              融合分数 ={' '}
              <span className="font-semibold text-foreground/80">α · V6 归一化分数</span>{' '}
              +{' '}
              <span className="font-semibold text-foreground/80">(1-α) · 研究目标 cosine 相似度</span>
              {elapsedMs !== null && status !== null && (
                <span className="ml-2 text-[11px] text-muted-foreground/80">
                  · 本次 <span className="font-semibold">{elapsedMs}ms</span>
                </span>
              )}
              {isUsingShared && (
                <span className="mt-1 block text-[11px] text-info">
                  · 使用上方「相似股票语义召回」卡的研究目标：
                  <span className="font-medium text-foreground/70">"{sharedResearchTarget}"</span>
                </span>
              )}
              {reason && status && ['embed-failed', 'error', 'empty-candidates'].includes(status) && (
                <span className="mt-1 block text-[11px] text-warning">
                  · {reason}
                </span>
              )}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => void runFullBuild(effectiveTarget)}
              disabled={loading || loadingAny}
              className="shadow-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  重算中
                </>
              ) : (
                <>
                  <TrendingUp className="mr-1.5 h-3.5 w-3.5" />
                  重新排名
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 pt-1">
        {/* 研究目标输入 + 滑杆 + 统计 */}
        <div className="grid gap-4 lg:grid-cols-12">
          {/* 研究目标（列 1/2） */}
          <div className="space-y-2 lg:col-span-6">
            <label className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
              <Search className="h-3 w-3" /> 研究目标
            </label>
            <div className="relative">
              <Input
                value={localTarget}
                onChange={(e) => setLocalTarget(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void runFullBuild(effectiveTarget)
                }}
                placeholder={
                  sharedResearchTarget
                    ? `当前共享：${sharedResearchTarget.slice(0, 30)}${sharedResearchTarget.length > 30 ? '…' : ''}（本框覆盖）`
                    : '例：新能源 高股息 现金流稳健；留空则按纯 V6 排序'
                }
                className="pl-9 pr-20 text-sm shadow-sm h-9"
                disabled={loading || loadingAny}
              />
              <Sparkles className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary/80" />
              {effectiveTarget.length > 0 && (
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground/60">
                  Enter 重算
                </span>
              )}
            </div>
          </div>

          {/* α 滑杆（列 1/2） */}
          <div className="space-y-2 lg:col-span-4">
            <label className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
              <SlidersHorizontal className="h-3 w-3" /> 融合权重 α
            </label>
            <div className="flex items-center gap-3 rounded-md border border-border/40 bg-muted/20 px-3 py-2.5">
              <span className="whitespace-nowrap text-[11px] font-medium text-muted-foreground/90">
                V6 {alphaPercent}%
              </span>
              <input
                type="range"
                min={0}
                max={100}
                step={10}
                value={alphaPercent}
                onChange={(e) => setAlpha(Number(e.target.value) / 100)}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted"
                style={{ accentColor: 'hsl(var(--primary))' }}
                disabled={loading || loadingAny}
              />
              <span className="whitespace-nowrap text-[11px] font-medium text-muted-foreground/90">
                向量 {cosinePercent}%
              </span>
            </div>
          </div>

          {/* 3 个统计小卡（列 12 → sm 三列） */}
          <div className="grid grid-cols-3 gap-2 lg:col-span-2">
            {[
              {
                label: '候选总数',
                value: stats?.candidateTotal ?? 0,
                icon: Activity,
                tone: 'text-foreground',
              },
              {
                label: '已向量化',
                value: stats?.vectorizedCount ?? 0,
                icon: DatabaseZap,
                tone: 'text-primary',
                subtitle: stats && stats.candidateTotal > 0
                  ? `${Math.round((stats.vectorizedCount / stats.candidateTotal) * 100)}%`
                  : undefined,
              },
              {
                label: '已评分',
                value: stats?.scoredCount ?? 0,
                icon: TrendingUp,
                tone: 'text-[hsl(var(--stock-up))]',
                subtitle: stats && stats.candidateTotal > 0
                  ? `${Math.round((stats.scoredCount / stats.candidateTotal) * 100)}%`
                  : undefined,
              },
            ].map((s) => {
              const Icon = s.icon
              return (
                <div
                  key={s.label}
                  className="flex flex-col items-start justify-center rounded-md border border-border/40 bg-card px-3 py-2 shadow-sm"
                >
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground/90">
                    <Icon className="h-3 w-3 opacity-80" />
                    {s.label}
                  </div>
                  <div className={cn('mt-0.5 flex items-baseline gap-1', s.tone)}>
                    <span className="text-base font-bold leading-none">{s.value}</span>
                    {(s as { subtitle?: string }).subtitle && (
                      <span className="text-[10px] font-medium opacity-80">
                        {(s as { subtitle?: string }).subtitle}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* 空状态 */}
        {status === 'empty-candidates' && ranking.length === 0 && (
          <div className="flex flex-col items-start gap-2 rounded-md border border-dashed border-border/50 bg-muted/10 px-4 py-5 text-left">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 opacity-60 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground/80">
                当前作用域尚无候选
              </p>
            </div>
            <p className="pl-7 text-xs leading-relaxed text-muted-foreground/90">
              {scope === 'intention'
                ? '请先使用下方作用域工具条加载"意向候选池"，或去输入舱录入股票并完成采集。'
                : '请先使用下方作用域工具条加载"全部标的"，或去输入舱录入股票。'}
            </p>
          </div>
        )}

        {/* 排名结果列表 */}
        {ranking.length > 0 && (
          <div className="overflow-hidden rounded-md border border-border/40 bg-card">
            {ranking.map((r, idx) => {
              // 双进度条：归一化 V6 + cosine
              const fuseVariant = fusedScoreVariant(r.fusedScore)
              const isScoring = loadingAny && !r.scored // 全局评分中 且该条未完成评分
              const needsVector = r.cosineScore === 0 && effectiveTarget.length > 0
              const needsV6 = !r.scored
              return (
                <div
                  key={r.symbol}
                  className={cn(
                    'grid grid-cols-12 items-center gap-3 border-b border-border/40 px-3.5 py-2.5 last:border-b-0 transition-colors',
                    'hover:bg-muted/30',
                  )}
                >
                  {/* 排名位 */}
                  <div className="col-span-1 flex justify-center">
                    <span
                      className={cn(
                        'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                        idx === 0
                          ? 'bg-[hsl(var(--stock-up))] text-white'
                          : idx === 1
                            ? 'bg-primary/80 text-primary-foreground'
                            : idx === 2
                              ? 'bg-primary/40 text-primary-foreground'
                              : 'bg-muted text-muted-foreground/80',
                      )}
                    >
                      {idx + 1}
                    </span>
                  </div>

                  {/* 代码 + 名称 + 行业 */}
                  <div className="col-span-4 min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="truncate font-mono text-sm font-semibold">
                        {r.symbol}
                      </span>
                      <span className="truncate text-sm text-foreground/85">{r.name}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {r.industry && (
                        <Badge variant="outline" className="h-4.5 border-border/40 px-1.5 text-[10px] font-normal">
                          {r.industry}
                        </Badge>
                      )}
                      {needsV6 && (
                        <Badge variant="warning" className="h-4.5 px-1.5 text-[10px] font-medium">
                          需 V6 评分
                        </Badge>
                      )}
                      {needsVector && (
                        <Badge variant="warning" className="h-4.5 px-1.5 text-[10px] font-medium">
                          需先采集向量
                        </Badge>
                      )}
                      {r.scored && (
                        <Badge variant="success" className="h-4.5 px-1.5 text-[10px] font-medium">
                          已评分
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* V6 条 */}
                  <div className="col-span-2">
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground/90">
                      <span>V6 归一化</span>
                      <span className="font-semibold text-foreground/80">
                        {Math.round(r.normalizedV6 * 100)}%
                      </span>
                    </div>
                    <div className="relative mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          'absolute inset-y-0 left-0 rounded-full',
                          r.normalizedV6 >= 0.6
                            ? 'bg-[hsl(var(--stock-up))]'
                            : r.normalizedV6 >= 0.3
                              ? 'bg-primary'
                              : 'bg-muted-foreground/30',
                        )}
                        style={{ width: pct(r.normalizedV6) }}
                      />
                    </div>
                  </div>

                  {/* 向量条 */}
                  <div className="col-span-2">
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground/90">
                      <span>cosine 相似</span>
                      <span className="font-semibold text-foreground/80">
                        {Math.round(r.cosineScore * 100)}%
                      </span>
                    </div>
                    <div className="relative mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          'absolute inset-y-0 left-0 rounded-full',
                          r.cosineScore >= 0.6
                            ? 'bg-[hsl(var(--stock-up))]'
                            : r.cosineScore >= 0.3
                              ? 'bg-primary'
                              : 'bg-muted-foreground/30',
                        )}
                        style={{ width: pct(r.cosineScore) }}
                      />
                    </div>
                  </div>

                  {/* 融合分数 */}
                  <div className="col-span-1 text-center">
                    <Badge
                      variant={fuseVariant}
                      className="flex h-9 min-w-[72px] items-center justify-center px-2 text-sm font-extrabold"
                    >
                      {(r.fusedScore * 100).toFixed(0)}
                    </Badge>
                  </div>

                  {/* 操作按钮 */}
                  <div className="col-span-2 flex justify-end">
                    {r.scored ? (
                      <Badge variant="secondary" className="h-7 px-2 text-[11px] font-medium">
                        已完成
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={loading || loadingAny || isScoring}
                        onClick={() => onClickScore(r.symbol)}
                        className="h-7 min-w-[88px] shadow-sm text-xs"
                      >
                        {isScoring || loadingAny ? (
                          <>
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                            评分中
                          </>
                        ) : (
                          <>
                            立即评分
                            <ArrowRight className="ml-1 h-3 w-3" />
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* 底注：展示归一化算法说明（简短，不干扰视线） */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-dashed border-border/30 bg-muted/10 px-3 py-2 text-[10px] leading-relaxed text-muted-foreground/85">
          <span>
            <span className="font-medium text-foreground/75">V6 归一化：</span>
            rawV6 / 5，clip [0, 5]
          </span>
          <span className="opacity-60">|</span>
          <span>
            <span className="font-medium text-foreground/75">融合：</span>
            {alphaPercent}%·V6 + {cosinePercent}%·cosine
          </span>
          <span className="opacity-60">|</span>
          <span>
            <span className="font-medium text-foreground/75">原始 V6：</span>
            从未被修改（sidecar 仅读取 scores）
          </span>
          {!isNaN(normalizeV6Score(0)) && (
            <>
              <span className="opacity-60">|</span>
              <span className="text-info">
                研究目标留空时，自动退化为纯 V6 排序（α=100%）。
              </span>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
