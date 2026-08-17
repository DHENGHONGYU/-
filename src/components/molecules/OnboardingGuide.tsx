import { useState, useEffect } from 'react'
import { X, ChevronRight } from 'lucide-react'
import { Button } from '@/components/atoms/Button'

interface OnboardingStep {
  title: string
  description: string
  action?: { label: string; href: string }
}

const STEPS: OnboardingStep[] = [
  {
    title: '1. 录入股票',
    description: '在输入舱添加您关注的股票代码，支持逐项录入或批量导入',
    action: { label: '前往输入舱', href: '#/input' },
  },
  {
    title: '2. 启动采集',
    description: '系统自动拉取三表、行情、研报等数据，完成深度采集',
    action: { label: '查看采集监控', href: '#/input/collection-monitor' },
  },
  {
    title: '3. 查看评分',
    description: '在分析舱查看智能评分结果，了解股票基本面与估值',
    action: { label: '前往分析舱', href: '#/analysis' },
  },
]

interface OnboardingGuideProps {
  /** 是否显示，默认从 localStorage 读取 */
  visible?: boolean
  /** 关闭回调 */
  onClose?: () => void
}

const STORAGE_KEY = 'finsight_onboarding_dismissed'

const safeGetLocalStorage = (key: string): string | null => {
  try { return localStorage.getItem(key) } catch { return null }
}
const safeSetLocalStorage = (key: string, value: string): void => {
  try { localStorage.setItem(key, value) } catch { /* silently fail */ }
}

export function OnboardingGuide({ visible, onClose }: OnboardingGuideProps) {
  const [isVisible, setIsVisible] = useState(visible ?? false)
  const [currentStep, setCurrentStep] = useState(0)

  useEffect(() => {
    if (visible !== undefined) {
      setIsVisible(visible)
    } else {
      const dismissed = safeGetLocalStorage(STORAGE_KEY)
      if (!dismissed) {
        setIsVisible(true)
      }
    }
  }, [visible])

  const handleDismiss = () => {
    setIsVisible(false)
    safeSetLocalStorage(STORAGE_KEY, 'true')
    onClose?.()
  }

  const handleAction = (href: string) => {
    window.location.hash = href
    handleDismiss()
  }

  if (!isVisible) return null

  const step = STEPS[currentStep]
  if (!step) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 bg-card border border-border rounded-xl shadow-lg p-4 animate-in slide-in-from-bottom-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
          新手指引 · {currentStep + 1}/{STEPS.length}
        </span>
        <button onClick={handleDismiss} className="text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>

      <h4 className="font-semibold text-sm mb-1">{step.title}</h4>
      <p className="text-xs text-muted-foreground mb-3">{step.description}</p>

      <div className="flex items-center gap-2">
        {step.action && (
          <Button size="sm" onClick={() => handleAction(step.action!.href)}>
            {step.action.label}
            <ChevronRight className="w-3 h-3 ml-1" />
          </Button>
        )}
        <div className="flex-1" />
        <div className="flex gap-1">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentStep(i)}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === currentStep ? 'bg-primary' : 'bg-muted'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}