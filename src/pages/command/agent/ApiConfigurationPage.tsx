import React, { useState, useCallback } from 'react'
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  KeyIcon,
  LinkIcon,
  EyeIcon,
  EyeSlashIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'
import { PageContainer } from '@/components/templates/PageContainer'
import { PageHeader } from '@/components/templates/PageHeader'
import { TUSHARE_API } from '@/config/dataSourceUrls'
import { API_ENDPOINT_PLACEHOLDER } from '@/config/uiPlaceholders'

import { nanoid } from 'nanoid'
/**
 * API配置接口
 */
interface ApiConfig {
  id: string
  name: string
  provider: 'openai' | 'deepseek' | 'kimi' | 'qwen' | 'tushare' | 'custom'
  apiKey: string
  endpoint?: string
  permissions: ApiPermission[]
  rateLimit: {
    requestsPerMinute: number
    tokensPerDay: number
  }
  usage: {
    requestsToday: number
    tokensToday: number
    requestsThisMonth: number
    tokensThisMonth: number
  }
  isActive: boolean
  createdAt: string
  updatedAt: string
  lastUsed?: string
}

/**
 * API权限接口
 */
interface ApiPermission {
  resource: string
  actions: ('read' | 'write' | 'delete')[]
}

/**
 * API配置界面
 * 
 * @component
 * @remarks
 * 功能：
 * - 创建/编辑/删除API配置
 * - 管理API Key
 * - 配置端点和权限
 * - 查看使用统计
 * - 测试API连接
 */
