import React, { useState } from 'react'
import { 
  Lightbulb,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Zap,
  Shield,
  Code,
  Filter,
  Search,
  ExternalLink,
} from 'lucide-react'
import { twText, twBg } from '@/constants/theme.tokens'

/**
 * 优化建议展示页面
 * 功能：性能优化建议、代码质量建议、安全建议、优先级排序、实施跟踪
 */
interface OptimizationSuggestion {
  id: string
  title: string
  category: 'performance' | 'quality' | 'security' | 'architecture'
  priority: 'high' | 'medium' | 'low'
  status: 'open' | 'in-progress' | 'completed' | 'dismissed'
  description: string
  impact: string
  effort: string
  location?: string
  createdAt: string
  updatedAt: string
  assignee?: string
}

const OptimizationSuggestionsPage: React.FC = () => {
  const [activeFilter, setActiveFilter] = useState<'all' | 'open' | 'in-progress' | 'completed'>('all')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Mock数据：优化建议
  const [suggestions] = useState<OptimizationSuggestion[]>([
    {
      id: '1',
      title: '减少不必要的re-render',
      category: 'performance',
      priority: 'high',
      status: 'open',
      description: '多个组件在状态变化时触发不必要的重新渲染，建议使用React.memo或useMemo优化',
      impact: '提升渲染性能30-50%',
      effort: '2-3天',
      location: 'src/components/**/*.tsx',
      createdAt: '2026-07-01',
      updatedAt: '2026-07-01',
    },
    {
      id: '2',
      title: '优化大数据列表渲染',
      category: 'performance',
      priority: 'high',
      status: 'in-progress',
      description: '交易记录列表渲染5000+行时性能较差，建议使用虚拟滚动（react-window）',
      impact: '提升列表滚动性能70%',
      effort: '3-5天',
      location: 'src/pages/TradeReviewPage.tsx',
      createdAt: '2026-06-28',
      updatedAt: '2026-07-03',
      assignee: '张三',
    },
    {
      id: '3',
      title: '修复ESLint警告',
      category: 'quality',
      priority: 'medium',
      status: 'open',
      description: '当前有240个ESLint警告，建议逐步修复或添加到ignore列表',
      impact: '提升代码质量，减少潜在bug',
      effort: '1-2周',
      location: 'src/**/*.tsx',
      createdAt: '2026-07-05',
      updatedAt: '2026-07-05',
    },
    {
      id: '4',
      title: '减少代码重复',
      category: 'quality',
      priority: 'medium',
      status: 'open',
      description: '多个组件中存在重复的代码逻辑，建议提取为共用函数或Hook',
      impact: '提升代码可维护性',
      effort: '3-5天',
      location: 'src/components/ui/*.tsx',
      createdAt: '2026-07-02',
      updatedAt: '2026-07-02',
    },
    {
      id: '5',
      title: '更新依赖包',
      category: 'security',
      priority: 'high',
      status: 'open',
      description: 'axios@0.27.2存在已知漏洞（CVE-2023-45857），建议更新到0.28.0+',
      impact: '修复安全漏洞',
      effort: '0.5天',
      location: 'package.json',
      createdAt: '2026-07-04',
      updatedAt: '2026-07-04',
    },
    {
      id: '6',
      title: '优化状态管理架构',
      category: 'architecture',
      priority: 'low',
      status: 'dismissed',
      description: '当前使用多个独立store，建议统一为单一store或使用context',
      impact: '提升状态管理一致性',
      effort: '1-2周',
      createdAt: '2026-06-20',
      updatedAt: '2026-06-25',
    },
  ])

  const getPriorityBadge = (priority: string) => {
    const config = {
      'high': { color: 'text-red-400 bg-red-900/30', text: '高' },
      'medium': { color: 'text-yellow-400 bg-yellow-900/30', text: '中' },
      'low': { color: 'text-blue-400 bg-blue-900/30', text: '低' },
    }
    const badge = config[priority] || config['medium']
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${badge.color}`}>
        {badge.text}
      </span>
    )
  }

  const getStatusBadge = (status: string) => {
    const config = {
      'open': { color: 'text-blue-400 bg-blue-900/30', text: '待处理' },
      'in-progress': { color: 'text-yellow-400 bg-yellow-900/30', text: '进行中' },
      'completed': { color: 'text-green-400 bg-green-900/30', text: '已完成' },
      'dismissed': { color: 'text-gray-400 bg-gray-900/30', text: '已忽略' },
    }
    const badge = config[status] || config['open']
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${badge.color}`}>
        {badge.text}
      </span>
    )
  }

  const getCategoryIcon = (category: string) => {
    const config = {
      'performance': { icon: Zap, color: 'text-yellow-400' },
      'quality': { icon: Code, color: 'text-blue-400' },
      'security': { icon: Shield, color: 'text-red-400' },
      'architecture': { icon: TrendingUp, color: 'text-green-400' },
    }
    const cat = config[category] || config['quality']
    const Icon = cat.icon
    return <Icon className={`w-5 h-5 ${cat.color}`} />
  }

  const filteredSuggestions = suggestions
    .filter(s => activeFilter === 'all' || s.status === activeFilter)
    .filter(s => selectedCategory === 'all' || s.category === selectedCategory)
    .filter(s => 
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.description.toLowerCase().includes(searchQuery.toLowerCase())
    )

  const stats = {
    total: suggestions.length,
    open: suggestions.filter(s => s.status === 'open').length,
    inProgress: suggestions.filter(s => s.status === 'in-progress').length,
    completed: suggestions.filter(s => s.status === 'completed').length,
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="mb-8">
        <h1 className={`text-3xl font-bold ${twText('primary')} mb-2`}>
          优化建议
        </h1>
        <p className={twText('muted')}>
          查看和实施系统优化建议，提升性能、质量和安全性
        </p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className={`${twBg('card')} rounded p-4 border border-gray-800`}>
          <div className={`text-sm ${twText('muted')} mb-1`}>总建议数</div>
          <div className={`text-2xl font-bold ${twText('accent')}`}>{stats.total}</div>
        </div>
        <div className={`${twBg('card')} rounded p-4 border border-gray-800`}>
          <div className={`text-sm ${twText('muted')} mb-1`}>待处理</div>
          <div className="text-2xl font-bold text-blue-400">{stats.open}</div>
        </div>
        <div className={`${twBg('card')} rounded p-4 border border-gray-800`}>
          <div className={`text-sm ${twText('muted')} mb-1`}>进行中</div>
          <div className="text-2xl font-bold text-yellow-400">{stats.inProgress}</div>
        </div>
        <div className={`${twBg('card')} rounded p-4 border border-gray-800`}>
          <div className={`text-sm ${twText('muted')} mb-1`}>已完成</div>
          <div className="text-2xl font-bold text-green-400">{stats.completed}</div>
        </div>
      </div>

      {/* 过滤和搜索 */}
      <div className="flex gap-4 mb-6">
        <div className="flex gap-2">
          {[
            { key: 'all', label: '全部' },
            { key: 'open', label: '待处理' },
            { key: 'in-progress', label: '进行中' },
            { key: 'completed', label: '已完成' },
          ].map(filter => (
            <button
              key={filter.key}
              onClick={() => setActiveFilter(filter.key as any)}
              className={`px-4 py-2 rounded-lg transition-colors ${
                activeFilter === filter.key
                  ? 'bg-blue-600 text-white'
                  : `${twBg('card')} ${twText('muted')} hover:bg-gray-800`
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <div className="flex-1 relative">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${twText('muted')}`} />
          <input
            type="text"
            placeholder="搜索建议..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full pl-10 pr-4 py-2 ${twBg('card')} border border-gray-800 rounded-lg ${twText('primary')} focus:outline-none focus:border-blue-500`}
          />
        </div>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className={`px-4 py-2 ${twBg('card')} border border-gray-800 rounded-lg ${twText('primary')} focus:outline-none focus:border-blue-500`}
        >
          <option value="all">全部分类</option>
          <option value="performance">性能</option>
          <option value="quality">代码质量</option>
          <option value="security">安全</option>
          <option value="architecture">架构</option>
        </select>
      </div>

      {/* 建议列表 */}
      <div className="space-y-4">
        {filteredSuggestions.map(suggestion => (
          <div key={suggestion.id} className={`${twBg('card')} rounded-lg p-6 border border-gray-800`}>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 mt-1">
                {getCategoryIcon(suggestion.category)}
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className={`text-xl font-semibold ${twText('primary')}`}>
                        {suggestion.title}
                      </h3>
                      {getPriorityBadge(suggestion.priority)}
                      {getStatusBadge(suggestion.status)}
                    </div>
                    <p className={`${twText('secondary')} mb-4`}>
                      {suggestion.description}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className={`${twBg('muted')} rounded p-3`}>
                    <div className={`text-sm ${twText('muted')} mb-1`}>预期影响</div>
                    <div className={`font-semibold ${twText('primary')}`}>
                      {suggestion.impact}
                    </div>
                  </div>
                  <div className={`${twBg('muted')} rounded p-3`}>
                    <div className={`text-sm ${twText('muted')} mb-1`}>工作量评估</div>
                    <div className={`font-semibold ${twText('primary')}`}>
                      {suggestion.effort}
                    </div>
                  </div>
                  <div className={`${twBg('muted')} rounded p-3`}>
                    <div className={`text-sm ${twText('muted')} mb-1`}>创建时间</div>
                    <div className={`font-semibold ${twText('primary')}`}>
                      {suggestion.createdAt}
                    </div>
                  </div>
                  <div className={`${twBg('muted')} rounded p-3`}>
                    <div className={`text-sm ${twText('muted')} mb-1`}>负责人</div>
                    <div className={`font-semibold ${twText('primary')}`}>
                      {suggestion.assignee || '未分配'}
                    </div>
                  </div>
                </div>

                {suggestion.location && (
                  <div className="mb-4">
                    <span className={`text-sm ${twText('muted')}`}>位置：</span>
                    <code className="px-2 py-1 bg-gray-800 rounded text-sm text-blue-400">
                      {suggestion.location}
                    </code>
                  </div>
                )}

                <div className="flex gap-2">
                  {suggestion.status === 'open' && (
                    <>
                      <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
                        开始处理
                      </button>
                      <button className={`px-4 py-2 ${twBg('muted')} hover:bg-gray-700 rounded-lg transition-colors`}>
                        忽略
                      </button>
                    </>
                  )}
                  {suggestion.status === 'in-progress' && (
                    <button className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors">
                      标记完成
                    </button>
                  )}
                  <button className={`px-4 py-2 ${twBg('muted')} hover:bg-gray-700 rounded-lg transition-colors flex items-center gap-2`}>
                    <ExternalLink className="w-4 h-4" />
                    查看详情
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default OptimizationSuggestionsPage
