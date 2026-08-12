import React, { useCallback } from 'react'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

interface MigrationUploadTabProps {
  error: string
  onFileSelected: (file: File) => void
}

/**
 * MigrationUploadTab
 * @param onFileSelected }
 */
export function MigrationUploadTab({ error, onFileSelected }: MigrationUploadTabProps): React.JSX.Element {
  const acceptMigrationFile = useCallback(
    (file: File | undefined, via: 'drop' | 'input'): void => {
      if (!file) return
      logger.info(`[MigrationUploadTab] File selected via ${via}`, {
        fileName: file.name,
        fileSize: file.size,
      })
      onFileSelected(file)
    },
    [onFileSelected],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      acceptMigrationFile(e.dataTransfer.files[0], 'drop')
    },
    [acceptMigrationFile],
  )

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      acceptMigrationFile(e.target.files?.[0], 'input')
    },
    [acceptMigrationFile],
  )

  return (
    <div className="space-y-4">
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className="rounded-lg border-2 border-dashed border-muted-foreground/25 p-8 text-center hover:border-muted-foreground/50"
      >
        <p className="text-sm text-muted-foreground">拖拽 JSON 文件到此处，或点击选择</p>
        <input
          type="file"
          accept="application/json"
          aria-label="上传 V6 导出 JSON"
          onChange={handleInputChange}
          className="mt-4 block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-secondary file:px-4 file:py-2 file:text-sm file:font-medium"
        />
      </div>
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
    </div>
  )
}