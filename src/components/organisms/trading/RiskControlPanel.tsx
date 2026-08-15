/**
 * 风险控制面板
 * 展示风险指标与预警
 */
import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/atoms/Card'
import { Alert, AlertDescription, AlertTitle } from '@/components/molecules/Alert'
import { Input } from '@/components/atoms/Input'
import { Label } from '@/components/atoms/Label'
import { Button } from '@/components/atoms/Button'
import { AlertTriangle } from 'lucide-react'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

interface RiskMetrics {
  var: number
  maxDrawdown: number
  sharpeRatio: number
}

interface RiskControlPanelProps {
  riskMetrics?: RiskMetrics
  riskAlerts?: string[]
  onUpdateRules?: (rules: { stopLossPercent: number; takeProfitPercent: number }) => void
}

/**
 * RiskControlPanel
 */
export function RiskControlPanel({
  riskMetrics,
  riskAlerts = [],
  onUpdateRules
}: RiskControlPanelProps): React.JSX.Element {
  const [stopLossPercent, setStopLossPercent] = useState(10)
  const [takeProfitPercent, setTakeProfitPercent] = useState(20)

  // 无真实风险数据（如生产构建未接入实时风控源）时显式标注「数据不足」，
  // 避免以 0 值或历史硬编码值伪装成真实 KPI（与 PortfolioOverviewWidget 约定一致）。
  const noRiskData = riskMetrics === undefined

  const handleUpdateRules = (): void => {
    logger.info('[RiskControlPanel] 更新风控规则', { stopLossPercent, takeProfitPercent })
    onUpdateRules?.({ stopLossPercent, takeProfitPercent })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>风险控制</CardTitle>
        <CardDescription>风险指标与预警</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">VaR (95%)</p>
              {noRiskData ? (
                <p className="text-h1 font-bold text-muted-foreground">数据不足</p>
              ) : (
                <p className="text-h1 font-bold text-primary">{riskMetrics.var.toFixed(2)}%</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">最大回撤</p>
              {noRiskData ? (
                <p className="text-h1 font-bold text-muted-foreground">数据不足</p>
              ) : (
                <p className="text-h1 font-bold text-primary">{riskMetrics.maxDrawdown.toFixed(2)}%</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">夏普比率</p>
              {noRiskData ? (
                <p className="text-h1 font-bold text-muted-foreground">数据不足</p>
              ) : (
                <p className="text-h1 font-bold text-primary">{riskMetrics.sharpeRatio.toFixed(2)}</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-3">
          <h3 className="font-semibold">止损/止盈规则</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>止损比例 (%)</Label>
              <Input
                type="number"
                value={stopLossPercent}
                onChange={(e) => setStopLossPercent(parseFloat(e.target.value) || 0)}
                placeholder="10"
              />
            </div>
            <div className="space-y-2">
              <Label>止盈比例 (%)</Label>
              <Input
                type="number"
                value={takeProfitPercent}
                onChange={(e) => setTakeProfitPercent(parseFloat(e.target.value) || 0)}
                placeholder="20"
              />
            </div>
          </div>
          <Button onClick={handleUpdateRules} variant="outline" className="w-full">
            更新规则
          </Button>
        </div>

        {riskAlerts.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>风险预警</AlertTitle>
            <AlertDescription>
              <ul className="list-disc list-inside space-y-1">
                {riskAlerts.map((alert, idx) => (
                  <li key={idx}>{alert}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}
