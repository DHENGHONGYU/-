/**
 * @module ConfigTemplateCard
 * @description 单条配置模板卡片（加载/重命名/删除/导出）
 */

/**
 * @fileoverview ConfigTemplateCard - 配置 / 卡片组件（Organism层组件）
 * @module components/organisms/input/wizard-steps/ConfigTemplateCard
 */

import React, { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/atoms/Card'
import { Button } from '@/components/atoms/Button'
import { Input } from '@/components/atoms/Input'
import {
  COLOR_TOKENS,
} from '@/constants/theme.tokens'
import {
  FolderOpen,
  Pencil,
  Trash2,
  Check,
  X,
  Clock,
  Layers,
  Download,
} from 'lucide-react'
import { getLogger } from '@/lib/logger'
import {
  AVAILABLE_DIMENSIONS,
  FREQUENCY_LABELS,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
  DEFAULT_PRIORITY_STYLE,
} from './dataSourceConfig.config'
import { formatRelativeTime } from './dataSourceConfig.utils'
import type { ConfigTemplateCardProps } from './dataSourceConfig.types'

const logger = getLogger()

/**
 * 单条配置模板卡片
 */
export function ConfigTemplateCard({
  config,
  isLoaded,
  onLoad,
  onDelete,
  onRename,
  onExport,
}: ConfigTemplateCardProps): React.JSX.Element {
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
        'transition-shadow transition-colors duration-200',
        isLoaded
          ? cn('ring-2 ring-primary')
          : cn('hover:shadow-elevation-1 border-border'),
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
                  <Check className={cn('h-3.5 w-3.5', 'text-success')} />
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
                      'bg-success/10',
                      'text-success',
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
                    'bg-info/10',
                    'text-info',
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
            {!isEditing && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onExport}
                className="h-7 w-7 p-0"
                title="导出配置"
              >
                <Download className={cn('h-3.5 w-3.5', COLOR_TOKENS.textMuted.tailwind)} />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDeleteClick}
              className={cn(
                'h-7 w-7 p-0',
                showConfirmDelete ? 'text-destructive' : COLOR_TOKENS.textMuted.tailwind,
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
              'bg-destructive/10',
              'text-destructive',
            )}
          >
            再次点击删除按钮确认删除此配置
          </div>
        )}
      </CardContent>
    </Card>
  )
}
