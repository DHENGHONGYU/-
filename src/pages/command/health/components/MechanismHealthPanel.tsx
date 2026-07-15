/**
 * @fileoverview 总控舱「自动化机制健康」下钻面板
 *
 * 消费 `useMechanismHealthStore`，展示 SOP 自动触发 / 文档自动更新 / 日志自动更新
 * 三类机制的自扫描（探针激活率、分类明细、历史趋势）与「时刻监控」控制。
 *
 * 归属：总控舱（command/health）——监控与治理类天然归总控舱，与驾驶舱常驻
 * Widget（MechanismHealthWidget）共享同一 Store，形成「常驻桌面概览 + 总控舱下钻」双入口。
 *
 * 颜色全部走 COLOR_TOKENS 令牌，满足 lint:colors；本文件位于 pages/ 目录，
 * 不在 audit:atomic 的扫描范围（src/components/），且页面层允许依赖 store。
 */

import { useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/atoms/Card'
import { Badge } from '@/components/atoms/Badge'
import { Button } from '@/components/atoms/Button'
import { COLOR_TOKENS } from '@/constants/theme.tokens'
import { useMechanismHealthStore } from '@/store/mechanismHealthStore'
import type { MechanismCategory, MechanismProbe } from '@/services/system/mechanismMonitorService'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Monitor,
  RefreshCw,
  ShieldAlert,
  XCircle,
} from 'lucide-react'

/** 类别 → 中文标签 */
const CATEGORY_LABEL: Record<MechanismCategory, string> = {
  sop: 'SOP 自动触发',
  doc: '文档自动更新',
  log: '日志自动更新',
}

/** 激活率 → 颜色 */
function ratioColor(ratio: number): string {
  if (ratio >= 0.95) return COLOR_TOKENS.success.hex
  if (ratio >= 0.8) return COLOR_TOKENS.warning.hex
  return COLOR_TOKENS.danger.hex
}

/** 单探针状态图标 */
function probeIcon(status: MechanismProbe['status']) {
  if (status === 'active') {
    return <CheckCircle2 className="h-4 w-4" style={{ color: COLOR_TOKENS.success.hex }} />
  }
  return <XCircle className="h-4 w-4" style={{ color: COLOR_TOKENS.danger.hex }} />
}