const ApiConfigurationPage: React.FC = () => {
  // 状态管理
  const [apis, setApis] = useState<ApiConfig[]>([
    {
      id: 'api-001',
      name: 'DeepSeek API',
      provider: 'deepseek',
      // 占位示例密钥（非真实凭证，仅 UI 演示用，避免被密钥审计误报为真实 sk-）
      apiKey: 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      permissions: [
        { resource: 'chat', actions: ['read', 'write'] },
        { resource: 'completion', actions: ['read', 'write'] },
      ],
      rateLimit: {
        requestsPerMinute: 60,
        tokensPerDay: 1000000,
      },
      usage: {
        requestsToday: 1250,
        tokensToday: 450000,
        requestsThisMonth: 35000,
        tokensThisMonth: 12500000,
      },
      isActive: true,
      createdAt: '2026-01-10',
      updatedAt: '2026-07-05',
      lastUsed: '2026-07-06 10:30:00',
    },
    {
      id: 'api-002',
      name: 'Tushare API',
      provider: 'tushare',
      apiKey: 'tushare-token-xxxxxxxxxxxxxxxx',
      endpoint: TUSHARE_API,
      permissions: [
        { resource: 'data', actions: ['read'] },
      ],
      rateLimit: {
        requestsPerMinute: 200,
        tokensPerDay: 0,
      },
      usage: {
        requestsToday: 8500,
        tokensToday: 0,
        requestsThisMonth: 250000,
        tokensThisMonth: 0,
      },
      isActive: true,
      createdAt: '2026-02-15',
      updatedAt: '2026-07-01',
      lastUsed: '2026-07-06 11:45:00',
    },
    {
      id: 'api-003',
      name: 'Kimi API',
      provider: 'kimi',
      apiKey: 'sk-kimi-xxxxxxxxxxxxxxxxxxxxxxxx',
      permissions: [
        { resource: 'chat', actions: ['read', 'write'] },
      ],
      rateLimit: {
        requestsPerMinute: 30,
        tokensPerDay: 500000,
      },
      usage: {
        requestsToday: 320,
        tokensToday: 180000,
        requestsThisMonth: 9500,
        tokensThisMonth: 5200000,
      },
      isActive: false,
      createdAt: '2026-03-20',
      updatedAt: '2026-07-05',
      lastUsed: '2026-07-05 18:20:00',
    },
  ])

  const [showModal, setShowModal] = useState(false)
  const [editingApi, setEditingApi] = useState<ApiConfig | null>(null)
  const [showApiKey, setShowApiKey] = useState<Record<string, boolean>>({})

  /**
   * 获取提供商图标颜色
   */
  const getProviderColor = (provider: ApiConfig['provider']) => {
    switch (provider) {
      case 'openai': return 'bg-success'
      case 'deepseek': return 'bg-info'
      case 'kimi': return 'bg-warning'
      case 'qwen': return 'bg-primary'
      case 'tushare': return 'bg-destructive'
      case 'custom': return 'bg-tertiary'
    }
  }

  /**
   * 切换API Key显示
   */
  const toggleApiKeyVisibility = useCallback((apiId: string) => {
    setShowApiKey(prev => ({ ...prev, [apiId]: !prev[apiId] }))
  }, [])

  /**
   * 掩码API Key
   */
  const maskApiKey = (apiKey: string, show: boolean) => {
    if (show) return apiKey
    return apiKey.substring(0, 10) + '•'.repeat(Math.max(0, apiKey.length - 14)) + apiKey.substring(apiKey.length - 4)
  }

  /**
   * 打开创建/编辑模态框
   */
  const handleOpenModal = useCallback((api?: ApiConfig) => {
    if (api) {
      setEditingApi({ ...api })
    } else {
      setEditingApi({
        id: `api-${nanoid(8)}`,
        name: '',
        provider: 'custom',
        apiKey: '',
        permissions: [],
        rateLimit: {
          requestsPerMinute: 60,
          tokensPerDay: 100000,
        },
        usage: {
          requestsToday: 0,
          tokensToday: 0,
          requestsThisMonth: 0,
          tokensThisMonth: 0,
        },
        isActive: true,
        createdAt: new Date().toISOString().split('T')[0] ?? '',
        updatedAt: new Date().toISOString().split('T')[0] ?? '',
      })
    }
    setShowModal(true)
  }, [])

  /**
   * 保存API配置
   */
  const handleSaveApi = useCallback(() => {
    if (!editingApi) return

    setApis(prev => {
      const index = prev.findIndex(a => a.id === editingApi.id)
      if (index >= 0) {
        const updated = [...prev]
        updated[index] = { ...editingApi, updatedAt: new Date().toISOString().split('T')[0] ?? '' }
        return updated
      } else {
        return [...prev, editingApi]
      }
    })

    setShowModal(false)
    setEditingApi(null)
  }, [editingApi])

  /**
   * 删除API配置
   */
  const handleDeleteApi = useCallback((apiId: string) => {
    if (window.confirm('确定要删除这个API配置吗？相关的智能体将无法使用该API。')) {
      setApis(prev => prev.filter(a => a.id !== apiId))
    }
  }, [])

  /**
   * 测试API连接
   */
  const handleTestConnection = useCallback(async (api: ApiConfig) => {
    alert(`测试 ${api.name} 连接...\n\n（实际实现应该调用API进行测试）`)
    // 实际实现应该调用API
  }, [])

  /**
   * 切换API状态
   */
  const handleToggleStatus = useCallback((apiId: string) => {
    setApis(prev => prev.map(a => 
      a.id === apiId ? { ...a, isActive: !a.isActive, updatedAt: new Date().toISOString().split('T')[0] ?? '' } : a
    ))
  }, [])

  return (
    <PageContainer className="min-h-screen bg-background text-foreground">
      <PageHeader
        title="API 配置管理"
        description="管理智能体使用的API配置和密钥"
      />

      {/* 操作栏 */}
      <div className="mb-6 flex justify-between items-center">
        <div className="flex gap-4">
          <button
            onClick={() => handleOpenModal()}
            className={`flex items-center gap-2 px-4 py-2 ${'bg-destructive'} text-destructive-foreground rounded-lg hover:opacity-90 transition-opacity`}
          >
            <PlusIcon className="w-5 h-5" />
            添加API配置
          </button>

          <button
            onClick={() => window.location.reload()}
            className={`flex items-center gap-2 px-4 py-2 ${'bg-muted'} ${'text-foreground'} rounded-lg hover:opacity-90 transition-opacity`}
          >
            <ArrowPathIcon className="w-5 h-5" />
            刷新
          </button>
        </div>

        <div className="text-sm text-tertiary">
          共 {apis.length} 个API配置，{apis.filter(a => a.isActive).length} 个已启用
        </div>
      </div>

      {/* API配置列表 */}
      <div className="space-y-6">
        {apis.map(api => (
          <div
            key={api.id}
            className={`${'bg-card'} rounded-lg shadow-sm border ${'border-border'} p-6 hover:shadow-md transition-shadow`}
          >
            {/* API头部 */}
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-lg ${getProviderColor(api.provider)} flex items-center justify-center`}>
                  <KeyIcon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className={`text-lg font-semibold ${'text-foreground'}`}>
                      {api.name}
                    </h3>
                    <span className={`px-2 py-1 text-xs font-medium rounded ${
                      api.isActive ? 'bg-success/15' + ' ' + 'text-success' : 'bg-muted' + ' ' + 'text-tertiary'
                    }`}>
                      {api.isActive ? '已启用' : '已禁用'}
                    </span>
                  </div>
                  <p className={`${'text-muted-foreground'} text-sm`}>
                    提供商: {api.provider} | 端点: {api.endpoint || '默认'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* 启用/禁用切换 */}
                <button
                  onClick={() => handleToggleStatus(api.id)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    api.isActive ? 'bg-destructive' : 'bg-muted'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
                      api.isActive ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>

                {/* 操作按钮 */}
                <button
                  onClick={() => handleTestConnection(api)}
                  className={`p-2 ${'bg-muted'} rounded hover:opacity-90 transition-opacity`}
                  title="测试连接"
                >
                  <LinkIcon className="w-5 h-5" />
                </button>

                <button
                  onClick={() => handleOpenModal(api)}
                  className={`p-2 ${'bg-muted'} rounded hover:opacity-90 transition-opacity`}
                  title="编辑"
                >
                  <PencilIcon className="w-5 h-5" />
                </button>

                <button
                  onClick={() => handleDeleteApi(api.id)}
                  className={`p-2 ${'bg-destructive/15'} rounded hover:opacity-90 transition-opacity`}
                  title="删除"
                >
                  <TrashIcon className="w-5 h-5 text-destructive" />
                </button>
              </div>
            </div>

            {/* API Key */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <span className={`text-sm font-medium ${'text-foreground'}`}>API Key</span>
                <button
                  onClick={() => toggleApiKeyVisibility(api.id)}
                  className="text-sm text-info hover:text-info"
                >
                  {showApiKey[api.id] ? (
                    <EyeSlashIcon className="w-4 h-4 inline mr-1" />
                  ) : (
                    <EyeIcon className="w-4 h-4 inline mr-1" />
                  )}
                  {showApiKey[api.id] ? '隐藏' : '显示'}
                </button>
              </div>
              <div className={`font-mono text-sm ${'bg-muted'} p-2 rounded`}>
                {maskApiKey(api.apiKey, showApiKey[api.id] || false)}
              </div>
            </div>

            {/* 权限配置 */}
            <div className="mb-4">
              <span className={`text-sm font-medium ${'text-foreground'} mb-2 block`}>权限配置</span>
              <div className="space-y-1">
                {api.permissions.map((perm, index) => (
                  <div key={index} className={`text-sm ${'text-muted-foreground'}`}>
                    <span className="font-medium">{perm.resource}</span>: {perm.actions.join(', ')}
                  </div>
                ))}
              </div>
            </div>

            {/* 速率限制 */}
            <div className="mb-4">
              <span className={`text-sm font-medium ${'text-foreground'} mb-2 block`}>速率限制</span>
              <div className="grid grid-cols-2 gap-4">
                <div className={`${'bg-muted'} p-3 rounded`}>
                  <div className={`text-sm ${'text-tertiary'}`}>每分钟请求数</div>
                  <div className={`text-lg font-semibold ${'text-foreground'}`}>
                    {api.rateLimit.requestsPerMinute}
                  </div>
                </div>
                <div className={`${'bg-muted'} p-3 rounded`}>
                  <div className={`text-sm ${'text-tertiary'}`}>每日Token限制</div>
                  <div className={`text-lg font-semibold ${'text-foreground'}`}>
                    {api.rateLimit.tokensPerDay > 0 ? api.rateLimit.tokensPerDay.toLocaleString() : '无限制'}
                  </div>
                </div>
              </div>
            </div>

            {/* 使用统计 */}
            <div>
              <span className={`text-sm font-medium ${'text-foreground'} mb-2 block`}>使用统计</span>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className={`${'bg-muted'} p-3 rounded`}>
                  <div className={`text-sm ${'text-tertiary'}`}>今日请求</div>
                  <div className={`text-lg font-semibold ${'text-foreground'}`}>
                    {api.usage.requestsToday.toLocaleString()}
                  </div>
                </div>
                <div className={`${'bg-muted'} p-3 rounded`}>
                  <div className={`text-sm ${'text-tertiary'}`}>今日Token</div>
                  <div className={`text-lg font-semibold ${'text-foreground'}`}>
                    {api.usage.tokensToday > 0 ? api.usage.tokensToday.toLocaleString() : '-'}
                  </div>
                </div>
                <div className={`${'bg-muted'} p-3 rounded`}>
                  <div className={`text-sm ${'text-tertiary'}`}>本月请求</div>
                  <div className={`text-lg font-semibold ${'text-foreground'}`}>
                    {api.usage.requestsThisMonth.toLocaleString()}
                  </div>
                </div>
                <div className={`${'bg-muted'} p-3 rounded`}>
                  <div className={`text-sm ${'text-tertiary'}`}>本月Token</div>
                  <div className={`text-lg font-semibold ${'text-foreground'}`}>
                    {api.usage.tokensThisMonth > 0 ? api.usage.tokensThisMonth.toLocaleString() : '-'}
                  </div>
                </div>
              </div>
            </div>

            {/* 最后使用时间 */}
            {api.lastUsed && (
              <div className={`mt-4 text-sm ${'text-tertiary'}`}>
                最后使用: {api.lastUsed}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 创建/编辑模态框 */}
      {showModal && editingApi && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={`${'bg-card'} rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto`}>
            <h2 className={`text-2xl font-bold ${'text-foreground'} mb-4`}>
              {apis.find(a => a.id === editingApi.id) ? '编辑API配置' : '添加API配置'}
            </h2>

            <div className="space-y-4">
              {/* API名称 */}
              <div>
                <label className={`block text-sm font-medium ${'text-foreground'} mb-1`}>
                  API名称 *
                </label>
                <input
                  type="text"
                  value={editingApi.name}
                  onChange={(e) => setEditingApi(prev => prev ? { ...prev, name: e.target.value } : null)}
                  className={`w-full px-3 py-2 border ${'border-border'} rounded-lg focus:outline-none focus:ring-2 focus:ring-primary`}
                  placeholder="输入API名称"
                />
              </div>

              {/* 提供商 */}
              <div>
                <label className={`block text-sm font-medium ${'text-foreground'} mb-1`}>
                  提供商 *
                </label>
                <select
                  value={editingApi.provider}
                  onChange={(e) => setEditingApi(prev => prev ? { ...prev, provider: e.target.value as ApiConfig['provider'] } : null)}
                  className={`w-full px-3 py-2 border ${'border-border'} rounded-lg focus:outline-none focus:ring-2 focus:ring-primary`}
                >
                  <option value="openai">OpenAI</option>
                  <option value="deepseek">DeepSeek</option>
                  <option value="kimi">Kimi</option>
                  <option value="qwen">通义千问</option>
                  <option value="tushare">Tushare</option>
                  <option value="custom">自定义</option>
                </select>
              </div>

              {/* API Key */}
              <div>
                <label className={`block text-sm font-medium ${'text-foreground'} mb-1`}>
                  API Key *
                </label>
                <input
                  type="password"
                  value={editingApi.apiKey}
                  onChange={(e) => setEditingApi(prev => prev ? { ...prev, apiKey: e.target.value } : null)}
                  className={`w-full px-3 py-2 border ${'border-border'} rounded-lg focus:outline-none focus:ring-2 focus:ring-primary font-mono`}
                  placeholder="输入API Key"
                />
              </div>

              {/* 端点（可选） */}
              <div>
                <label className={`block text-sm font-medium ${'text-foreground'} mb-1`}>
                  端点（可选）
                </label>
                <input
                  type="text"
                  value={editingApi.endpoint || ''}
                  onChange={(e) => setEditingApi(prev => prev ? { ...prev, endpoint: e.target.value } : null)}
                  className={`w-full px-3 py-2 border ${'border-border'} rounded-lg focus:outline-none focus:ring-2 focus:ring-primary`}
                  placeholder={API_ENDPOINT_PLACEHOLDER}
                />
              </div>

              {/* 速率限制 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium ${'text-foreground'} mb-1`}>
                    每分钟请求数
                  </label>
                  <input
                    type="number"
                    value={editingApi.rateLimit.requestsPerMinute}
                    onChange={(e) => setEditingApi(prev => prev ? { 
                      ...prev, 
                      rateLimit: { 
                        ...prev.rateLimit, 
                        requestsPerMinute: parseInt(e.target.value) 
                      } 
                    } : null)}
                    className={`w-full px-3 py-2 border ${'border-border'} rounded-lg focus:outline-none focus:ring-2 focus:ring-primary`}
                    min="1"
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium ${'text-foreground'} mb-1`}>
                    每日Token限制（0=无限制）
                  </label>
                  <input
                    type="number"
                    value={editingApi.rateLimit.tokensPerDay}
                    onChange={(e) => setEditingApi(prev => prev ? { 
                      ...prev, 
                      rateLimit: { 
                        ...prev.rateLimit, 
                        tokensPerDay: parseInt(e.target.value) 
                      } 
                    } : null)}
                    className={`w-full px-3 py-2 border ${'border-border'} rounded-lg focus:outline-none focus:ring-2 focus:ring-primary`}
                    min="0"
                  />
                </div>
              </div>

              {/* 状态 */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editingApi.isActive}
                  onChange={(e) => setEditingApi(prev => prev ? { ...prev, isActive: e.target.checked } : null)}
                  className="rounded"
                />
                <label className={`text-sm ${'text-foreground'}`}>
                  启用此API配置
                </label>
              </div>
            </div>

            {/* 按钮组 */}
            <div className="flex gap-4 mt-6">
              <button
                onClick={handleSaveApi}
                disabled={!editingApi.name || !editingApi.apiKey}
                className={`flex-1 px-4 py-2 ${'bg-destructive'} text-destructive-foreground rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                保存
              </button>
              <button
                onClick={() => {
                  setShowModal(false)
                  setEditingApi(null)
                }}
                className={`flex-1 px-4 py-2 ${'bg-muted'} ${'text-foreground'} rounded-lg hover:opacity-90 transition-opacity`}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  )
}

export default ApiConfigurationPage
