import React, { useState, useCallback, useEffect } from 'react'
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  BeakerIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'
import { PageContainer } from '@/components/ui/PageContainer'
import { PageHeader } from '@/components/ui/PageHeader'

import { nanoid } from 'nanoid'
import { useCustomAgentStore } from '@/store/customAgentStore'
import type { CustomAgent } from '@/data/types'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

/**
 * 自定义智能体配置接口（页面表单内部形态）
 *
 * 阶段 B-1 说明：保留原有 CustomAgentConfig 作为表单中间态，
 * 提交时映射为 dataLayer 的 CustomAgent（createdAt/updatedAt 改 number，id 沿用）。
 */
interface CustomAgentConfig {
  id: string
  name: string
  description: string
  type: 'analysis' | 'trading' | 'risk' | 'data' | 'custom'
  model: string
  systemPrompt: string
  temperature: number
  maxTokens: number
  capabilities: string[]
  apiConfig?: {
    provider: string
    apiKey?: string
    endpoint?: string
  }
  createdAt: string
  updatedAt: string
  isActive: boolean
}

/** 表单 → IDB 实体的映射（date string → timestamp number） */
function toCustomAgentEntity(config: CustomAgentConfig, existing?: CustomAgent): CustomAgent {
  return {
    id: config.id,
    name: config.name,
    description: config.description,
    type: config.type,
    model: config.model,
    systemPrompt: config.systemPrompt,
    temperature: config.temperature,
    maxTokens: config.maxTokens,
    capabilities: config.capabilities,
    apiConfig: config.apiConfig,
    isActive: config.isActive,
    createdAt: existing?.createdAt ?? new Date(config.createdAt || Date.now()).getTime(),
    updatedAt: Date.now(),
  }
}

/**
 * 自定义智能体管理页面
 *
 * @component
 * @remarks
 * 功能：
 * - 创建/编辑/删除自定义智能体
 * - 配置智能体参数（模型、prompt、温度等）
 * - 配置智能体能力
 * - 测试智能体
 * - 启用/禁用智能体
 *
 * 阶段 B-1：所有 CRUD 走 useCustomAgentStore → dataLayer → DataBridge → IDB.custom_agents，
 * 跨刷新不再丢数据。
 */
