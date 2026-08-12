# 发展建议落地执行清单（基于现有体系）

> **第一性原则**：不另起炉灶，所有新增项均嵌入现有体系——文档走 Diátaxis + ADR/doc_id 体系，代码走 22 层分层 + DataBridge 信封协议，测试走 Vitest + 契约 + E2E，审计走 audit:* 脚本套件，MCP 走 mcpServerRegistry + ACL 矩阵，DB 走 DB_VERSION 递增 + Migration + STORE_NAME + ENVELOPE_ACTION + Handler。
>
> **归因方式**：每条 TODO 均标注「落在哪个现有体系的哪个槽位」，以及「完成后由哪个审计脚本/测试文件自动把关」，避免悬空。

---

## 0. 编号与命名速查（先对齐现有体系）

| 体系 | 当前编号水位 | 新编号槽位 | 命名规范 |
|------|-------------|-----------|---------|
| **ADR** | ADR-013（MCP 生命周期） | ADR-014 ~ ADR-018 | `adr-NNN-<topic>.md`，位置 `docs/explanation/` 或 `docs/reference/` |
| **doc_id** | `V9-DOC-ARCH-001` ~ 各域独立计数 | 在各域内按序递增 | `V9-DOC-<DOMAIN>-<NNN>` |
| **DB_VERSION** | 32（八域资料体系） | 33 / 34 / 35 | 整数递增，每次 Schema 变更 +1 |
| **Store 命名** | camelCase 属性 / snake_case 物理名 | 新增按域前缀 | `STORE_NAME.xxxYyy = 'xxx_yyy'` |
| **Action 命名** | camelCase 属性 / UPPER_SNAKE 值 | 新增按 save/bulk/delete 前缀 | `ENVELOPE_ACTION.saveXxxYyy = 'SAVE_XXX_YYY'` |
| **MCP Server** | 15 个注册，10 个 enabled | 复用现有 Server 扩展 Tool，不轻易新增 Server | `src/mcp/servers/<domain>/<domain>Server.ts` |
| **审计脚本** | 30+ `audit:*` | 新脚本放 `scripts/audit/`，命名 `audit-<topic>.ts` | `audit:<topic>` 对应 npm script |
| **契约测试** | 7 份契约（databridge/envelope/engine/...） | 新契约放 `tests/contracts/` | `<domain>.contract.ts` |
| **Store 注册表** | 63 个 Store | 自动生成，不需手动维护 | `scripts/gen-store-service-registries.mjs` |

---

## 1. P0 · 向量搜索落地（高优先级）

> **落点**：复用现有 `local_docs` Store + `vectorProvider` + `hnswIndex`（已有代码桩）+ `semanticSearcher`（已有 TF-IDF 实现）。不新建"向量搜索模块"，而是**将 HNSW 向量索引作为 semanticSearcher 的升级路径接通**，接口不变。

### 1.1 数据架构与 DB 层（DB_VERSION → 33）

- [ ] **Step 1.1.1**：`src/config/dbConfig.ts`
  - `DB_VERSION: 32` → `33`
  - `STORE_NAME` 中新增（若需持久化向量索引元数据）：
    - `vectorIndexMeta: 'vector_index_meta'`（存储索引版本、构建时间、文档数）
  - `ENVELOPE_ACTION` 中新增：
    - `saveVectorIndexMeta: 'SAVE_VECTOR_INDEX_META'`
  - `ACL_MATRIX` 中 `system` 模块 write 追加新 Store（索引由 system 模块维护）
  - 校验：`npx tsc --noEmit`

- [ ] **Step 1.1.2**：`src/data/db-schema.ts` → `createSchema()`
  - 调用 `ensureStore(STORE_NAME.vectorIndexMeta, { keyPath: 'indexId' })`
  - 索引：`by-index-version`（按版本查询）
  - 校验：`npx tsc --noEmit`

- [ ] **Step 1.1.3**：`src/data/db-migrations.ts` → `MIGRATIONS`
  - 追加 `v33_vectorIndexMeta` 迁移（空 up + 写入 `schema_migrations` 记录）
  - 模式参照 v32 的 `v32_profileSystem` 写法
  - 校验：`npx vitest run tests/__tests__/scripts/`（迁移脚本有测试）

- [ ] **Step 1.1.4**：`src/data/types/types.knowledge.ts`
  - 新增 `VectorIndexMeta` 接口（indexId, version, docCount, builtAt, dimensions, modelName）
  - 校验：`npx tsc --noEmit`

