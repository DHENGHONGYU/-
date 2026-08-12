# 文档更新建议草稿

> 生成时间: 2026-07-12T07:36:09.158Z
> 生成方式: 模板生成（LLM 不可用）
> 状态: 待人工审核

---

**⚠️ 重要提示**: 此文件为自动生成的草稿，需人工审核后再合并到正式文档中。

---

# 文档更新建议（模板生成）

> 生成时间: 2026-07-12T07:36:09.156Z
> 扫描模式: 仅变更文件
> 总符号数: 55 | 缺失符号数: 39

---

## LlmFactorOverride

**类型**: interface

**位置**: `src\config\llmConfig.ts`

**缺失语义**: LlmFactorOverride, useLlm

**描述**: 需要补充该interface的用途和设计意图说明

**字段说明**:
```typescript
// TODO: 列出所有字段及其类型和用途
```

---

## LlmTransparencyConfig

**类型**: interface

**位置**: `src\config\llmConfig.ts`

**缺失语义**: LlmTransparencyConfig, LlmFactorOverride[], enableLlm, showTransparencyPanel

**描述**: 需要补充该interface的用途和设计意图说明

**字段说明**:
```typescript
// TODO: 列出所有字段及其类型和用途
```

---

## LlmPreset

**类型**: interface

**位置**: `src\config\llmConfig.ts`

**缺失语义**: LlmPreset, defaultModel, models, contextWindow, inputPrice, outputPrice

**描述**: 需要补充该interface的用途和设计意图说明

**字段说明**:
```typescript
// TODO: 列出所有字段及其类型和用途
```

---

## getPresetById

**类型**: function

**位置**: `src\config\llmConfig.ts`

**缺失语义**: getPresetById, LlmPreset | undefined

**描述**: 需要补充该function的用途和设计意图说明

**参数说明**:
```typescript
// TODO: 列出参数及其类型和用途
```

**返回值**:
```typescript
// TODO: 说明返回值类型和含义
```

**使用示例**:
```typescript
// TODO: 添加使用示例
```

---

## inferPresetId

**类型**: function

**位置**: `src\config\llmConfig.ts`

**缺失语义**: inferPresetId

**描述**: 需要补充该function的用途和设计意图说明

**参数说明**:
```typescript
// TODO: 列出参数及其类型和用途
```

**返回值**:
```typescript
// TODO: 说明返回值类型和含义
```

**使用示例**:
```typescript
// TODO: 添加使用示例
```

---

## getLlmApiKeyAsync

**类型**: function

**位置**: `src\config\llmConfig.ts`

**缺失语义**: getLlmApiKeyAsync, Promise<string>

**描述**: 需要补充该function的用途和设计意图说明

**参数说明**:
```typescript
// TODO: 列出参数及其类型和用途
```

**返回值**:
```typescript
// TODO: 说明返回值类型和含义
```

**使用示例**:
```typescript
// TODO: 添加使用示例
```

---

## isLlmApiKeyConfigured

**类型**: function

**位置**: `src\config\llmConfig.ts`

**缺失语义**: isLlmApiKeyConfigured

**描述**: 需要补充该function的用途和设计意图说明

**参数说明**:
```typescript
// TODO: 列出参数及其类型和用途
```

**返回值**:
```typescript
// TODO: 说明返回值类型和含义
```

**使用示例**:
```typescript
// TODO: 添加使用示例
```

---

## isLlmConfigured

**类型**: function

**位置**: `src\config\llmConfig.ts`

**缺失语义**: config is LlmConfig

**描述**: 需要补充该function的用途和设计意图说明

**参数说明**:
```typescript
// TODO: 列出参数及其类型和用途
```

**返回值**:
```typescript
// TODO: 说明返回值类型和含义
```

**使用示例**:
```typescript
// TODO: 添加使用示例
```

---

## getDefaultLlmTransparencyConfig

**类型**: function

**位置**: `src\config\llmConfig.ts`

**缺失语义**: getDefaultLlmTransparencyConfig, LlmTransparencyConfig

**描述**: 需要补充该function的用途和设计意图说明

**参数说明**:
```typescript
// TODO: 列出参数及其类型和用途
```

**返回值**:
```typescript
// TODO: 说明返回值类型和含义
```

