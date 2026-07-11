import React from 'react'
import { Button } from '@/components/atoms/Button'
import { Badge } from '@/components/atoms/Badge'
import type { BackupSnapshot } from '@/components/system/MigrationPanel'
import type { V6ExportShape, V9ImportShape } from '@/services/system/v6MigrationService'
import { buildV6Overview, buildV9Overview, type PreviewItem } from './migrationUtils'

interface MigrationPreviewTabProps {
  v6Export: V6ExportShape | null
  transformed: V9ImportShape | null
  overwrite: boolean
  onOverwriteChange: (value: boolean) => void
  onImport: () => void
  onRunMigration: () => void
  loading: boolean
  error: string
  backup: BackupSnapshot | null
  onDownloadBackup: () => void
  onRollback: () => void
  rollbackStatus: 'idle' | 'rolling' | 'done' | 'failed'
}

function OverviewGrid({ items, title }: { items: PreviewItem[]; title: string }): React.JSX.Element {
  return (
    <div>
      <h4 className="mb-2 text-sm font-medium">{title}</h4>
      <div className="grid grid-cols-2 gap-2">
        {items.map((item) => (
          <div key={item.key} className="rounded-md border p-2 text-center">
            <p className="text-lg font-bold">{item.count}</p>
            <Badge variant="outline">{item.label}</Badge>
          </div>
        ))}
      </div>
    </div>
  )
}

function BackupBanner({ backup, onDownloadBackup }: { backup: BackupSnapshot; onDownloadBackup: () => void }): React.JSX.Element {
  return (
    <div className="rounded-md border border-success/40 bg-success/5 p-3 text-sm">
      <p className="font-medium">已自动备份当前数据</p>
      <p className="mt-1 text-muted-foreground">
        备份时间:{new Date(backup.createdAt).toLocaleString('zh-CN')} ·
        共 {backup.stores} 个存储区 / {backup.totalRecords} 条记录
      </p>
      <div className="mt-2 flex gap-2">
        <Button variant="outline" size="sm" onClick={onDownloadBackup}>
          下载备份文件
        </Button>
      </div>
    </div>
  )
}

function ErrorBanner({ error, backup, rollbackStatus, onRollback }: {
  error: string
  backup: BackupSnapshot | null
  rollbackStatus: 'idle' | 'rolling' | 'done' | 'failed'
  onRollback: () => void
}): React.JSX.Element {
  return (
    <div className="space-y-2">
      <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive whitespace-pre-line">
        {error}
      </div>
      {backup && rollbackStatus !== 'done' && (
        <div className="flex gap-2">
          <Button
            variant="danger"
            size="sm"
            onClick={onRollback}
            disabled={rollbackStatus === 'rolling'}
          >
            {rollbackStatus === 'rolling' ? '回滚中...' : '回滚到备份'}
          </Button>
        </div>
      )}
    </div>
  )
}

/**
 * MigrationPreviewTab
 */
export function MigrationPreviewTab({
  v6Export,
  transformed,
  overwrite,
  onOverwriteChange,
  onImport,
  onRunMigration,
  loading,
  error,
  backup,
  onDownloadBackup,
  onRollback,
  rollbackStatus,
}: MigrationPreviewTabProps): React.JSX.Element {
  if (!transformed) return <></>

  const v6Overview = v6Export ? buildV6Overview(v6Export) : []
  const v9Overview = buildV9Overview(transformed)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={overwrite}
            onChange={(e) => onOverwriteChange(e.target.checked)}
            className="h-4 w-4"
          />
          覆盖已存在数据
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {v6Overview.length > 0 && <OverviewGrid items={v6Overview} title="V6 源数据概览" />}
        <OverviewGrid items={v9Overview} title="V9 转换后概览" />
      </div>

      <div className="flex gap-2">
        <Button onClick={onImport} disabled={loading}>
          {loading ? '导入中...' : '执行导入'}
        </Button>
        <Button variant="outline" onClick={onRunMigration} disabled={loading}>
          一键迁移（解析+导入）
        </Button>
      </div>

      {backup && <BackupBanner backup={backup} onDownloadBackup={onDownloadBackup} />}
      {error && <ErrorBanner error={error} backup={backup} rollbackStatus={rollbackStatus} onRollback={onRollback} />}
    </div>
  )
}