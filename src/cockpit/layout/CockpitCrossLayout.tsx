/**
 * @module cockpit/layout/CockpitCrossLayout
 * @description 驾驶舱纵横交叉布局骨架
 *
 * 纵轴（业务域）：research | market | ai | portfolio
 * 横轴（视角）：overview | analysis | signal | risk
 *
 * 引用现有组件：
 * - Tabs / TabsList / TabsTrigger（`@/components/molecules/Tabs`）→ 视角切换
 * - COCKPIT_LAYOUT 间距令牌（`@/constants/cockpit.constants`）
 * - WidgetDomain / WidgetPerspective 类型（`@/types/modules/widget.types`）
 *
 * 设计原则：不重写原子组件，仅做排列组合与重新引用
 */

import { useMemo, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Tabs, TabsList, TabsTrigger } from '@/components/molecules/Tabs'
import { COCKPIT_LAYOUT, COCKPIT_CROSS_DOMAINS, COCKPIT_CROSS_PERSPECTIVES, DRAWER_WIDGETS } from '@/constants/cockpit.constants'
import type { WidgetConfig, WidgetDomain, WidgetPerspective } from '@/types/modules/widget.types'
import { widgetRegistry } from '@/cockpit/core/widgetRegistry'
import { CrossMatrixOverview } from './CrossMatrixOverview'
import { WidgetSheetDrawer } from './WidgetSheetDrawer'

// ============================================================
// 常量定义
// ============================================================

// 业务域/视角展示元数据统一从 cockpit.constants.ts 导入（COCKPIT_CROSS_DOMAINS / COCKPIT_CROSS_PERSPECTIVES），
// 避免与 CrossMatrixOverview 双处定义漂移

// ============================================================
// 组件 Props
// ============================================================

