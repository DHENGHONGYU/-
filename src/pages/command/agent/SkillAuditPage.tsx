import React, { useState } from 'react'
import { 
  Search,
  BarChart3,
  TrendingUp,
  GitBranch,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react'
import { twText } from '@/constants/theme.tokens'

/**
 * Skill核查可视化页面（简化版）
 * 功能：Skill使用统计、性能分析、依赖关系图、问题检测
 */
interface SkillInfo {
  id: string
  name: string
  version: string
  category: string
  status: 'active' | 'deprecated' | 'error' | 'testing'
  usageCount: number
  successRate: number
  avgExecutionTime: number
  lastUsed: string
}

const SkillAuditPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'performance' | 'dependencies' | 'issues'>('overview')
  const [searchQuery, setSearchQuery] = useState('')

  const skills: SkillInfo[] = [
    {
      id: '1',
      name: 'data-fetcher',
      version: '2.1.0',
      category: 'data',
      status: 'active',
      usageCount: 15234,
      successRate: 99.2,
      avgExecutionTime: 245,
      lastUsed: '2026-07-06',
    },
    {
      id: '2',
      name: 'technical-analysis',
      version: '1.5.3',
      category: 'analysis',
      status: 'active',
      usageCount: 8945,
      successRate: 97.8,
      avgExecutionTime: 567,
      lastUsed: '2026-07-05',
    },
    {
      id: '3',
      name: 'risk-monitor',
      version: '1.0.0',
      category: 'risk',
      status: 'error',
      usageCount: 1234,
      successRate: 85.3,
      avgExecutionTime: 1234,
      lastUsed: '2026-07-01',
    },
  ]

  const getStatusBadge = (status: string) => {
    const config: Record<string, { color: string; text: string }> = {
      'active': { color: 'text-green-400 bg-green-900/30', text: '运行中' },
      'deprecated': { color: 'text-yellow-400 bg-yellow-900/30', text: '已废弃' },
      'error': { color: 'text-red-400 bg-red-900/30', text: '错误' },
      'testing': { color: 'text-blue-400 bg-blue-900/30', text: '测试中' },
    }
    const badge = config[status] ?? config['active'] ?? { color: '', text: '' }
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${badge.color}`}>
        {badge.text}
      </span>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="mb-8">
        <h1 className={`text-3xl font-bold ${twText('primary')} mb-2`}>
          Skill核查可视化
        </h1>
        <p className={twText('muted')}>
          监控和分析所有Skill的使用情况、性能和依赖关系
        </p>
      </div>

      <div className="flex gap-2 mb-6 border-b border-gray-800">
        {[
          { key: 'overview' as const, label: '总览', icon: BarChart3 },
          { key: 'performance' as const, label: '性能分析', icon: TrendingUp },
          { key: 'dependencies' as const, label: '依赖关系', icon: GitBranch },
          { key: 'issues' as const, label: '问题检测', icon: AlertTriangle },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors ${
              activeTab === tab.key
                ? 'border-b-2 border-blue-500 text-blue-400'
                : 'text-gray-400'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="搜索Skill..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-900 rounded p-4 border border-gray-800">
              <div className="text-sm text-gray-400 mb-1">总Skill数</div>
              <div className="text-2xl font-bold text-blue-400">{skills.length}</div>
            </div>
            <div className="bg-gray-900 rounded p-4 border border-gray-800">
              <div className="text-sm text-gray-400 mb-1">活跃Skill</div>
              <div className="text-2xl font-bold text-green-400">
                {skills.filter(s => s.status === 'active').length}
              </div>
            </div>
            <div className="bg-gray-900 rounded p-4 border border-gray-800">
              <div className="text-sm text-gray-400 mb-1">总使用次数</div>
              <div className="text-2xl font-bold text-blue-400">
                {skills.reduce((sum, s) => sum + s.usageCount, 0).toLocaleString()}
              </div>
            </div>
            <div className="bg-gray-900 rounded p-4 border border-gray-800">
              <div className="text-sm text-gray-400 mb-1">平均成功率</div>
              <div className="text-2xl font-bold text-green-400">
                {(skills.reduce((sum, s) => sum + s.successRate, 0) / skills.length).toFixed(1)}%
              </div>
            </div>
          </div>

          {skills
            .filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()))
            .map(skill => (
              <div key={skill.id} className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold text-white">
                        {skill.name}
                      </h3>
                      {getStatusBadge(skill.status)}
                      <span className="px-2 py-1 rounded text-xs bg-gray-800 text-gray-400">
                        v{skill.version}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-2xl font-bold ${
                      skill.successRate >= 99 ? 'text-green-400' : 
                      skill.successRate >= 95 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {skill.successRate}%
                    </div>
                    <div className="text-sm text-gray-400">成功率</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-gray-800 rounded p-3">
                    <div className="text-sm text-gray-400 mb-1">使用次数</div>
                    <div className="font-semibold text-white">
                      {skill.usageCount.toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-gray-800 rounded p-3">
                    <div className="text-sm text-gray-400 mb-1">平均执行时间</div>
                    <div className="font-semibold text-white">
                      {skill.avgExecutionTime}ms
                    </div>
                  </div>
                  <div className="bg-gray-800 rounded p-3">
                    <div className="text-sm text-gray-400 mb-1">最后使用</div>
                    <div className="font-semibold text-white">
                      {skill.lastUsed}
                    </div>
                  </div>
                  <div className="bg-gray-800 rounded p-3">
                    <div className="text-sm text-gray-400 mb-1">分类</div>
                    <div className="font-semibold text-white">
                      {skill.category}
                    </div>
                  </div>
                </div>
              </div>
            ))}
        </div>
      )}

      {activeTab === 'issues' && (
        <div className="space-y-4">
          {skills
            .filter(s => s.status === 'error' || s.successRate < 95)
            .map(skill => (
              <div key={skill.id} className="bg-gray-900 rounded-lg p-6 border border-red-800">
                <div className="flex items-start gap-4">
                  <AlertTriangle className="w-8 h-8 text-red-400 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-white mb-2">
                      {skill.name}
                    </h3>
                    {skill.status === 'error' && (
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-400" />
                        <span className="text-red-400">Skill状态异常</span>
                      </div>
                    )}
                    {skill.successRate < 95 && (
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-yellow-400" />
                        <span className="text-yellow-400">
                          成功率过低：{skill.successRate}%（建议≥95%）
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          {skills.filter(s => s.status === 'error' || s.successRate < 95).length === 0 && (
            <div className="bg-gray-900 rounded-lg p-8 text-center border border-gray-800">
              <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
              <p className="text-white">暂无问题Skill</p>
            </div>
          )}
        </div>
      )}

      {(activeTab === 'performance' || activeTab === 'dependencies') && (
        <div className="bg-gray-900 rounded-lg p-8 text-center border border-gray-800">
          <p className="text-gray-400">功能开发中...</p>
        </div>
      )}
    </div>
  )
}

export default SkillAuditPage
