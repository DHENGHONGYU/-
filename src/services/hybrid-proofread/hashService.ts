import { getLogger } from '@/lib/logger'
import type { FileHash, FileType, HashVerifyRequest, HashVerifyResponse, HashBatchVerifyRequest, HashBatchVerifyResponse } from '@/data/types'
import { HYBRID_PROOFREAD_CONFIG } from '@/config/hybridProofreadConfig'

const logger = getLogger()

/**
 * HashService
 */
export class HashService {
  async computeHash(data: string | Buffer): Promise<string> {
    const crypto = await import('crypto')
    const hash = crypto.createHash(HYBRID_PROOFREAD_CONFIG.hash.algorithm)
      .update(data)
      .digest('hex')
    return hash
  }

  async computeFileHash(filePath: string): Promise<string> {
    const fs = await import('fs')
    const content = await fs.promises.readFile(filePath)
    return this.computeHash(content)
  }

  async computeMultipleHashes(filePaths: string[]): Promise<FileHash[]> {
    const results: FileHash[] = []
    const fs = await import('fs')

    for (const filePath of filePaths) {
      try {
        const content = await fs.promises.readFile(filePath)
        const hash = await this.computeHash(content)
        const stats = await fs.promises.stat(filePath)

        results.push({
          file_hash: hash,
          file_type: this.getFileType(filePath),
          file_path: filePath,
          project_id: '',
          last_modified: stats.mtime.getTime(),
          size_bytes: stats.size,
        })
      } catch (error) {
        logger.warn(`[HashService] 计算哈希失败: ${filePath}`, { error })
      }
    }

    return results
  }

  async batchComputeHashes(filePaths: string[], projectId: string, batchSize?: number): Promise<FileHash[]> {
    const effectiveBatchSize = batchSize ?? HYBRID_PROOFREAD_CONFIG.hash.batchSize
    const results: FileHash[] = []

    for (let i = 0; i < filePaths.length; i += effectiveBatchSize) {
      const batch = filePaths.slice(i, i + effectiveBatchSize)
      const batchResults = await this.computeMultipleHashes(batch)
      results.push(
        ...batchResults.map((h) => ({ ...h, project_id: projectId })),
      )
    }

    return results
  }

  async verifyHash(request: HashVerifyRequest): Promise<HashVerifyResponse> {
    logger.info(`[HashService] 验证哈希: ${request.file_hash}`)

    return {
      status: 'unknown',
      risk_level: 0,
    }
  }

  async batchVerifyHashes(request: HashBatchVerifyRequest): Promise<HashBatchVerifyResponse> {
    logger.info(`[HashService] 批量验证哈希: ${request.hash_list.length} 个`)

    const results: Record<string, HashVerifyResponse> = {}

    for (const hash of request.hash_list) {
      results[hash] = {
        status: 'unknown',
        risk_level: 0,
      }
    }

    return { results }
  }

  private getFileType(filePath: string): FileType {
    if (filePath.endsWith('.gradle')) return 'gradle_dep'
    if (filePath.endsWith('.keystore') || filePath.endsWith('.jks')) return 'keystore'
    if (filePath.startsWith('.env') || filePath.includes('.env.')) return 'env_file'
    if (filePath.match(/\.(ts|tsx|js|jsx|vue|java|kotlin|swift|py)$/)) return 'source_code'
    if (filePath.match(/\.(json|xml|yaml|yml|toml|ini)$/)) return 'config_file'
    if (filePath.match(/\.(apk|ipa|dylib|so|dll|exe)$/)) return 'binary'
    return 'other'
  }

  isValidHash(hash: string): boolean {
    const expectedLength = HYBRID_PROOFREAD_CONFIG.hash.algorithm === 'sha256' ? 64 : 40
    return hash.length === expectedLength && /^[0-9a-fA-F]+$/.test(hash)
  }
}

/**
 * hashService
 */
export const hashService = new HashService()