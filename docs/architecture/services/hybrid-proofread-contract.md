---
title: hybrid-proofread 服务契约
status: draft
owner: 架构组
updated: 2026-07-12
---

# hybrid-proofread-contract.md — 混合校对（人机协同校验）服务接口契约

> **定位**：定义 `hybrid-proofread` 子域的接口契约、职责边界、数据流与依赖关系。  
> **关联**：`../../architecture/services-catalog.md`（子域 #9）、`AGENTS.md` §一（分层规则）。

---

## 1. 职责边界

### 1.1 核心职责

1. **本地文件扫描与哈希采集**：递归扫描项目目录，按文件类型分类，计算文件哈希值，支持并发扫描与取消操作。
2. **规则引擎评估**：加载安全规则（本地缓存/云端同步），对源代码与配置文件执行正则匹配，发现敏感数据、硬编码密钥、依赖漏洞等风险。
3. **云端风险校验**：将本地文件哈希批量上传至云端，比对已知风险库（CVE），获取风险详情与修复建议。
4. **校对报告生成**：聚合本地规则匹配结果与云端风险数据，生成结构化报告（JSON / HTML / Markdown），包含风险分级、统计、摘要与修复建议。

### 1.2 分层定位

| 维度 | 说明 |
|------|------|
| 所属层 | `src/services/hybrid-proofread/`（服务层 #9） |
| 依赖方向 | `core/`、`data/`、`lib/`（白名单）、`config/`（配置层）、`constants/`（常量层） |
| 禁止事项 | 禁止直写 IndexedDB（须经 `DataBridge.forward()`）；禁止直接依赖 `store/`、`pages/`、`components/` |
| 被依赖方 | `store/`（状态层）、`pages/`（页面层）可消费本服务输出 |

### 1.3 与相邻子域的关系

| 相邻子域 | 关系 | 数据流 |
|----------|------|--------|
| `data/`（dataLayer） | 下游写入 | `hybrid-proofread` → `dataLayer`（通过 `DataBridge` 写入报告/扫描结果） |
| `pages/command` | 上游调用方 | 用户触发完整校对流程 → `hybrid-proofread` |
| `config/` | 配置依赖 | `hybrid-proofread` 读取 `src/config/hybridProofreadConfig.ts` |

---

## 2. 公共接口

### 2.1 类型定义（TypeScript Interface）

```typescript
// 文件：src/services/hybrid-proofread/localCollector.ts

export interface ScanOptions {
  projectId: string
  projectPath: string
  includes?: string[]
  excludes?: string[]
  maxConcurrentFiles?: number
}
```

> **注**：本服务重度消费 `@/data/types` 中的以下类型，但类型定义本身位于 `data/` 层：
> - `FileHash`, `FileType`, `LocalScanResult`, `RuleMatchResult`, `CloudRiskResult`
> - `ProofreadReport`, `RiskLevel`, `RuleConfig`, `RulePackage`
> - `HashVerifyRequest`, `HashVerifyResponse`, `HashBatchVerifyRequest`, `HashBatchVerifyResponse`
> - `RiskDetailsRequest`, `RiskDetailsResponse`, `RiskDetail`, `RulesSyncResult`, `PerformanceMetric`

### 2.2 主入口函数

| 函数 | 签名 | 职责 | 错误处理 |
|------|------|------|----------|
| `runFullProofread()` | `(projectId, projectName, projectPath) => Promise<{ success: boolean; report?: ProofreadReport; error?: string }>` | 编排 4 步完整校对流程（同步规则→本地扫描→规则评估→云端检查→生成报告） | `logger.error` 记录 + 返回 `{ success: false, error }` |
| `LocalCollector.scan()` | `(options: ScanOptions) => Promise<LocalScanResult>` | 递归扫描项目目录，计算文件哈希 | 跳过异常文件，`logger.warn` 记录 |
| `RuleEngine.evaluateFile()` | `(filePath: string, content: string) => Promise<RuleMatchResult[]>` | 对单文件内容执行规则匹配 | 无异常抛出，空规则返回 `[]` |
| `RuleEngine.syncRules()` | `() => Promise<RulesSyncResult>` | 检查云端规则版本，按需下载并缓存 | 降级为本地默认规则，`logger.error` 记录 |
| `CloudSyncClient.batchVerifyHashes()` | `(request: HashBatchVerifyRequest) => Promise<HashBatchVerifyResponse>` | 批量上传哈希至云端比对风险库 | 返回 `unknown` 状态兜底 |
| `CloudSyncClient.getRiskDetails()` | `(request: RiskDetailsRequest) => Promise<RiskDetailsResponse>` | 获取风险哈希的 CVE 详情 | 无匹配时返回 `[]` |
| `HashService.computeHash()` | `(data: string \| Buffer) => Promise<string>` | 计算 SHA-256 哈希值 | 纯计算，无 IO 错误 |
| `HashService.batchComputeHashes()` | `(filePaths: string[], projectId: string, batchSize?: number) => Promise<FileHash[]>` | 批量计算文件哈希，支持分批处理 | 单文件失败跳过，`logger.warn` 记录 |
| `ReportGenerator.generateReport()` | `(projectId, projectName, localScan, cloudRisk) => ProofreadReport` | 聚合本地与云端结果，生成结构化报告 | 纯计算，无异常抛出 |
| `ReportGenerator.exportReport()` | `(report: ProofreadReport, format: 'json' \| 'html' \| 'markdown') => string` | 将报告导出为指定格式字符串 | 纯计算 |

