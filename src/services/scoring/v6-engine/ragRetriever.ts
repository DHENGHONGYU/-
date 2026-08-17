/**
 * ragRetriever — RAG 检索服务（深度版）
 *
 * 为 V6 评分引擎的 LLM 增强层提供语义上下文检索。
 * 在评分时，根据当前股票和评分层，从向量数据库中
 * 定向检索最相关的研报/公告/新闻片段，注入 LLM prompt。
 *
 * === 核心能力 ===
 *
 * 1. 数据归集分类（Namespace-based Indexing）
 *    - 按个股 symbol 建立独立 HNSW 子索引
 *    - 按行业 sector 建立独立 HNSW 子索引
 *    - 全局索引作为兜底跨行业检索
 *    - 元数据注册表（MetadataRegistry）维护完整分类信息
 *
 * 2. 数据清洗与标签化（Cleaning & Labeling Pipeline）
 *    - cleanContent(): HTML 剥离、空白归一化、公告模板去噪、长度截断
 *    - extractLabels(): 从 ProfileItem 提取结构化标签（领域/情绪/质量/主题/风险）
 *    - buildEmbeddingText(): 构建含标签的优化嵌入文本
 *
 * 3. 定向扫描（Targeted Retrieval）
 *    - Tier 1: 同股票检索（same symbol）→ 最高相关性
 *    - Tier 2: 同行业检索（same sector）→ 行业对标上下文
 *    - Tier 3: 跨行业检索（global）→ 补充参考
 *    - 每层独立相似度阈值，避免噪声
 *
 * 4. 缺失数据预警（Missing Data Detection）
 *    - 检索前检查个股资料覆盖度
 *    - 资料类型缺失（无研报/无公告/无新闻）→ 通过 eventBus 发出预警
 *    - 覆盖度不足（总数 < 阈值）→ 触发数据补充建议
 *
 * 依赖：
 *   - localEmbeddingService (bge-base-zh-v1.5, 768d)
 *   - HNSWIndex (内存纯 JS 实现)
 *   - profile_items store (IndexedDB)
 *   - eventBus (缺失数据预警)
  * @doc [V9-DOC-BACK-012, V9-DOC-BACK-023, V9-DOC-BACK-033]
*/

import { getLogger } from '@/lib/logger'
import { embedText } from '@/services/system/localEmbeddingService'
import { HNSWIndex } from '@/services/storage/hnswIndex'
import { queryGet, queryList } from '@/data/dataLayerHelpers'
import { STORE_NAME } from '@/config/dbConfig'
import { eventBus } from '@/lib/eventBus'
import type { ProfileItem } from '@/data/types'
import type { LayerId } from '@/types/modules/engine.types'
import { DEFAULT_RAG_CONFIG } from './config'
import type { RAGConfig } from '@/types/modules/engine.types'

/** 嵌入向量维度 */
const EMBEDDING_DIM = 768
/** 文本块最大长度（字符数） */
const CHUNK_MAX_LENGTH = 1200

const logger = getLogger()

// ─── 类型 ────────────────────────────────────────────────────

/** RAG 检索的单个文档片段 */
export interface RAGSnippet {
  docId: string
  title: string
  content: string
  source: string
  publishedAt?: number
  similarity: number
  itemType: string
  domain: string
  sentiment: string
  qualityScore: number
}

/** RAG 检索返回的上下文 */
export interface RAGContext {
  snippets: RAGSnippet[]
  totalChars: number
  elapsedMs: number
  success: boolean
  /** 检索层级明细 */
  tierBreakdown: { tier: number; label: string; count: number }
  /** 缺失数据预警 */
  missingDataAlert?: MissingDataAlert
  error?: string
}

/** 缺失数据预警 */
export interface MissingDataAlert {
  symbol: string
  stockName: string
  severity: 'warning' | 'critical'
  message: string
  missingTypes: string[]
  totalDocuments: number
  recommendedAction: string
}

/** 文档元数据（索引注册表） */
interface DocMeta {
  id: string
  symbol: string
  sector: string
  itemType: string
  domain: string
  title: string
  source: string
  publishedAt?: number
  sentiment: string
  qualityScore: number
}

/** 文档清洁结果 */
interface CleanedDoc {
  /** 清洗后的内容 */
  content: string
  /** 清洗日志 */
  cleanLog: string[]
}

