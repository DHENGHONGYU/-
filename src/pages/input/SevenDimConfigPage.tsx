/**
 * @module SevenDimConfigPage
 * @description 七维采集配置页。
 *
 * 参考V6 Pro SevenDimCollectPage.tsx设计，适配V9架构：
 * - 5个策略模板卡片（价值/成长/防御/周期/全维度）
 * - 8个采集维度开关面板（含频率/数据源/存储策略）
 * - 全局参数配置（标的数/历史天数）
 * - 额度预估仪表盘
 * - 保存配置与执行采集操作
 *
 * @see V6 Pro: cockpit-app/src/pages/SevenDimCollectPage.tsx
 * @see V6 Pro: cockpit-app/src/components/collect/CollectParamPanel.tsx
 */

import { useMemo } from 'react'
import { Link } from 'react-router'
import { useSevenDimConfigStore } from '@/store/sevenDimConfigStore'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { getLogger } from '@/lib/logger'
import { COLOR_TOKENS } from '@/constants/theme.tokens'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Switch } from '@/components/ui/Switch'
import { Select, SelectItem } from '@/components/ui/Select'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Progress } from '@/components/ui/Progress'
import { Separator } from '@/components/ui/Separator'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/Breadcrumb'
import {
  STRATEGY_TEMPLATES,
  DEFAULT_DIMENSIONS,
  FREQUENCY_LABELS,
  DATA_SOURCE_LABELS,
  STORAGE_TYPE_LABELS,
  IMPORTANCE_LABELS,
  IMPORTANCE_BADGE_VARIANT,
  DIMENSION_COLORS,
  GLOBAL_LIMITS,
  type StrategyTemplateId,
  type UpdateFrequency,
  type DataSourceType,
} from '@/config/collectConfig'

const logger = getLogger()

// ============================================================
// 策略模板颜色映射（引用 constants/theme.tokens，不硬编码颜色值）
// ============================================================

/** 策略模板 → 颜色 token 映射，用于卡片边框与高亮标识 */
const STRATEGY_COLOR_TOKEN: Record<StrategyTemplateId, keyof typeof COLOR_TOKENS> = {
  value: 'info',       // 价值投资 → 蓝色
  growth: 'success',   // 成长投资 → 绿色
  defense: 'warning',  // 防御策略 → 橙色
  cycle: 'purple',     // 周期轮动 → 紫色
  full: 'danger',      // 全维度 → 红色
}

// ============================================================
// 策略模板卡片
// ============================================================

interface StrategyCardProps {
  templateId: StrategyTemplateId
  name: string
  description: string
  dimensionCount: number
  isActive: boolean
  disabled: boolean
  onSelect: () => void
}

function StrategyCard({
  templateId,
  name,
  description,
  dimensionCount,
  isActive,
  disabled,
  onSelect,
}: StrategyCardProps) {
  const colorToken = COLOR_TOKENS[STRATEGY_COLOR_TOKEN[templateId]]
  return (
    <Card
      className={`cursor-pointer transition-all duration-200 ${
        isActive ? 'ring-2 ring-primary/20' : 'hover:shadow-md'
      } ${disabled ? 'pointer-events-none opacity-50' : ''}`}
      style={{ borderColor: colorToken.hex, borderWidth: isActive ? 2 : 1 }}
      onClick={onSelect}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: colorToken.hex }}
            />
            <CardTitle className="text-base">{name}</CardTitle>
          </div>
          {isActive && <Badge>当前</Badge>}
        </div>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          {dimensionCount} 个维度
        </p>
      </CardContent>
    </Card>
  )
}

// ============================================================
// 维度配置行
// ============================================================

interface DimensionRowProps {
  code: string
  name: string
  enabled: boolean
  frequency: UpdateFrequency
  sources: DataSourceType[]
  storageType: string
  importance: string
  fields: string[]
  disabled: boolean
  onToggle: () => void
  onFrequencyChange: (frequency: UpdateFrequency) => void
  onSourcesChange: (sources: DataSourceType[]) => void
}

