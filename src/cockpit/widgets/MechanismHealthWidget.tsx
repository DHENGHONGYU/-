/**
 * @fileoverview 机制健康常驻监控 Widget（桌面板块）
 *
 * 归属：驾驶舱（Cockpit）常驻展示面，对应"桌面板块"的 always-on 状态。
 * 仅从 `mechanismHealthStore` 读数据并触发扫描，不直接跑检测逻辑（分层）。
 * "时刻提醒"通过订阅 eventBus 的 `mechanism:alert` 事件推送全局 Toast（跨切面）。
 *
 * @module cockpit/widgets/MechanismHealthWidget
 */

import React, { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import type { WidgetConfig } from '@/types/modules/widget.types'
import {
  useMechanismHealthStore,
} from '@/store/mechanismHealthStore'
import { useToast } from '@/hooks/useToast'
import { eventBus } from '@/lib/eventBus'
import {
  MECHANISM_ALERT_EVENT,
  type MechanismCategory,
  type MechanismHealthSnapshot,
} from '@/services/system/mechanismMonitorService'
import { COLOR_SHADES } from '@/constants/theme.tokens'

interface MechanismHealthWidgetProps {
  config: WidgetConfig
}

const CATEGORY_LABELS: Record<MechanismCategory, string> = {
  sop: 'SOP 自动触发',
  doc: '文档自动更新',
  log: '日志自动更新',
}

const CATEGORY_ORDER: MechanismCategory[] = ['sop', 'doc', 'log']

/**
 * MechanismHealthWidget
 * @param props
 */
export default function MechanismHealthWidget(props: MechanismHealthWidgetProps): React.JSX.Element {
  const latest = useMechanismHealthStore((s) => s.latest)
  const isMonitoring = useMechanismHealthStore((s) => s.isMonitoring)
  const runScan = useMechanismHealthStore((s) => s.runScan)
  const startMonitoring = useMechanismHealthStore((s) => s.startMonitoring)
  const stopMonitoring = useMechanismHealthStore((s) => s.stopMonitoring)
  const { toast } = useToast()
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    // 挂载即扫描一次
    runScan()

    // 订阅告警事件 → 全局 Toast（时刻提醒，跨切面）
    const off = eventBus.on(MECHANISM_ALERT_EVENT, (payload) => {
      const snap = payload as MechanismHealthSnapshot
      toast({
        title: '机制健康告警',
        description: `已激活 ${snap.summary.active}/${snap.summary.total}，存在失活机制，建议核查 SOP / 文档 / 日志链路`,
        variant: 'warning',
      })
    })

    return off
  }, [runScan, toast])

  // hooks 调用完毕后再做防御性 guard（遵循现有 Widget 惯例）
  if (!props?.config) {
    return <div className={cn('p-4 text-sm', 'text-muted-foreground/70')}>配置未就绪</div>
  }

  const summary = latest?.summary
  const active = summary?.active ?? 0
  const total = summary?.total ?? 0
  const ratio = summary?.activatedRatio ?? 0
  const allActive = active === total && total > 0

  const headerColor = allActive ? 'text-success' : 'text-warning'
  const headerBg = allActive ? 'bg-success/10' : 'bg-warning/10'

  return (
    <div className="flex flex-col gap-3 p-3">
      {/* 概览头部 */}
      <div className={cn('flex items-center justify-between rounded-lg p-3', headerBg)}>
        <div>
          <div className={cn('text-xs', 'text-muted-foreground')}>机制健康</div>
          <div className={cn('text-2xl font-bold', headerColor)}>
            {active}
            <span className={cn('text-sm font-normal', 'text-muted-foreground/70')}>/{total}</span>
          </div>
        </div>
        <div className="text-right">
          <div className={cn('text-xs', 'text-muted-foreground')}>激活率</div>
          <div className={cn('text-lg font-semibold', headerColor)}>
            {(ratio * 100).toFixed(0)}%
          </div>
        </div>
      </div>

      {/* 分类明细 */}
      <div className="flex flex-col gap-1.5">
        {CATEGORY_ORDER.map((cat) => {
          const stat = summary?.byCategory[cat]
          const catActive = stat?.active ?? 0
          const catTotal = stat?.total ?? 0
          const catOk = catActive === catTotal && catTotal > 0
          return (
            <div
              key={cat}
              className={cn(
                'flex items-center justify-between rounded-md px-2 py-1.5',
                COLOR_SHADES.gray[50],
              )}
            >
              <span className={cn('text-xs', 'text-muted-foreground')}>{CATEGORY_LABELS[cat]}</span>
              <span
                className={cn(
                  'flex items-center gap-1.5 text-xs font-medium',
                  catOk ? 'text-success' : 'text-destructive',
                )}
              >
                <span className={cn('h-2 w-2 rounded-full', catOk ? 'bg-success' : 'bg-destructive')} />
                {catActive}/{catTotal}
              </span>
            </div>
          )
        })}
      </div>

      {/* 控制区 */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => runScan()}
          className={cn(
            'rounded-md px-2.5 py-1 text-xs font-medium',
            'bg-info/10',
            'text-info',
          )}
        >
          立即扫描
        </button>
        <button
          type="button"
          onClick={() => (isMonitoring ? stopMonitoring() : startMonitoring())}
          className={cn(
            'rounded-md px-2.5 py-1 text-xs font-medium',
            isMonitoring ? 'bg-destructive/10' : 'bg-success/10',
            isMonitoring ? 'text-destructive' : 'text-success',
          )}
        >
          {isMonitoring ? '停止监控' : '开启监控'}
        </button>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className={cn('rounded-md px-2.5 py-1 text-xs font-medium', COLOR_SHADES.gray[100], 'text-muted-foreground')}
        >
          {expanded ? '收起' : '明细'}
        </button>
      </div>

      {/* 探针明细 */}
      {expanded && latest && (
        <div className="flex max-h-48 flex-col gap-1 overflow-y-auto">
          {latest.probes.map((p) => (
            <div key={p.id} className="flex items-start justify-between gap-2 text-xs">
              <span className={cn('flex items-center gap-1.5', 'text-muted-foreground')}>
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    p.status === 'active' ? 'bg-success' : 'bg-destructive',
                  )}
                />
                {p.label}
              </span>
              <span className={p.status === 'active' ? 'text-success' : 'text-destructive'}>
                {p.status === 'active' ? '正常' : '失活'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 最后更新时间 */}
      {latest && (
        <div className={cn('text-[10px]', 'text-muted-foreground/70')}>
          最后扫描：{new Date(latest.timestamp).toLocaleTimeString('zh-CN')}
          {isMonitoring && ' · 监控中'}
        </div>
      )}
    </div>
  )
}
