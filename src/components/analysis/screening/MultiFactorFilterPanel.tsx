/**
 * @module MultiFactorFilterPanel
 * @description 多因子筛选条件面板：条件组增删、因子/操作符/数值编辑、模板保存/加载。
 */

import { useState } from 'react'
import { Plus, Trash2, Save, Play, Download } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select, SelectItem } from '@/components/ui/Select'
import { useMultiFactorScreeningStore } from '@/store/multiFactorScreeningStore'
import {
  MULTI_FACTOR_SCREENING_FACTORS,
  MULTI_FACTOR_SCREENING_OPERATORS,
  MULTI_FACTOR_SCREENING_LOGICS,
  MULTI_FACTOR_SCREENING_TEMPLATE_NAME_MAX_LENGTH,
} from '@/config/multiFactorScreeningConfig'
import type {
  ScreeningConditionGroup,
  ScreeningCriterion,
  ScreeningLogic,
} from '@/types/modules/screening.types'

function parseNumberInput(value: string): number {
  const parsed = Number.parseFloat(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

function CriterionRow({
  criterion,
  onUpdate,
  onRemove,
}: {
  criterion: ScreeningCriterion
  onUpdate: (updates: Partial<Omit<ScreeningCriterion, 'id'>>) => void
  onRemove: () => void
}) {
  const isBetween = criterion.operator === 'between'
  const factorMeta = MULTI_FACTOR_SCREENING_FACTORS.find((f) => f.factor === criterion.factor)

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-500">因子</label>
        <Select
          value={criterion.factor}
          onChange={(e) => {
            const value = e.target.value as ScreeningCriterion['factor']
            const meta = MULTI_FACTOR_SCREENING_FACTORS.find((f) => f.factor === value)
            onUpdate({
              factor: value,
              operator: meta?.defaultOperator ?? criterion.operator,
              value: meta?.defaultValue ?? criterion.value,
            })
          }}
          className="w-36"
        >
          {MULTI_FACTOR_SCREENING_FACTORS.map((factor) => (
            <SelectItem key={factor.factor} value={factor.factor}>
              {factor.label}
            </SelectItem>
          ))}
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-500">操作</label>
        <Select
          value={criterion.operator}
          onChange={(e) =>
            onUpdate({ operator: e.target.value as ScreeningCriterion['operator'] })
          }
          className="w-24"
        >
          {MULTI_FACTOR_SCREENING_OPERATORS.map((operator) => (
            <SelectItem key={operator.value} value={operator.value}>
              {operator.label}
            </SelectItem>
          ))}
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-500">{isBetween ? '下限' : '数值'}</label>
        <Input
          type="number"
          step={factorMeta?.step ?? '0.1'}
          value={criterion.value}
          onChange={(e) => onUpdate({ value: parseNumberInput(e.target.value) })}
          className="w-28"
        />
      </div>

      {isBetween && (
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">上限</label>
          <Input
            type="number"
            step={factorMeta?.step ?? '0.1'}
            value={criterion.value2 ?? criterion.value}
            onChange={(e) => onUpdate({ value2: parseNumberInput(e.target.value) })}
            className="w-28"
          />
        </div>
      )}

      <Button type="button" variant="ghost" size="sm" onClick={onRemove} aria-label="删除条件">
        <Trash2 className="h-4 w-4 text-slate-500" />
      </Button>
    </div>
  )
}

function ConditionGroupCard({
  group,
  index,
  onUpdate,
  onRemove,
  onAddCriterion,
}: {
  group: ScreeningConditionGroup
  index: number
  onUpdate: (updated: ScreeningConditionGroup) => void
  onRemove: () => void
  onAddCriterion: (groupId: string) => void
}) {
  return (
    <Card className="bg-slate-50/50 dark:bg-slate-900/50">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-3">
          <CardTitle className="text-sm font-medium">条件组 {index + 1}</CardTitle>
          <Select
            value={group.logic}
            onChange={(e) => onUpdate({ ...group, logic: e.target.value as ScreeningLogic })}
            className="w-20"
          >
            {MULTI_FACTOR_SCREENING_LOGICS.map((logic) => (
              <SelectItem key={logic.value} value={logic.value}>
                {logic.label}
              </SelectItem>
            ))}
          </Select>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onRemove} aria-label="删除条件组">
          <Trash2 className="h-4 w-4 text-slate-500" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {group.criteria.map((criterion) => (
          <CriterionRow
            key={criterion.id}
            criterion={criterion}
            onUpdate={(updates) =>
              onUpdate({
                ...group,
                criteria: group.criteria.map((c) => (c.id === criterion.id ? { ...c, ...updates } : c)),
              })
            }
            onRemove={() =>
              onUpdate({
                ...group,
                criteria: group.criteria.filter((c) => c.id !== criterion.id),
              })
            }
          />
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full"
          onClick={() => onAddCriterion(group.id)}
        >
          <Plus className="mr-1 h-4 w-4" />
          添加条件
        </Button>
      </CardContent>
    </Card>
  )
}

export function MultiFactorFilterPanel() {
  const {
    conditionGroups,
    templates,
    loading,
    results,
    addGroup,
    removeGroup,
    addCriterion,
    runScreening,
    saveTemplate,
    loadTemplate,
    deleteTemplate,
    exportResults,
  } = useMultiFactorScreeningStore()

  const [templateName, setTemplateName] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState('')

  const handleSaveTemplate = () => {
    saveTemplate(templateName)
    setTemplateName('')
  }

  const handleLoadTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId)
    if (templateId) {
      loadTemplate(templateId)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">筛选条件</h2>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={addGroup}>
            <Plus className="mr-1 h-4 w-4" />
            添加条件组
          </Button>
          <Button type="button" size="sm" onClick={() => void runScreening()} disabled={loading}>
            <Play className="mr-1 h-4 w-4" />
            {loading ? '筛选中...' : '运行筛选'}
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {conditionGroups.map((group, index) => (
          <ConditionGroupCard
            key={group.id}
            group={group}
            index={index}
            onUpdate={(updated) => {
              if (updated.id === group.id) {
                useMultiFactorScreeningStore.setState((state) => ({
                  conditionGroups: state.conditionGroups.map((g) =>
                    g.id === updated.id ? updated : g,
                  ),
                }))
              }
            }}
            onRemove={() => removeGroup(group.id)}
            onAddCriterion={addCriterion}
          />
        ))}
      </div>

      <Card>
        <CardContent className="space-y-3 pt-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="mb-1 block text-xs text-slate-500">保存当前条件为模板</label>
              <Input
                placeholder="模板名称"
                value={templateName}
                maxLength={MULTI_FACTOR_SCREENING_TEMPLATE_NAME_MAX_LENGTH}
                onChange={(e) => setTemplateName(e.target.value)}
              />
            </div>
            <Button type="button" variant="outline" size="sm" onClick={handleSaveTemplate} disabled={!templateName.trim()}>
              <Save className="mr-1 h-4 w-4" />
              保存模板
            </Button>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="mb-1 block text-xs text-slate-500">加载已保存模板</label>
              <Select
                value={selectedTemplateId}
                onChange={(e) => handleLoadTemplate(e.target.value)}
              >
                <SelectItem value="">选择模板</SelectItem>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
              </Select>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!selectedTemplateId}
              onClick={() => {
                deleteTemplate(selectedTemplateId)
                setSelectedTemplateId('')
              }}
            >
              <Trash2 className="mr-1 h-4 w-4" />
              删除
            </Button>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            disabled={results.length === 0}
            onClick={exportResults}
          >
            <Download className="mr-1 h-4 w-4" />
            导出结果 CSV
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
