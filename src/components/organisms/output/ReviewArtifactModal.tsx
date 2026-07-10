/**
 * @fileoverview P5 复盘成品卡预览弹窗
 *
 * 基于 ui/Dialog 封装 ReviewArtifactCard，并提供「下载 HTML / 新标签页预览」操作，
 * 实现成品卡的可预览、可分享。供 TradeReviewPage 与复盘向导复用。
 *
 * @module components/output/ReviewArtifactModal
 */
import { Download, ExternalLink, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { ReviewArtifactCard } from './ReviewArtifactCard'
import {
  downloadReviewArtifactHtml,
  openReviewArtifactPreview,
} from './reviewArtifact'
import type { TradeReviewReport } from '@/services/trading/tradeReviewAI'

export interface ReviewArtifactModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  report: TradeReviewReport | null
  /** 生成时间（ISO 字符串） */
  generatedAt: string
}

/**
 * ReviewArtifactModal
 * @param onOpenChange
 * @param report
 * @param generatedAt }
 */
export function ReviewArtifactModal({ open, onOpenChange, report, generatedAt }: ReviewArtifactModalProps) {
  if (!report) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl gap-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            复盘成品卡预览
            <span className="text-sm font-normal text-muted-foreground">可下载为独立 HTML 分享</span>
          </DialogTitle>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-auto rounded-md border border-border p-2">
          <ReviewArtifactCard report={report} generatedAt={generatedAt} />
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => openReviewArtifactPreview(report, generatedAt)}
          >
            <ExternalLink className="mr-1.5 h-4 w-4" />
            新标签页预览
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => downloadReviewArtifactHtml(report, generatedAt)}
          >
            <Download className="mr-1.5 h-4 w-4" />
            下载 HTML
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default ReviewArtifactModal
