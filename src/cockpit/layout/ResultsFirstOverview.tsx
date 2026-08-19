/**
 * @module cockpit/layout/ResultsFirstOverview
 * @description 结果优先概览视图
 *
 * 按用户场景（而非技术架构）组织驾驶舱首屏内容。
 * 先呈现结果快照，再按需深入技术分析。
 *
 * 每个用户场景为一个可折叠区块，区块内 Widget 按网格排列。
 */

import { useMemo, useState, type ReactNode } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import {
  USER_SCENES,
  WIDGET_USER_SCENE_MAP,
  USER_SCENE_DEFAULT_EXPANDED,
  type UserSceneId,
} from '@/constants/cockpit.constants'
import type { WidgetConfig } from '@/types/modules/widget.types'

interface ResultsFirstOverviewProps {
  instances: WidgetConfig[]
  renderWidget: (instance: WidgetConfig) => ReactNode
}

/** 未在映射中的 Widget 归入此场景 */
const FALLBACK_SCENE: UserSceneId = 'deep_dive'

export function ResultsFirstOverview({ instances, renderWidget }: ResultsFirstOverviewProps): ReactNode {
  // 初始化区块展开状态
  const [expanded, setExpanded] = useState<Record<UserSceneId, boolean>>(() => ({
    ...USER_SCENE_DEFAULT_EXPANDED,
  }))

  /** 按用户场景分组的 Widget 实例 */
  const groupedInstances = useMemo(() => {
    const groups: Record<UserSceneId, WidgetConfig[]> = {
      today_snapshot: [],
      portfolio_status: [],
      market_scan: [],
      deep_dive: [],
    }
    for (const inst of instances) {
      const scene = WIDGET_USER_SCENE_MAP[inst.widgetId] ?? FALLBACK_SCENE
      groups[scene].push(inst)
    }
    return groups
  }, [instances])

  /** 场景 Widget 计数 */
  const sceneCounts = useMemo(
    () => ({
      today_snapshot: groupedInstances.today_snapshot.length,
      portfolio_status: groupedInstances.portfolio_status.length,
      market_scan: groupedInstances.market_scan.length,
      deep_dive: groupedInstances.deep_dive.length,
    }),
    [groupedInstances],
  )

  const toggleScene = (sceneId: UserSceneId) => {
    setExpanded((prev) => ({ ...prev, [sceneId]: !prev[sceneId] }))
  }

  return (
    <div className="space-y-6">
      {USER_SCENES.map((scene) => {
        const sceneInstances = groupedInstances[scene.id]
        const isExpanded = expanded[scene.id]
        const count = sceneCounts[scene.id]

        return (
          <section key={scene.id} className="rounded-lg border bg-card">
            {/* 区块标题栏 */}
            <button
              type="button"
              onClick={() => toggleScene(scene.id)}
              className="flex w-full items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-muted/50"
              aria-expanded={isExpanded}
            >
              <span className="text-lg">{scene.icon}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold">{scene.label}</h3>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {count} 项
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{scene.description}</p>
              </div>
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
            </button>

            {/* 区块内容 */}
            {isExpanded && (
              <div className="border-t p-4">
                {sceneInstances.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    暂无 Widget — 点击顶部「添加组件」补充
                  </p>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {sceneInstances.map((instance) => (
                      <div key={instance.instanceId}>
                        {renderWidget(instance)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