/** 历史趋势条 */
function HistoryBar({ ratio }: { ratio: number }): React.JSX.Element {
  const color = ratioColor(ratio)
  return (
    <div className="h-2 w-full overflow-hidden rounded-full" style={{ backgroundColor: `rgba(${COLOR_TOKENS.success.rgb}, 0.12)` }}>
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${Math.round(ratio * 100)}%`, backgroundColor: color }}
      />
    </div>
  )
}

/**
 * MechanismHealthPanel
 * @description 总控舱机制健康下钻面板
 */
export default function MechanismHealthPanel(): React.JSX.Element {
  const latest = useMechanismHealthStore((s) => s.latest)
  const history = useMechanismHealthStore((s) => s.history)
  const isMonitoring = useMechanismHealthStore((s) => s.isMonitoring)
  const lastAlertAt = useMechanismHealthStore((s) => s.lastAlertAt)
  const runScan = useMechanismHealthStore((s) => s.runScan)
  const startMonitoring = useMechanismHealthStore((s) => s.startMonitoring)
  const stopMonitoring = useMechanismHealthStore((s) => s.stopMonitoring)

  // 首屏若尚无快照则立即扫描一次
  useEffect(() => {
    if (!latest) runScan()
  }, [latest, runScan])

  const total = latest?.summary.total ?? 0
  const active = latest?.summary.active ?? 0
  const ratio = total > 0 ? active / total : 0
  const scanTime = latest ? new Date(latest.timestamp).toLocaleString('zh-CN') : '—'

  return (
    <Card className="border-2" style={{ borderColor: ratioColor(ratio) }}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg">自动化机制健康</CardTitle>
            <CardDescription className="mt-1">
              SOP 触发 / 文档自动更新 / 日志自动更新 · 运行时自扫描
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => runScan()}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              立即扫描
            </Button>
            <Button
              variant={isMonitoring ? 'danger' : 'default'}
              size="sm"
              onClick={() => (isMonitoring ? stopMonitoring() : startMonitoring())}
            >
              <Monitor className="mr-1.5 h-3.5 w-3.5" />
              {isMonitoring ? '停止监控' : '开启监控'}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {!latest ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Activity className="h-4 w-4 animate-pulse" />
            正在扫描三类自动化机制…
          </div>
        ) : (
          <>
            {/* 综合激活率 */}
            <div className="flex items-end justify-between">
              <div>
                <span className="text-3xl font-semibold" style={{ color: ratioColor(ratio) }}>
                  {Math.round(ratio * 100)}%
                </span>
                <span className="ml-2 text-sm text-muted-foreground">
                  {active}/{total} 探针激活
                </span>
              </div>
              <span className="text-xs text-muted-foreground">扫描于 {scanTime}</span>
            </div>

            {/* 分类明细 */}
            <div className="grid gap-2 sm:grid-cols-3">
              {(['sop', 'doc', 'log'] as MechanismCategory[]).map((cat) => {
                const stat = latest.summary.byCategory[cat]
                const catRatio = stat.total > 0 ? stat.active / stat.total : 0
                return (
                  <div
                    key={cat}
                    className="rounded-lg border p-3"
                    style={{ borderColor: `rgba(${COLOR_TOKENS.success.rgb}, 0.2)` }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{CATEGORY_LABEL[cat]}</span>
                      <span className="text-sm font-medium" style={{ color: ratioColor(catRatio) }}>
                        {stat.active}/{stat.total}
                      </span>
                    </div>
                    <div className="mt-2">
                      <HistoryBar ratio={catRatio} />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* 探针明细 */}
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-muted-foreground">探针明细</div>
              <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
                {latest.probes.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/40"
                  >
                    <div className="flex items-center gap-2 truncate">
                      {probeIcon(p.status)}
                      <span className="truncate">{p.label}</span>
                    </div>
                    <Badge
                      variant={p.status === 'active' ? 'outline' : 'destructive'}
                      className="shrink-0 text-[11px]"
                    >
                      {p.detail}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            {/* 历史趋势 */}
            {history.length > 1 && (
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">
                  历史趋势（最近 {Math.min(history.length, 6)} 次）
                </div>
                <div className="space-y-1.5">
                  {history
                    .slice(-6)
                    .reverse()
                    .map((h) => (
                      <div key={h.timestamp} className="flex items-center gap-2">
                        <span className="w-20 shrink-0 text-[11px] text-muted-foreground">
                          {new Date(h.timestamp).toLocaleTimeString('zh-CN')}
                        </span>
                        <div className="flex-1">
                          <HistoryBar ratio={h.summary.activatedRatio} />
                        </div>
                        <span
                          className="w-10 shrink-0 text-right text-[11px] font-medium"
                          style={{ color: ratioColor(h.summary.activatedRatio) }}
                        >
                          {Math.round(h.summary.activatedRatio * 100)}%
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* 告警提示 */}
            {lastAlertAt > 0 && (
              <div
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm"
                style={{
                  color: COLOR_TOKENS.warning.hex,
                  backgroundColor: `rgba(${COLOR_TOKENS.warning.rgb}, 0.08)`,
                  borderColor: `rgba(${COLOR_TOKENS.warning.rgb}, 0.3)`,
                  borderWidth: 1,
                }}
              >
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>最近一次告警：{new Date(lastAlertAt).toLocaleString('zh-CN')}（激活率低于阈值）</span>
              </div>
            )}
          </>
        )}

        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <ShieldAlert className="h-3.5 w-3.5" />
          跨切面「时刻提醒」由 MechanismHealthWidget 订阅告警事件经 useToast 推送，5 舱通看。
        </div>
      </CardContent>
    </Card>
  )
}
