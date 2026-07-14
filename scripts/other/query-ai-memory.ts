import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * AI 记忆索引 CLI 查询工具。
 *
 * 用法：
 *   npx tsx scripts/query-ai-memory.ts <查询词> [--top 5]
 *
 * 示例：
 *   npx tsx scripts/query-ai-memory.ts "Widget 注册"
 *   npx tsx scripts/query-ai-memory.ts "颜色令牌" --top 3
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const INDEX_PATH = path.join(ROOT, 'public', 'ai-memory-index.json')

interface MemoryChunk {
  id: string
  file: string
  title: string
  headings: string[]
  content: string
  tokens: number
}

interface MemoryIndex {
  generatedAt: string
  version: string
  chunks: MemoryChunk[]
  keywords: Record<string, string[]>
}

function tokenize(text: string): string[] {
  const cleaned = text
    .toLowerCase()
    .replace(/[`\\[\\]{}|#*]/g, ' ')
    .replace(/[^\u4e00-\u9fa5a-z0-9\s]/g, ' ')
  return cleaned.split(/\s+/).filter((w) => w.length >= 2)
}

function query(index: MemoryIndex, queryText: string, topK: number): Array<{ chunk: MemoryChunk; score: number }> {
  const words = tokenize(queryText)
  const scores = new Map<string, number>()
  for (const word of words) {
    const ids = index.keywords[word]
    if (!ids) continue
    for (const id of ids) {
      scores.set(id, (scores.get(id) ?? 0) + 1)
    }
  }
  const chunkMap = new Map(index.chunks.map((c) => [c.id, c]))
  const results: Array<{ chunk: MemoryChunk; score: number }> = []
  for (const [id, score] of scores.entries()) {
    const chunk = chunkMap.get(id)
    if (chunk) results.push({ chunk, score })
  }
  return results.sort((a, b) => b.score - a.score).slice(0, topK)
}

function main(): void {
  const args = process.argv.slice(2)
  const topIndex = args.indexOf('--top')
  const topK = topIndex >= 0 ? Number(args[topIndex + 1]) || 5 : 5
  const queryText = args.filter((_, i) => i !== topIndex && i !== topIndex + 1).join(' ')

  if (!queryText) {
    console.error('用法：npx tsx scripts/query-ai-memory.ts <查询词> [--top 5]')
    process.exit(1)
  }

  if (!fs.existsSync(INDEX_PATH)) {
    console.error(`索引文件不存在：${INDEX_PATH}`)
    console.error('请先运行：npx tsx scripts/build-ai-memory-index.ts')
    process.exit(1)
  }

  const index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf-8')) as MemoryIndex
  const results = query(index, queryText, topK)

  console.log(`🔍 查询："${queryText}"`)
  console.log(`📚 索引版本：${index.version}，生成于 ${index.generatedAt}`)
  console.log(`✅ 找到 ${results.length} 条相关片段：\n`)

  for (const { chunk, score } of results) {
    console.log(`[score=${score}] ${chunk.file} > ${chunk.headings.join(' > ')}`)
    console.log(chunk.content.slice(0, 300).replace(/\n+/g, ' '))
    console.log('---')
  }
}

main()
