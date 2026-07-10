/**
 * @module TaskPreviewStep
 * @description 向导步骤3：任务预览
 *
 * 汇总所有配置，生成任务摘要
 */

import React from 'react'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Label } from '@/components/ui/Label'
import { Input } from '@/components/ui/Input'
import { Checkbox } from '@/components/ui/Checkbox'
import { useCollectionWizardStore } from '@/store/collectionWizardStore'
import { COLOR_TOKENS, twBorder, twText } from '@/constants/theme.tokens'
import { FileText, Save, AlertCircle } from 'lucide-react'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

/**
 * TaskPreviewStep
 */
export function TaskPreviewStep(): React.JSX.Element {
  const selectedDimensions = useCollectionWizardStore((s) => s.selectedDimensions)
  const frequency = useCollectionWizardStore((s) => s.frequency)
  const priority = useCollectionWizardStore((s) => s.priority)
  const cacheTTL = useCollectionWizardStore((s) => s.cacheTTL)
  const cacheStrategy = useCollectionWizardStore((s) => s.cacheStrategy)
  const taskName = useCollectionWizardStore((s) => s.taskName)
  const setTaskName = useCollectionWizardStore((s) => s.setTaskName)
  const saveAsTemplate = useCollectionWizardStore((s) => s.saveAsTemplate)
  const setSaveAsTemplate = useCollectionWizardStore((s) => s.setSaveAsTemplate)

  const handleTaskNameChange = (value: string): void => {
    logger.info('[TaskPreviewStep] 任务名称变更', { value })
    setTaskName(value)
  }

  const handleSaveAsTemplateChange = (checked: boolean): void => {
    logger.info('[TaskPreviewStep] 保存为模板变更', { checked })
    setSaveAsTemplate(checked)
  }

  // 估算资源消耗
  const estimateResourceConsumption = (): {
    apiCalls: number
    estimatedTime: string
    storageUsage: string
  } => {
    const dimensionCount = selectedDimensions.length
    const baseApiCalls = dimensionCount * 10 // 每个维度约10次API调用
    const frequencyMultiplier = frequency === 'realtime' ? 24 : frequency === 'hourly' ? 24 : 1
    const apiCalls = baseApiCalls * frequencyMultiplier
    const estimatedTime = `${Math.ceil(dimensionCount * 2)}分钟`
    const storageUsage = `${dimensionCount * 50}MB`

    return { apiCalls, estimatedTime, storageUsage }
  }

  const resourceEstimate = estimateResourceConsumption()

  // 潜在风险
  const getPotentialRisks = (): string[] => {
    const risks: string[] = []

    if (frequency === 'realtime' && selectedDimensions.length > 3) {
      risks.push('实时采集多个维度可能导致API限流')
    }

    if (cacheTTL < 300) {
      risks.push('缓存时间过短，可能增加API调用频率')
    }

    if (priority === 'high' && selectedDimensions.length > 5) {
      risks.push('高优先级采集大量数据可能影响系统性能')
    }

    return risks
  }

  const risks = getPotentialRisks()

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">任务预览</h3>
        <p className={`text-sm ${COLOR_TOKENS.textMuted.tailwind}`}>
          确认采集配置，预估资源消耗
        </p>
      </div>

      {/* 任务名称 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4" />
            任务信息
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>任务名称</Label>
            <Input
              placeholder="输入任务名称（可选）"
              value={taskName}
              onChange={(e) => handleTaskNameChange(e.target.value)}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="saveAsTemplate"
              checked={saveAsTemplate}
              onChange={(e) => handleSaveAsTemplateChange(e.target.checked)}
            />
            <Label htmlFor="saveAsTemplate" className="cursor-pointer">
              <div className="flex items-center gap-2">
                <Save className="w-4 h-4" />
                保存为模板，方便下次快速复用
              </div>
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* 配置摘要 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">配置摘要</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className={COLOR_TOKENS.textMuted.tailwind}>数据维度</span>
              <span className="font-medium">{selectedDimensions.length} 个</span>
            </div>
            <div className="flex items-center justify-between">
              <span className={COLOR_TOKENS.textMuted.tailwind}>采集频率</span>
              <span className="font-medium">
                {frequency === 'realtime' ? '实时' : frequency === 'hourly' ? '每小时' : frequency === 'daily' ? '每日' : '自定义'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className={COLOR_TOKENS.textMuted.tailwind}>优先级</span>
              <span className="font-medium">
                {priority === 'high' ? '高' : priority === 'medium' ? '中' : '低'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className={COLOR_TOKENS.textMuted.tailwind}>缓存有效期</span>
              <span className="font-medium">{cacheTTL} 秒</span>
            </div>
            <div className="flex items-center justify-between">
              <span className={COLOR_TOKENS.textMuted.tailwind}>缓存策略</span>
              <span className="font-medium text-sm">
                {cacheStrategy === 'stale-while-revalidate' ? '先返回缓存，后台更新' : cacheStrategy === 'cache-first' ? '缓存优先' : '网络优先'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 资源消耗预估 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">资源消耗预估</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <div className={COLOR_TOKENS.textMuted.tailwind}>API调用次数</div>
              <div className="text-2xl font-bold">{resourceEstimate.apiCalls}</div>
            </div>
            <div className="space-y-1">
              <div className={COLOR_TOKENS.textMuted.tailwind}>预计耗时</div>
              <div className="text-2xl font-bold">{resourceEstimate.estimatedTime}</div>
            </div>
            <div className="space-y-1">
              <div className={COLOR_TOKENS.textMuted.tailwind}>存储占用</div>
              <div className="text-2xl font-bold">{resourceEstimate.storageUsage}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 潜在风险 */}
      {risks.length > 0 && (
        <Card className={twBorder('amber', 500)}>
          <CardHeader>
            <CardTitle className={cn('text-base flex items-center gap-2', twText('amber', 600))}>
              <AlertCircle className="w-4 h-4" />
              潜在风险
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {risks.map((risk, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <span className={cn('mt-0.5', twText('amber', 600))}>•</span>
                  <span>{risk}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* 确认提示 */}
      <div className={`text-center text-sm ${COLOR_TOKENS.textMuted.tailwind} pt-4`}>
        点击"下一步"开始执行采集任务
      </div>
    </div>
  )
}
