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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardContent className="p-5"><Skeleton className="h-4 w-20" /><Skeleton className="mt-2 h-8 w-16" /></CardContent></Card>
        <Card><CardContent className="p-5"><Skeleton className="h-4 w-20" /><Skeleton className="mt-2 h-8 w-16" /></CardContent></Card>
        <Card><CardContent className="p-5"><Skeleton className="h-4 w-20" /><Skeleton className="mt-2 h-6 w-20" /></CardContent></Card>
        <Card><CardContent className="p-5"><Skeleton className="h-4 w-20" /><Skeleton className="mt-2 h-8 w-24" /></CardContent></Card>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardContent className="p-5">
          <p className="text-xs text-muted-foreground">意向候选池标的</p>
          <div className="flex items-baseline gap-2">
            <p className="text-h1 font-bold">{stats.total}</p>
            {stats.total > 0 && (
              <span className="text-xs text-success">↑ {Math.round((stats.withPrice / stats.total) * 100)}% 覆盖</span>
            )}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-5">
          <p className="text-xs text-muted-foreground">已采行情</p>
          <div className="flex items-center gap-3">
            <div>
              <p className="text-h1 font-bold">{stats.withPrice}</p>
              {stats.total > 0 && stats.withPrice < stats.total && (
                <span className="text-xs text-warning">↓ {stats.total - stats.withPrice} 待采</span>
              )}
            </div>
            {stats.total > 0 && (
              <GaugeRing value={stats.coverage} max={100} size={44} thickness={4} colorMode="progress" />
            )}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-5">
          <p className="text-xs text-muted-foreground">采集服务</p>
          <div className="mt-1 flex items-center gap-2">
            {fetcherOk === null ? (
              <Skeleton className="h-6 w-16" />
            ) : fetcherOk ? (
              <Badge className="bg-success/10 text-success">已连接</Badge>
            ) : (
              <Badge variant="destructive">未连接</Badge>
            )}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-5">
          <p className="text-xs text-muted-foreground">待采集标的</p>
          <div className="flex items-baseline gap-2">
            <p className="text-h1 font-bold">{stats.total - stats.withPrice}</p>
            {stats.total - stats.withPrice > 0 && (
              <span className="text-xs text-warning">点击「采集全部」开始</span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
