/**
 * @fileoverview 侧边栏导航配置 —— 五舱侧边栏按钮与分组的唯一真相源
 *
 * 从 PortalShell.tsx 提取，使侧边栏配置可被测试和组件共享引用，
 * 消除测试中硬编码 KNOWN_SIDEBAR_ITEMS 导致的同步问题。
 *
 * @see src/portal/PortalShell.tsx — 消费方
 * @see src/config/routes.ts — 路由注册表（侧边栏路径应在此注册）
 *
 * @doc [V9-DOC-FRONT-020, V9-DOC-PROJ-092]
 */

import {
  LayoutDashboard,
  Database,
  Upload,
  Flame,
  Wifi,
  Activity,
  BarChart3,
  TrendingUp,
  FileText,
  Settings,
  Newspaper,
  BookOpen,
  Scale,
  Bot,
  Camera,
  Zap,
  List,
  ListTodo,
  Sparkles,
  GitBranch,
  GitCompare,
  Workflow,
  MessageSquare,
  Server,
  Tags,
  Code,
  CheckCircle,
  Lightbulb,
  History,
  HeartPulse,
  RefreshCw,
  SlidersHorizontal,
  Gem,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import type { CabinType } from '@/store/workflowStore'

// ── 类型定义 ──

export interface PanelItem {
  key: string
  label: string
  path: string
  icon: LucideIcon
}

export interface PanelGroup {
  group: string
  items: PanelItem[]
}

// ── 舱室定义 ──

export const CABINS: { id: CabinType; label: string; emoji: string; path: string; icon: LucideIcon }[] = [
  { id: 'input', label: '输入舱', emoji: '📦', path: '/input', icon: Upload },
  { id: 'analysis', label: '分析舱', emoji: '🔬', path: '/analysis', icon: BarChart3 },
  { id: 'trading', label: '交易舱', emoji: '💹', path: '/trading', icon: TrendingUp },
  { id: 'output', label: '输出舱', emoji: '📊', path: '/output', icon: FileText },
  { id: 'command', label: '总控舱', emoji: '🎛️', path: '/command', icon: Settings },
]

// ── 侧边栏分组配置 ──

export const PANEL_ITEMS: Record<CabinType, PanelGroup[]> = {
  input: [
    {
      group: '意向候选池',
      items: [
        { key: 'dashboard', label: '录入看板', path: '/input', icon: LayoutDashboard },
        { key: 'pool-board', label: '研究候选池', path: '/input/pool-board', icon: Database },
        { key: 'local-knowledge', label: '本地知识库', path: '/input/local-knowledge', icon: BookOpen },
      ],
    },
    {
      group: '数据采集',
      items: [
        { key: 'data-test', label: '采集测试', path: '/input/data-test', icon: Wifi },
        { key: 'collect-tasks', label: '采集任务监控', path: '/input/collect-tasks', icon: Activity },
        { key: 'seven-dim', label: '七维采集配置', path: '/input/seven-dim', icon: SlidersHorizontal },
        { key: 'fetcher-config', label: '抓取引擎配置', path: '/input/fetcher-config', icon: Settings },
      ],
    },
  ],
  analysis: [
    {
      group: '评分与筛选',
      items: [
        { key: 'industry-score', label: 'V4 行业评分', path: '/analysis/industry-score', icon: BarChart3 },
        { key: 'intelligent-score', label: '个股智能分析', path: '/analysis/intelligent-score', icon: Activity },
        { key: 'sector', label: '行业分析', path: '/analysis/sector', icon: Database },
        { key: 'backtest', label: '策略回测', path: '/analysis/backtest', icon: TrendingUp },
        { key: 'score-docs', label: '评分文档', path: '/analysis/score-docs', icon: FileText },
        { key: 'score-comparison', label: '评分比对看板', path: '/analysis/score-comparison', icon: GitCompare },
        { key: 'news', label: '智能资讯', path: '/analysis/news', icon: Newspaper },
      ],
    },
    {
      group: '策略选股',
      items: [
        { key: 'hot-sector', label: '热门板块', path: '/analysis/hot-sector', icon: Flame },
        { key: 'value-pit', label: '价值洼地', path: '/analysis/value-pit', icon: Gem },
        { key: 'multi-factor', label: '多因子筛选', path: '/analysis/multi-factor', icon: SlidersHorizontal },
      ],
    },
  ],
  trading: [
    {
      group: '交易',
      items: [
        { key: 'portfolio', label: '投资组合', path: '/trading/portfolio', icon: TrendingUp },
        { key: 'holdings', label: '持仓管理', path: '/trading/holdings', icon: Wallet },
        { key: 'execution', label: '执行管理', path: '/trading/execution', icon: ListTodo },
        { key: 'execution-plans', label: '执行计划', path: '/trading/execution-plans', icon: List },
        { key: 'risk', label: '风险控制', path: '/trading/risk', icon: Scale },
        { key: 'strategy-snapshots', label: '策略快照', path: '/trading/strategy-snapshots', icon: Camera },
        { key: 'flow', label: '交易流程', path: '/trading/flow', icon: Workflow },
      ],
    },
  ],
  output: [
    {
      group: '输出',
      items: [
        { key: 'reports', label: '研报复盘', path: '/output/research', icon: FileText },
        { key: 'dashboard', label: '仪表盘', path: '/output/dashboard', icon: LayoutDashboard },
        { key: 'export', label: '数据导出', path: '/output/export', icon: Database },
        { key: 'review', label: '交易复盘', path: '/output/review', icon: BarChart3 },
        { key: 'wizard', label: '复盘向导', path: '/output/wizard', icon: Sparkles },
        { key: 'prediction', label: '预测校验', path: '/output/prediction', icon: TrendingUp },
        { key: 'retrospective', label: '周期复盘', path: '/output/retrospective', icon: RefreshCw },
        { key: 'factor', label: '因子画板', path: '/output/factor-dashboard', icon: TrendingUp },
      ],
    },
  ],
  command: [
    {
      group: '系统',
      items: [
        { key: 'command-hub', label: '总控台', path: '/command', icon: LayoutDashboard },
        { key: 'showcase', label: '组件示例库', path: '/command/showcase', icon: BookOpen },
        { key: 'health', label: '架构健康度', path: '/command/health', icon: HeartPulse },
        { key: 'monitor', label: '系统监控', path: '/command/monitor', icon: Activity },
        { key: 'settings', label: '配置管理', path: '/command/config', icon: Settings },
        { key: 'stress-test', label: '压力测试', path: '/command/test', icon: Zap },
      ],
    },
    {
      group: '智能体',
      items: [
        { key: 'agent-hub', label: '智能体总控台', path: '/command/agents', icon: Bot },
        { key: 'agent-registry', label: '智能体注册表', path: '/command/agents/registry', icon: Bot },
        { key: 'agent-trigger', label: '任务触发', path: '/command/agents/trigger', icon: Zap },
        { key: 'agent-tasks', label: '任务列表', path: '/command/agents/tasks', icon: List },
        { key: 'agent-custom', label: '自定义智能体', path: '/command/agents/custom', icon: Bot },
        { key: 'agent-llm', label: 'LLM 管理', path: '/command/agents/llm', icon: Sparkles },
        { key: 'agent-capability-graph', label: '能力图谱', path: '/command/agents/capability-graph', icon: GitBranch },
        { key: 'agent-dag-scheduler', label: 'DAG 调度器', path: '/command/agents/dag-scheduler', icon: Workflow },
        { key: 'agent-feedback', label: '反馈控制台', path: '/command/agents/feedback', icon: MessageSquare },
        { key: 'agent-model-upgrade', label: '模型升级', path: '/command/agents/model-upgrade', icon: TrendingUp },
        { key: 'agent-data-labels', label: '数据标签', path: '/command/agents/data-labels', icon: Tags },
        { key: 'agent-api-config', label: 'API 配置', path: '/command/agents/api-config', icon: Code },
        { key: 'agent-skill-audit', label: 'Skill 核查', path: '/command/agents/skill-audit', icon: CheckCircle },
        { key: 'agent-optimization', label: '优化建议', path: '/command/agents/optimization', icon: Lightbulb },
        { key: 'agent-changelog', label: '更新日志', path: '/command/agents/changelog', icon: History },
      ],
    },
    {
      group: 'MCP 服务',
      items: [
        { key: 'mcp-servers', label: 'MCP Server 管理', path: '/command/mcp-servers', icon: Server },
      ],
    },
  ],
}

// ── 派生工具函数 ──

/**
 * 扁平化所有侧边栏项，返回 { key, label, path, cabin } 列表。
 * 测试用此函数替代硬编码的 KNOWN_SIDEBAR_ITEMS。
 */
export function getAllSidebarItems(): Array<{ key: string; label: string; path: string; cabin: CabinType }> {
  const result: Array<{ key: string; label: string; path: string; cabin: CabinType }> = []
  for (const cabin of Object.keys(PANEL_ITEMS) as CabinType[]) {
    for (const group of PANEL_ITEMS[cabin]) {
      for (const item of group.items) {
        result.push({ key: item.key, label: item.label, path: item.path, cabin })
      }
    }
  }
  return result
}

/** 获取所有侧边栏路径（用于路由一致性校验） */
export function getAllSidebarPaths(): string[] {
  return getAllSidebarItems().map((item) => item.path)
}

/** 按舱室获取侧边栏项列表 */
export function getSidebarItemsByCabin(cabin: CabinType): Array<{ key: string; label: string; path: string }> {
  return (PANEL_ITEMS[cabin] ?? []).flatMap((group) =>
    group.items.map((item) => ({ key: item.key, label: item.label, path: item.path })),
  )
}
