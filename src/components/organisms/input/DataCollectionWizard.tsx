/**
 * @module DataCollectionWizard
 * @description 数据采集向导组件
 *
 * 4步向导式流程：
 * 1. 数据源配置（选择数据维度、配置API参数）
 * 2. 采集策略（频率、优先级、缓存策略）
 * 3. 任务预览（确认配置、预估资源消耗）
 * 4. 执行监控（实时日志、进度追踪、异常处理）
 */

import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Check, ChevronLeft, ChevronRight, Pause, Square } from 'lucide-react'
import { useCollectionWizardStore } from '@/store/collectionWizardStore'
import { COLOR_TOKENS, COLOR_SHADES } from '@/constants/theme.tokens'
import { DataSourceConfigStep } from './wizard-steps/DataSourceConfigStep'
import { CollectionStrategyStep } from './wizard-steps/CollectionStrategyStep'
import { TaskPreviewStep } from './wizard-steps/TaskPreviewStep'
import { ExecutionMonitorStep } from './wizard-steps/ExecutionMonitorStep'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

const STEPS = [
  { number: 1, title: '数据源配置', description: '选择维度与API' },
  { number: 2, title: '采集策略', description: '频率与缓存' },
  { number: 3, title: '任务预览', description: '确认配置' },
  { number: 4, title: '执行监控', description: '实时追踪' },
] as const

/**
 * DataCollectionWizard
 */
export function DataCollectionWizard(): React.JSX.Element {
  const isOpen = useCollectionWizardStore((s) => s.isOpen)
  const currentStep = useCollectionWizardStore((s) => s.currentStep)
  const closeWizard = useCollectionWizardStore((s) => s.closeWizard)
  const setStep = useCollectionWizardStore((s) => s.setStep)
  const resetWizard = useCollectionWizardStore((s) => s.resetWizard)
  const selectedDimensions = useCollectionWizardStore((s) => s.selectedDimensions)

  const handleClose = (): void => {
    logger.info('[DataCollectionWizard] 关闭向导')
    closeWizard()
    // 延迟重置，避免视觉闪烁
    setTimeout(() => resetWizard(), 300)
  }

  const handleNext = (): void => {
    if (currentStep < 4) {
      logger.info('[DataCollectionWizard] 下一步', { from: currentStep, to: currentStep + 1 })
      setStep((currentStep + 1) as 1 | 2 | 3 | 4)
    }
  }

  const handlePrevious = (): void => {
    if (currentStep > 1) {
      logger.info('[DataCollectionWizard] 上一步', { from: currentStep, to: currentStep - 1 })
      setStep((currentStep - 1) as 1 | 2 | 3 | 4)
    }
  }

  const canProceed = (): boolean => {
    switch (currentStep) {
      case 1:
        return selectedDimensions.length > 0
      case 2:
        return true // 策略配置都有默认值
      case 3:
        return true
      case 4:
        return false // 监控步骤不显示"下一步"
      default:
        return false
    }
  }

  const renderStep = (): React.ReactNode => {
    switch (currentStep) {
      case 1:
        return <DataSourceConfigStep />
      case 2:
        return <CollectionStrategyStep />
      case 3:
        return <TaskPreviewStep />
      case 4:
        return <ExecutionMonitorStep />
      default:
        return null
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>数据采集向导</DialogTitle>
          <DialogDescription>
            配置数据源、采集策略，并监控采集任务执行
          </DialogDescription>
        </DialogHeader>

        {/* 步骤指示器 */}
        <div className="flex items-center justify-between py-4 px-2">
          {STEPS.map((step, index) => {
            const isActive = step.number === currentStep
            const isCompleted = step.number < currentStep
            return (
              <React.Fragment key={step.number}>
                <div className="flex flex-col items-center gap-1">
                  <div
                    className={`
                      w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                      transition-colors
                      ${isCompleted
                        ? `${COLOR_TOKENS.success.bgClass} text-white`
                        : isActive
                          ? `${COLOR_TOKENS.info.bgClass} text-white`
                          : `${COLOR_SHADES.gray[200]} ${COLOR_SHADES.gray[500]}`
                      }
                    `}
                  >
                    {isCompleted ? <Check className="w-4 h-4" /> : step.number}
                  </div>
                  <div className="text-center">
                    <div className={`text-xs font-medium ${isActive ? COLOR_TOKENS.textPrimary.tailwind : COLOR_TOKENS.textMuted.tailwind}`}>
                      {step.title}
                    </div>
                    <div className={`text-xs ${COLOR_TOKENS.textMuted.tailwind}`}>
                      {step.description}
                    </div>
                  </div>
                </div>
                {index < STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-2 ${
                      step.number < currentStep ? COLOR_TOKENS.success.bgClass : COLOR_SHADES.gray[200]
                    }`}
                  />
                )}
              </React.Fragment>
            )
          })}
        </div>

        {/* 步骤内容 */}
        <div className="flex-1 overflow-y-auto min-h-[400px] border-t border-b py-4">
          {renderStep()}
        </div>

        {/* 底部操作按钮 */}
        <div className="flex items-center justify-between pt-4">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentStep === 1}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            上一步
          </Button>

          <div className="flex items-center gap-2">
            {currentStep === 4 && (
              <>
                <Button variant="outline" size="sm">
                  <Pause className="w-4 h-4 mr-1" />
                  暂停
                </Button>
                <Button variant="danger" size="sm">
                  <Square className="w-4 h-4 mr-1" />
                  停止
                </Button>
              </>
            )}
          </div>

          {currentStep < 4 ? (
            <Button
              onClick={handleNext}
              disabled={!canProceed()}
            >
              下一步
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button variant="outline" onClick={handleClose}>
              关闭
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
