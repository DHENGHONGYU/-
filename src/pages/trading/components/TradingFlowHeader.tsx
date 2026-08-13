/**
 * TradingFlowPage 页面头部区域
 * 从 TradingFlowPage.tsx 提取
 */
import React from 'react'
import { Badge } from '@/components/atoms/Badge'
import { Button } from '@/components/atoms/Button'
import { PageHeader } from '@/components/templates'
import { useCollectionWizardStore } from '@/store/collectionWizardStore'
import { Database } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TradingFlowHeaderProps {
  useMockData: boolean
}

export function TradingFlowHeader({ useMockData }: TradingFlowHeaderProps): React.JSX.Element {
  const openWizard = useCollectionWizardStore((s) => s.openWizard)

  return (
    <PageHeader
      title={
        <div className="flex items-center gap-2 flex-wrap">
          交易流程
          <Badge className={cn(
            'text-[10px] px-2.5 py-0.5',
            useMockData
              ? 'bg-warning/10 text-warning border-warning/30 hover:bg-warning/10'
              : 'bg-success/10 text-success border-success/30 hover:bg-success/10',
          )}>
            {useMockData ? '数据源：Mock · 开发演示' : '数据源：真实采集 · DataBridge'}
          </Badge>
        </div>
      }
      description={
        useMockData
          ? '开发模式：MCP generate_mock_trading_data 生成演示数据（已确定性补齐量价指标）。生产构建通过 initTradingStoreFacadeSync 接入真实采集链路，从 trading tools 拉取数据写入 dataBridge。'
          : '完整的交易流程管理：信号生成 → 订单执行 → 持仓管理 → 风险控制（真实采集源：MCP trading tools）'
      }
      actions={
        <div className="flex items-center gap-2">
          <Button onClick={openWizard} variant="outline">
            <Database className="mr-2 h-4 w-4" />
            数据采集
          </Button>
        </div>
      }
    />
  )
}
