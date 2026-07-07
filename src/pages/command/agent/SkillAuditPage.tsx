import React, { useState, useEffect } from 'react'
import { 
  Search,
  BarChart3,
  TrendingUp,
  GitBranch,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react'
import { THEME_TOKENS, COLOR_TOKENS } from '@/constants/theme.tokens'
import { PageContainer } from '@/components/ui/PageContainer'
import { PageHeader } from '@/components/ui/PageHeader'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

/** Skill 状态徽章颜色配置 */
const STATUS_BADGE_CONFIG: Record<string, { textColor: string; bgColorHex: string; text: string }> = {
  'active': { textColor: 'text-success', bgColorHex: COLOR_TOKENS.success.hex, text: '运行中' },
  'deprecated': { textColor: 'text-warning', bgColorHex: COLOR_TOKENS.warning.hex, text: '已废弃' },
  'error': { textColor: 'text-destructive', bgColorHex: COLOR_TOKENS.danger.hex, text: '错误' },
  'testing': { textColor: 'text-info', bgColorHex: COLOR_TOKENS.info.hex, text: '测试中' },
}

/** 成功率阈值 */
const SUCCESS_RATE_EXCELLENT = 99
const SUCCESS_RATE_GOOD = 95

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

  useEffect(() => {
    logger.info('[SkillAuditPage] 组件已挂载')
  }, [])

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
    const badge = STATUS_BADGE_CONFIG[status] ?? STATUS_BADGE_CONFIG['active'] ?? { textColor: '', bgColorHex: '', text: '' }
    return (
      <span
        className={`px-2 py-1 rounded text-xs font-medium ${badge.textColor}`}
        style={{ backgroundColor: `${badge.bgColorHex}4D` }}
      >
        {badge.text}
      </span>
    )
  }

  return (
    <PageContainer className="min-h-screen bg-background text-foreground">
      <PageHeader
        title="Skill核查可视化"
        description="监控和分析所有Skill的使用情况、性能和依赖关系"
      />

      <div className={`flex gap-2 mb-6 border-b ${'border-border'}`}>
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
                ? `border-b-2 ${'border-info'} ${'text-info'}`
                : 'text-tertiary'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${'text-tertiary'}`} />
          <input
            type="text"
            placeholder="搜索Skill..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full pl-10 pr-4 py-2 ${'bg-card'} border ${'border-border'} rounded-lg text-foreground focus:outline-none ${THEME_TOKENS.focusVisible.ringWidth} ${THEME_TOKENS.focusVisible.ringColor}`}
          />
        </div>
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className={`${'bg-card'} rounded p-4 border ${'border-border'}`}>
              <div className={`text-sm ${'text-tertiary'} mb-1`}>总Skill数</div>
              <div className={`text-2xl font-bold ${'text-info'}`}>{skills.length}</div>
            </div>
            <div className={`${'bg-card'} rounded p-4 border ${'border-border'}`}>
              <div className={`text-sm ${'text-tertiary'} mb-1`}>活跃Skill</div>
              <div className={`text-2xl font-bold ${'text-success'}`}>
                {skills.filter(s => s.status === 'active').length}
              </div>
            </div>
            <div className={`${'bg-card'} rounded p-4 border ${'border-border'}`}>
              <div className={`text-sm ${'text-tertiary'} mb-1`}>总使用次数</div>
              <div className={`text-2xl font-bold ${'text-info'}`}>
                {skills.reduce((sum, s) => sum + s.usageCount, 0).toLocaleString()}
              </div>
            </div>
            <div className={`${'bg-card'} rounded p-4 border ${'border-border'}`}>
              <div className={`text-sm ${'text-tertiary'} mb-1`}>平均成功率</div>
              <div className={`text-2xl font-bold ${'text-success'}`}>
                {(skills.reduce((sum, s) => sum + s.successRate, 0) / skills.length).toFixed(1)}%
              </div>
            </div>
          </div>

          {skills
            .filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()))
            .map(skill => (
              <div key={skill.id} className={`${'bg-card'} rounded-lg p-6 border ${'border-border'}`}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold text-foreground">
                        {skill.name}
                      </h3>
                      {getStatusBadge(skill.status)}
                      <span className={`px-2 py-1 rounded text-xs ${'bg-muted'} ${'text-tertiary'}`}>
                        v{skill.version}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-2xl font-bold ${
                      skill.successRate >= SUCCESS_RATE_EXCELLENT ? 'text-success' :
                      skill.successRate >= SUCCESS_RATE_GOOD ? 'text-warning' : 'text-destructive'
                    }`}>
                      {skill.successRate}%
                    </div>
                    <div className={`text-sm ${'text-tertiary'}`}>成功率</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className={`${'bg-muted'} rounded p-3`}>
                    <div className={`text-sm ${'text-tertiary'} mb-1`}>使用次数</div>
                    <div className="font-semibold text-foreground">
                      {skill.usageCount.toLocaleString()}
                    </div>
                  </div>
                  <div className={`${'bg-muted'} rounded p-3`}>
                    <div className={`text-sm ${'text-tertiary'} mb-1`}>平均执行时间</div>
                    <div className="font-semibold text-foreground">
                      {skill.avgExecutionTime}ms
                    </div>
                  </div>
                  <div className={`${'bg-muted'} rounded p-3`}>
                    <div className={`text-sm ${'text-tertiary'} mb-1`}>最后使用</div>
                    <div className="font-semibold text-foreground">
                      {skill.lastUsed}
                    </div>
                  </div>
                  <div className={`${'bg-muted'} rounded p-3`}>
                    <div className={`text-sm ${'text-tertiary'} mb-1`}>分类</div>
                    <div className="font-semibold text-foreground">
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
              <div key={skill.id} className={`${'bg-card'} rounded-lg p-6 border ${'border-destructive'}`}>
                <div className="flex items-start gap-4">
                  <AlertTriangle className={`w-8 h-8 ${'text-destructive'} flex-shrink-0`} />
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-foreground mb-2">
                      {skill.name}
                    </h3>
                    {skill.status === 'error' && (
                      <div className="flex items-center gap-2">
                        <AlertTriangle className={`w-4 h-4 ${'text-destructive'}`} />
                        <span className={'text-destructive'}>Skill状态异常</span>
                      </div>
                    )}
                    {skill.successRate < 95 && (
                      <div className="flex items-center gap-2">
                        <AlertTriangle className={`w-4 h-4 ${'text-warning'}`} />
                        <span className={'text-warning'}>
                          成功率过低：{skill.successRate}%（建议≥95%）
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          {skills.filter(s => s.status === 'error' || s.successRate < 95).length === 0 && (
            <div className={`${'bg-card'} rounded-lg p-8 text-center border ${'border-border'}`}>
              <CheckCircle className={`w-16 h-16 ${'text-success'} mx-auto mb-4`} />
              <p className="text-foreground">暂无问题Skill</p>
            </div>
          )}
        </div>
      )}

      {(activeTab === 'performance' || activeTab === 'dependencies') && (
        <div className={`${'bg-card'} rounded-lg p-8 text-center border ${'border-border'}`}>
          <p className={'text-tertiary'}>功能开发中...</p>
        </div>
      )}
    </PageContainer>
  )
}

export default SkillAuditPage
