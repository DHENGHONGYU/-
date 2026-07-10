/**
 * V9 组件原子层级注册表
 *
 * 用途：
 * 1. 记录每个组件的原子层级归属（Atom / Molecule / Organism / Template）
 * 2. 作为 `audit:atomic` 脚本的校验依据
 * 3. 为新组件放置位置提供权威参考
 *
 * 维护规则：
 * - 新增组件必须在本文件登记
 * - 组件迁移时必须同步更新 targetPath
 * - status: 'active' | 'migrating' | 'deprecated'
 */

export type AtomicLevel = 'atom' | 'molecule' | 'organism' | 'template'

export interface ComponentEntry {
  name: string
  level: AtomicLevel
  sourcePath: string
  targetPath: string
  status: 'active' | 'migrating' | 'deprecated'
  description: string
}

/**
 * COMPONENT_REGISTRY
 */
export const COMPONENT_REGISTRY: ComponentEntry[] = [
  // ============================================================
  // Atoms（原子）— 不可再分的最小 UI 单元
  // ============================================================
  { name: 'Button', level: 'atom', sourcePath: 'src/components/ui/Button.tsx', targetPath: 'src/components/atoms/Button.tsx', status: 'active', description: '按钮原子' },
  { name: 'Input', level: 'atom', sourcePath: 'src/components/ui/Input.tsx', targetPath: 'src/components/atoms/Input.tsx', status: 'active', description: '输入框' },
  { name: 'Textarea', level: 'atom', sourcePath: 'src/components/ui/Textarea.tsx', targetPath: 'src/components/atoms/Textarea.tsx', status: 'active', description: '文本域' },
  { name: 'Select', level: 'atom', sourcePath: 'src/components/ui/Select.tsx', targetPath: 'src/components/atoms/Select.tsx', status: 'active', description: '选择器' },
  { name: 'Checkbox', level: 'atom', sourcePath: 'src/components/ui/Checkbox.tsx', targetPath: 'src/components/atoms/Checkbox.tsx', status: 'active', description: '复选框' },
  { name: 'Radio', level: 'atom', sourcePath: 'src/components/ui/Radio.tsx', targetPath: 'src/components/atoms/Radio.tsx', status: 'active', description: '单选' },
  { name: 'Switch', level: 'atom', sourcePath: 'src/components/ui/Switch.tsx', targetPath: 'src/components/atoms/Switch.tsx', status: 'active', description: '开关' },
  { name: 'Slider', level: 'atom', sourcePath: 'src/components/ui/Slider.tsx', targetPath: 'src/components/atoms/Slider.tsx', status: 'active', description: '滑块' },
  { name: 'Toggle', level: 'atom', sourcePath: 'src/components/ui/Toggle.tsx', targetPath: 'src/components/atoms/Toggle.tsx', status: 'active', description: '切换' },
  { name: 'Label', level: 'atom', sourcePath: 'src/components/ui/Label.tsx', targetPath: 'src/components/atoms/Label.tsx', status: 'active', description: '标签' },
  { name: 'Badge', level: 'atom', sourcePath: 'src/components/ui/Badge.tsx', targetPath: 'src/components/atoms/Badge.tsx', status: 'active', description: '徽章' },
  { name: 'Progress', level: 'atom', sourcePath: 'src/components/ui/Progress.tsx', targetPath: 'src/components/atoms/Progress.tsx', status: 'active', description: '进度条' },
  { name: 'Separator', level: 'atom', sourcePath: 'src/components/ui/Separator.tsx', targetPath: 'src/components/atoms/Separator.tsx', status: 'active', description: '分隔线' },
  { name: 'Skeleton', level: 'atom', sourcePath: 'src/components/ui/Skeleton.tsx', targetPath: 'src/components/atoms/Skeleton.tsx', status: 'active', description: '骨架屏' },
  { name: 'Card', level: 'atom', sourcePath: 'src/components/ui/Card.tsx', targetPath: 'src/components/atoms/Card.tsx', status: 'active', description: '卡片容器' },
  { name: 'Tooltip', level: 'atom', sourcePath: 'src/components/ui/Tooltip.tsx', targetPath: 'src/components/atoms/Tooltip.tsx', status: 'active', description: '工具提示' },
  { name: 'Popover', level: 'atom', sourcePath: 'src/components/ui/Popover.tsx', targetPath: 'src/components/atoms/Popover.tsx', status: 'active', description: '气泡卡片' },
  { name: 'Sheet', level: 'atom', sourcePath: 'src/components/ui/Sheet.tsx', targetPath: 'src/components/atoms/Sheet.tsx', status: 'active', description: '抽屉' },
  { name: 'Toast', level: 'atom', sourcePath: 'src/components/ui/Toast.tsx', targetPath: 'src/components/atoms/Toast.tsx', status: 'active', description: '轻提示' },
  { name: 'Menu', level: 'atom', sourcePath: 'src/components/ui/Menu.tsx', targetPath: 'src/components/atoms/Menu.tsx', status: 'active', description: '菜单' },
  { name: 'Pagination', level: 'atom', sourcePath: 'src/components/ui/Pagination.tsx', targetPath: 'src/components/atoms/Pagination.tsx', status: 'active', description: '分页' },
  { name: 'Breadcrumb', level: 'atom', sourcePath: 'src/components/ui/Breadcrumb.tsx', targetPath: 'src/components/atoms/Breadcrumb.tsx', status: 'active', description: '面包屑' },
  { name: 'Result', level: 'atom', sourcePath: 'src/components/ui/Result.tsx', targetPath: 'src/components/atoms/Result.tsx', status: 'active', description: '结果展示' },
  { name: 'List', level: 'atom', sourcePath: 'src/components/ui/List.tsx', targetPath: 'src/components/atoms/List.tsx', status: 'active', description: '列表' },
  { name: 'Grid', level: 'atom', sourcePath: 'src/components/ui/Grid.tsx', targetPath: 'src/components/atoms/Grid.tsx', status: 'active', description: '栅格' },
  { name: 'Table', level: 'atom', sourcePath: 'src/components/ui/Table.tsx', targetPath: 'src/components/atoms/Table.tsx', status: 'active', description: '表格' },
  { name: 'DatePicker', level: 'atom', sourcePath: 'src/components/ui/DatePicker.tsx', targetPath: 'src/components/atoms/DatePicker.tsx', status: 'active', description: '日期选择' },
  { name: 'StockPriceChange', level: 'atom', sourcePath: 'src/components/ui/StockPriceChange.tsx', targetPath: 'src/components/atoms/StockPriceChange.tsx', status: 'active', description: '股价变化' },

  // ============================================================
  // Molecules（分子）— 2+ 原子组合，无业务逻辑
  // ============================================================
  { name: 'Alert', level: 'molecule', sourcePath: 'src/components/ui/Alert.tsx', targetPath: 'src/components/molecules/Alert.tsx', status: 'active', description: '警告提示（Icon + 文本 + 关闭）' },
  { name: 'Dialog', level: 'molecule', sourcePath: 'src/components/ui/Dialog.tsx', targetPath: 'src/components/molecules/Dialog.tsx', status: 'active', description: '对话框（Trigger + Overlay + Content）' },
  { name: 'Tabs', level: 'molecule', sourcePath: 'src/components/ui/Tabs.tsx', targetPath: 'src/components/molecules/Tabs.tsx', status: 'active', description: '标签页（List + Trigger + Content）' },
  { name: 'DataState', level: 'molecule', sourcePath: 'src/components/ui/DataState.tsx', targetPath: 'src/components/molecules/DataState.tsx', status: 'active', description: '数据状态（加载/空/错误）' },
  { name: 'ErrorState', level: 'molecule', sourcePath: 'src/components/ui/ErrorState.tsx', targetPath: 'src/components/molecules/ErrorState.tsx', status: 'active', description: '错误状态' },
  { name: 'EmptyState', level: 'molecule', sourcePath: 'src/components/ui/EmptyState.tsx', targetPath: 'src/components/molecules/EmptyState.tsx', status: 'active', description: '空状态' },
  { name: 'LoadingState', level: 'molecule', sourcePath: 'src/components/ui/LoadingState.tsx', targetPath: 'src/components/molecules/LoadingState.tsx', status: 'active', description: '加载状态' },
  { name: 'PageHeader', level: 'molecule', sourcePath: 'src/components/ui/PageHeader.tsx', targetPath: 'src/components/molecules/PageHeader.tsx', status: 'active', description: '页面标题 + 操作区' },
  { name: 'FormField', level: 'molecule', sourcePath: 'src/components/molecules/FormField.tsx', targetPath: 'src/components/molecules/FormField.tsx', status: 'active', description: '表单字段（Label + 控件 + 错误）' },
  { name: 'MetricCard', level: 'molecule', sourcePath: 'src/components/molecules/MetricCard.tsx', targetPath: 'src/components/molecules/MetricCard.tsx', status: 'active', description: '指标卡（标题 + 数值 + 趋势）' },
  { name: 'SearchBar', level: 'molecule', sourcePath: 'src/components/molecules/SearchBar.tsx', targetPath: 'src/components/molecules/SearchBar.tsx', status: 'active', description: '搜索栏' },
  { name: 'FilterChip', level: 'molecule', sourcePath: 'src/components/molecules/FilterChip.tsx', targetPath: 'src/components/molecules/FilterChip.tsx', status: 'active', description: '可关闭筛选标签' },

  // ============================================================
  // Organisms（有机体）— 业务领域复合组件
  // ============================================================
  { name: 'PoolBoard', level: 'organism', sourcePath: 'src/components/pool/PoolBoard.tsx', targetPath: 'src/components/organisms/pool/PoolBoard.tsx', status: 'active', description: '股票池看板' },
  { name: 'PoolCard', level: 'organism', sourcePath: 'src/components/pool/PoolCard.tsx', targetPath: 'src/components/organisms/pool/PoolCard.tsx', status: 'active', description: '股票池卡片' },
  { name: 'PoolColumn', level: 'organism', sourcePath: 'src/components/pool/PoolColumn.tsx', targetPath: 'src/components/organisms/pool/PoolColumn.tsx', status: 'active', description: '股票池列视图' },
  { name: 'PoolList', level: 'organism', sourcePath: 'src/components/pool/PoolList.tsx', targetPath: 'src/components/organisms/pool/PoolList.tsx', status: 'active', description: '股票池列表' },
  { name: 'CollectionProgressPanel', level: 'organism', sourcePath: 'src/components/collection/CollectionProgressPanel.tsx', targetPath: 'src/components/organisms/collection/CollectionProgressPanel.tsx', status: 'active', description: '采集进度面板' },
  { name: 'CollectionReportPanel', level: 'organism', sourcePath: 'src/components/collection/CollectionReportPanel.tsx', targetPath: 'src/components/organisms/collection/CollectionReportPanel.tsx', status: 'active', description: '采集汇报面板' },

  // 业务领域组件（保持当前位置，逐步迁移）
  { name: 'AnalysisTemplateCards', level: 'organism', sourcePath: 'src/components/analysis/hub/AnalysisTemplateCards.tsx', targetPath: 'src/components/organisms/analysis/hub/AnalysisTemplateCards.tsx', status: 'active', description: '分析模板卡片' },
  { name: 'ScoreHistoryPanel', level: 'organism', sourcePath: 'src/components/analysis/score/ScoreHistoryPanel.tsx', targetPath: 'src/components/organisms/analysis/score/ScoreHistoryPanel.tsx', status: 'active', description: '评分历史面板' },
  { name: 'MultiPeriodTrendChart', level: 'organism', sourcePath: 'src/components/analysis/score/MultiPeriodTrendChart.tsx', targetPath: 'src/components/organisms/analysis/score/MultiPeriodTrendChart.tsx', status: 'active', description: '多周期趋势图' },
  { name: 'ScoreFactorWaterfall', level: 'organism', sourcePath: 'src/components/analysis/score/ScoreFactorWaterfall.tsx', targetPath: 'src/components/organisms/analysis/score/ScoreFactorWaterfall.tsx', status: 'active', description: '因子瀑布图' },
  { name: 'IntelligentScoreExplanation', level: 'organism', sourcePath: 'src/components/analysis/score/IntelligentScoreExplanation.tsx', targetPath: 'src/components/organisms/analysis/score/IntelligentScoreExplanation.tsx', status: 'active', description: '智能评分解释' },
  { name: 'MultiFactorFilterPanel', level: 'organism', sourcePath: 'src/components/analysis/screening/MultiFactorFilterPanel.tsx', targetPath: 'src/components/organisms/analysis/screening/MultiFactorFilterPanel.tsx', status: 'active', description: '多因子筛选面板' },
  { name: 'NewsFilterPanel', level: 'organism', sourcePath: 'src/components/news/NewsFilterPanel.tsx', targetPath: 'src/components/organisms/news/NewsFilterPanel.tsx', status: 'active', description: '资讯筛选面板' },
  { name: 'NewsCard', level: 'organism', sourcePath: 'src/components/news/NewsCard.tsx', targetPath: 'src/components/organisms/news/NewsCard.tsx', status: 'active', description: '资讯卡片' },
  { name: 'NewsSentimentTrend', level: 'organism', sourcePath: 'src/components/analysis/news/NewsSentimentTrend.tsx', targetPath: 'src/components/organisms/analysis/news/NewsSentimentTrend.tsx', status: 'active', description: '资讯情绪趋势' },
  { name: 'RiskControlPanel', level: 'organism', sourcePath: 'src/components/trading/RiskControlPanel.tsx', targetPath: 'src/components/organisms/trading/RiskControlPanel.tsx', status: 'active', description: '风控面板' },
  { name: 'OrderExecutionPanel', level: 'organism', sourcePath: 'src/components/trading/OrderExecutionPanel.tsx', targetPath: 'src/components/organisms/trading/OrderExecutionPanel.tsx', status: 'active', description: '订单执行面板' },
  { name: 'TradingSignalPanel', level: 'organism', sourcePath: 'src/components/trading/TradingSignalPanel.tsx', targetPath: 'src/components/organisms/trading/TradingSignalPanel.tsx', status: 'active', description: '交易信号面板' },
  { name: 'ReviewWizard', level: 'organism', sourcePath: 'src/components/output/ReviewWizard.tsx', targetPath: 'src/components/organisms/output/ReviewWizard.tsx', status: 'active', description: '复盘向导' },
  { name: 'ReviewArtifactCard', level: 'organism', sourcePath: 'src/components/output/ReviewArtifactCard.tsx', targetPath: 'src/components/organisms/output/ReviewArtifactCard.tsx', status: 'active', description: '复盘产物卡片' },
  { name: 'ReviewArtifactModal', level: 'organism', sourcePath: 'src/components/output/ReviewArtifactModal.tsx', targetPath: 'src/components/organisms/output/ReviewArtifactModal.tsx', status: 'active', description: '复盘产物弹窗' },
  { name: 'AgentHealthCard', level: 'organism', sourcePath: 'src/components/system/AgentHealthCard.tsx', targetPath: 'src/components/organisms/system/AgentHealthCard.tsx', status: 'active', description: 'Agent 健康卡片' },
  { name: 'EngineStatusCard', level: 'organism', sourcePath: 'src/components/system/EngineStatusCard.tsx', targetPath: 'src/components/organisms/system/EngineStatusCard.tsx', status: 'active', description: '引擎状态卡片' },
  { name: 'MigrationPanel', level: 'organism', sourcePath: 'src/components/system/MigrationPanel.tsx', targetPath: 'src/components/organisms/system/MigrationPanel.tsx', status: 'active', description: '迁移面板' },
  { name: 'AgentTaskList', level: 'organism', sourcePath: 'src/components/system/AgentTaskList.tsx', targetPath: 'src/components/organisms/system/AgentTaskList.tsx', status: 'active', description: 'Agent 任务列表' },
  { name: 'LogStreamPanel', level: 'organism', sourcePath: 'src/components/system/LogStreamPanel.tsx', targetPath: 'src/components/organisms/system/LogStreamPanel.tsx', status: 'active', description: '日志流面板' },
  { name: 'SystemArchitectureDiagram', level: 'organism', sourcePath: 'src/components/system/SystemArchitectureDiagram.tsx', targetPath: 'src/components/organisms/system/SystemArchitectureDiagram.tsx', status: 'active', description: '系统架构图' },
  { name: 'MigrationPreviewTab', level: 'organism', sourcePath: 'src/components/system/migration/MigrationPreviewTab.tsx', targetPath: 'src/components/organisms/system/migration/MigrationPreviewTab.tsx', status: 'active', description: '迁移预览 Tab' },
  { name: 'MigrationReportTab', level: 'organism', sourcePath: 'src/components/system/migration/MigrationReportTab.tsx', targetPath: 'src/components/organisms/system/migration/MigrationReportTab.tsx', status: 'active', description: '迁移报告 Tab' },
  { name: 'MigrationUploadTab', level: 'organism', sourcePath: 'src/components/system/migration/MigrationUploadTab.tsx', targetPath: 'src/components/organisms/system/migration/MigrationUploadTab.tsx', status: 'active', description: '迁移上传 Tab' },
  { name: 'migrationUtils', level: 'organism', sourcePath: 'src/components/system/migration/migrationUtils.ts', targetPath: 'src/components/organisms/system/migration/migrationUtils.ts', status: 'active', description: '迁移工具函数' },
  { name: 'useMcpMigration', level: 'organism', sourcePath: 'src/components/system/migration/useMcpMigration.ts', targetPath: 'src/components/organisms/system/migration/useMcpMigration.ts', status: 'active', description: 'MCP 迁移 Hook' },
  { name: 'reviewArtifact', level: 'organism', sourcePath: 'src/components/output/reviewArtifact.ts', targetPath: 'src/components/organisms/output/reviewArtifact.ts', status: 'active', description: '复盘产物类型与工具' },
  { name: 'GenericAgentDetail', level: 'organism', sourcePath: 'src/components/agent/GenericAgentDetail.tsx', targetPath: 'src/components/organisms/agent/GenericAgentDetail.tsx', status: 'active', description: '通用 Agent 详情' },
  { name: 'V6ScoringAgentDetail', level: 'organism', sourcePath: 'src/components/agent/V6ScoringAgentDetail.tsx', targetPath: 'src/components/organisms/agent/V6ScoringAgentDetail.tsx', status: 'active', description: 'V6 评分 Agent 详情' },
  { name: 'StrategyGroupCard', level: 'organism', sourcePath: 'src/components/strategy/StrategyGroupCard.tsx', targetPath: 'src/components/organisms/strategy/StrategyGroupCard.tsx', status: 'active', description: '策略组卡片' },
  { name: 'ChangeLogPanel', level: 'organism', sourcePath: 'src/components/strategy/ChangeLogPanel.tsx', targetPath: 'src/components/organisms/strategy/ChangeLogPanel.tsx', status: 'active', description: '变更日志面板' },
  { name: 'LocalDocCard', level: 'organism', sourcePath: 'src/components/localDoc/LocalDocCard.tsx', targetPath: 'src/components/organisms/localDoc/LocalDocCard.tsx', status: 'active', description: '本地文档卡片' },
  { name: 'WidgetShell', level: 'organism', sourcePath: 'src/components/widgets/WidgetShell.tsx', targetPath: 'src/components/organisms/widgets/WidgetShell.tsx', status: 'migrating', description: 'Widget 外壳' },
  { name: 'IndustryHistoryCard', level: 'organism', sourcePath: 'src/components/cabin/IndustryHistoryCard.tsx', targetPath: 'src/components/organisms/cabin/IndustryHistoryCard.tsx', status: 'migrating', description: '行业历史卡片' },
  { name: 'IndustrySkillSnapshotCard', level: 'organism', sourcePath: 'src/components/cabin/IndustrySkillSnapshotCard.tsx', targetPath: 'src/components/organisms/cabin/IndustrySkillSnapshotCard.tsx', status: 'migrating', description: '行业技能快照卡' },
  { name: 'ScoreSnapshot', level: 'organism', sourcePath: 'src/components/cabin/ScoreSnapshot.tsx', targetPath: 'src/components/organisms/cabin/ScoreSnapshot.tsx', status: 'migrating', description: '评分快照' },
  { name: 'ScoreSummary', level: 'organism', sourcePath: 'src/components/cabin/ScoreSummary.tsx', targetPath: 'src/components/organisms/cabin/ScoreSummary.tsx', status: 'migrating', description: '评分汇总' },
  { name: 'ScoreHistoryTable', level: 'organism', sourcePath: 'src/components/cabin/ScoreHistoryTable.tsx', targetPath: 'src/components/organisms/cabin/ScoreHistoryTable.tsx', status: 'migrating', description: '评分历史表' },
  { name: 'ScoreItem', level: 'organism', sourcePath: 'src/components/cabin/ScoreItem.tsx', targetPath: 'src/components/organisms/cabin/ScoreItem.tsx', status: 'migrating', description: '评分项' },
  { name: 'IntelligentScoreBasisCard', level: 'organism', sourcePath: 'src/components/cabin/IntelligentScoreBasisCard.tsx', targetPath: 'src/components/organisms/cabin/IntelligentScoreBasisCard.tsx', status: 'migrating', description: '智能评分依据卡' },
  { name: 'LineChart', level: 'organism', sourcePath: 'src/components/chart/LineChart.tsx', targetPath: 'src/components/organisms/chart/LineChart.tsx', status: 'migrating', description: '折线图' },
  { name: 'BarChart', level: 'organism', sourcePath: 'src/components/chart/BarChart.tsx', targetPath: 'src/components/organisms/chart/BarChart.tsx', status: 'migrating', description: '柱状图' },
  { name: 'AreaChart', level: 'organism', sourcePath: 'src/components/chart/AreaChart.tsx', targetPath: 'src/components/organisms/chart/AreaChart.tsx', status: 'migrating', description: '面积图' },
  { name: 'CandlestickChart', level: 'organism', sourcePath: 'src/components/chart/CandlestickChart.tsx', targetPath: 'src/components/organisms/chart/CandlestickChart.tsx', status: 'migrating', description: 'K线图' },
  { name: 'GaugeChart', level: 'organism', sourcePath: 'src/components/chart/GaugeChart.tsx', targetPath: 'src/components/organisms/chart/GaugeChart.tsx', status: 'migrating', description: '仪表盘图' },
  { name: 'ScoreRadar', level: 'organism', sourcePath: 'src/components/chart/ScoreRadar.tsx', targetPath: 'src/components/organisms/chart/ScoreRadar.tsx', status: 'migrating', description: '评分雷达图' },
  { name: 'FactorHeatmap', level: 'organism', sourcePath: 'src/components/chart/FactorHeatmap.tsx', targetPath: 'src/components/organisms/chart/FactorHeatmap.tsx', status: 'migrating', description: '因子热力图' },
  { name: 'SectorRotationHeatmap', level: 'organism', sourcePath: 'src/components/analysis/sector/SectorRotationHeatmap.tsx', targetPath: 'src/components/organisms/analysis/sector/SectorRotationHeatmap.tsx', status: 'active', description: '行业轮动热力图' },
  { name: 'SignalQualityTrendChart', level: 'organism', sourcePath: 'src/components/analysis/signal/SignalQualityTrendChart.tsx', targetPath: 'src/components/organisms/analysis/signal/SignalQualityTrendChart.tsx', status: 'active', description: '信号质量趋势图' },

  // 输入舱组件
  { name: 'CollectionPlanPanel', level: 'organism', sourcePath: 'src/components/input/CollectionPlanPanel.tsx', targetPath: 'src/components/organisms/input/CollectionPlanPanel.tsx', status: 'active', description: '采集计划面板' },
  { name: 'DataCollectionWizard', level: 'organism', sourcePath: 'src/components/input/DataCollectionWizard.tsx', targetPath: 'src/components/organisms/input/DataCollectionWizard.tsx', status: 'active', description: '采集向导' },
  { name: 'TraceReplayPanel', level: 'organism', sourcePath: 'src/components/input/TraceReplayPanel.tsx', targetPath: 'src/components/organisms/input/TraceReplayPanel.tsx', status: 'active', description: 'Trace 回放面板' },
  { name: 'QualityIndicator', level: 'organism', sourcePath: 'src/components/input/QualityIndicator.tsx', targetPath: 'src/components/organisms/input/QualityIndicator.tsx', status: 'active', description: '质量指示器' },
  { name: 'StockSearch', level: 'organism', sourcePath: 'src/components/input/StockSearch.tsx', targetPath: 'src/components/organisms/input/StockSearch.tsx', status: 'active', description: '股票搜索' },
  { name: 'LiveLogStream', level: 'organism', sourcePath: 'src/components/input/LiveLogStream.tsx', targetPath: 'src/components/organisms/input/LiveLogStream.tsx', status: 'active', description: '实时日志流' },
  { name: 'SourcePrioritySelect', level: 'organism', sourcePath: 'src/components/input/SourcePrioritySelect.tsx', targetPath: 'src/components/organisms/input/SourcePrioritySelect.tsx', status: 'active', description: '数据源优先级选择' },
  { name: 'FieldSelector', level: 'organism', sourcePath: 'src/components/input/FieldSelector.tsx', targetPath: 'src/components/organisms/input/FieldSelector.tsx', status: 'active', description: '字段选择器' },
  { name: 'PolicyForm', level: 'organism', sourcePath: 'src/components/input/PolicyForm.tsx', targetPath: 'src/components/organisms/input/PolicyForm.tsx', status: 'active', description: '策略表单' },
  { name: 'DimensionConfigCard', level: 'organism', sourcePath: 'src/components/input/DimensionConfigCard.tsx', targetPath: 'src/components/organisms/input/DimensionConfigCard.tsx', status: 'active', description: '维度配置卡' },
  { name: 'CollectionTimeline', level: 'organism', sourcePath: 'src/components/input/CollectionTimeline.tsx', targetPath: 'src/components/organisms/input/CollectionTimeline.tsx', status: 'active', description: '采集时间线' },
  { name: 'CollectionSwimlane', level: 'organism', sourcePath: 'src/components/input/CollectionSwimlane.tsx', targetPath: 'src/components/organisms/input/CollectionSwimlane.tsx', status: 'active', description: '采集泳道图' },
  { name: 'QuotaEstimatePanel', level: 'organism', sourcePath: 'src/components/input/QuotaEstimatePanel.tsx', targetPath: 'src/components/organisms/input/QuotaEstimatePanel.tsx', status: 'active', description: '配额估算面板' },
  { name: 'ApiTestDialog', level: 'organism', sourcePath: 'src/components/input/ApiTestDialog.tsx', targetPath: 'src/components/organisms/input/ApiTestDialog.tsx', status: 'active', description: 'API 测试弹窗' },

  // ============================================================
  // Templates（模板）— 页面级布局
  // ============================================================
  { name: 'PageContainer', level: 'template', sourcePath: 'src/components/ui/PageContainer.tsx', targetPath: 'src/components/templates/PageContainer.tsx', status: 'migrating', description: '页面内容容器' },
  { name: 'DashboardLayout', level: 'template', sourcePath: 'src/components/templates/DashboardLayout.tsx', targetPath: 'src/components/templates/DashboardLayout.tsx', status: 'active', description: '仪表盘布局' },
  { name: 'SidebarLayout', level: 'template', sourcePath: 'src/components/templates/SidebarLayout.tsx', targetPath: 'src/components/templates/SidebarLayout.tsx', status: 'active', description: '侧边栏布局' },
  { name: 'CockpitLayout', level: 'template', sourcePath: 'src/components/templates/CockpitLayout.tsx', targetPath: 'src/components/templates/CockpitLayout.tsx', status: 'active', description: '驾驶舱布局' },

  // ============================================================
  // Shared（跨领域共享，过渡保留）
  // ============================================================
  { name: 'ErrorBoundary', level: 'organism', sourcePath: 'src/components/ErrorBoundary.tsx', targetPath: 'src/components/organisms/shared/ErrorBoundary.tsx', status: 'migrating', description: '错误边界' },
  { name: 'RouteErrorBoundary', level: 'organism', sourcePath: 'src/components/RouteErrorBoundary.tsx', targetPath: 'src/components/organisms/shared/RouteErrorBoundary.tsx', status: 'migrating', description: '路由错误边界' },
  { name: 'WidgetErrorBoundary', level: 'organism', sourcePath: 'src/components/WidgetErrorBoundary.tsx', targetPath: 'src/components/organisms/shared/WidgetErrorBoundary.tsx', status: 'migrating', description: 'Widget 错误边界' },
  { name: 'PageSkeleton', level: 'organism', sourcePath: 'src/components/PageSkeleton.tsx', targetPath: 'src/components/organisms/shared/PageSkeleton.tsx', status: 'migrating', description: '页面骨架屏' },
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