**使用示例**:
```typescript
// TODO: 添加使用示例
```

---

## DataBridge

**类型**: class

**位置**: `src\core\databridge.ts`

**缺失语义**: waitForDbReady, tryServeFromCache, { success: true; data: T } | null, assertQueryAcl, executeQueryAction, assertQueryGetKey, assertQueryByIndexKey, Set<EnvelopeCallback>, assertAclWithFallback, Promise<{ success: number; failed: number }>

**描述**: 需要补充该class的用途和设计意图说明

---

## DataFlowEngine

**类型**: class

**位置**: `src\core\dataflow\dataflowEngine.ts`

**缺失语义**: cacheMaxEntries, cacheStats, eventSource, EventSource | null, connectionListeners, reconnectAttempts, reconnectTimer, MessageEvent, getCached, DataPacket<T> | undefined, _evictIfNeeded, setCacheMaxEntries, _scheduleReconnect, _tryReconnect, _notifyConnectionChange, getCacheStats

**描述**: 需要补充该class的用途和设计意图说明

---

## toSafeOptionalNumber

**类型**: function

**位置**: `src\lib\safeCoerce.ts`

**缺失语义**: toSafeOptionalNumber

**描述**: 需要补充该function的用途和设计意图说明

**参数说明**:
```typescript
// TODO: 列出参数及其类型和用途
```

**返回值**:
```typescript
// TODO: 说明返回值类型和含义
```

**使用示例**:
```typescript
// TODO: 添加使用示例
```

---

## toSafeEnum

**类型**: function

**位置**: `src\lib\safeCoerce.ts`

**缺失语义**: toSafeEnum, readonly T[]

**描述**: 需要补充该function的用途和设计意图说明

**参数说明**:
```typescript
// TODO: 列出参数及其类型和用途
```

**返回值**:
```typescript
// TODO: 说明返回值类型和含义
```

**使用示例**:
```typescript
// TODO: 添加使用示例
```

---

## toSafeArray

**类型**: function

**位置**: `src\lib\safeCoerce.ts`

**缺失语义**: toSafeArray

**描述**: 需要补充该function的用途和设计意图说明

**参数说明**:
```typescript
// TODO: 列出参数及其类型和用途
```

**返回值**:
```typescript
// TODO: 说明返回值类型和含义
```

**使用示例**:
```typescript
// TODO: 添加使用示例
```

---

## ReportGenerator

**类型**: class

**位置**: `src\services\hybrid-proofread\reportGenerator.ts`

**缺失语义**: generateReport, CloudRiskResult | null, countIssues, ruleMatches, RuleMatchResult[], Array<{ severity: string }>, {
    critical_issues: number
    high_issues: number
    medium_issues: number
    low_issues: number
    total_issues: number
  }, calculateOverallRiskLevel, generateSummary, CloudRiskResult | null, seen, ruleMatches, RuleMatchResult[], Array<{ remediation_advice: string }>, 'json' | 'html' | 'markdown', generateMarkdownReport, generateHtmlReport, getRiskLevelLabel

**描述**: 需要补充该class的用途和设计意图说明

---

## MarketDataSourceKey

**类型**: type

**位置**: `src\store\marketDataStore.ts`

**缺失语义**: | 'sectorHeatmap'
  | 'fundFlow'
  | 'marketSentiment'
  | 'marketIndices'
  | 'portfolioOverview'
  | 'watchlist'
  | 'modelCompare'
  | 'investmentProfile'
  | 'kaiScore'
  | 'stockPool'
  | 'stockChat'
  | 'hotSector'
  | 'valuePit'
  | 'aiTradeReview'
  | 'pnlAnalysis'
  | 'positionControl'
  | 'riskMonitor'
  | 'signalMonitor'

**描述**: 需要补充该type的用途和设计意图说明

---

## DataSourceEntry

**类型**: interface

**位置**: `src\store\marketDataStore.ts`

**缺失语义**: Partial<MarketData> | undefined

**描述**: 需要补充该interface的用途和设计意图说明

**字段说明**:
```typescript
// TODO: 列出所有字段及其类型和用途
```

---

## MarketDataStatus

**类型**: type

**位置**: `src\store\marketDataStore.ts`

**缺失语义**: 'idle' | 'loading' | 'ready' | 'error'

