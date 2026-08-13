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
  ListTodo,
  Sparkles,
  GitBranch,
  GitCompare,
  Workflow,
  Server,
  Tags,
  Lightbulb,
  History,
  HeartPulse,
  SlidersHorizontal,
  Gem,
  Wallet,
  Radar,
  Layers,
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
      group: '候选池管理',
      items: [
        { key: 'dashboard', label: '录入看板', path: '/input', icon: LayoutDashboard },
        { key: 'pool-board', label: '研究候选池', path: '/input/pool-board', icon: Database },
        { key: 'local-knowledge', label: '本地知识库', path: '/input/local-knowledge', icon: BookOpen },
      ],
    },
    {
      group: '采集中心',
      items: [
        { key: 'collection-monitor', label: '采集监控台', path: '/input/collection-monitor', icon: Radar },
        { key: 'collection-strategy', label: '采集策略配置', path: '/input/collection-strategy', icon: SlidersHorizontal },
      ],
    },
  ],
  analysis: [
    {
      group: '评分分析',
      items: [
        { key: 'intelligent-score', label: '个股智能分析', path: '/analysis/intelligent-score', icon: Activity },
        { key: 'industry-score', label: 'V4 行业评分', path: '/analysis/industry-score', icon: BarChart3 },
        { key: 'score-comparison', label: '评分比对看板', path: '/analysis/score-comparison', icon: GitCompare },
        { key: 'score-docs', label: '评分文档', path: '/analysis/score-docs', icon: FileText },
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
    {
      group: '市场研究',
      items: [
        { key: 'sector', label: '行业全景', path: '/analysis/industry-dashboard', icon: Database },
        { key: 'news', label: '智能资讯', path: '/analysis/news', icon: Newspaper },
        { key: 'backtest', label: '策略回测', path: '/analysis/backtest', icon: TrendingUp },
      ],
    },
  ],
  trading: [
    {
      group: '交易执行',
      items: [
        { key: 'portfolio', label: '投资组合', path: '/trading/portfolio', icon: TrendingUp },
        { key: 'holdings', label: '持仓管理', path: '/trading/holdings', icon: Wallet },
        { key: 'execution-plans', label: '执行计划', path: '/trading/execution-plans', icon: ListTodo },
        { key: 'risk', label: '风险控制', path: '/trading/risk', icon: Scale },
      ],
    },
    {
      group: '策略与流程',
      items: [
        { key: 'strategy-snapshots', label: '策略快照', path: '/trading/strategy-snapshots', icon: Camera },
        { key: 'flow', label: '交易流程', path: '/trading/flow', icon: Workflow },
      ],
    },
  ],
  output: [
    {
      group: '研报与复盘',
      items: [
        { key: 'reports', label: '研报复盘', path: '/output/research', icon: FileText },
        { key: 'review', label: '交易复盘', path: '/output/review', icon: BarChart3 },
        { key: 'chip-strategy', label: '筹码策略复盘', path: '/output/chip-strategy', icon: Layers },
      ],
    },
    {
      group: '数据与验证',
      items: [
        { key: 'dashboard', label: '仪表盘', path: '/output/dashboard', icon: LayoutDashboard },
        { key: 'factor-analysis', label: '因子分析', path: '/output/factor-analysis', icon: Layers },
        { key: 'export', label: '数据导出', path: '/output/export', icon: Database },
      ],
    },
  ],
  command: [
    {
      group: '系统运维',
      items: [
        { key: 'command-hub', label: '总控台', path: '/command', icon: LayoutDashboard },
        { key: 'system-health', label: '系统健康', path: '/command/system-health', icon: HeartPulse },
        { key: 'settings', label: '配置管理', path: '/command/config', icon: Settings },
      ],
    },
    {
      group: '智能体管理',
      items: [
        { key: 'agent-hub', label: '智能体总控', path: '/command/agents', icon: Bot },
        { key: 'agent-task-panel', label: '任务管理', path: '/command/agents/task-panel', icon: ListTodo },
        { key: 'agent-changelog', label: '更新日志', path: '/command/agents/changelog', icon: History },
      ],
    },
    {
      group: '模型与优化',
      items: [
        { key: 'agent-model-config', label: '模型配置', path: '/command/agents/model-config', icon: Sparkles },
        { key: 'agent-optimization-panel', label: '优化建议', path: '/command/agents/optimization-panel', icon: Lightbulb },
      ],
    },
    {
      group: '高级工具',
      items: [
        { key: 'agent-capability-graph', label: '能力图谱', path: '/command/agents/capability-graph', icon: GitBranch },
        { key: 'agent-dag-scheduler', label: 'DAG 调度', path: '/command/agents/dag-scheduler', icon: Workflow },
        { key: 'agent-data-labels', label: '数据标签', path: '/command/agents/data-labels', icon: Tags },
        { key: 'mcp-servers', label: 'MCP 服务', path: '/command/mcp-servers', icon: Server },
        { key: 'showcase', label: '组件示例库', path: '/command/showcase', icon: BookOpen },
        { key: 'stress-test', label: '压力测试', path: '/command/test', icon: Zap },
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
