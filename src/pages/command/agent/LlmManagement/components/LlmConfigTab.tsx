/**
 * LLM 管理 - 基础配置 Tab
 *
 * 包含：模型预设选择、模型能力筛选、模型推荐、API 密钥配置
 *
 * @module LlmManagement/components/LlmConfigTab
 */

import { TestTube, RotateCw } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/atoms/Card'
import { Button } from '@/components/atoms/Button'
import { Badge } from '@/components/atoms/Badge'
import { Input } from '@/components/atoms/Input'
import { Label } from '@/components/atoms/Label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/atoms/Select'
import {
  LLM_MODEL_PRESETS,
  type LlmConfig,
  type LlmPreset,
} from '@/config/llmConfig'
import { API_ENDPOINT_PLACEHOLDER } from '@/config/uiPlaceholders'
import type { LlmConfigActions } from '../hooks/useLlmConfigActions'
import type { LlmConfigState, ModelFilters, TestResult } from '../hooks/useLlmConfigState'

interface LlmConfigTabProps {
  state: LlmConfigState
  actions: LlmConfigActions
}

const CONTEXT_WINDOW_STEP = 32000
const CONTEXT_WINDOW_MAX = 1_000_000
const RECOMMEND_SCENARIO_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'cost_effective', label: '性价比优先 - 适合日常高频调用' },
  { value: 'high_performance', label: '高性能优先 - 适合复杂分析任务' },
  { value: 'fast_response', label: '快速响应 - 适合实时交互场景' },
  { value: 'long_context', label: '长文本分析 - 适合研报/年报分析' },
  { value: 'balanced', label: '均衡推荐 - 综合价格与性能' },
]

const RECOMMEND_HINTS: Record<string, string> = {
  cost_effective: '价格最优，适合高频调用场景',
  high_performance: '上下文窗口最大，适合复杂分析',
  fast_response: 'Flash 系列，响应速度最快',
  long_context: '支持超长文本，适合研报分析',
  balanced: '价格与性能均衡，适合大多数场景',
}

const INITIAL_MODEL_FILTERS: ModelFilters = {
  minContextWindow: 0,
  maxInputPrice: Number.POSITIVE_INFINITY,
  maxOutputPrice: Number.POSITIVE_INFINITY,
  providers: [],
}

export function LlmConfigTab({ state, actions }: LlmConfigTabProps): React.JSX.Element {
  const {
    config,
    setConfig,
    apiKey,
    setApiKey,
    showApiKey,
    setShowApiKey,
    selectedPreset,
    setSelectedPreset,
    isTesting,
    testResult,
    modelFilters,
    setModelFilters,
    recommendScenario,
    setRecommendScenario,
  } = state

  return (
    <div className="space-y-4">
      <PresetSelectorCard
        config={config}
        selectedPreset={selectedPreset}
        onPresetChange={actions.handlePresetChange}
        onConfigChange={(patch) => { setConfig((prev) => ({ ...prev, ...patch })) }}
        getCurrentModels={actions.getCurrentModels}
      />

      <ModelFilterCard
        modelFilters={modelFilters}
        onFiltersChange={setModelFilters}
        getAvailableProviders={actions.getAvailableProviders}
        getFilteredPresets={actions.getFilteredPresets}
        onSelectPreset={(preset) => {
          setSelectedPreset(preset.id)
          setConfig((prev) => ({ ...prev, baseURL: preset.baseURL, model: preset.defaultModel }))
        }}
      />

      <ModelRecommendCard
        scenario={recommendScenario}
        onScenarioChange={setRecommendScenario}
        recommendations={actions.getRecommendedModels()}
        onSelectPreset={(preset) => {
          setSelectedPreset(preset.id)
          setConfig((prev) => ({ ...prev, baseURL: preset.baseURL, model: preset.defaultModel }))
        }}
      />

      <ApiKeyCard
        apiKey={apiKey}
        onApiKeyChange={setApiKey}
        showApiKey={showApiKey}
        onToggleShow={() => { setShowApiKey(!showApiKey) }}
        isTesting={isTesting}
        testResult={testResult}
        onTest={actions.handleTest}
      />
    </div>
  )
}

// ──────────────────────────────────────────────────────────
// 子组件
// ──────────────────────────────────────────────────────────

interface PresetSelectorCardProps {
  config: Partial<LlmConfig>
  selectedPreset: string
  onPresetChange: (id: string) => void
  onConfigChange: (patch: Partial<LlmConfig>) => void
  getCurrentModels: () => string[]
}

