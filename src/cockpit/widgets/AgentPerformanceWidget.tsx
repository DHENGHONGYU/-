/**
 * @module AgentPerformanceWidget
 * @description Cockpit Widget - Agent 性能追踪
 */

import React, { memo, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import type { WidgetConfig, MarketData } from '@/types/modules/widget.types'
import AgentHealthCard from '@/components/system/AgentHealthCard'
import { useSystemMonitorStore } from '@/store/systemMonitorStore'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

interface AgentPerformanceWidgetProps {
  config: WidgetConfig
  data?: MarketData
}

const AgentPerformanceWidget = memo(function AgentPerformanceWidget(_props: AgentPerformanceWidgetProps): React.JSX.Element {
  const agentHealthSnapshots = useSystemMonitorStore((state) => state.agentHealthSnapshots)
  const isLoading = useSystemMonitorStore((state) => state.isLoading)
  const refreshSnapshot = useSystemMonitorStore((state) => state.refreshSnapshot)
  const isMonitoring = useSystemMonitorStore((state) => state.isMonitoring)

  useEffect(() => {
    logger.info('[AgentPerformanceWidget] Widget mounted')
    if (!isMonitoring) {
      void refreshSnapshot()
    }
  }, [isMonitoring, refreshSnapshot])

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>智能体性能追踪</CardTitle>
          <Badge variant="outline">{agentHealthSnapshots.length} 个智能体</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && agentHealthSnapshots.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">加载中...</div>
        ) : agentHealthSnapshots.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">暂无智能体健康数据</div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {agentHealthSnapshots.map((snapshot) => (
              <AgentHealthCard key={snapshot.agentId} agent={snapshot} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
})

AgentPerformanceWidget.displayName = 'AgentPerformanceWidget'

export default AgentPerformanceWidget
