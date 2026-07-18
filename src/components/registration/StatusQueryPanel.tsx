/**
 * 注册与契约状态查询面板
 *
 * 输入 userId → 查询 → 展示注册状态 + 契约履行进度 + 异常汇总。
 *
 * @module components/registration/StatusQueryPanel
 * @since 2026-07-18
 */

import { useState, useCallback } from 'react'
import { useRegistrationContractStore } from '@/store/registrationContractStore'
import { Input } from '@/components/atoms/Input'
import { Button } from '@/components/atoms/Button'
import { Badge } from '@/components/atoms/Badge'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/atoms/Card'
import { Progress } from '@/components/atoms/Progress'
import { Separator } from '@/components/atoms/Separator'

// ── 子组件：阶段标签 ──────────────────────────────────────

function PhaseBadge({ phase }: { phase: string }) {
  const map: Record<string, { variant: 'success' | 'warning' | 'destructive' | 'secondary' | 'outline' | 'default'; label: string }> = {
    active: { variant: 'success', label: '活跃' },
    pending: { variant: 'warning', label: '待审核' },
    unsigned: { variant: 'destructive', label: '未签署' },
    breached: { variant: 'destructive', label: '已违约' },
    completed: { variant: 'success', label: '已完成' },
    terminated: { variant: 'secondary', label: '已终止' },
    expired: { variant: 'secondary', label: '已过期' },
    revoked: { variant: 'destructive', label: '已撤销' },
    not_started: { variant: 'outline', label: '未开始' },
    pending_sign: { variant: 'warning', label: '待签署' },
  }
  const m = map[phase] ?? { variant: 'default' as const, label: phase }
  return <Badge variant={m.variant}>{m.label}</Badge>
}

// ── 子组件：异常列表 ──────────────────────────────────────

function AnomalyList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null
  return (
    <div className="mt-2">
      <span className="text-xs font-medium text-muted-foreground">{title}：</span>
      <ul className="mt-1 list-inside list-disc text-xs text-warning">        {items.map((a) => (
          <li key={a}>{a}</li>
        ))}
      </ul>
    </div>
  )
}

// ── 主面板 ──────────────────────────────────────────────────

/**
 * StatusQueryPanel
 */
export function StatusQueryPanel() {
  const { result, loading, error, queryStatus } = useRegistrationContractStore()
  const [userId, setUserId] = useState('user-001')

  const handleQuery = useCallback(() => {
    if (!userId.trim()) return
    queryStatus({ userId: userId.trim() })
  }, [userId, queryStatus])

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* 查询栏 */}
      <Card>
        <CardHeader>
          <CardTitle>注册与契约状态查询</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                用户标识
              </label>
              <Input
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="输入 userId"
                onKeyDown={(e) => e.key === 'Enter' && handleQuery()}
              />
            </div>
            <Button onClick={handleQuery} disabled={loading}>
              {loading ? '查询中...' : '查询状态'}
            </Button>
          </div>
          {error && (
            <p className="mt-2 text-sm text-destructive">{error}</p>
          )}
        </CardContent>
      </Card>

      {result && (
        <>
          {/* 健康评分卡片 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>综合健康评分</span>
                <span className={`text-2xl font-bold ${
                  result.summary.healthScore >= 80 ? 'text-success' :
                  result.summary.healthScore >= 50 ? 'text-warning' :
                  'text-destructive'
                }`}>
                  {result.summary.healthScore}/100
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Progress value={result.summary.healthScore} max={100} label="健康度" />
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <span>总异常：{result.summary.totalAnomalies}</span>
                <span>活跃契约：{result.summary.activeContracts}</span>
                <span>注册异常：{result.summary.registrationAnomalies}</span>
                <span>违约契约：{result.summary.breachedContracts}</span>
              </div>
            </CardContent>
          </Card>

          {/* 注册状态 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                注册状态
                <PhaseBadge phase={result.registration.phase} />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-muted-foreground">注册时间</span>
                <span>{result.registration.registeredAt ?? '—'}</span>
                <span className="text-muted-foreground">激活时间</span>
                <span>{result.registration.activatedAt ?? '—'}</span>
                <span className="text-muted-foreground">注册渠道</span>
                <span>{result.registration.channel}</span>
                <span className="text-muted-foreground">账户验证</span>
                <span>{result.registration.verified ? '✅ 已验证' : '⚠️ 未验证'}</span>
              </div>
              <AnomalyList
                title="注册异常"
                items={result.registration.anomalies}
              />
            </CardContent>
          </Card>

          {/* 契约状态列表 */}
          <Card>
            <CardHeader>
              <CardTitle>契约履行状态（{result.contracts.length}）</CardTitle>
            </CardHeader>
            <CardContent>
              {result.contracts.map((c, idx) => (
                <div key={c.contractId}>
                  {idx > 0 && <Separator className="my-3" />}
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium text-sm">{c.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{c.contractId}</span>
                    </div>
                    <PhaseBadge phase={c.phase} />
                  </div>
                  <div className="mt-1">
                    <Progress value={c.progress} max={100} label="履行进度" />
                  </div>
                  <div className="mt-1 grid grid-cols-3 gap-1 text-xs text-muted-foreground">
                    <span>签署：{c.signedAt?.slice(0, 10) ?? '—'}</span>
                    <span>生效：{c.effectiveAt?.slice(0, 10) ?? '—'}</span>
                    <span>到期：{c.expiresAt?.slice(0, 10) ?? '—'}</span>
                  </div>
                  {/* 违约记录 */}
                  {c.breachRecords.length > 0 && (
                    <div className="mt-2 rounded border border-destructive/20 bg-destructive/10 p-2 text-xs dark:border-destructive/40">
                      <span className="font-medium text-destructive dark:text-destructive-foreground">
                        违约记录（{c.breachRecords.length}）
                      </span>
                      {c.breachRecords.map((b, bi) => (
                        <div key={bi} className="mt-1">
                          {b.date.slice(0, 10)} · {b.type} · 严重度 {b.severity}/5
                          {!b.resolved && ' · ⚠️ 未解决'}
                          <div className="text-muted-foreground">{b.description}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  <AnomalyList title="契约异常" items={c.anomalies} />
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
