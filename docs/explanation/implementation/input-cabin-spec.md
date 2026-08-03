---
title: 输入舱业务规格与实现映射
version: v0.9.0
last_updated: 2026-06-25
maintainer: V9 Architecture Team
status: active
change_log:
  - date: 2026-06-25
    author: Documentation Governor
    desc: 注入 Frontmatter 元数据（Phase 3 版本化）
---
# 输入舱业务规格与实现映射

> **Status**: Current  
> **Version**: v0.9.0-migration-implemented  
> **Last Updated**: 2026-06-24
>
> 本文档是输入舱的专项业务蓝图，定义输入舱端到端流程、子页面职责、数据协议、服务层契约与 UI 组件映射。  
> 目标读者：前端开发者、产品经理、架构师。

---

## 1. 业务定位

输入舱是 V9 研究工作流的起点，承担以下职责：

1. **股票录入**：手动输入、搜索录入、批量文本导入。
2. **候选池管理**：五态股票池（candidate → screened → deepDive → watching → archived）的看板展示与流转。
3. **热门板块发现**：基于 V4/V6 评分或 mock 数据推荐板块，关联股票一键入库。
4. **数据采集测试**：验证 AKShare/本地数据源健康，拉取基础/K线数据。
5. **采集配置（P2）**：运行时配置采集维度、频率、数据源优先级、限流。

---

## 2. 端到端流程

### 流程 A：单条搜索录入

```
用户在 StockSearch 输入 "茅台"
  → inputService.searchStocks("茅台")
  → 返回匹配列表（代码/名称/行业/PE/PB/市值）
  → 用户点击录入
  → DataBridge.forward(INSERT_STOCK) with source: 'input-cabin'
  → IndexedDB stocks 表
  → eventBus.emit("input:poolChanged")
  → InputDashboard / PoolBoard 刷新
```

### 流程 B：批量导入

```
用户粘贴 "600519,贵州茅台\n000001.SZ,平安银行"
  → batchImportService.parseBulkInput(text)
  → 返回行级状态：valid / duplicate / invalid + 原因
  → BulkImportPanel 渲染预览表格
  → 用户确认导入
  → batchImportService.importStocks(validRows)
  → 逐条 DataBridge.forward(INSERT_STOCK)
  → eventBus.emit("input:poolChanged") + "input:importProgress"
  → 展示成功/失败统计与错误明细
```

### 流程 C：股票池流转

```
用户在 PoolCard 点击「推送到观察池」
  → poolTransitionEngine.validateTransition('candidate', 'watching', stock)
  → stockpoolService.transitionStock(symbol, 'watching')
  → DataBridge.forward(UPDATE_STOCK)
  → eventBus.emit("input:poolChanged")
  → 目标池 UI 更新
```

### 流程 D：采集测试

```
用户进入 /input/data-test
  → fetcherService.checkDataSources()
  → 返回各数据源健康状态与延迟
  → 用户输入 symbol 点击探测
  → fetcherService.probeQuote(symbol)
  → 返回基础/K线数据快照
  → 清洗检查标识缺失字段
```

---

## 3. 子页面职责

| 子页面 | 页面路由 | 舱内组件 | 核心服务 | 主要职责 |
|--------|----------|----------|----------|----------|
| 录入看板 | `/input` → `PortalShell` | `InputDashboard`（含 `StockSearch`, `PoolBoard`, `QualityIndicator`） | `inputService`, `stockpoolService` | 单条/搜索录入、五态池看板、快捷入口 |
| 模块首页 | `/input/hub` → `PortalShell` | `InputHubPage` | — | 输入舱模块首页、功能导航 |
| 批量导入 | `/input/bulk-import` → `PortalShell` | `BulkImportPanel` | `batchImportService` | 文本解析、行级状态、导入进度、错误明细 |
| 热门板块 | `/input/hot-sectors` → `PortalShell` | `HotSectorPanel` | `hotSectorService` | 板块排名、因子进度条、轮动建议、关联股票入库 |
| 采集测试 | `/input/data-test` → `PortalShell` | `DataTestPanel` | `fetcherService` | 数据源健康、单/批量探测、清洗检查 |
| 本地知识库 | `/input/local-knowledge` | `LocalKnowledgePage` | `localKnowledgeService` | 本地知识录入、分类、检索与股票关联 |
| 交互原型 | `/input/prototype` → `PortalShell` | `InputPrototype` | mock | 临时 UI/UX 校对，确认后删除 |

> 路由映射规则：舱室入口（`/input`、`/input/hub`）及子页面统一由 `PortalShell` 渲染外壳，舱内具体组件由 `PortalShell` 根据当前 pathname 注入；`LocalKnowledgePage` 因作为独立全页，直接挂载于 `/input/local-knowledge`。新增子页面必须同步更新 `src/config/routes.ts` 与本表。

---

## 4. 数据协议

### 4.1 写入信封

输入舱所有写操作必须经 `DataBridge.forward()`：

```ts
interface InputCabinEnvelope {
  meta: {
    source: 'input-cabin';
    target: 'indexeddb';
    action: 'INSERT_STOCK' | 'BULK_IMPORT' | 'UPDATE_STOCK' | 'SAVE_DAILY_QUOTES';
    traceId: string;
    timestamp: number;
    dataVersion: number;
  };
  payload: unknown;
}
```

### 4.2 内部事件

