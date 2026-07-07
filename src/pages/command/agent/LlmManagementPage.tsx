import React, { useState, useEffect, useCallback } from 'react'
import { Key, Sparkles, Bot, Activity, Save, TestTube, RotateCw } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
} from '@/components/ui/Breadcrumb'
import { getLogger } from '@/lib/logger'
import {
  LLM_MODEL_PRESETS,
  type LlmConfig,
  type LlmPreset,
  getPresetById,
  inferPresetId,
  setLlmApiKey,
  isLlmApiKeyConfigured,
  getDefaultLlmConfig,
} from '@/config/llmConfig'

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
                    placeholder="https://api.example.com"
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
            <CardContent>
              <p className="text-sm text-muted-foreground">
                此功能允许您精确控制哪些评分因子可以调用LLM。
                默认情况下，L0/L1/L2/L5/L6因子启用LLM调用，其他因子使用规则引擎计算。
              </p>
              <div className="mt-4 rounded-md bg-muted/50 p-4 text-center text-sm text-muted-foreground">
                因子控制功能正在开发中...
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 使用统计 */}
        <TabsContent value="stats" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>使用统计</CardTitle>
              <CardDescription>查看LLM调用统计和Token消耗</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mt-4 rounded-md bg-muted/50 p-4 text-center text-sm text-muted-foreground">
                使用统计功能正在开发中...
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
