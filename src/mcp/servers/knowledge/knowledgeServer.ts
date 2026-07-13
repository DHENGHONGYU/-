/**
 * @module mcp/servers/knowledge
 * @description 本地知识库 MCP Server — 语义检索与知识问答
 * @created 2026-07-13
 */

import { MCPServerBase } from '@/mcp/core/server'
import type { ServerInfo, ToolDescriptor } from '@/types/modules/mcp.types'
import { getLogger } from '@/lib/logger'
import { searchLocalDocs } from '@/services/system/localDocService'
import { embedText, findTopK } from '@/services/system/localEmbeddingService'
import type { LocalDoc } from '@/data/types/types.knowledge'

const logger = getLogger()

/**
 * 对文档列表应用语义相似度排序（非 keyword 模式下）
 */
async function applySemanticRanking(docs: LocalDoc[], query: string, topK: number): Promise<void> {
  try {
    const queryEmbedding = await embedText(query)
    if (!queryEmbedding.success) return

    const candidates = docs
      .filter((d) => d.embedding && d.embedding.length > 0)
      .map((d) => ({ id: d.id, vector: d.embedding! }))

    if (candidates.length === 0) return

    const semanticHits = findTopK(queryEmbedding.vector, candidates, topK)
    docs.sort((a, b) => {
      const aSemantic = semanticHits.find((h) => h.id === a.id)?.score ?? 0
      const bSemantic = semanticHits.find((h) => h.id === b.id)?.score ?? 0
      return bSemantic - aSemantic
    })
  } catch (embedErr) {
    logger.warn('[KnowledgeServer] 语义检索失败，回退纯关键词', {
      error: embedErr instanceof Error ? embedErr.message : String(embedErr),
    })
  }
}

export class KnowledgeServer extends MCPServerBase {
  readonly info: ServerInfo = {
    name: 'knowledge',
    version: '1.0.0',
    description: '本地知识库检索 — 基于向量语义与关键词的研报/财报/笔记检索',
    dependencies: [],
  }

  protected getTools(): ToolDescriptor[] {
    return [
      {
        name: 'query_knowledge',
        description: '语义/关键词检索本地知识库，返回相关文档片段',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: '搜索关键词或自然语言查询' },
            symbol: { type: 'string', description: '按标的筛选（如 600519.SH，可选）' },
            topK: { type: 'number', description: '返回结果数（默认 5）' },
            mode: { type: 'string', enum: ['auto', 'semantic', 'keyword'], description: '搜索模式（默认 auto：语义+关键词混合）' },
          },
          required: ['query'],
        },
        handler: async (args) => {
          const query = args.query as string
          const symbol = args.symbol as string | undefined
          const topK = (args.topK as number) ?? 5
          const mode = (args.mode as string) ?? 'auto'

          logger.info('[KnowledgeServer] query_knowledge called', { query, symbol, topK, mode })

          try {
            // Step 1: 关键词搜索（始终执行，用作 baseline 和混合）
            const keywordResults = await searchLocalDocs(query)
            if (!keywordResults.success) {
              return { content: [{ type: 'text', text: `检索失败: ${keywordResults.error}` }], isError: true }
            }

            let docs = keywordResults.data ?? []

            // Step 2: 按标的筛选
            if (symbol && docs.length > 0) {
              docs = docs.filter((d) => d.symbol === symbol || d.symbol === 'ALL')
            }

            // Step 3: 语义增强（auto/semantic 模式下附加语义相似度排序）
            if (mode !== 'keyword' && docs.length > 0) {
              await applySemanticRanking(docs, query, topK)
            }

            // Step 4: 截取 topK
            const topDocs = (docs ?? []).slice(0, topK)

            // Step 5: 格式化为可读文本
            const formatted = topDocs.map((doc, i) => {
              const snippet = doc.content.length > 500
                ? doc.content.slice(0, 500) + '...'
                : doc.content
              return `[${i + 1}] ${doc.name}\n  标的: ${doc.symbol} | 类别: ${doc.category}\n  摘要: ${snippet}\n`
            }).join('\n')

            return {
              content: [{
                type: 'text',
                text: formatted || `未找到与 "${query}" 相关的知识文档。`,
              }],
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            logger.error('[KnowledgeServer] query_knowledge error', { error: msg })
            return { content: [{ type: 'text', text: `查询失败: ${msg}` }], isError: true }
          }
        },
      },
    ]
  }
}
