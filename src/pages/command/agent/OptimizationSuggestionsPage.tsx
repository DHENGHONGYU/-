import React, { useState } from 'react'
import {
  Zap,
  Code,
  Shield,
  TrendingUp,
  Search,
  ExternalLink,
} from 'lucide-react'
import { PageContainer } from '@/components/templates/PageContainer'
import { PageHeader } from '@/components/molecules/PageHeader'
import { PRIORITY_BADGE, SUGGESTION_STATUS_BADGE, CATEGORY_ICON_COLOR, DEFAULT_BADGE } from '@/components/atoms/statusColors'

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
    const badge = PRIORITY_BADGE[priority] ?? DEFAULT_BADGE
    return (
      <span className={`rounded px-2 py-1 text-xs font-medium ${badge.badge}`}>
        {badge.label}
      </span>
    )
  }

  const getStatusBadge = (status: string) => {
    const badge = SUGGESTION_STATUS_BADGE[status] ?? DEFAULT_BADGE
    return (
      <span className={`rounded px-2 py-1 text-xs font-medium ${badge.badge}`}>
        {badge.label}
      </span>
    )
  }

  const getCategoryIcon = (category: string) => {
    const color = CATEGORY_ICON_COLOR[category] ?? 'text-muted-foreground'
    const Icon = {
      performance: Zap,
      quality: Code,
      security: Shield,
      architecture: TrendingUp,
    }[category] ?? Zap
    return <Icon className={`h-5 w-5 ${color}`} />
  }

  const filteredSuggestions = suggestions
    .filter(s => activeFilter === 'all' || s.status === activeFilter)
    .filter(s => selectedCategory === 'all' || s.category === selectedCategory)
    .filter(s =>
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.description.toLowerCase().includes(searchQuery.toLowerCase()),
    )

  const stats = {
    total: suggestions.length,
    open: suggestions.filter(s => s.status === 'open').length,
    inProgress: suggestions.filter(s => s.status === 'in-progress').length,
    completed: suggestions.filter(s => s.status === 'completed').length,
  }

  return (
    <PageContainer className="min-h-screen bg-background text-foreground">
      <PageHeader
        title="优化建议"
        description="查看和实施系统优化建议，提升性能、质量和安全性"
      />

      {/* 统计卡片 */}
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="mb-1 text-body-sm text-muted-foreground">总建议数</div>
          <div className="text-h2 font-bold text-primary">{stats.total}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="mb-1 text-body-sm text-muted-foreground">待处理</div>
          <div className="text-h2 font-bold text-info">{stats.open}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="mb-1 text-body-sm text-muted-foreground">进行中</div>
          <div className="text-h2 font-bold text-warning">{stats.inProgress}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="mb-1 text-body-sm text-muted-foreground">已完成</div>
          <div className="text-h2 font-bold text-success">{stats.completed}</div>
        </div>
      </div>

      {/* 过滤和搜索 */}
      <div className="mb-6 flex flex-wrap gap-4">
        <div className="flex gap-2">
          {[
            { key: 'all' as const, label: '全部' },
            { key: 'open' as const, label: '待处理' },
            { key: 'in-progress' as const, label: '进行中' },
            { key: 'completed' as const, label: '已完成' },
          ].map(filter => (
            <button
              key={filter.key}
              onClick={() => setActiveFilter(filter.key)}
              className={`rounded-lg px-4 py-2 transition-colors ${
                activeFilter === filter.key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card text-muted-foreground hover:bg-accent'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="搜索建议..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-border bg-card py-2 pl-10 pr-4 text-foreground focus:border-primary focus:outline-none"
          />
        </div>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="rounded-lg border border-border bg-card px-4 py-2 text-foreground focus:border-primary focus:outline-none"
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
          <div key={suggestion.id} className="rounded-lg border bg-card p-6">
            <div className="flex items-start gap-4">
              <div className="mt-1 flex-shrink-0">
                {getCategoryIcon(suggestion.category)}
              </div>
              <div className="flex-1">
                <div className="mb-2 flex items-start justify-between">
                  <div>
                    <div className="mb-2 flex items-center gap-3">
                      <h3 className="text-h3 text-foreground">
                        {suggestion.title}
                      </h3>
                      {getPriorityBadge(suggestion.priority)}
                      {getStatusBadge(suggestion.status)}
                    </div>
                    <p className="mb-4 text-muted-foreground">
                      {suggestion.description}
                    </p>
                  </div>
                </div>

                <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
                  <div className="rounded bg-muted p-3">
                    <div className="mb-1 text-body-sm text-muted-foreground">预期影响</div>
                    <div className="font-semibold text-foreground">
                      {suggestion.impact}
                    </div>
                  </div>
                  <div className="rounded bg-muted p-3">
                    <div className="mb-1 text-body-sm text-muted-foreground">工作量评估</div>
                    <div className="font-semibold text-foreground">
                      {suggestion.effort}
                    </div>
                  </div>
                  <div className="rounded bg-muted p-3">
                    <div className="mb-1 text-body-sm text-muted-foreground">创建时间</div>
                    <div className="font-semibold text-foreground">
                      {suggestion.createdAt}
                    </div>
                  </div>
                  <div className="rounded bg-muted p-3">
                    <div className="mb-1 text-body-sm text-muted-foreground">负责人</div>
                    <div className="font-semibold text-foreground">
                      {suggestion.assignee || '未分配'}
                    </div>
                  </div>
                </div>

                {suggestion.location && (
                  <div className="mb-4">
                    <span className="text-body-sm text-muted-foreground">位置：</span>
                    <code className="rounded bg-muted px-2 py-1 text-body-sm text-info">
                      {suggestion.location}
                    </code>
                  </div>
                )}

                <div className="flex gap-2">
                  {suggestion.status === 'open' && (
                    <>
                      <button className="rounded-lg bg-primary px-4 py-2 text-primary-foreground transition-colors hover:bg-primary/90">
                        开始处理
                      </button>
                      <button className="rounded-lg bg-muted px-4 py-2 text-foreground transition-colors hover:bg-accent">
                        忽略
                      </button>
                    </>
                  )}
                  {suggestion.status === 'in-progress' && (
                    <button className="rounded-lg bg-success px-4 py-2 text-success-foreground transition-colors hover:bg-success/90">
                      标记完成
                    </button>
                  )}
                  <button className="flex items-center gap-2 rounded-lg bg-muted px-4 py-2 text-foreground transition-colors hover:bg-accent">
                    <ExternalLink className="h-4 w-4" />
                    查看详情
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </PageContainer>
  )
}

export default OptimizationSuggestionsPage
