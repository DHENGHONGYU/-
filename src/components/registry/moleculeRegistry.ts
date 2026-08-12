/**
 * Molecule 层注册表 — 2+ 原子组合，无业务逻辑
 * @doc [V9-DOC-FRONT-046]
 */
import type { ComponentEntry } from './registryTypes'

export const MOLECULE_REGISTRY: ComponentEntry[] = [
  { name: 'Alert', level: 'molecule', sourcePath: 'src/components/molecules/Alert.tsx', targetPath: 'src/components/molecules/Alert.tsx', status: 'active', description: '警告提示（Icon + 文本 + 关闭）', consumers: ['ScoreUpdateAlert', 'ErrorState', 'RiskControlPanel'] },
  { name: 'Dialog', level: 'molecule', sourcePath: 'src/components/molecules/Dialog.tsx', targetPath: 'src/components/molecules/Dialog.tsx', status: 'active', description: '对话框（Trigger + Overlay + Content）', consumers: ['ConfirmDialog', 'ReviewArtifactModal', 'ApiTestDialog'] },
  { name: 'ConfirmDialog', level: 'molecule', sourcePath: 'src/components/molecules/ConfirmDialog.tsx', targetPath: 'src/components/molecules/ConfirmDialog.tsx', status: 'active', description: '命令式确认对话框（无状态展示组件，配合 useConfirmDialog）', consumers: ['useConfirmDialog', 'PoolBoard', 'MigrationPanel'] },
  { name: 'Tabs', level: 'molecule', sourcePath: 'src/components/molecules/Tabs.tsx', targetPath: 'src/components/molecules/Tabs.tsx', status: 'active', description: '标签页（List + Trigger + Content）', consumers: ['MigrationPanel', 'ScoreHistoryPanel', 'IntelligentScorePage'] },
  { name: 'DataState', level: 'molecule', sourcePath: 'src/components/molecules/DataState.tsx', targetPath: 'src/components/molecules/DataState.tsx', status: 'active', description: '数据状态（加载/空/错误）', consumers: ['全页面通用', 'PoolBoard', 'NewsPage'] },
  { name: 'ErrorState', level: 'molecule', sourcePath: 'src/components/molecules/ErrorState.tsx', targetPath: 'src/components/molecules/ErrorState.tsx', status: 'active', description: '错误状态', consumers: ['RouteErrorBoundary', 'WidgetErrorBoundary', 'DataState'] },
  { name: 'EmptyState', level: 'molecule', sourcePath: 'src/components/molecules/EmptyState.tsx', targetPath: 'src/components/molecules/EmptyState.tsx', status: 'active', description: '空状态', consumers: ['PoolList', 'SearchResultList', 'DataState'] },
  { name: 'LoadingState', level: 'molecule', sourcePath: 'src/components/molecules/LoadingState.tsx', targetPath: 'src/components/molecules/LoadingState.tsx', status: 'active', description: '加载状态', consumers: ['PageSkeleton', 'DataState', 'ScoreHistoryPanel'] },
  { name: 'PageHeader', level: 'template', sourcePath: 'src/components/templates/PageHeader.tsx', targetPath: 'src/components/templates/PageHeader.tsx', status: 'active', description: '页面标题 + 操作区（阶段 4 提取到 templates/）', consumers: ['PageContainer', '全页面通用', 'SidebarLayout'] },
  { name: 'FormField', level: 'molecule', sourcePath: 'src/components/molecules/FormField.tsx', targetPath: 'src/components/molecules/FormField.tsx', status: 'active', description: '表单字段（Label + 控件 + 错误）', consumers: ['TBD - pending integration'] },
  { name: 'MetricCard', level: 'molecule', sourcePath: 'src/components/molecules/MetricCard.tsx', targetPath: 'src/components/molecules/MetricCard.tsx', status: 'active', description: '指标卡（标题 + 数值 + 趋势）', consumers: ['DashboardLayout', 'ScoreSummary', 'AgentHealthCard'] },
  { name: 'SearchBar', level: 'molecule', sourcePath: 'src/components/molecules/SearchBar.tsx', targetPath: 'src/components/molecules/SearchBar.tsx', status: 'active', description: '搜索栏', consumers: ['TBD - pending integration'] },
  { name: 'FilterChip', level: 'molecule', sourcePath: 'src/components/molecules/FilterChip.tsx', targetPath: 'src/components/molecules/FilterChip.tsx', status: 'active', description: '可关闭筛选标签', consumers: ['MultiFactorFilterPanel', 'NewsFilterPanel', 'SearchFilters'] },
  { name: 'Loading', level: 'molecule', sourcePath: 'src/components/molecules/states/Loading.tsx', targetPath: 'src/components/molecules/states/Loading.tsx', status: 'active', description: '加载状态（P3 交互状态组件）', consumers: ['LoadingState', 'PageSkeleton', 'DataState'] },
  { name: 'Empty', level: 'molecule', sourcePath: 'src/components/molecules/states/Empty.tsx', targetPath: 'src/components/molecules/states/Empty.tsx', status: 'active', description: '空状态（P3 交互状态组件）', consumers: ['EmptyState', 'PoolList', 'NewsCard'] },
  { name: 'ErrorStateBase', level: 'molecule', sourcePath: 'src/components/molecules/states/Error.tsx', targetPath: 'src/components/molecules/states/Error.tsx', status: 'active', description: '错误状态基础组件（P3 交互状态组件，被 molecules/ErrorState 封装）', consumers: ['ErrorState', 'RouteErrorBoundary', 'WidgetErrorBoundary'] },
  { name: 'Skeleton', level: 'molecule', sourcePath: 'src/components/molecules/states/Skeleton.tsx', targetPath: 'src/components/molecules/states/Skeleton.tsx', status: 'active', description: '骨架屏状态（P3 交互状态组件）', consumers: ['LoadingState', 'PageSkeleton', 'ScoreHistoryPanel'] },
  { name: 'DataQualityIndicator', level: 'molecule', sourcePath: 'src/components/molecules/DataQualityIndicator.tsx', targetPath: 'src/components/molecules/DataQualityIndicator.tsx', status: 'active', description: '数据质量指示器', consumers: ['CollectionProgress', 'StockNewsStats'] },
  { name: 'RankedCard', level: 'molecule', sourcePath: 'src/components/molecules/RankedCard.tsx', targetPath: 'src/components/molecules/RankedCard.tsx', status: 'active', description: '排名卡片', consumers: ['PoolBoard'] },
  { name: 'ScoreGauge', level: 'molecule', sourcePath: 'src/components/molecules/ScoreGauge.tsx', targetPath: 'src/components/molecules/ScoreGauge.tsx', status: 'active', description: '评分仪表', consumers: ['ScoreSummary', 'IntelligentScorePage'] },
  { name: 'SignalBadge', level: 'molecule', sourcePath: 'src/components/molecules/SignalBadge.tsx', targetPath: 'src/components/molecules/SignalBadge.tsx', status: 'active', description: '信号徽章', consumers: ['TradingSignalPanel', 'StrategyGroupCard'] },
  { name: 'TrendArrow', level: 'molecule', sourcePath: 'src/components/molecules/TrendArrow.tsx', targetPath: 'src/components/molecules/TrendArrow.tsx', status: 'active', description: '趋势箭头', consumers: ['MetricCard', 'StockPriceChange'] },
]
