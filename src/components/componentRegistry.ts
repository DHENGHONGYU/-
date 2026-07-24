/**
 * V9 组件原子层级注册表
 *
 * 用途：
 * 1. 记录每个组件的原子层级归属（Atom / Molecule / Organism / Template）
 * 2. 作为 `audit:atomic` 脚本的校验依据
 * 3. 为新组件放置位置提供权威参考
 * 4. 追踪组件消费方承诺，防止"注册即僵尸"
 *
 * 维护规则：
 * - 新增组件必须在本文件登记
 * - 新增组件必须填写 consumers 字段（至少一个消费方承诺）
 * - 组件迁移时必须同步更新 targetPath
 * - status 为 'active' 的组件必须有非空 consumers
 * - 零引用组件应标记为 'wip'（开发中暂未接入）或 'deprecated'（已废弃）
 * - status: 'active' | 'migrating' | 'deprecated' | 'wip'
 * @doc [V9-DOC-FRONT-046]
*/

export type AtomicLevel = 'atom' | 'molecule' | 'organism' | 'template'

export interface ComponentEntry {
  name: string
  level: AtomicLevel
  sourcePath: string
  targetPath: string
  status: 'active' | 'migrating' | 'deprecated' | 'wip'
  description: string
  /** 消费方承诺：至少声明一个业务消费方（页面/上层组件/功能模块） */
  consumers: string[]
  /** 废弃元数据（status === 'deprecated' 或 'wip' 时必填） */
  deprecationMeta?: {
    supersededBy?: string      // 替代组件名
    deprecatedSince?: string   // 废弃起始版本/日期
    removalTarget?: string     // 计划移除的目标版本
    reason?: string            // 废弃/观察原因
  }
}

/**
 * COMPONENT_REGISTRY
 */