- [ ] **Step 1.1.5**：`src/data/dataLayerContentStores.ts`
  - 新增 `vectorIndexMetaStore`（get/list/save/delete）
  - 模式参照 `localDocStore` 写法
  - 校验：`npx tsc --noEmit`

- [ ] **Step 1.1.6**：`src/data/dataLayer.ts`
  - 在 barrel 导出中加入 `vectorIndexMetaStore`
  - 校验：`npx tsc --noEmit`

- [ ] **Step 1.1.7**：`src/core/databridgeActionMap.ts` → `ACTION_TO_STORE_MAP`
  - 追加 `saveVectorIndexMeta → vectorIndexMeta`
  - 校验：`npm run audit:db-references`

- [ ] **Step 1.1.8**：`src/core/databridgeHandlers.ts`
  - `PutHandler` 的 `actions` 数组追加 `'saveVectorIndexMeta'`
  - 校验：`npm run audit:db-references`

### 1.2 Service 层（复用 storage 服务域）

- [ ] **Step 1.2.1**：`src/services/storage/vectorProvider.ts`
  - 接通 `hnswIndex` 与 `localEmbeddingService` 的串联管线
  - 暴露 `buildIndex(docs)` / `search(query, topK)` / `saveIndexMeta()` 方法
  - 保持现有接口签名不变（TF-IDF → 向量是内部升级，调用方无感）
  - 校验：`npx tsc --noEmit`

- [ ] **Step 1.2.2**：`src/services/system/localEmbeddingService.ts`
  - 确保 `Xenova/all-MiniLM-L6-v2` 模型加载走懒加载单例
  - 增加 `warmUp()` 方法（在用户首次打开搜索时预加载）
  - 校验：`npx tsc --noEmit`

- [ ] **Step 1.2.3**：`src/services/data-sync-search/semanticSearcher.ts`
  - 内部增加 `useVector` 开关（默认 `false`，渐进式启用）
  - 向量索引就绪后自动切换到向量搜索，未就绪回退 TF-IDF
  - 保持对外 `search(query, options)` 接口不变
  - 校验：`npx vitest run tests/__tests__/services/`

### 1.3 MCP 层（复用 knowledge Server，不新增 Server）

- [ ] **Step 1.3.1**：`src/mcp/servers/knowledge/knowledgeServer.ts`
  - 新增 Tool：`search_knowledge_semantic`（复用 semanticSearcher）
  - 新增 Tool：`rebuild_vector_index`（触发索引重建）
  - Tool 命名遵循 `search_*` / `rebuild_*` 前缀规范
  - 校验：`npm run audit:mcp`

- [ ] **Step 1.3.2**：`src/config/mcpAclMatrix.ts`
  - `ui` 角色 `allowedTools` 追加 `search_knowledge_*`
  - `admin` 角色追加 `rebuild_vector_index`
  - 校验：`npm run audit:acl-consistency`

### 1.4 测试与契约

- [ ] **Step 1.4.1**：`tests/contracts/` （不新增契约文件）
  - 向量搜索属于 knowledge 域，复用现有 `store.contract.ts` 模式
  - 如需要独立契约，命名为 `knowledge.contract.ts`，放在 `tests/contracts/`

- [ ] **Step 1.4.2**：`tests/__tests__/services/` 下新增 `semanticSearcher.test.ts`
  - 覆盖：TF-IDF 模式、向量模式（mock 嵌入）、自动降级
  - 校验：`npx vitest run tests/__tests__/services/semanticSearcher.test.ts`

### 1.5 文档与审计

- [ ] **Step 1.5.1**：新增 ADR-014
  - 路径：`docs/reference/adr-014-vector-search-over-tfidf.md`
  - 内容：为什么从 TF-IDF 升级到向量搜索、选型对比（transformers.js vs 远程 API）、回退策略、性能影响
  - 元数据：`type: reference`, `domain: data`, `doc_id: V9-DOC-DATA-NNN`（在 doc-id-registry 中取号）
  - 校验：`npm run audit:docs`

- [ ] **Step 1.5.2**：新增审计脚本（可选，如向量索引健康度检查）
  - 路径：`scripts/audit/audit-vector-index.ts`
  - 检查：索引是否构建、文档覆盖率、向量维度是否匹配
  - npm script：`audit:vector-index`
  - 校验：`npm run audit:registry`（确保脚本被引用）

---

## 2. P0 · DuckDB 时序分析落地（高优先级）

> **落点**：复用现有 `duckDBProvider.ts`（已有桩代码）+ `storage/` 服务域 + `daily_quotes` Store。不新建"量化分析模块"，而是**在 storage 域内接通 DuckDB WASM，提供 SQL 查询能力**，上层评分/回测引擎按需调用。

