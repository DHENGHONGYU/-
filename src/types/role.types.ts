export type UserRole = 'analyst' | 'trader' | 'admin' | 'viewer'

export interface RoleConfig {
  readonly role: UserRole
  readonly name: string
  readonly description: string
  readonly allowedApps: readonly string[]
  readonly allowedActions: readonly string[]
}

export const ROLE_CONFIG: Readonly<Record<UserRole, RoleConfig>> = {
  analyst: {
    role: 'analyst',
    name: '分析师',
    description: '查看分析报告、评分数据、行业分析',
    allowedApps: ['analysis', 'input'],
    allowedActions: ['view', 'query', 'analyze'],
  },
  trader: {
    role: 'trader',
    name: '交易员',
    description: '执行交易、管理持仓、查看策略',
    allowedApps: ['trading', 'analysis'],
    allowedActions: ['view', 'query', 'analyze', 'trade', 'execute'],
  },
  admin: {
    role: 'admin',
    name: '管理员',
    description: '系统配置、用户管理、数据管理',
    allowedApps: ['analysis', 'trading', 'input', 'command', 'output'],
    allowedActions: ['view', 'query', 'analyze', 'trade', 'execute', 'manage', 'configure'],
  },
  viewer: {
    role: 'viewer',
    name: '只读用户',
    description: '仅查看，无写操作权限',
    allowedApps: ['analysis'],
    allowedActions: ['view', 'query'],
  },
}

export type DeveloperRole = 'frontend' | 'fullstack' | 'data' | 'ai-agent' | 'trading' | 'architect'

export interface DeveloperRoleConfig {
  readonly role: DeveloperRole
  readonly name: string
  readonly description: string
  readonly allowedDirectories: readonly string[]
  readonly allowedModules: readonly string[]
  readonly mcpRole: string
}

export const DEVELOPER_ROLE_CONFIG: Readonly<Record<DeveloperRole, DeveloperRoleConfig>> = {
  frontend: {
    role: 'frontend',
    name: '前端工程师',
    description: 'UI 组件开发、页面构建、样式维护、交互实现',
    allowedDirectories: ['src/components/', 'src/pages/', 'src/hooks/', 'src/i18n/', 'design-tokens/'],
    allowedModules: [],
    mcpRole: 'ui',
  },
  fullstack: {
    role: 'fullstack',
    name: '全栈工程师',
    description: '业务服务实现、状态管理、路由配置、API 对接',
    allowedDirectories: ['src/services/', 'src/store/', 'src/config/', 'src/apps/'],
    allowedModules: ['analysis', 'trading', 'input', 'command', 'output'],
    mcpRole: 'system',
  },
  data: {
    role: 'data',
    name: '数据工程师',
    description: 'Schema 定义、Repository 实现、数据采集、数据质量',
    allowedDirectories: ['src/data/', 'src/schema/', 'src/services/collection/', 'src/types/'],
    allowedModules: ['fetcher', 'data', 'collection'],
    mcpRole: 'system',
  },
  'ai-agent': {
    role: 'ai-agent',
    name: 'AI/Agent 工程师',
    description: 'Agent 逻辑开发、提示词工程、MCP 工具集成',
    allowedDirectories: ['src/agents/', 'src/mcp/', 'prompts/', 'src/lib/llm/'],
    allowedModules: ['llm', 'agents', 'mcp'],
    mcpRole: 'agent',
  },
  trading: {
    role: 'trading',
    name: '交易工程师',
    description: '交易策略、执行引擎、风险管理、回测系统',
    allowedDirectories: ['src/apps/trading/', 'src/services/backtest/', 'src/services/trading/'],
    allowedModules: ['trading', 'backtest', 'execution'],
    mcpRole: 'system',
  },
  architect: {
    role: 'architect',
    name: '架构师',
    description: '架构设计、技术决策、代码审查、技术债务治理',
    allowedDirectories: [],
    allowedModules: [],
    mcpRole: 'system',
  },
}