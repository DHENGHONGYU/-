export function createColorTokenMock(): Record<string, unknown> {
  return {
    THEME_TOKENS: {
      color: {
        info: 'text-blue-500',
        warning: 'text-amber-500',
        success: 'text-green-500',
        destructive: 'text-red-500',
        muted: 'text-slate-400',
        border: 'border-slate-200',
      },
      iconSizes: { xs: 'h-3 w-3', sm: 'h-4 w-4', md: 'h-5 w-5', lg: 'h-6 w-6', xl: 'h-8 w-8' },
      controlSizes: { xs: 'h-7', sm: 'h-9', md: 'h-10', lg: 'h-12' },
      spacing: { xs: 'p-1', sm: 'p-2', md: 'p-4', lg: 'p-6' },
      radius: { sm: 'rounded-sm', md: 'rounded-md', lg: 'rounded-lg', full: 'rounded-full' },
      gap: { xs: 'gap-1', sm: 'gap-2', md: 'gap-4', lg: 'gap-6', xl: 'gap-8' },
      score: { excellent: 'text-green-500', good: 'text-amber-500', ok: 'text-slate-500' },
    },
    COLOR_TOKENS: {
      up: { hex: '#ef4444', tailwind: 'text-red-500', bgClass: 'bg-red-500', rgb: 'rgb(239, 68, 68)' },
      down: { hex: '#22c55e', tailwind: 'text-green-500', bgClass: 'bg-green-500', rgb: 'rgb(34, 197, 94)' },
      neutral: { hex: '#94a3b8', tailwind: 'text-slate-400', bgClass: 'bg-slate-400', rgb: 'rgb(148, 163, 184)' },
      info: { hex: '#3b82f6', tailwind: 'text-blue-500', bgClass: 'bg-blue-500', rgb: 'rgb(59, 130, 246)' },
      success: { hex: '#22c55e', tailwind: 'text-green-500', bgClass: 'bg-green-500', rgb: 'rgb(34, 197, 94)' },
      warning: { hex: '#f59e0b', tailwind: 'text-amber-500', bgClass: 'bg-amber-500', rgb: 'rgb(245, 158, 11)' },
      danger: { hex: '#ef4444', tailwind: 'text-red-500', bgClass: 'bg-red-500', rgb: 'rgb(239, 68, 68)' },
      scoreHigh: { hex: '#22c55e', tailwind: 'text-green-500', bgClass: 'bg-green-500' },
      scoreMid: { hex: '#f59e0b', tailwind: 'text-amber-500', bgClass: 'bg-amber-500' },
      scoreLow: { hex: '#ef4444', tailwind: 'text-red-500', bgClass: 'bg-red-500' },
      bgCard: { hex: '#ffffff', tailwind: 'bg-white', bgClass: 'bg-white' },
      border: { hex: '#e2e8f0', tailwind: 'border-slate-200', bgClass: 'border-slate-200' },
      textPrimary: { hex: '#1e293b', tailwind: 'text-slate-800', bgClass: 'text-slate-800' },
      textSecondary: { hex: '#64748b', tailwind: 'text-slate-500', bgClass: 'text-slate-500' },
    },
    STOCK_COLOR_TOKENS: {
      up: { hex: '#ef4444', tailwind: 'text-red-500', bgClass: 'bg-red-500' },
      down: { hex: '#22c55e', tailwind: 'text-green-500', bgClass: 'bg-green-500' },
      neutral: { hex: '#94a3b8', tailwind: 'text-slate-400', bgClass: 'bg-slate-400' },
    },
    COLOR_SHADES: {
      red: { 50: 'bg-red-50', 100: 'bg-red-100', 500: 'text-red-500', 600: 'text-red-600', 700: 'text-red-700' },
      green: { 50: 'bg-green-50', 100: 'bg-green-100', 500: 'text-green-500', 600: 'text-green-600' },
      blue: { 50: 'bg-blue-50', 100: 'bg-blue-100', 500: 'text-blue-500' },
    },
  }
}

export function createLayerRuleMock(): Record<string, unknown> {
  return {
    layers: [
      { name: 'config', path: 'src/config/', dependencies: [] },
      { name: 'constants', path: 'src/constants/', dependencies: [] },
      { name: 'types', path: 'src/types/', dependencies: [] },
      { name: 'core', path: 'src/core/', dependencies: ['config', 'constants', 'types'] },
      { name: 'lib', path: 'src/lib/', dependencies: ['core', 'config', 'constants', 'types'] },
      { name: 'data', path: 'src/data/', dependencies: ['core', 'config', 'constants', 'types'] },
      { name: 'services', path: 'src/services/', dependencies: ['core', 'data', 'lib', 'config', 'constants', 'types'] },
      { name: 'store', path: 'src/store/', dependencies: ['services', 'core'] },
      { name: 'pages', path: 'src/pages/', dependencies: ['store', 'services'] },
      { name: 'components', path: 'src/components/', dependencies: ['store', 'services'] },
    ],
    exemptions: ['import type', 'src/lib/logger', 'src/lib/format', 'src/lib/errors', 'src/lib/utils', 'src/lib/eventBus'],
  }
}

