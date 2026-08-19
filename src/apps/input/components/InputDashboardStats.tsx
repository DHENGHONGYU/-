/**
 * @fileoverview InputDashboard 统计/概览卡片区域
 * @module apps/input/components/InputDashboardStats
 */

import React from 'react'
import { Card, CardContent } from '@/components/atoms/Card'
import { Badge } from '@/components/atoms/Badge'
import { Skeleton } from '@/components/molecules/states/Skeleton'
import { GaugeRing } from '@/components/chart/GaugeChart'
import type { DashboardStats } from '../hooks/useInputDashboardData'
import { Activity, Database, Server, ListTodo } from 'lucide-react'

interface InputDashboardStatsProps {
  loading: boolean
  stats: DashboardStats
  fetcherOk: boolean | null
}

/**
 * 统计概览区域：候选池标的数、已采行情、采集服务状态、待采集标的
 */
export default function InputDashboardStats({
  loading,
  stats,
  fetcherOk,
}: InputDashboardStatsProps): React.JSX.Element {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-sm"><CardContent className="p-5"><Skeleton className="h-4 w-20" /><Skeleton className="mt-2 h-8 w-16" /></CardContent></Card>
        <Card className="shadow-sm"><CardContent className="p-5"><Skeleton className="h-4 w-20" /><Skeleton className="mt-2 h-8 w-16" /></CardContent></Card>
        <Card className="shadow-sm"><CardContent className="p-5"><Skeleton className="h-4 w-20" /><Skeleton className="mt-2 h-6 w-20" /></CardContent></Card>
        <Card className="shadow-sm"><CardContent className="p-5"><Skeleton className="h-4 w-20" /><Skeleton className="mt-2 h-8 w-24" /></CardContent></Card>
      </div>
    )
  }

  const pending = stats.total - stats.withPrice

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {/* 候选池标的 */}
      <Card className="shadow-sm border-border/40">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">意向候选池标的</p>
              <div className="mt-2 flex items-baseline gap-2">
                <p className="text-3xl font-semibold tabular-nums tracking-tight">{stats.total}</p>
                {stats.total > 0 && (
                  <span className="text-[11px] font-medium text-success">
                    ↑ {Math.round((stats.withPrice / stats.total) * 100)}% 覆盖
                  </span>
                )}
              </div>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-info/10 text-info">
              <ListTodo className="h-4.5 w-4.5" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 已采行情 */}
      <Card className="shadow-sm border-border/40">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">已采行情</p>
              <div className="mt-2 flex items-center gap-3">
                <div>
                  <p className="text-3xl font-semibold tabular-nums tracking-tight">{stats.withPrice}</p>
                  {stats.total > 0 && stats.withPrice < stats.total && (
                    <p className="mt-0.5 text-[11px] font-medium text-warning">
                      ↓ {pending} 待采
                    </p>
                  )}
                </div>
                {stats.total > 0 && (
                  <GaugeRing value={stats.coverage} max={100} size={46} thickness={4} colorMode="progress" />
                )}
              </div>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success">
              <Database className="h-4.5 w-4.5" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 采集服务 */}
      <Card className="shadow-sm border-border/40">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">采集服务</p>
              <div className="mt-3">
                {fetcherOk === null ? (
                  <Skeleton className="h-6 w-20" />
                ) : fetcherOk ? (
                  <Badge className="bg-success/10 text-success border-success/20 px-2.5 py-1">
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                      已连接
                    </span>
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="px-2.5 py-1">
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-destructive" />
                      未连接
                    </span>
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Server className="h-4.5 w-4.5" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 待采集标的 */}
      <Card className="shadow-sm border-border/40">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">待采集标的</p>
              <div className="mt-2 flex items-baseline gap-2">
                <p className="text-3xl font-semibold tabular-nums tracking-tight">{pending}</p>
                {pending > 0 && (
                  <span className="text-[11px] font-medium text-warning">
                    点击「采集全部」开始
                  </span>
                )}
                {pending === 0 && stats.total > 0 && (
                  <span className="text-[11px] font-medium text-success">
                    全部完成
                  </span>
                )}
              </div>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-warning/10 text-warning">
              <Activity className="h-4.5 w-4.5" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
