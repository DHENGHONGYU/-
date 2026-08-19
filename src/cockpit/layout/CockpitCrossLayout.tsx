/**
 * @module cockpit/layout/CockpitCrossLayout
 * @description 驾驶舱主布局（投资者决策三页模式）
 *
 * 整合原双视图（结果视图/技术矩阵）与四用户场景分散区块，
 * 按投资使用者决策路径重组为三页 Tab：
 *
 *   1. 🎯 今日决策   — 信号、事件、情绪（盘前需不需要动）
 *   2. 💼 我的组合   — 持仓、盈亏、风险、自选（我的资产怎么样）
 *   3. 🧭 市场与机会 — 全景、策略池、AI 深度工具（下一步做什么）
 *
 * 保留的基础设施：
 * - CrossMatrixOverview（域×视角交叉矩阵）：以「钻取 → 矩阵」方式保留
 * - Tabs / TabsList / TabsTrigger：用于视角切换（在市场页交叉钻取内）
 * - 所有间距令牌（COCKPIT_LAYOUT）
 */

import { useMemo, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import {
  COCKPIT_LAYOUT,
  COCKPIT_CROSS_DOMAINS,
  COCKPIT_CROSS_PERSPECTIVES,
  DRAWER_WIDGETS,
} from '@/constants/cockpit.constants'
import type { WidgetConfig, WidgetDomain, WidgetPerspective } from '@/types/modules/widget.types'
import { widgetRegistry } from '@/cockpit/core/widgetRegistry'
import { CrossMatrixOverview } from './CrossMatrixOverview'
import { DecisionPagesOverview } from './DecisionPagesOverview'
import { WidgetSheetDrawer } from './WidgetSheetDrawer'

// ============================================================
// 组件 Props
// ============================================================

export interface CockpitCrossLayoutProps {
  /** 全部 Widget 实例 */
  instances: WidgetConfig[]
  /** 单个 Widget 渲染回调（由 CockpitShell 传入 WidgetWrapper） */
  renderWidget: (instance: WidgetConfig) => ReactNode
  /** 矩阵总览在钻取模式下是否默认展开（默认 true） */
  showMatrixOverview?: boolean
  /** 矩阵单元格点击回调 */
  onMatrixCellClick?: (domain: WidgetDomain, perspective: WidgetPerspective) => void
  /** 自定义类名 */
  className?: string
}

// ============================================================
// 主组件
// ============================================================

/**
 * CockpitCrossLayout
 *
 * 顶部三 Tab（决策页）+ 钻取抽屉保留技术矩阵视图
 */
export function CockpitCrossLayout({
  instances,
  renderWidget,
  showMatrixOverview = true,
  onMatrixCellClick,
  className,
}: CockpitCrossLayoutProps) {
  // —— 技术钻取：矩阵模式状态（仅当用户从「市场与机会 → 钻取工具 → 打开矩阵」时呈现）
  const [activeDomain, setActiveDomain] = useState<WidgetDomain>('market')
  const [activePerspective, setActivePerspective] = useState<WidgetPerspective>('overview')
  const [matrixVisible, setMatrixVisible] = useState(showMatrixOverview)
  // 是否显示矩阵区块本身（三页模式下默认折叠，用户需要技术分析时可展开）
  const [drillMatrixOpen, setDrillMatrixOpen] = useState(false)

  /** 从 widgetRegistry 获取每个实例的 domain/perspective 元数据 */
  const instanceMetaMap = useMemo(() => {
    const map = new Map<string, { domain?: WidgetDomain; perspective?: WidgetPerspective }>()
    for (const inst of instances) {
      const template = widgetRegistry.getTemplate(inst.widgetId)
      map.set(inst.instanceId, {
        domain: template?.meta.domain,
        perspective: template?.meta.perspective,
      })
    }
    return map
  }, [instances])

  /** 按域×视角分组的实例计数（用于矩阵总览） */
  const matrixCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const inst of instances) {
      const meta = instanceMetaMap.get(inst.instanceId)
      if (meta?.domain && meta?.perspective) {
        const key = `${meta.domain}:${meta.perspective}`
        counts.set(key, (counts.get(key) ?? 0) + 1)
      }
    }
    return counts
  }, [instances, instanceMetaMap])

  /** 按域×视角分组的实例标题（用于矩阵单元格 tooltip） */
  const matrixTitles = useMemo(() => {
    const titles = new Map<string, string[]>()
    for (const inst of instances) {
      const meta = instanceMetaMap.get(inst.instanceId)
      if (meta?.domain && meta?.perspective) {
        const key = `${meta.domain}:${meta.perspective}`
        const arr = titles.get(key) ?? []
        arr.push(inst.title)
        titles.set(key, arr)
      }
    }
    return titles
  }, [instances, instanceMetaMap])

  /** 各业务域 Widget 计数 */
  const domainCounts = useMemo(() => {
    const counts = new Map<WidgetDomain, number>()
    for (const inst of instances) {
      const meta = instanceMetaMap.get(inst.instanceId)
      if (meta?.domain) {
        counts.set(meta.domain, (counts.get(meta.domain) ?? 0) + 1)
      }
    }
    return counts
  }, [instances, instanceMetaMap])

  /** 当前交叉点的 Widget 实例 */
  const crossInstances = useMemo(() => {
    return instances.filter((inst) => {
      const meta = instanceMetaMap.get(inst.instanceId)
      return meta?.domain === activeDomain && meta?.perspective === activePerspective
    })
  }, [instances, instanceMetaMap, activeDomain, activePerspective])

  /** 抽屉型 Widget（重型 Widget 收为 Sheet 触发卡片） */
  const drawerInstances = useMemo(() => {
    return crossInstances.filter((inst) => DRAWER_WIDGETS.has(inst.widgetId))
  }, [crossInstances])

  /** 网格型 Widget（在网格中直接渲染） */
  const gridInstances = useMemo(() => {
    return crossInstances.filter((inst) => !DRAWER_WIDGETS.has(inst.widgetId))
  }, [crossInstances])

  /** 处理矩阵单元格点击 */
  const handleMatrixClick = (domain: WidgetDomain, perspective: WidgetPerspective) => {
    setActiveDomain(domain)
    setActivePerspective(perspective)
    setMatrixVisible(false)
    onMatrixCellClick?.(domain, perspective)
  }

  return (
    <div className={cn('flex h-full min-h-[600px] flex-col', className)}>
      {/* ───── 决策三页（主内容） ───── */}
      <div className="flex-1 overflow-y-auto">
        <DecisionPagesOverview instances={instances} renderWidget={renderWidget} />

        {/* ───── 技术矩阵钻取区（折叠，保留给高级用户 / 调试） ───── */}
        <section className="mt-10 rounded-xl border border-dashed bg-card/50">
          <button
            type="button"
            onClick={() => setDrillMatrixOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left hover:bg-muted/40"
            aria-expanded={drillMatrixOpen}
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">🔬</span>
              <span className="text-sm font-semibold">技术钻取：业务域 × 视角 矩阵</span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                高级
              </span>
            </div>
            <span className="text-xs text-muted-foreground">
              {drillMatrixOpen ? '收起' : '展开'}
            </span>
          </button>

          {drillMatrixOpen && (
            <div className="border-t p-4">
              {/* 域与视角快速切换条 */}
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <div className="flex flex-wrap gap-1">
                  {COCKPIT_CROSS_DOMAINS.map((domain) => {
                    const isActive = activeDomain === domain.id
                    const cnt = domainCounts.get(domain.id) ?? 0
                    return (
                      <button
                        key={domain.id}
                        type="button"
                        aria-pressed={isActive}
                        onClick={() => setActiveDomain(domain.id)}
                        className={cn(
                          'flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs transition-all',
                          isActive
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-foreground hover:bg-muted/70',
                        )}
                      >
                        <span>{domain.icon}</span>
                        <span>{domain.label}</span>
                        <span className={cn(
                          'rounded-full px-1 text-[10px]',
                          isActive ? 'bg-primary-foreground/20' : 'bg-background/80',
                        )}>
                          {cnt}
                        </span>
                      </button>
                    )
                  })}
                </div>
                <div className="mx-1 hidden h-5 w-px bg-border sm:block" />
                <div className="flex flex-wrap gap-1">
                  {COCKPIT_CROSS_PERSPECTIVES.map((p) => {
                    const key = `${activeDomain}:${p.id}`
                    const cnt = matrixCounts.get(key) ?? 0
                    const isActive = activePerspective === p.id
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setActivePerspective(p.id)}
                        className={cn(
                          'rounded-md px-2.5 py-1.5 text-xs transition-all',
                          isActive
                            ? 'bg-primary/15 text-primary ring-1 ring-primary/30'
                            : 'bg-muted text-foreground hover:bg-muted/70',
                        )}
                        disabled={cnt === 0}
                      >
                        {p.label}
                        {cnt > 0 && (
                          <span className="ml-1 rounded-full bg-background/80 px-1 text-[10px] text-muted-foreground">
                            {cnt}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => setMatrixVisible((v) => !v)}
                  className={cn(
                    'ml-auto rounded-md px-2.5 py-1.5 text-xs font-medium',
                    matrixVisible
                      ? 'bg-primary/10 text-primary ring-1 ring-primary/20'
                      : 'text-muted-foreground hover:bg-muted',
                  )}
                >
                  {matrixVisible ? '◉ 矩阵总览' : '○ 矩阵总览'}
                </button>
              </div>

              {/* 钻取区内容 */}
              <div style={{ paddingTop: COCKPIT_LAYOUT.SECTION_HEADER_GAP }}>
                {matrixVisible ? (
                  <CrossMatrixOverview
                    matrixCounts={matrixCounts}
                    matrixTitles={matrixTitles}
                    activeDomain={activeDomain}
                    activePerspective={activePerspective}
                    onCellClick={handleMatrixClick}
                  />
                ) : crossInstances.length === 0 ? (
                  <div className="flex h-full items-center justify-center p-8 text-muted-foreground">
                    <div className="text-center">
                      <p className="text-lg font-medium">当前交叉点无组件</p>
                      <p className="mt-1 text-sm">
                        {COCKPIT_CROSS_DOMAINS.find((d) => d.id === activeDomain)?.label} ×{' '}
                        {COCKPIT_CROSS_PERSPECTIVES.find((p) => p.id === activePerspective)?.label}
                      </p>
                      <button
                        type="button"
                        onClick={() => setMatrixVisible(true)}
                        className="mt-3 text-sm text-primary hover:underline"
                      >
                        打开矩阵总览选择其他交叉点
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {gridInstances.length > 0 && (
                      <div
                        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
                        style={{ gap: COCKPIT_LAYOUT.WIDGET_GAP }}
                      >
                        {gridInstances.map((instance) => (
                          <div key={instance.instanceId} className="min-h-0">
                            {renderWidget(instance)}
                          </div>
                        ))}
                      </div>
                    )}
                    {drawerInstances.length > 0 && (
                      <div
                        className="grid grid-cols-1 gap-3 sm:grid-cols-2"
                        style={{ gap: COCKPIT_LAYOUT.WIDGET_GAP }}
                      >
                        {drawerInstances.map((instance) => (
                          <WidgetSheetDrawer
                            key={instance.instanceId}
                            instance={instance}
                            renderWidget={renderWidget}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

export default CockpitCrossLayout
