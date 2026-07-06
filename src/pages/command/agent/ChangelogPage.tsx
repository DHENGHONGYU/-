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
import { twText, twBg } from '@/constants/theme.tokens'

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
    const config: Record<string, { color: string; text: string }> = {
      'major': { color: 'text-red-400 bg-red-900/30', text: '重大更新' },
      'minor': { color: 'text-blue-400 bg-blue-900/30', text: '功能更新' },
      'patch': { color: 'text-green-400 bg-green-900/30', text: '问题修复' },
    }
    const badge = config[type] ?? config['patch'] ?? { color: '', text: '' }
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${badge.color}`}>
        {badge.text}
      </span>
    )
  }

  const filteredChangelog = selectedVersion === 'all' 
    ? changelog 
    : changelog.filter(entry => entry.version === selectedVersion)

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="mb-8">
        <h1 className={`text-3xl font-bold ${twText('primary')} mb-2`}>
          更新日志
        </h1>
        <p className={twText('muted')}>
          查看系统版本更新历史和新功能介绍
        </p>
      </div>

      {/* 版本选择 */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setSelectedVersion('all')}
          className={`px-4 py-2 rounded-lg transition-colors ${
            selectedVersion === 'all'
              ? 'bg-blue-600 text-white'
              : `${twBg('card')} ${twText('muted')} hover:bg-gray-800`
          }`}
        >
          全部版本
        </button>
        {changelog.map(entry => (
          <button
            key={entry.version}
            onClick={() => setSelectedVersion(entry.version)}
            className={`px-4 py-2 rounded-lg transition-colors ${
              selectedVersion === entry.version
                ? 'bg-blue-600 text-white'
                : `${twBg('card')} ${twText('muted')} hover:bg-gray-800`
            }`}
          >
            v{entry.version}
          </button>
        ))}
      </div>

      {/* 更新日志列表 */}
      <div className="space-y-8">
        {filteredChangelog.map(entry => (
          <div key={entry.version} className={`${twBg('card')} rounded-lg p-6 border border-gray-800`}>
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h2 className={`text-2xl font-bold ${twText('primary')}`}>
                    v{entry.version}
                  </h2>
                  {getTypeBadge(entry.type)}
                </div>
                <p className={twText('muted')}>
                  发布于 {entry.releaseDate}
                </p>
              </div>
              <button className={`px-4 py-2 ${twBg('muted')} hover:bg-gray-700 rounded-lg transition-colors flex items-center gap-2`}>
                <Download className="w-4 h-4" />
                下载此版本
              </button>
            </div>

            {/* 亮点 */}
            {entry.highlights.length > 0 && (
              <div className="mb-6">
                <h3 className={`text-lg font-semibold ${twText('primary')} mb-3 flex items-center gap-2`}>
                  <Zap className="w-5 h-5 text-yellow-400" />
                  亮点
                </h3>
                <ul className="space-y-2">
                  {entry.highlights.map((highlight, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                      <span className={twText('secondary')}>{highlight}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 新功能 */}
            {entry.features.length > 0 && (
              <div className="mb-6">
                <h3 className={`text-lg font-semibold ${twText('primary')} mb-3 flex items-center gap-2`}>
                  <Gift className="w-5 h-5 text-blue-400" />
                  新功能
                </h3>
                <div className="space-y-3">
                  {entry.features.map((feature, idx) => (
                    <div key={idx} className={`${twBg('muted')} rounded p-4`}>
                      <div className="font-semibold text-white mb-1">
                        {feature.title}
                      </div>
                      <div className={`text-sm ${twText('secondary')}`}>
                        {feature.description}
                      </div>
                      {feature.author && (
                        <div className={`text-xs ${twText('muted')} mt-2`}>
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
                <h3 className={`text-lg font-semibold ${twText('primary')} mb-3 flex items-center gap-2`}>
                  <Bug className="w-5 h-5 text-red-400" />
                  Bug修复
                </h3>
                <div className="space-y-3">
                  {entry.bugFixes.map((fix, idx) => (
                    <div key={idx} className={`${twBg('muted')} rounded p-4`}>
                      <div className="font-semibold text-white mb-1">
                        {fix.title}
                      </div>
                      <div className={`text-sm ${twText('secondary')}`}>
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
                <h3 className={`text-lg font-semibold ${twText('primary')} mb-3 flex items-center gap-2`}>
                  <Zap className="w-5 h-5 text-yellow-400" />
                  改进
                </h3>
                <div className="space-y-3">
                  {entry.improvements.map((improvement, idx) => (
                    <div key={idx} className={`${twBg('muted')} rounded p-4`}>
                      <div className="font-semibold text-white mb-1">
                        {improvement.title}
                      </div>
                      <div className={`text-sm ${twText('secondary')}`}>
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
                <h3 className={`text-lg font-semibold ${twText('danger')} mb-3 flex items-center gap-2`}>
                  <AlertTriangle className="w-5 h-5" />
                  破坏性变更
                </h3>
                <div className="space-y-2">
                  {entry.breakingChanges.map((change, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                      <span className={twText('danger')}>{change}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 已知问题 */}
            {entry.knownIssues.length > 0 && (
              <div>
                <h3 className={`text-lg font-semibold ${twText('muted')} mb-3 flex items-center gap-2`}>
                  <Clock className="w-5 h-5" />
                  已知问题
                </h3>
                <div className="space-y-3">
                  {entry.knownIssues.map((issue, idx) => (
                    <div key={idx} className={`${twBg('muted')} rounded p-4`}>
                      <div className="font-semibold text-white mb-1">
                        {issue.title}
                      </div>
                      <div className={`text-sm ${twText('secondary')}`}>
                        {issue.description}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default ChangelogPage
