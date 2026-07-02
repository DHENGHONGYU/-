/**
 * @module SystemArchitectureWidget
 * @description Cockpit Widget - 系统架构可视化
 */

import React, { memo } from 'react'
import type { WidgetConfig, MarketData } from '@/types/modules/widget.types'
import SystemArchitectureDiagram from '@/components/system/SystemArchitectureDiagram'

interface SystemArchitectureWidgetProps {
  config: WidgetConfig
  data?: MarketData
}

const SystemArchitectureWidget = memo(function SystemArchitectureWidget(_props: SystemArchitectureWidgetProps): React.JSX.Element {
  return <SystemArchitectureDiagram />
})

SystemArchitectureWidget.displayName = 'SystemArchitectureWidget'

export default SystemArchitectureWidget
