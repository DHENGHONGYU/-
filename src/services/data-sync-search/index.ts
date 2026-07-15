/**
 * @fileoverview 数据同步检索服务 barrel export
 *
 * @module services/data-sync-search
 * @created 2026-07-14 - 双通道整改 P2-2
 */

// 多源检索引擎
export { search, quickSearch } from './searchEngine'
export type { SearchEngineConfig } from './searchEngine'

// 历史记录检索器
export { searchHistory, computeHistoryFacets } from './historySearcher'

// 文档检索器
export { searchDocs, computeDocFacets } from './docSearcher'

// 代码检索器
export { searchCode, DEFAULT_CODE_INDEX } from './codeSearcher'
export type { CodeFileIndex } from './codeSearcher'

// 语义搜索器（TF-IDF 轻量方案）
export { semanticSearcher, semanticSearch } from './semanticSearcher'