// ─── 层语义焦点映射 ──────────────────────────────────────────

const LAYER_FOCUS: Record<string, string> = {
  l0: '宏观经济 政策利率 地缘政治 市场情绪 系统性风险',
  l1: '护城河 竞争优势 品牌壁垒 技术壁垒 专利 市场份额 ROIC',
  l2: '竞争对手 行业格局 市占率 竞争策略 差异化 定价权',
  l4: '业绩预测 收入增长 利润指引 情景分析 风险因素 催化事件',
  l5: '管理层 公司治理 战略执行 股权激励 团队能力',
  l6: '行业周期 技术成熟度 市场热度 炒作风险 Gartner曲线',
  l7: '第二曲线 新业务 创新转型 0到1突破 多元化 并购',
}

// ─── 资料类型 → 资料类型中文映射 ──────────────────────────────

const ITEM_TYPE_LABELS: Record<string, string> = {
  research_report: '券商研报',
  notice: '公司公告',
  news: '新闻资讯',
  industry_report: '行业报告',
  financial_report: '财务报告',
  local_doc: '本地文档',
  community_post: '社区帖子',
  community: '社区帖子',
}

// ─── 覆盖度阈值 ──────────────────────────────────────────────

/** 个股最少文档数（低于此值触发预警） */
const MIN_DOCS_PER_STOCK = 3
/** 每种资料类型最少文档数（低于此值触发类型缺失预警） */
const MIN_DOCS_PER_TYPE = 1

// ============================================================
// 数据清洗管道
// ============================================================

/**
 * 清洗文档内容
 *
 * 处理步骤：
 * 1. 剥离 HTML 标签
 * 2. 归一化空白字符（多余换行/空格合并）
 * 3. 移除公告模板噪声（"本公司及董事会全体成员保证..."）
 * 4. 移除免责声明等尾部噪声
 * 5. 长度截断
 */
function cleanContent(raw: string, maxChars: number): CleanedDoc {
  const cleanLog: string[] = []
  let content = raw

  // Step 1: 剥离 HTML 标签
  const beforeHtml = content.length
  content = content
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, '')
  if (content.length < beforeHtml) {
    cleanLog.push(`HTML剥离: ${beforeHtml - content.length} 字符`)
  }

  // Step 2: 归一化空白字符
  const beforeBlank = content.length
  content = content
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/^\s+|\s+$/gm, '')
    .trim()
  if (content.length < beforeBlank) {
    cleanLog.push(`空白归一化: ${beforeBlank - content.length} 字符`)
  }

  // Step 3: 移除公告模板噪声
  const boilerplatePatterns = [
    /本公司及董事会全体成员保证信息披露[的内容]*真实[、，]准确[和与]完整[，。]没有虚假记载[、，]误导性陈述[或和]重大遗漏[。，]/g,
    /本公司及董事会全体成员保证公告内容[不存在任何]*虚假记载[、，]误导性陈述[或者和]重大遗漏[，。]/g,
    /本公司及全体董事[、，]监事[、，]高级管理人员保证[本]*公告内容[的真实性]*/g,
    /本公司董事会及全体董事保证本公告内容不存在任何虚假记载[、，]误导性陈述[或者和]重大遗漏[，。]/g,
    /重要内容提示[：:][\s\S]*?(?=\n\n|\n[一二三四五六七八九十])/g,
    /特别提示[：:][\s\S]*?风险提示[：:]/g,
    /证券代码[：:]\d{6}[\s\S]*?(?=\n\n)/g,
    /股票简称[：:]\S+[\s\S]*?(?=\n\n)/g,
  ]
  for (const pattern of boilerplatePatterns) {
    const before = content.length
    content = content.replace(pattern, '')
    if (content.length < before) {
      cleanLog.push(`模板噪声: ${pattern.source.slice(0, 30)}...`)
    }
  }

  // Step 4: 移除免责声明尾部噪声
  const disclaimerMarkers = [
    '\n免责声明',
    '\n风险提示',
    '\n【免责声明】',
    '\n【风险提示】',
    '\n特别声明',
    '\n本报告仅供',
    '\n免责条款',
  ]
  for (const marker of disclaimerMarkers) {
    const idx = content.indexOf(marker)
    if (idx > content.length * 0.5) {
      content = content.slice(0, idx).trim()
      cleanLog.push(`免责声明截断: 位置 ${idx}`)
      break
    }
  }

  // Step 5: 长度截断
  if (content.length > maxChars) {
    content = content.slice(0, maxChars)
    cleanLog.push(`长度截断: ${maxChars} 字符`)
  }

  return { content, cleanLog }
}

