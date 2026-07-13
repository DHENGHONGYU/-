import React from 'react'
import { Bot, Activity, Newspaper, Sparkles, Wifi, Filter, Database, History, type LucideIcon } from 'lucide-react'
import V6ScoringAgentDetail from '@/components/organisms/agent/V6ScoringAgentDetail'
import GenericAgentDetail from '@/components/organisms/agent/GenericAgentDetail'
import StandardAgentDetail from '@/components/organisms/agent/StandardAgentDetail'

export interface AgentDetailComponentProps {
  agentId: string
}

export interface AgentComponentEntry {
  agentId: string
  displayName: string
  icon: LucideIcon
  description: string
  tags: string[]
  detailComponent: React.ComponentType<AgentDetailComponentProps>
  priority: number
  mcpServerName: string
  defaultToolName: string
  /** 详情页「打开关联功能页」链接（标准详情面板 StandardAgentDetail 使用） */
  detailLink?: AgentDetailLink
}

/** 详情页关联功能页链接 */
export interface AgentDetailLink {
  to: string
  label: string
}

const AGENT_COMPONENT_REGISTRY: Map<string, AgentComponentEntry> = new Map()

function register(entry: AgentComponentEntry): void {
  AGENT_COMPONENT_REGISTRY.set(entry.agentId, entry)
}

register({
  agentId: 'v6-scoring-agent',
  displayName: 'V6 评分智能体',
  icon: Activity,
  description: '执行 V6 九维评分计算，返回评分结果与因子明细',
  tags: ['scoring', 'v6', 'system'],
  detailComponent: V6ScoringAgentDetail,
  priority: 100,
  mcpServerName: 'scoring:v6',
  defaultToolName: 'score_stock',
})

register({
  agentId: 'v4-industrial-agent',
  displayName: 'V4 行业评分智能体',
  icon: Sparkles,
  description: '执行 V4 行业评分计算，返回行业强弱与板块轮动信号',
  tags: ['scoring', 'v4', 'system'],
  detailComponent: StandardAgentDetail,
  priority: 90,
  mcpServerName: 'scoring:v6',
  defaultToolName: 'analyze_hot_sector',
  detailLink: { to: '/analysis/industry-score', label: '前往行业评分页' },
})

register({
  agentId: 'llm-intelligent-agent',
  displayName: 'LLM 智能评分智能体',
  icon: Bot,
  description: '调用 LLM API 进行个股深度分析，返回智能评分与投资建议',
  tags: ['llm', 'ai', 'system'],
  detailComponent: StandardAgentDetail,
  priority: 80,
  mcpServerName: 'llm',
  defaultToolName: 'chat_completion',
  detailLink: { to: '/command/agents/llm', label: '前往 LLM 管理' },
})

register({
  agentId: 'fetcher-agent',
  displayName: '数据采集智能体',
  icon: Wifi,
  description: '执行股票基础数据/行情数据/财务数据的采集任务',
  tags: ['data', 'fetcher', 'system'],
  detailComponent: StandardAgentDetail,
  priority: 70,
  mcpServerName: 'fetcher',
  defaultToolName: 'fetch_stock_basic',
  detailLink: { to: '/input/collect-tasks', label: '前往采集任务监控' },
})

register({
  agentId: 'news-analyzer-agent',
  displayName: '新闻分析智能体',
  icon: Newspaper,
  description: '执行新闻情感分析、股票关联提取、热点识别任务',
  tags: ['news', 'analysis', 'system'],
  detailComponent: StandardAgentDetail,
  priority: 60,
  mcpServerName: 'news',
  defaultToolName: 'fetch_news',
  detailLink: { to: '/analysis/news', label: '前往新闻分析页' },
})

register({
  agentId: 'screening-agent',
  displayName: '多因子筛选智能体',
  icon: Filter,
  description: '执行全量多因子筛选与单股评估，返回符合条件的股票列表',
  tags: ['screening', 'filter', 'system'],
  detailComponent: StandardAgentDetail,
  priority: 50,
  mcpServerName: 'screening',
  defaultToolName: 'run_screening',
  detailLink: { to: '/analysis/multi-factor', label: '前往多因子筛选页' },
})

register({
  agentId: 'pool-agent',
  displayName: '股票池内省智能体',
  icon: Database,
  description: '查询股票池标的、研究状态流转与分组管理',
  tags: ['pool', 'system'],
  detailComponent: StandardAgentDetail,
  priority: 45,
  mcpServerName: 'pool',
  defaultToolName: 'list_pool_items',
  detailLink: { to: '/analysis/pool-board', label: '前往股票池看板' },
})

register({
  agentId: 'backtest-agent',
  displayName: '回测智能体',
  icon: History,
  description: '执行策略回测，返回收益、回撤、胜率等指标',
  tags: ['backtest', 'system'],
  detailComponent: StandardAgentDetail,
  priority: 40,
  mcpServerName: 'backtest',
  defaultToolName: 'run_backtest',
  detailLink: { to: '/analysis/backtest', label: '前往回测页' },
})

export function getAgentComponent(agentId: string): AgentComponentEntry | undefined {
  return AGENT_COMPONENT_REGISTRY.get(agentId)
}

export function getAllAgentComponents(): AgentComponentEntry[] {
  return Array.from(AGENT_COMPONENT_REGISTRY.values()).sort((a, b) => b.priority - a.priority)
}

export function getAgentDetailComponent(
  agentId: string,
): React.ComponentType<AgentDetailComponentProps> {
  const entry = AGENT_COMPONENT_REGISTRY.get(agentId)
  return entry?.detailComponent ?? GenericAgentDetail
}

export function hasAgentComponent(agentId: string): boolean {
  return AGENT_COMPONENT_REGISTRY.has(agentId)
}

export { V6ScoringAgentDetail, GenericAgentDetail, StandardAgentDetail }
