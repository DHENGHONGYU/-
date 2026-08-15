/**
 * HNSW 向量索引 — 纯 JavaScript 实现
 *
 * API 对齐 Python hnswlib（https://github.com/nmslib/hnswlib），
 * 以便未来无缝替换为 WASM/原生绑定版本。
 *
 * 对齐接口：
 *   const index = new HNSWIndex('cosine', 384)
 *   index.initIndex(10000, { M: 16, efConstruction: 200 })
 *   index.addItems(vectors, ids)
 *   const { ids, distances } = index.searchKnn(query, 10)
 *   index.setEf(64)
 *
 * 参考：Malkov & Yashunin, "Efficient and robust approximate nearest neighbor
 *       search using Hierarchical Navigable Small World graphs", 2018.
  * @doc [V9-DOC-BACK-012, V9-DOC-BACK-023, V9-DOC-BACK-033, V9-DOC-BACK-021, V9-DOC-BACK-026]
*/

import { getLogger } from '@/lib/logger'

const logger = getLogger()

// ─── 类型 ────────────────────────────────────────────────────

export type HNSWSpace = 'l2' | 'cosine' | 'ip'

export interface HNSWInitOptions {
  /** 每层最大邻居数（默认 16） */
  M?: number
  /** 构建时搜索宽度（默认 200） */
  efConstruction?: number
  /** 随机种子 */
  randomSeed?: number
}

export interface HNSWSearchResult {
  ids: string[]
  distances: number[]
}

export interface SerializedHNSW {
  version: number
  space: HNSWSpace
  dim: number
  maxElements: number
  M: number
  efConstruction: number
  efSearch: number
  randomSeed: number
  nodes: Array<{
    id: string
    vector: number[]
    neighbors: string[][]
  }>
  entryPoint: string | null
  deleted: string[]
}

// ─── 距离函数 ────────────────────────────────────────────────

function l2Distance(a: number[], b: number[]): number {
  let sum = 0
  for (let i = 0; i < a.length; i++) {
    const diff = a[i]! - b[i]!
    sum += diff * diff
  }
  return Math.sqrt(sum)
}

function cosineDistance(a: number[], b: number[]): number {
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!
    normA += a[i]! * a[i]!
    normB += b[i]! * b[i]!
  }
  if (normA === 0 || normB === 0) return 2
  const sim = dot / (Math.sqrt(normA) * Math.sqrt(normB))
  return 1 - sim
}

function ipDistance(a: number[], b: number[]): number {
  let dot = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!
  }
  return -dot
}

function getDistanceFn(space: HNSWSpace): (a: number[], b: number[]) => number {
  switch (space) {
    case 'l2': return l2Distance
    case 'cosine': return cosineDistance
    case 'ip': return ipDistance
  }
}

// ─── 最小堆 ──────────────────────────────────────────────────

interface HeapItem {
  id: string
  distance: number
}

class MinHeap {
  private heap: HeapItem[] = []
  push(item: HeapItem): void {
    this.heap.push(item)
    this.bubbleUp(this.heap.length - 1)
  }
  pop(): HeapItem | undefined {
    if (this.heap.length === 0) return undefined
    const root = this.heap[0]
    const last = this.heap.pop()!
    if (this.heap.length > 0) {
      this.heap[0] = last
      this.bubbleDown(0)
    }
    return root
  }
  peek(): HeapItem | undefined {
    return this.heap[0]
  }
  get size(): number {
    return this.heap.length
  }
  private bubbleUp(i: number): void {
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2)
      if (this.heap[parent]!.distance <= this.heap[i]!.distance) break
      ;[this.heap[parent], this.heap[i]] = [this.heap[i]!, this.heap[parent]!]
      i = parent
    }
  }
  private bubbleDown(i: number): void {
    const n = this.heap.length
    while (true) {
      let smallest = i
      const left = 2 * i + 1
      const right = 2 * i + 2
      if (left < n && this.heap[left]!.distance < this.heap[smallest]!.distance) smallest = left
      if (right < n && this.heap[right]!.distance < this.heap[smallest]!.distance) smallest = right
      if (smallest === i) break
      ;[this.heap[i], this.heap[smallest]] = [this.heap[smallest]!, this.heap[i]!]
      i = smallest
    }
  }
}

