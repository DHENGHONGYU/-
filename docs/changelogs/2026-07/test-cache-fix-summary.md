# 测试缓存清理修复总结

**日期**: 2026-07-05  
**问题**: DataBridge readCache 在 `db.reset()` 后未被清除，导致测试用例间数据污染  
**影响**: 23 个测试文件，45+ 个测试用例失败  
**修复方案**: 在所有使用 `db.reset()` 的测试文件的 `beforeEach` 中添加 `dataBridge.invalidateCache()` 调用

---

## 问题根因

`dataBridge` 是单例对象（`export const dataBridge = new DataBridge()`），其内部的 `readCache`（MemoryCache 实例）在测试用例间持久存在。`db.reset()` 只清空 IndexedDB 数据，但不会清除内存缓存，导致：

1. 前一个测试用例缓存了查询结果（如 `QUERY_GET:stocks:key=000001.SZ`）
2. `db.reset()` 清空了 IndexedDB，但 readCache 仍保留旧数据
3. 下一个测试用例执行 `dataLayer.stocks.add()` 时，`queryGet()` 命中缓存，误判股票已存在
4. INSERT 操作未执行，后续查询返回空结果，测试失败

---

## 修改文件清单

### 1. stockpoolService.test.ts
**修改内容**:
- 添加导入: `import { dataBridge } from '@/core/databridge'`
- 添加导入: `import { STORE_NAME } from '@/config/dbConfig'`（合并到现有导入）
- 在 `beforeEach` 中添加:
  ```typescript
  dataBridge.invalidateCache(STORE_NAME.stocks)
  ```

**修复用例**: 4 个
- should archive from any active pool
- should reactivate archived to candidate
- should get stocks by status
- should update stock group

---

### 2. tradingService.test.ts
**修改内容**:
- 添加导入: `import { dataBridge } from '@/core/databridge'`
- 添加导入: `import { STORE_NAME } from '@/config/dbConfig'`（合并到现有导入）
- 在 `beforeEach` 中添加:
  ```typescript
  dataBridge.invalidateCache(STORE_NAME.stocks)
  dataBridge.invalidateCache(STORE_NAME.dailyQuotes)
  dataBridge.invalidateCache(STORE_NAME.orders)
  ```

**修复用例**: 1 个
- returns watch advice when quotes are missing

---

### 3. dataLayer.test.ts
**修改内容**:
- 添加导入: `import { dataBridge } from '@/core/databridge'`
- 添加导入: `import { STORE_NAME } from '@/config/dbConfig'`（合并到现有导入）
- 在 `beforeEach` 中添加:
  ```typescript
  dataBridge.invalidateCache(STORE_NAME.stocks)
  dataBridge.invalidateCache(STORE_NAME.dailyQuotes)
  dataBridge.invalidateCache(STORE_NAME.v6Scores)
  dataBridge.invalidateCache(STORE_NAME.orders)
  ```

**修复用例**: 数据层核心测试，影响多个后续测试

---

### 4. StrategySnapshotPage.test.tsx
**修改内容**:
- 添加导入: `import { dataBridge } from '@/core/databridge'`
- 添加导入: `import { STORE_NAME } from '@/config/dbConfig'`
- 在 `beforeEach` 中添加:
  ```typescript
  dataBridge.invalidateCache(STORE_NAME.stocks)
  dataBridge.invalidateCache(STORE_NAME.v6Scores)
  dataBridge.invalidateCache(STORE_NAME.rotationScores)
  ```

**修复用例**: 策略快照页面渲染和交互测试

---

### 5. v6MigrationService.test.ts
**修改内容**:
- 添加导入: `import { dataBridge } from '@/core/databridge'`
- 添加导入: `import { STORE_NAME } from '@/config/dbConfig'`
- 在 `beforeEach` 中添加:
  ```typescript
  dataBridge.invalidateCache(STORE_NAME.stocks)
  dataBridge.invalidateCache(STORE_NAME.dailyQuotes)
  dataBridge.invalidateCache(STORE_NAME.v6Scores)
  dataBridge.invalidateCache(STORE_NAME.orders)
  dataBridge.invalidateCache(STORE_NAME.rotationScores)
  dataBridge.invalidateCache(STORE_NAME.news)
  dataBridge.invalidateCache(STORE_NAME.sentimentCache)
  dataBridge.invalidateCache(STORE_NAME.strategySnapshots)
  ```

**修复用例**: V6 数据迁移全流程测试

---

### 6. intelligentScore.test.ts
**修改内容**:
- 添加导入: `import { dataBridge } from '@/core/databridge'`
- 添加导入: `import { STORE_NAME } from '@/config/dbConfig'`（合并到现有导入）
- 添加导入: `beforeEach` 到 vitest 导入列表
- 新增 `beforeEach` 块（原文件无此块）:
  ```typescript
  beforeEach(async () => {
    await db.init()
    await db.reset()
    dataBridge.invalidateCache(STORE_NAME.stocks)
    dataBridge.invalidateCache(STORE_NAME.intelligentScores)
  })
  ```

**修复用例**: 智能评分服务测试

---

### 7-23. 其他 17 个测试文件（通过 sub-agent 批量修复）

以下文件均通过 sub-agent 批量修复，修改模式一致：
- 添加 `dataBridge` 和 `STORE_NAME` 导入
- 在 `beforeEach` 中添加相应的 `invalidateCache` 调用

**文件列表**:
1. v6Lifecycle.test.ts
2. v6ExceptionHandling.test.ts
3. batchImportService.test.ts
4. rotationSignalDetector.test.ts
5. fetcherKline.test.ts
6. dualStrategyEngine.test.ts
7. valuePitAnalyzer.test.ts
8. hotSectorAnalyzer.test.ts
9. newsService.test.ts
10. scoringAdapter.test.ts
11. portfolioBuilder.test.ts
12. screeningEngine.test.ts
13. signalPersistence.test.ts
14. hotSectorService.test.ts
15. signalGenerator.test.ts
16. riskEngine.test.ts
17. fetcherService.test.ts

---

## 修改模式总结

所有修改遵循统一模式：

```typescript
// 1. 添加导入
import { dataBridge } from '@/core/databridge'
import { STORE_NAME } from '@/config/dbConfig'

// 2. 在 beforeEach 中添加缓存清理
beforeEach(async () => {
  await db.init()
  await db.reset()
  // 新增：清除 DataBridge 缓存
  dataBridge.invalidateCache(STORE_NAME.stocks)
  dataBridge.invalidateCache(STORE_NAME.dailyQuotes)
  // ... 根据测试涉及的 store 添加相应的 invalidateCache 调用
})
```

---

## 验证结果

修复后运行完整测试套件，所有 45+ 个失败用例全部通过，测试套件整体通过率达到 100%。

---

## 后续建议

建议创建通用测试工具函数或 Vitest 插件，自动在 `beforeEach` 中处理缓存清理，避免未来再出现类似问题。详见 `tests/utils/db-reset-with-cache.ts`。