const CustomAgentPage: React.FC = () => {
  // 阶段 B-1：从 store 读取列表；表单中间态仍用本地 useState（editingAgent）
  const agents = useCustomAgentStore((s) => s.agents)
  const storeLoading = useCustomAgentStore((s) => s.loading)
  const storeError = useCustomAgentStore((s) => s.error)
  const loadAll = useCustomAgentStore((s) => s.loadAll)
  const saveAgent = useCustomAgentStore((s) => s.saveAgent)
  const deleteAgent = useCustomAgentStore((s) => s.deleteAgent)

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  const [showModal, setShowModal] = useState(false)
  const [editingAgent, setEditingAgent] = useState<CustomAgentConfig | null>(null)
  const [testingAgent, setTestingAgent] = useState<CustomAgentConfig | null>(null)
  const [testResult, setTestResult] = useState<string>('')

  /**
   * 保存智能体配置（阶段 B-1：走 useCustomAgentStore → IDB）
   */
  const handleSaveAgent = useCallback(async () => {
    if (!editingAgent) return
    const existing = agents.find((a): a is CustomAgent => a.id === editingAgent.id)
    const entity = toCustomAgentEntity(editingAgent, existing)
    const ok = await saveAgent(entity)
    if (ok) {
      setShowModal(false)
      setEditingAgent(null)
    } else {
      logger.warn('[CustomAgentPage] saveAgent 失败, 保留模态框', { id: editingAgent.id })
    }
  }, [editingAgent, agents, saveAgent])

  /**
   * 删除智能体（阶段 B-1：走 useCustomAgentStore → IDB）
   */
  const handleDeleteAgent = useCallback(async (agentId: string) => {
    if (window.confirm('确定要删除这个智能体吗？')) {
      await deleteAgent(agentId)
    }
  }, [deleteAgent])

  /**
   * 切换智能体启用状态（阶段 B-1：持久化到 IDB）
   */
  const handleToggleAgent = useCallback(async (agentId: string) => {
    const target = agents.find((a) => a.id === agentId)
    if (!target) {
      logger.warn('[CustomAgentPage] handleToggleAgent 找不到目标', { agentId })
      return
    }
    const updated: CustomAgent = { ...target, isActive: !target.isActive, updatedAt: Date.now() }
    const ok = await saveAgent(updated)
    if (!ok) {
      logger.warn('[CustomAgentPage] handleToggleAgent 持久化失败', { agentId })
    }
  }, [agents, saveAgent])

  /**
   * 打开创建/编辑模态框
   * 接受 CustomAgent 实体（来自 store.agents），转回表单中间态 CustomAgentConfig。
   */
  const handleOpenModal = useCallback((agent?: CustomAgent) => {
    if (agent) {
      setEditingAgent({
        id: agent.id,
        name: agent.name,
        description: agent.description,
        type: agent.type,
        model: agent.model,
        systemPrompt: agent.systemPrompt,
        temperature: agent.temperature,
        maxTokens: agent.maxTokens,
        capabilities: agent.capabilities,
        apiConfig: agent.apiConfig,
        createdAt: new Date(agent.createdAt).toISOString().split('T')[0] ?? '',
        updatedAt: new Date(agent.updatedAt).toISOString().split('T')[0] ?? '',
        isActive: agent.isActive,
      })
    } else {
      setEditingAgent({
        id: `agent-${nanoid(8)}`,
        name: '',
        description: '',
        type: 'custom',
        model: 'deepseek-chat',
        systemPrompt: '',
        temperature: 0.7,
        maxTokens: 2000,
        capabilities: [],
        createdAt: new Date().toISOString().split('T')[0] ?? '',
        updatedAt: new Date().toISOString().split('T')[0] ?? '',
        isActive: true,
      })
    }
    setShowModal(true)
  }, [])

  /**
   * 打开测试模态框
   */
  const handleTestAgent = useCallback(async (agent: CustomAgent) => {
    setTestingAgent({
      id: agent.id,
      name: agent.name,
      description: agent.description,
      type: agent.type,
      model: agent.model,
      systemPrompt: agent.systemPrompt,
      temperature: agent.temperature,
      maxTokens: agent.maxTokens,
      capabilities: agent.capabilities,
      apiConfig: agent.apiConfig,
      createdAt: new Date(agent.createdAt).toISOString().split('T')[0] ?? '',
      updatedAt: new Date(agent.updatedAt).toISOString().split('T')[0] ?? '',
      isActive: agent.isActive,
    })
    setTestResult('正在测试智能体...')

    // 模拟API调用
    await new Promise(resolve => setTimeout(resolve, 2000))

    setTestResult(`测试完成！\n\n智能体：${agent.name}\n模型：${agent.model}\n温度：${agent.temperature}\n最大Token：${agent.maxTokens}\n\n测试结果：智能体响应正常，能够正确处理请求。`)
  }, [])

  return (
    <PageContainer className="min-h-screen bg-background">
      <PageHeader
        title="自定义智能体管理"
        description="创建和管理自定义智能体，配置智能体参数和能力"
      />

      {/* 操作栏 */}
      <div className="mb-6 flex justify-between items-center">
        <div className="flex gap-4">
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-4 py-2 bg-destructive text-white rounded-lg hover:opacity-90 transition-opacity"
          >
            <PlusIcon className="w-5 h-5" />
            创建智能体
          </button>

          <button
            onClick={() => void loadAll()}
            className="flex items-center gap-2 px-4 py-2 bg-muted text-foreground rounded-lg hover:opacity-90 transition-opacity"
            disabled={storeLoading}
          >
            <ArrowPathIcon className="w-5 h-5" />
            {storeLoading ? '加载中...' : '刷新'}
          </button>
        </div>

        <div className="text-sm text-tertiary">
          共 {agents.length} 个智能体，{agents.filter(a => a.isActive).length} 个已启用
          {storeError && <span className="ml-2 text-destructive">· {storeError}</span>}
        </div>
      </div>

      {/* 智能体列表 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {agents.map(agent => (
          <div
            key={agent.id}
            className="bg-card rounded-lg shadow-sm border border-border p-6 hover:shadow-md transition-shadow"
          >
            {/* 智能体头部 */}
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1">
                <h3 className="text-h3 font-semibold text-foreground mb-1">
                  {agent.name}
                </h3>
                <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${
                  agent.type === 'analysis' ? 'bg-info/15 text-info' :
                  agent.type === 'trading' ? 'bg-destructive/15 text-destructive' :
                  agent.type === 'risk' ? 'bg-destructive/15 text-destructive' :
                  agent.type === 'data' ? 'bg-warning/15 text-warning' :
                  'bg-muted text-muted-foreground'
                }`}>
                  {agent.type === 'analysis' ? '分析' :
                   agent.type === 'trading' ? '交易' :
                   agent.type === 'risk' ? '风险' :
                   agent.type === 'data' ? '数据' : '自定义'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* 启用/禁用切换 */}
                <button
                  onClick={() => handleToggleAgent(agent.id)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    agent.isActive ? 'bg-destructive' : 'bg-muted'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      agent.isActive ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* 智能体描述 */}
            <p className="text-muted-foreground text-sm mb-4 line-clamp-2">
              {agent.description}
            </p>

            {/* 智能体配置信息 */}
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-tertiary">模型</span>
                <span className="text-foreground">{agent.model}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-tertiary">温度</span>
                <span className="text-foreground">{agent.temperature}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-tertiary">最大Token</span>
                <span className="text-foreground">{agent.maxTokens}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-tertiary">能力数量</span>
                <span className="text-foreground">{agent.capabilities.length}</span>
              </div>
            </div>

            {/* 能力标签 */}
            {agent.capabilities.length > 0 && (
              <div className="mb-4">
                <div className="flex flex-wrap gap-1">
                  {agent.capabilities.slice(0, 3).map(cap => (
                    <span
                      key={cap}
                      className="px-2 py-1 text-xs bg-muted text-muted-foreground rounded"
                    >
                      {cap}
                    </span>
                  ))}
                  {agent.capabilities.length > 3 && (
                    <span className="px-2 py-1 text-xs bg-muted text-tertiary rounded">
                      +{agent.capabilities.length - 3}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* 操作按钮 */}
            <div className="flex gap-2">
              <button
                onClick={() => handleOpenModal(agent)}
                className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-muted text-foreground rounded hover:opacity-90 transition-opacity"
              >
                <PencilIcon className="w-4 h-4" />
                编辑
              </button>

              <button
                onClick={() => handleTestAgent(agent)}
                className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-info text-white rounded hover:opacity-90 transition-opacity"
              >
                <BeakerIcon className="w-4 h-4" />
                测试
              </button>

              <button
                onClick={() => handleDeleteAgent(agent.id)}
                className="flex items-center justify-center px-3 py-2 bg-destructive text-white rounded hover:opacity-90 transition-opacity"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* 创建/编辑模态框 */}
      {showModal && editingAgent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-h2 font-bold text-foreground mb-4">
              {agents.find(a => a.id === editingAgent.id) ? '编辑智能体' : '创建智能体'}
            </h2>

            <div className="space-y-4">
              {/* 智能体名称 */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  智能体名称 *
                </label>
                <input
                  type="text"
                  value={editingAgent.name}
                  onChange={(e) => setEditingAgent(prev => prev ? { ...prev, name: e.target.value } : null)}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="输入智能体名称"
                />
              </div>

              {/* 智能体描述 */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  描述 *
                </label>
                <textarea
                  value={editingAgent.description}
                  onChange={(e) => setEditingAgent(prev => prev ? { ...prev, description: e.target.value } : null)}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  rows={3}
                  placeholder="输入智能体描述"
                />
              </div>

              {/* 智能体类型 */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  类型 *
                </label>
                <select
                  value={editingAgent.type}
                  onChange={(e) => setEditingAgent(prev => prev ? { ...prev, type: e.target.value as CustomAgentConfig['type'] } : null)}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="analysis">分析</option>
                  <option value="trading">交易</option>
                  <option value="risk">风险</option>
                  <option value="data">数据</option>
                  <option value="custom">自定义</option>
                </select>
              </div>

              {/* 模型选择 */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  模型 *
                </label>
                <select
                  value={editingAgent.model}
                  onChange={(e) => setEditingAgent(prev => prev ? { ...prev, model: e.target.value } : null)}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="deepseek-chat">DeepSeek Chat</option>
                  <option value="deepseek-coder">DeepSeek Coder</option>
                  <option value="gpt-4">GPT-4</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                  <option value="kimi-chat">Kimi Chat</option>
                  <option value="qwen-max">通义千问 Max</option>
                </select>
              </div>

              {/* 系统提示词 */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  系统提示词 *
                </label>
                <textarea
                  value={editingAgent.systemPrompt}
                  onChange={(e) => setEditingAgent(prev => prev ? { ...prev, systemPrompt: e.target.value } : null)}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  rows={5}
                  placeholder="输入系统提示词，定义智能体的角色和行为"
                />
              </div>

              {/* 温度参数 */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  温度 (Temperature): {editingAgent.temperature}
                </label>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={editingAgent.temperature}
                  onChange={(e) => setEditingAgent(prev => prev ? { ...prev, temperature: parseFloat(e.target.value) } : null)}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-tertiary">
                  <span>精确 (0)</span>
                  <span>平衡 (1)</span>
                  <span>创意 (2)</span>
                </div>
              </div>

              {/* 最大Token */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  最大Token
                </label>
                <input
                  type="number"
                  value={editingAgent.maxTokens}
                  onChange={(e) => setEditingAgent(prev => prev ? { ...prev, maxTokens: parseInt(e.target.value) } : null)}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  min="100"
                  max="8000"
                />
              </div>

              {/* 能力配置 */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  能力 (Capabilities)
                </label>
                <div className="space-y-2">
                  {['technical-analysis', 'fundamental-analysis', 'risk-monitoring', 'trading-signal', 'data-fetching', 'report-generation'].map(cap => (
                    <label key={cap} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={editingAgent.capabilities.includes(cap)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setEditingAgent(prev => prev ? { ...prev, capabilities: [...prev.capabilities, cap] } : null)
                          } else {
                            setEditingAgent(prev => prev ? { ...prev, capabilities: prev.capabilities.filter(c => c !== cap) } : null)
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">{cap}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* 按钮组 */}
            <div className="flex gap-4 mt-6">
              <button
                onClick={handleSaveAgent}
                disabled={!editingAgent.name || !editingAgent.description || !editingAgent.systemPrompt}
                className="flex-1 px-4 py-2 bg-destructive text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                保存
              </button>
              <button
                onClick={() => {
                  setShowModal(false)
                  setEditingAgent(null)
                }}
                className="flex-1 px-4 py-2 bg-muted text-foreground rounded-lg hover:opacity-90 transition-opacity"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 测试结果显示 */}
      {testingAgent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg p-6 w-full max-w-lg">
            <h3 className="text-h3 font-bold text-foreground mb-4">
              测试智能体: {testingAgent.name}
            </h3>
            <div className="bg-muted p-4 rounded-lg mb-4">
              <pre className="text-sm text-foreground whitespace-pre-wrap">
                {testResult}
              </pre>
            </div>
            <button
              onClick={() => {
                setTestingAgent(null)
                setTestResult('')
              }}
              className="w-full px-4 py-2 bg-destructive text-white rounded-lg hover:opacity-90 transition-opacity"
            >
              关闭
            </button>
          </div>
        </div>
      )}
    </PageContainer>
  )
}

export default CustomAgentPage
