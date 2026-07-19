/**
 * 项目 AI 记忆服务。
 *
 * 从 `public/ai-memory-index.json` 加载索引，提供关键词检索能力，
 * 帮助 AI 辅助开发工具快速定位项目规范、检查清单与最佳实践。
  * @doc [V9-DOC-BACK-012, V9-DOC-BACK-023, V9-DOC-BACK-033, V9-DOC-BACK-021, V9-DOC-BACK-026]
*/

export interface MemoryChunk {
  id: string
  file: string
  title: string
  headings: string[]
  content: string
  tokens: number
}

export interface MemoryIndex {
  generatedAt: string
  version: string
  chunks: MemoryChunk[]
  keywords: Record<string, string[]>
}

export interface MemoryQueryResult {
  chunk: MemoryChunk
  score: number
}

const INDEX_URL = '/ai-memory-index.json'

let indexCache: MemoryIndex | null = null

/**
 * 加载项目 AI 记忆索引。
 *
 * @returns 解析后的记忆索引对象
 * @throws 当 fetch 失败或返回非 200 时抛出错误
 */
export async function loadMemoryIndex(): Promise<MemoryIndex> {
  if (indexCache) return indexCache
  const response = await fetch(INDEX_URL, { cache: 'no-cache' })
  if (!response.ok) {
    throw new Error(`加载 AI 记忆索引失败: ${response.status}`)
  }
  indexCache = (await response.json()) as MemoryIndex
  return indexCache
}

function tokenize(text: string): string[] {
  const cleaned = text
    .toLowerCase()
    .replace(/[`\\[\\]{}|#*]/g, ' ')
    .replace(/[^\u4e00-\u9fa5a-z0-9\s]/g, ' ')
  return cleaned.split(/\s+/).filter((w) => w.length >= 2)
}

/**
 * 根据关键词查询项目 AI 记忆索引。
 *
 * @param query - 查询关键词（支持中英文）
 * @param topK - 返回的最相关片段数量，默认 5
 * @returns 按匹配度排序的片段列表
 */
export async function queryMemory(query: string, topK = 5): Promise<MemoryQueryResult[]> {
  const index = await loadMemoryIndex()
  const queryWords = tokenize(query)
  if (queryWords.length === 0) return []

  const scores = new Map<string, number>()
  for (const word of queryWords) {
    const chunkIds = index.keywords[word]
    if (!chunkIds) continue
    for (const id of chunkIds) {
      scores.set(id, (scores.get(id) ?? 0) + 1)
    }
  }

  const chunkMap = new Map(index.chunks.map((c) => [c.id, c]))
  const results: MemoryQueryResult[] = []
  for (const [id, score] of scores.entries()) {
    const chunk = chunkMap.get(id)
    if (chunk) results.push({ chunk, score })
  }

  return results.sort((a, b) => b.score - a.score).slice(0, topK)
}
