/**
 * LLM 管理 - 高级参数 Tab
 *
 * @module LlmManagement/components/LlmAdvancedTab
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/atoms/Card'
import { Input } from '@/components/atoms/Input'
import { Label } from '@/components/atoms/Label'
import type { LlmConfig } from '@/config/llmConfig'

interface LlmAdvancedTabProps {
  config: Partial<LlmConfig>
  onConfigChange: (patch: Partial<LlmConfig>) => void
}

const DEFAULT_MAX_TOKENS = 4096
const DEFAULT_TEMPERATURE = 0.7
const DEFAULT_TIMEOUT = 30000

/**
 * LlmAdvancedTab
 * @param onConfigChange }
 */
export function LlmAdvancedTab({ config, onConfigChange }: LlmAdvancedTabProps): React.JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>高级参数配置</CardTitle>
        <CardDescription>配置LLM调用的高级参数</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>最大输出 Token 数</Label>
          <Input
            type="number"
            value={config.maxTokens ?? DEFAULT_MAX_TOKENS}
            onChange={(e) => { onConfigChange({ maxTokens: Number(e.target.value) }) }}
          />
          <p className="text-sm text-muted-foreground">控制LLM单次输出的最大Token数</p>
        </div>

        <div className="space-y-2">
          <Label>采样温度 ({config.temperature ?? DEFAULT_TEMPERATURE})</Label>
          <Input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={config.temperature ?? DEFAULT_TEMPERATURE}
            onChange={(e) => { onConfigChange({ temperature: Number(e.target.value) }) }}
          />
          <p className="text-sm text-muted-foreground">较低的值使输出更确定，较高的值使输出更随机</p>
        </div>

        <div className="space-y-2">
          <Label>请求超时时间（毫秒）</Label>
          <Input
            type="number"
            value={config.timeout ?? DEFAULT_TIMEOUT}
            onChange={(e) => { onConfigChange({ timeout: Number(e.target.value) }) }}
          />
          <p className="text-sm text-muted-foreground">LLM API请求的超时时间</p>
        </div>
      </CardContent>
    </Card>
  )
}
