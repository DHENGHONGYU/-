import React from 'react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Dialog, DialogContent } from '@/components/ui/Dialog'
import MigrationPanel from '@/components/system/MigrationPanel'
import { useCommandStore } from '@/store/commandStore'

export default function CommandApp(): React.JSX.Element {
  // 从 Store 获取状态和方法
  const {
    stats,
    message,
    messageType,
    migrationOpen,
    isLoading,
    isResetting,
    setMigrationOpen,
    loadStats,
    resetAll,
  } = useCommandStore()

  // 使用 Store 内置的异步动作
  const handleReset = async (): Promise<void> => {
    if (!confirm('确定要清空所有数据吗？此操作不可恢复。')) return
    await resetAll()
  }

  return (
    <div className="space-y-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle>总控舱 · 系统监控</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={loadStats}
              disabled={isLoading}
            >
              {isLoading ? '加载中...' : '刷新统计'}
            </Button>
            <Button 
              variant="danger" 
              size="sm" 
              onClick={handleReset}
              disabled={isResetting}
            >
              {isResetting ? '重置中...' : '重置数据'}
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setMigrationOpen(true)}
            >
              V6 迁移
            </Button>
          </div>
          
          {message && (
            <p className={`text-sm ${
              messageType === 'error' ? 'text-destructive' : 
              messageType === 'success' ? 'text-green-600' : 
              'text-muted-foreground'
            }`}>
              {message}
            </p>
          )}
          
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