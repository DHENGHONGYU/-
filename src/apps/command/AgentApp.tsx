import React, { useEffect, Suspense } from 'react'
import { useLocation } from 'react-router'
import { getLogger } from '@/lib/logger'
import { PageSkeleton } from '@/components/PageSkeleton'

const AgentHubPage = React.lazy(() => import('@/pages/command/agent/AgentHubPage'))
const AgentRegistryPage = React.lazy(() => import('@/pages/command/agent/AgentRegistryPage'))
const AgentDetailPage = React.lazy(() => import('@/pages/command/agent/AgentDetailPage'))
const AgentTaskTriggerPage = React.lazy(() => import('@/pages/command/agent/AgentTriggerPage'))
const AgentTasksPage = React.lazy(() => import('@/pages/command/agent/AgentTasksPage'))
const AgentCustomPage = React.lazy(() => import('@/pages/command/agent/CustomAgentPage'))
const AgentLlmPage = React.lazy(() => import('@/pages/command/agent/LlmManagementPage'))
const AgentCapabilityGraphPage = React.lazy(() => import('@/pages/command/agent/CapabilityGraphPage'))
const AgentDagSchedulerPage = React.lazy(() => import('@/pages/command/agent/DagSchedulerPage'))
const AgentFeedbackPage = React.lazy(() => import('@/pages/command/agent/AgentFeedbackPage'))
const AgentDataLabelPage = React.lazy(() => import('@/pages/command/agent/DataLabelManagementPage'))
const AgentApiConfigPage = React.lazy(() => import('@/pages/command/agent/ApiConfigurationPage'))

const logger = getLogger()

const AGENT_ROUTE_MAP: Record<string, { component: React.LazyExoticComponent<React.ComponentType<{ agentId?: string }>>; label: string }> = {
  '/command/agents': { component: AgentHubPage, label: '总控台' },
  '/command/agents/registry': { component: AgentRegistryPage, label: '注册表' },
  '/command/agents/trigger': { component: AgentTaskTriggerPage, label: '任务触发' },
  '/command/agents/tasks': { component: AgentTasksPage, label: '任务列表' },
  '/command/agents/custom': { component: AgentCustomPage, label: '自定义智能体' },
  '/command/agents/llm': { component: AgentLlmPage, label: 'LLM 管理' },
  '/command/agents/capability-graph': { component: AgentCapabilityGraphPage, label: '能力图谱' },
  '/command/agents/dag-scheduler': { component: AgentDagSchedulerPage, label: 'DAG 调度' },
  '/command/agents/feedback': { component: AgentFeedbackPage, label: '反馈控制台' },
  '/command/agents/data-labels': { component: AgentDataLabelPage, label: '数据标签' },
  '/command/agents/api-config': { component: AgentApiConfigPage, label: 'API配置' },
}

function parseAgentId(pathname: string): string | null {
  const match = pathname.match(/^\/command\/agents\/registry\/([^/]+)$/)
  return match?.[1] ?? null
}

export default function AgentApp(): React.JSX.Element {
  const location = useLocation()
  const pathname = location.pathname

  useEffect(() => {
    logger.info('[AgentApp] Route changed', { pathname })
  }, [pathname])

  const agentId = parseAgentId(pathname)

  if (agentId !== null) {
    return (
      <Suspense fallback={<PageSkeleton />}>
        <AgentDetailPage agentId={agentId} />
      </Suspense>
    )
  }

  const route = AGENT_ROUTE_MAP[pathname]
  if (route) {
    const Component = route.component
    return (
      <Suspense fallback={<PageSkeleton />}>
        <Component />
      </Suspense>
    )
  }

  return (
    <Suspense fallback={<PageSkeleton />}>
      <AgentHubPage />
    </Suspense>
  )
}