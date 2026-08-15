/**
 * @module dataSourceConfig.types
 * @description 数据源配置步骤的本地类型定义
 */

import type { PersistedWizardConfig } from '@/types/modules/collection.types'

/** 单条配置模板卡片 Props */
export interface ConfigTemplateCardProps {
  config: PersistedWizardConfig
  isLoaded: boolean
  onLoad: () => void
  onDelete: () => void
  onRename: (newName: string) => void
  onExport: () => void
}
