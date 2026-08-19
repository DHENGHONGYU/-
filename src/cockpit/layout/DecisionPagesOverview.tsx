/**
 * @module cockpit/layout/DecisionPagesOverview
 * @description 驾驶舱三页整合视图（投资者决策视角）
 *
 * 将原先分散的「用户场景」与「技术矩阵」整合为三页：
 *   • 今日决策 🎯  — 盘前信号、事件、情绪
 *   • 我的组合 💼  — 持仓、盈亏、风险、自选
 *   • 市场与机会 🧭 — 全景、策略池、AI 深度工具
 *
 * 设计原则：
 *  1. 每页 Tab + 次级分组折叠卡，连续滚动不跨页。
 *  2. 按 widgets 声明顺序渲染实例；未声明的 Widget 统一落入
 *     市场与机会 → 深度钻取 fallback。
 *  3. 与 ResultsFirstOverview 的 UserScene 分组兼容（保留常量不删除）。
 */

import { useMemo, useState, type ReactNode, type JSX } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  DECISION_PAGES,
  DECISION_PAGE_DEFAULT,
  DECISION_PAGE_FALLBACK,
  DRAWER_WIDGETS,
  type DecisionPageId,
  type DecisionPageMeta,
} from '@/constants/cockpit.constants'
import type { WidgetConfig } from '@/types/modules/widget.types'
import { WidgetSheetDrawer } from './WidgetSheetDrawer'

export interface DecisionPagesOverviewProps {
  instances: WidgetConfig[]
  renderWidget: (instance: WidgetConfig) => ReactNode
}

interface SectionRenderResult {
  sectionId: string
  label: string
  icon: string
  defaultExpanded: boolean
  /** 常规网格 Widget（直接渲染） */
  grid: WidgetConfig[]
  /** 抽屉型重型 Widget（触发卡片形式） */
  drawer: WidgetConfig[]
}

interface PageRenderResult {
  page: DecisionPageMeta
  total: number
  sections: SectionRenderResult[]
  /** 兜底区（未分配到具体 section 但落到本页） */
  fallback?: SectionRenderResult
}

/**
 * 按 pageId → section.widgets 顺序分配实例；
 * 一个 instance 只能在一个 section 中（首次命中的位置）。
 */
function allocateInstances(
  instances: WidgetConfig[],
): Record<DecisionPageId, PageRenderResult> {
  const allocated = new Set<string>()
  const result = {} as Record<DecisionPageId, PageRenderResult>

  for (const page of DECISION_PAGES) {
    const sections: SectionRenderResult[] = []
    let pageTotal = 0

    for (const section of page.sections) {
      const grid: WidgetConfig[] = []
      const drawer: WidgetConfig[] = []
      const widgetIdOrder = new Map<string, number>()
      section.widgets.forEach((wid, i) => widgetIdOrder.set(wid, i))

      for (const inst of instances) {
        if (allocated.has(inst.instanceId)) continue
        if (!widgetIdOrder.has(inst.widgetId)) continue
        allocated.add(inst.instanceId)
        if (DRAWER_WIDGETS.has(inst.widgetId)) drawer.push(inst)
        else grid.push(inst)
      }

      // 按 section.widgets 声明顺序排序
      const sortFn = (a: WidgetConfig, b: WidgetConfig): number =>
        (widgetIdOrder.get(a.widgetId) ?? 999) - (widgetIdOrder.get(b.widgetId) ?? 999)
      grid.sort(sortFn)
      drawer.sort(sortFn)

      const count = grid.length + drawer.length
      pageTotal += count
      sections.push({
        sectionId: section.id,
        label: section.label,
        icon: section.icon,
        defaultExpanded: section.defaultExpanded,
        grid,
        drawer,
      })
    }

    result[page.id] = { page, sections, total: pageTotal }
  }

  // 兜底：未被任何 section 吸纳的实例 → DECISION_PAGE_FALLBACK
  const fallbackGrid: WidgetConfig[] = []
  const fallbackDrawer: WidgetConfig[] = []
  for (const inst of instances) {
    if (allocated.has(inst.instanceId)) continue
    if (DRAWER_WIDGETS.has(inst.widgetId)) fallbackDrawer.push(inst)
    else fallbackGrid.push(inst)
  }
  if (fallbackGrid.length + fallbackDrawer.length > 0) {
    const fbPage = result[DECISION_PAGE_FALLBACK.page]
    if (fbPage) {
      const section: SectionRenderResult = {
        sectionId: DECISION_PAGE_FALLBACK.section,
        label: '其他组件',
        icon: '📦',
        defaultExpanded: false,
        grid: fallbackGrid,
        drawer: fallbackDrawer,
      }
      // 如果该 section 已存在，合并实例；否则追加
      const existing = fbPage.sections.find((s) => s.sectionId === section.sectionId)
      if (existing) {
        existing.grid = [...existing.grid, ...fallbackGrid]
        existing.drawer = [...existing.drawer, ...fallbackDrawer]
      } else {
        fbPage.sections.push(section)
      }
      fbPage.total += fallbackGrid.length + fallbackDrawer.length
    }
  }

  return result
}

