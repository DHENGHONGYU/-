/**
 * @fileoverview 代码与脚本检索器
 *
 * 检索项目中与数据采集、同步、文件导入相关的代码文件和脚本，
 * 便于追溯采集与更新历史的设计实现。
 *
 * 注意：浏览器环境无法直接读取文件系统，本检索器操作的是预加载的文件索引。
 * 在 Node.js 环境（如 MCP Server）中可直接读取文件系统。
 *
 * @module services/data-sync-search/codeSearcher
 * @created 2026-07-14 - 双通道整改 P2-2
  * @doc [V9-DOC-BACK-012, V9-DOC-BACK-023, V9-DOC-BACK-033, V9-DOC-BACK-021, V9-DOC-BACK-026]
*/

import { getLogger } from '@/lib/logger'
import type { SearchCriteria, SearchItem } from '@/types/modules/data-sync.types'

const logger = getLogger()

/** 代码文件索引项 */
export interface CodeFileIndex {
  path: string
  fileName: string
  content: string
  lastModified: string
  type: 'code' | 'script' | 'config' | 'doc'
}

/**
 * 检索代码与脚本文件
 *
 * @param criteria - 检索条件
 * @param index - 预加载的代码文件索引
 * @returns 检索结果项数组
 */
export function searchCode(
  criteria: SearchCriteria,
  index: readonly CodeFileIndex[],
): SearchItem[] {
  let filtered = [...index]

  // 关键词搜索（文件名 + 内容）
  if (criteria.keyword) {
    const kw = criteria.keyword.toLowerCase()
    filtered = filtered.filter(f =>
      f.fileName.toLowerCase().includes(kw) ||
      f.path.toLowerCase().includes(kw) ||
      f.content.toLowerCase().includes(kw),
    )
  }

  // 文件类型筛选（按扩展名）
  if (criteria.fileTypes?.length) {
    filtered = filtered.filter(f => {
      const ext = f.fileName.split('.').pop()?.toLowerCase() ?? ''
      return ext && criteria.fileTypes!.includes(ext)
    })
  }

  // 时间范围
  if (criteria.dateRange?.start) {
    filtered = filtered.filter(f => f.lastModified >= criteria.dateRange!.start!)
  }
  if (criteria.dateRange?.end) {
    filtered = filtered.filter(f => f.lastModified <= criteria.dateRange!.end!)
  }

  // 排序
  const sortOrder = criteria.sortOrder ?? 'desc'
  filtered.sort((a, b) => {
    const cmp = a.lastModified.localeCompare(b.lastModified)
    return sortOrder === 'asc' ? cmp : -cmp
  })

  // 分页
  const page = criteria.page ?? 1
  const pageSize = criteria.pageSize ?? 20
  const offset = (page - 1) * pageSize
  const paged = filtered.slice(offset, offset + pageSize)

  logger.info('[searchCode] 代码检索完成', {
    total: index.length,
    filtered: filtered.length,
    returned: paged.length,
  })

  return paged.map(toSearchItem)
}

/**
 * 将代码文件转换为检索结果项
 */
function toSearchItem(file: CodeFileIndex): SearchItem {
  // 提取关键词附近片段
  let snippet = ''
  if (file.content.length > 0) {
    snippet = file.content.slice(0, 200) + (file.content.length > 200 ? '...' : '')
  }

  return {
    source: file.type === 'script' ? 'script-file' : 'code-file',
    id: file.path,
    timestamp: file.lastModified,
    title: file.fileName,
    snippet,
    details: {
      path: file.path,
      type: file.type,
      contentLength: file.content.length,
    },
  }
}

/**
 * 默认代码文件索引（双通道相关文件路径）
 *
 * 用于在浏览器环境提供基本的代码检索能力。
 * 完整文件系统检索需在 Node.js 环境执行。
 */
export const DEFAULT_CODE_INDEX: readonly CodeFileIndex[] = [
  {
    path: 'src/services/file-import/unifiedFileValidator.ts',
    fileName: 'unifiedFileValidator.ts',
    content: '统一文件校验中间件：扩展名/大小/MIME/签名/编码/哈希',
    lastModified: '2026-07-14T22:10:00Z',
    type: 'code',
  },
  {
    path: 'src/services/file-import/parserRegistry.ts',
    fileName: 'parserRegistry.ts',
    content: '文件解析器注册表：注册/查询/分发/自动选择',
    lastModified: '2026-07-14T22:12:00Z',
    type: 'code',
  },
  {
    path: 'src/services/file-import/diffAnalyzer.ts',
    fileName: 'diffAnalyzer.ts',
    content: '差异分析引擎：新增/修改/冲突/删除/字段级 diff',
    lastModified: '2026-07-14T22:17:00Z',
    type: 'code',
  },
  {
    path: 'src/services/data-sync/globalScheduler.ts',
    fileName: 'globalScheduler.ts',
    content: '全局采集调度引擎：cron-like/交易时段感知/熔断',
    lastModified: '2026-07-14T22:25:00Z',
    type: 'code',
  },
  {
    path: 'src/services/data-sync/conflictResolver.ts',
    fileName: 'conflictResolver.ts',
    content: '冲突解决器：6种策略/字段级合并/批量解决',
    lastModified: '2026-07-14T22:26:00Z',
    type: 'code',
  },
  {
    path: 'src/services/data-sync/stalenessDetector.ts',
    fileName: 'stalenessDetector.ts',
    content: '过期检测器：8维度阈值/严重度/可自动采集判断',
    lastModified: '2026-07-14T22:27:00Z',
    type: 'code',
  },
  {
    path: 'src/services/data-sync/updateExecutor.ts',
    fileName: 'updateExecutor.ts',
    content: '更新执行器：batch/incremental/自动模式选择',
    lastModified: '2026-07-14T22:28:00Z',
    type: 'code',
  },
  {
    path: 'src/types/modules/data-sync.types.ts',
    fileName: 'data-sync.types.ts',
    content: '双通道数据采集与更新类型定义',
    lastModified: '2026-07-14T22:10:00Z',
    type: 'code',
  },
  {
    path: 'src/config/dbConfig.ts',
    fileName: 'dbConfig.ts',
    content: 'DB配置：STORE_NAME + DB_VERSION=31',
    lastModified: '2026-07-14T22:55:00Z',
    type: 'config',
  },
  {
    path: 'src/data/db-schema.ts',
    fileName: 'db-schema.ts',
    content: 'IndexedDB Schema 定义：27+5 store 创建逻辑',
    lastModified: '2026-07-14T22:55:00Z',
    type: 'code',
  },
  {
    path: 'outputs/双通道数据采集与更新策略设计.md',
    fileName: '双通道数据采集与更新策略设计.md',
    content: '双通道架构设计文档：8章节完整设计',
    lastModified: '2026-07-14T21:30:00Z',
    type: 'doc',
  },
  {
    path: 'outputs/整改总结报告与审计日志.md',
    fileName: '整改总结报告与审计日志.md',
    content: '整改总结：17文件/4613行/65测试/0错误',
    lastModified: '2026-07-14T22:50:00Z',
    type: 'doc',
  },
]
