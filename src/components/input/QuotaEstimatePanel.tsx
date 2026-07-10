/**
 * @module QuotaEstimatePanel
 * @description 额度预估面板
 *
 * 展示月调用量、日/小时上限、额度使用率进度条及 Kimi 套餐选择。
 */

import { memo, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Progress } from '@/components/ui/Progress'
import { Select, SelectItem } from '@/components/ui/Select'
import { Separator } from '@/components/ui/Separator'
import { COLOR_TOKENS } from '@/constants/theme.tokens'
import { GLOBAL_LIMITS } from '@/config/collectConfig'

interface QuotaEstimatePanelProps {
  monthlyCalls: number
  selectedPlan: string
  onPlanChange: (plan: string) => void
}

const KIMI_PLANS = [
  { id: 'free', name: '免费版', quota: 0, description: '仅 AKShare / Mock' },
  { id: 'pro', name: 'Kimi Pro', quota: 5000, description: '5,000 次/月' },
  { id: 'team', name: 'Kimi Team', quota: 20000, description: '20,000 次/月' },
  { id: 'enterprise', name: 'Kimi 企业版', quota: 100000, description: '100,000 次/月' },
]

export const QuotaEstimatePanel = memo(({ monthlyCalls, selectedPlan, onPlanChange }: QuotaEstimatePanelProps) => {
  const selectedQuota = KIMI_PLANS.find((p) => p.id === selectedPlan)?.quota ?? 0

  const quotaUsagePercent = useMemo(() => {
    if (selectedQuota > 0) {
      return Math.min(100, Math.round((monthlyCalls / selectedQuota) * 100))
    }
    return GLOBAL_LIMITS.rateLimitPerDay > 0
      ? Math.min(100, Math.round((monthlyCalls / (GLOBAL_LIMITS.rateLimitPerDay * 30)) * 100))
      : 0
  }, [monthlyCalls, selectedQuota])

  const quotaColorToken = useMemo(() => {
    if (quotaUsagePercent >= 80) return COLOR_TOKENS.danger
    if (quotaUsagePercent >= 50) return COLOR_TOKENS.warning
    return COLOR_TOKENS.info
  }, [quotaUsagePercent])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">额度预估</CardTitle>
        <CardDescription>基于当前配置的月调用估算</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">月调用总量</span>
          <span className="text-lg font-bold">{monthlyCalls.toLocaleString()}</span>
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">日调用上限</span>
          <span className="text-sm">{GLOBAL_LIMITS.rateLimitPerDay}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">小时调用上限</span>
          <span className="text-sm">{GLOBAL_LIMITS.rateLimitPerHour}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">AKShare 额度</span>
          <Badge variant="secondary">免费无限</Badge>
        </div>

        {/* Kimi 套餐选择 */}
        <div className="space-y-2">
          <span className="text-sm text-muted-foreground">Kimi 套餐</span>
          <Select value={selectedPlan} onChange={(e) => onPlanChange(e.target.value)}>
            {KIMI_PLANS.map((plan) => (
              <SelectItem key={plan.id} value={plan.id}>
                {plan.name} ({plan.description})
              </SelectItem>
            ))}
          </Select>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">额度使用率</span>
          <span className="text-sm font-medium" style={{ color: quotaColorToken.hex }}>
            {quotaUsagePercent}%
          </span>
        </div>

        {/* 额度使用率可视化进度条 */}
        <div className="space-y-1">
          <Progress value={quotaUsagePercent} className="h-2" />
          <p className="text-xs text-muted-foreground">
            月调用 {monthlyCalls.toLocaleString()} / 套餐额度{' '}
            {selectedQuota > 0 ? selectedQuota.toLocaleString() : (GLOBAL_LIMITS.rateLimitPerDay * 30).toLocaleString()}
          </p>
        </div>
      </CardContent>
    </Card>
  )
})

QuotaEstimatePanel.displayName = 'QuotaEstimatePanel'