function PresetSelectorCard({
  config,
  selectedPreset,
  onPresetChange,
  onConfigChange,
  getCurrentModels,
}: PresetSelectorCardProps): React.JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>模型预设</CardTitle>
        <CardDescription>选择LLM模型预设或自定义配置</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>模型提供商</Label>
          <Select value={selectedPreset} onValueChange={onPresetChange}>
            <SelectTrigger>
              <SelectValue placeholder="选择模型预设" />
            </SelectTrigger>
            <SelectContent>
              {LLM_MODEL_PRESETS.map((preset: LlmPreset) => (
                <SelectItem key={preset.id} value={preset.id}>
                  {preset.name} ({preset.provider})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedPreset === 'custom' && (
          <div className="space-y-2">
            <Label>Base URL</Label>
            <Input
              value={config.baseURL ?? ''}
              onChange={(e) => { onConfigChange({ baseURL: e.target.value }) }}
              placeholder={API_ENDPOINT_PLACEHOLDER}
            />
          </div>
        )}

        <div className="space-y-2">
          <Label>模型选择</Label>
          <Select
            value={config.model ?? ''}
            onValueChange={(value) => { onConfigChange({ model: value }) }}
          >
            <SelectTrigger>
              <SelectValue placeholder="选择模型" />
            </SelectTrigger>
            <SelectContent>
              {getCurrentModels().map((model) => (
                <SelectItem key={model} value={model}>
                  {model}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  )
}

interface ModelFilterCardProps {
  modelFilters: ModelFilters
  onFiltersChange: React.Dispatch<React.SetStateAction<ModelFilters>>
  getAvailableProviders: () => string[]
  getFilteredPresets: () => LlmPreset[]
  onSelectPreset: (preset: LlmPreset) => void
}

function ModelFilterCard({
  modelFilters,
  onFiltersChange,
  getAvailableProviders,
  getFilteredPresets,
  onSelectPreset,
}: ModelFilterCardProps): React.JSX.Element {
  const filteredPresets = getFilteredPresets()
  const hasActiveFilters =
    modelFilters.providers.length > 0 ||
    modelFilters.minContextWindow > 0 ||
    modelFilters.maxInputPrice < Number.POSITIVE_INFINITY ||
    modelFilters.maxOutputPrice < Number.POSITIVE_INFINITY

  return (
    <Card>
      <CardHeader>
        <CardTitle>模型能力筛选</CardTitle>
        <CardDescription>根据需求筛选合适的模型</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 提供商筛选 */}
        <div className="space-y-2">
          <Label>提供商</Label>
          <div className="flex flex-wrap gap-2">
            {getAvailableProviders().map((provider) => (
              <Badge
                key={provider}
                variant={modelFilters.providers.includes(provider) ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => {
                  onFiltersChange((prev) => ({
                    ...prev,
                    providers: prev.providers.includes(provider)
                      ? prev.providers.filter((p) => p !== provider)
                      : [...prev.providers, provider],
                  }))
                }}
              >
                {provider}
              </Badge>
            ))}
          </div>
        </div>

        {/* 上下文窗口筛选 */}
        <div className="space-y-2">
          <Label>最小上下文窗口: {modelFilters.minContextWindow.toLocaleString()} tokens</Label>
          <Input
            type="range"
            min="0"
            max={CONTEXT_WINDOW_MAX}
            step={CONTEXT_WINDOW_STEP}
            value={modelFilters.minContextWindow}
            onChange={(e) => {
              onFiltersChange((prev) => ({ ...prev, minContextWindow: Number(e.target.value) }))
            }}
          />
        </div>

        {/* 价格筛选 */}
        <div className="grid gap-4 sm:grid-cols-2">
          <PriceSlider
            label="最高输入价格"
            value={modelFilters.maxInputPrice}
            max={2}
            onChange={(v) => { onFiltersChange((prev) => ({ ...prev, maxInputPrice: v })) }}
          />
          <PriceSlider
            label="最高输出价格"
            value={modelFilters.maxOutputPrice}
            max={3}
            onChange={(v) => { onFiltersChange((prev) => ({ ...prev, maxOutputPrice: v })) }}
          />
        </div>

        {/* 筛选结果 */}
        <div className="space-y-2">
          <Label>符合条件的模型 ({filteredPresets.length})</Label>
          {filteredPresets.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <p className="text-sm text-muted-foreground">没有符合条件的模型</p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() => { onFiltersChange(INITIAL_MODEL_FILTERS) }}
              >
                重置筛选条件
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredPresets.map((preset) => (
                <PresetRow key={preset.id} preset={preset} onSelect={onSelectPreset} />
              ))}
            </div>
          )}
        </div>

        {/* 重置按钮 */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { onFiltersChange(INITIAL_MODEL_FILTERS) }}
          >
            重置筛选
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

interface PriceSliderProps {
  label: string
  value: number
  max: number
  onChange: (v: number) => void
}

function PriceSlider({ label, value, max, onChange }: PriceSliderProps): React.JSX.Element {
  const display = value === Number.POSITIVE_INFINITY ? '不限' : `$${value.toFixed(2)}`
  const sliderValue = value === Number.POSITIVE_INFINITY ? max : value

  return (
    <div className="space-y-2">
      <Label>{label}: {display}</Label>
      <Input
        type="range"
        min="0"
        max={max}
        step="0.1"
        value={sliderValue}
        onChange={(e) => {
          const v = Number(e.target.value)
          onChange(v >= max ? Number.POSITIVE_INFINITY : v)
        }}
      />
    </div>
  )
}

function PresetRow({ preset, onSelect }: { preset: LlmPreset; onSelect: (p: LlmPreset) => void }): React.JSX.Element {
  return (
    <div className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50">
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{preset.name}</span>
          <Badge variant="outline" className="text-xs">{preset.provider}</Badge>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>上下文: {preset.contextWindow?.toLocaleString() ?? '未知'}</span>
          <span>输入: {preset.inputPrice ?? '未知'}</span>
          <span>输出: {preset.outputPrice ?? '未知'}</span>
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={() => { onSelect(preset) }}>
        选择
      </Button>
    </div>
  )
}

interface ModelRecommendCardProps {
  scenario: string
  onScenarioChange: (s: string) => void
  recommendations: LlmPreset[]
  onSelectPreset: (preset: LlmPreset) => void
}

function ModelRecommendCard({
  scenario,
  onScenarioChange,
  recommendations,
  onSelectPreset,
}: ModelRecommendCardProps): React.JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>智能模型推荐</CardTitle>
        <CardDescription>基于使用场景推荐最合适的模型</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>选择使用场景</Label>
          <Select value={scenario} onValueChange={onScenarioChange}>
            <SelectTrigger>
              <SelectValue placeholder="选择您的主要使用场景" />
            </SelectTrigger>
            <SelectContent>
              {RECOMMEND_SCENARIO_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {scenario && (
          <div className="space-y-2">
            <Label>推荐模型 ({recommendations.length})</Label>
            {recommendations.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center">
                <p className="text-sm text-muted-foreground">暂无推荐模型</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recommendations.map((preset) => (
                  <RecommendationRow
                    key={preset.id}
                    preset={preset}
                    hint={RECOMMEND_HINTS[scenario] ?? ''}
                    onSelect={onSelectPreset}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {scenario && (
          <Button variant="ghost" size="sm" onClick={() => { onScenarioChange('') }}>
            重置推荐
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

function RecommendationRow({
  preset,
  hint,
  onSelect,
}: {
  preset: LlmPreset
  hint: string
  onSelect: (p: LlmPreset) => void
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50">
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{preset.name}</span>
          <Badge variant="outline" className="text-xs">{preset.provider}</Badge>
          <Badge variant="secondary" className="text-xs bg-primary/10 text-primary">推荐</Badge>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>上下文: {preset.contextWindow?.toLocaleString() ?? '未知'}</span>
          <span>输入: {preset.inputPrice ?? '未知'}</span>
          <span>输出: {preset.outputPrice ?? '未知'}</span>
        </div>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <Button variant="outline" size="sm" onClick={() => { onSelect(preset) }}>
        选择
      </Button>
    </div>
  )
}

interface ApiKeyCardProps {
  apiKey: string
  onApiKeyChange: (v: string) => void
  showApiKey: boolean
  onToggleShow: () => void
  isTesting: boolean
  testResult: TestResult | null
  onTest: () => Promise<void>
}

const API_KEY_MASK = '••••••••'

function ApiKeyCard({
  apiKey,
  onApiKeyChange,
  showApiKey,
  onToggleShow,
  isTesting,
  testResult,
  onTest,
}: ApiKeyCardProps): React.JSX.Element {
  const canTest = !isTesting && !!apiKey && apiKey !== API_KEY_MASK
  return (
    <Card>
      <CardHeader>
        <CardTitle>API 密钥配置</CardTitle>
        <CardDescription>配置LLM API Key（将加密存储）</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>API Key</Label>
          <div className="flex gap-2">
            <Input
              type={showApiKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => { onApiKeyChange(e.target.value) }}
              placeholder="输入 API Key"
              className="flex-1"
            />
            <Button variant="outline" size="sm" onClick={onToggleShow}>
              {showApiKey ? '隐藏' : '显示'}
            </Button>
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={() => { void onTest() }} disabled={!canTest}>
            {isTesting ? (
              <>
                <RotateCw className="mr-2 h-4 w-4 animate-spin" />
                测试中...
              </>
            ) : (
              <>
                <TestTube className="mr-2 h-4 w-4" />
                测试连接
              </>
            )}
          </Button>
        </div>

        {testResult && (
          <div className={`rounded-md p-3 ${testResult.success ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
            {testResult.message}
          </div>
        )}
      </CardContent>
    </Card>
  )
}


