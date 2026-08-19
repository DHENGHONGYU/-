/**
 * SimilarStockRecallCard — 分析舱主页相似股票语义召回卡片
 *
 * Phase 1：基于采集阶段写入的 `collected:{symbol}` 向量，允许分析师
 * 用中文自然语言描述研究方向（如"新能源高股息"、"AI 算力基础设施"）
 * 直接召回已采集的语义相似标的。渲染为一张"搜索框 + TopK 下拉 +
 * 结果列表"的卡片，位于 AnalysisApp 默认视图顶部，不破坏已有评分
 * 流程；召回结果可点击送入评分。
 *
 * 设计：
 *  - 严格零侵入：不修改 analysisStore 中任何评分/候选逻辑，只作为
 *    辅助发现入口。
 *  - 点击"立即评分"调用 analysisStore.handleScore(symbol)。
 *  - "加入意向池"暂不在此暴露（输入舱是意向池唯一写入口），避免
 *    状态双向写路径。
 *  - 状态按 RecallStatus 分色渲染（ok/空/嵌入失败/索引为空/错误）。
 *
 * @module components/organisms/analysis/SimilarStockRecallCard
 */

import React, { useState, useCallback, useMemo } from 'react'
import { Button } from '@/components/atoms/Button'
import { Input } from '@/components/atoms/Input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/atoms/Card'
import { Badge } from '@/components/atoms/Badge'
import { Select, SelectItem } from '@/components/atoms/Select'
import { useToast } from '@/hooks/useToast.tsx'
import {
  Search,
  Sparkles,
  Loader2,
  ArrowRight,
  AlertTriangle,
  DatabaseZap,
  Info,
} from 'lucide-react'
import {
  searchSimilarStocks,
  type SimilarStockRecallItem,
  type RecallStatus,
} from '@/services/analysis/similarStockRecallService'
import { useAnalysisStore } from '@/store/analysisStore'
import { getLogger } from '@/lib/logger'
import { cn } from '@/lib/utils'

const logger = getLogger()

/** 预设示例 — 降门槛：新用户也能一键体验 */
const PRESET_QUERIES = [
  '新能源 高股息 现金流稳健',
  '半导体 国产替代 高端制造',
  'AI 算力 基础设施 光模块',
  '消费升级 白酒 高端品牌',
]

const TOPK_OPTIONS = [5, 10, 20] as const

/** 相似度 → CSS 颜色（冷色→暖色，越高越突出） */
function scoreColorClass(score: number): string {
  if (score >= 0.7) return 'text-[hsl(var(--stock-up))]'
  if (score >= 0.5) return 'text-primary'
  if (score >= 0.35) return 'text-muted-foreground'
  return 'text-muted-foreground/60'
}

/** 相似度 → 进度条背景宽度百分比 */
function scoreBarWidth(score: number): string {
  return `${Math.max(6, Math.min(100, Math.round(score * 100)))}%`
}