**描述**: 需要补充该type的用途和设计意图说明

---

## MarketDataState

**类型**: interface

**位置**: `src\store\marketDataStore.ts`

**缺失语义**: Record<string, string | null>, (key: MarketDataSourceKey, config: DataSourceConfig, instanceId?: string) => Promise<void>, (configs: Array<{ key: MarketDataSourceKey; config: DataSourceConfig; instanceId?: string }>) => Promise<void>, (keys: MarketDataSourceKey[], intervalMs?: number) => void, (key: MarketDataSourceKey) => void, (instanceId: string) => void, () => { total: number; running: number; error: number }

**描述**: 需要补充该interface的用途和设计意图说明

**字段说明**:
```typescript
// TODO: 列出所有字段及其类型和用途
```

---

## ValidationStatus

**类型**: type

**位置**: `src\types\modules\doc-validation.types.ts`

**缺失语义**: ValidationStatus, 'pass' | 'warning' | 'failure'

**描述**: 需要补充该type的用途和设计意图说明

---

## UpdateType

**类型**: type

**位置**: `src\types\modules\doc-validation.types.ts`

**缺失语义**: UpdateType, 'added' | 'modified' | 'deleted' | 'format-converted' | 'unchanged'

**描述**: 需要补充该type的用途和设计意图说明

---

## SeverityLevel

**类型**: type

**位置**: `src\types\modules\doc-validation.types.ts`

**缺失语义**: SeverityLevel

**描述**: 需要补充该type的用途和设计意图说明

---

## MaterialCategory

**类型**: type

**位置**: `src\types\modules\doc-validation.types.ts`

**缺失语义**: MaterialCategory, | 'doc'
  | 'code'
  | 'test'
  | 'script'
  | 'config'
  | 'executable'
  | 'other'

**描述**: 需要补充该type的用途和设计意图说明

---

## ValidationDimension

**类型**: type

**位置**: `src\types\modules\doc-validation.types.ts`

**缺失语义**: ValidationDimension, 'integrity' | 'consistency' | 'correctness'

**描述**: 需要补充该type的用途和设计意图说明

---

## ScannedFile

**类型**: interface

**位置**: `src\types\modules\doc-validation.types.ts`

**缺失语义**: ScannedFile, absolutePath, relativePath, MaterialCategory, updateType, UpdateType, sizeBytes, lastModifiedAt

**描述**: 需要补充该interface的用途和设计意图说明

**字段说明**:
```typescript
// TODO: 列出所有字段及其类型和用途
```

---

## ValidationFinding

**类型**: interface

**位置**: `src\types\modules\doc-validation.types.ts`

**缺失语义**: ValidationFinding, ValidationDimension, SeverityLevel, ValidationStatus, suggestion, relatedFiles, readonly string[]

**描述**: 需要补充该interface的用途和设计意图说明

**字段说明**:
```typescript
// TODO: 列出所有字段及其类型和用途
```

---

## DocUpdateEntry

**类型**: interface

**位置**: `src\types\modules\doc-validation.types.ts`

**缺失语义**: DocUpdateEntry, updateType, Exclude<UpdateType, 'unchanged'>, syncedRefs, readonly string[]

**描述**: 需要补充该interface的用途和设计意图说明

**字段说明**:
```typescript
// TODO: 列出所有字段及其类型和用途
```

---

## DimensionSummary

**类型**: interface

**位置**: `src\types\modules\doc-validation.types.ts`

**缺失语义**: DimensionSummary, ValidationDimension, scannedCount, passCount, failureCount

**描述**: 需要补充该interface的用途和设计意图说明

**字段说明**:
```typescript
// TODO: 列出所有字段及其类型和用途
```

---

## DailyDocValidationReport

**类型**: interface

**位置**: `src\types\modules\doc-validation.types.ts`

