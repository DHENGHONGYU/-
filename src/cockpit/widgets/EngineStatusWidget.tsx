/**
 * @module EngineStatusWidget
 * @description Cockpit Widget - 引擎状态监控
 */

import React, { memo, useEffect } from 'react'
import type { WidgetConfig, MarketData } from '@/types/modules/widget.types'
import EngineStatusCard from '@/components/system/EngineStatusCard'
import { useSystemMonitorStore } from '@/store/systemMonitorStore'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

interface EngineStatusWidgetProps {
  config: WidgetConfig
  data?: MarketData
}

const EngineStatusWidget = memo(function EngineStatusWidget(_props: EngineStatusWidgetProps): React.JSX.Element {
  const refreshSnapshot = useSystemMonitorStore((state) => state.refreshSnapshot)
  const isMonitoring = useSystemMonitorStore((state) => state.isMonitoring)

  useEffect(() => {
    logger.info('[EngineStatusWidget] Widget mounted')
    if (!isMonitoring) {
      void refreshSnapshot()
    }
  }, [isMonitoring, refreshSnapshot])

  return <EngineStatusCard />
})

EngineStatusWidget.displayName = 'EngineStatusWidget'

export default EngineStatusWidget
