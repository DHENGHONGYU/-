---
title: ADR-014: 向量搜索升级方案（HNSW + transformers.js）
type: reference
domain: data
phase: design
tier: important
status: proposed
maintainer: V9 Architecture Team
summary: "在现有 TF-IDF 语义搜索基础上，引入基于 transformers.js 的本地向量嵌入和 HNSW 近似最近邻索引，提供更高质量的语义检索能力。采用渐进式升级策略，保持 TF-IDF 作为回退方案，确保零风险过渡。"
tags: [data, vector-search, hnsw, semantic-search, embedding, adr, reference]
version: v1.0.0
last_updated: 2026-07-20
code_version: "2.0.0-rc.1"
doc_id: V9-DOC-DATA-080
referenced_by: []
change_log:
  - version: v1.0.0
    changes: Initial version proposed
date: 2026-07-20
---

# ADR-014: 向量搜索升级方案（HNSW + transformers.js）

> **状态**: Proposed  
> **提出日期**: 2026-07-20  
> **Version**: v1.0.0

---

## 1. 背景（Context）

### 1.1 现状

V9 项目当前使用基于 **TF-IDF + 余弦相似度** 的轻量语义搜索（`semanticSearcher.ts`），实现了零外部依赖的关键词检索能力。同时已存在以下代码桩：

- `vectorProvider.ts` — 基于 IndexedDB 的向量存储实现
- `hnswIndex.ts` — 纯 JS 实现的 HNSW 近似最近邻索引
- `localEmbeddingService.ts` — 基于 transformers.js 的本地嵌入服务

**现有问题**：
- TF-IDF 仅基于词频匹配，无法理解语义相似度
- 同义词、多义词、跨语言查询效果差
- 用户体验受限，无法支持自然语言问答式检索

### 1.2 决策问题

是否应该引入向量搜索？如果引入，采用何种方案？如何确保不破坏现有体系？

---

## 2. 决策（Decision）

### 2.1 核心决策

**采用渐进式向量搜索升级方案，在现有 TF-IDF 基础上叠加向量能力，保持回退路径。**

具体方案：
1. **嵌入模型**：使用 `@xenova/transformers` + `Xenova/all-MiniLM-L6-v2`（384维，~23MB）
2. **索引算法**：复用现有 `HNSWIndex` 纯 JS 实现（O(log n) 近似最近邻）
3. **存储方案**：嵌入向量随文档保存在 `local_docs` Store 的 `embedding` 字段
4. **索引元数据**：新增 `vector_index_meta` Store（v33）持久化索引构建状态
5. **升级策略**：TF-IDF 始终可用，向量模式按需启用，失败自动降级

### 2.2 不选择的方案

| 方案 | 不选择原因 |
|------|-----------|
| 云端嵌入 API（OpenAI/Cohere） | 需要网络连接、隐私风险、成本 |
| WASM 版 hnswlib | 兼容性风险、构建复杂度高 |
| 完全替换 TF-IDF | 风险太高，无回退路径 |
| 新建独立向量搜索模块 | 违反"不另起炉灶"原则 |

---

## 3. 方案对比（Alternatives）

### 3.1 方案 A：纯 TF-IDF（现状）

**优点**：
- 零依赖，纯 JS 实现
- 启动速度快，无需预热
- 内存占用低

**缺点**：
- 仅关键词匹配，无语义理解
- 同义词/多义词处理差
- 无法支持自然语言查询

### 3.2 方案 B：向量搜索（本方案）

**优点**：
- 语义理解能力强，支持同义词/近义词匹配
- 自然语言查询体验好
- 本地运行，数据不外泄

**缺点**：
- 首次加载模型需下载 ~23MB
- 模型加载有延迟（秒级）
- 内存占用增加（每篇文档 384 维向量）

### 3.3 方案 C：混合模式（最终方案）

**即本方案**：向量 + TF-IDF 双通道，向量优先，失败回退。

**优点**：
- 兼顾搜索质量和可用性
- 渐进式启用，风险可控
- 保持接口不变，调用方无感

**缺点**：
- 代码复杂度略高（需要维护两条路径）
- 需处理模式切换逻辑

---

## 4. 后果（Consequences）

### 4.1 正面影响

- **搜索质量提升**：语义相似度搜索，用户体验显著改善
- **渐进式升级**：TF-IDF 始终作为兜底，零风险
- **接口不变**：`semanticSearcher.search()` 签名保持不变，调用方无需修改
- **本地化**：所有计算在浏览器内完成，数据隐私有保障

