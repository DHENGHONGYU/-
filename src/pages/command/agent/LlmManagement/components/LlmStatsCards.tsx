/**
 * LLM 管理页面顶部统计卡片
 *
 * 显示当前模型、API Key 配置状态、今日调用、活跃 Agent 四个关键指标。
 *
 * @module LlmManagement/components/LlmStatsCards
 */

import { Sparkles, Key, Activity, Bot } from 'lucide-react'
import { Card, CardContent } from '@/components/atoms/Card'
import { getPresetById, isLlmApiKeyConfigured } from '@/config/llmConfig'

interface LlmStatsCardsProps {
  selectedPreset: string
}

/**
 * LlmStatsCards
 */
export function LlmStatsCards({ selectedPreset }: LlmStatsCardsProps): React.JSX.Element {
  const currentModelName = selectedPreset
    ? (getPresetById(selectedPreset)?.name ?? '自定义')
    : '-'

  return (
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardContent className="flex items-center gap-4 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10 text-success">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <p className="text-h2 font-bold">{currentModelName}</p>
            <p className="text-sm text-muted-foreground">当前模型</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center gap-4 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-info/10 text-info">
            <Key className="h-5 w-5" />
          </div>
          <div>
            <p className="text-h2 font-bold">{isLlmApiKeyConfigured() ? '已配置' : '未配置'}</p>
            <p className="text-sm text-muted-foreground">API Key</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center gap-4 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10 text-warning">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <p className="text-h2 font-bold">0</p>
            <p className="text-sm text-muted-foreground">今日调用次数</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center gap-4 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <p className="text-h2 font-bold">0</p>
            <p className="text-sm text-muted-foreground">活跃 Agent</p>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