**缺失语义**: DailyDocValidationReport, {
    /** 流程执行 ID */
    readonly runId: string
    /** 流程开始时间 */
    readonly startedAt: string
    /** 流程结束时间 */
    readonly finishedAt: string
    /** 仓库根目录 */
    readonly rootDir: string
    /** 扫描时间范围（起始） */
    readonly scanSince: string
    /** 扫描时间范围（结束） */
    readonly scanUntil: string
  }, scannedFiles, readonly ScannedFile[], readonly ValidationFinding[], readonly DocUpdateEntry[], dimensionSummaries, readonly DimensionSummary[], {
    /** 扫描文件总数 */
    readonly totalFiles: number
    /** 新增文件数 */
    readonly addedCount: number
    /** 修改文件数 */
    readonly modifiedCount: number
    /** 删除文件数 */
    readonly deletedCount: number
    /** 发现问题总数 */
    readonly totalFindings: number
    /** 自动更新操作数 */
    readonly totalUpdates: number
    /** 最终状态 */
    readonly overallStatus: ValidationStatus
  }

**描述**: 需要补充该interface的用途和设计意图说明

**字段说明**:
```typescript
// TODO: 列出所有字段及其类型和用途
```

---

## DailyValidationConfig

**类型**: interface

**位置**: `src\types\modules\doc-validation.types.ts`

**缺失语义**: DailyValidationConfig, rootDir, scanSince, scanUntil, autoUpdate, concurrency, outputDir

**描述**: 需要补充该interface的用途和设计意图说明

**字段说明**:
```typescript
// TODO: 列出所有字段及其类型和用途
```

---

## SubValidatorResult

**类型**: interface

**位置**: `src\types\modules\doc-validation.types.ts`

**缺失语义**: SubValidatorResult, readonly ValidationFinding[], scannedCount

**描述**: 需要补充该interface的用途和设计意图说明

**字段说明**:
```typescript
// TODO: 列出所有字段及其类型和用途
```

---

## DocMeta

**类型**: interface

**位置**: `src\types\modules\doc-validation.types.ts`

**缺失语义**: DocMeta, codeDependencies, readonly string[]

**描述**: 需要补充该interface的用途和设计意图说明

**字段说明**:
```typescript
// TODO: 列出所有字段及其类型和用途
```

---

## ApiParameter

**类型**: interface

**位置**: `src\types\modules\doc-validation.types.ts`

**缺失语义**: ApiParameter

**描述**: 需要补充该interface的用途和设计意图说明

**字段说明**:
```typescript
// TODO: 列出所有字段及其类型和用途
```

---

## ApiContract

**类型**: interface

**位置**: `src\types\modules\doc-validation.types.ts`

**缺失语义**: ApiContract, functionName, readonly ApiParameter[], returnType, docPath

**描述**: 需要补充该interface的用途和设计意图说明

**字段说明**:
```typescript
// TODO: 列出所有字段及其类型和用途
```

---

## QualityScores

**类型**: interface

**位置**: `src\types\modules\doc-validation.types.ts`

**缺失语义**: QualityScores, linkHealth, contractMatch

**描述**: 需要补充该interface的用途和设计意图说明

**字段说明**:
```typescript
// TODO: 列出所有字段及其类型和用途
```

---

## ContractMismatch

**类型**: interface

**位置**: `src\types\modules\doc-validation.types.ts`

**缺失语义**: ContractMismatch

**描述**: 需要补充该interface的用途和设计意图说明

**字段说明**:
```typescript
// TODO: 列出所有字段及其类型和用途
```

---

## QualityIssues

**类型**: interface

**位置**: `src\types\modules\doc-validation.types.ts`

**缺失语义**: QualityIssues, staleDocs, readonly string[], brokenLinks, readonly string[], contractMismatches, readonly ContractMismatch[]

**描述**: 需要补充该interface的用途和设计意图说明

**字段说明**:
```typescript
// TODO: 列出所有字段及其类型和用途
```

---

## QualitySnapshot

**类型**: interface

**位置**: `src\types\modules\doc-validation.types.ts`

**缺失语义**: QualitySnapshot, QualityScores, QualityIssues

**描述**: 需要补充该interface的用途和设计意图说明

**字段说明**:
```typescript
// TODO: 列出所有字段及其类型和用途
```

---

## QualityGate

**类型**: interface

**位置**: `src\types\modules\doc-validation.types.ts`

**缺失语义**: minCoverage, minFreshness, maxBrokenLinks, minContractMatch

**描述**: 需要补充该interface的用途和设计意图说明

**字段说明**:
```typescript
// TODO: 列出所有字段及其类型和用途
```

---