export function createComponentRegistryMock(): Record<string, unknown> {
  return {
    atoms: ['Button', 'Input', 'Badge', 'Icon', 'Tooltip'],
    molecules: ['Card', 'Modal', 'Form', 'Table', 'Tabs'],
    organisms: ['Header', 'Sidebar', 'Dashboard', 'ChartPanel', 'DataGrid'],
    templates: ['Layout', 'PageTemplate', 'ModalTemplate'],
    chart: ['LineChart', 'BarChart', 'PieChart', 'AreaChart', 'Heatmap'],
    cockpit: ['CockpitShell', 'WidgetPanel', 'ScoreCard'],
    widgets: ['StockWidget', 'NewsWidget', 'SignalWidget', 'PortfolioWidget'],
  }
}

export function createMcpAclMock(): Record<string, unknown> {
  return {
    MCP_ACL_MATRIX: {
      agent: { allowedServers: ['*'], allowedTools: ['*'] },
      ui: { allowedServers: ['system', 'data', 'query', 'analysis'], allowedTools: ['health_check', 'list_*', 'get_*', 'fetch_*'] },
      ci: { allowedServers: ['system'], allowedTools: ['get_*', 'generate_migration_report'] },
      system: { allowedServers: ['*'], allowedTools: ['*'] },
    },
    registeredServers: ['system', 'data', 'query', 'analysis', 'mcp', 'security'],
    registeredTools: {
      system: ['health_check', 'get_config', 'generate_migration_report'],
      data: ['list_stocks', 'get_stock', 'search_stocks'],
      query: ['execute_query', 'get_results', 'export_results'],
      analysis: ['analyze_stock', 'generate_report', 'compare_stocks'],
      mcp: ['call_tool', 'list_tools', 'validate_permission'],
      security: ['validate_token', 'check_permission', 'audit_access'],
    },
  }
}

export function createStoreSchemaMock(): Record<string, unknown> {
  return {
    STORE_NAMES: [
      'stocks', 'v6Scores', 'intelligentScores', 'industryScores', 'orders',
      'watchlists', 'signals', 'researchLogs', 'dailyQuotes', 'financialReports',
      'rotationScores', 'sectorScores', 'scoreDocs', 'strategySnapshots',
      'localDocs', 'news', 'newsStockMap', 'sentimentCache', 'newsBookmarks',
      'hotSectorScores', 'valuePitScores', 'executionLogs', 'missingReports',
      'executionPlans', 'portfolios', 'tradeReviews', 'schemaMigrations',
      'collectConfig', 'customAgents',
    ],
    RESERVED_STORES: ['schemaMigrations', 'rbac_users', 'rbac_roles', 'rbac_permissions'],
    ACL_MATRIX: {
      stocks: { read: ['agent', 'ui', 'system'], write: ['agent', 'system'] },
      v6Scores: { read: ['agent', 'ui', 'system'], write: ['agent', 'system'] },
      orders: { read: ['agent', 'ui', 'system'], write: ['agent', 'system'] },
      rbac_users: { read: ['system'], write: ['system'] },
      rbac_roles: { read: ['system'], write: ['system'] },
    },
  }
}

export function createQualityConfigMock(): Record<string, unknown> {
  return {
    QUALITY_PHASES: {
      intensive: { name: '高强度开发测试期', description: '适用于功能快速迭代阶段', auditFrequencyDays: 1, automationRatio: 0.85, manualReviewRatio: 0.15, qualityGate: { minScore: 85, maxCriticalIssues: 0, maxHighIssues: 3, requiredTestCoverage: 70, requiredDocFreshness: 80 } },
      normal: { name: '稳定维护期', description: '适用于功能稳定阶段', auditFrequencyDays: 3, automationRatio: 0.9, manualReviewRatio: 0.1, qualityGate: { minScore: 75, maxCriticalIssues: 1, maxHighIssues: 5, requiredTestCoverage: 60, requiredDocFreshness: 70 } },
      lightweight: { name: '低维护期', description: '适用于功能冻结阶段', auditFrequencyDays: 7, automationRatio: 0.95, manualReviewRatio: 0.05, qualityGate: { minScore: 65, maxCriticalIssues: 2, maxHighIssues: 8, requiredTestCoverage: 50, requiredDocFreshness: 60 } },
    },
  }
}
