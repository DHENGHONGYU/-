/**
 * @module mcp/core/roots
 * @description MCP Roots 管理器 — 客户端声明可访问的目录范围，Server 据此限制文件访问
 * @created 2026-07-04
 */

import type { RootDescriptor, ListRootsResult } from '@/types/modules/mcp.types'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

/** Roots 管理器 — 单例模式 */
export class RootsManager {
  private roots: RootDescriptor[] = []

  /** 设置允许访问的根目录列表 */
  setRoots(roots: RootDescriptor[]): void {
    this.roots = [...roots]
    logger.info('[RootsManager] Roots updated', { count: roots.length, roots: roots.map((r) => r.uri) })
  }

  /** 添加单个根目录 */
  addRoot(root: RootDescriptor): void {
    if (this.roots.some((r) => r.uri === root.uri)) {
      logger.info('[RootsManager] Root already exists, skipping', { uri: root.uri })
      return
    }
    this.roots.push(root)
    logger.info('[RootsManager] Root added', { uri: root.uri })
  }

  /** 移除单个根目录 */
  removeRoot(uri: string): boolean {
    const idx = this.roots.findIndex((r) => r.uri === uri)
    if (idx === -1) return false
    this.roots.splice(idx, 1)
    logger.info('[RootsManager] Root removed', { uri })
    return true
  }

  /** 列出所有根目录 */
  listRoots(): ListRootsResult {
    return { roots: [...this.roots] }
  }

  /** 检查 URI 是否在允许的根目录范围内 */
  isAllowed(uri: string): boolean {
    if (this.roots.length === 0) {
      return true
    }
    const allowed = this.roots.some((root) => uri.startsWith(root.uri))
    if (!allowed) {
      logger.info('[RootsManager] URI blocked', { uri })
    }
    return allowed
  }
}

export const rootsManager = new RootsManager()