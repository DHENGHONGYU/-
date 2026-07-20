/**
 * 八域资料浏览页面
 *
 * 可视化展示个股的八域研究资料和评分证据链，
 * 支持域导航、资料筛选、详情查看、证据追溯等功能。
 *
 * @module pages/output/ProfileBrowsePage
 * @doc [V9-DOC-DATA-028, V9-DOC-DATA-029]
 */

import React, { useEffect, useMemo } from 'react'
import {
  BookOpen,
  Search,
  Filter,
  RefreshCw,
  ChevronRight,
  Layers,
  TrendingUp,
  TrendingDown,
  Star,
  Clock,
  User,
  Link2,
  Tag,
  FileText,
  BarChart3,
  Building2,
  Globe,
  Target,
  PieChart,
  LineChart,
  Zap,
  AlertCircle,
  type LucideIcon,
} from 'lucide-react'
import { twText } from '@/constants/theme.tokens'
import { ErrorBoundary } from '@/components/organisms/shared/ErrorBoundary'
import { PageContainer } from '@/components/templates/PageContainer'
import { PageHeader } from '@/components/templates/PageHeader'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/atoms/Card'
import { Badge } from '@/components/atoms/Badge'
import { Button } from '@/components/atoms/Button'
import { Select, SelectItem } from '@/components/atoms/Select'
import { Input } from '@/components/atoms/Input'
import { Skeleton } from '@/components/atoms/Skeleton'
import { Separator } from '@/components/atoms/Separator'
import { Tooltip } from '@/components/atoms/Tooltip'
import { Progress } from '@/components/atoms/Progress'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/molecules/Tabs'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/atoms/Sheet'
import {
  useProfileStore,
  selectStocks,
  selectSymbol,
  selectActiveDomain,
  selectItems,
  selectItemsLoading,
  selectSelectedItemId,
  selectEvidence,
  selectProfile,
  selectSelectedItem,
  groupEvidenceByLayer,
  selectFilter,
  DOMAIN_META,
} from '@/store/profileStore'
import type {
  ProfileDomain,
  ProfileItem,
  ScoreEvidence,
  ScoreLayerId,
  SentimentLabel,
} from '@/data/types/types.profile'

// ============================================================
// 常量与辅助函数
// ============================================================

const DOMAIN_ORDER: ProfileDomain[] = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8']

const DOMAIN_ICONS: Record<ProfileDomain, LucideIcon> = {
  D1: Building2,
  D2: Globe,
  D3: Target,
  D4: PieChart,
  D5: BarChart3,
  D6: LineChart,
  D7: Zap,
  D8: TrendingUp,
}

const SENTIMENT_LABELS: Record<SentimentLabel, { text: string; variant: 'success' | 'destructive' | 'secondary' | 'warning' }> = {
  positive: { text: '正面', variant: 'success' },
  negative: { text: '负面', variant: 'destructive' },
  neutral: { text: '中性', variant: 'secondary' },
}

/**
 * 证据的带符号贡献度：权重 × 情绪方向（positive=+1 / negative=-1 / neutral=0）。
 * ScoreEvidence 生产类型只有 weight（0-1）与 sentiment，无 contribution 字段。
 */
function signedContribution(ev: ScoreEvidence): number {
  const sign = ev.sentiment === 'positive' ? 1 : ev.sentiment === 'negative' ? -1 : 0
  return ev.weight * sign
}

const ITEM_TYPE_LABELS: Record<string, string> = {
  report: '研报',
  notice: '公告',
  news: '新闻',
  community: '社区帖',
  analysis: '分析',
  note: '笔记',
  data_ref: '数据',
  event: '事件',
  score_report: '评分报告',
  score_layer: '评分层',
  score_diff: '评分对比',
  research_report: '券商研报',
  financial_report: '财务报告',
  industry_report: '行业报告',
  other: '其他',
}