// ─── HNSW 索引 ───────────────────────────────────────────────

/**
 * HNSWIndex
 */
export class HNSWIndex {
  private space: HNSWSpace
  dim: number
  private distanceFn: (a: number[], b: number[]) => number
  private maxElements = 0
  private M = 16
  private mL = 1 / Math.log(16)
  private efConstruction = 200
  private efSearch = 64
  private randomSeed = 100
  private nodes = new Map<string, { id: string; vector: number[]; neighbors: string[][] }>()
  private entryPoint: string | null = null
  private deletedSet = new Set<string>()
  private initialized = false

  constructor(space: HNSWSpace, dim: number) {
    this.space = space
    this.dim = dim
    this.distanceFn = getDistanceFn(space)
  }

  // ─── 生命周期 ──────────────────────────────────────────────

  /**
   * 初始化索引容量。对标 hnswlib.init_index(max_elements, M, ef_construction, random_seed)
   */
  initIndex(maxElements: number, options?: HNSWInitOptions): void {
    this.maxElements = maxElements
    this.M = options?.M ?? 16
    this.mL = 1 / Math.log(this.M)
    this.efConstruction = options?.efConstruction ?? 200
    this.randomSeed = options?.randomSeed ?? 100
    this.initialized = true
    logger.info('[HNSW] initIndex', { space: this.space, dim: this.dim, maxElements, M: this.M, efConstruction: this.efConstruction })
  }

  /**
   * 扩容索引。对标 hnswlib.resize_index(new_size)
   */
  resizeIndex(newSize: number): void {
    this.maxElements = Math.max(this.maxElements, newSize)
    logger.info('[HNSW] resizeIndex', { newSize })
  }

  /**
   * 设置搜索参数。对标 hnswlib.set_ef(ef)
   */
  setEf(ef: number): void {
    this.efSearch = ef
  }

  getEf(): number {
    return this.efSearch
  }

  // ─── 写入 ──────────────────────────────────────────────────

  /**
   * 批量添加向量。对标 hnswlib.add_items(data, ids)
   *
   * @param vectors 向量数组（二维数组）
   * @param ids 对应 ID 数组
   */
  addItems(vectors: number[][], ids: string[]): void {
    if (!this.initialized) throw new Error('HNSWIndex not initialized. Call initIndex() first.')
    if (vectors.length !== ids.length) throw new Error('vectors and ids must have the same length')

    for (let i = 0; i < ids.length; i++) {
      this.addItem(ids[i]!, vectors[i]!)
    }
  }

  private addItem(id: string, vector: number[]): void {
    if (vector.length !== this.dim) {
      logger.warn(`[HNSW] addItem: dimension mismatch, skipping ${id}`)
      return
    }
    if (this.nodes.size >= this.maxElements) {
      logger.warn('[HNSW] addItem: maxElements reached, skipping')
      return
    }

    // 已存在则先删除
    if (this.nodes.has(id)) this.deleteNode(id)

    const level = this.randomLevel()
    const node = { id, vector, neighbors: Array.from({ length: level + 1 }, () => [] as string[]) }
    this.nodes.set(id, node)
    this.deletedSet.delete(id)

    if (this.entryPoint === null) {
      this.entryPoint = id
      return
    }

    const entryNode = this.nodes.get(this.entryPoint)!
    const entryMaxLayer = entryNode.neighbors.length - 1

    let currentEntry = this.entryPoint
    for (let layer = entryMaxLayer; layer > level; layer--) {
      currentEntry = this.searchLayer(vector, currentEntry, 1, layer)[0]?.id ?? currentEntry
    }

    for (let layer = Math.min(level, entryMaxLayer); layer >= 0; layer--) {
      const neighbors = this.searchLayer(vector, currentEntry, this.efConstruction, layer)
      const selected = this.selectNeighbors(vector, neighbors, this.M)
      node.neighbors[layer] = selected.map((n) => n.id)

      for (const n of selected) {
        const neighborNode = this.nodes.get(n.id)
        if (!neighborNode) continue
        neighborNode.neighbors[layer] ??= []
        neighborNode.neighbors[layer]!.push(id)
        if (neighborNode.neighbors[layer]!.length > this.M * 2) {
          neighborNode.neighbors[layer] = this.shrinkConnections(neighborNode, layer, this.M)
        }
      }
      currentEntry = selected[0]?.id ?? currentEntry
    }

    if (level > entryMaxLayer) this.entryPoint = id
  }

