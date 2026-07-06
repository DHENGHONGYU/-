import React, { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router'
import { Star, MessageSquare, CheckCircle2, TrendingUp, Clock } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage,
} from '@/components/ui/Breadcrumb'
import { useAgentFeedbackStore } from '@/store/agentFeedbackStore'
import { useAgentStore } from '@/store/agentStore'
import { getLogger } from '@/lib/logger'
import { twText } from '@/constants/theme.tokens'
import type { AgentFeedback } from '@/types/modules/agent.types'

const logger = getLogger()

const CATEGORY_LABELS: Record<string, string> = {
  accuracy: '准确性',
  speed: '速度',
  usability: '易用性',
  feature: '功能',
}

export default function AgentFeedbackPage(): React.JSX.Element {
  const feedbackStore = useAgentFeedbackStore()
  const agentStore = useAgentStore()
  const [selectedRating, setSelectedRating] = useState<number>(0)
  const [comment, setComment] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<AgentFeedback['category']>('accuracy')

  useEffect(() => {
    logger.info('[AgentFeedbackPage] Mounted')
    feedbackStore.refreshSummaries()
    return () => {
      logger.info('[AgentFeedbackPage] Unmounted')
    }
  }, [feedbackStore])

  const handleSubmit = useCallback(() => {
    if (selectedRating === 0) return
    const tasks = Array.from(agentStore.tasks.values())
    const lastTask = tasks[tasks.length - 1]
    const feedback: AgentFeedback = {
      id: `fb-${Date.now()}`,
      taskId: lastTask?.id ?? 'unknown',
      agentId: lastTask?.agentId ?? 'unknown',
      rating: selectedRating as AgentFeedback['rating'],
      comment,
      category: selectedCategory,
      createdAt: Date.now(),
      resolved: false,
    }
    feedbackStore.addFeedback(feedback)
    feedbackStore.refreshSummaries()
    setSelectedRating(0)
    setComment('')
    logger.info('[AgentFeedbackPage] Feedback submitted', { id: feedback.id, taskId: feedback.taskId })
  }, [selectedRating, comment, selectedCategory, feedbackStore, agentStore])

  const summaries = feedbackStore.summaries
  const feedbacks = feedbackStore.feedbacks

  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild><Link to="/">首页</Link></BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbItem>
            <BreadcrumbLink asChild><Link to="/command/hub">总控舱</Link></BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbItem>
            <BreadcrumbLink asChild><Link to="/command/agents">智能体</Link></BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbItem>
            <BreadcrumbPage>反馈控制台</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">反馈控制台</h1>
          <p className="text-muted-foreground">收集和处理智能体执行反馈</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>提交反馈</CardTitle>
            <CardDescription>评价智能体执行结果</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">评分</label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <button
                    key={rating}
                    type="button"
                    className={`p-1 rounded-md transition-colors ${
                      selectedRating >= rating ? twText('yellow', 500) : 'text-muted-foreground'
                    }`}
                    onClick={() => setSelectedRating(rating)}
                  >
                    <Star className={`h-6 w-6 ${selectedRating >= rating ? 'fill-current' : ''}`} />
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">类别</label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value as AgentFeedback['category'])}
              >
                {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">评论</label>
              <textarea
                className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="描述您的反馈..."
              />
            </div>

            <Button
              className="w-full"
              onClick={handleSubmit}
              disabled={selectedRating === 0}
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              提交反馈
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>评分汇总</CardTitle>
            <CardDescription>各智能体反馈评分概览</CardDescription>
          </CardHeader>
          <CardContent>
            {summaries.size === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <TrendingUp className="h-12 w-12 mb-3 opacity-30" />
                <p>暂无评分数据</p>
              </div>
            ) : (
              <div className="space-y-3">
                {Array.from(summaries.entries()).map(([agentId, summary]) => (
                  <div key={agentId} className="rounded-md border p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">{agentId}</span>
                      <div className="flex items-center gap-1">
                        <Star className={`h-4 w-4 ${twText('yellow', 500)} fill-current`} />
                        <span className="text-sm font-bold">{summary.averageRating}</span>
                        <span className="text-xs text-muted-foreground">({summary.totalFeedback})</span>
                      </div>
                    </div>
                    <div className="flex gap-2 text-xs text-muted-foreground">
                      {Object.entries(summary.categoryBreakdown).map(([cat, count]) => (
                        <Badge key={cat} variant="outline" className="text-xs">
                          {CATEGORY_LABELS[cat] ?? cat}: {count}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>反馈历史</CardTitle>
          <CardDescription>最近提交的反馈记录</CardDescription>
        </CardHeader>
        <CardContent>
          {feedbacks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Clock className="h-12 w-12 mb-3 opacity-30" />
              <p>暂无反馈记录</p>
            </div>
          ) : (
            <div className="space-y-2">
              {[...feedbacks].reverse().slice(0, 20).map((fb) => (
                <div key={fb.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`h-3 w-3 ${i < fb.rating ? `${twText('yellow', 500)} fill-current` : 'text-muted-foreground'}`}
                        />
                      ))}
                    </div>
                    <span className="text-muted-foreground">{fb.comment || '(无评论)'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{CATEGORY_LABELS[fb.category] ?? fb.category}</Badge>
                    {fb.resolved && (
                      <CheckCircle2 className={`h-4 w-4 ${twText('green', 500)}`} />
                    )}
                    <span className="text-xs text-muted-foreground">
                      {new Date(fb.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}