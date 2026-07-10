import React, { useState, useEffect, useCallback } from 'react'
import { Key, Sparkles, Bot, Activity, Save, TestTube, RotateCw, Brain, Cpu, TrendingUp, DollarSign, BarChart3, Zap } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { Switch } from '@/components/ui/Switch'
import { Progress } from '@/components/ui/Progress'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
} from '@/components/ui/Breadcrumb'
import { getLogger } from '@/lib/logger'
import { API_ENDPOINT_PLACEHOLDER } from '@/config/uiPlaceholders'
import {
  LLM_MODEL_PRESETS,
  type LlmConfig,
  type LlmPreset,
  type LlmFactorOverride,
  getPresetById,
  inferPresetId,
  setLlmApiKey,
  isLlmApiKeyConfigured,
  getDefaultLlmConfig,
  DEFAULT_LLM_FACTOR_OVERRIDES,
} from '@/config/llmConfig'
import { STOCK_SCORE_FACTORS, type ScoreFactor } from '@/config/scoreFactors'

const logger = getLogger()

/**
 * LLM 管理页面
 * 功能：配置LLM模型、API Key、模型切换、使用统计
 */
export default function LlmManagementPage(): React.JSX.Element {
  const [config, setConfig] = useState<Partial<LlmConfig>>({})
  const [apiKey, setApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [selectedPreset, setSelectedPreset] = useState<string>('')
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [activeTab, setActiveTab] = useState('config')
  
  // 因子控制状态
  const [factorOverrides, setFactorOverrides] = useState<LlmFactorOverride[]>(DEFAULT_LLM_FACTOR_OVERRIDES)
  const [globalLlmEnabled, setGlobalLlmEnabled] = useState(true)
  
  // 使用统计状态（模拟数据，实际应从后端获取）
  const [usageStats] = useState({
    todayCalls: 0,
    monthCalls: 0,
    tokenUsage: { input: 0, output: 0, total: 0 },
    costEstimate: 0,
    callsByFactor: {} as Record<string, number>,
    callsByModel: {} as Record<string, number>,
  })

  // 模型筛选状态
  const [modelFilters, setModelFilters] = useState({
    minContextWindow: 0,
    maxInputPrice: Infinity,
    maxOutputPrice: Infinity,
    providers: [] as string[],
  })

  // 模型推荐场景
  const [recommendScenario, setRecommendScenario] = useState<string>('')

  // 初始化配置
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const defaultConfig = getDefaultLlmConfig()
        setConfig(defaultConfig)

        // 检查API Key是否已配置
        const isConfigured = isLlmApiKeyConfigured()
        if (isConfigured) {
          setApiKey('••••••••')
        }

        // 推断当前预设
        const presetId = inferPresetId(defaultConfig.baseURL || '')
        setSelectedPreset(presetId)
      } catch (err) {
        logger.error('[LlmManagementPage] 加载配置失败', { error: err })
      }
    }

    void loadConfig()
  }, [])

  // 保存配置
  const handleSave = useCallback(async () => {
    setIsSaving(true)
    try {
      // 保存API Key（如果已修改）
      if (apiKey && apiKey !== '••••••••') {
        await setLlmApiKey(apiKey)
      }

      // 保存配置到localStorage
      const configToSave = {
        baseURL: config.baseURL,
        model: config.model,
        maxTokens: config.maxTokens,
        temperature: config.temperature,
        timeout: config.timeout,
      }

      localStorage.setItem('v9-llm-config', JSON.stringify(configToSave))
      logger.info('[LlmManagementPage] 配置已保存', { config: configToSave })

      alert('配置保存成功！')
    } catch (err) {
      logger.error('[LlmManagementPage] 保存配置失败', { error: err })
      alert('保存失败，请重试')
    } finally {
      setIsSaving(false)
    }
  }, [config, apiKey])

  // 测试连接
  const handleTest = useCallback(async () => {
    setIsTesting(true)
    setTestResult(null)

    try {
      // 这里应该调用实际的API测试
      // 暂时模拟测试
      await new Promise((resolve) => { setTimeout(resolve, 1500) })

      setTestResult({
        success: true,
        message: '连接成功！API Key有效，模型可访问。',
      })
    } catch (err) {
      setTestResult({
        success: false,
        message: `连接失败：${err instanceof Error ? err.message : '未知错误'}`,
      })
    } finally {
      setIsTesting(false)
    }
  }, [config])

  // 选择预设
  const handlePresetChange = useCallback((presetId: string) => {
    setSelectedPreset(presetId)

    if (presetId === 'custom') {
      // 自定义模式，不清空配置
      return
    }

    const preset = getPresetById(presetId)
    if (preset) {
      setConfig((prev) => ({
        ...prev,
        baseURL: preset.baseURL,
        model: preset.defaultModel,
      }))
    }
  }, [])

  // 模型选项
  const getCurrentModels = (): string[] => {
    if (selectedPreset === 'custom') {
      return config.model ? [config.model] : []
    }

    const preset = getPresetById(selectedPreset)
    return preset?.models ?? []
  }

  // 筛选后的模型预设列表
  const getFilteredPresets = useCallback((): LlmPreset[] => {
    return LLM_MODEL_PRESETS.filter((preset) => {
      // 提供商筛选
      if (modelFilters.providers.length > 0 && !modelFilters.providers.includes(preset.provider)) {
        return false
      }
      // 上下文窗口筛选
      if (preset.contextWindow && preset.contextWindow < modelFilters.minContextWindow) {
        return false
      }
      // 价格筛选
      const inputPrice = preset.inputPrice ? parseFloat(preset.inputPrice.replace('$', '')) : 0
      const outputPrice = preset.outputPrice ? parseFloat(preset.outputPrice.replace('$', '')) : 0
      if (inputPrice > modelFilters.maxInputPrice || outputPrice > modelFilters.maxOutputPrice) {
        return false
      }
      return true
    })
  }, [modelFilters])

  // 获取所有可用的提供商
  const getAvailableProviders = useCallback((): string[] => {
    const providers = new Set(LLM_MODEL_PRESETS.map((p) => p.provider).filter((p) => p))
    return Array.from(providers)
  }, [])

  // 模型推荐逻辑
  const getRecommendedModels = useCallback((): LlmPreset[] => {
    if (!recommendScenario) return []

    const recommendations: LlmPreset[] = []

    switch (recommendScenario) {
      case 'cost_effective':
        // 性价比优先：选择价格最低的模型
        recommendations.push(
          ...LLM_MODEL_PRESETS.filter((p) => p.id !== 'custom')
            .sort((a, b) => {
              const priceA = a.inputPrice ? parseFloat(a.inputPrice.replace('$', '')) : 999
              const priceB = b.inputPrice ? parseFloat(b.inputPrice.replace('$', '')) : 999
              return priceA - priceB
            })
            .slice(0, 2)
        )
        break
      case 'high_performance':
        // 高性能优先：选择上下文窗口最大的模型
        recommendations.push(
          ...LLM_MODEL_PRESETS.filter((p) => p.id !== 'custom')
            .sort((a, b) => (b.contextWindow ?? 0) - (a.contextWindow ?? 0))
            .slice(0, 2)
        )
        break
      case 'fast_response':
        // 快速响应：推荐 Flash 系列模型
        recommendations.push(
          ...LLM_MODEL_PRESETS.filter((p) => p.id !== 'custom')
            .filter((p) => p.models.some((m) => m.toLowerCase().includes('flash')))
        )
        break
      case 'long_context':
        // 长文本分析：推荐上下文窗口 > 100K 的模型
        recommendations.push(
          ...LLM_MODEL_PRESETS.filter((p) => p.id !== 'custom' && (p.contextWindow ?? 0) >= 100000)
        )
        break
      case 'balanced':
        // 均衡推荐：综合价格和性能
        const deepseek = LLM_MODEL_PRESETS.find((p) => p.id === 'deepseek')
        const qwen = LLM_MODEL_PRESETS.find((p) => p.id === 'qwen')
        if (deepseek) recommendations.push(deepseek)
        if (qwen) recommendations.push(qwen)
        break
    }

    return recommendations
  }, [recommendScenario])

  return (
    <div className="space-y-6">
      {/* 面包屑导航 */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <a href="/">首页</a>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <a href="/command/hub">总控舱</a>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <a href="/command/agents">智能体总控台</a>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbItem>
            <BreadcrumbPage>LLM 管理</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* 页面标题 */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">LLM 管理</h1>
          <p className="text-muted-foreground">
            配置和管理 LLM 模型与 API Key
          </p>
        </div>
        <Badge variant="secondary">Phase E</Badge>
      </div>

      {/* 统计卡片 */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10 text-success">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{selectedPreset ? getPresetById(selectedPreset)?.name ?? '自定义' : '-'}</p>
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
              <p className="text-2xl font-bold">{isLlmApiKeyConfigured() ? '已配置' : '未配置'}</p>
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
              <p className="text-2xl font-bold">0</p>
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
              <p className="text-2xl font-bold">0</p>
              <p className="text-sm text-muted-foreground">活跃 Agent</p>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 主配置区域 */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="config">基础配置</TabsTrigger>
          <TabsTrigger value="advanced">高级参数</TabsTrigger>
          <TabsTrigger value="factors">因子控制</TabsTrigger>
          <TabsTrigger value="stats">使用统计</TabsTrigger>
        </TabsList>

        {/* 基础配置 */}
        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>模型预设</CardTitle>
              <CardDescription>选择LLM模型预设或自定义配置</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>模型提供商</Label>
                <Select value={selectedPreset} onValueChange={handlePresetChange}>
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
                    onChange={(e) => {
                      setConfig((prev) => ({ ...prev, baseURL: e.target.value }))
                    }}
                    placeholder={API_ENDPOINT_PLACEHOLDER}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>模型选择</Label>
                <Select
                  value={config.model ?? ''}
                  onValueChange={(value) => {
                    setConfig((prev) => ({ ...prev, model: value }))
                  }}
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

          {/* 模型能力筛选面板 */}
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
                        setModelFilters((prev) => ({
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
                  max="1000000"
                  step="32000"
                  value={modelFilters.minContextWindow}
                  onChange={(e) => {
                    setModelFilters((prev) => ({ ...prev, minContextWindow: Number(e.target.value) }))
                  }}
                />
              </div>

              {/* 价格筛选 */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>最高输入价格: ${modelFilters.maxInputPrice === Infinity ? '不限' : modelFilters.maxInputPrice.toFixed(2)}</Label>
                  <Input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={modelFilters.maxInputPrice === Infinity ? 2 : modelFilters.maxInputPrice}
                    onChange={(e) => {
                      const value = Number(e.target.value)
                      setModelFilters((prev) => ({
                        ...prev,
                        maxInputPrice: value >= 2 ? Infinity : value,
                      }))
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label>最高输出价格: ${modelFilters.maxOutputPrice === Infinity ? '不限' : modelFilters.maxOutputPrice.toFixed(2)}</Label>
                  <Input
                    type="range"
                    min="0"
                    max="3"
                    step="0.1"
                    value={modelFilters.maxOutputPrice === Infinity ? 3 : modelFilters.maxOutputPrice}
                    onChange={(e) => {
                      const value = Number(e.target.value)
                      setModelFilters((prev) => ({
                        ...prev,
                        maxOutputPrice: value >= 3 ? Infinity : value,
                      }))
                    }}
                  />
                </div>
              </div>

              {/* 筛选结果 */}
              <div className="space-y-2">
                <Label>符合条件的模型 ({getFilteredPresets().length})</Label>
                <div className="space-y-2">
                  {getFilteredPresets().length === 0 ? (
                    <div className="rounded-lg border border-dashed p-6 text-center">
                      <p className="text-sm text-muted-foreground">没有符合条件的模型</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2"
                        onClick={() => {
                          setModelFilters({
                            minContextWindow: 0,
                            maxInputPrice: Infinity,
                            maxOutputPrice: Infinity,
                            providers: [],
                          })
                        }}
                      >
                        重置筛选条件
                      </Button>
                    </div>
                  ) : (
                    getFilteredPresets().map((preset) => (
                      <div
                        key={preset.id}
                        className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                      >
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{preset.name}</span>
                            <Badge variant="outline" className="text-xs">
                              {preset.provider}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>上下文: {preset.contextWindow?.toLocaleString() ?? '未知'}</span>
                            <span>输入: {preset.inputPrice ?? '未知'}</span>
                            <span>输出: {preset.outputPrice ?? '未知'}</span>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedPreset(preset.id)
                            setConfig((prev) => ({
                              ...prev,
                              baseURL: preset.baseURL,
                              model: preset.defaultModel,
                            }))
                          }}
                        >
                          选择
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* 重置按钮 */}
              {(modelFilters.providers.length > 0 || modelFilters.minContextWindow > 0 || modelFilters.maxInputPrice < Infinity || modelFilters.maxOutputPrice < Infinity) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setModelFilters({
                      minContextWindow: 0,
                      maxInputPrice: Infinity,
                      maxOutputPrice: Infinity,
                      providers: [],
                    })
                  }}
                >
                  重置筛选
                </Button>
              )}
            </CardContent>
          </Card>

          {/* 模型推荐面板 */}
          <Card>
            <CardHeader>
              <CardTitle>智能模型推荐</CardTitle>
              <CardDescription>基于使用场景推荐最合适的模型</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>选择使用场景</Label>
                <Select value={recommendScenario} onValueChange={setRecommendScenario}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择您的主要使用场景" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cost_effective">性价比优先 - 适合日常高频调用</SelectItem>
                    <SelectItem value="high_performance">高性能优先 - 适合复杂分析任务</SelectItem>
                    <SelectItem value="fast_response">快速响应 - 适合实时交互场景</SelectItem>
                    <SelectItem value="long_context">长文本分析 - 适合研报/年报分析</SelectItem>
                    <SelectItem value="balanced">均衡推荐 - 综合价格与性能</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {recommendScenario && (
                <div className="space-y-2">
                  <Label>推荐模型 ({getRecommendedModels().length})</Label>
                  <div className="space-y-2">
                    {getRecommendedModels().length === 0 ? (
                      <div className="rounded-lg border border-dashed p-6 text-center">
                        <p className="text-sm text-muted-foreground">暂无推荐模型</p>
                      </div>
                    ) : (
                      getRecommendedModels().map((preset) => (
                        <div
                          key={preset.id}
                          className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                        >
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{preset.name}</span>
                              <Badge variant="outline" className="text-xs">
                                {preset.provider}
                              </Badge>
                              <Badge variant="secondary" className="text-xs bg-primary/10 text-primary">
                                推荐
                              </Badge>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span>上下文: {preset.contextWindow?.toLocaleString() ?? '未知'}</span>
                              <span>输入: {preset.inputPrice ?? '未知'}</span>
                              <span>输出: {preset.outputPrice ?? '未知'}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {recommendScenario === 'cost_effective' && '价格最优，适合高频调用场景'}
                              {recommendScenario === 'high_performance' && '上下文窗口最大，适合复杂分析'}
                              {recommendScenario === 'fast_response' && 'Flash 系列，响应速度最快'}
                              {recommendScenario === 'long_context' && '支持超长文本，适合研报分析'}
                              {recommendScenario === 'balanced' && '价格与性能均衡，适合大多数场景'}
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedPreset(preset.id)
                              setConfig((prev) => ({
                                ...prev,
                                baseURL: preset.baseURL,
                                model: preset.defaultModel,
                              }))
                            }}
                          >
                            选择
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* 重置推荐 */}
              {recommendScenario && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setRecommendScenario('')}
                >
                  重置推荐
                </Button>
              )}
            </CardContent>
          </Card>

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
                    onChange={(e) => { setApiKey(e.target.value) }}
                    placeholder="输入 API Key"
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setShowApiKey(!showApiKey) }}
                  >
                    {showApiKey ? '隐藏' : '显示'}
                  </Button>
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleTest} disabled={isTesting || !apiKey || apiKey === '••••••••'}>
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
        </TabsContent>

        {/* 高级参数 */}
        <TabsContent value="advanced" className="space-y-4">
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
                  value={config.maxTokens ?? 4096}
                  onChange={(e) => {
                    setConfig((prev) => ({ ...prev, maxTokens: Number(e.target.value) }))
                  }}
                />
                <p className="text-sm text-muted-foreground">控制LLM单次输出的最大Token数</p>
              </div>

              <div className="space-y-2">
                <Label>采样温度 ({config.temperature ?? 0.7})</Label>
                <Input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={config.temperature ?? 0.7}
                  onChange={(e) => {
                    setConfig((prev) => ({ ...prev, temperature: Number(e.target.value) }))
                  }}
                />
                <p className="text-sm text-muted-foreground">较低的值使输出更确定，较高的值使输出更随机</p>
              </div>

              <div className="space-y-2">
                <Label>请求超时时间（毫秒）</Label>
                <Input
                  type="number"
                  value={config.timeout ?? 30000}
                  onChange={(e) => {
                    setConfig((prev) => ({ ...prev, timeout: Number(e.target.value) }))
                  }}
                />
                <p className="text-sm text-muted-foreground">LLM API请求的超时时间</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 因子控制 */}
        <TabsContent value="factors" className="space-y-4">
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
                  onChange={(e) => setGlobalLlmEnabled(e.target.checked)}
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
                    const override = factorOverrides.find(o => o.factorId === factor.name)
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
                          onChange={(e) => {
                            const checked = e.target.checked
                            setFactorOverrides(prev =>
                              prev.map(o =>
                                o.factorId === factor.name
                                  ? { ...o, useLlm: checked }
                                  : o
                              )
                            )
                          }}
                          disabled={!globalLlmEnabled}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* 统计信息 */}
              <div className="rounded-lg bg-muted/50 p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">启用LLM的因子数</span>
                  <span className="font-medium">
                    {factorOverrides.filter(o => o.useLlm).length} / {factorOverrides.length}
                  </span>
                </div>
                <Progress
                  value={(factorOverrides.filter(o => o.useLlm).length / factorOverrides.length) * 100}
                  className="mt-2"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 使用统计 */}
        <TabsContent value="stats" className="space-y-4">
          {/* KPI卡片 */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Zap className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{usageStats.todayCalls}</p>
                  <p className="text-sm text-muted-foreground">今日调用</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-info/10 text-info">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{usageStats.monthCalls}</p>
                  <p className="text-sm text-muted-foreground">本月调用</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10 text-warning">
                  <Cpu className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{usageStats.tokenUsage.total.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">Token消耗</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10 text-success">
                  <DollarSign className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">${usageStats.costEstimate.toFixed(2)}</p>
                  <p className="text-sm text-muted-foreground">成本估算</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 详细统计 */}
          <Card>
            <CardHeader>
              <CardTitle>调用详情</CardTitle>
              <CardDescription>按因子和模型维度的调用统计</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Token消耗明细 */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Token消耗明细</Label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">输入Token</span>
                      <span className="text-sm font-medium">{usageStats.tokenUsage.input.toLocaleString()}</span>
                    </div>
                    <Progress
                      value={usageStats.tokenUsage.total > 0 ? (usageStats.tokenUsage.input / usageStats.tokenUsage.total) * 100 : 0}
                      className="mt-2"
                    />
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">输出Token</span>
                      <span className="text-sm font-medium">{usageStats.tokenUsage.output.toLocaleString()}</span>
                    </div>
                    <Progress
                      value={usageStats.tokenUsage.total > 0 ? (usageStats.tokenUsage.output / usageStats.tokenUsage.total) * 100 : 0}
                      className="mt-2"
                    />
                  </div>
                </div>
              </div>

              {/* 按因子统计 */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">按因子统计</Label>
                {Object.keys(usageStats.callsByFactor).length === 0 ? (
                  <div className="rounded-lg border border-dashed p-6 text-center">
                    <BarChart3 className="mx-auto h-8 w-8 text-muted-foreground" />
                    <p className="mt-2 text-sm text-muted-foreground">暂无调用数据</p>
                    <p className="text-xs text-muted-foreground">开始评分后将显示各因子的调用次数</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(usageStats.callsByFactor).map(([factor, count]) => (
                      <div key={factor} className="flex items-center justify-between rounded-lg border p-3">
                        <span className="text-sm">{factor}</span>
                        <Badge variant="secondary">{count} 次</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 按模型统计 */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">按模型统计</Label>
                {Object.keys(usageStats.callsByModel).length === 0 ? (
                  <div className="rounded-lg border border-dashed p-6 text-center">
                    <BarChart3 className="mx-auto h-8 w-8 text-muted-foreground" />
                    <p className="mt-2 text-sm text-muted-foreground">暂无调用数据</p>
                    <p className="text-xs text-muted-foreground">开始评分后将显示各模型的调用次数</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(usageStats.callsByModel).map(([model, count]) => (
                      <div key={model} className="flex items-center justify-between rounded-lg border p-3">
                        <span className="text-sm font-mono">{model}</span>
                        <Badge variant="secondary">{count} 次</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 说明 */}
              <div className="rounded-lg bg-muted/50 p-4">
                <p className="text-xs text-muted-foreground">
                  <strong>说明：</strong>使用统计数据将在评分任务执行后自动更新。
                  Token消耗和成本估算基于当前模型的定价计算。
                  如需查看详细调用日志，请访问"日志管理"页面。
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 保存按钮 */}
      <div className="flex justify-end gap-2">
        <Button variant="outline">重置</Button>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <>
              <RotateCw className="mr-2 h-4 w-4 animate-spin" />
              保存中...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              保存配置
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
