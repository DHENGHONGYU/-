import React from 'react'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Dialog, DialogContent } from '@/components/ui/Dialog'
import { loadSystemStats, resetAll } from '@/services/system/systemService'
import MigrationPanel from '@/components/system/MigrationPanel'

export default function CommandApp(): React.JSX.Element {
  const [stats, setStats] = useState<Record<string, number> | null>(null)
  const [message, setMessage] = useState('')
  const [migrationOpen, setMigrationOpen] = useState(false)

  const loadStats = async (): Promise<void> => {
    const result = await loadSystemStats()
    if (result.success && result.data) {
      setStats({
        stocks: result.data.stocks,
        orders: result.data.orders,
        scores: result.data.scores,
      })
    } else {
      setMessage(result.error ?? '加载统计失败')
    }
  }

  const handleReset = async (): Promise<void> => {
    if (!confirm('确定要清空所有数据吗？此操作不可恢复。')) return
    const result = await resetAll()
    if (result.success) {
      setMessage('已重置所有数据')
      await loadStats()
    } else {
      setMessage(result.error ?? '重置失败')
    }
  }

  return (
    <div className="space-y-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle>总控舱 · 系统监控</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={loadStats}>
              刷新统计
            </Button>
            <Button variant="danger" size="sm" onClick={handleReset}>
              重置数据
            </Button>
            <Button variant="outline" size="sm" onClick={() => setMigrationOpen(true)}>
              V6 迁移
            </Button>
          </div>
          {message && <p className="text-sm text-muted-foreground">{message}</p>}
          {stats && (
            <div className="grid gap-2 sm:grid-cols-3">
              {Object.entries(stats).map(([key, value]) => (
                <div key={key} className="rounded-md border p-3 text-center">
                  <p className="text-2xl font-bold">{value}</p>
                  <Badge variant="outline">{key}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={migrationOpen} onOpenChange={setMigrationOpen}>
        <DialogContent showCloseButton={false}>
          <MigrationPanel />
        </DialogContent>
      </Dialog>
    </div>
  )
}
