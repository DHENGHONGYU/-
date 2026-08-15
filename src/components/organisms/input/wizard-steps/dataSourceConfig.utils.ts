/**
 * @module dataSourceConfig.utils
 * @description 数据源配置步骤的纯工具函数（数据转换、过滤、匹配等）
 */

/**
 * @fileoverview formatRelativeTime Organism层组件（Organism层组件）
 * @module components/organisms/input/wizard-steps/dataSourceConfig.utils
 */

import type { PersistedWizardConfig } from '@/types/modules/collection.types'

const ONE_HOUR_MS = 3600000

/**
 * 格式化相对时间
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / ONE_HOUR_MS)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  if (hours < 24) return `${hours} 小时前`
  if (days < 30) return `${days} 天前`
  return new Date(timestamp).toLocaleDateString('zh-CN')
}

/**
 * 根据搜索词与筛选条件过滤已保存的配置模板
 */
export function filterSavedConfigs(
  configs: PersistedWizardConfig[],
  searchQuery: string,
  filterDimension: string,
  filterFrequency: string,
): PersistedWizardConfig[] {
  return configs.filter((config) => {
    const matchesSearch =
      searchQuery === '' ||
      config.name.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesDimension =
      filterDimension === '' ||
      config.selectedDimensions.includes(filterDimension)

    const matchesFrequency =
      filterFrequency === '' ||
      config.frequency === filterFrequency

    return matchesSearch && matchesDimension && matchesFrequency
  })
}

/**
 * 判断当前向导是否加载了某个模板
 */
export function isConfigLoaded(
  config: PersistedWizardConfig,
  taskName: string,
  selectedDimensions: string[],
): boolean {
  return (
    taskName === config.name &&
    selectedDimensions.length === config.selectedDimensions.length &&
    selectedDimensions.every((d) => config.selectedDimensions.includes(d))
  )
}