export interface CockpitCrossLayoutProps {
  /** 全部 Widget 实例 */
  instances: WidgetConfig[]
  /** 单个 Widget 渲染回调（由 CockpitShell 传入 WidgetWrapper） */
  renderWidget: (instance: WidgetConfig) => ReactNode
  /** 是否显示矩阵总览首屏（默认 true） */
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
 * 纵横交叉布局：左轨业务域 × 顶部视角 Tab → 交叉点 Widget 网格
 */
export function CockpitCrossLayout({
  instances,
  renderWidget,
  showMatrixOverview = true,
  onMatrixCellClick,
  className,
}: CockpitCrossLayoutProps) {
  const [activeDomain, setActiveDomain] = useState<WidgetDomain>('market')
  const [activePerspective, setActivePerspective] = useState<WidgetPerspective>('overview')
  const [matrixVisible, setMatrixVisible] = useState(showMatrixOverview)

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
        counts.set(key, (counts.get(key) || 0) + 1)
      }
    }
    return counts
  }, [instances, instanceMetaMap])

  /** 各业务域 Widget 计数（左轨徽标，预计算避免每次 render 重算） */
  const domainCounts = useMemo(() => {
    const counts = new Map<WidgetDomain, number>()
    for (const inst of instances) {
      const meta = instanceMetaMap.get(inst.instanceId)
      if (meta?.domain) {
        counts.set(meta.domain, (counts.get(meta.domain) || 0) + 1)
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
    <div className={cn('flex h-full', className)}>
      {/* ───── 左轨：业务域 Rail ───── */}
      <aside
        className="flex w-48 shrink-0 flex-col border-r bg-card/50"
        style={{ paddingTop: COCKPIT_LAYOUT.SECTION_GAP }}
      >
        {/* 矩阵总览切换 */}
        <button
          type="button"
          onClick={() => setMatrixVisible((v) => !v)}
          className={cn(
            'mx-3 mb-3 rounded-md px-3 py-2 text-left text-xs font-medium transition-colors',
            matrixVisible
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:bg-muted',
          )}
        >
          {matrixVisible ? '◉ 矩阵总览' : '○ 矩阵总览'}
        </button>

        {/* 域列表 */}
        <nav className="flex flex-col gap-1 px-3">
          {COCKPIT_CROSS_DOMAINS.map((domain) => {
            const isActive = activeDomain === domain.id
            const domainCount = domainCounts.get(domain.id) || 0

            return (
              <button
                key={domain.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => setActiveDomain(domain.id)}
                className={cn(
                  'flex items-center justify-between rounded-md px-3 py-2.5 text-left text-sm transition-all',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-foreground hover:bg-muted',
                )}
              >
                <span className="flex items-center gap-2">
                  <span className="text-base">{domain.icon}</span>
                  {domain.label}
                </span>
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.5 text-xs',
                    isActive ? 'bg-primary-foreground/20' : 'bg-muted',
                  )}
                >
                  {domainCount}
                </span>
              </button>
            )
          })}
        </nav>

        {/* 底部说明 */}
        <div className="mt-auto p-3 text-xs text-muted-foreground">
          <p>纵轴：业务域</p>
          <p>横轴：视角</p>
          <p className="mt-1">点击矩阵总览可快速定位</p>
        </div>
      </aside>

      {/* ───── 主内容区 ───── */}
      <div
        className="flex flex-1 flex-col overflow-hidden"
        style={{ paddingLeft: COCKPIT_LAYOUT.ZONE_PADDING }}
      >
        {/* 视角 Tab（横轴） */}
        <Tabs
          value={activePerspective}
          onValueChange={(v) => setActivePerspective(v as WidgetPerspective)}
          className="shrink-0"
        >
          <TabsList className="h-9">
            {COCKPIT_CROSS_PERSPECTIVES.map((p) => {
              const key = `${activeDomain}:${p.id}`
              const count = matrixCounts.get(key) || 0
              return (
                <TabsTrigger
                  key={p.id}
                  value={p.id}
                  disabled={count === 0}
                  className="gap-1.5 text-xs"
                >
                  {p.label}
                  {count > 0 && (
                    <span className="rounded-full bg-muted-foreground/20 px-1 text-[10px]">
                      {count}
                    </span>
                  )}
                </TabsTrigger>
              )
            })}
          </TabsList>
        </Tabs>

        {/* 内容区域：矩阵总览 or Widget 网格 */}
        <div
          className="flex-1 overflow-y-auto"
          style={{ paddingTop: COCKPIT_LAYOUT.SECTION_HEADER_GAP }}
        >
          {matrixVisible ? (
            <CrossMatrixOverview
              matrixCounts={matrixCounts}
              activeDomain={activeDomain}
              activePerspective={activePerspective}
              onCellClick={handleMatrixClick}
            />
          ) : crossInstances.length === 0 ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <div className="text-center">
                <p className="text-lg font-medium">当前交叉点无 Widget</p>
                <p className="mt-1 text-sm">
                  {COCKPIT_CROSS_DOMAINS.find((d) => d.id === activeDomain)?.label} ×{' '}
                  {COCKPIT_CROSS_PERSPECTIVES.find((p) => p.id === activePerspective)?.label}
                </p>
                <button
                  type="button"
                  onClick={() => setMatrixVisible(true)}
                  className="mt-3 text-sm text-primary hover:underline"
                >
                  查看矩阵总览选择其他交叉点
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4" style={{ gap: COCKPIT_LAYOUT.SECTION_HEADER_GAP }}>
              {/* 网格型 Widget */}
              {gridInstances.length > 0 && (
                <div
                  className="grid grid-cols-1 gap-4 lg:grid-cols-2"
                  style={{ gap: COCKPIT_LAYOUT.WIDGET_GAP }}
                >
                  {gridInstances.map((instance) => (
                    <div key={instance.instanceId} className="min-h-0">
                      {renderWidget(instance)}
                    </div>
                  ))}
                </div>
              )}

              {/* 抽屉型 Widget 触发卡片 */}
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
    </div>
  )
}