export default function SimilarStockRecallCard(): React.JSX.Element {
  const { toast } = useToast()
  const handleScore = useAnalysisStore((s) => s.handleScore)
  const loadingAny = useAnalysisStore((s) => s.loading)
  const stocks = useAnalysisStore((s) => s.stocks)
  const candidates = useAnalysisStore((s) => s.candidates)
  const scope = useAnalysisStore((s) => s.scope)

  const [query, setQuery] = useState<string>('')
  const [topK, setTopK] = useState<number>(5)
  const [loading, setLoading] = useState<boolean>(false)
  const [status, setStatus] = useState<RecallStatus | null>(null)
  const [items, setItems] = useState<SimilarStockRecallItem[]>([])
  const [reason, setReason] = useState<string>('')
  const [elapsedMs, setElapsedMs] = useState<number | null>(null)

  // 评分状态：analysisStore.loading 为真时禁用按钮（全局评分/加载进行中）
  const scoringSymbol: string | null = null

  // 当前作用域内已存在的 symbol 集合（用于展示"已在池中"Badge）
  const inScopeSet = useMemo<Set<string>>(() => {
    const list = scope === 'intention' ? candidates : stocks
    return new Set(list.map((s) => s.symbol))
  }, [scope, candidates, stocks])

  const runSearch = useCallback(
    async (textOverride?: string) => {
      const text = typeof textOverride === 'string' ? textOverride : query
      setLoading(true)
      setStatus(null)
      setReason('')
      try {
        const res = await searchSimilarStocks(text, topK)
        setStatus(res.status)
        setItems(res.items)
        setReason(res.reason ?? '')
        setElapsedMs(res.elapsedMs)
        // 轻度成功 Toast，避免干扰视线
        if (res.status === 'ok' && res.items.length > 0) {
          toast({
            variant: 'default',
            title: '召回完成',
            description: `匹配到 ${res.items.length} 只相似标的（${res.elapsedMs}ms）`,
          })
        } else if (res.status === 'empty-index') {
          toast({
            variant: 'warning',
            title: '向量库暂未就绪',
            description: res.reason,
          })
        } else if (res.status === 'embed-failed' || res.status === 'error') {
          toast({
            variant: 'error',
            title: '语义召回失败',
            description: res.reason,
          })
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        logger.error('[SimilarStockRecallCard] 执行异常', { error: msg })
        setStatus('error')
        setReason(msg)
        toast({ variant: 'error', title: '语义召回异常', description: msg })
      } finally {
        setLoading(false)
      }
    },
    [query, topK, toast],
  )

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !loading) {
      e.preventDefault()
      void runSearch()
    }
  }

  /** 启动单只评分（走 analysisStore 原入口，保持零修改） */
  const onClickScore = useCallback(
    (symbol: string) => {
      void handleScore(symbol)
    },
    [handleScore],
  )

  // 空状态说明（按不同 status 给出不同兜底 + 行动指引）
  const emptyHint = useMemo<{
    title: string
    desc: string
    icon: React.JSX.Element
  } | null>(() => {
    if (status === null) return null
    if (status === 'ok' && items.length === 0) {
      return {
        title: '未找到匹配标的',
        desc: '尝试换一种描述，或降低阈值；若刚采集完，请等待向量化完成。',
        icon: <Search className="h-5 w-5 opacity-60 text-muted-foreground" />,
      }
    }
    if (status === 'empty-query') {
      return {
        title: '请先输入研究主题',
        desc: '例如：新能源高股息、半导体国产替代、AI算力基础设施',
        icon: <Info className="h-5 w-5 opacity-60 text-muted-foreground" />,
      }
    }
    if (status === 'empty-index') {
      return {
        title: '向量库中暂无可召回标的',
        desc: '系统已具备向量化能力，但当前尚没有完成采集+向量化的标的。请先在输入舱点击"采集全部"，采集成功后会自动写入向量。',
        icon: <DatabaseZap className="h-5 w-5 opacity-60 text-warning" />,
      }
    }
    if (status === 'embed-failed') {
      return {
        title: '嵌入服务加载中',
        desc: '首次使用会在后台静默加载 ONNX 嵌入模型（约 30-90MB），请稍后再试。',
        icon: <AlertTriangle className="h-5 w-5 opacity-60 text-warning" />,
      }
    }
    if (status === 'error') {
      return {
        title: '召回错误',
        desc: reason || '未知错误，请查看日志。',
        icon: <AlertTriangle className="h-5 w-5 opacity-60 text-destructive" />,
      }
    }
    return null
  }, [status, items.length, reason])

  return (
    <Card className="shadow-sm border-border/40">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Sparkles className="h-4 w-4 text-primary" />
              相似股票 · 语义召回
            </CardTitle>
            <CardDescription className="mt-1.5 text-xs">
              基于已采集标的的语料嵌入（bge-base-zh-v1.5）做余弦相似度 TopK 召回
              {elapsedMs !== null && status !== null && (
                <span className="ml-2 text-[11px] text-muted-foreground/80">
                  · 本次 <span className="font-semibold">{elapsedMs}ms</span>
                </span>
              )}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={String(topK)}
              onValueChange={(v) => setTopK(Number(v))}
              disabled={loading}
              className="w-[90px]"
            >
              {TOPK_OPTIONS.map((k) => (
                <SelectItem key={k} value={String(k)}>
                  Top {k}
                </SelectItem>
              ))}
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-1">
        {/* 搜索框 + 预设标签 */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入研究方向，例如：新能源 高股息 现金流稳健"
                className="pl-9 pr-24 text-sm shadow-sm h-9"
                disabled={loading}
              />
              {elapsedMs !== null && (
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground/60">
                  Enter 提交
                </span>
              )}
            </div>
            <Button
              size="sm"
              onClick={() => void runSearch()}
              disabled={loading}
              className="min-w-[88px] shadow-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  检索中
                </>
              ) : (
                <>
                  语义召回
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </>
              )}
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground/70">快速示例：</span>
            {PRESET_QUERIES.map((q) => (
              <Button
                key={q}
                size="sm"
                variant="outline"
                onClick={() => {
                  setQuery(q)
                  void runSearch(q)
                }}
                disabled={loading}
                className="h-7 px-2 text-[11px] font-normal text-muted-foreground shadow-none"
              >
                {q}
              </Button>
            ))}
          </div>
        </div>

        {/* 空状态 / 错误提示 */}
        {emptyHint && (
          <div className="flex flex-col items-start gap-2 rounded-md border border-dashed border-border/50 bg-muted/10 px-4 py-5 text-left">
            <div className="flex items-center gap-2">
              {emptyHint.icon}
              <p className="text-sm font-medium text-foreground/80">{emptyHint.title}</p>
            </div>
            <p className="pl-7 text-xs leading-relaxed text-muted-foreground/90">
              {emptyHint.desc}
            </p>
          </div>
        )}

        {/* 召回结果列表 */}
        {!loading && status === 'ok' && items.length > 0 && (
          <div className="divide-y divide-border/40 rounded-md border border-border/40 bg-card">
            {items.map((item, idx) => {
              const inScope = inScopeSet.has(item.symbol)
              const isScoring = scoringSymbol === item.symbol
              return (
                <div
                  key={item.symbol}
                  className={cn(
                    'flex flex-wrap items-center gap-3 px-3.5 py-2.5 transition-colors',
                    idx === 0 && 'rounded-t-md',
                    idx === items.length - 1 && 'rounded-b-md',
                    'hover:bg-muted/30',
                  )}
                >
                  {/* 序号 */}
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground/80">
                    {idx + 1}
                  </span>

                  {/* 核心信息：代码 + 名称 + 行业 */}
                  <div className="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-center sm:gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate font-mono text-sm font-semibold">
                        {item.symbol}
                      </span>
                      <span className="truncate text-sm text-foreground/80">{item.name}</span>
                    </div>
                    {item.industry && (
                      <Badge
                        variant="outline"
                        className="mt-1 h-4.5 w-fit border-border/40 px-1.5 text-[10px] font-normal sm:mt-0"
                      >
                        {item.industry}
                      </Badge>
                    )}
                  </div>

                  {/* 分数条 + 数值 */}
                  <div className="flex items-center gap-2 sm:w-[180px]">
                    <div className="relative h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          'absolute inset-y-0 left-0 rounded-full transition-all duration-500',
                          item.similarityScore >= 0.7
                            ? 'bg-[hsl(var(--stock-up))]'
                            : item.similarityScore >= 0.5
                              ? 'bg-primary'
                              : 'bg-muted-foreground/40',
                        )}
                        style={{ width: scoreBarWidth(item.similarityScore) }}
                      />
                    </div>
                    <span
                      className={cn('font-mono text-[11px] font-semibold', scoreColorClass(item.similarityScore))}
                    >
                      {(item.similarityScore * 100).toFixed(1)}%
                    </span>
                  </div>

                  {/* 已在池中标记 */}
                  {inScope ? (
                    <Badge
                      variant="outline"
                      className="h-6 border-border/50 bg-muted/40 text-[11px]"
                    >
                      已在池中
                    </Badge>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={loading || loadingAny || isScoring}
                      onClick={() => onClickScore(item.symbol)}
                      className="h-7 min-w-[88px] shadow-sm text-xs"
                    >
                      {loadingAny || isScoring ? (
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
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