### 2.1 数据架构与 DB 层（DB_VERSION → 34）

> 注：DuckDB 数据在内存/文件系统中持久化，不走 IndexedDB 主表，**DB_VERSION 不需要为 DuckDB 本身递增**。如果需要存查询配置或缓存结果，才需要新增 Store。此处按"新增 query_cache" 预估。

- [ ] **Step 2.1.1**：`src/config/dbConfig.ts`（如需要缓存表）
  - `DB_VERSION: 33` → `34`
  - `STORE_NAME` 新增：`duckdbQueryCache: 'duckdb_query_cache'`
  - `ENVELOPE_ACTION` 新增：`saveDuckdbQueryCache: 'SAVE_DUCKDB_QUERY_CACHE'`
  - `ACL_MATRIX` 追加（system 模块读写）
  - 校验：`npx tsc --noEmit`

- [ ] **Step 2.1.2**：Schema + Migration 按 1.1 节模式补齐
  - `db-schema.ts` → ensureStore
  - `db-migrations.ts` → 追加 v34 迁移记录
  - 校验：`npm run audit:db-references`

- [ ] **Step 2.1.3**：dataLayer 封装（如需要持久化查询缓存）
  - `dataLayerContentStores.ts` 新增 `duckdbQueryCacheStore`
  - `dataLayer.ts` barrel 导出
  - 校验：`npx tsc --noEmit`

### 2.2 Service 层（storage 域扩展）

- [ ] **Step 2.2.1**：`src/services/storage/duckDBProvider.ts`
  - 接通 DuckDB WASM 初始化（`@duckdb/duckdb-wasm`）
  - 暴露方法：`init()` / `query(sql)` / `loadQuotes(symbol)` / `close()`
  - 行情数据从 `daily_quotes` Store 加载到 DuckDB 内存表
  - 校验：`npx tsc --noEmit`

- [ ] **Step 2.2.2**：`src/services/storage/index.ts`（如果有 barrel 导出）
  - 导出 duckDBProvider
  - 校验：`npx tsc --noEmit`

### 2.3 评分引擎接入（L8 筹码层可选加速）

- [ ] **Step 2.3.1**：`src/services/scoring/v6-engine/calculators/l7_l8.ts`（L8 筹码层）
  - 可选：将八级筹码计算的滑动窗口/波动率等计算迁移到 DuckDB SQL
  - 保持 JS 实现作为 fallback（DuckDB 初始化失败时回退）
  - 校验：`npx vitest run tests/__tests__/services/scoring/`

### 2.4 MCP 层（复用 backtest / screening Server）

- [ ] **Step 2.4.1**：`src/mcp/servers/backtest/backtestServer.ts`
  - 新增 Tool：`run_sql_query`（执行 DuckDB 查询，返回 JSON）
  - 新增 Tool：`get_available_tables`（列出可用内存表）
  - 安全限制：仅 SELECT，禁止 DDL/DML（白名单校验）
  - 校验：`npm run audit:mcp`

- [ ] **Step 2.4.2**：`src/config/mcpAclMatrix.ts`
  - `admin` 角色允许 `run_sql_query` / `get_available_tables`
  - `ui` 角色默认不开放（或仅允许预定义查询）
  - 校验：`npm run audit:acl-consistency`

### 2.5 测试

- [ ] **Step 2.5.1**：`tests/__tests__/services/` 新增 `duckDBProvider.test.ts`
  - 覆盖：初始化、基础 SQL 查询、行情数据加载、错误回退
  - mock DuckDB WASM 或使用内存实例
  - 校验：`npx vitest run tests/__tests__/services/duckDBProvider.test.ts`

### 2.6 文档

- [ ] **Step 2.6.1**：新增 ADR-015
  - 路径：`docs/explanation/adr-015-duckdb-wasm-timeseries.md`
  - 内容：为什么选 DuckDB WASM、与纯 JS 计算性能对比、内存占用、回退策略
  - doc_id：`V9-DOC-DATA-NNN`（在 registry 取号）
  - 校验：`npm run audit:docs`

---

## 3. P1 · 用例层显式化（中优先级）

> **落点**：不新建 `useCases/` 顶层目录（避免与现有分层冲突），而是**在 `services/` 对应子域下增加 `use-cases/` 子目录**，归属于服务层，符合 22 层分层中「服务层」的定义。复杂交互从 onClick 中提取为 Service 层的 useCase 函数，Store 的 action 委托给 useCase，组件只调 Store。

