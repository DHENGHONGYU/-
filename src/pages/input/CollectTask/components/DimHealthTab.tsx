/**
 * 维度健康度 Tab
 *
 * @module CollectTask/components/DimHealthTab
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle, Skeleton } from '@/components/atoms'
import { EmptyState } from '@/components/molecules'
import type { DimHealth } from '../hooks/useCollectionTaskStats'
import { DimHealthCard } from './DimHealthCard'

interface DimHealthTabProps {
  isLoading: boolean
  dimHealth: Map<string, DimHealth>
}

const SKELETON_COUNT = 8

/**
 * DimHealthTab
 * @param dimHealth }
 */
export function DimHealthTab({ isLoading, dimHealth }: DimHealthTabProps): React.JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>维度健康度</CardTitle>
        <CardDescription>基于已完成的 trace 计算成功率</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
              <Skeleton key={i} className="h-36 w-full" />
            ))}
          </div>
        ) : dimHealth.size === 0 ? (
          <EmptyState title="暂无数据" description="未产生任何采集 trace" />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from(dimHealth.entries()).map(([code, data]) => (
              <DimHealthCard
                key={code}
                code={code}
                name={data.name}
                total={data.total}
                success={data.success}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
