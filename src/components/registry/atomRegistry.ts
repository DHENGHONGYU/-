/**
 * Atom 层注册表 — 不可再分的最小 UI 单元
 * @doc [V9-DOC-FRONT-046]
 */
import type { ComponentEntry } from './registryTypes'

export const ATOM_REGISTRY: ComponentEntry[] = [
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
  { name: 'Card', level: 'atom', sourcePath: 'src/components/atoms/Card.tsx', targetPath: 'src/components/atoms/Card.tsx', status: 'active', description: '卡片容器', consumers: ['MetricCard', 'PoolCard', 'NewsCard'] },
  { name: 'Tooltip', level: 'atom', sourcePath: 'src/components/atoms/Tooltip.tsx', targetPath: 'src/components/atoms/Tooltip.tsx', status: 'active', description: '工具提示', consumers: ['IntelligentScoreExplanation', 'ScoreItem', 'QualityIndicator'] },
  { name: 'Sheet', level: 'atom', sourcePath: 'src/components/atoms/Sheet.tsx', targetPath: 'src/components/atoms/Sheet.tsx', status: 'active', description: '抽屉', consumers: ['FilterChip', 'MigrationPanel', 'WidgetShell'] },
  { name: 'Toast', level: 'atom', sourcePath: 'src/components/atoms/Toast.tsx', targetPath: 'src/components/atoms/Toast.tsx', status: 'active', description: '轻提示', consumers: ['全页面通用', 'useConfirmDialog', 'ScoreUpdateAlert'] },
  { name: 'Breadcrumb', level: 'atom', sourcePath: 'src/components/atoms/Breadcrumb.tsx', targetPath: 'src/components/atoms/Breadcrumb.tsx', status: 'active', description: '面包屑', consumers: ['PageHeader', 'SidebarLayout', 'DashboardLayout'] },
  { name: 'Table', level: 'atom', sourcePath: 'src/components/atoms/Table.tsx', targetPath: 'src/components/atoms/Table.tsx', status: 'active', description: '表格', consumers: ['ScoreHistoryTable', 'ScoreDocVersionTable', 'PoolList'] },
  { name: 'StockPriceChange', level: 'atom', sourcePath: 'src/components/atoms/StockPriceChange.tsx', targetPath: 'src/components/atoms/StockPriceChange.tsx', status: 'active', description: '股价变化', consumers: ['PoolCard', 'StockInfoCard', 'NewsCard'] },
  { name: 'statusColors', level: 'atom', sourcePath: 'src/components/atoms/statusColors.ts', targetPath: 'src/components/atoms/statusColors.ts', status: 'active', description: '状态/优先级/类型 → 语义色映射', consumers: ['Badge', 'StockPriceChange', 'RiskControlPanel'] },
  { name: 'ComplianceDisclaimer', level: 'atom', sourcePath: 'src/components/atoms/ComplianceDisclaimer.tsx', targetPath: 'src/components/atoms/ComplianceDisclaimer.tsx', status: 'active', description: '合规声明（仅供参考非投资建议）', consumers: ['ResearchReportPage', 'ReviewWizard', 'IntelligentScorePage'] },
]
