/**
 * @module DataSourceConfigStep
 * @description 数据采集向导第一步：数据源配置
 *
 * 包含两部分：
 * 1. 已保存配置模板列表（加载/重命名/删除/导入/导出/搜索/筛选）
 * 2. 数据维度选择与 API 参数配置
 *
 * 拆分说明（P1-M2，2026-08-15）：
 *   - 常量/类型/工具函数 → dataSourceConfig.{config,types,utils}.ts
 *   - 状态与交互逻辑     → useDataSourceConfig.ts
 *   - 单条模板卡片       → ConfigTemplateCard.tsx
 *   本文件仅保留布局编排，从 605 行降至 ~200 行。
 */

import React from 'react'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/atoms/Card'
import { Button } from '@/components/atoms/Button'
import { Input } from '@/components/atoms/Input'
import { COLOR_TOKENS } from '@/constants/theme.tokens'
import {
  ChevronDown,
  ChevronUp,
  FolderOpen,
  Search,
  Filter,
  XCircle,
  Upload,
} from 'lucide-react'
import { AVAILABLE_DIMENSIONS } from './dataSourceConfig.config'
import { ConfigTemplateCard } from './ConfigTemplateCard'
import { useDataSourceConfig } from './useDataSourceConfig'

/**
 * DataSourceConfigStep
 */
export function DataSourceConfigStep(): React.JSX.Element {
  const {
    selectedDimensions,
    toggleDimension,
    apiConfigs,
    updateApiConfig,
    savedConfigs,
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
  } = useDataSourceConfig()

  return (
    <div className="space-y-4">
      {/* 配置模板列表 */}
      {savedConfigs.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              className={cn(
                'flex items-center gap-1.5 text-sm font-medium hover:opacity-80 transition-opacity',
                COLOR_TOKENS.textPrimary.tailwind,
              )}
              onClick={() => setIsTemplateListCollapsed(!isTemplateListCollapsed)}
            >
              {isTemplateListCollapsed ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronUp className="h-4 w-4" />
              )}
              <FolderOpen className="h-4 w-4" />
              已保存的配置模板
              <span
                className={cn(
                  'text-xs px-1.5 py-0.5 rounded-full',
                  'bg-muted',
                  'text-muted-foreground',
                )}
              >
                {savedConfigs.length}
              </span>
            </button>

            <label className={cn(
              'flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md cursor-pointer',
              'bg-info/10',
              'text-info',
              'hover:opacity-80 transition-opacity',
            )}>
              <Upload className="h-3.5 w-3.5" />
              导入配置
              <input
                type="file"
                accept=".json"
                onChange={(e) => void handleImportConfig(e)}
                className="hidden"
              />
            </label>
          </div>

          {!isTemplateListCollapsed && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[180px]">
                  <Search className={cn(
                    'absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5',
                    COLOR_TOKENS.textMuted.tailwind,
                  )} />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="搜索配置名称..."
                    className="pl-8 h-8 text-sm"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Filter className={cn('h-3.5 w-3.5', COLOR_TOKENS.textMuted.tailwind)} />
                  <select
                    value={selectedFilterDimension}
                    onChange={(e) => setSelectedFilterDimension(e.target.value)}
                    className={cn(
                      'h-8 px-2 text-xs rounded-md border border-border bg-background',
                      COLOR_TOKENS.textPrimary.tailwind,
                      'focus:outline-none focus:ring-2',
                      'focus:ring-primary/30',
                      'focus:border-primary',
                    )}
                  >
                    <option value="">全部维度</option>
                    {AVAILABLE_DIMENSIONS.map((dim) => (
                      <option key={dim.code} value={dim.code}>
                        {dim.name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={selectedFilterFrequency}
                    onChange={(e) => setSelectedFilterFrequency(e.target.value)}
                    className={cn(
                      'h-8 px-2 text-xs rounded-md border border-border bg-background',
                      COLOR_TOKENS.textPrimary.tailwind,
                      'focus:outline-none focus:ring-2',
                      'focus:ring-primary/30',
                      'focus:border-primary',
                    )}
                  >
                    <option value="">全部频率</option>
                    <option value="realtime">实时</option>
                    <option value="hourly">每小时</option>
                    <option value="daily">每日</option>
                    <option value="custom">自定义</option>
                  </select>

                  {hasActiveFilters && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearFilters}
                      className="h-8 px-2 text-xs"
                    >
                      <XCircle className="h-3.5 w-3.5 mr-1" />
                      清除
                    </Button>
                  )}
                </div>
              </div>

              {importSuccess && (
                <div className={cn(
                  'text-center py-2 text-sm rounded-md',
                  'bg-success/10',
                  'text-success',
                )}>
                  {importSuccess}
                </div>
              )}
              {importError && (
                <div className={cn(
                  'text-center py-2 text-sm rounded-md',
                  'bg-destructive/10',
                  'text-destructive',
                )}>
                  {importError}
                </div>
              )}

              {filteredConfigs.length > 0 ? (
                <div className="space-y-2">
                  {filteredConfigs.map((config) => (
                    <ConfigTemplateCard
                      key={config.id}
                      config={config}
                      isLoaded={isConfigLoaded(config)}
                      onLoad={() => handleLoadConfig(config)}
                      onDelete={() => handleDeleteConfig(config.id)}
                      onRename={(newName) => handleRenameConfig(config.id, newName)}
                      onExport={() => handleExportConfig(config.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className={cn(
                  'text-center py-8 text-sm',
                  COLOR_TOKENS.textMuted.tailwind,
                )}>
                  未找到匹配的配置模板
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 数据维度选择 */}
      <div>
        <div className={cn('text-sm mb-3', COLOR_TOKENS.textMuted.tailwind)}>
          选择需要采集的数据维度，并为每个维度配置 API 参数。
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {AVAILABLE_DIMENSIONS.map((dim) => {
            const checked = selectedDimensions.includes(dim.code)
            return (
              <Card
                key={dim.code}
                className={cn(
                  'transition-shadow transition-colors duration-150 cursor-pointer',
                  checked
                    ? cn('ring-2 ring-primary')
                    : cn('hover:shadow-elevation-1 border-border'),
                )}
                onClick={() => toggleDimension(dim.code, !checked)}
              >
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        e.stopPropagation()
                        toggleDimension(dim.code, e.target.checked)
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{dim.name}</div>
                      <div className={cn('text-xs', COLOR_TOKENS.textMuted.tailwind)}>
                        {dim.description}
                      </div>
                    </div>
                  </div>
                  {checked && (
                    <div className="mt-2 pl-6" onClick={(e) => e.stopPropagation()}>
                      <Input
                        placeholder="API 基础地址（可选）"
                        value={apiConfigs[dim.code]?.baseUrl ?? ''}
                        onChange={(e) =>
                          updateApiConfig(dim.code, {
                            baseUrl: e.target.value,
                            timeoutMs: apiConfigs[dim.code]?.timeoutMs ?? 30000,
                          })
                        }
                        className="h-7 text-xs"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