  // ─── 读取 ──────────────────────────────────────────────────

  /**
   * 搜索 k 近邻。对标 hnswlib.search_knn(data, k)
   *
   * @returns { ids: string[], distances: number[] }
   */
  searchKnn(vector: number[], k: number): HNSWSearchResult {
    if (!this.initialized) throw new Error('HNSWIndex not initialized. Call initIndex() first.')
    if (vector.length !== this.dim) {
      logger.warn(`[HNSW] searchKnn: dimension mismatch`)
      return { ids: [], distances: [] }
    }
    if (this.entryPoint === null || this.nodes.size === 0) return { ids: [], distances: [] }

    const entryNode = this.nodes.get(this.entryPoint)!
    const maxLayer = entryNode.neighbors.length - 1

    let currentEntry = this.entryPoint
    for (let layer = maxLayer; layer > 0; layer--) {
      const nearest = this.searchLayer(vector, currentEntry, 1, layer)
      if (nearest.length > 0) currentEntry = nearest[0]!.id
    }

    const results = this.searchLayer(vector, currentEntry, this.efSearch, 0)
    const filtered = results.filter((r) => !this.deletedSet.has(r.id)).slice(0, k)

    return {
      ids: filtered.map((r) => r.id),
      distances: filtered.map((r) => r.distance),
    }
  }

  /**
   * 当前元素数量。对标 hnswlib.get_current_count()
   */
  getCurrentCount(): number {
    return this.nodes.size - this.deletedSet.size
  }

  // ─── 删除 ──────────────────────────────────────────────────

  /**
   * 标记删除（软删除）。对标 hnswlib.mark_deleted(label)
   */
  markDeleted(id: string): void {
    if (this.nodes.has(id)) this.deletedSet.add(id)
  }

  /**
   * 取消删除标记。对标 hnswlib.unmark_deleted(label)
   */
  unmarkDeleted(id: string): void {
    this.deletedSet.delete(id)
  }

  /**
   * 物理删除节点。
   */
  deleteNode(id: string): void {
    const node = this.nodes.get(id)
    if (!node) return

    for (let layer = 0; layer < node.neighbors.length; layer++) {
      for (const neighborId of node.neighbors[layer] ?? []) {
        const neighbor = this.nodes.get(neighborId)
        if (neighbor?.neighbors[layer]) {
          neighbor.neighbors[layer] = neighbor.neighbors[layer]!.filter((n) => n !== id)
        }
      }
    }

    this.nodes.delete(id)
    this.deletedSet.delete(id)

    if (this.entryPoint === id) {
      let maxLayer = -1
      let newEntry: string | null = null
      for (const [nid, n] of this.nodes) {
        const layer = n.neighbors.length - 1
        if (layer > maxLayer) { maxLayer = layer; newEntry = nid }
      }
      this.entryPoint = newEntry
    }
  }

  // ─── 序列化 ────────────────────────────────────────────────