### 2.3 事件接口

> **当前状态**：本服务暂无显式 `EventBus` 发布/订阅代码。状态通知通过 `runFullProofread()` 的返回值由调用方处理。  
> **建议**：后续如需实时进度推送，可补充 `EventBus` 事件：

| 事件名 | 发布方 | 订阅方 | 说明 |
|--------|--------|--------|------|
| `hybrid-proofread:progress` | `LocalCollector` / `runFullProofread` | `proofreadStore` | 扫描/评估进度百分比 |
| `hybrid-proofread:completed` | `runFullProofread` | `proofreadStore` | 校对完成，报告就绪 |
| `hybrid-proofread:error` | `runFullProofread` | `errorBus` | 流程异常终止 |

---

## 3. 数据流

```
用户触发（Command 页面 / CLI）
    ↓
runFullProofread(projectId, projectName, projectPath)
    ├─> Step 1: ruleEngine.syncRules()        ← 本地缓存 / 云端下载
    ├─> Step 2: localCollector.scan()       ← 文件系统遍历 + 哈希计算
    ├─> Step 3: ruleEngine.evaluateFile()    ← 正则规则匹配（本地）
    ├─> Step 4: cloudSyncClient.batchVerifyHashes() / getRiskDetails() ← 云端 CVE 比对
    └─> reportGenerator.generateReport()     ← 聚合本地 + 云端结果
        ↓
    DataBridge.forward() → routeToDB() → dataLayer → IndexedDB
        ↓
    proofreadStore (Zustand + withBroadcast)
        ↓
    components/pages (仅经 Store 取数)
```

---

## 4. 配置与依赖

### 4.1 依赖白名单（lib/）

| 依赖 | 路径 | 用途 |
|------|------|------|
| logger | `@/lib/logger` | 各步骤耗时、结果、错误日志 |
| localStorageManager | `@/lib/localStorageManager` | `RuleEngine` 缓存规则包（`defaultStorage.set/get`） |

### 4.2 其他依赖

| 依赖 | 路径 | 用途 |
|------|------|------|
| data/types | `@/data/types` | 全子域类型定义（FileHash、ProofreadReport 等） |
| config/hybridProofreadConfig | `@/config/hybridProofreadConfig` | 扫描配置、哈希算法、规则版本、API 端点 |
| constants/theme.tokens | `@/constants/theme.tokens` | `ReportGenerator` 生成 HTML 报告时引用 `COLOR_SHADES` |

### 4.3 配置项

| 配置名 | 默认值 | 说明 | 来源 |
|--------|--------|------|------|
| `hash.algorithm` | `'sha256'` | 哈希算法 | `src/config/hybridProofreadConfig.ts` |
| `hash.batchSize` | `50` | 批量哈希处理批次大小 | `src/config/hybridProofreadConfig.ts` |
| `hash.maxFileSizeBytes` | `10MB` | 最大扫描文件大小 | `src/config/hybridProofreadConfig.ts` |
| `rules.syncIntervalMs` | `24h` | 规则同步最小间隔 | `src/config/hybridProofreadConfig.ts` |
| `scanning.maxConcurrentFiles` | `10` | 并发扫描文件数 | `src/config/hybridProofreadConfig.ts` |
| `scanning.defaultExcludes` | `['node_modules/**', '.git/**', ...]` | 默认排除模式 | `src/config/hybridProofreadConfig.ts` |
| `scanning.defaultIncludes` | `['**/*.ts', '**/*.tsx', ...]` | 默认包含模式 | `src/config/hybridProofreadConfig.ts` |

---

## 5. 测试策略

> **当前状态**：`src/services/hybrid-proofread/` 下暂无 `__tests__` 目录或测试文件。  
> **建议补充**：

| 测试类型 | 文件 | 说明 |
|----------|------|------|
| 单元测试 | `src/services/hybrid-proofread/__tests__/hashService.test.ts` | `computeHash`、`batchComputeHashes` 正确性与性能 |
| 单元测试 | `src/services/hybrid-proofread/__tests__/ruleEngine.test.ts` | `evaluateFile` 正则匹配、规则过滤、降级逻辑 |
| 单元测试 | `src/services/hybrid-proofread/__tests__/localCollector.test.ts` | `collectFiles` 路径过滤、并发控制、取消逻辑 |
| 单元测试 | `src/services/hybrid-proofread/__tests__/reportGenerator.test.ts` | `countIssues`、`calculateOverallRiskLevel` 边界值 |
| 集成测试 | `tests/services/hybrid-proofread.integration.test.ts` | `runFullProofread` 端到端流程（Mock fs + Mock cloud） |
| Mock 策略 | `__mocks__/cloudSyncClient.ts` | 隔离云端依赖，使用 `MOCK_RISKY_HASHES` 模式 |

---

## 6. 变更日志

| 日期 | 版本 | 变更 | 作者 |
|------|------|------|------|
| 2026-07-12 | v0.1.0 | 契约初稿 | 架构组 |

---

> **TODO[子域 owner]**：
> 1. 补充 `__tests__` 目录及单元测试，覆盖 `RuleEngine.evaluateFile`、`HashService.computeHash`、`ReportGenerator.calculateOverallRiskLevel` 等核心逻辑。
> 2. 如需 Store 消费，在 `src/store/` 创建 `proofreadStore.ts`，通过 `DataBridge` 读取报告数据。
> 3. 完成后运行 `tsc --noEmit` + `audit:layers` 验证。