### 3.1 目录组织（按域分散，不集中）

```
src/services/
├── scoring/
│   └── use-cases/            ← 评分域用例
│       ├── scoreSingleStockUseCase.ts
│       ├── batchScorePoolUseCase.ts
│       └── regenerateEvidenceChainUseCase.ts
├── trading/
│   └── use-cases/            ← 交易域用例
│       ├── placeOrderUseCase.ts
│       └── closePositionUseCase.ts
└── pool/
    └── use-cases/            ← 股票池域用例
        └── moveStockBetweenPoolsUseCase.ts
```

### 3.2 落地步骤（以"下单用例"为试点）

- [ ] **Step 3.2.1**：`src/services/trading/use-cases/placeOrderUseCase.ts`
  - 从现有 `orderStore` 的 `placeOrder` action 中提取业务逻辑
  - 入参：`{ symbol, side, quantity, price, orderType }`
  - 出参：`Promise<{ success: boolean; orderId?: string; error?: string }>`
  - 内部通过 `dataBridge.forward()` 写库（Service 层允许）
  - 校验：`npx tsc --noEmit`

- [ ] **Step 3.2.2**：`src/store/orderStore.ts`
  - `placeOrder` action 改为调用 `placeOrderUseCase()`
  - Store 只保留状态更新 + 加载状态管理
  - 保持 action 签名不变，组件无感
  - 校验：`npm run audit:layers`（确保 Store 仍不直接 import data/）

- [ ] **Step 3.2.3**：`tests/__tests__/services/trading/` 新增 `placeOrderUseCase.test.ts`
  - 独立测试用例逻辑（不依赖 React）
  - 覆盖：正常下单、余额不足、风控拦截、失败回滚
  - 校验：`npx vitest run tests/__tests__/services/trading/`

- [ ] **Step 3.2.4**：`src/services/serviceRegistry.ts`
  - 自动生成的注册表，运行 `node scripts/gen-store-service-registries.mjs` 更新
  - 校验：`npm run audit:registry`

### 3.3 扩展到其他域（分批推进）

- [ ] **Step 3.3.1**：评分域用例（scoreSingleStock / batchScorePool）
- [ ] **Step 3.3.2**：股票池域用例（moveStockBetweenPools / importPool）
- [ ] **Step 3.3.3**：回测域用例（runBacktest / generateReport）

### 3.4 文档

- [ ] **Step 3.4.1**：新增 ADR-016
  - 路径：`docs/explanation/adr-016-use-cases-in-service-layer.md`
  - 内容：为什么用例层放在 services/ 下而非独立层、与 Store 的职责边界、命名规范
  - doc_id：`V9-DOC-ARCH-NNN`
  - 校验：`npm run audit:docs`

- [ ] **Step 3.4.2**：新增审计脚本（可选）
  - 路径：`scripts/audit/audit-use-cases.ts`
  - 检查：onClick 中直接有 async/await 复杂逻辑的组件 → 提示提取 useCase
  - npm script：`audit:use-cases`（warning 级别，不阻断）

---

## 4. P1 · 类型测试 CI 门禁（中优先级）

> **落点**：复用现有 `tests/__tests__/types/` 目录 + `ts-expect` 依赖（已安装）。不新建类型测试体系，而是**补齐已有目录的测试用例，并在 CI workflow 中增加类型测试步骤**。

### 4.1 类型测试用例补齐

- [ ] **Step 4.1.1**：`tests/__tests__/types/` 下新增测试文件
  - `v6-engine.types.test.ts` — 验证 LayerId / LayerScore / CompositeScore 等类型
  - `databridge.types.test.ts` — 验证 Envelope / Action / Store 类型映射
  - `profile.types.test.ts` — 验证八域资料类型（DomainId / ProfileItem / ScoreEvidence）
  - 写法：使用 `Expect<Equal<A, B>>()` + `expectTypeOf()` 断言

- [ ] **Step 4.1.2**：覆盖关键类型
  - LayerId 与 DomainId 的映射（类型级别的 domainToLayers 函数返回类型）
  - EnvelopeAction → StoreName 的映射是否正确
  - Store 实体类型与 dataLayer 返回类型是否一致
  - 校验：`npx vitest run tests/__tests__/types/`

### 4.2 CI 门禁接入

- [ ] **Step 4.2.1**：`.github/workflows/` 下找到 CI workflow
  - 在 `tsc --noEmit` 之后、单元测试之前，增加类型测试步骤
  - 命令：`npx vitest run tests/__tests__/types/`
  - 失败阻断：是（类型回归是 P0）