export function DecisionPagesOverview({
  instances,
  renderWidget,
}: DecisionPagesOverviewProps): JSX.Element {
  const [activePage, setActivePage] = useState<DecisionPageId>(DECISION_PAGE_DEFAULT)

  const allocation = useMemo(() => allocateInstances(instances), [instances])

  // 每页 section 展开状态（按页面缓存，切页不丢状态）
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {}
    for (const page of DECISION_PAGES) {
      for (const sec of page.sections) {
        init[`${page.id}:${sec.id}`] = sec.defaultExpanded
      }
      init[`${DECISION_PAGE_FALLBACK.page}:${DECISION_PAGE_FALLBACK.section}`] = false
    }
    return init
  })

  const toggleSection = (pageId: DecisionPageId, sectionId: string): void => {
    const key = `${pageId}:${sectionId}`
    setExpandedMap((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const current = allocation[activePage]

  return (
    <div className="flex flex-col gap-4">
      {/* Tab 栏 */}
      <div className="sticky top-0 z-[1] -mx-4 -mt-4 border-b bg-background/90 px-4 py-2 backdrop-blur">
        <div
          role="tablist"
          aria-label="驾驶舱三页：按投资者决策分配"
          className="grid grid-cols-3 gap-1 rounded-xl bg-muted/50 p-1"
        >
          {DECISION_PAGES.map((p) => {
            const total = allocation[p.id]?.total ?? 0
            const isActive = activePage === p.id
            return (
              <button
                key={p.id}
                role="tab"
                aria-selected={isActive}
                type="button"
                onClick={() => setActivePage(p.id)}
                className={cn(
                  'flex flex-col items-center gap-0.5 rounded-lg px-2 py-2 text-xs font-medium transition-all sm:text-sm',
                  isActive
                    ? 'bg-background text-foreground shadow-sm ring-1 ring-border'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <span className="flex items-center gap-1.5">
                  <span>{p.icon}</span>
                  <span>{p.label}</span>
                  <span className="rounded-full bg-muted-foreground/10 px-1.5 text-[10px] leading-5 text-muted-foreground">
                    {total}
                  </span>
                </span>
                <span className="hidden text-[11px] text-muted-foreground sm:block">
                  {p.tagline}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* 当前页内容 */}
      <div className="space-y-4">
        {current?.sections.map((sec) => {
          const key = `${current.page.id}:${sec.sectionId}`
          const isExpanded = expandedMap[key] ?? sec.defaultExpanded
          const count = sec.grid.length + sec.drawer.length
          return (
            <section
              key={sec.sectionId}
              className="overflow-hidden rounded-xl border bg-card"
            >
              <button
                type="button"
                className={cn(
                  'flex w-full items-center gap-2 px-4 py-3 text-left transition-colors',
                  'hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                )}
                aria-expanded={isExpanded}
                onClick={() => toggleSection(current.page.id, sec.sectionId)}
              >
                <span className="text-lg">{sec.icon}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold">{sec.label}</h3>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                      {count} 项
                    </span>
                  </div>
                </div>
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </button>

              {isExpanded && (
                <div className="space-y-4 border-t p-4">
                  {count === 0 ? (
                    <p className="py-4 text-center text-sm text-muted-foreground">
                      暂无组件 — 点击顶部「添加组件」补充此页内容
                    </p>
                  ) : (
                    <>
                      {sec.grid.length > 0 && (
                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                          {sec.grid.map((inst) => (
                            <div key={inst.instanceId}>{renderWidget(inst)}</div>
                          ))}
                        </div>
                      )}
                      {sec.drawer.length > 0 && (
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                          {sec.drawer.map((inst) => (
                            <WidgetSheetDrawer
                              key={inst.instanceId}
                              instance={inst}
                              renderWidget={renderWidget}
                            />
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}

export default DecisionPagesOverview