/**
 * 从 ProfileItem 提取结构化标签
 */
function extractLabels(item: ProfileItem): {
  sentiment: string
  qualityScore: number
  topicTags: string[]
  riskTags: string[]
  domain: string
} {
  return {
    sentiment: item.sentiment ?? 'neutral',
    qualityScore: item.qualityScore ?? 50,
    topicTags: item.topicTags ?? [],
    riskTags: item.riskTags ?? [],
    domain: item.domain ?? 'D0',
  }
}

/**
 * 构建嵌入文本（包含标签元数据，提升语义检索精度）
 *
 * 策略：标题 + 领域标签 + 主题标签 + 摘要 + 清洗后内容
 */
function buildEmbeddingText(item: ProfileItem, cleanedContent: string): string {
  const parts: string[] = []

  // 标题（最高权重，放最前面）
  parts.push(item.title)

  // 领域标签
  const domainLabel = item.domain ? `[领域:${item.domain}]` : ''
  if (domainLabel) parts.push(domainLabel)

  // 资料类型标签
  const typeLabel = ITEM_TYPE_LABELS[item.itemType] ?? item.itemType
  parts.push(`[${typeLabel}]`)

  // 主题标签
  if (item.topicTags && item.topicTags.length > 0) {
    parts.push(`[标签:${item.topicTags.slice(0, 5).join(',')}]`)
  }

  // 情绪标签
  if (item.sentiment && item.sentiment !== 'neutral') {
    parts.push(`[情绪:${item.sentiment}]`)
  }

  // 摘要
  if (item.summary) {
    parts.push(item.summary.slice(0, 300))
  }

  // 清洗后内容（前 1200 字符）
  parts.push(cleanedContent.slice(0, CHUNK_MAX_LENGTH))

  return parts.join('\n')
}

// ============================================================
// RAG 检索器（深度版）
// ============================================================

export class RAGRetriever {
  /** 全局 HNSW 索引（跨行业兜底） */
  private globalIndex: HNSWIndex | null = null
  /** 按个股 symbol 拆分的 HNSW 子索引 */
  private stockIndices: Map<string, HNSWIndex> = new Map()
  /** 按行业 sector 拆分的 HNSW 子索引 */
  private sectorIndices: Map<string, HNSWIndex> = new Map()
  /** 元数据注册表 */
  private registry: Map<string, DocMeta> = new Map()
  /** 索引构建状态 */
  private indexReady = false
  private indexBuilding = false
  private buildPromise: Promise<void> | null = null
  /** 配置 */
  private config: RAGConfig = DEFAULT_RAG_CONFIG

  configure(config: Partial<RAGConfig>): void {
    this.config = { ...this.config, ...config }
    logger.info('[RAGRetriever] 配置已更新', { ...this.config })
  }

  isEnabled(): boolean { return this.config.enabled }
  isReady(): boolean { return this.indexReady }

  /**
   * 初始化 RAG 索引
   *
   * 从 profile_items 加载所有有 content 且类型匹配的条目，
   * 执行清洗→标签化→嵌入，构建三层索引（个股/行业/全局）。
   */
  async initialize(): Promise<void> {
    if (this.indexReady) return
    if (this.indexBuilding && this.buildPromise) {
      logger.info('[RAGRetriever] 索引构建中，等待完成...')
      await this.buildPromise
      return
    }
    this.indexBuilding = true
    this.buildPromise = this.buildIndex()
    try { await this.buildPromise } finally {
      this.indexBuilding = false
      this.buildPromise = null
    }
  }

