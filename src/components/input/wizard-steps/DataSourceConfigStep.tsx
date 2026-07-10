/**
 * @module DataSourceConfigStep
 * @description 数据采集向导第一步：数据源配置
 *
 * 包含两部分：
 * 1. 已保存配置模板列表（加载/重命名/删除）
 * 2. 数据维度选择与 API 参数配置
 */

import React, { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { useCollectionWizardStore } from '@/store/collectionWizardStore'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import {
  COLOR_TOKENS,
  twText,
  twBg,
  twBorder,
} from '@/constants/theme.tokens'
import {
  FolderOpen,
  Pencil,
  Trash2,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Clock,
  Layers,
} from 'lucide-react'
import { getLogger } from '@/lib/logger'
import type { PersistedWizardConfig } from '@/types/modules/collection.types'

const logger = getLogger()

const AVAILABLE_DIMENSIONS = [
  { code: 'quote', name: '行情数据', description: '日线、分时、K线' },
  { code: 'financial', name: '财务数据', description: '三大报表、关键指标' },
  { code: 'news', name: '新闻舆情', description: '财经新闻、情感分析' },
  { code: 'sector', name: '板块行业', description: '行业景气、轮动评分' },
] as const

/** 频率标签映射 */
const FREQUENCY_LABELS: Record<string, string> = {
  realtime: '实时',
  hourly: '每小时',
  daily: '每日',
  custom: '自定义',
}

/** 优先级标签映射 */
const PRIORITY_LABELS: Record<string, string> = {
  high: '高',
  medium: '中',
  low: '低',
}

/** 优先级颜色映射 */
const PRIORITY_COLORS: Record<string, { text: string; bg: string }> = {
  high: { text: twText('red', 600), bg: twBg('red', 50) },
  medium: { text: twText('amber', 600), bg: twBg('amber', 50) },
  low: { text: twText('green', 600), bg: twBg('green', 50) },
}

const DEFAULT_PRIORITY_STYLE = { text: twText('amber', 600), bg: twBg('amber', 50) }

/**
 * 格式化相对时间
 */
function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  if (hours < 24) return `${hours} 小时前`
  if (days < 30) return `${days} 天前`
  return new Date(timestamp).toLocaleDateString('zh-CN')
}

/**
 * 单条配置模板卡片
 */