const LAYER_NAMES: Record<ScoreLayerId, string> = {
  lMinus1: 'L-1 行业评分',
  l0: 'L0 宏观环境',
  l1: 'L1 护城河',
  l2: 'L2 竞品格局',
  l3f: 'L3a 财务健康',
  l3v: 'L3v 估值水平',
  l4: 'L4 情景推演',
  l5: 'L5 T-M矩阵',
  l6: 'L6 Hype周期',
  l7: 'L7 第二曲线',
  l8: 'L8 技术筹码',
}

function formatDate(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDateTime(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function qualityColor(score: number): string {
  if (score >= 90) return twText('emerald', 600)
  if (score >= 75) return twText('green', 600)
  if (score >= 60) return twText('amber', 600)
  return 'text-muted-foreground'
}

// ============================================================
// 子组件：股票选择器
// ============================================================

function StockSelector(): React.JSX.Element {
  const stocks = useProfileStore(selectStocks)
  const symbol = useProfileStore(selectSymbol)
  const setSymbol = useProfileStore((state) => state.setSymbol)
  const loadStocks = useProfileStore((state) => state.loadStocks)

  useEffect(() => {
    void loadStocks()
  }, [loadStocks])

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-muted-foreground">股票:</span>
      <Select
        value={symbol}
        onValueChange={setSymbol}
        className="w-48"
      >
        {stocks.length === 0 ? (
          <SelectItem value="" disabled>加载中...</SelectItem>
        ) : (
          stocks.map((s) => (
            <SelectItem key={s.symbol} value={s.symbol}>
              {s.symbol} {s.name ?? ''}
            </SelectItem>
          ))
        )}
      </Select>
    </div>
  )
}

// ============================================================
// 子组件：八域导航
// ============================================================

function DomainNav(): React.JSX.Element {
  const activeDomain = useProfileStore(selectActiveDomain)
  const setActiveDomain = useProfileStore((state) => state.setActiveDomain)
  const items = useProfileStore(selectItems)
  const profile = useProfileStore(selectProfile)

  const domainCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const item of items) {
      counts[item.domain] = (counts[item.domain] ?? 0) + 1
    }
    return counts
  }, [items])

  const totalCount = items.length

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Layers className="h-4 w-4" />
          八域导航
        </CardTitle>
        <CardDescription>
          共 {totalCount} 条资料
          {profile && (
            <span className="ml-2">
              · 完整度 {Math.round(profile.evidenceCoverage * 100)}/100
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-2">
          {/* 全部 */}
          <button
            onClick={() => setActiveDomain(null)}
            className={`flex flex-col items-center gap-1 rounded-lg border p-3 text-center transition-all hover:bg-accent ${
              activeDomain === null
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-border'
            }`}
          >
            <BookOpen className="h-5 w-5" />
            <span className="text-xs font-medium">全部</span>
            <span className="text-xs text-muted-foreground">{totalCount}</span>
          </button>

          {DOMAIN_ORDER.map((d) => {
            const Icon = DOMAIN_ICONS[d]
            const meta = DOMAIN_META[d]
            const count = domainCounts[d] ?? 0
            const isActive = activeDomain === d

            return (
              <Tooltip key={d} content={`${meta.name}: ${meta.description}`} side="bottom">
                <button
                  onClick={() => setActiveDomain(d)}
                  className={`flex flex-col items-center gap-1 rounded-lg border p-3 text-center transition-all hover:bg-accent ${
                    isActive
                      ? 'border-primary bg-primary/5 text-primary'
                      : count === 0
                      ? 'border-border opacity-40'
                      : 'border-border'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-xs font-medium">{d}</span>
                  <span className="text-xs text-muted-foreground">{count}</span>
                </button>
              </Tooltip>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================================
// 子组件：筛选栏
// ============================================================

function FilterBar(): React.JSX.Element {
  const filter = useProfileStore(selectFilter)
  const setFilter = useProfileStore((state) => state.setFilter)
  const resetFilter = useProfileStore((state) => state.resetFilter)
  const items = useProfileStore(selectItems)

  const availableSources = useMemo(() => {
    const sources = new Set<string>()
    for (const item of items) sources.add(item.source)
    return Array.from(sources).sort()
  }, [items])

  const hasActiveFilter =
    filter.itemType ||
    filter.sentiment ||
    (filter.minQuality ?? 0) > 0 ||
    (filter.keyword ?? '').trim() ||
    filter.source

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Filter className="h-4 w-4" />
          筛选
          {hasActiveFilter && (
            <Badge variant="secondary" className="ml-auto">
              已筛选
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜索标题/摘要/标签..."
            value={filter.keyword ?? ''}
            onChange={(e) => setFilter({ keyword: e.target.value })}
            className="pl-9"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Select
            value={filter.itemType ?? ''}
            onValueChange={(v) => setFilter({ itemType: v ? (v as ProfileItem['itemType']) : undefined })}
          >
            <SelectItem value="">全部类型</SelectItem>
            {Object.entries(ITEM_TYPE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </Select>

          <Select
            value={filter.sentiment ?? ''}
            onValueChange={(v) => setFilter({ sentiment: v ? (v as SentimentLabel) : undefined })}
          >
            <SelectItem value="">全部情绪</SelectItem>
            <SelectItem value="positive">正面</SelectItem>
            <SelectItem value="negative">负面</SelectItem>
            <SelectItem value="neutral">中性</SelectItem>
          </Select>
        </div>

        <div>
          <label className="mb-1 block text-xs text-muted-foreground">
            最低质量分: {filter.minQuality ?? 0}
          </label>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={filter.minQuality ?? 0}
            onChange={(e) => setFilter({ minQuality: Number(e.target.value) })}
            className="w-full accent-primary"
          />
        </div>

        {availableSources.length > 0 && (
          <Select
            value={filter.source ?? ''}
            onValueChange={(v) => setFilter({ source: v || undefined })}
          >
            <SelectItem value="">全部来源</SelectItem>
            {availableSources.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </Select>
        )}

        {hasActiveFilter && (
          <Button
            variant="ghost"
            size="sm"
            onClick={resetFilter}
            className="w-full"
          >
            重置筛选
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================================
// 子组件：资料卡片
// ============================================================

function ItemCard({ item }: { item: ProfileItem }): React.JSX.Element {
  const selectItem = useProfileStore((state) => state.selectItem)
  const selectedItemId = useProfileStore(selectSelectedItemId)
  const isSelected = selectedItemId === item.id
  const meta = DOMAIN_META[item.domain]

  const Icon = DOMAIN_ICONS[item.domain]
  const sentiment = item.sentiment ? SENTIMENT_LABELS[item.sentiment] : null
  const typeLabel = ITEM_TYPE_LABELS[item.itemType] ?? item.itemType

  return (
    <div
      onClick={() => selectItem(item.id)}
      className={`cursor-pointer rounded-lg border p-4 transition-all hover:border-primary/50 hover:bg-accent/30 ${
        isSelected ? 'border-primary bg-primary/5' : 'border-border'
      }`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">
            {item.domain} · {meta.name}
          </span>
        </div>
        {item.qualityScore != null && (
          <span className={`text-xs font-semibold ${qualityColor(item.qualityScore)}`}>
            {item.qualityScore}分
          </span>
        )}
      </div>

      <h4 className="mb-2 line-clamp-2 text-sm font-medium leading-snug">
        {item.title}
      </h4>

      <p className="mb-3 line-clamp-2 text-xs text-muted-foreground">
        {item.summary}
      </p>

      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
          {typeLabel}
        </Badge>
        {sentiment && (
          <Badge variant={sentiment.variant} className="text-[10px] px-1.5 py-0">
            {sentiment.text}
          </Badge>
        )}
        {item.isBookmarked && (
          <Star className={`h-3 w-3 fill-amber-400 ${twText('amber', 400)}`} />
        )}
        <span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          {formatDate(item.publishedAt)}
        </span>
      </div>
    </div>
  )
}

// ============================================================
// 子组件：资料列表
// ============================================================

function ItemList(): React.JSX.Element {
  const items = useProfileStore(selectItems)
  const loading = useProfileStore(selectItemsLoading)
  const symbol = useProfileStore(selectSymbol)
  const activeDomain = useProfileStore(selectActiveDomain)
  const refreshItems = useProfileStore((state) => state.refreshItems)

  if (!symbol) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <BookOpen className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">请先选择一只股票</p>
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="rounded-lg border p-4">
              <Skeleton className="mb-2 h-4 w-24" />
              <Skeleton className="mb-2 h-5 w-full" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <FileText className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm font-medium">暂无资料</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {activeDomain ? `${activeDomain} 域暂无资料` : '该股票暂无任何资料'}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => void refreshItems()}
          >
            <RefreshCw className="mr-1.5 h-3 w-3" />
            刷新
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">
          资料列表
          <Badge variant="secondary" className="ml-2">
            {items.length} 条
          </Badge>
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={() => void refreshItems()}>
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </CardHeader>
      <CardContent>
        <div className="max-h-[calc(100vh-320px)] space-y-2 overflow-y-auto pr-1">
          {items.map((item) => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================================
// 子组件：资料详情面板（右侧 Sheet）
// ============================================================

function DetailPanel(): React.JSX.Element {
  const selectedItemId = useProfileStore(selectSelectedItemId)
  const selectItem = useProfileStore((state) => state.selectItem)
  const selectedItem = useProfileStore(selectSelectedItem)
  const evidence = useProfileStore(selectEvidence)

  const itemEvidence = useMemo(() => {
    if (!selectedItemId) return []
    return evidence.filter((e) => e.profileItemId === selectedItemId)
  }, [evidence, selectedItemId])

  if (!selectedItem) {
    return (
      <Sheet open={selectedItemId !== null} onOpenChange={(open) => !open && selectItem(null)} side="right">
        <SheetContent className="w-[480px] sm:w-[560px]">
          <div className="flex h-full flex-col items-center justify-center text-center">
            <FileText className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">选择一条资料查看详情</p>
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  const item = selectedItem
  const meta = DOMAIN_META[item.domain]
  const Icon = DOMAIN_ICONS[item.domain]
  const sentiment = item.sentiment ? SENTIMENT_LABELS[item.sentiment] : null
  const typeLabel = ITEM_TYPE_LABELS[item.itemType] ?? item.itemType

  return (
    <Sheet open={selectedItemId !== null} onOpenChange={(open) => !open && selectItem(null)} side="right">
      <SheetContent className="w-[480px] sm:w-[560px]">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium text-muted-foreground">
              {item.domain} · {meta.name}
            </span>
            <Badge variant="outline" className="ml-auto">{typeLabel}</Badge>
            {sentiment && <Badge variant={sentiment.variant}>{sentiment.text}</Badge>}
          </div>
          <SheetTitle className="mt-2 text-lg">{item.title}</SheetTitle>
          <SheetDescription>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {item.source}
                {item.author ? ` · ${item.author}` : ''}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDateTime(item.publishedAt)}
              </span>
              {item.qualityScore != null && (
                <span className={`font-semibold ${qualityColor(item.qualityScore)}`}>
                  质量 {item.qualityScore}/100
                </span>
              )}
            </div>
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex-1 overflow-y-auto pr-1">
          <Tabs defaultValue="content">
            <TabsList>
              <TabsTrigger value="content">内容</TabsTrigger>
              <TabsTrigger value="evidence">证据链 ({itemEvidence.length})</TabsTrigger>
              <TabsTrigger value="tags">标签</TabsTrigger>
              <TabsTrigger value="refs">引用</TabsTrigger>
            </TabsList>

            <TabsContent value="content" className="mt-4 space-y-4">
              <div>
                <h4 className="mb-2 text-sm font-medium">摘要</h4>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {item.summary}
                </p>
              </div>

              {item.keyPoints && item.keyPoints.length > 0 && (
                <div>
                  <h4 className="mb-2 text-sm font-medium">核心观点</h4>
                  <ul className="space-y-1.5">
                    {item.keyPoints.map((point, i) => (
                      <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                        <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {item.relatedLayers && item.relatedLayers.length > 0 && (
                <div>
                  <h4 className="mb-2 text-sm font-medium">关联评分层</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {item.relatedLayers.map((layer) => (
                      <Badge key={layer} variant="secondary" className="text-xs">
                        {LAYER_NAMES[layer] ?? layer}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <Separator />

              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {item.sourceUrl && (
                  <a
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-primary hover:underline"
                  >
                    <Link2 className="h-3 w-3" />
                    查看原文
                  </a>
                )}
                {item.originalStore && (
                  <span className="flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    存储: {item.originalStore}
                  </span>
                )}
                {item.isUserGenerated && (
                  <Badge variant="secondary">用户生成</Badge>
                )}
              </div>
            </TabsContent>

            <TabsContent value="evidence" className="mt-4 space-y-3">
              {itemEvidence.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  该资料暂无直接关联的评分证据
                </p>
              ) : (
                itemEvidence.map((ev) => (
                  <div key={ev.id} className="rounded-lg border p-3">
                    <div className="mb-1 flex items-center justify-between">
                      <Badge variant="outline" className="text-xs">
                        {LAYER_NAMES[ev.layer] ?? ev.layer}
                      </Badge>
                      <span
                        className={`text-xs font-medium ${
                          signedContribution(ev) > 0
                            ? twText('emerald', 600)
                            : signedContribution(ev) < 0
                            ? twText('rose', 600)
                            : 'text-muted-foreground'
                        }`}
                      >
                        {signedContribution(ev) > 0 ? '+' : ''}
                        {signedContribution(ev).toFixed(2)}
                      </span>
                    </div>
                    <p className="text-sm">{ev.description}</p>
                    {ev.metricValue != null && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        值: {ev.metricValue}
                      </p>
                    )}
                    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                      <span>权重: {(ev.weight * 100).toFixed(0)}%</span>
                      <span>·</span>
                      <span>{ev.evidenceType}</span>
                    </div>
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="tags" className="mt-4 space-y-3">
              {item.topicTags && item.topicTags.length > 0 ? (
                <div>
                  <h4 className="mb-2 text-sm font-medium">主题标签</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {item.topicTags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        <Tag className="mr-1 h-3 w-3" />
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  暂无标签
                </p>
              )}

              {item.dataQuality && (
                <div>
                  <h4 className="mb-2 text-sm font-medium">数据质量</h4>
                  <Badge variant={item.dataQuality === 'high' ? 'success' : item.dataQuality === 'medium' ? 'warning' : 'secondary'}>
                    {item.dataQuality === 'high' ? '高可信度' : item.dataQuality === 'medium' ? '中可信度' : '低可信度'}
                  </Badge>
                </div>
              )}

              {item.evidenceWeight != null && (
                <div>
                  <h4 className="mb-2 text-sm font-medium">证据权重</h4>
                  <Progress value={Math.round(item.evidenceWeight * 100)} max={100} showMax={false} />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {(item.evidenceWeight * 100).toFixed(0)}%
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="refs" className="mt-4 space-y-3">
              {item.crossReferences && item.crossReferences.length > 0 ? (
                <div>
                  <h4 className="mb-2 text-sm font-medium">引用的资料</h4>
                  <div className="space-y-2">
                    {item.crossReferences.map((ref, i) => (
                      <div key={i} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                        <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground">{ref.relation}</span>
                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                        <span className="truncate">{ref.targetId.slice(0, 8)}...</span>
                        {ref.description && (
                          <Tooltip content={ref.description}>
                            <AlertCircle className="h-3.5 w-3.5 text-muted-foreground" />
                          </Tooltip>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  暂无交叉引用
                </p>
              )}

              {item.evidenceIds && item.evidenceIds.length > 0 && (
                <div>
                  <h4 className="mb-2 text-sm font-medium">被引用</h4>
                  <p className="text-sm text-muted-foreground">
                    被 {item.evidenceIds.length} 条证据引用
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ============================================================
// 子组件：证据链总览
// ============================================================

function EvidenceOverview(): React.JSX.Element {
  const evidence = useProfileStore(selectEvidence)
  // @compliance AGENTS.md §二 铁律：getSnapshot 必须缓存——订阅原始 evidence 字段，
  // 用 useMemo 调用纯函数 groupEvidenceByLayer 派生，避免 selector 每次返回新对象。
  const evidenceByLayer = useMemo(() => groupEvidenceByLayer(evidence), [evidence])
  const symbol = useProfileStore(selectSymbol)
  const loading = useProfileStore((state) => state.evidenceLoading)

  if (!symbol) {
    return <></>
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    )
  }

  const layers = Object.keys(evidenceByLayer) as ScoreLayerId[]

  if (layers.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            评分证据链
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center py-8 text-center">
          <AlertCircle className="mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">暂无评分证据</p>
        </CardContent>
      </Card>
    )
  }

  // 按层计算总贡献
  const layerStats = layers.map((layer) => {
    const evs = evidenceByLayer[layer] ?? []
    const totalContribution = evs.reduce((sum, e) => sum + signedContribution(e), 0)
    const positive = evs.filter((e) => signedContribution(e) > 0).length
    const negative = evs.filter((e) => signedContribution(e) < 0).length
    return { layer, totalContribution, positive, negative, count: evs.length }
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          评分证据链
          <Badge variant="secondary" className="ml-1">
            {evidence.length} 条
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {layerStats.map(({ layer, totalContribution, positive, negative, count }) => (
          <div key={layer} className="rounded-lg border p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium">{LAYER_NAMES[layer] ?? layer}</span>
              <div className="flex items-center gap-2">
                {positive > 0 && (
                  <span className={`flex items-center gap-0.5 text-xs ${twText('emerald', 600)}`}>
                    <TrendingUp className="h-3 w-3" />
                    {positive}
                  </span>
                )}
                {negative > 0 && (
                  <span className={`flex items-center gap-0.5 text-xs ${twText('rose', 600)}`}>
                    <TrendingDown className="h-3 w-3" />
                    {negative}
                  </span>
                )}
                <span
                  className={`text-xs font-semibold ${
                    totalContribution > 0
                      ? twText('emerald', 600)
                      : totalContribution < 0
                      ? twText('rose', 600)
                      : 'text-muted-foreground'
                  }`}
                >
                  {totalContribution > 0 ? '+' : ''}
                  {totalContribution.toFixed(2)}
                </span>
              </div>
            </div>
            <div className="flex gap-0.5">
              {(evidenceByLayer[layer] ?? [])
                .slice()
                .sort((a, b) => Math.abs(signedContribution(b)) - Math.abs(signedContribution(a)))
                .slice(0, 10)
                .map((ev) => (
                  <Tooltip key={ev.id} content={ev.description} side="top">
                    <div
                      className={`h-6 flex-1 rounded-sm ${
                        signedContribution(ev) > 0
                          ? 'bg-emerald-500/60'
                          : signedContribution(ev) < 0
                          ? 'bg-rose-500/60'
                          : 'bg-muted'
                      }`}
                      style={{ opacity: 0.4 + Math.abs(signedContribution(ev)) * 0.6 }}
                    />
                  </Tooltip>
                ))}
            </div>
            <p className="mt-1.5 text-[10px] text-muted-foreground">
              {count} 条证据 · 贡献度条形图
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

// ============================================================
// 主页面
// ============================================================

export default function ProfileBrowsePage(): React.JSX.Element {
  return (
    <ErrorBoundary>
      <PageContainer centered={false} className="px-4 py-4">
        <PageHeader
          title={
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              八域资料浏览
            </div>
          }
          description="按八个研究领域组织个股资料，追溯评分证据链"
          actions={<StockSelector />}
        />

        <div className="mt-4 grid grid-cols-12 gap-4">
          {/* 左侧：八域导航 + 筛选 */}
          <div className="col-span-12 space-y-4 md:col-span-3">
            <DomainNav />
            <FilterBar />
            <EvidenceOverview />
          </div>

          {/* 中间/右侧：资料列表 */}
          <div className="col-span-12 md:col-span-9">
            <ItemList />
          </div>
        </div>

        {/* 详情面板（右侧抽屉） */}
        <DetailPanel />
      </PageContainer>
    </ErrorBoundary>
  )
}
