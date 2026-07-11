/**
 * @module AgentPerformanceWidget
 * @description Cockpit Widget - Agent 性能追踪
 */

import React, { memo, useEffect } from 'react'
import { Users } from 'lucide-react'
import { Badge } from '@/components/atoms/Badge'
import { Skeleton } from '@/components/molecules/states'
import { WidgetStateShell } from './components/WidgetStateShell'
import type { WidgetConfig, MarketData } from '@/types/modules/widget.types'
import AgentHealthCard from '@/components/organisms/system/AgentHealthCard'
import { useSystemMonitorStore } from '@/store/systemMonitorStore'
import { getLogger } from '@/lib/logger'
import { COLOR_TOKENS } from '@/constants/theme.tokens'

const logger = getLogger()

interface AgentPerformanceWidgetProps {
  config: WidgetConfig
  data?: MarketData
}

const AgentPerformanceWidget = memo(function AgentPerformanceWidget({ config }: AgentPerformanceWidgetProps): React.JSX.Element {
  const agentHealthSnapshots = useSystemMonitorStore((state) => state.agentHealthSnapshots)
  const isLoading = useSystemMonitorStore((state) => state.isLoading)
  const error = useSystemMonitorStore((state) => state.error)
  const refreshSnapshot = useSystemMonitorStore((state) => state.refreshSnapshot)
  const isMonitoring = useSystemMonitorStore((state) => state.isMonitoring)

  useEffect(() => {
    logger.info('[AgentPerformanceWidget] Widget mounted')
    if (!isMonitoring) {
      void refreshSnapshot()
    }
  }, [isMonitoring, refreshSnapshot])

  const visualState = error
    ? 'error'
    : isLoading
      ? 'loading'
      : agentHealthSnapshots.length === 0
        ? 'empty'
        : 'ready'

  return (
    <WidgetStateShell
      title={config.title}
      titleIcon={<Users className={COLOR_TOKENS.info.tailwind} />}
      titleAction={<Badge variant="outline">{agentHealthSnapshots.length} 个智能体</Badge>}
      visualState={visualState}
      error={error}
      onRetry={() => void refreshSnapshot()}
      loadingLabel="加载智能体健康数据…"
      emptyTitle="暂无智能体健康数据"
      emptyDescription="系统监控启动后将自动采集 Agent 性能快照"
      skeleton={
        <div className="grid gap-3 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} variant="rect" className="h-24" />
          ))}
        </div>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {agentHealthSnapshots.map((snapshot) => (
          <AgentHealthCard key={snapshot.agentId} agent={snapshot} />
        ))}
      </div>
    </WidgetStateShell>
  )
})

AgentPerformanceWidget.displayName = 'AgentPerformanceWidget'

export default AgentPerformanceWidget