### 4.2 负面影响

- **首次加载延迟**：模型下载 + 初始化需数秒
- **内存占用增加**：N 篇文档 × 384 维 × 4字节 ≈ N × 1.5KB
- **存储增加**：嵌入向量持久化占用 IndexedDB 空间
- **复杂度上升**：需维护两条搜索路径和降级逻辑

### 4.3 风险缓解

| 风险 | 缓解措施 |
|------|---------|
| 模型加载失败 | 自动回退 TF-IDF，用户无感知 |
| 内存不足 | 限制最大索引文档数，超出部分不向量化 |
| 首次使用延迟 | 提供 `warmUp()` 预加载，空闲时后台构建 |
| 搜索质量下降 | TF-IDF 始终可用，确保基线体验 |

---

## 5. 实现细节

### 5.1 架构分层

```
┌─────────────────────────────────────────┐
│         MCP Layer (knowledgeServer)      │
│  - search_knowledge_semantic             │
│  - rebuild_vector_index                  │
├─────────────────────────────────────────┤
│         Service Layer (semanticSearcher) │
│  - TF-IDF 模式（同步，始终可用）          │
│  - 向量模式（异步，按需启用）             │
│  - 自动降级逻辑                          │
├─────────────────────────────────────────┤
│  Storage Layer (vectorProvider + hnsw)   │
│  - HNSW 内存索引                         │
│  - IndexedDB 持久化（local_docs）        │
├─────────────────────────────────────────┤
│  Embedding Layer (localEmbeddingService) │
│  - transformers.js 懒加载                │
│  - all-MiniLM-L6-v2 模型                 │
└─────────────────────────────────────────┘
```

### 5.2 关键接口

**semanticSearcher 对外接口**：

```typescript
// 同步搜索（TF-IDF，始终可用）
search(query: string, topK?: number): Array<{item, score}>

// 异步搜索（向量优先，自动降级）
searchAsync(query: string, topK?: number): Promise<Array<{item, score}>>

// 启用向量模式（异步初始化模型）
enableVectorSearch(): Promise<boolean>

// 为已索引文档构建嵌入向量
buildEmbeddings(): Promise<number>

// 当前搜索模式
get searchMode(): 'tf-idf' | 'vector' | 'initializing'
```

### 5.3 数据库变更

- **DB_VERSION**: 32 → 33
- **新增 Store**: `vector_index_meta`（索引元数据）
- **新增 Action**: `SAVE_VECTOR_INDEX_META`
- **既有 Store 变更**: 无（`local_docs.embedding` 字段已存在）

### 5.4 MCP 工具

| 工具名 | 角色权限 | 说明 |
|--------|---------|------|
| `search_knowledge_semantic` | ui / admin | 语义搜索（向量+TF-IDF双通道） |
| `rebuild_vector_index` | admin | 重建向量索引（耗时操作） |

---

## 6. 回退策略

### 6.1 自动降级触发条件

- 嵌入模型加载失败
- 浏览器不支持 WebAssembly（transformers.js 需要）
- 内存不足
- 向量搜索抛出异常

### 6.2 降级行为

- 自动切换到 TF-IDF 模式
- 记录警告日志
- 搜索结果质量回退到基线水平
- 用户无感知（接口不变）

---

## 7. 性能影响

### 7.1 时间开销

| 操作 | TF-IDF | 向量模式 | 备注 |
|------|--------|---------|------|
| 首次模型加载 | - | ~3-10s | 含下载时间，后续加载从缓存读取 |
| 索引构建（N篇） | O(N·L) | O(N·L) + O(N·d) | d=384维向量计算 |
| 单次搜索 | O(N) | O(log N) | HNSW 近似最近邻 |

### 7.2 空间开销

- **内存**：N 篇文档 × 384 维 × 4字节 ≈ 1.5N KB
- **存储**：同内存，持久化到 IndexedDB
- **模型文件**：~23MB（浏览器缓存）

---

## 8. 参考资料

- [HNSW 论文](https://arxiv.org/abs/1603.09320) - Efficient and robust approximate nearest neighbor search using Hierarchical Navigable Small World graphs
- [transformers.js](https://huggingface.co/docs/transformers.js) - Run 🤗 Transformers in your browser
- [all-MiniLM-L6-v2](https://huggingface.co/Xenova/all-MiniLM-L6-v2) - Sentence-BERT 模型的 ONNX 量化版本
