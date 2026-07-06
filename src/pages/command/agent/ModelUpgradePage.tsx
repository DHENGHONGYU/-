import React, { useState } from 'react'
import {
  ArrowUpCircle,
  GitBranch,
  TestTube,
  RotateCcw,
  CheckCircle,
  XCircle,
  Clock,
  Plus,
  Search,
} from 'lucide-react'
import { twText, twBg } from '@/constants/theme.tokens'

/**
 * 模型升级流程管理页面
 * 功能：模型版本管理、升级计划、A/B测试、回滚策略
 */
interface ModelVersion {
  id: string
  name: string
  version: string
  provider: string
  status: 'active' | 'deprecated' | 'testing' | 'archived'
  releaseDate: string
  performanceScore: number
  costPerToken: number
  maxTokens: number
  supportsFunctions: boolean
  supportsVision: boolean
  description: string
}

interface UpgradePlan {
  id: string
  name: string
  fromVersion: string
  toVersion: string
  status: 'draft' | 'approved' | 'in-progress' | 'completed' | 'rolled-back'
  scheduledDate: string
  abTestConfig?: ABTestConfig
  rollbackStrategy: RollbackStrategy
  createdAt: string
}

interface ABTestConfig {
  enabled: boolean
  trafficSplit: number // 0-100, percentage of traffic to new model
  duration: number // days
  successMetrics: string[]
  minSampleSize: number
}

interface RollbackStrategy {
  type: 'automatic' | 'manual'
  triggerConditions: string[]
  maxErrors: number
  rollbackWindow: number // hours
}

interface UpgradeHistory {
  id: string
  planId: string
  planName: string
  fromVersion: string
  toVersion: string
  status: 'success' | 'failed' | 'rolled-back'
  startedAt: string
  completedAt?: string
  errorMessage?: string
  performanceDelta: number // percentage change in performance
}

const ModelUpgradePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'versions' | 'plans' | 'history'>('versions')
  const [, setShowCreatePlan] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Mock数据：模型版本
  const [modelVersions] = useState<ModelVersion[]>([
    {
      id: '1',
      name: 'DeepSeek-V3',
      version: '3.0.0',
      provider: 'DeepSeek',
      status: 'active',
      releaseDate: '2026-01-15',
      performanceScore: 95,
      costPerToken: 0.0001,
      maxTokens: 8192,
      supportsFunctions: true,
      supportsVision: false,
      description: '最新版本，支持函数调用，性能提升20%',
    },
    {
      id: '2',
      name: 'DeepSeek-V2',
      version: '2.1.0',
      provider: 'DeepSeek',
      status: 'deprecated',
      releaseDate: '2025-08-20',
      performanceScore: 88,
      costPerToken: 0.00015,
      maxTokens: 4096,
      supportsFunctions: false,
      supportsVision: false,
      description: '旧版本，计划废弃',
    },
    {
      id: '3',
      name: 'Kimi-K2',
      version: '2.0.0',
      provider: 'Moonshot',
      status: 'testing',
      releaseDate: '2026-06-01',
      performanceScore: 92,
      costPerToken: 0.00012,
      maxTokens: 16384,
      supportsFunctions: true,
      supportsVision: true,
      description: '测试版本，支持视觉理解',
    },
    {
      id: '4',
      name: 'Qwen-3',
      version: '3.0.0',
      provider: 'Alibaba',
      status: 'active',
      releaseDate: '2026-03-10',
      performanceScore: 90,
      costPerToken: 0.00008,
      maxTokens: 32768,
      supportsFunctions: true,
      supportsVision: true,
      description: '通义千问最新版，支持超长上下文',
    },
  ])

  // Mock数据：升级计划
  const [upgradePlans] = useState<UpgradePlan[]>([
    {
      id: '1',
      name: 'DeepSeek V2 → V3 升级',
      fromVersion: 'DeepSeek-V2 (2.1.0)',
      toVersion: 'DeepSeek-V3 (3.0.0)',
      status: 'in-progress',
      scheduledDate: '2026-07-10',
      abTestConfig: {
        enabled: true,
        trafficSplit: 20,
        duration: 7,
        successMetrics: ['response_time', 'accuracy', 'user_satisfaction'],
        minSampleSize: 1000,
      },
      rollbackStrategy: {
        type: 'automatic',
        triggerConditions: ['error_rate > 5%', 'response_time > 3s'],
        maxErrors: 100,
        rollbackWindow: 24,
      },
      createdAt: '2026-07-01',
    },
    {
      id: '2',
      name: 'Kimi K2 全量上线',
      fromVersion: 'Kimi-K1 (1.5.0)',
      toVersion: 'Kimi-K2 (2.0.0)',
      status: 'approved',
      scheduledDate: '2026-07-20',
      abTestConfig: {
        enabled: true,
        trafficSplit: 50,
        duration: 14,
        successMetrics: ['accuracy', 'user_satisfaction'],
        minSampleSize: 5000,
      },
      rollbackStrategy: {
        type: 'manual',
        triggerConditions: ['user_complaints > 10'],
        maxErrors: 50,
        rollbackWindow: 48,
      },
      createdAt: '2026-07-05',
    },
  ])

  // Mock数据：升级历史
  const [upgradeHistory] = useState<UpgradeHistory[]>([
    {
      id: '1',
      planId: '1',
      planName: 'Qwen 2.5 → 3.0 升级',
      fromVersion: 'Qwen-2.5 (2.5.0)',
      toVersion: 'Qwen-3 (3.0.0)',
      status: 'success',
      startedAt: '2026-03-10',
      completedAt: '2026-03-12',
      performanceDelta: 15.3,
    },
    {
      id: '2',
      planId: '2',
      planName: 'DeepSeek V1 → V2 升级',
      fromVersion: 'DeepSeek-V1 (1.0.0)',
      toVersion: 'DeepSeek-V2 (2.0.0)',
      status: 'rolled-back',
      startedAt: '2025-08-15',
      completedAt: '2025-08-16',
      errorMessage: '函数调用接口不兼容，导致30%请求失败',
      performanceDelta: -5.2,
    },
  ])

  const getStatusBadge = (status: string) => {
    const config: Record<string, { color: string; text: string }> = {
      'active': { color: 'text-green-400 bg-green-900/30', text: '运行中' },
      'deprecated': { color: 'text-yellow-400 bg-yellow-900/30', text: '已废弃' },
      'testing': { color: 'text-blue-400 bg-blue-900/30', text: '测试中' },
      'archived': { color: 'text-gray-400 bg-gray-900/30', text: '已归档' },
      'draft': { color: 'text-gray-400 bg-gray-900/30', text: '草稿' },
      'approved': { color: 'text-blue-400 bg-blue-900/30', text: '已批准' },
      'in-progress': { color: 'text-yellow-400 bg-yellow-900/30', text: '进行中' },
      'completed': { color: 'text-green-400 bg-green-900/30', text: '已完成' },
      'rolled-back': { color: 'text-red-400 bg-red-900/30', text: '已回滚' },
      'success': { color: 'text-green-400 bg-green-900/30', text: '成功' },
      'failed': { color: 'text-red-400 bg-red-900/30', text: '失败' },
    }
    const badge = config[status] ?? config['draft'] ?? { color: '', text: '' }
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${badge.color}`}>
        {badge.text}
      </span>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      {/* 页面标题 */}
      <div className="mb-8">
        <h1 className={`text-3xl font-bold ${twText('primary')} mb-2`}>
          模型升级流程管理
        </h1>
        <p className={twText('muted')}>
          管理模型版本升级、A/B测试配置和回滚策略
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-800">
        {[
          { key: 'versions' as const, label: '模型版本', icon: ArrowUpCircle },
          { key: 'plans' as const, label: '升级计划', icon: GitBranch },
          { key: 'history' as const, label: '升级历史', icon: Clock },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors ${
              activeTab === tab.key
                ? `border-b-2 border-blue-500 ${twText('accent')}`
                : twText('muted')
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* 搜索栏 */}
      <div className="flex gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${twText('muted')}`} />
          <input
            type="text"
            placeholder="搜索模型或计划..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full pl-10 pr-4 py-2 ${twBg('card')} border border-gray-800 rounded-lg ${twText('primary')} focus:outline-none focus:border-blue-500`}
          />
        </div>
        {activeTab === 'plans' && (
          <button
            onClick={() => setShowCreatePlan(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            创建升级计划
          </button>
        )}
      </div>

      {/* 模型版本 Tab */}
      {activeTab === 'versions' && (
        <div className="space-y-4">
          {modelVersions
            .filter(v => 
              v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              v.version.toLowerCase().includes(searchQuery.toLowerCase())
            )
            .map(version => (
              <div key={version.id} className={`${twBg('card')} rounded-lg p-6 border border-gray-800`}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className={`text-xl font-semibold ${twText('primary')}`}>
                        {version.name}
                      </h3>
                      {getStatusBadge(version.status)}
                    </div>
                    <p className={twText('muted')}>
                      版本 {version.version} • {version.provider} • 发布于 {version.releaseDate}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className={`text-2xl font-bold ${twText('accent')}`}>
                      {version.performanceScore}
                    </div>
                    <div className={`text-sm ${twText('muted')}`}>
                      性能评分
                    </div>
                  </div>
                </div>

                <p className={`${twText('secondary')} mb-4`}>
                  {version.description}
                </p>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className={`${twBg('muted')} rounded p-3`}>
                    <div className={`text-sm ${twText('muted')} mb-1`}>
                      每Token成本
                    </div>
                    <div className={`font-semibold ${twText('primary')}`}>
                      ${version.costPerToken.toFixed(6)}
                    </div>
                  </div>
                  <div className={`${twBg('muted')} rounded p-3`}>
                    <div className={`text-sm ${twText('muted')} mb-1`}>
                      最大Token
                    </div>
                    <div className={`font-semibold ${twText('primary')}`}>
                      {version.maxTokens.toLocaleString()}
                    </div>
                  </div>
                  <div className={`${twBg('muted')} rounded p-3`}>
                    <div className={`text-sm ${twText('muted')} mb-1`}>
                      函数调用
                    </div>
                    <div className="font-semibold">
                      {version.supportsFunctions ? (
                        <CheckCircle className="w-5 h-5 text-green-400" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-400" />
                      )}
                    </div>
                  </div>
                  <div className={`${twBg('muted')} rounded p-3`}>
                    <div className={`text-sm ${twText('muted')} mb-1`}>
                      视觉理解
                    </div>
                    <div className="font-semibold">
                      {version.supportsVision ? (
                        <CheckCircle className="w-5 h-5 text-green-400" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-400" />
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button className={`px-4 py-2 ${twBg('muted')} hover:bg-gray-700 rounded-lg transition-colors`}>
                    查看详情
                  </button>
                  {version.status === 'testing' && (
                    <button className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors">
                      批准上线
                    </button>
                  )}
                  {version.status === 'active' && (
                    <button className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded-lg transition-colors">
                      计划升级
                    </button>
                  )}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* 升级计划 Tab */}
      {activeTab === 'plans' && (
        <div className="space-y-4">
          {upgradePlans
            .filter(p => 
              p.name.toLowerCase().includes(searchQuery.toLowerCase())
            )
            .map(plan => (
              <div key={plan.id} className={`${twBg('card')} rounded-lg p-6 border border-gray-800`}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className={`text-xl font-semibold ${twText('primary')}`}>
                        {plan.name}
                      </h3>
                      {getStatusBadge(plan.status)}
                    </div>
                    <p className={twText('muted')}>
                      从 {plan.fromVersion} 升级到 {plan.toVersion}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm ${twText('muted')}`}>
                      计划日期
                    </div>
                    <div className={`font-semibold ${twText('primary')}`}>
                      {plan.scheduledDate}
                    </div>
                  </div>
                </div>

                {plan.abTestConfig && (
                  <div className={`${twBg('muted')} rounded p-4 mb-4`}>
                    <h4 className={`font-medium ${twText('primary')} mb-2`}>
                      <TestTube className="w-4 h-4 inline mr-2" />
                      A/B测试配置
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className={twText('muted')}>流量分配：</span>
                        <span className={twText('primary')}>{plan.abTestConfig.trafficSplit}% → 新版本</span>
                      </div>
                      <div>
                        <span className={twText('muted')}>测试时长：</span>
                        <span className={twText('primary')}>{plan.abTestConfig.duration} 天</span>
                      </div>
                      <div>
                        <span className={twText('muted')}>最小样本：</span>
                        <span className={twText('primary')}>{plan.abTestConfig.minSampleSize.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className={twText('muted')}>成功指标：</span>
                        <span className={twText('primary')}>{plan.abTestConfig.successMetrics.length} 项</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className={`${twBg('muted')} rounded p-4 mb-4`}>
                  <h4 className={`font-medium ${twText('primary')} mb-2`}>
                    <RotateCcw className="w-4 h-4 inline mr-2" />
                    回滚策略
                  </h4>
                  <div className="text-sm">
                    <div className="mb-1">
                      <span className={twText('muted')}>类型：</span>
                      <span className={twText('primary')}>
                        {plan.rollbackStrategy.type === 'automatic' ? '自动回滚' : '手动回滚'}
                      </span>
                    </div>
                    <div>
                      <span className={twText('muted')}>触发条件：</span>
                      {plan.rollbackStrategy.triggerConditions.map((condition, idx) => (
                        <span key={idx} className="inline-block px-2 py-1 bg-red-900/30 text-red-400 rounded text-xs mr-2">
                          {condition}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button className={`px-4 py-2 ${twBg('muted')} hover:bg-gray-700 rounded-lg transition-colors`}>
                    查看详情
                  </button>
                  {plan.status === 'approved' && (
                    <button className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors">
                      开始升级
                    </button>
                  )}
                  {plan.status === 'in-progress' && (
                    <button className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded-lg transition-colors">
                      监控进度
                    </button>
                  )}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* 升级历史 Tab */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {upgradeHistory
            .filter(h => 
              h.planName.toLowerCase().includes(searchQuery.toLowerCase())
            )
            .map(record => (
              <div key={record.id} className={`${twBg('card')} rounded-lg p-6 border border-gray-800`}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className={`text-xl font-semibold ${twText('primary')}`}>
                        {record.planName}
                      </h3>
                      {getStatusBadge(record.status)}
                    </div>
                    <p className={twText('muted')}>
                      {record.fromVersion} → {record.toVersion}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className={`text-2xl font-bold ${
                      record.performanceDelta > 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {record.performanceDelta > 0 ? '+' : ''}{record.performanceDelta}%
                    </div>
                    <div className={`text-sm ${twText('muted')}`}>
                      性能变化
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <span className={`text-sm ${twText('muted')}`}>开始时间：</span>
                    <div className={twText('primary')}>{record.startedAt}</div>
                  </div>
                  <div>
                    <span className={`text-sm ${twText('muted')}`}>完成时间：</span>
                    <div className={twText('primary')}>{record.completedAt || '-'}</div>
                  </div>
                  {record.errorMessage && (
                    <div className="md:col-span-2">
                      <span className={`text-sm ${twText('muted')}`}>错误信息：</span>
                      <div className="text-red-400">{record.errorMessage}</div>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <button className={`px-4 py-2 ${twBg('muted')} hover:bg-gray-700 rounded-lg transition-colors`}>
                    查看详情
                  </button>
                  {record.status === 'rolled-back' && (
                    <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
                      重新升级
                    </button>
                  )}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

export default ModelUpgradePage
