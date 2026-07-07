import React, { useState, useCallback } from 'react'
import {
  PlusIcon,
  PlayIcon,
  PauseIcon,
  PencilIcon,
  TrashIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'
import { PageContainer } from '@/components/ui/PageContainer'

import { nanoid } from 'nanoid'
/**
 * DAG工作流接口
 */
interface DagWorkflow {
  id: string
  name: string
  description: string
  status: 'active' | 'paused' | 'stopped' | 'error'
  schedule: string // cron表达式
  tasks: DagTask[]
  createdAt: string
  updatedAt: string
  lastRun?: string
  nextRun?: string
}

/**
 * DAG任务接口
 */
interface DagTask {
  id: string
  name: string
  type: 'agent' | 'data' | 'calculation' | 'notification'
  agentId?: string
  config: Record<string, unknown>
  dependencies: string[] // 依赖的任务ID
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
  retryCount: number
  maxRetries: number
}

/**
 * DAG调度器页面
 * 
 * @component
 * @remarks
 * 功能：
 * - 创建/编辑/删除DAG工作流
 * - 配置工作流调度（cron表达式）
 * - 监控工作流执行状态
 * - 查看执行历史和日志
 * - 手动触发/暂停/停止工作流
 */
const DagSchedulerPage: React.FC = () => {
  // 状态管理
  const [workflows, setWorkflows] = useState<DagWorkflow[]>([
    {
      id: 'dag-001',
      name: '每日技术指标分析',
      description: '每日收盘后自动计算技术指标并生成分析报告',
      status: 'active',
      schedule: '0 16 * * 1-5', // 每个交易日16:00
      tasks: [
        {
          id: 'task-001',
          name: '获取日线数据',
          type: 'data',
          config: { dataSource: 'tushare', symbols: ['000001.SZ', '600000.SH'] },
          dependencies: [],
          status: 'completed',
          retryCount: 0,
          maxRetries: 3,
        },
        {
          id: 'task-002',
          name: '计算技术指标',
          type: 'agent',
          agentId: 'agent-001',
          config: { indicators: ['MA', 'MACD', 'RSI'] },
          dependencies: ['task-001'],
          status: 'completed',
          retryCount: 0,
          maxRetries: 2,
        },
        {
          id: 'task-003',
          name: '生成分析报告',
          type: 'agent',
          agentId: 'agent-005',
          config: { format: 'markdown' },
          dependencies: ['task-002'],
          status: 'pending',
          retryCount: 0,
          maxRetries: 1,
        },
      ],
      createdAt: '2026-01-10',
      updatedAt: '2026-07-05',
      lastRun: '2026-07-05 16:00:00',
      nextRun: '2026-07-06 16:00:00',
    },
    {
      id: 'dag-002',
      name: '风险监控告警',
      description: '实时监控投资组合风险，超标时发送告警通知',
      status: 'active',
      schedule: '*/30 * * * *', // 每30分钟
      tasks: [
        {
          id: 'task-004',
          name: '获取实时持仓',
          type: 'data',
          config: { accountId: 'default' },
          dependencies: [],
          status: 'completed',
          retryCount: 0,
          maxRetries: 3,
        },
        {
          id: 'task-005',
          name: '计算风险指标',
          type: 'agent',
          agentId: 'agent-002',
          config: { metrics: ['var', 'sharpe', 'maxDrawdown'] },
          dependencies: ['task-004'],
          status: 'running',
          retryCount: 0,
          maxRetries: 2,
        },
        {
          id: 'task-006',
          name: '发送告警通知',
          type: 'notification',
          config: { channel: 'wechat', contacts: ['admin'] },
          dependencies: ['task-005'],
          status: 'pending',
          retryCount: 0,
          maxRetries: 1,
        },
      ],
      createdAt: '2026-02-15',
      updatedAt: '2026-07-05',
      lastRun: '2026-07-05 11:30:00',
      nextRun: '2026-07-05 12:00:00',
    },
  ])

  const [showModal, setShowModal] = useState(false)
  const [editingWorkflow, setEditingWorkflow] = useState<DagWorkflow | null>(null)

  /**
   * 获取状态颜色
   */
  const getStatusColor = (status: DagWorkflow['status']) => {
    switch (status) {
      case 'active': return { bg: 'bg-destructive/15', text: 'text-destructive' }
      case 'paused': return { bg: 'bg-warning/15', text: 'text-warning' }
      case 'stopped': return { bg: 'bg-muted', text: 'text-tertiary' }
      case 'error': return { bg: 'bg-destructive/15', text: 'text-destructive' }
    }
  }

  /**
   * 获取任务状态图标
   */
  const getTaskStatusIcon = (status: DagTask['status']) => {
    switch (status) {
      case 'pending': return <ClockIcon className="w-5 h-5 text-tertiary" />
      case 'running': return <ArrowPathIcon className="w-5 h-5 text-info animate-spin" />
      case 'completed': return <CheckCircleIcon className="w-5 h-5 text-success" />
      case 'failed': return <XCircleIcon className="w-5 h-5 text-destructive" />
      case 'skipped': return <ClockIcon className="w-5 h-5 text-tertiary" />
    }
  }

  /**
   * 打开创建/编辑模态框
   */
  const handleOpenModal = useCallback((workflow?: DagWorkflow) => {
    if (workflow) {
      setEditingWorkflow({ ...workflow })
    } else {
      setEditingWorkflow({
        id: `dag-${nanoid(8)}`,
        name: '',
        description: '',
        status: 'stopped',
        schedule: '0 0 * * *',
        tasks: [],
        createdAt: new Date().toISOString().split('T')[0] ?? '',
        updatedAt: new Date().toISOString().split('T')[0] ?? '',
      })
    }
    setShowModal(true)
  }, [])

  /**
   * 保存工作流
   */
  const handleSaveWorkflow = useCallback(() => {
    if (!editingWorkflow) return

    setWorkflows(prev => {
      const index = prev.findIndex(w => w.id === editingWorkflow.id)
      if (index >= 0) {
        const updated = [...prev]
        updated[index] = { ...editingWorkflow, updatedAt: new Date().toISOString().split('T')[0] ?? '' }
        return updated
      } else {
        return [...prev, editingWorkflow]
      }
    })

    setShowModal(false)
    setEditingWorkflow(null)
  }, [editingWorkflow])

  /**
   * 删除工作流
   */
  const handleDeleteWorkflow = useCallback((workflowId: string) => {
    if (window.confirm('确定要删除这个工作流吗？')) {
      setWorkflows(prev => prev.filter(w => w.id !== workflowId))
    }
  }, [])

  /**
   * 切换工作流状态
   */
  const handleToggleStatus = useCallback((workflowId: string) => {
    setWorkflows(prev => prev.map(w => {
      if (w.id === workflowId) {
        const newStatus = w.status === 'active' ? 'paused' : 'active'
        return { ...w, status: newStatus, updatedAt: new Date().toISOString().split('T')[0] ?? '' }
      }
      return w
    }))
  }, [])

  /**
   * 手动触发工作流
   */
  const handleTriggerWorkflow = useCallback((workflowId: string) => {
    alert(`手动触发工作流 ${workflowId}`)
    // 实际实现应该调用API
  }, [])

  return (
    <PageContainer className="min-h-screen bg-background text-foreground">
      {/* 页面标题 */}
      <div className="mb-8">
        <h1 className={`text-3xl font-bold text-foreground mb-2`}>
          DAG 调度器
        </h1>
        <p className="text-muted-foreground">
          配置和管理DAG工作流调度
        </p>
      </div>

      {/* 操作栏 */}
      <div className="mb-6 flex justify-between items-center">
        <div className="flex gap-4">
          <button
            onClick={() => handleOpenModal()}
            className={`flex items-center gap-2 px-4 py-2 bg-destructive text-destructive-foreground rounded-lg hover:opacity-90 transition-opacity`}
          >
            <PlusIcon className="w-5 h-5" />
            创建工作流
          </button>

          <button
            onClick={() => window.location.reload()}
            className={`flex items-center gap-2 px-4 py-2 bg-muted text-foreground rounded-lg hover:opacity-90 transition-opacity`}
          >
            <ArrowPathIcon className="w-5 h-5" />
            刷新
          </button>
        </div>

        <div className="text-sm text-tertiary">
          共 {workflows.length} 个工作流，{workflows.filter(w => w.status === 'active').length} 个运行中
        </div>
      </div>

      {/* 工作流列表 */}
      <div className="space-y-6">
        {workflows.map(workflow => {
          const statusColor = getStatusColor(workflow.status)

          return (
            <div
              key={workflow.id}
              className={`bg-card rounded-lg shadow-sm border border-border p-6 hover:shadow-md transition-shadow`}
            >
              {/* 工作流头部 */}
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className={`text-lg font-semibold text-foreground`}>
                      {workflow.name}
                    </h3>
                    <span className={`px-2 py-1 text-xs font-medium rounded ${statusColor.bg} ${statusColor.text}`}>
                      {workflow.status === 'active' ? '运行中' :
                       workflow.status === 'paused' ? '已暂停' :
                       workflow.status === 'stopped' ? '已停止' : '错误'}
                    </span>
                  </div>
                  <p className={`text-muted-foreground text-sm`}>
                    {workflow.description}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {/* 操作按钮 */}
                  <button
                    onClick={() => handleToggleStatus(workflow.id)}
                    className={`p-2 bg-muted rounded hover:opacity-90 transition-opacity`}
                    title={workflow.status === 'active' ? '暂停' : '启动'}
                  >
                    {workflow.status === 'active' ? <PauseIcon className="w-5 h-5" /> : <PlayIcon className="w-5 h-5" />}
                  </button>

                  <button
                    onClick={() => handleTriggerWorkflow(workflow.id)}
                    className={`p-2 bg-muted rounded hover:opacity-90 transition-opacity`}
                    title="手动触发"
                  >
                    <PlayIcon className="w-5 h-5" />
                  </button>

                  <button
                    onClick={() => handleOpenModal(workflow)}
                    className={`p-2 bg-muted rounded hover:opacity-90 transition-opacity`}
                    title="编辑"
                  >
                    <PencilIcon className="w-5 h-5" />
                  </button>

                  <button
                    onClick={() => handleDeleteWorkflow(workflow.id)}
                    className={`p-2 bg-destructive/15 rounded hover:opacity-90 transition-opacity`}
                    title="删除"
                  >
                    <TrashIcon className="w-5 h-5 text-destructive" />
                  </button>
                </div>
              </div>

              {/* 工作流配置信息 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <span className={`text-sm text-tertiary`}>调度</span>
                  <p className={`text-foreground text-sm font-mono`}>{workflow.schedule}</p>
                </div>
                <div>
                  <span className={`text-sm text-tertiary`}>任务数</span>
                  <p className="text-foreground">{workflow.tasks.length}</p>
                </div>
                <div>
                  <span className={`text-sm text-tertiary`}>上次运行</span>
                  <p className="text-foreground">{workflow.lastRun || '-'}</p>
                </div>
                <div>
                  <span className={`text-sm text-tertiary`}>下次运行</span>
                  <p className="text-foreground">{workflow.nextRun || '-'}</p>
                </div>
              </div>

              {/* 任务列表 */}
              <div>
                <h4 className={`text-sm font-medium text-foreground mb-2`}>任务列表</h4>
                <div className="space-y-2">
                  {workflow.tasks.map((task, index) => (
                    <div key={task.id} className={`flex items-center gap-4 p-3 bg-muted rounded-lg`}>
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white">
                        <span className="text-sm font-medium">{index + 1}</span>
                      </div>

                      {getTaskStatusIcon(task.status)}

                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium text-foreground`}>{task.name}</span>
                          <span className={`px-2 py-0.5 text-xs bg-card text-tertiary rounded`}>
                            {task.type === 'agent' ? '智能体' :
                             task.type === 'data' ? '数据' :
                             task.type === 'calculation' ? '计算' : '通知'}
                          </span>
                        </div>
                        {task.dependencies.length > 0 && (
                          <div className="text-xs text-tertiary mt-1">
                            依赖: {task.dependencies.join(', ')}
                          </div>
                        )}
                      </div>

                      <div className="text-right">
                        <div className={`text-sm text-foreground`}>
                          重试: {task.retryCount}/{task.maxRetries}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* 创建/编辑模态框 */}
      {showModal && editingWorkflow && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={`bg-card rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto`}>
            <h2 className={`text-2xl font-bold text-foreground mb-4`}>
              {workflows.find(w => w.id === editingWorkflow.id) ? '编辑工作流' : '创建工作流'}
            </h2>

            <div className="space-y-4">
              {/* 工作流名称 */}
              <div>
                <label className={`block text-sm font-medium text-foreground mb-1`}>
                  工作流名称 *
                </label>
                <input
                  type="text"
                  value={editingWorkflow.name}
                  onChange={(e) => setEditingWorkflow(prev => prev ? { ...prev, name: e.target.value } : null)}
                  className={`w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary`}
                  placeholder="输入工作流名称"
                />
              </div>

              {/* 工作流描述 */}
              <div>
                <label className={`block text-sm font-medium text-foreground mb-1`}>
                  描述 *
                </label>
                <textarea
                  value={editingWorkflow.description}
                  onChange={(e) => setEditingWorkflow(prev => prev ? { ...prev, description: e.target.value } : null)}
                  className={`w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary`}
                  rows={3}
                  placeholder="输入工作流描述"
                />
              </div>

              {/* 调度配置 */}
              <div>
                <label className={`block text-sm font-medium text-foreground mb-1`}>
                  Cron 调度表达式 *
                </label>
                <input
                  type="text"
                  value={editingWorkflow.schedule}
                  onChange={(e) => setEditingWorkflow(prev => prev ? { ...prev, schedule: e.target.value } : null)}
                  className={`w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary font-mono`}
                  placeholder="0 0 * * *"
                />
                <p className="text-xs text-tertiary mt-1">
                  示例: "0 16 * * 1-5" = 每个交易日16:00, "*/30 * * * *" = 每30分钟
                </p>
              </div>

              {/* 状态 */}
              <div>
                <label className={`block text-sm font-medium text-foreground mb-1`}>
                  状态
                </label>
                <select
                  value={editingWorkflow.status}
                  onChange={(e) => setEditingWorkflow(prev => prev ? { ...prev, status: e.target.value as DagWorkflow['status'] } : null)}
                  className={`w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary`}
                >
                  <option value="active">运行中</option>
                  <option value="paused">已暂停</option>
                  <option value="stopped">已停止</option>
                  <option value="error">错误</option>
                </select>
              </div>

              {/* 任务配置（简化版） */}
              <div>
                <label className={`block text-sm font-medium text-foreground mb-1`}>
                  任务配置
                </label>
                <div className={`p-4 bg-muted rounded-lg text-sm text-tertiary`}>
                  <p>任务配置界面正在开发中...</p>
                  <p>当前工作流有 {editingWorkflow.tasks.length} 个任务</p>
                </div>
              </div>
            </div>

            {/* 按钮组 */}
            <div className="flex gap-4 mt-6">
              <button
                onClick={handleSaveWorkflow}
                disabled={!editingWorkflow.name || !editingWorkflow.description}
                className={`flex-1 px-4 py-2 bg-destructive text-destructive-foreground rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                保存
              </button>
              <button
                onClick={() => {
                  setShowModal(false)
                  setEditingWorkflow(null)
                }}
                className={`flex-1 px-4 py-2 bg-muted text-foreground rounded-lg hover:opacity-90 transition-opacity`}
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

export default DagSchedulerPage
