/**
 * @doc [V9-DOC-BACK-012, V9-DOC-BACK-023, V9-DOC-BACK-033, V9-DOC-BACK-021, V9-DOC-BACK-026]
 */
import { getLogger } from '@/lib/logger'
import { safeRegex } from '@/lib/safeRegex'
import type { FileHash, FileType, LocalScanResult } from '@/data/types'
import { HYBRID_PROOFREAD_CONFIG } from '@/config/hybridProofreadConfig'

const logger = getLogger()

function getFileType(filePath: string): FileType {
  if (filePath.endsWith('.gradle')) return 'gradle_dep'
  if (filePath.endsWith('.keystore') || filePath.endsWith('.jks')) return 'keystore'
  if (filePath.startsWith('.env') || filePath.includes('.env.')) return 'env_file'
  if (filePath.match(/\.(ts|tsx|js|jsx|vue|java|kotlin|swift|py)$/)) return 'source_code'
  if (filePath.match(/\.(json|xml|yaml|yml|toml|ini)$/)) return 'config_file'
  if (filePath.match(/\.(apk|ipa|dylib|so|dll|exe)$/)) return 'binary'
  return 'other'
}

function matchesPattern(filePath: string, pattern: string): boolean {
  const regex = safeRegex(pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'))
  return regex.test(filePath)
}

export interface ScanOptions {
  projectId: string
  projectPath: string
  includes?: string[]
  excludes?: string[]
  maxConcurrentFiles?: number
}

function isPathExcluded(relativePath: string, excludes: string[]): boolean {
  return excludes.some((pattern) => matchesPattern(relativePath, pattern))
}

function isPathIncluded(relativePath: string, includes: string[]): boolean {
  return includes.some((pattern) => matchesPattern(relativePath, pattern))
}

async function collectFileIfIncluded(
  fullPath: string,
  relativePath: string,
  includes: string[],
  results: string[],
): Promise<void> {
  if (!isPathIncluded(relativePath, includes)) return
  const fs = await import('fs')
  const stats = await fs.promises.stat(fullPath)
  if (stats.size <= HYBRID_PROOFREAD_CONFIG.hash.maxFileSizeBytes) {
    results.push(fullPath)
  }
}

/**
 * LocalCollector
 */
export class LocalCollector {
  private abortController: AbortController | null = null
  private isRunning = false

  async scan(options: ScanOptions): Promise<LocalScanResult> {
    this.abortController = new AbortController()
    this.isRunning = true

    const { projectId, projectPath, includes, excludes, maxConcurrentFiles } = options
    const effectiveExcludes: string[] = excludes ? [...excludes] : [...HYBRID_PROOFREAD_CONFIG.scanning.defaultExcludes]
    const effectiveIncludes: string[] = includes ? [...includes] : [...HYBRID_PROOFREAD_CONFIG.scanning.defaultIncludes]
    const concurrency = maxConcurrentFiles ?? HYBRID_PROOFREAD_CONFIG.scanning.maxConcurrentFiles

    logger.info(`[LocalCollector] 开始扫描项目: ${projectId}`)

    const files = await this.collectFiles(projectPath, effectiveIncludes, effectiveExcludes)
    logger.info(`[LocalCollector] 发现 ${files.length} 个文件`)

    const hashes: FileHash[] = []
    const scannedFiles: number[] = []
    const skippedFiles: number[] = []

    const batches: string[][] = []
    for (let i = 0; i < files.length; i += concurrency) {
      batches.push(files.slice(i, i + concurrency))
    }

    for (const batch of batches) {
      if (this.abortController?.signal.aborted) {
        logger.warn('[LocalCollector] 扫描已取消')
        break
      }

      const batchResults = await Promise.all(
        batch.map(async (filePath) => {
          try {
            const fileHash = await this.computeFileHash(filePath, projectId)
            scannedFiles.push(1)
            return fileHash
          } catch (error) {
            logger.warn(`[LocalCollector] 跳过文件 ${filePath}: ${String(error)}`)
            skippedFiles.push(1)
            return null
          }
        }),
      )

      hashes.push(...batchResults.filter((h): h is FileHash => h !== null))
    }

    this.isRunning = false

    logger.info(`[LocalCollector] 扫描完成: 总数=${files.length}, 成功=${scannedFiles.length}, 跳过=${skippedFiles.length}`)

    return {
      project_id: projectId,
      scan_time: Date.now(),
      total_files: files.length,
      scanned_files: scannedFiles.length,
      skipped_files: skippedFiles.length,
      rule_matches: [],
      hashes,
    }
  }

  async collectFiles(
    basePath: string,
    includes: string[],
    excludes: string[],
  ): Promise<string[]> {
    const results: string[] = []
    const abortControllerRef = this.abortController

    async function handleEntry(
      entry: import('fs').Dirent,
      dir: string,
      relativeDir: string,
    ): Promise<void> {
      const relativePath = relativeDir ? `${relativeDir}/${entry.name}` : entry.name
      if (isPathExcluded(relativePath, excludes)) return

      const fullPath = `${dir}/${entry.name}`
      if (entry.isDirectory()) {
        if (!abortControllerRef?.signal.aborted) {
          await traverse(fullPath, relativePath)
        }
        return
      }
      if (entry.isFile()) {
        await collectFileIfIncluded(fullPath, relativePath, includes, results)
      }
    }

    async function traverse(dir: string, relativeDir: string): Promise<void> {
      if (abortControllerRef?.signal.aborted) return

      try {
        const fs = await import('fs')
        const entries = await fs.promises.readdir(dir, { withFileTypes: true })

        for (const entry of entries) {
          await handleEntry(entry, dir, relativeDir)
        }
      } catch {
        logger.warn(`[LocalCollector] 读取目录失败: ${dir}`)
      }
    }

    await traverse(basePath, '')
    return results
  }

  async computeFileHash(filePath: string, projectId: string): Promise<FileHash> {
    const fs = await import('fs')
    const crypto = await import('crypto')

    const content = await fs.promises.readFile(filePath)
    const hash = crypto.createHash(HYBRID_PROOFREAD_CONFIG.hash.algorithm)
      .update(content)
      .digest('hex')

    const stats = await fs.promises.stat(filePath)

    return {
      file_hash: hash,
      file_type: getFileType(filePath),
      file_path: filePath,
      project_id: projectId,
      last_modified: stats.mtime.getTime(),
      size_bytes: stats.size,
    }
  }

  cancel(): void {
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
      this.isRunning = false
      logger.info('[LocalCollector] 扫描任务已取消')
    }
  }

  getIsRunning(): boolean {
    return this.isRunning
  }
}

/**
 * localCollector
 */
export const localCollector = new LocalCollector()