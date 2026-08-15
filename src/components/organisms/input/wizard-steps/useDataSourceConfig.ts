/**
 * @module useDataSourceConfig
 * @description 数据源配置步骤的状态与交互逻辑 hook
 */

/**
 * @fileoverview useDataSourceConfig - 数据 / 配置组件（Organism层组件）
 * @module components/organisms/input/wizard-steps/useDataSourceConfig
 */

import { useState, type ChangeEvent } from 'react'
import { useCollectionWizardStore } from '@/store/collectionWizardStore'
import { getLogger } from '@/lib/logger'
import type { PersistedWizardConfig } from '@/types/modules/collection.types'
import { filterSavedConfigs, isConfigLoaded as isConfigLoadedUtil } from './dataSourceConfig.utils'

const logger = getLogger()

export function useDataSourceConfig() {
  const selectedDimensions = useCollectionWizardStore((s) => s.selectedDimensions)
  const toggleDimension = useCollectionWizardStore((s) => s.toggleDimension)
  const apiConfigs = useCollectionWizardStore((s) => s.apiConfigs)
  const updateApiConfig = useCollectionWizardStore((s) => s.updateApiConfig)
  const savedConfigs = useCollectionWizardStore((s) => s.savedConfigs)
  const loadConfigToWizard = useCollectionWizardStore((s) => s.loadConfigToWizard)
  const deleteSavedConfig = useCollectionWizardStore((s) => s.deleteSavedConfig)
  const renameSavedConfig = useCollectionWizardStore((s) => s.renameSavedConfig)
  const exportConfig = useCollectionWizardStore((s) => s.exportConfig)
  const importConfig = useCollectionWizardStore((s) => s.importConfig)
  const taskName = useCollectionWizardStore((s) => s.taskName)

  const [isTemplateListCollapsed, setIsTemplateListCollapsed] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFilterDimension, setSelectedFilterDimension] = useState<string>('')
  const [selectedFilterFrequency, setSelectedFilterFrequency] = useState<string>('')
  const [importError, setImportError] = useState('')
  const [importSuccess, setImportSuccess] = useState('')

  const filteredConfigs = filterSavedConfigs(
    savedConfigs,
    searchQuery,
    selectedFilterDimension,
    selectedFilterFrequency,
  )

  const hasActiveFilters =
    searchQuery !== '' ||
    selectedFilterDimension !== '' ||
    selectedFilterFrequency !== ''

  const handleClearFilters = (): void => {
    setSearchQuery('')
    setSelectedFilterDimension('')
    setSelectedFilterFrequency('')
    logger.info('[DataSourceConfigStep] 清除筛选条件')
  }

  const handleLoadConfig = (config: PersistedWizardConfig): void => {
    logger.info('[DataSourceConfigStep] 加载配置模板', {
      configId: config.id,
      name: config.name,
    })
    loadConfigToWizard(config)
  }

  const handleDeleteConfig = (configId: string): void => {
    logger.info('[DataSourceConfigStep] 删除配置模板', { configId })
    void deleteSavedConfig(configId)
  }

  const handleRenameConfig = (configId: string, newName: string): void => {
    logger.info('[DataSourceConfigStep] 重命名配置模板', { configId, newName })
    void renameSavedConfig(configId, newName)
  }

  const handleExportConfig = (configId: string): void => {
    logger.info('[DataSourceConfigStep] 导出配置模板', { configId })
    exportConfig(configId)
  }

  const handleImportConfig = async (e: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0]
    if (!file) return

    setImportError('')
    setImportSuccess('')

    logger.info('[DataSourceConfigStep] 导入配置模板', { fileName: file.name })
    const result = await importConfig(file)

    if (result.success) {
      setImportSuccess(`配置 "${file.name}" 导入成功`)
      setTimeout(() => setImportSuccess(''), 3000)
    } else {
      setImportError(result.error)
      setTimeout(() => setImportError(''), 5000)
    }

    e.target.value = ''
  }

  /** 判断当前向导是否加载了某个模板 */
  const isConfigLoaded = (config: PersistedWizardConfig): boolean =>
    isConfigLoadedUtil(config, taskName, selectedDimensions)

  return {
    selectedDimensions,
    toggleDimension,
    apiConfigs,
    updateApiConfig,
    savedConfigs,
    taskName,
    isTemplateListCollapsed,
    setIsTemplateListCollapsed,
    searchQuery,
    setSearchQuery,
    selectedFilterDimension,
    setSelectedFilterDimension,
    selectedFilterFrequency,
    setSelectedFilterFrequency,
    importError,
    importSuccess,
    filteredConfigs,
    hasActiveFilters,
    handleClearFilters,
    handleLoadConfig,
    handleDeleteConfig,
    handleRenameConfig,
    handleExportConfig,
    handleImportConfig,
    isConfigLoaded,
  }
}