function DimensionRow({
  code,
  name,
  enabled,
  frequency,
  sources,
  storageType,
  importance,
  fields,
  disabled,
  onToggle,
  onFrequencyChange,
  onSourcesChange,
}: DimensionRowProps) {
  const colorBar = DIMENSION_COLORS[code] ?? 'bg-gray-400'

  return (
    <div className="flex items-start gap-3 py-3 transition-all duration-200">
      {/* 维度色块 */}
      <div className={`mt-1 h-3 w-3 shrink-0 rounded-full transition-all duration-200 ${colorBar}`} />

      {/* 开关 */}
      <div className="mt-0.5 transition-all duration-200">
        <Switch
          checked={enabled}
          onChange={onToggle}
          disabled={disabled}
        />
      </div>

      {/* 维度信息 */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{code} · {name}</span>
          <Badge variant={IMPORTANCE_BADGE_VARIANT[importance as keyof typeof IMPORTANCE_BADGE_VARIANT]}>
            {IMPORTANCE_LABELS[importance as keyof typeof IMPORTANCE_LABELS]}
          </Badge>
        </div>
        {enabled ? (
          <div className="mt-2 space-y-2">
            {/* 频率下拉 + 存储策略（静态） */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-muted-foreground">频率</span>
              <Select
                value={frequency}
                disabled={disabled}
                onChange={(e) => onFrequencyChange(e.target.value as UpdateFrequency)}
                className="h-7 w-28 py-1 text-xs"
              >
                {(Object.keys(FREQUENCY_LABELS) as UpdateFrequency[]).map((freq) => (
                  <SelectItem key={freq} value={freq}>
                    {FREQUENCY_LABELS[freq]}
                  </SelectItem>
                ))}
              </Select>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">
                存储: {STORAGE_TYPE_LABELS[storageType as keyof typeof STORAGE_TYPE_LABELS]}
              </span>
            </div>
            {/* 数据源多选标签 */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted-foreground">数据源</span>
              {(Object.keys(DATA_SOURCE_LABELS) as DataSourceType[]).map((src) => {
                const active = sources.includes(src)
                return (
                  <Badge
                    key={src}
                    variant={active ? 'default' : 'outline'}
                    className={
                      disabled
                        ? 'pointer-events-none opacity-50 text-[10px]'
                        : 'cursor-pointer text-[10px] hover:scale-105'
                    }
                    onClick={() => {
                      if (disabled) return
                      const next = active
                        ? sources.filter((s) => s !== src)
                        : [...sources, src]
                      onSourcesChange(next)
                    }}
                  >
                    {DATA_SOURCE_LABELS[src]}
                  </Badge>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span>频率: {FREQUENCY_LABELS[frequency]}</span>
            <span>·</span>
            <span>源: {sources.map((s) => DATA_SOURCE_LABELS[s as keyof typeof DATA_SOURCE_LABELS] ?? s).join(' > ')}</span>
            <span>·</span>
            <span>存储: {STORAGE_TYPE_LABELS[storageType as keyof typeof STORAGE_TYPE_LABELS]}</span>
          </div>
        )}
        {enabled && fields.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {fields.slice(0, 4).map((field) => (
              <span key={field} className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {field}
              </span>
            ))}
            {fields.length > 4 && (
              <span className="text-[10px] text-muted-foreground">+{fields.length - 4}</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================
// 主页面
// ============================================================

export default function SevenDimConfigPage() {
  const store = useSevenDimConfigStore()

  logger.info('[SevenDimConfigPage] 渲染', {
    activeTemplate: store.activeTemplate,
    enabledCount: store.enabledCount(),
    isCollecting: store.isCollecting,
  })

  // 派生状态
  const enabledCount = store.enabledCount()
  const monthlyCalls = store.monthlyCallEstimate()
  const isDisabled = !store.isClickable()
  const tooltipText = store.tooltipText()
  // 额度使用率（基于月调用量 / 日上限×30）
  const quotaUsagePercent = useMemo(
    () => (GLOBAL_LIMITS.rateLimitPerDay > 0
      ? Math.min(100, Math.round((monthlyCalls / (GLOBAL_LIMITS.rateLimitPerDay * 30)) * 100))
      : 0),
    [monthlyCalls],
  )
  // 额度使用率颜色 token：低→蓝，中→琥珀，高→红
  const quotaColorToken = useMemo(() => {
    if (quotaUsagePercent >= 80) return COLOR_TOKENS.danger
    if (quotaUsagePercent >= 50) return COLOR_TOKENS.warning
    return COLOR_TOKENS.info
  }, [quotaUsagePercent])

  // 策略模板维度数映射
  const templateDimCounts = useMemo(() => {
    const map: Record<string, number> = {}
    for (const t of STRATEGY_TEMPLATES) {
      map[t.id] = t.dimensions.length
    }
    return map
  }, [])

  return (
    <ErrorBoundary>
      <div className="space-y-6 p-6">
        {/* 面包屑 */}
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/">首页</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/input">输入舱</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>七维采集配置</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">七维采集配置</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              采集维度 · 策略模板 · 额度预估 · 执行采集
            </p>
          </div>
          <Badge variant="outline">V9 新建</Badge>
        </div>

        {/* 错误提示 */}
        {store.error && (
          <Card className="border-destructive">
            <CardContent className="flex items-center justify-between py-3">
              <span className="text-sm text-destructive">{store.error}</span>
              <Button variant="ghost" size="sm" onClick={store.clearError}>
                关闭
              </Button>
            </CardContent>
          </Card>
        )}

        {/* 采集进度条 */}
        {store.isCollecting && (
          <Card>
            <CardContent className="py-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium">采集中...</span>
                <span className="text-sm text-muted-foreground">{store.collectProgress}%</span>
              </div>
              <Progress value={store.collectProgress} />
            </CardContent>
          </Card>
        )}

        {/* 策略模板选择 */}
        <div>
          <h2 className="mb-3 text-base font-semibold">策略模板</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            {STRATEGY_TEMPLATES.map((template) => (
              <StrategyCard
                key={template.id}
                templateId={template.id}
                name={template.name}
                description={template.description}
                dimensionCount={templateDimCounts[template.id] ?? 0}
                isActive={store.activeTemplate === template.id}
                disabled={isDisabled}
                onSelect={() => store.applyTemplate(template.id)}
              />
            ))}
          </div>
        </div>

        {/* 维度配置 + 参数面板 */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* 左侧：维度开关列表 */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>采集维度</CardTitle>
                    <CardDescription>
                      已启用 {enabledCount} / {DEFAULT_DIMENSIONS.length} 个维度
                    </CardDescription>
                  </div>
                  <Badge variant="secondary">
                    {enabledCount} / {DEFAULT_DIMENSIONS.length}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <Separator />
                {store.dimensions.map((dim) => (
                  <DimensionRow
                    key={dim.code}
                    code={dim.code}
                    name={dim.name}
                    enabled={dim.enabled}
                    frequency={dim.frequency}
                    sources={dim.sources}
                    storageType={dim.storageType}
                    importance={dim.importance}
                    fields={dim.fields}
                    disabled={isDisabled}
                    onToggle={() => store.toggleDimension(dim.code)}
                    onFrequencyChange={(freq) => {
                      logger.info(`[SevenDimConfigPage] 维度 ${dim.code} 频率变更`, {
                        from: dim.frequency,
                        to: freq,
                      })
                      store.setDimensionFrequency(dim.code, freq)
                    }}
                    onSourcesChange={(nextSources) => {
                      logger.info(`[SevenDimConfigPage] 维度 ${dim.code} 数据源变更`, {
                        from: dim.sources,
                        to: nextSources,
                      })
                      store.setDimensionSources(dim.code, nextSources)
                    }}
                  />
                ))}
              </CardContent>
            </Card>
          </div>

          {/* 右侧：参数配置 + 额度预估 */}
          <div className="space-y-4">
            {/* 全局参数 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">全局参数</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="symbolCount">标的数量</Label>
                  <Input
                    id="symbolCount"
                    type="number"
                    min={1}
                    max={GLOBAL_LIMITS.maxSymbols}
                    value={store.symbolCount}
                    disabled={isDisabled}
                    onChange={(e) => store.setSymbolCount(Number(e.target.value) || 0)}
                  />
                  <p className="text-xs text-muted-foreground">
                    上限 {GLOBAL_LIMITS.maxSymbols}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="historyDays">历史天数</Label>
                  <Input
                    id="historyDays"
                    type="number"
                    min={1}
                    max={1000}
                    value={store.historyDays}
                    disabled={isDisabled}
                    onChange={(e) => store.setHistoryDays(Number(e.target.value) || 0)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* 额度预估 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">额度预估</CardTitle>
                <CardDescription>基于当前配置的月调用估算</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">月调用总量</span>
                  <span className="text-lg font-bold">{monthlyCalls.toLocaleString()}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">日调用上限</span>
                  <span className="text-sm">{GLOBAL_LIMITS.rateLimitPerDay}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">小时调用上限</span>
                  <span className="text-sm">{GLOBAL_LIMITS.rateLimitPerHour}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">AKShare 额度</span>
                  <Badge variant="secondary">免费无限</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">额度使用率</span>
                  <span className="text-sm font-medium" style={{ color: quotaColorToken.hex }}>
                    {quotaUsagePercent}%
                  </span>
                </div>
                {/* 额度使用率可视化进度条 */}
                <div className="space-y-1">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${quotaUsagePercent}%`, backgroundColor: quotaColorToken.hex }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    月调用 {monthlyCalls.toLocaleString()} / 日上限×30 {(GLOBAL_LIMITS.rateLimitPerDay * 30).toLocaleString()}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* 操作按钮 */}
            <div className="space-y-2">
              <Button
                className="w-full"
                onClick={() => store.runCollection()}
                disabled={isDisabled || enabledCount === 0}
              >
                {store.isCollecting ? '采集中...' : '开始采集'}
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => store.saveConfig()}
                disabled={isDisabled || !store.isDirty}
              >
                {store.isSaving ? '保存中...' : '保存配置'}
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => store.reset()}
                disabled={isDisabled}
              >
                重置为默认
              </Button>
            </div>

            {/* 不可交互提示 */}
            {isDisabled && tooltipText && (
              <p className="text-center text-xs text-muted-foreground">{tooltipText}</p>
            )}
          </div>
        </div>
      </div>
    </ErrorBoundary>
  )
}
