import React, { useState } from 'react'
import {
  Gift,
  Bug,
  Zap,
  AlertTriangle,
  CheckCircle,
  Clock,
  Download,
} from 'lucide-react'
import { PageContainer } from '@/components/templates/PageContainer'
import { PageHeader } from '@/components/templates/PageHeader'
import { Button } from '@/components/atoms/Button'
import { Badge } from '@/components/atoms/Badge'
import { Card } from '@/components/atoms/Card'
import { CHANGELOG_TYPE_BADGE, DEFAULT_BADGE } from '@/components/atoms/statusColors'

/**
 * 更新日志页面
 * 功能：版本历史、功能更新、Bug修复、已知问题、Markdown渲染
 */
interface ChangelogEntry {
  version: string
  releaseDate: string
  type: 'major' | 'minor' | 'patch'
  highlights: string[]
  features: ChangelogItem[]
  bugFixes: ChangelogItem[]
  improvements: ChangelogItem[]
  knownIssues: ChangelogItem[]
  breakingChanges?: string[]
}

interface ChangelogItem {
  title: string
  description: string
  author?: string
}

const ChangelogPage: React.FC = () => {
  const [selectedVersion, setSelectedVersion] = useState<string>('all')

  // Mock数据：更新日志
  const [changelog] = useState<ChangelogEntry[]>([
    {
      version: '2.0.0',
      releaseDate: '2026-07-06',
      type: 'major',
      highlights: [
        '完善Agent管理控制台（A-F功能）',
        '添加模型升级流程管理',
        '添加Skill核查可视化',
        '添加优化建议展示',
      ],
      features: [
        {
          title: 'Agent管理控制台完善',
          description: '完成自定义智能体、能力图谱、DAG调度器、数据标签管理、API配置管理等功能',
          author: 'AI Agent',
        },
        {
          title: '模型升级流程管理',
          description: '支持模型版本管理、升级计划配置、A/B测试、回滚策略',
          author: 'AI Agent',
        },
        {
          title: 'Skill核查可视化',
          description: '监控和分析所有Skill的使用情况、性能和依赖关系',
          author: 'AI Agent',
        },
      ],
      bugFixes: [
        {
          title: '修复硬编码颜色',
          description: '将所有硬编码颜色替换为颜色令牌，提升主题一致性',
        },
        {
          title: '修复ESLint P0问题',
          description: '修复浮动Promise和误用Promise问题，提升代码质量',
        },
      ],
      improvements: [
        {
          title: '创建业务阈值常量文件',
          description: '将魔法数字提取到thresholds.ts，提升代码可维护性',
        },
      ],
      knownIssues: [
        {
          title: '单元测试Worker崩溃',
          description: '某些测试文件导致Worker崩溃，需要修复环境问题',
        },
      ],
      breakingChanges: [
        'Agent管理控制台路由结构变更，需要更新书签',
      ],
    },
    {
      version: '1.5.0',
      releaseDate: '2026-06-28',
      type: 'minor',
      highlights: [
        '添加Agent管理控制台基础框架',
        '实现智能体注册表和任务触发',
        '添加LLM管理功能',
      ],
      features: [
        {
          title: 'AgentHubPage导航中心',
          description: '创建Agent管理控制台导航中心，包含7个子功能入口',
        },
        {
          title: 'AgentRegistryPage',
          description: '实现智能体注册表功能，支持搜索和过滤',
        },
      ],
      bugFixes: [],
      improvements: [
        {
          title: '优化构建配置',
          description: '提升构建速度，减少打包体积',
        },
      ],
      knownIssues: [],
    },
    {
      version: '1.0.0',
      releaseDate: '2026-06-01',
      type: 'major',
      highlights: [
        'V9系统首个稳定版本发布',
        '实现核心交易和分析功能',
        '添加基础Agent系统',
      ],
      features: [
        {
          title: '核心交易功能',
          description: '实现交易复盘、信号生成、持仓管理等功能',
        },
        {
          title: '技术分析',
          description: '实现各类技术指标计算和可视化',
        },
      ],
      bugFixes: [],
      improvements: [],
      knownIssues: [
        {
          title: '缺少单元测试',
          description: '核心模块测试覆盖率不足',
        },
      ],
    },
  ])

  const getTypeBadge = (type: string) => {
    const badge = CHANGELOG_TYPE_BADGE[type] ?? DEFAULT_BADGE
    return (
      <Badge variant="outline" className={badge.badge}>
        {badge.label}
      </Badge>
    )
  }

  const filteredChangelog = selectedVersion === 'all'
    ? changelog
    : changelog.filter(entry => entry.version === selectedVersion)

  return (
    <PageContainer className="min-h-screen bg-background text-foreground">
      <PageHeader
        title="更新日志"
        description="查看系统版本更新历史和新功能介绍"
      />

      {/* 版本选择 */}
      <div className="mb-6 flex flex-wrap gap-2">
        <Button
          variant={selectedVersion === 'all' ? 'primary' : 'secondary'}
          onClick={() => setSelectedVersion('all')}
          className="rounded-lg px-4 py-2"
        >
          全部版本
        </Button>
        {changelog.map(entry => (
          <Button
            key={entry.version}
            variant={selectedVersion === entry.version ? 'primary' : 'secondary'}
            onClick={() => setSelectedVersion(entry.version)}
            className="rounded-lg px-4 py-2"
          >
            v{entry.version}
          </Button>
        ))}
      </div>

      {/* 更新日志列表 */}
      <div className="space-y-8">
        {filteredChangelog.map(entry => (
          <Card key={entry.version} className="p-6">
            <div className="mb-6 flex items-start justify-between">
              <div>
                <div className="mb-2 flex items-center gap-3">
                  <h2 className="text-h2 text-foreground">
                    v{entry.version}
                  </h2>
                  {getTypeBadge(entry.type)}
                </div>
                <p className="text-muted-foreground">
                  发布于 {entry.releaseDate}
                </p>
              </div>
              <Button variant="secondary" className="flex items-center gap-2 rounded-lg px-4 py-2">
                <Download className="h-4 w-4" />
                下载此版本
              </Button>
            </div>

            {/* 亮点 */}
            {entry.highlights.length > 0 && (
              <div className="mb-6">
                <h3 className="mb-3 flex items-center gap-2 text-h3 text-foreground">
                  <Zap className="h-5 w-5 text-warning" />
                  亮点
                </h3>
                <ul className="space-y-2">
                  {entry.highlights.map((highlight, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-success" />
                      <span className="text-muted-foreground">{highlight}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 新功能 */}
            {entry.features.length > 0 && (
              <div className="mb-6">
                <h3 className="mb-3 flex items-center gap-2 text-h3 text-foreground">
                  <Gift className="h-5 w-5 text-info" />
                  新功能
                </h3>
                <div className="space-y-3">
                  {entry.features.map((feature, idx) => (
                    <div key={idx} className="rounded bg-muted p-4">
                      <div className="mb-1 font-semibold text-foreground">
                        {feature.title}
                      </div>
                      <div className="text-body-sm text-muted-foreground">
                        {feature.description}
                      </div>
                      {feature.author && (
                        <div className="mt-2 text-xs text-tertiary">
                          贡献者：{feature.author}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bug修复 */}
            {entry.bugFixes.length > 0 && (
              <div className="mb-6">
                <h3 className="mb-3 flex items-center gap-2 text-h3 text-foreground">
                  <Bug className="h-5 w-5 text-destructive" />
                  Bug修复
                </h3>
                <div className="space-y-3">
                  {entry.bugFixes.map((fix, idx) => (
                    <div key={idx} className="rounded bg-muted p-4">
                      <div className="mb-1 font-semibold text-foreground">
                        {fix.title}
                      </div>
                      <div className="text-body-sm text-muted-foreground">
                        {fix.description}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 改进 */}
            {entry.improvements.length > 0 && (
              <div className="mb-6">
                <h3 className="mb-3 flex items-center gap-2 text-h3 text-foreground">
                  <Zap className="h-5 w-5 text-warning" />
                  改进
                </h3>
                <div className="space-y-3">
                  {entry.improvements.map((improvement, idx) => (
                    <div key={idx} className="rounded bg-muted p-4">
                      <div className="mb-1 font-semibold text-foreground">
                        {improvement.title}
                      </div>
                      <div className="text-body-sm text-muted-foreground">
                        {improvement.description}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 破坏性变更 */}
            {entry.breakingChanges && entry.breakingChanges.length > 0 && (
              <div className="mb-6">
                <h3 className="mb-3 flex items-center gap-2 text-h3 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                  破坏性变更
                </h3>
                <div className="space-y-2">
                  {entry.breakingChanges.map((change, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive" />
                      <span className="text-destructive">{change}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 已知问题 */}
            {entry.knownIssues.length > 0 && (
              <div>
                <h3 className="mb-3 flex items-center gap-2 text-h3 text-muted-foreground">
                  <Clock className="h-5 w-5" />
                  已知问题
                </h3>
                <div className="space-y-3">
                  {entry.knownIssues.map((issue, idx) => (
                    <div key={idx} className="rounded bg-muted p-4">
                      <div className="mb-1 font-semibold text-foreground">
                        {issue.title}
                      </div>
                      <div className="text-body-sm text-muted-foreground">
                        {issue.description}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>
    </PageContainer>
  )
}

export default ChangelogPage