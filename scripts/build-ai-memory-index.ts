import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * 构建项目 AI 记忆索引。
 *
 * 扫描 AGENTS.md 等关键文档，按标题层级切分片段，
 * 建立关键词 → 文档片段的倒排索引，供 AI 辅助开发时快速检索项目上下文。
 *
 * 输出：public/ai-memory-index.json
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT_PATH = path.join(ROOT, 'public', 'ai-memory-index.json')

interface DocChunk {
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
  chunks: DocChunk[]
  keywords: Record<string, string[]>
}

const SOURCE_FILES = [
  'AGENTS.md',
  // 以下文档已归档至 archive/historical-2026-08-16/batch7/
  // 'docs/reference/design-token-mapping.md',
  // 'docs/reference/ui-migration-checklist.md',
  // '../docs/reference/widget-integration-checklist.md',
  // 'docs/reference/jsdoc-convention.md',
  // '../docs/reference/complexity-governance.md',
  // '../docs/guides/testing-strategy.md',
  // 以下文档已归档至 archive/historical-2026-08-16/batch7/
  'prompts/system-prompt-template.md',
  'prompts/component-prompt-template.md',
  'prompts/service-prompt-template.md',
  'prompts/store-prompt-template.md',
  'prompts/types-prompt-template.md',
]

function estimateTokens(text: string): number {
  // 粗略估算：中文字符 + 英文单词
  return Math.ceil(text.length / 2)
}

function extractChunks(filePath: string): DocChunk[] {
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')
  const relativeFile = path.relative(ROOT, filePath).replace(/\\/g, '/')
  const chunks: DocChunk[] = []
  let current: { headings: string[]; lines: string[] } | null = null

  function flush(): void {
    if (!current) return
    const text = current.lines.join('\n').trim()
    if (!text) return
    const title = current.headings[current.headings.length - 1] ?? relativeFile
    const id = `${relativeFile}#${chunks.length}`
    chunks.push({
      id,
      file: relativeFile,
      title,
      headings: [...current.headings],
      content: text,
      tokens: estimateTokens(text),
    })
  }

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,4})\s+(.+)$/)
    if (headingMatch) {
      flush()
      const level = headingMatch[1].length
      const title = headingMatch[2].trim()
      current = {
        headings: current ? current.headings.slice(0, level - 1).concat(title) : [title],
        lines: [line],
      }
    } else if (current) {
      current.lines.push(line)
    }
  }
  flush()

  return chunks
}

function tokenize(text: string): string[] {
  const tokens = new Set<string>()
  // 中文分词：按字/词简单提取；英文按非字母数字切分
  const cleaned = text
    .toLowerCase()
    .replace(/[`\\[\\]{}|#*]/g, ' ')
    .replace(/[^\u4e00-\u9fa5a-z0-9\s]/g, ' ')
  const words = cleaned.split(/\s+/).filter((w) => w.length >= 2)
  for (const w of words) {
    tokens.add(w)
  }
  return [...tokens]
}

function buildKeywordIndex(chunks: DocChunk[]): Record<string, string[]> {
  const index: Record<string, string[]> = {}
  for (const chunk of chunks) {
    const text = `${chunk.title} ${chunk.content} ${chunk.file}`
    const words = tokenize(text)
    for (const word of words) {
      if (!index[word]) index[word] = []
      if (!index[word].includes(chunk.id)) index[word].push(chunk.id)
    }
  }
  return index
}

function main(): void {
  const chunks: DocChunk[] = []
  for (const file of SOURCE_FILES) {
    const fullPath = path.join(ROOT, file)
    if (!fs.existsSync(fullPath)) {
      console.warn(`⚠️ 文件不存在，跳过：${file}`)
      continue
    }
    chunks.push(...extractChunks(fullPath))
  }

  const index: MemoryIndex = {
    generatedAt: new Date().toISOString(),
    version: '1.0.0',
    chunks,
    keywords: buildKeywordIndex(chunks),
  }

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true })
  fs.writeFileSync(OUT_PATH, JSON.stringify(index, null, 2), 'utf-8')

  console.log(`✅ AI 记忆索引已生成：${OUT_PATH}`)
  console.log(`   片段数：${chunks.length}`)
  console.log(`   关键词：${Object.keys(index.keywords).length}`)
  console.log(`   总 Token 数：${chunks.reduce((sum, c) => sum + c.tokens, 0)}`)
}

main()