  private async buildIndex(): Promise<void> {
    const startTime = performance.now()
    logger.info('[RAGRetriever] 开始构建 RAG 索引...')

    try {
      const allItems = await queryList<ProfileItem>(STORE_NAME.profileItems)
      const validItems = allItems.filter(
        (item) =>
          item.content &&
          item.content.length > 50 &&
          this.config.itemTypes.includes(item.itemType),
      )

      if (validItems.length === 0) {
        logger.info('[RAGRetriever] 无可索引条目，跳过索引构建')
        this.indexReady = true
        return
      }

      logger.info(`[RAGRetriever] 加载 ${validItems.length} 个可索引条目，开始清洗与嵌入...`)

      // 按分类归集
      const stockGroups = new Map<string, ProfileItem[]>()
      const sectorGroups = new Map<string, ProfileItem[]>()
      const allEntries: Array<{ id: string; vector: number[] }> = []

      for (const item of validItems) {
        // 归集到个股分组
        const stockKey = item.symbol
        if (!stockGroups.has(stockKey)) stockGroups.set(stockKey, [])
        stockGroups.get(stockKey)!.push(item)

        // 归集到行业分组（使用 relatedLayers 或 domain 推断）
        const sector = this.inferSector(item)
        if (sector) {
          if (!sectorGroups.has(sector)) sectorGroups.set(sector, [])
          sectorGroups.get(sector)!.push(item)
        }
      }

      // 逐条清洗、标签化、嵌入
      let successCount = 0
      let failCount = 0
      const dim = 768 // bge-base-zh-v1.5

      // 初始化全局索引
      this.globalIndex = new HNSWIndex('cosine', dim)
      this.globalIndex.initIndex(Math.max(10000, validItems.length * 2), {
        M: 16, efConstruction: 200,
      })
      this.globalIndex.setEf(64)

      for (const item of validItems) {
        // 清洗
        const cleaned = cleanContent(item.content!, this.config.maxChunkChars)
        // 标签化
        const labels = extractLabels(item)
        // 构建嵌入文本
        const embedText_ = buildEmbeddingText(item, cleaned.content)

        const result = await embedText(embedText_)
        if (!result.success) {
          failCount++
          logger.warn('[RAGRetriever] 嵌入失败', { itemId: item.id, error: result.error })
          continue
        }

        // 注册元数据
        const meta: DocMeta = {
          id: item.id,
          symbol: item.symbol,
          sector: this.inferSector(item) ?? '未知',
          itemType: item.itemType,
          domain: labels.domain,
          title: item.title,
          source: item.source,
          publishedAt: item.publishedAt,
          sentiment: labels.sentiment,
          qualityScore: labels.qualityScore,
        }
        this.registry.set(item.id, meta)

        // 添加到全局索引
        allEntries.push({ id: item.id, vector: result.vector })
        successCount++
      }

      // 构建全局索引
      if (allEntries.length > 0) {
        const vectors = allEntries.map((e) => e.vector)
        const ids = allEntries.map((e) => e.id)
        this.globalIndex.addItems(vectors, ids)
      }

      // 构建个股子索引
      for (const [symbol, items] of stockGroups) {
        const stockIndex = new HNSWIndex('cosine', dim)
        stockIndex.initIndex(Math.max(100, items.length * 2), { M: 16, efConstruction: 200 })
        stockIndex.setEf(32)

        const entries = items
          .map((item) => allEntries.find((e) => e.id === item.id))
          .filter((e): e is { id: string; vector: number[] } => !!e)

        if (entries.length > 0) {
          stockIndex.addItems(
            entries.map((e) => e.vector),
            entries.map((e) => e.id),
          )
          this.stockIndices.set(symbol, stockIndex)
        }
      }

      // 构建行业子索引
      for (const [sector, items] of sectorGroups) {
        const sectorIndex = new HNSWIndex('cosine', dim)
        sectorIndex.initIndex(Math.max(100, items.length * 2), { M: 16, efConstruction: 200 })
        sectorIndex.setEf(32)

        const entries = items
          .map((item) => allEntries.find((e) => e.id === item.id))
          .filter((e): e is { id: string; vector: number[] } => !!e)

        if (entries.length > 0) {
          sectorIndex.addItems(
            entries.map((e) => e.vector),
            entries.map((e) => e.id),
          )
          this.sectorIndices.set(sector, sectorIndex)
        }
      }

      this.indexReady = true
      const elapsed = ((performance.now() - startTime) / 1000).toFixed(1)
      logger.info(
        `[RAGRetriever] 索引构建完成: ${successCount} 条 | ` +
        `个股索引: ${this.stockIndices.size} 个 | 行业索引: ${this.sectorIndices.size} 个 | 耗时 ${elapsed}s`,
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      logger.error('[RAGRetriever] 索引构建失败', { error: msg })
      this.indexReady = true
    }
  }

  /**
   * 增量添加文档到索引
   */
  async addDocument(item: ProfileItem): Promise<void> {
    if (!this.indexReady || !this.globalIndex) return
    if (!item.content || item.content.length < 50) return
    if (!this.config.itemTypes.includes(item.itemType)) return

    try {
      const cleaned = cleanContent(item.content!, this.config.maxChunkChars)
      const labels = extractLabels(item)
      const embedText_ = buildEmbeddingText(item, cleaned.content)

      const result = await embedText(embedText_)
      if (!result.success) return

      // 注册元数据
      const sector = this.inferSector(item) ?? '未知'
      const meta: DocMeta = {
        id: item.id,
        symbol: item.symbol,
        sector,
        itemType: item.itemType,
        domain: labels.domain,
        title: item.title,
        source: item.source,
        publishedAt: item.publishedAt,
        sentiment: labels.sentiment,
        qualityScore: labels.qualityScore,
      }
      this.registry.set(item.id, meta)

      // 更新三层索引
      this.globalIndex.addItems([result.vector], [item.id])

      // 个股索引
      if (!this.stockIndices.has(item.symbol)) {
        const idx = new HNSWIndex('cosine', EMBEDDING_DIM)
        idx.initIndex(100, { M: 16, efConstruction: 200 })
        idx.setEf(32)
        this.stockIndices.set(item.symbol, idx)
      }
      this.stockIndices.get(item.symbol)!.addItems([result.vector], [item.id])

      // 行业索引
      if (sector !== '未知') {
        if (!this.sectorIndices.has(sector)) {
          const idx = new HNSWIndex('cosine', EMBEDDING_DIM)
          idx.initIndex(100, { M: 16, efConstruction: 200 })
          idx.setEf(32)
          this.sectorIndices.set(sector, idx)
        }
        this.sectorIndices.get(sector)!.addItems([result.vector], [item.id])
      }

      logger.info('[RAGRetriever] 文档已添加到索引', { itemId: item.id, symbol: item.symbol, sector })
    } catch (err) {
      logger.warn('[RAGRetriever] 添加文档失败', {
        itemId: item.id,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  /**
   * 从索引中移除文档
   */
  removeDocument(id: string): void {
    const meta = this.registry.get(id)
    this.registry.delete(id)
    this.globalIndex?.markDeleted(id)
    if (meta) {
      this.stockIndices.get(meta.symbol)?.markDeleted(id)
      this.sectorIndices.get(meta.sector)?.markDeleted(id)
    }
  }

  /**
   * 定向扫描检索（三层级）
   *
   * Tier 1: 同股票检索（same symbol）→ 相似度阈值 0.30
   * Tier 2: 同行业检索（same sector）→ 相似度阈值 0.35
   * Tier 3: 跨行业检索（global）→ 相似度阈值 0.40
   *
   * 每层分配 topK 配额，Tier 1 优先。
   */
  async retrieve(
    symbol: string,
    stockName: string,
    sector: string | undefined,
    layerId: LayerId,
    layerName: string,
    baseSummary: string,
  ): Promise<RAGContext> {
    const startTime = performance.now()

    // 未启用或索引未就绪 → 返回空上下文
    if (!this.config.enabled || !this.globalIndex || this.globalIndex.getCurrentCount() === 0) {
      return {
        snippets: [],
        totalChars: 0,
        elapsedMs: 0,
        success: true,
        tierBreakdown: { tier: 0, label: '未启用', count: 0 },
        error: this.config.enabled ? '索引为空' : 'RAG 未启用',
      }
    }

    // ── 缺失数据检测 ──
    const missingAlert = this.detectMissingData(symbol, stockName, sector)

    try {
      // 1. 构建查询文本
      const queryText = this.buildQueryText(symbol, stockName, sector, layerId, layerName, baseSummary)

      // 2. 生成查询向量
      const queryResult = await embedText(queryText)
      if (!queryResult.success) {
        return {
          snippets: [],
          totalChars: 0,
          elapsedMs: performance.now() - startTime,
          success: false,
          tierBreakdown: { tier: 0, label: '嵌入失败', count: 0 },
          missingDataAlert: missingAlert,
          error: queryResult.error,
        }
      }

      // 3. 三层定向检索
      const allSnippets: RAGSnippet[] = []
      const tier1Count = this.config.topK
      const tier2Count = Math.ceil(this.config.topK * 0.4)
      const tier3Count = Math.ceil(this.config.topK * 0.2)

      // Tier 1: 同股票检索
      const stockIndex = this.stockIndices.get(symbol)
      if (stockIndex && stockIndex.getCurrentCount() > 0) {
        const tier1Results = await this.searchInIndex(
          stockIndex, queryResult.vector, tier1Count, 0.30,
        )
        allSnippets.push(...tier1Results)
      }

      // Tier 2: 同行业检索（排除已检索到的同股票文档）
      const tier1Ids = new Set(allSnippets.map((s) => s.docId))
      if (sector) {
        const sectorIndex = this.sectorIndices.get(sector)
        if (sectorIndex && sectorIndex.getCurrentCount() > 0) {
          const tier2Results = await this.searchInIndex(
            sectorIndex, queryResult.vector, tier2Count, 0.35, tier1Ids,
          )
          allSnippets.push(...tier2Results)
        }
      }

      // Tier 3: 跨行业检索（全局索引兜底）
      const tier12Ids = new Set(allSnippets.map((s) => s.docId))
      const tier3Results = await this.searchInIndex(
        this.globalIndex, queryResult.vector, tier3Count, 0.40, tier12Ids,
      )
      allSnippets.push(...tier3Results)

      // 4. 按相似度排序，截断
      allSnippets.sort((a, b) => b.similarity - a.similarity)
      const finalSnippets = allSnippets.slice(0, this.config.topK)

      // 5. 获取完整内容
      const withContent = await this.enrichWithContent(finalSnippets)

      const elapsedMs = performance.now() - startTime
      logger.info('[RAGRetriever] 定向检索完成', {
        symbol,
        layerId,
        tier1: allSnippets.filter((s) => s.similarity >= 0.3 && this.registry.get(s.docId)?.symbol === symbol).length,
        tier2: allSnippets.filter((s) => this.registry.get(s.docId)?.sector === sector).length,
        tier3: allSnippets.length - tier1Count - tier2Count,
        results: withContent.length,
        elapsedMs: elapsedMs.toFixed(0),
      })

      return {
        snippets: withContent,
        totalChars: withContent.reduce((sum, s) => sum + s.content.length, 0),
        elapsedMs,
        success: true,
        tierBreakdown: {
          tier: 1,
          label: `${withContent.length} 条结果`,
          count: withContent.length,
        },
        missingDataAlert: missingAlert,
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      logger.error('[RAGRetriever] 检索失败', { error: msg })
      return {
        snippets: [],
        totalChars: 0,
        elapsedMs: performance.now() - startTime,
        success: false,
        tierBreakdown: { tier: 0, label: '检索失败', count: 0 },
        error: msg,
      }
    }
  }

  /**
   * 在指定 HNSW 索引中搜索
   */
  private async searchInIndex(
    index: HNSWIndex,
    queryVector: number[],
    topK: number,
    minSimilarity: number,
    excludeIds?: Set<string>,
  ): Promise<RAGSnippet[]> {
    const knn = index.searchKnn(queryVector, topK * 2)
    const results: RAGSnippet[] = []

    for (let i = 0; i < knn.ids.length; i++) {
      const docId = knn.ids[i]!
      if (excludeIds?.has(docId)) continue

      const similarity = 1 - knn.distances[i]!
      if (similarity < minSimilarity) continue

      const meta = this.registry.get(docId)
      if (!meta) continue

      results.push({
        docId,
        title: meta.title,
        content: '', // 延迟填充
        source: meta.source,
        publishedAt: meta.publishedAt,
        similarity,
        itemType: meta.itemType,
        domain: meta.domain,
        sentiment: meta.sentiment,
        qualityScore: meta.qualityScore,
      })

      if (results.length >= topK) break
    }

    return results
  }

  /**
   * 从 IndexedDB 获取完整内容并填充到 snippets
   */
  private async enrichWithContent(snippets: RAGSnippet[]): Promise<RAGSnippet[]> {
    const enriched: RAGSnippet[] = []
    let totalChars = 0

    for (const snippet of snippets) {
      try {
        const item = await queryGet<ProfileItem>(STORE_NAME.profileItems, snippet.docId)
        if (!item) continue

        const cleaned = cleanContent(item.content ?? item.summary, this.config.maxChunkChars)
        let content = cleaned.content

        // 检查总字符数限制
        if (totalChars + content.length > this.config.maxTotalChars) {
          const remaining = this.config.maxTotalChars - totalChars
          if (remaining > 200) {
            content = content.slice(0, remaining) + '...[截断]'
          } else {
            break
          }
        }

        enriched.push({ ...snippet, content })
        totalChars += content.length
      } catch {
        // 跳过获取失败的文档
      }
    }

    return enriched
  }

  /**
   * 缺失数据检测
   *
   * 检查个股的 ProfileItem 覆盖度：
   * - 总文档数 < MIN_DOCS_PER_STOCK → critical
   * - 某种资料类型文档数为 0 → warning
   */
  private detectMissingData(
    symbol: string,
    stockName: string,
    _sector?: string,
  ): MissingDataAlert | undefined {
    // 从 registry 统计该个股的文档
    const stockDocs = Array.from(this.registry.values()).filter(
      (m) => m.symbol === symbol,
    )

    const totalDocs = stockDocs.length
    const typeCounts = new Map<string, number>()
    for (const doc of stockDocs) {
      typeCounts.set(doc.itemType, (typeCounts.get(doc.itemType) ?? 0) + 1)
    }

    const missingTypes: string[] = []
    for (const itemType of this.config.itemTypes) {
      if ((typeCounts.get(itemType) ?? 0) < MIN_DOCS_PER_TYPE) {
        missingTypes.push(ITEM_TYPE_LABELS[itemType] ?? itemType)
      }
    }

    // 无缺失 → 不发预警
    if (totalDocs >= MIN_DOCS_PER_STOCK && missingTypes.length === 0) {
      return undefined
    }

    const severity: 'warning' | 'critical' =
      totalDocs < MIN_DOCS_PER_STOCK ? 'critical' : 'warning'

    const message = severity === 'critical'
      ? `${stockName}(${symbol}) 资料库仅 ${totalDocs} 条文档，严重不足，建议立即补充`
      : `${stockName}(${symbol}) 缺少以下类型资料: ${missingTypes.join('、')}`

    const recommendedAction = severity === 'critical'
      ? '建议立即触发数据采集管线，补充研报、公告、新闻等资料'
      : `建议补充 ${missingTypes.join('、')} 类型资料，以提升 RAG 评分质量`

    const alert: MissingDataAlert = {
      symbol,
      stockName,
      severity,
      message,
      missingTypes,
      totalDocuments: totalDocs,
      recommendedAction,
    }

    // 通过 eventBus 发出预警
    eventBus.emit('RAG_MISSING_DATA_ALERT', alert)

    logger.warn('[RAGRetriever] 缺失数据预警', { ...alert })
    return alert
  }

  /**
   * 构建查询文本
   */
  private buildQueryText(
    symbol: string,
    stockName: string,
    sector: string | undefined,
    layerId: string,
    layerName: string,
    baseSummary: string,
  ): string {
    const focus = LAYER_FOCUS[layerId] ?? ''
    const parts = [
      `${stockName}(${symbol})`,
      sector ? `[行业:${sector}]` : '',
      layerName,
      focus,
      baseSummary.slice(0, 200),
    ].filter(Boolean)
    return parts.join(' ').slice(0, 512)
  }

  /**
   * 从 ProfileItem 推断行业
   */
  private inferSector(item: ProfileItem): string | undefined {
    // 从 topicTags 中提取行业标签
    const sectorTags = item.topicTags?.filter(
      (t) => t.includes('行业') || t.includes('板块') || t.includes('赛道'),
    )
    if (sectorTags && sectorTags.length > 0) {
      return sectorTags[0]
    }
    // 从 domain 推断
    const domainSectorMap: Record<string, string> = {
      D1: '行业产业',
      D2: '政策监管',
    }
    return domainSectorMap[item.domain] ?? undefined
  }

  /** 获取索引统计信息 */
  getStats(): {
    totalDocs: number
    stockIndices: number
    sectorIndices: number
    indexReady: boolean
  } {
    return {
      totalDocs: this.registry.size,
      stockIndices: this.stockIndices.size,
      sectorIndices: this.sectorIndices.size,
      indexReady: this.indexReady,
    }
  }
}

/** 全局单例 */
export const ragRetriever = new RAGRetriever()