| 事件名 | 触发时机 | 订阅方 |
|--------|----------|--------|
| `input:poolChanged` | 股票录入/导入/流转/删除后 | `InputDashboard`, `PoolBoard` |
| `input:fetcherStatusChanged` | 采集服务健康状态变化 | `DataTestPanel`, 顶部状态栏 |
| `input:importProgress` | 批量导入进度更新 | `BulkImportPanel` |

### 4.3 数据质量字段

输入舱负责维护 `Stock.dataQuality`：

```ts
interface StockDataQuality {
  basic: boolean;
  kline: boolean;
  finance: boolean;
  lastChecked?: number;
}
```

质量指示组件 `QualityIndicator` 据此展示红/黄/绿点或进度条。

---

## 5. 服务层契约

### 5.1 `inputService.ts`（新增/增强）

```ts
interface InputService {
  searchStocks(query: string, options?: SearchOptions): Promise<StockSearchResult[]>;
  addStockFromSearch(result: StockSearchResult): Promise<DataBridgeResult>;
  exportPool(status?: ResearchStatus): Promise<ExportPayload>;
  importPool(payload: ExportPayload): Promise<ImportResult>;
}
```

### 5.2 `batchImportService.ts`

```ts
interface BatchImportService {
  parseBulkInput(text: string): ParsedBulkRow[];
  importStocks(rows: ParsedBulkRow[], options?: ImportOptions): Promise<BulkImportResult>;
}

type RowStatus = 'valid' | 'duplicate' | 'invalid';

interface ParsedBulkRow {
  raw: string;
  symbol?: string;
  name?: string;
  status: RowStatus;
  reason?: string; // invalid/duplicate 原因
}
```

### 5.3 `hotSectorService.ts`

```ts
interface HotSectorService {
  getHotSectors(): Promise<HotSector[]>;
  getSectorStocks(sectorId: string): Promise<StockSearchResult[]>;
  addSectorStocks(sectorId: string): Promise<DataBridgeResult>;
}

interface HotSector {
  id: string;
  name: string;
  rank: number;
  score: number;
  trend: 'up' | 'down' | 'flat';
  factors: { name: string; score: number; weight: number }[];
  rotationAdvice?: string;
}
```

### 5.4 `fetcherService.ts`

```ts
interface FetcherService {
  checkDataSources(): Promise<DataSourceHealth[]>;
  probeQuote(symbol: string): Promise<ProbeResult>;
  cleanData(symbols?: string[]): Promise<CleanResult>;
}
```

---

## 6. UI 组件映射

| 组件 | 路径 | 用途 | 数据来源 |
|------|------|------|----------|
| `StockSearch` | `src/components/organisms/input/StockSearch.tsx` | 搜索录入 | `inputService.searchStocks` |
| `QualityIndicator` | `src/components/organisms/input/QualityIndicator.tsx` | 数据质量点/进度条 | `stock.dataQuality` |
| `PoolBoard` | `src/components/organisms/pool/PoolBoard.tsx` | 五态池看板 | `stockpoolService.getAllPoolGroups` |
| `PoolCard` | `src/components/organisms/pool/PoolCard.tsx` | 单只股票卡片 | `Stock` + `dataQuality` |
| `BulkImportPanel` | `src/apps/input/BulkImportPanel.tsx` | 批量导入页面 | `batchImportService` |
| `HotSectorPanel` | `src/apps/input/HotSectorPanel.tsx` | 热门板块页面 | `hotSectorService` |
| `DataTestPanel` | `src/apps/input/DataTestPanel.tsx` | 采集测试页面 | `fetcherService` |
| `FetcherConfigPanel` | `src/apps/input/FetcherConfigPanel.tsx`（P2） | 采集配置抽屉 | `fetcherConfigService` |

---

## 7. 配置层规划

已建 `src/config/inputConfig.ts`：

```ts
export const INPUT_CONFIG = {
  bulkImport: {
    maxRows: 500,
    separators: /[\n;；、]/,
    inlineSeparators: /[\s,，]+/,
    supportedFormats: ['code', 'code.name', 'code,name'],
  },
  quality: {
    requiredBasicFields: ['name', 'industry', 'price', 'pe', 'pb'],
    requiredKlineFields: ['close', 'volume'],
    requiredFinanceFields: ['roe', 'revenueGrowth'],
  },
  search: {
    debounceMs: 200,
    minQueryLength: 1,
    maxResults: 20,
  },
};
```

---

## 8. 验收标准

- [ ] 用户可通过搜索组件录入股票到候选池。
- [ ] 批量导入展示行级状态与导入进度。
- [ ] 股票池看板支持列表视图、复选批量操作、导入/导出。
- [ ] 热门板块展示因子进度条与轮动建议。
- [ ] 采集测试展示多数据源健康度与实时探测结果。
- [ ] 所有写操作经 `DataBridge.forward()` 并携带 `source: 'input-cabin'`。
- [ ] 新增功能均补充单元测试，整体测试通过率 100%。

---

## 9. 版本比对

| 版本 | 时间 | 变化 |
|------|------|------|
| v0.9.0-docs-base | 2026-06-24 前 | 输入舱作为单页巨石组件，无搜索、无质量指示、无子页面拆分 |
| v0.9.0-docs-review | 2026-06-24 | 拆分四子页，定义数据协议、服务契约、组件映射、配置层规划 |
| v0.9.0-migration-implemented | 2026-06-24 | 统一版本号；更新子页面职责表，区分页面路由（PortalShell）与舱内组件（InputDashboard/InputHubPage） |
