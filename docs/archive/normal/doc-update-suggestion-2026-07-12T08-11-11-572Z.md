---
title: docs/archive/normal/doc-update-suggestion-2026-07-12T08-11-11-572Z.md
code_version: 2.0.0-rc.2
version: v1.0.1
last_updated: 2026-08-22
change_log:
  - version: v1.0.1
    changes: "基准日校对(2026-08-22)：R1取真值(P4-else 新建 v1.0.0（无任何版本信息）=v1.0.0) → R2 PATCH++(v1.0.1) / last_updated 刷新 / change_log 闭环"
    date: 2026-08-22
---

# 文档更新建议草稿

> 生成时间: 2026-07-12T08:11:11.573Z
> 生成方式: 模板生成（LLM 不可用）
> 状态: 待人工审核

---

**⚠️ 重要提示**: 此文件为自动生成的草稿，需人工审核后再合并到正式文档中。

---

# 文档更新建议（模板生成）

> 生成时间: 2026-07-12T08:11:11.571Z
> 扫描模式: 仅变更文件
> 总符号数: 55 | 缺失符号数: 3

---

## DataBridge

**类型**: class

**位置**: `src\core\databridge.ts`

**缺失语义**: subscribers, fallbackQueue, handlerRegistry, readCache, query, waitForDbReady, tryServeFromCache, assertQueryAcl, executeQueryAction, assertQueryGetKey, assertQueryByIndexKey, invalidateCache, buildCacheKey, writeQueryAuditLog, forward, routeToAction, subscribe, getMatchingSubscribers, extractSymbolFromPayload, isMarketEnvelope, assertAclWithFallback, routeToQuery, routeToEvent, retryFailed, routeToDB, routeToManager, writeAuditLog, broadcast

**描述**: 需要补充该class的用途和设计意图说明

**属性说明**:
```typescript
// subscribers: [类型] - [描述]
// fallbackQueue: [类型] - [描述]
// handlerRegistry: [类型] - [描述]
// readCache: [类型] - [描述]
```

**方法说明**:
```typescript
// query(): [返回类型] - [描述]
// waitForDbReady(): [返回类型] - [描述]
// tryServeFromCache(): [返回类型] - [描述]
// assertQueryAcl(): [返回类型] - [描述]
// executeQueryAction(): [返回类型] - [描述]
// assertQueryGetKey(): [返回类型] - [描述]
// assertQueryByIndexKey(): [返回类型] - [描述]
// invalidateCache(): [返回类型] - [描述]
// buildCacheKey(): [返回类型] - [描述]
// writeQueryAuditLog(): [返回类型] - [描述]
// forward(): [返回类型] - [描述]
// routeToAction(): [返回类型] - [描述]
// subscribe(): [返回类型] - [描述]
// getMatchingSubscribers(): [返回类型] - [描述]
// extractSymbolFromPayload(): [返回类型] - [描述]
// isMarketEnvelope(): [返回类型] - [描述]
// assertAclWithFallback(): [返回类型] - [描述]
// routeToQuery(): [返回类型] - [描述]
// routeToEvent(): [返回类型] - [描述]
// retryFailed(): [返回类型] - [描述]
// routeToDB(): [返回类型] - [描述]
// routeToManager(): [返回类型] - [描述]
// writeAuditLog(): [返回类型] - [描述]
// broadcast(): [返回类型] - [描述]
```

**使用示例**:
```typescript
// TODO: 添加使用示例
```

---

## DataFlowEngine

**类型**: class

**位置**: `src\core\dataflow\dataflowEngine.ts`

**缺失语义**: subscribers, cache, cacheMaxEntries, cacheStats, channelMeta, eventSource, connected, seqCounter, connectionListeners, refreshTimers, reconnectAttempts, reconnectTimer, maxReconnectDelay, maxReconnectAttempts, connect, _handleSseMessage, disconnect, subscribe, getCached, publish, _evictIfNeeded, setCacheMaxEntries, registerRefresh, stopRefresh, _distribute, _scheduleReconnect, _tryReconnect, _fallbackToPolling, _notifyConnectionChange, onConnectionChange, getStats, getCacheStats, destroy

**描述**: 需要补充该class的用途和设计意图说明

**属性说明**:
```typescript
// subscribers: [类型] - [描述]
// cache: [类型] - [描述]
// cacheMaxEntries: [类型] - [描述]
// cacheStats: [类型] - [描述]
// channelMeta: [类型] - [描述]
// eventSource: [类型] - [描述]
// connected: [类型] - [描述]
// seqCounter: [类型] - [描述]
// connectionListeners: [类型] - [描述]
// refreshTimers: [类型] - [描述]
// reconnectAttempts: [类型] - [描述]
// reconnectTimer: [类型] - [描述]
// maxReconnectDelay: [类型] - [描述]
// maxReconnectAttempts: [类型] - [描述]
```

**方法说明**:
```typescript
// connect(): [返回类型] - [描述]
// _handleSseMessage(): [返回类型] - [描述]
// disconnect(): [返回类型] - [描述]
// subscribe(): [返回类型] - [描述]
// getCached(): [返回类型] - [描述]
// publish(): [返回类型] - [描述]
// _evictIfNeeded(): [返回类型] - [描述]
// setCacheMaxEntries(): [返回类型] - [描述]
// registerRefresh(): [返回类型] - [描述]
// stopRefresh(): [返回类型] - [描述]
// _distribute(): [返回类型] - [描述]
// _scheduleReconnect(): [返回类型] - [描述]
// _tryReconnect(): [返回类型] - [描述]
// _fallbackToPolling(): [返回类型] - [描述]
// _notifyConnectionChange(): [返回类型] - [描述]
// onConnectionChange(): [返回类型] - [描述]
// getStats(): [返回类型] - [描述]
// getCacheStats(): [返回类型] - [描述]
// destroy(): [返回类型] - [描述]
```

**使用示例**:
```typescript
// TODO: 添加使用示例
```

---

## ReportGenerator

**类型**: class

**位置**: `src\services\hybrid-proofread\reportGenerator.ts`

**缺失语义**: generateReport, countIssues, calculateOverallRiskLevel, generateSummary, appendRecommendation, generateRecommendations, exportReport, generateMarkdownReport, generateHtmlReport, getRiskLevelLabel

**描述**: 需要补充该class的用途和设计意图说明

**属性说明**:
```typescript
// TODO: 列出所有属性及其类型和用途
```

**方法说明**:
```typescript
// generateReport(): [返回类型] - [描述]
// countIssues(): [返回类型] - [描述]
// calculateOverallRiskLevel(): [返回类型] - [描述]
// generateSummary(): [返回类型] - [描述]
// appendRecommendation(): [返回类型] - [描述]
// generateRecommendations(): [返回类型] - [描述]
// exportReport(): [返回类型] - [描述]
// generateMarkdownReport(): [返回类型] - [描述]
// generateHtmlReport(): [返回类型] - [描述]
// getRiskLevelLabel(): [返回类型] - [描述]
```

**使用示例**:
```typescript
// TODO: 添加使用示例
```

---