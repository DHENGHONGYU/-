/**
 * LLM 管理页面（容器组件）
 *
 * 功能：配置 LLM 模型、API Key、模型切换、因子控制、使用统计。
 * 架构：容器组件，仅做状态编排与 Tab 路由；具体 UI 拆分到 components/ 子目录。
 *
 * @module pages/command/agent/LlmManagement
 */

import { Save, RotateCw } from 'lucide-react'
import { Button } from '@/components/atoms/Button'
import { Badge } from '@/components/atoms/Badge'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
} from '@/components/atoms/Breadcrumb'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/molecules/Tabs'
import { PageContainer, PageHeader } from '@/components/templates'
import { useLlmConfigState } from './hooks/useLlmConfigState'
import { useLlmConfigActions } from './hooks/useLlmConfigActions'
import { LlmStatsCards } from './components/LlmStatsCards'
import { LlmConfigTab } from './components/LlmConfigTab'
import { LlmAdvancedTab } from './components/LlmAdvancedTab'
import { LlmFactorsTab } from './components/LlmFactorsTab'
import { LlmStatsTab } from './components/LlmStatsTab'

/**
 * LlmManagementPage
 */
export default function LlmManagementPage(): React.JSX.Element {
  const state = useLlmConfigState()
  const actions = useLlmConfigActions(state)

  const {
    config,
    setConfig,
    activeTab,
    setActiveTab,
    selectedPreset,
    isSaving,
    factorOverrides,
    setFactorOverrides,
    globalLlmEnabled,
    setGlobalLlmEnabled,
    usageStats,
  } = state

  return (
    <PageContainer className="space-y-6">
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

      <PageHeader
        title="LLM 管理"
        description="配置和管理 LLM 模型与 API Key"
        actions={<Badge variant="secondary">Phase E</Badge>}
      />

      <LlmStatsCards selectedPreset={selectedPreset} />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="config">基础配置</TabsTrigger>
          <TabsTrigger value="advanced">高级参数</TabsTrigger>
          <TabsTrigger value="factors">因子控制</TabsTrigger>
          <TabsTrigger value="stats">使用统计</TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-4">
          <LlmConfigTab state={state} actions={actions} />
        </TabsContent>

        <TabsContent value="advanced" className="space-y-4">
          <LlmAdvancedTab
            config={config}
            onConfigChange={(patch) => { setConfig((prev) => ({ ...prev, ...patch })) }}
          />
        </TabsContent>

        <TabsContent value="factors" className="space-y-4">
          <LlmFactorsTab
            factorOverrides={factorOverrides}
            globalLlmEnabled={globalLlmEnabled}
            onGlobalLlmEnabledChange={setGlobalLlmEnabled}
            onFactorOverrideChange={(factorId, useLlm) => {
              setFactorOverrides((prev) =>
                prev.map((o) => (o.factorId === factorId ? { ...o, useLlm } : o)),
              )
            }}
          />
        </TabsContent>

        <TabsContent value="stats" className="space-y-4">
          <LlmStatsTab usageStats={usageStats} />
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-2">
        <Button variant="outline">重置</Button>
        <Button onClick={() => { void actions.handleSave() }} disabled={isSaving}>
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
    </PageContainer>
  )
}