- [ ] **Step 4.2.2**：`package.json` scripts
  - 增加 `test:types`：`vitest run tests/__tests__/types/`
  - 在 `test` 或 `audit` 串联命令中可选加入

### 4.3 文档

- [ ] **Step 4.3.1**：在 `docs/reference/` 下补充文档
  - 路径：`docs/reference/type-testing-guide.md`
  - 内容：什么时候写类型测试、ts-expect 用法、常见 pattern
  - doc_id：`V9-DOC-QA-NNN`
  - 校验：`npm run audit:docs`

---

## 5. P2 · AI 行为约束文件（低优先级）

> **落点**：复用现有 `AGENTS.md` 作为主约束文件。不新建多份 AI 规则文件，而是**补充 `.cursorrules`（或等价文件）指向 AGENTS.md**，并在 AGENTS.md 中增加「代码风格与提交规范」章节。

### 5.1 规则文件落地

- [ ] **Step 5.1.1**：在项目根目录新增 `.cursorrules`
  - 内容仅包含：「请严格遵循项目根目录的 `AGENTS.md` 文件中的所有规则和分层约束。编码规范见 `docs/reference/coding-conventions.md`。」
  - 不重复 AGENTS.md 内容，避免双份维护
  - 校验：文件存在 + 指向正确

- [ ] **Step 5.1.2**：`AGENTS.md` 末尾追加章节（或在已有章节补充）
  - 「§十四 代码生成风格约束」
  - 内容：组件命名、文件组织、注释风格、提交信息格式、何时需要写测试
  - 版本号：v1.5.1 → v1.5.2（小版本递增）
  - 更新日期：同步修改
  - 校验：文档中能找到新增章节

### 5.2 审计侧（可选）

- [ ] **Step 5.2.1**：`scripts/audit/audit-ai-rules.ts`
  - 检查：`.cursorrules` 是否存在、是否引用 AGENTS.md
  - npm script：`audit:ai-rules`（info 级别）
  - 校验：`npm run audit:registry`

### 5.3 文档

- [ ] **Step 5.3.1**：不需要新增 ADR（低优先级，不涉及架构决策）
  - 如果后续扩展为多 IDE 支持，再补 ADR-017

---

## 6. 验证命令速查（每批次完成后必跑）

| 批次 | 验证命令 | 通过标准 |
|------|---------|---------|
| P0-1 向量搜索 | `npm run audit:db-references && npm run audit:mcp && npm run audit:acl-consistency && npx tsc --noEmit && npx vitest run tests/__tests__/services/semanticSearcher.test.ts` | 0 errors, 全绿 |
| P0-2 DuckDB | `npm run audit:db-references && npm run audit:mcp && npx tsc --noEmit && npx vitest run tests/__tests__/services/duckDBProvider.test.ts` | 0 errors, 全绿 |
| P1-3 用例层 | `npm run audit:layers && npm run audit:registry && npx tsc --noEmit && npx vitest run tests/__tests__/services/trading/` | 0 violations, 全绿 |
| P1-4 类型测试 | `npx vitest run tests/__tests__/types/` | 全部通过 |
| P2-5 AI约束 | `npm run audit:docs` | 0 doc sync errors |
| **全量回归** | `npx tsc --noEmit && npm run audit && npx vitest run` | 全通过 |

---

## 7. 执行顺序建议（风险从低到高）

```
第 1 批：P2 AI 行为约束（纯文档，零代码风险）
    ↓
第 2 批：P1 类型测试 CI（纯测试，不影响生产代码）
    ↓
第 3 批：P1 用例层显式化（重构，不改变外部行为，Store 接口不变）
    ↓
第 4 批：P0 向量搜索落地（新能力，有 TF-IDF 兜底，可灰度）
    ↓
第 5 批：P0 DuckDB 时序分析（新能力，有 JS 计算兜底，影响性能不影响功能）
```

> **归因说明**：每一批次的产出物都落在某个已有体系的明确槽位里——
> - 文档 → Diátaxis 分类 + ADR 编号 + doc_id 注册
> - 代码 → 22 层分层 + DataBridge 信封协议 + 命名规范
> - 数据 → DB_VERSION 递增 + STORE_NAME + ENVELOPE_ACTION + Handler + ACL
> - MCP → mcpServerRegistry 配置 + mcpAclMatrix 权限 + audit:mcp 校验
> - 测试 → Vitest + 契约测试 + E2E + audit:tests 质量审计
> - 审计 → scripts/audit/ + npm run audit:* 套件