export const COMPONENT_REGISTRY: ComponentEntry[] = [
  // ============================================================
  // Atoms（原子）— 不可再分的最小 UI 单元
  // ============================================================
  { name: 'Button', level: 'atom', sourcePath: 'src/components/atoms/Button.tsx', targetPath: 'src/components/atoms/Button.tsx', status: 'active', description: '按钮原子', consumers: ['全页面通用', 'FormField', 'Dialog'] },
  { name: 'Input', level: 'atom', sourcePath: 'src/components/atoms/Input.tsx', targetPath: 'src/components/atoms/Input.tsx', status: 'active', description: '输入框', consumers: ['全表单页面', 'SearchBar', 'StockSearch'] },
  { name: 'Textarea', level: 'atom', sourcePath: 'src/components/atoms/Textarea.tsx', targetPath: 'src/components/atoms/Textarea.tsx', status: 'active', description: '文本域', consumers: ['PolicyForm', 'LLMConfigWidget', 'ApiTestDialog'] },
  { name: 'Select', level: 'atom', sourcePath: 'src/components/atoms/Select.tsx', targetPath: 'src/components/atoms/Select.tsx', status: 'active', description: '选择器', consumers: ['MultiFactorFilterPanel', 'SourcePrioritySelect', 'FieldSelector'] },
  { name: 'Checkbox', level: 'atom', sourcePath: 'src/components/atoms/Checkbox.tsx', targetPath: 'src/components/atoms/Checkbox.tsx', status: 'active', description: '复选框', consumers: ['MultiFactorFilterPanel', 'FilterChip', 'FieldSelector'] },
  { name: 'Radio', level: 'atom', sourcePath: 'src/components/atoms/Radio.tsx', targetPath: 'src/components/atoms/Radio.tsx', status: 'active', description: '单选', consumers: ['PolicyForm', 'DimensionConfigCard', 'CollectionStrategyStep'] },
  { name: 'Switch', level: 'atom', sourcePath: 'src/components/atoms/Switch.tsx', targetPath: 'src/components/atoms/Switch.tsx', status: 'active', description: '开关', consumers: ['LLMConfigWidget', 'RiskControlPanel', 'DensityToggle'] },
  { name: 'Slider', level: 'atom', sourcePath: 'src/components/atoms/Slider.tsx', targetPath: 'src/components/atoms/Slider.tsx', status: 'active', description: '滑块', consumers: ['MultiFactorFilterPanel', 'QuotaEstimatePanel', 'DimensionConfigCard'] },
  { name: 'Toggle', level: 'atom', sourcePath: 'src/components/atoms/Toggle.tsx', targetPath: 'src/components/atoms/Toggle.tsx', status: 'active', description: '切换', consumers: ['NewsFilterPanel', 'SearchFilters', 'DensityToggle'] },
  { name: 'Label', level: 'atom', sourcePath: 'src/components/atoms/Label.tsx', targetPath: 'src/components/atoms/Label.tsx', status: 'active', description: '标签', consumers: ['FormField', 'MetricCard', 'QualityIndicator'] },
  { name: 'Badge', level: 'atom', sourcePath: 'src/components/atoms/Badge.tsx', targetPath: 'src/components/atoms/Badge.tsx', status: 'active', description: '徽章', consumers: ['PoolCard', 'NewsCard', 'AgentHealthCard'] },
  { name: 'Progress', level: 'atom', sourcePath: 'src/components/atoms/Progress.tsx', targetPath: 'src/components/atoms/Progress.tsx', status: 'active', description: '进度条', consumers: ['CollectionProgressPanel', 'QualityIndicator', 'MigrationPanel'] },
  { name: 'Separator', level: 'atom', sourcePath: 'src/components/atoms/Separator.tsx', targetPath: 'src/components/atoms/Separator.tsx', status: 'active', description: '分隔线', consumers: ['PageHeader', 'Dialog', 'Card'] },
  { name: 'Skeleton', level: 'atom', sourcePath: 'src/components/atoms/Skeleton.tsx', targetPath: 'src/components/atoms/Skeleton.tsx', status: 'active', description: '骨架屏', consumers: ['PageSkeleton', 'LoadingState', 'ScoreHistoryPanel'] },
  { name: 'Card', level: 'atom', sourcePath: 'src/components/atoms/Card.tsx', targetPath: 'src/components/atoms/Card.tsx', status: 'active', description: '卡片容器', consumers: ['MetricCard', 'PoolCard', 'NewsCard'] },
  { name: 'Tooltip', level: 'atom', sourcePath: 'src/components/atoms/Tooltip.tsx', targetPath: 'src/components/atoms/Tooltip.tsx', status: 'active', description: '工具提示', consumers: ['IntelligentScoreExplanation', 'ScoreItem', 'QualityIndicator'] },
  { name: 'Sheet', level: 'atom', sourcePath: 'src/components/atoms/Sheet.tsx', targetPath: 'src/components/atoms/Sheet.tsx', status: 'active', description: '抽屉', consumers: ['FilterChip', 'MigrationPanel', 'WidgetShell'] },
  { name: 'Toast', level: 'atom', sourcePath: 'src/components/atoms/Toast.tsx', targetPath: 'src/components/atoms/Toast.tsx', status: 'active', description: '轻提示', consumers: ['全页面通用', 'useConfirmDialog', 'ScoreUpdateAlert'] },
  { name: 'Breadcrumb', level: 'atom', sourcePath: 'src/components/atoms/Breadcrumb.tsx', targetPath: 'src/components/atoms/Breadcrumb.tsx', status: 'active', description: '面包屑', consumers: ['PageHeader', 'SidebarLayout', 'DashboardLayout'] },
  { name: 'Result', level: 'atom', sourcePath: 'src/components/atoms/Result.tsx', targetPath: 'src/components/atoms/Result.tsx', status: 'active', description: '结果展示', consumers: ['EmptyState', 'ErrorState', 'ReviewWizard'] },
  { name: 'Table', level: 'atom', sourcePath: 'src/components/atoms/Table.tsx', targetPath: 'src/components/atoms/Table.tsx', status: 'active', description: '表格', consumers: ['ScoreHistoryTable', 'ScoreDocVersionTable', 'PoolList'] },
  { name: 'StockPriceChange', level: 'atom', sourcePath: 'src/components/atoms/StockPriceChange.tsx', targetPath: 'src/components/atoms/StockPriceChange.tsx', status: 'active', description: '股价变化', consumers: ['PoolCard', 'StockInfoCard', 'NewsCard'] },
  { name: 'statusColors', level: 'atom', sourcePath: 'src/components/atoms/statusColors.ts', targetPath: 'src/components/atoms/statusColors.ts', status: 'active', description: '状态/优先级/类型 → 语义色映射', consumers: ['Badge', 'StockPriceChange', 'RiskControlPanel'] },
  { name: 'ComplianceDisclaimer', level: 'atom', sourcePath: 'src/components/atoms/ComplianceDisclaimer.tsx', targetPath: 'src/components/atoms/ComplianceDisclaimer.tsx', status: 'active', description: '合规声明（仅供参考非投资建议）', consumers: ['ResearchReportPage', 'ReviewWizard', 'IntelligentScorePage'] },

  // ============================================================
  // Molecules（分子）— 2+ 原子组合，无业务逻辑
  // ============================================================
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
  { name: 'ErrorState', level: 'molecule', sourcePath: 'src/components/molecules/states/Error.tsx', targetPath: 'src/components/molecules/states/Error.tsx', status: 'active', description: '错误状态（P3 交互状态组件）', consumers: ['ErrorState', 'RouteErrorBoundary', 'WidgetErrorBoundary'] },
  { name: 'Skeleton', level: 'molecule', sourcePath: 'src/components/molecules/states/Skeleton.tsx', targetPath: 'src/components/molecules/states/Skeleton.tsx', status: 'active', description: '骨架屏状态（P3 交互状态组件）', consumers: ['LoadingState', 'PageSkeleton', 'ScoreHistoryPanel'] },

  // ============================================================
  // Organisms（有机体）— 业务领域复合组件
  // ============================================================
  { name: 'PoolBoard', level: 'organism', sourcePath: 'src/components/organisms/pool/PoolBoard.tsx', targetPath: 'src/components/organisms/pool/PoolBoard.tsx', status: 'active', description: '股票池看板', consumers: ['PoolBoardPage', 'PoolBoardWidget', 'InputApp'] },
  { name: 'PoolCard', level: 'organism', sourcePath: 'src/components/organisms/pool/PoolCard.tsx', targetPath: 'src/components/organisms/pool/PoolCard.tsx', status: 'active', description: '股票池卡片', consumers: ['PoolBoard', 'PoolList', 'PoolColumn'] },
  { name: 'PoolColumn', level: 'organism', sourcePath: 'src/components/organisms/pool/PoolColumn.tsx', targetPath: 'src/components/organisms/pool/PoolColumn.tsx', status: 'active', description: '股票池列视图', consumers: ['PoolBoard', 'PoolBoardWidget'] },
  { name: 'PoolList', level: 'organism', sourcePath: 'src/components/organisms/pool/PoolList.tsx', targetPath: 'src/components/organisms/pool/PoolList.tsx', status: 'active', description: '股票池列表', consumers: ['PoolBoard', 'InputApp', 'PoolBoardPage'] },
  { name: 'usePoolDataFromStore', level: 'organism', sourcePath: 'src/components/organisms/pool/usePoolDataFromStore.ts', targetPath: 'src/components/organisms/pool/usePoolDataFromStore.ts', status: 'active', description: '股票池数据桥接 hook', consumers: ['PoolBoard', 'PoolList', 'PoolCard'] },
  { name: 'CollectionProgressPanel', level: 'organism', sourcePath: 'src/components/organisms/collection/CollectionProgressPanel.tsx', targetPath: 'src/components/organisms/collection/CollectionProgressPanel.tsx', status: 'active', description: '采集进度面板', consumers: ['CollectTaskPage', 'InputDashboard'] },
  { name: 'CollectionReportPanel', level: 'organism', sourcePath: 'src/components/organisms/collection/CollectionReportPanel.tsx', targetPath: 'src/components/organisms/collection/CollectionReportPanel.tsx', status: 'active', description: '采集汇报面板', consumers: ['CollectTaskPage', 'InputDashboard'] },

  // 业务领域组件（保持当前位置，逐步迁移）
  { name: 'AnalysisTemplateCards', level: 'organism', sourcePath: 'src/components/organisms/analysis/hub/AnalysisTemplateCards.tsx', targetPath: 'src/components/organisms/analysis/hub/AnalysisTemplateCards.tsx', status: 'active', description: '分析模板卡片', consumers: ['AnalysisApp', 'HotSectorPage'] },
  { name: 'ScoreHistoryPanel', level: 'organism', sourcePath: 'src/components/organisms/analysis/score/ScoreHistoryPanel.tsx', targetPath: 'src/components/organisms/analysis/score/ScoreHistoryPanel.tsx', status: 'active', description: '评分历史面板', consumers: ['IntelligentScorePage', 'IndustryScorePage', 'TrendAndExplanation'] },
  { name: 'MultiPeriodTrendChart', level: 'organism', sourcePath: 'src/components/organisms/analysis/score/MultiPeriodTrendChart.tsx', targetPath: 'src/components/organisms/analysis/score/MultiPeriodTrendChart.tsx', status: 'active', description: '多周期趋势图', consumers: ['ScoreHistoryPanel', 'IntelligentScorePage', 'TrendAndExplanation'] },
  { name: 'ScoreFactorWaterfall', level: 'organism', sourcePath: 'src/components/organisms/analysis/score/ScoreFactorWaterfall.tsx', targetPath: 'src/components/organisms/analysis/score/ScoreFactorWaterfall.tsx', status: 'active', description: '因子瀑布图', consumers: ['IntelligentScoreExplanation', 'ScoreFactorDeltaPanel', 'ReviewWizard'] },
  { name: 'IntelligentScoreExplanation', level: 'organism', sourcePath: 'src/components/organisms/analysis/score/IntelligentScoreExplanation.tsx', targetPath: 'src/components/organisms/analysis/score/IntelligentScoreExplanation.tsx', status: 'active', description: '智能评分解释', consumers: ['IntelligentScorePage', 'TrendAndExplanation', 'ScoreDocPage'] },
  { name: 'MultiFactorFilterPanel', level: 'organism', sourcePath: 'src/components/organisms/analysis/screening/MultiFactorFilterPanel.tsx', targetPath: 'src/components/organisms/analysis/screening/MultiFactorFilterPanel.tsx', status: 'active', description: '多因子筛选面板', consumers: ['MultiFactorFilterPage', 'SectorAnalysisPage', 'StockSearch'] },
  { name: 'NewsFilterPanel', level: 'organism', sourcePath: 'src/components/organisms/news/NewsFilterPanel.tsx', targetPath: 'src/components/organisms/news/NewsFilterPanel.tsx', status: 'active', description: '资讯筛选面板', consumers: ['NewsPage', 'HotSectorPage'] },
  { name: 'NewsCard', level: 'organism', sourcePath: 'src/components/organisms/news/NewsCard.tsx', targetPath: 'src/components/organisms/news/NewsCard.tsx', status: 'active', description: '资讯卡片', consumers: ['NewsPage', 'SearchResultList', 'HotSectorPage'] },
  { name: 'NewsSentimentTrend', level: 'organism', sourcePath: 'src/components/organisms/analysis/news/NewsSentimentTrend.tsx', targetPath: 'src/components/organisms/analysis/news/NewsSentimentTrend.tsx', status: 'active', description: '资讯情绪趋势', consumers: ['NewsPage', 'SectorAnalysisPage', 'HotSectorPage'] },
  { name: 'RiskControlPanel', level: 'organism', sourcePath: 'src/components/organisms/trading/RiskControlPanel.tsx', targetPath: 'src/components/organisms/trading/RiskControlPanel.tsx', status: 'active', description: '风控面板', consumers: ['TradingFlowPage', 'RiskControlPage', 'PortfolioPage'] },
  { name: 'OrderExecutionPanel', level: 'organism', sourcePath: 'src/components/organisms/trading/OrderExecutionPanel.tsx', targetPath: 'src/components/organisms/trading/OrderExecutionPanel.tsx', status: 'active', description: '订单执行面板', consumers: ['TradingFlowPage', 'HoldingsPage'] },
  { name: 'TradingSignalPanel', level: 'organism', sourcePath: 'src/components/organisms/trading/TradingSignalPanel.tsx', targetPath: 'src/components/organisms/trading/TradingSignalPanel.tsx', status: 'active', description: '交易信号面板', consumers: ['TradingFlowPage', 'StrategySnapshotPage', 'SignalSpectrum'] },
  { name: 'ReviewWizard', level: 'organism', sourcePath: 'src/components/organisms/output/ReviewWizard.tsx', targetPath: 'src/components/organisms/output/ReviewWizard.tsx', status: 'active', description: '复盘向导', consumers: ['ReviewWizardPage', 'OutputApp', 'TradeReviewPage'] },
  { name: 'ReviewArtifactCard', level: 'organism', sourcePath: 'src/components/organisms/output/ReviewArtifactCard.tsx', targetPath: 'src/components/organisms/output/ReviewArtifactCard.tsx', status: 'active', description: '复盘产物卡片', consumers: ['TradeReviewPage', 'ReviewWizard', 'OutputHubPage'] },
  { name: 'ReviewArtifactModal', level: 'organism', sourcePath: 'src/components/organisms/output/ReviewArtifactModal.tsx', targetPath: 'src/components/organisms/output/ReviewArtifactModal.tsx', status: 'active', description: '复盘产物弹窗', consumers: ['ReviewArtifactCard', 'ReviewWizard', 'TradeReviewPage'] },
  { name: 'AgentHealthCard', level: 'organism', sourcePath: 'src/components/organisms/system/AgentHealthCard.tsx', targetPath: 'src/components/organisms/system/AgentHealthCard.tsx', status: 'active', description: 'Agent 健康卡片', consumers: ['SystemMonitorPage', 'AgentPerformanceWidget', 'AgentHubPage'] },
  { name: 'EngineStatusCard', level: 'organism', sourcePath: 'src/components/organisms/system/EngineStatusCard.tsx', targetPath: 'src/components/organisms/system/EngineStatusCard.tsx', status: 'active', description: '引擎状态卡片', consumers: ['SystemMonitorPage', 'EngineStatusWidget', 'HealthDashboardPage'] },
  { name: 'MigrationPanel', level: 'organism', sourcePath: 'src/components/organisms/system/MigrationPanel.tsx', targetPath: 'src/components/organisms/system/MigrationPanel.tsx', status: 'active', description: '迁移面板', consumers: ['SystemMonitorPage', 'MCPServerDashboardPage'] },
  { name: 'AgentTaskList', level: 'organism', sourcePath: 'src/components/organisms/system/AgentTaskList.tsx', targetPath: 'src/components/organisms/system/AgentTaskList.tsx', status: 'active', description: 'Agent 任务列表', consumers: ['AgentTasksPage', 'AgentDetailPage', 'SystemMonitorPage'] },
  { name: 'LogStreamPanel', level: 'organism', sourcePath: 'src/components/organisms/system/LogStreamPanel.tsx', targetPath: 'src/components/organisms/system/LogStreamPanel.tsx', status: 'active', description: '日志流面板', consumers: ['SystemMonitorPage', 'LiveLogStream', 'DataTestPanel'] },
  { name: 'SystemArchitectureDiagram', level: 'organism', sourcePath: 'src/components/organisms/system/SystemArchitectureDiagram.tsx', targetPath: 'src/components/organisms/system/SystemArchitectureDiagram.tsx', status: 'active', description: '系统架构图', consumers: ['SystemArchitectureWidget', 'SystemMonitorPage', 'HealthDashboardPage'] },
  { name: 'MigrationPreviewTab', level: 'organism', sourcePath: 'src/components/organisms/system/migration/MigrationPreviewTab.tsx', targetPath: 'src/components/organisms/system/migration/MigrationPreviewTab.tsx', status: 'active', description: '迁移预览 Tab', consumers: ['MigrationPanel', 'MCPServerDashboardPage'] },
  { name: 'MigrationReportTab', level: 'organism', sourcePath: 'src/components/organisms/system/migration/MigrationReportTab.tsx', targetPath: 'src/components/organisms/system/migration/MigrationReportTab.tsx', status: 'active', description: '迁移报告 Tab', consumers: ['MigrationPanel', 'MCPServerDashboardPage'] },
  { name: 'MigrationUploadTab', level: 'organism', sourcePath: 'src/components/organisms/system/migration/MigrationUploadTab.tsx', targetPath: 'src/components/organisms/system/migration/MigrationUploadTab.tsx', status: 'active', description: '迁移上传 Tab', consumers: ['MigrationPanel', 'MCPServerDashboardPage'] },
  { name: 'migrationUtils', level: 'organism', sourcePath: 'src/components/organisms/system/migration/migrationUtils.ts', targetPath: 'src/components/organisms/system/migration/migrationUtils.ts', status: 'active', description: '迁移工具函数', consumers: ['MigrationPanel', 'MigrationPreviewTab', 'MigrationReportTab'] },
  { name: 'useMcpMigration', level: 'organism', sourcePath: 'src/components/organisms/system/migration/useMcpMigration.ts', targetPath: 'src/components/organisms/system/migration/useMcpMigration.ts', status: 'active', description: 'MCP 迁移 Hook', consumers: ['MigrationPanel', 'MigrationUploadTab'] },
  { name: 'reviewArtifact', level: 'organism', sourcePath: 'src/components/organisms/output/reviewArtifact.ts', targetPath: 'src/components/organisms/output/reviewArtifact.ts', status: 'active', description: '复盘产物类型与工具', consumers: ['ReviewWizard', 'ReviewArtifactCard', 'TradeReviewPage'] },
  { name: 'GenericAgentDetail', level: 'organism', sourcePath: 'src/components/organisms/agent/GenericAgentDetail.tsx', targetPath: 'src/components/organisms/agent/GenericAgentDetail.tsx', status: 'active', description: '通用 Agent 详情', consumers: ['AgentDetailPage', 'AgentHubPage', 'agentComponentRegistry'] },
  { name: 'V6ScoringAgentDetail', level: 'organism', sourcePath: 'src/components/organisms/agent/V6ScoringAgentDetail.tsx', targetPath: 'src/components/organisms/agent/V6ScoringAgentDetail.tsx', status: 'active', description: 'V6 评分 Agent 详情', consumers: ['AgentDetailPage', 'agentComponentRegistry', 'AgentHubPage'] },
  { name: 'agentComponentRegistry', level: 'organism', sourcePath: 'src/components/organisms/agent/agentComponentRegistry.ts', targetPath: 'src/components/organisms/agent/agentComponentRegistry.ts', status: 'active', description: 'Agent UI 组件注册表（agentId → 详情组件映射）', consumers: ['AgentDetailPage', 'GenericAgentDetail', 'V6ScoringAgentDetail'] },
  { name: 'StrategyGroupCard', level: 'organism', sourcePath: 'src/components/organisms/strategy/StrategyGroupCard.tsx', targetPath: 'src/components/organisms/strategy/StrategyGroupCard.tsx', status: 'active', description: '策略组卡片', consumers: ['StrategySnapshotPage', 'HotSectorPage'] },
  { name: 'ChangeLogPanel', level: 'organism', sourcePath: 'src/components/organisms/strategy/ChangeLogPanel.tsx', targetPath: 'src/components/organisms/strategy/ChangeLogPanel.tsx', status: 'active', description: '变更日志面板', consumers: ['StrategySnapshotPage', 'ChangelogPage'] },
  { name: 'LocalDocCard', level: 'organism', sourcePath: 'src/components/organisms/localDoc/LocalDocCard.tsx', targetPath: 'src/components/organisms/localDoc/LocalDocCard.tsx', status: 'active', description: '本地文档卡片', consumers: ['LocalKnowledgePage', 'ScoreDocPage'] },
  { name: 'WidgetShell', level: 'organism', sourcePath: 'src/components/widgets/WidgetShell.tsx', targetPath: 'src/components/widgets/WidgetShell.tsx', status: 'active', description: 'Widget 外壳', consumers: ['CockpitLayout', 'widgetRegistry', '全 Cockpit Widget'] },
  { name: 'IndustryHistoryCard', level: 'organism', sourcePath: 'src/components/cabin/IndustryHistoryCard.tsx', targetPath: 'src/components/cabin/IndustryHistoryCard.tsx', status: 'active', description: '行业历史卡片', consumers: ['IndustryScorePage', 'ScoreHistoryPanel', 'IntelligentScorePage'] },
  { name: 'IndustrySkillSnapshotCard', level: 'organism', sourcePath: 'src/components/cabin/IndustrySkillSnapshotCard.tsx', targetPath: 'src/components/cabin/IndustrySkillSnapshotCard.tsx', status: 'active', description: '行业技能快照卡', consumers: ['IndustryScorePage', 'IndustryDashboardPage'] },
  { name: 'ScoreSnapshot', level: 'organism', sourcePath: 'src/components/cabin/ScoreSnapshot.tsx', targetPath: 'src/components/cabin/ScoreSnapshot.tsx', status: 'active', description: '评分快照', consumers: ['IntelligentScorePage', 'IndustryScorePage', 'ScoreSummary'] },
  { name: 'ScoreSummary', level: 'organism', sourcePath: 'src/components/cabin/ScoreSummary.tsx', targetPath: 'src/components/cabin/ScoreSummary.tsx', status: 'active', description: '评分汇总', consumers: ['IntelligentScorePage', 'IndustryScorePage', 'ScoreSnapshot'] },
  { name: 'ScoreHistoryTable', level: 'organism', sourcePath: 'src/components/cabin/ScoreHistoryTable.tsx', targetPath: 'src/components/cabin/ScoreHistoryTable.tsx', status: 'active', description: '评分历史表', consumers: ['ScoreHistoryPanel', 'IntelligentScorePage', 'ScoreDocPage'] },
  { name: 'ScoreItem', level: 'organism', sourcePath: 'src/components/cabin/ScoreItem.tsx', targetPath: 'src/components/cabin/ScoreItem.tsx', status: 'active', description: '评分项', consumers: ['ScoreSummary', 'ScoreSnapshot', 'IntelligentScoreBasisCard'] },
  { name: 'IntelligentScoreBasisCard', level: 'organism', sourcePath: 'src/components/cabin/IntelligentScoreBasisCard.tsx', targetPath: 'src/components/cabin/IntelligentScoreBasisCard.tsx', status: 'active', description: '智能评分依据卡', consumers: ['IntelligentScorePage', 'ScoreDocPage', 'TrendAndExplanation'] },
  { name: 'LineChart', level: 'organism', sourcePath: 'src/components/chart/LineChart.tsx', targetPath: 'src/components/chart/LineChart.tsx', status: 'active', description: '折线图', consumers: ['MultiPeriodTrendChart', 'NewsSentimentTrend', 'SignalQualityTrendChart'] },
  { name: 'BarChart', level: 'organism', sourcePath: 'src/components/chart/BarChart.tsx', targetPath: 'src/components/chart/BarChart.tsx', status: 'active', description: '柱状图', consumers: ['ScoreFactorWaterfall', 'SubIndicatorBar', 'ScoreDistribution'] },
  { name: 'AreaChart', level: 'organism', sourcePath: 'src/components/chart/AreaChart.tsx', targetPath: 'src/components/chart/AreaChart.tsx', status: 'active', description: '面积图', consumers: ['NewsSentimentTrend', 'TrendLineChart', 'SignalQualityTrendChart'] },
  { name: 'CandlestickChart', level: 'organism', sourcePath: 'src/components/chart/CandlestickChart.tsx', targetPath: 'src/components/chart/CandlestickChart.tsx', status: 'active', description: 'K线图', consumers: ['TradingFlowPage', 'BacktestPage', 'PnLAnalysisWidget'] },
  { name: 'GaugeChart', level: 'organism', sourcePath: 'src/components/chart/GaugeChart.tsx', targetPath: 'src/components/chart/GaugeChart.tsx', status: 'active', description: '仪表盘图', consumers: ['RiskControlPanel', 'QualityIndicator', 'ScoreSnapshot'] },
  { name: 'ScoreRadar', level: 'organism', sourcePath: 'src/components/chart/ScoreRadar.tsx', targetPath: 'src/components/chart/ScoreRadar.tsx', status: 'active', description: '评分雷达图', consumers: ['IntelligentScorePage', 'IndustryScorePage', 'ScoreSummary'] },
  { name: 'FactorHeatmap', level: 'organism', sourcePath: 'src/components/chart/FactorHeatmap.tsx', targetPath: 'src/components/chart/FactorHeatmap.tsx', status: 'active', description: '因子热力图', consumers: ['MultiFactorFilterPanel', 'ScoreFactorWaterfall', 'FactorDashboardPanel'] },
  { name: 'IndustryHeatmap', level: 'organism', sourcePath: 'src/components/chart/industry/IndustryHeatmap.tsx', targetPath: 'src/components/chart/industry/IndustryHeatmap.tsx', status: 'active', description: '行业热力图', consumers: ['IndustryDashboardPage', 'SectorAnalysisPage', 'HotSectorPage'] },
  { name: 'IndustryV4Panel', level: 'organism', sourcePath: 'src/components/chart/industry/IndustryV4Panel.tsx', targetPath: 'src/components/chart/industry/IndustryV4Panel.tsx', status: 'active', description: '行业 V4 综合面板', consumers: ['TBD - pending integration'] },
  { name: 'IndustryV4Radar', level: 'organism', sourcePath: 'src/components/chart/industry/IndustryV4Radar.tsx', targetPath: 'src/components/chart/industry/IndustryV4Radar.tsx', status: 'active', description: '行业 V4 雷达图', consumers: ['TBD - pending integration'] },
  { name: 'SubIndicatorBar', level: 'organism', sourcePath: 'src/components/chart/industry/SubIndicatorBar.tsx', targetPath: 'src/components/chart/industry/SubIndicatorBar.tsx', status: 'active', description: '行业子指标柱状图', consumers: ['TBD - pending integration'] },
  { name: 'TrendLineChart', level: 'organism', sourcePath: 'src/components/chart/industry/TrendLineChart.tsx', targetPath: 'src/components/chart/industry/TrendLineChart.tsx', status: 'active', description: '行业趋势折线图', consumers: ['TBD - pending integration'] },
  { name: 'ValuationDistribution', level: 'organism', sourcePath: 'src/components/chart/industry/ValuationDistribution.tsx', targetPath: 'src/components/chart/industry/ValuationDistribution.tsx', status: 'active', description: '行业估值分布图', consumers: ['TBD - pending integration'] },
  { name: 'SectorRotationHeatmap', level: 'organism', sourcePath: 'src/components/organisms/analysis/sector/SectorRotationHeatmap.tsx', targetPath: 'src/components/organisms/analysis/sector/SectorRotationHeatmap.tsx', status: 'active', description: '行业轮动热力图', consumers: ['SectorAnalysisPage', 'IndustryDashboardPage', 'HotSectorPage'] },
  { name: 'SignalQualityTrendChart', level: 'organism', sourcePath: 'src/components/organisms/analysis/signal/SignalQualityTrendChart.tsx', targetPath: 'src/components/organisms/analysis/signal/SignalQualityTrendChart.tsx', status: 'active', description: '信号质量趋势图', consumers: ['SignalQualityDashboardWidget', 'TradingFlowPage', 'StrategySnapshotPage'] },

  // 输入舱组件
  { name: 'CollectionPlanPanel', level: 'organism', sourcePath: 'src/components/organisms/input/CollectionPlanPanel.tsx', targetPath: 'src/components/organisms/input/CollectionPlanPanel.tsx', status: 'active', description: '采集计划面板', consumers: ['CollectTaskPage', 'InputDashboard', 'SevenDimConfigPage'] },
  { name: 'DataCollectionWizard', level: 'organism', sourcePath: 'src/components/organisms/input/DataCollectionWizard.tsx', targetPath: 'src/components/organisms/input/DataCollectionWizard.tsx', status: 'active', description: '采集向导', consumers: ['CollectTaskPage', 'InputDashboard', 'FetcherConfigPage'] },
  { name: 'TraceReplayPanel', level: 'organism', sourcePath: 'src/components/organisms/input/TraceReplayPanel.tsx', targetPath: 'src/components/organisms/input/TraceReplayPanel.tsx', status: 'active', description: 'Trace 回放面板', consumers: ['DataTestPanel', 'CollectTaskPage'] },
  { name: 'QualityIndicator', level: 'organism', sourcePath: 'src/components/organisms/input/QualityIndicator.tsx', targetPath: 'src/components/organisms/input/QualityIndicator.tsx', status: 'active', description: '质量指示器', consumers: ['CollectTaskPage', 'InputDashboard', 'DataTestPanel'] },
  { name: 'StockSearch', level: 'organism', sourcePath: 'src/components/organisms/input/StockSearch.tsx', targetPath: 'src/components/organisms/input/StockSearch.tsx', status: 'active', description: '股票搜索', consumers: ['PoolBoardPage', 'CollectTaskPage', 'InputApp'] },
  { name: 'LiveLogStream', level: 'organism', sourcePath: 'src/components/organisms/input/LiveLogStream.tsx', targetPath: 'src/components/organisms/input/LiveLogStream.tsx', status: 'active', description: '实时日志流', consumers: ['CollectTaskPage', 'DataTestPanel', 'LogStreamPanel'] },
  { name: 'SourcePrioritySelect', level: 'organism', sourcePath: 'src/components/organisms/input/SourcePrioritySelect.tsx', targetPath: 'src/components/organisms/input/SourcePrioritySelect.tsx', status: 'active', description: '数据源优先级选择', consumers: ['SevenDimConfigPage', 'FetcherConfigPage', 'DataCollectionWizard'] },
  { name: 'FieldSelector', level: 'organism', sourcePath: 'src/components/organisms/input/FieldSelector.tsx', targetPath: 'src/components/organisms/input/FieldSelector.tsx', status: 'active', description: '字段选择器', consumers: ['SevenDimConfigPage', 'MultiFactorFilterPanel', 'DataCollectionWizard'] },
  { name: 'PolicyForm', level: 'organism', sourcePath: 'src/components/organisms/input/PolicyForm.tsx', targetPath: 'src/components/organisms/input/PolicyForm.tsx', status: 'active', description: '策略表单', consumers: ['SevenDimConfigPage', 'FetcherConfigPage', 'DimensionConfigCard'] },
  { name: 'DimensionConfigCard', level: 'organism', sourcePath: 'src/components/organisms/input/DimensionConfigCard.tsx', targetPath: 'src/components/organisms/input/DimensionConfigCard.tsx', status: 'active', description: '维度配置卡', consumers: ['SevenDimConfigPage', 'DataCollectionWizard'] },
  { name: 'CollectionTimeline', level: 'organism', sourcePath: 'src/components/organisms/input/CollectionTimeline.tsx', targetPath: 'src/components/organisms/input/CollectionTimeline.tsx', status: 'active', description: '采集时间线', consumers: ['CollectTaskPage', 'InputDashboard'] },
  { name: 'CollectionSwimlane', level: 'organism', sourcePath: 'src/components/organisms/input/CollectionSwimlane.tsx', targetPath: 'src/components/organisms/input/CollectionSwimlane.tsx', status: 'active', description: '采集泳道图', consumers: ['CollectTaskPage', 'SevenDimConfigPage'] },
  { name: 'QuotaEstimatePanel', level: 'organism', sourcePath: 'src/components/organisms/input/QuotaEstimatePanel.tsx', targetPath: 'src/components/organisms/input/QuotaEstimatePanel.tsx', status: 'active', description: '配额估算面板', consumers: ['CollectTaskPage', 'SevenDimConfigPage'] },
  { name: 'ApiTestDialog', level: 'organism', sourcePath: 'src/components/organisms/input/ApiTestDialog.tsx', targetPath: 'src/components/organisms/input/ApiTestDialog.tsx', status: 'active', description: 'API 测试弹窗', consumers: ['DataTestPanel', 'FetcherConfigPage', 'SevenDimConfigPage'] },
  { name: 'CollectionStrategyStep', level: 'organism', sourcePath: 'src/components/organisms/input/wizard-steps/CollectionStrategyStep.tsx', targetPath: 'src/components/organisms/input/wizard-steps/CollectionStrategyStep.tsx', status: 'active', description: '采集向导-策略步骤', consumers: ['DataCollectionWizard'] },
  { name: 'DataSourceConfigStep', level: 'organism', sourcePath: 'src/components/organisms/input/wizard-steps/DataSourceConfigStep.tsx', targetPath: 'src/components/organisms/input/wizard-steps/DataSourceConfigStep.tsx', status: 'active', description: '采集向导-数据源配置步骤', consumers: ['DataCollectionWizard'] },
  { name: 'ExecutionMonitorStep', level: 'organism', sourcePath: 'src/components/organisms/input/wizard-steps/ExecutionMonitorStep.tsx', targetPath: 'src/components/organisms/input/wizard-steps/ExecutionMonitorStep.tsx', status: 'active', description: '采集向导-执行监控步骤', consumers: ['DataCollectionWizard'] },
  { name: 'TaskPreviewStep', level: 'organism', sourcePath: 'src/components/organisms/input/wizard-steps/TaskPreviewStep.tsx', targetPath: 'src/components/organisms/input/wizard-steps/TaskPreviewStep.tsx', status: 'active', description: '采集向导-任务预览步骤', consumers: ['DataCollectionWizard'] },

  // ============================================================
  // Templates（模板）— 页面级布局
  // ============================================================
  { name: 'PageContainer', level: 'template', sourcePath: 'src/components/templates/PageContainer.tsx', targetPath: 'src/components/templates/PageContainer.tsx', status: 'active', description: '页面内容容器', consumers: ['全页面通用', 'SidebarLayout', 'DashboardLayout'] },
  { name: 'DashboardLayout', level: 'template', sourcePath: 'src/components/templates/DashboardLayout.tsx', targetPath: 'src/components/templates/DashboardLayout.tsx', status: 'active', description: '仪表盘布局', consumers: ['DashboardPage', 'HealthDashboardPage', 'OutputHubPage'] },
  { name: 'SidebarLayout', level: 'template', sourcePath: 'src/components/templates/SidebarLayout.tsx', targetPath: 'src/components/templates/SidebarLayout.tsx', status: 'active', description: '侧边栏布局', consumers: ['全页面通用', 'PageContainer', 'CockpitLayout'] },
  { name: 'CockpitLayout', level: 'template', sourcePath: 'src/components/templates/CockpitLayout.tsx', targetPath: 'src/components/templates/CockpitLayout.tsx', status: 'active', description: '驾驶舱布局', consumers: ['CockpitShell', 'HomePage', 'PortalShell'] },

  // ============================================================
  // Shared（跨领域共享，过渡保留）
  // ============================================================
  { name: 'ErrorBoundary', level: 'organism', sourcePath: 'src/components/organisms/shared/ErrorBoundary.tsx', targetPath: 'src/components/organisms/shared/ErrorBoundary.tsx', status: 'active', description: '错误边界', consumers: ['App.tsx', 'main.tsx', 'RouteErrorBoundary'] },
  { name: 'RouteErrorBoundary', level: 'organism', sourcePath: 'src/components/organisms/shared/RouteErrorBoundary.tsx', targetPath: 'src/components/organisms/shared/RouteErrorBoundary.tsx', status: 'active', description: '路由错误边界', consumers: ['全路由页面', 'App.tsx', 'OutputApp'] },
  { name: 'WidgetErrorBoundary', level: 'organism', sourcePath: 'src/components/organisms/shared/WidgetErrorBoundary.tsx', targetPath: 'src/components/organisms/shared/WidgetErrorBoundary.tsx', status: 'active', description: 'Widget 错误边界', consumers: ['WidgetShell', 'CockpitShell', '全 Cockpit Widget'] },
  { name: 'PageSkeleton', level: 'organism', sourcePath: 'src/components/organisms/shared/PageSkeleton.tsx', targetPath: 'src/components/organisms/shared/PageSkeleton.tsx', status: 'active', description: '页面骨架屏', consumers: ['全页面通用', 'SidebarLayout', 'DashboardLayout'] },
  { name: 'installGlobalErrorHandler', level: 'organism', sourcePath: 'src/components/organisms/shared/installGlobalErrorHandler.ts', targetPath: 'src/components/organisms/shared/installGlobalErrorHandler.ts', status: 'active', description: '全局错误监听安装函数（非 UI 组件，基础设施）', consumers: ['main.tsx', 'App.tsx', 'CockpitShell'] },
  { name: 'ScoreFactorDeltaPanel', level: 'organism', sourcePath: 'src/components/organisms/shared/ScoreFactorDeltaPanel.tsx', targetPath: 'src/components/organisms/shared/ScoreFactorDeltaPanel.tsx', status: 'active', description: '评分因子差异面板', consumers: ['IntelligentScorePage', 'IndustryScorePage', 'ScoreResultCard'] },
  { name: 'ScoreUpdateAlert', level: 'organism', sourcePath: 'src/components/organisms/shared/ScoreUpdateAlert.tsx', targetPath: 'src/components/organisms/shared/ScoreUpdateAlert.tsx', status: 'active', description: '评分更新提醒', consumers: ['IntelligentScorePage', 'IndustryScorePage', 'ScoreDocPage'] },
  { name: 'LLMConfigWidget', level: 'organism', sourcePath: 'src/components/organisms/shared/LLMConfigWidget.tsx', targetPath: 'src/components/organisms/shared/LLMConfigWidget.tsx', status: 'active', description: 'LLM 配置 Widget', consumers: ['ConfigApp', 'ApiConfigurationPage', 'LlmManagementPage'] },
  { name: 'ScoreDocVersionTable', level: 'organism', sourcePath: 'src/components/organisms/scoreDoc/ScoreDocVersionTable.tsx', targetPath: 'src/components/organisms/scoreDoc/ScoreDocVersionTable.tsx', status: 'active', description: '评分文档版本表', consumers: ['ScoreDocPage', 'scoreDocArchiveService'] },
  { name: 'SignalSpectrum', level: 'organism', sourcePath: 'src/components/cockpit/SignalSpectrum.tsx', targetPath: 'src/components/cockpit/SignalSpectrum.tsx', status: 'active', description: '信号频谱（cockpit 域，仅 registry 标注不物理搬）', consumers: ['PortalShell', 'CockpitShell', 'TradingSignalPanel'] },
  { name: 'DensityContext', level: 'organism', sourcePath: 'src/components/cockpit/DensityContext.tsx', targetPath: 'src/components/cockpit/DensityContext.tsx', status: 'active', description: '信息密度 Context', consumers: ['PortalShell', 'CockpitShell', 'DensityToggle'] },
  { name: 'DensityToggle', level: 'organism', sourcePath: 'src/components/cockpit/DensityToggle.tsx', targetPath: 'src/components/cockpit/DensityToggle.tsx', status: 'active', description: '信息密度切换', consumers: ['PortalShell', 'CockpitShell', 'PageHeader'] },
  { name: 'SecurityStatus', level: 'organism', sourcePath: 'src/components/cockpit/SecurityStatus.tsx', targetPath: 'src/components/cockpit/SecurityStatus.tsx', status: 'active', description: '安全状态', consumers: ['PortalShell', 'CockpitShell', 'HealthDashboardPage'] },
  { name: 'StandardAgentDetail', level: 'organism', sourcePath: 'src/components/organisms/agent/StandardAgentDetail.tsx', targetPath: 'src/components/organisms/agent/StandardAgentDetail.tsx', status: 'active', description: '标准 Agent 详情', consumers: ['AgentDetailPage', 'AgentHubPage', 'agentComponentRegistry'] },
  // 搜索模块 5 件套 — 零业务引用，标记为开发中待接入
  { name: 'SearchBar', level: 'organism', sourcePath: 'src/components/organisms/search/SearchBar.tsx', targetPath: 'src/components/organisms/search/SearchBar.tsx', status: 'wip', description: '搜索栏', consumers: [], deprecationMeta: { reason: '业务搜索模块尚未接入，当前仅组件实现无消费方' } },
  { name: 'SearchFilters', level: 'organism', sourcePath: 'src/components/organisms/search/SearchFilters.tsx', targetPath: 'src/components/organisms/search/SearchFilters.tsx', status: 'wip', description: '搜索筛选', consumers: [], deprecationMeta: { reason: '业务搜索模块尚未接入，当前仅组件实现无消费方' } },
  { name: 'SearchResultList', level: 'organism', sourcePath: 'src/components/organisms/search/SearchResultList.tsx', targetPath: 'src/components/organisms/search/SearchResultList.tsx', status: 'wip', description: '搜索结果列表', consumers: [], deprecationMeta: { reason: '业务搜索模块尚未接入，当前仅组件实现无消费方' } },
  { name: 'GroupedView', level: 'organism', sourcePath: 'src/components/organisms/search/GroupedView.tsx', targetPath: 'src/components/organisms/search/GroupedView.tsx', status: 'wip', description: '分组视图', consumers: [], deprecationMeta: { reason: '业务搜索模块尚未接入，当前仅组件实现无消费方' } },
  { name: 'TimelineView', level: 'organism', sourcePath: 'src/components/organisms/search/TimelineView.tsx', targetPath: 'src/components/organisms/search/TimelineView.tsx', status: 'wip', description: '时间线视图', consumers: [], deprecationMeta: { reason: '业务搜索模块尚未接入，当前仅组件实现无消费方' } },
  { name: 'CycleRetrospectivePanel', level: 'organism', sourcePath: 'src/components/organisms/output/prediction/CycleRetrospectivePanel.tsx', targetPath: 'src/components/organisms/output/prediction/CycleRetrospectivePanel.tsx', status: 'active', description: '周期回顾面板', consumers: ['RetrospectivePage', 'OutputHubPage', 'TradeReviewPage'] },
  { name: 'FactorDashboardPanel', level: 'organism', sourcePath: 'src/components/organisms/output/prediction/FactorDashboardPanel.tsx', targetPath: 'src/components/organisms/output/prediction/FactorDashboardPanel.tsx', status: 'active', description: '因子仪表盘面板', consumers: ['FactorDashboardPage', 'OutputHubPage', 'MultiFactorFilterPage'] },
  { name: 'PredictionPanel', level: 'organism', sourcePath: 'src/components/organisms/output/prediction/PredictionPanel.tsx', targetPath: 'src/components/organisms/output/prediction/PredictionPanel.tsx', status: 'active', description: '预测面板', consumers: ['PredictionPage', 'OutputHubPage', 'TradeReviewPage'] },
]

/**
 * 按层级分组
 */
export function groupByLevel(registry: ComponentEntry[] = COMPONENT_REGISTRY): Record<AtomicLevel, ComponentEntry[]> {
  const initial: Record<AtomicLevel, ComponentEntry[]> = {
    atom: [],
    molecule: [],
    organism: [],
    template: [],
  }
  return registry.reduce(
    (acc, entry) => {
      acc[entry.level].push(entry)
      return acc
    },
    initial,
  )
}

/**
 * 获取指定层级的组件名列表
 */
export function getNamesByLevel(level: AtomicLevel, registry: ComponentEntry[] = COMPONENT_REGISTRY): string[] {
  return registry.filter((e) => e.level === level).map((e) => e.name)
}