function ConfigTemplateCard({
  config,
  isLoaded,
  onLoad,
  onDelete,
  onRename,
}: {
  config: PersistedWizardConfig
  isLoaded: boolean
  onLoad: () => void
  onDelete: () => void
  onRename: (newName: string) => void
}): React.JSX.Element {
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(config.name)
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handleStartRename = (): void => {
    setEditName(config.name)
    setIsEditing(true)
    setShowConfirmDelete(false)
  }

  const handleConfirmRename = (): void => {
    const trimmed = editName.trim()
    if (trimmed && trimmed !== config.name) {
      logger.info('[ConfigTemplateCard] 重命名配置', {
        configId: config.id,
        oldName: config.name,
        newName: trimmed,
      })
      onRename(trimmed)
    }
    setIsEditing(false)
  }

  const handleCancelRename = (): void => {
    setEditName(config.name)
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') handleConfirmRename()
    if (e.key === 'Escape') handleCancelRename()
  }

  const handleDeleteClick = (): void => {
    if (showConfirmDelete) {
      logger.info('[ConfigTemplateCard] 确认删除配置', { configId: config.id })
      onDelete()
      setShowConfirmDelete(false)
    } else {
      setShowConfirmDelete(true)
      setIsEditing(false)
      // 3 秒后自动取消确认状态
      setTimeout(() => setShowConfirmDelete(false), 3000)
    }
  }

  const dimensionNames = config.selectedDimensions
    .map((code) => AVAILABLE_DIMENSIONS.find((d) => d.code === code)?.name ?? code)
    .slice(0, 3)

  const extraDimCount = config.selectedDimensions.length - 3

  const priorityStyle = (PRIORITY_COLORS[config.priority] ?? DEFAULT_PRIORITY_STYLE)

  return (
    <Card
      className={cn(
        'transition-all duration-200',
        isLoaded
          ? cn('ring-2', twBorder('emerald', 500))
          : cn('hover:shadow-sm', twBorder('gray', 200)),
      )}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          {/* 左侧：名称 + 元信息 */}
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <div className="flex items-center gap-1">
                <Input
                  ref={inputRef}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="h-7 text-sm"
                  maxLength={50}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleConfirmRename}
                  className="h-7 w-7 p-0"
                >
                  <Check className={cn('h-3.5 w-3.5', twText('emerald', 600))} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancelRename}
                  className="h-7 w-7 p-0"
                >
                  <X className={cn('h-3.5 w-3.5', COLOR_TOKENS.textMuted.tailwind)} />
                </Button>
              </div>
            ) : (
              <div className="font-medium text-sm truncate" title={config.name}>
                {config.name}
                {isLoaded && (
                  <span
                    className={cn(
                      'ml-2 text-xs px-1.5 py-0.5 rounded',
                      twBg('emerald', 50),
                      twText('emerald', 700),
                    )}
                  >
                    已加载
                  </span>
                )}
              </div>
            )}

            {/* 维度标签 */}
            <div className="flex items-center gap-1 mt-1.5 flex-wrap">
              <Layers className={cn('h-3 w-3 flex-shrink-0', COLOR_TOKENS.textMuted.tailwind)} />
              {dimensionNames.map((name) => (
                <span
                  key={name}
                  className={cn(
                    'text-xs px-1.5 py-0.5 rounded',
                    twBg('blue', 50),
                    twText('blue', 700),
                  )}
                >
                  {name}
                </span>
              ))}
              {extraDimCount > 0 && (
                <span className={cn('text-xs', COLOR_TOKENS.textMuted.tailwind)}>
                  +{extraDimCount}
                </span>
              )}
            </div>

            {/* 元信息行 */}
            <div className={cn('flex items-center gap-3 mt-1.5 text-xs', COLOR_TOKENS.textMuted.tailwind)}>
              <span>{FREQUENCY_LABELS[config.frequency] ?? config.frequency}</span>
              <span
                className={cn('px-1.5 py-0.5 rounded', priorityStyle.bg, priorityStyle.text)}
              >
                {PRIORITY_LABELS[config.priority] ?? config.priority}优先级
              </span>
              <span className="flex items-center gap-0.5">
                <Clock className="h-3 w-3" />
                {formatRelativeTime(config.updatedAt)}
              </span>
            </div>
          </div>

          {/* 右侧：操作按钮 */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {!isLoaded && !isEditing && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onLoad}
                className="h-7 px-2 text-xs"
                title="加载此配置到向导"
              >
                <FolderOpen className="h-3.5 w-3.5 mr-1" />
                加载
              </Button>
            )}
            {!isEditing && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleStartRename}
                className="h-7 w-7 p-0"
                title="重命名"
              >
                <Pencil className={cn('h-3.5 w-3.5', COLOR_TOKENS.textMuted.tailwind)} />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDeleteClick}
              className={cn(
                'h-7 w-7 p-0',
                showConfirmDelete ? twText('red', 600) : COLOR_TOKENS.textMuted.tailwind,
              )}
              title={showConfirmDelete ? '再次点击确认删除' : '删除'}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* 删除确认提示 */}
        {showConfirmDelete && (
          <div
            className={cn(
              'mt-2 text-xs px-2 py-1 rounded',
              twBg('red', 50),
              twText('red', 600),
            )}
          >
            再次点击删除按钮确认删除此配置
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * DataSourceConfigStep
 */
export function DataSourceConfigStep(): React.JSX.Element {
  const selectedDimensions = useCollectionWizardStore((s) => s.selectedDimensions)
  const toggleDimension = useCollectionWizardStore((s) => s.toggleDimension)
  const apiConfigs = useCollectionWizardStore((s) => s.apiConfigs)
  const updateApiConfig = useCollectionWizardStore((s) => s.updateApiConfig)
  const savedConfigs = useCollectionWizardStore((s) => s.savedConfigs)
  const loadConfigToWizard = useCollectionWizardStore((s) => s.loadConfigToWizard)
  const deleteSavedConfig = useCollectionWizardStore((s) => s.deleteSavedConfig)
  const renameSavedConfig = useCollectionWizardStore((s) => s.renameSavedConfig)
  const taskName = useCollectionWizardStore((s) => s.taskName)

  const [isTemplateListCollapsed, setIsTemplateListCollapsed] = useState(false)

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

  /** 判断当前向导是否加载了某个模板 */
  const isConfigLoaded = (config: PersistedWizardConfig): boolean => {
    return (
      taskName === config.name &&
      selectedDimensions.length === config.selectedDimensions.length &&
      selectedDimensions.every((d) => config.selectedDimensions.includes(d))
    )
  }

  return (
    <div className="space-y-4">
      {/* 配置模板列表 */}
      {savedConfigs.length > 0 && (
        <div>
          <button
            type="button"
            className={cn(
              'flex items-center gap-1.5 text-sm font-medium mb-2 hover:opacity-80 transition-opacity',
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
                twBg('gray', 100),
                twText('gray', 600),
              )}
            >
              {savedConfigs.length}
            </span>
          </button>

          {!isTemplateListCollapsed && (
            <div className="space-y-2">
              {savedConfigs.map((config) => (
                <ConfigTemplateCard
                  key={config.id}
                  config={config}
                  isLoaded={isConfigLoaded(config)}
                  onLoad={() => handleLoadConfig(config)}
                  onDelete={() => handleDeleteConfig(config.id)}
                  onRename={(newName) => handleRenameConfig(config.id, newName)}
                />
              ))}
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
                  'transition-all duration-150 cursor-pointer',
                  checked
                    ? cn('ring-2', twBorder('emerald', 500))
                    : cn('hover:shadow-sm', twBorder('gray', 200)),
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