  /**
   * 序列化索引。对标 hnswlib.save_index() 的内存版本。
   */
  saveIndex(): SerializedHNSW {
    return {
      version: 1,
      space: this.space,
      dim: this.dim,
      maxElements: this.maxElements,
      M: this.M,
      efConstruction: this.efConstruction,
      efSearch: this.efSearch,
      randomSeed: this.randomSeed,
      nodes: Array.from(this.nodes.values()).map((n) => ({
        id: n.id,
        vector: n.vector,
        neighbors: n.neighbors,
      })),
      entryPoint: this.entryPoint,
      deleted: Array.from(this.deletedSet),
    }
  }

  /**
   * 反序列化索引。对标 hnswlib.load_index() 的内存版本。
   */
  loadIndex(data: SerializedHNSW): void {
    this.space = data.space
    this.dim = data.dim
    this.maxElements = data.maxElements
    this.M = data.M
    this.mL = 1 / Math.log(data.M)
    this.efConstruction = data.efConstruction
    this.efSearch = data.efSearch
    this.randomSeed = data.randomSeed
    this.distanceFn = getDistanceFn(data.space)
    this.entryPoint = data.entryPoint
    this.deletedSet = new Set(data.deleted ?? [])
    this.initialized = true

    this.nodes.clear()
    for (const n of data.nodes) {
      this.nodes.set(n.id, { id: n.id, vector: n.vector, neighbors: n.neighbors })
    }
  }

  // ─── 内部方法 ──────────────────────────────────────────────

  private searchLayer(query: number[], entryId: string, ef: number, layer: number): Array<{ id: string; distance: number }> {
    const visited = new Set<string>()
    const candidates = new MinHeap()
    const results = new MinHeap()

    const entryDist = this.distanceFn(query, this.nodes.get(entryId)!.vector)
    candidates.push({ id: entryId, distance: entryDist })
    results.push({ id: entryId, distance: entryDist })
    visited.add(entryId)

    while (candidates.size > 0) {
      const current = candidates.pop()!
      const farthestResult = results.peek()
      if (farthestResult && current.distance > farthestResult.distance && results.size >= ef) break

      const node = this.nodes.get(current.id)
      if (!node) continue
      const neighbors = node.neighbors[layer] ?? []

      for (const neighborId of neighbors) {
        if (visited.has(neighborId)) continue
        visited.add(neighborId)
        const neighbor = this.nodes.get(neighborId)
        if (!neighbor) continue
        const dist = this.distanceFn(query, neighbor.vector)

        const farthest = results.peek()
        if (results.size < ef || dist < farthest!.distance) {
          candidates.push({ id: neighborId, distance: dist })
          results.push({ id: neighborId, distance: dist })
          if (results.size > ef) {
            const arr: HeapItem[] = []
            while (results.size > 0) arr.push(results.pop()!)
            arr.pop()
            for (const item of arr) results.push(item)
          }
        }
      }
    }

    const output: Array<{ id: string; distance: number }> = []
    while (results.size > 0) {
      const item = results.pop()!
      output.push({ id: item.id, distance: item.distance })
    }
    return output.sort((a, b) => a.distance - b.distance)
  }

  private selectNeighbors(_query: number[], candidates: Array<{ id: string; distance: number }>, M: number): Array<{ id: string; distance: number }> {
    return candidates.slice(0, M)
  }

  private shrinkConnections(node: { id: string; vector: number[]; neighbors: string[][] }, layer: number, M: number): string[] {
    const neighborIds = node.neighbors[layer] ?? []
    if (neighborIds.length <= M) return neighborIds

    const distances = neighborIds
      .map((nid) => {
        const neighbor = this.nodes.get(nid)
        if (!neighbor) return null
        return { id: nid, distance: this.distanceFn(node.vector, neighbor.vector) }
      })
      .filter((d): d is { id: string; distance: number } => d !== null)

    distances.sort((a, b) => a.distance - b.distance)
    return distances.slice(0, M).map((d) => d.id)
  }

  private randomLevel(): number {
    let level = 0
    while (Math.random() < Math.exp(-1 / this.mL) && level < 16) level++
    return level
  }
}
