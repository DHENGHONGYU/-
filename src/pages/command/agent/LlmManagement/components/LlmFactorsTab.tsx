/**
 * LLM 管理 - 因子控制 Tab
 *
 * @module LlmManagement/components/LlmFactorsTab
 */

import { Brain } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/atoms/Card'
import { Badge } from '@/components/atoms/Badge'
import { Label } from '@/components/atoms/Label'
import { Switch } from '@/components/atoms/Switch'
import { Progress } from '@/components/atoms/Progress'
import { STOCK_SCORE_FACTORS, type ScoreFactor } from '@/config/scoreFactors'
import type { LlmFactorOverride } from '@/config/llmConfig'

interface LlmFactorsTabProps {
  factorOverrides: LlmFactorOverride[]
  globalLlmEnabled: boolean
  onGlobalLlmEnabledChange: (enabled: boolean) => void
  onFactorOverrideChange: (factorId: string, useLlm: boolean) => void
}

/**
 * LlmFactorsTab
 */
export function LlmFactorsTab({
  factorOverrides,
  globalLlmEnabled,
  onGlobalLlmEnabledChange,
  onFactorOverrideChange,
}: LlmFactorsTabProps): React.JSX.Element {
  const enabledCount = factorOverrides.filter((o) => o.useLlm).length
  const totalCount = factorOverrides.length
  const enabledRatio = totalCount > 0 ? (enabledCount / totalCount) * 100 : 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>因子级 LLM 调用控制</CardTitle>
        <CardDescription>控制各评分因子是否调用LLM</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 全局开关 */}
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label className="text-base">LLM 总开关</Label>
            <p className="text-sm text-muted-foreground">
              关闭后所有因子将使用规则引擎计算，不调用LLM
            </p>
          </div>
          <Switch
            checked={globalLlmEnabled}
            onChange={(e) => { onGlobalLlmEnabledChange(e.target.checked) }}
          />
        </div>

        {/* 因子列表 */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">因子控制列表</Label>
          <p className="text-xs text-muted-foreground">
            L0/L1/L2/L5/L6 默认启用LLM，L3/L4/L7/L8 默认使用规则引擎
          </p>
          <div className="space-y-2">
            {STOCK_SCORE_FACTORS.factors.map((factor: ScoreFactor, index: number) => {
              const override = factorOverrides.find((o) => o.factorId === factor.name)
              const isEnabled = override?.useLlm ?? false
              const layerLabel = `L${index}`

              return (
                <div
                  key={factor.key}
                  className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50"
                >
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {layerLabel}
                      </Badge>
                      <Label className="text-sm font-medium">{factor.name}</Label>
                      {isEnabled && (
                        <Badge variant="secondary" className="text-xs">
                          <Brain className="mr-1 h-3 w-3" />
                          LLM
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {factor.description}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>权重: {factor.weight}</span>
                      <span>数据源: {factor.dataSources.join(', ')}</span>
                    </div>
                  </div>
                  <Switch
                    checked={isEnabled}
                    onChange={(e) => { onFactorOverrideChange(factor.name, e.target.checked) }}
                    disabled={!globalLlmEnabled}
                  />
                </div>
              )
            })}
          </div>
        </div>

        {/* 统计 */}
        <div className="rounded-lg bg-muted/50 p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">启用LLM的因子数</span>
            <span className="font-medium">
              {enabledCount} / {totalCount}
            </span>
          </div>
          <Progress value={enabledRatio} className="mt-2" />
        </div>
      </CardContent>
    </Card>
  )
}
