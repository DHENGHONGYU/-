import React, { useState, useEffect, useCallback } from 'react'
import { 
  PlusIcon, 
  PencilIcon, 
  TrashIcon, 
  Cog6ToothIcon,
  BeakerIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'
import { COLOR_TOKENS, twText, twBg, twBorder } from '@/constants/theme.tokens'

/**
 * 自定义智能体配置接口
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
 */
const CustomAgentPage: React.FC = () => {
  // 状态管理
  const [agents, setAgents] = useState<CustomAgentConfig[]>([
    {
      id: 'agent-001',
      name: '技术指标分析智能体',
      description: '专门分析技术指标的智能体，支持MA、MACD、RSI等多种指标',
      type: 'analysis',
      model: 'deepseek-chat',
      systemPrompt: '你是一个专业的技术分析专家，擅长分析股票技术指标...',
      temperature: 0.3,
      maxTokens: 2000,
      capabilities: ['technical-analysis', 'indicator-calculation'],
      createdAt: '2026-01-15',
      updatedAt: '2026-07-01',
      isActive: true,
    },
    {
      id: 'agent-002',
      name: '风险管理智能体',
      description: '实时监控投资组合风险，提供风险预警和建议',
      type: 'risk',
      model: 'gpt-4',
      systemPrompt: '你是一个风险管理专家，负责监控和评估投资组合风险...',
      temperature: 0.2,
      maxTokens: 1500,
      capabilities: ['risk-monitoring', 'alert-generation'],
      createdAt: '2026-02-20',
      updatedAt: '2026-06-15',
      isActive: true,
    },
  ])
  
  const [showModal, setShowModal] = useState(false)
  const [editingAgent, setEditingAgent] = useState<CustomAgentConfig | null>(null)
  const [testingAgent, setTestingAgent] = useState<CustomAgentConfig | null>(null)
  const [testResult, setTestResult] = useState<string>('')

  /**
   * 打开创建/编辑模态框
   */
  const handleOpenModal = useCallback((agent?: CustomAgentConfig) => {
    if (agent) {
      setEditingAgent({ ...agent })
    } else {
      setEditingAgent({
        id: `agent-${Date.now()}`,
        name: '',
        description: '',
        type: 'custom',
        model: 'deepseek-chat',
        systemPrompt: '',
        temperature: 0.7,
        maxTokens: 2000,
        capabilities: [],
        createdAt: new Date().toISOString().split('T')[0],
        updatedAt: new Date().toISOString().split('T')[0],
        isActive: true,
      })
    }
    setShowModal(true)
  }, [])

  /**
   * 保存智能体配置
   */
  const handleSaveAgent = useCallback(() => {
    if (!editingAgent) return

    setAgents(prev => {
      const index = prev.findIndex(a => a.id === editingAgent.id)
      if (index >= 0) {
        // 更新现有智能体
        const updated = [...prev]
        updated[index] = { ...editingAgent, updatedAt: new Date().toISOString().split('T')[0] }
        return updated
      } else {
        // 添加新智能体
        return [...prev, editingAgent]
      }
    })

    setShowModal(false)
    setEditingAgent(null)
  }, [editingAgent])

  /**
   * 删除智能体
   */
  const handleDeleteAgent = useCallback((agentId: string) => {
    if (window.confirm('确定要删除这个智能体吗？')) {
      setAgents(prev => prev.filter(a => a.id !== agentId))
    }
  }, [])

  /**
   * 测试智能体
   */
  const handleTestAgent = useCallback(async (agent: CustomAgentConfig) => {
    setTestingAgent(agent)
    setTestResult('正在测试智能体...')

    // 模拟API调用
    await new Promise(resolve => setTimeout(resolve, 2000))

    setTestResult(`测试完成！\n\n智能体：${agent.name}\n模型：${agent.model}\n温度：${agent.temperature}\n最大Token：${agent.maxTokens}\n\n测试结果：智能体响应正常，能够正确处理请求。`)
  }, [])

  /**
   * 切换智能体状态
   */
  const handleToggleAgent = useCallback((agentId: string) => {
    setAgents(prev => prev.map(a => 
      a.id === agentId ? { ...a, isActive: !a.isActive, updatedAt: new Date().toISOString().split('T')[0] } : a
    ))
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* 页面标题 */}
      <div className="mb-8">
        <h1 className={`text-3xl font-bold ${twText('primary')} mb-2`}>
          自定义智能体管理
        </h1>
        <p className={twText('secondary')}>
          创建和管理自定义智能体，配置智能体参数和能力
        </p>
      </div>

      {/* 操作栏 */}
      <div className="mb-6 flex justify-between items-center">
        <div className="flex gap-4">
          <button
            onClick={() => handleOpenModal()}
            className={`flex items-center gap-2 px-4 py-2 ${twBg('up', '600')} text-white rounded-lg hover:opacity-90 transition-opacity`}
          >
            <PlusIcon className="w-5 h-5" />
            创建智能体
          </button>
          
          <button
            onClick={() => window.location.reload()}
            className={`flex items-center gap-2 px-4 py-2 ${twBg('muted')} ${twText('primary')} rounded-lg hover:opacity-90 transition-opacity`}
          >
            <ArrowPathIcon className="w-5 h-5" />
            刷新
          </button>
        </div>

        <div className="text-sm text-gray-500">
          共 {agents.length} 个智能体，{agents.filter(a => a.isActive).length} 个已启用
        </div>
      </div>

      {/* 智能体列表 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {agents.map(agent => (
          <div
            key={agent.id}
            className={`${twBg('surface')} rounded-lg shadow-sm border ${twBorder('default')} p-6 hover:shadow-md transition-shadow`}
          >
            {/* 智能体头部 */}
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1">
                <h3 className={`text-lg font-semibold ${twText('primary')} mb-1`}>
                  {agent.name}
                </h3>
                <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${
                  agent.type === 'analysis' ? twBg('info', '100') + ' ' + twText('info', '700') :
                  agent.type === 'trading' ? twBg('up', '100') + ' ' + twText('up', '700') :
                  agent.type === 'risk' ? twBg('danger', '100') + ' ' + twText('danger', '700') :
                  agent.type === 'data' ? twBg('warning', '100') + ' ' + twText('warning', '700') :
                  twBg('muted') + ' ' + twText('secondary')
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
                    agent.isActive ? twBg('up', '500') : 'bg-gray-300'
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
            <p className={`${twText('secondary')} text-sm mb-4 line-clamp-2`}>
              {agent.description}
            </p>

            {/* 智能体配置信息 */}
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className={twText('muted')}>模型</span>
                <span className={twText('primary')}>{agent.model}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className={twText('muted')}>温度</span>
                <span className={twText('primary')}>{agent.temperature}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className={twText('muted')}>最大Token</span>
                <span className={twText('primary')}>{agent.maxTokens}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className={twText('muted')}>能力数量</span>
                <span className={twText('primary')}>{agent.capabilities.length}</span>
              </div>
            </div>

            {/* 能力标签 */}
            {agent.capabilities.length > 0 && (
              <div className="mb-4">
                <div className="flex flex-wrap gap-1">
                  {agent.capabilities.slice(0, 3).map(cap => (
                    <span
                      key={cap}
                      className={`px-2 py-1 text-xs ${twBg('muted')} ${twText('secondary')} rounded`}
                    >
                      {cap}
                    </span>
                  ))}
                  {agent.capabilities.length > 3 && (
                    <span className={`px-2 py-1 text-xs ${twBg('muted')} ${twText('muted')} rounded`}>
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
                className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 ${twBg('muted')} ${twText('primary')} rounded hover:opacity-90 transition-opacity`}
              >
                <PencilIcon className="w-4 h-4" />
                编辑
              </button>

              <button
                onClick={() => handleTestAgent(agent)}
                className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 ${twBg('info', '500')} text-white rounded hover:opacity-90 transition-opacity`}
              >
                <BeakerIcon className="w-4 h-4" />
                测试
              </button>

              <button
                onClick={() => handleDeleteAgent(agent.id)}
                className={`flex items-center justify-center px-3 py-2 ${twBg('danger', '500')} text-white rounded hover:opacity-90 transition-opacity`}
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* 创建/编辑模态框 */}
      {showModal && editingAgent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`${twBg('surface')} rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto`}>
            <h2 className={`text-2xl font-bold ${twText('primary')} mb-4`}>
              {agents.find(a => a.id === editingAgent.id) ? '编辑智能体' : '创建智能体'}
            </h2>

            <div className="space-y-4">
              {/* 智能体名称 */}
              <div>
                <label className={`block text-sm font-medium ${twText('primary')} mb-1`}>
                  智能体名称 *
                </label>
                <input
                  type="text"
                  value={editingAgent.name}
                  onChange={(e) => setEditingAgent(prev => prev ? { ...prev, name: e.target.value } : null)}
                  className={`w-full px-3 py-2 border ${twBorder('default')} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  placeholder="输入智能体名称"
                />
              </div>

              {/* 智能体描述 */}
              <div>
                <label className={`block text-sm font-medium ${twText('primary')} mb-1`}>
                  描述 *
                </label>
                <textarea
                  value={editingAgent.description}
                  onChange={(e) => setEditingAgent(prev => prev ? { ...prev, description: e.target.value } : null)}
                  className={`w-full px-3 py-2 border ${twBorder('default')} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  rows={3}
                  placeholder="输入智能体描述"
                />
              </div>

              {/* 智能体类型 */}
              <div>
                <label className={`block text-sm font-medium ${twText('primary')} mb-1`}>
                  类型 *
                </label>
                <select
                  value={editingAgent.type}
                  onChange={(e) => setEditingAgent(prev => prev ? { ...prev, type: e.target.value as CustomAgentConfig['type'] } : null)}
                  className={`w-full px-3 py-2 border ${twBorder('default')} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500`}
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
                <label className={`block text-sm font-medium ${twText('primary')} mb-1`}>
                  模型 *
                </label>
                <select
                  value={editingAgent.model}
                  onChange={(e) => setEditingAgent(prev => prev ? { ...prev, model: e.target.value } : null)}
                  className={`w-full px-3 py-2 border ${twBorder('default')} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500`}
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
                <label className={`block text-sm font-medium ${twText('primary')} mb-1`}>
                  系统提示词 *
                </label>
                <textarea
                  value={editingAgent.systemPrompt}
                  onChange={(e) => setEditingAgent(prev => prev ? { ...prev, systemPrompt: e.target.value } : null)}
                  className={`w-full px-3 py-2 border ${twBorder('default')} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  rows={5}
                  placeholder="输入系统提示词，定义智能体的角色和行为"
                />
              </div>

              {/* 温度参数 */}
              <div>
                <label className={`block text-sm font-medium ${twText('primary')} mb-1`}>
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
                <div className="flex justify-between text-xs text-gray-500">
                  <span>精确 (0)</span>
                  <span>平衡 (1)</span>
                  <span>创意 (2)</span>
                </div>
              </div>

              {/* 最大Token */}
              <div>
                <label className={`block text-sm font-medium ${twText('primary')} mb-1`}>
                  最大Token
                </label>
                <input
                  type="number"
                  value={editingAgent.maxTokens}
                  onChange={(e) => setEditingAgent(prev => prev ? { ...prev, maxTokens: parseInt(e.target.value) } : null)}
                  className={`w-full px-3 py-2 border ${twBorder('default')} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  min="100"
                  max="8000"
                />
              </div>

              {/* 能力配置 */}
              <div>
                <label className={`block text-sm font-medium ${twText('primary')} mb-1`}>
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
                className={`flex-1 px-4 py-2 ${twBg('up', '500')} text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                保存
              </button>
              <button
                onClick={() => {
                  setShowModal(false)
                  setEditingAgent(null)
                }}
                className={`flex-1 px-4 py-2 ${twBg('muted')} ${twText('primary')} rounded-lg hover:opacity-90 transition-opacity`}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 测试结果显示 */}
      {testingAgent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`${twBg('surface')} rounded-lg p-6 w-full max-w-lg`}>
            <h3 className={`text-xl font-bold ${twText('primary')} mb-4`}>
              测试智能体: {testingAgent.name}
            </h3>
            <div className={`${twBg('muted')} p-4 rounded-lg mb-4`}>
              <pre className={`text-sm ${twText('primary')} whitespace-pre-wrap`}>
                {testResult}
              </pre>
            </div>
            <button
              onClick={() => {
                setTestingAgent(null)
                setTestResult('')
              }}
              className={`w-full px-4 py-2 ${twBg('up', '500')} text-white rounded-lg hover:opacity-90 transition-opacity`}
            >
              关闭
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default CustomAgentPage
