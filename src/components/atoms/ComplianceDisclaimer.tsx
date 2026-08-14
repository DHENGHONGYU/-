/**
 * ComplianceDisclaimer — 合规层/免责卡片
 *
 * 在投资助手指引、选股结果、研报生成处统一展示。
 * 内容：数据来源声明、AI输出非投资建议警示、版权归属。
 */
/**
 * @fileoverview ComplianceDisclaimer Atom层组件（Atom层组件）
 * @module components/atoms/ComplianceDisclaimer
 */

import { AlertTriangle, FileText, Shield } from 'lucide-react'
import type React from 'react'
import { COLOR_SHADES } from '@/constants/theme.tokens'

/** 卡片变体 */
export type ComplianceVariant = 'default' | 'compact' | 'tooltip'

interface ComplianceDisclaimerProps {
  variant?: ComplianceVariant
  className?: string
  /** 额外自定义说明 */
  extraMessage?: string
}

const DISCLAIMER_TEXT = {
  general:
    '本系统为个人投研复盘辅助工具，所有分析结果仅供参考，不构成任何投资建议。股票投资有风险，投资需谨慎。',
  aiOutput:
    'AI 生成内容基于 LLM 与投研数据，可能包含事实错误。关键财务数据建议核对原始财报与行情来源。',
  dataSource:
    '数据来源包括用户自有数据、授权第三方数据及公开信息。未经授权，禁止转发或用于商业用途。',
  copyright: '© V9 智能投研复盘系统',
} as const

const iconClass = 'h-4 w-4 shrink-0 mt-0.5'

/**
 * ComplianceDisclaimer
 *
 * @example
 * ```tsx
 * <ComplianceDisclaimer />
 * <ComplianceDisclaimer variant="compact" />
 * ```
 */
export function ComplianceDisclaimer({
  variant = 'default',
  className = '',
  extraMessage,
}: ComplianceDisclaimerProps): React.JSX.Element {
  if (variant === 'tooltip') {
    return (
      <p className={`text-xs leading-relaxed text-muted-foreground ${className}`}>
        {DISCLAIMER_TEXT.general}
      </p>
    )
  }

  if (variant === 'compact') {
    return (
      <div className={`flex items-start gap-2 rounded-md border ${COLOR_SHADES.amber[200]} ${COLOR_SHADES.amber[50]} p-2 text-xs ${COLOR_SHADES.amber[800]} ${COLOR_SHADES.amber['900DarkBorder']} ${COLOR_SHADES.amber['900DarkBg']} ${COLOR_SHADES.amber['300DarkText']} ${className}`}>
        <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
        <span>{DISCLAIMER_TEXT.general}</span>
      </div>
    )
  }

  // default: 完整卡片
  return (
    <div className={`rounded-lg border border-muted bg-card p-4 text-xs text-muted-foreground space-y-3 ${className}`}>
      <div className="flex items-center gap-2 font-medium text-sm text-foreground">
        <Shield className="h-4 w-4" />
        <span>风险提示与免责声明</span>
      </div>

      <div className="space-y-2">
        <div className="flex items-start gap-2">
          <AlertTriangle className={iconClass} />
          <span>{DISCLAIMER_TEXT.general}</span>
        </div>
        <div className="flex items-start gap-2">
          <FileText className={iconClass} />
          <span>{DISCLAIMER_TEXT.aiOutput}</span>
        </div>
        <div className="flex items-start gap-2">
          <Shield className={iconClass} />
          <span>{DISCLAIMER_TEXT.dataSource}</span>
        </div>
      </div>

      {extraMessage && (
        <p className="pt-1 text-xs italic">{extraMessage}</p>
      )}

      <p className="pt-1 text-[10px] opacity-60">{DISCLAIMER_TEXT.copyright}</p>
    </div>
  )
}
