# tsc:test 冻结基线 — 2026-08-05

> **状态**：🧊 FROZEN（冻结）→ 部分偿还中  
> **冻结日期**：2026-08-05  
> **最后更新**：2026-08-05（补充修复方案列、记录 #27 偿还、新增非冻结错误清单、记录 8 项追加测试修复与全量构建验证通过）  
> **基线版本**：commit 72dccb97 (fix/autorecover-test-comment)  
> **冻结人**：体系化双向回归检查  
> **关联技能**：v9-tsc-test-error-diagnosis, v9-tsc-gate-scope-audit

---

## 1. 冻结背景

在 2026-08-05 双向回归检查中，`tsc:prod` 退出码为 0（绿灯），但 `tsc:test`（`tsc -p tsconfig.test.json --noEmit`）退出码为 2，存在 27 个类型错误。

这 27 个错误**全部为预存债务**，均非 2026-08-03~08-05 新引入。近三天新增的测试文件（profileService.test.ts、db.test.ts、analyzer.test.ts、zIndexDebugLogger.test.ts、localStorageManager.test.ts、infrastructure-extreme.test.ts、seedService.test.ts、rebalancePortfolio.useCase.test.ts）中的类型漂移已在本次检查中全部修复（共修复 36 个错误）。

为防止"新错误"与"旧债务"混淆，特将剩余 27 个错误冻结为基线，纳入债务偿还 Sprint 计划。

### 1.1 2026-08-05 后续更新

在同步 ProfileItem 新增必填字段（`sentiment` / `relatedLayers`）到测试用例时：
- **偿还 #27**：`profile-types.spec.ts(335,17)` 的 `assertNever` 误用已修复
- **发现 #1、#2 已消失**：`HotSectorWidget.test.tsx:23` 和 `IndustryV4Radar-SubIndicatorBar.logger.test.tsx:11` 的错误在最新 tsc:test 中不再出现（可能被其他改动顺带修复）
- **冻结基线剩余**：27 - 1(#27 偿还) - 2(#1/#2 消失) = **24 个仍在冻结**
- **新发现 49 个非冻结错误**：详见 §3
- **新发现 tsc:prod P0 问题**：详见 §4（import 嵌套导致 75 个语法错误）

---

## 2. 冻结基线明细（原 27 项 → 剩余 24 项）

### 2.1 行业图表测试（原 6 项 → 剩余 3 项）

| # | 文件 | 行 | 错误码 | 错误信息 | 状态 | 修复方案 |
|---|------|----|--------|---------|------|---------|
| 1 | `src/cockpit/widgets/HotSectorWidget.test.tsx` | 23 | TS6192 | All imports in import declaration are unused | ✅ 已消失 | 无需修复（可能被其他改动顺带修复） |
| 2 | `src/components/chart/industry/IndustryV4Radar-SubIndicatorBar.logger.test.tsx` | 11 | TS6133 | 'React' is declared but its value is never read | ✅ 已消失 | 无需修复（可能被其他改动顺带修复） |
| 3 | `src/components/chart/industry/TrendLineChart.test.tsx` | 38 | TS18046 | 'captured.lines' is of type 'unknown' | 🧊 冻结 | 补 `as Line[]` 类型断言 |
| 4 | `src/components/chart/industry/TrendLineChart.test.tsx` | 60 | TS18046 | 'captured.referenceLines' is of type 'unknown' | 🧊 冻结 | 补 `as ReferenceLine[]` 类型断言 |
| 5 | `src/components/chart/industry/ValuationDistribution.test.tsx` | 64 | TS18046 | 'captured.cells' is of type 'unknown' | 🧊 冻结 | 补 `as Cell[]` 类型断言 |

**冻结理由**：行业图表模块在 M2 后暂停迭代，测试锁定。`captured.*` 为 mock 捕获对象，类型推断为 `unknown`，需补 `as` 断言。

### 2.2 IDB 预检测试（7 项，全部冻结）

| # | 文件 | 行 | 错误码 | 错误信息 | 状态 | 修复方案 |
|---|------|----|--------|---------|------|---------|
| 6 | `src/core/idbPreflight.test.ts` | 129 | TS2540 | Cannot assign to 'result' (read-only) | 🧊 冻结 | 用 `Object.defineProperty` 替代直接赋值 |
| 7 | `src/core/idbPreflight.test.ts` | 130 | TS2540 | Cannot assign to 'error' (read-only) | 🧊 冻结 | 用 `Object.defineProperty` 替代直接赋值 |
| 8 | `src/core/idbPreflight.test.ts` | 163 | TS2322 | Mock type not assignable to IDBObjectStore | 🧊 冻结 | 补全 Mock 的 14+ 个 IDBObjectStore 属性 |
| 9 | `src/core/idbPreflight.test.ts` | 184 | TS2540 | Cannot assign to 'result' (read-only) | 🧊 冻结 | 用 `Object.defineProperty` 替代直接赋值 |
| 10 | `src/core/idbPreflight.test.ts` | 188 | TS2540 | Cannot assign to 'error' (read-only) | 🧊 冻结 | 用 `Object.defineProperty` 替代直接赋值 |
| 11 | `src/core/idbPreflight.test.ts` | 306 | TS2322 | Mock type not assignable to IDBObjectStore | 🧊 冻结 | 补全 Mock 的 14+ 个 IDBObjectStore 属性 |
| 12 | `src/core/idbPreflight.test.ts` | 326 | TS2540 | Cannot assign to 'result' (read-only) | 🧊 冻结 | 用 `Object.defineProperty` 替代直接赋值 |

**冻结理由**：IDB 预检模块为 P3 优先级。Mock 对象的 readonly 属性赋值需重构 mock 策略，建议使用 `vi.stubGlobal` 或 `Object.defineProperty` 方案。

### 2.3 交易用例测试（9 项，全部冻结）

| # | 文件 | 行 | 错误码 | 错误信息 | 状态 | 修复方案 |
|---|------|----|--------|---------|------|---------|
| 13 | `tests/__tests__/services/trading-use-cases.test.ts` | 47 | TS2739 | Missing 'amount, accountType' from type 'Order' | 🧊 冻结 | 补全 mock Order 的 `amount` 和 `accountType` 字段 |
| 14 | `tests/__tests__/services/trading-use-cases.test.ts` | 68 | TS2739 | Missing 'amount, accountType' from type 'Order' | 🧊 冻结 | 同上 |
| 15 | `tests/__tests__/services/trading-use-cases.test.ts` | 79 | TS2532 | Object is possibly 'undefined' | 🧊 冻结 | 补可选链 `?.` 或非空断言 `!` |
| 16 | `tests/__tests__/services/trading-use-cases.test.ts` | 120 | TS2739 | Missing 'amount, accountType' from type 'Order' | 🧊 冻结 | 同 #13 |
| 17 | `tests/__tests__/services/trading-use-cases.test.ts` | 130 | TS2532 | Object is possibly 'undefined' | 🧊 冻结 | 补可选链 `?.` 或非空断言 `!` |
| 18 | `tests/__tests__/services/trading-use-cases.test.ts` | 143 | TS2739 | Missing 'amount, accountType' from type 'Order' | 🧊 冻结 | 同 #13 |
| 19 | `tests/__tests__/services/trading-use-cases.test.ts` | 164 | TS2739 | Missing 'amount, accountType' from type 'Order' | 🧊 冻结 | 同 #13 |
| 20 | `tests/__tests__/services/trading-use-cases.test.ts` | 175 | TS2532 | Object is possibly 'undefined' | 🧊 冻结 | 补可选链 `?.` 或非空断言 `!` |
| 21 | `tests/__tests__/services/trading-use-cases.test.ts` | 222 | TS2739 | Missing 'amount, accountType' from type 'Order' | 🧊 冻结 | 同 #13 |

**冻结理由**：`Order` 接口在 T3 升级中新增了 `amount` 和 `accountType` 字段，但交易用例测试的 mock 数据未跟随更新。需批量补全 mock Order 对象的缺失字段。

### 2.4 其他零散（原 5 项 → 剩余 4 项）

| # | 文件 | 行 | 错误码 | 错误信息 | 状态 | 修复方案 |
|---|------|----|--------|---------|------|---------|
| 22 | `src/core/transaction.test.ts` | 86 | TS6133 | 'spy' is declared but its value is never read | 🧊 冻结 | 删除未使用变量或加 `_` 前缀 |
| 23 | `src/lib/validation/marketDataContract.test.ts` | 205 | TS2339 | Property 'severity' does not exist on type '{ field: string; rule: string; }' | 🧊 冻结 | 从 mock 移除 `severity` 字段，或补到 ValidationRule 类型 |
| 24 | `src/lib/validation/marketDataContract.test.ts` | 309 | TS2339 | Property 'severity' does not exist on type '{ field: string; rule: string; }' | 🧊 冻结 | 同 #23 |
| 25 | `src/store/systemMonitorStore.test.ts` | 432 | TS6133 | 'initialSubs' is declared but its value is never read | 🧊 冻结 | 删除未使用变量 |
| 26 | `tests/__tests__/services/orchestration/scoreCalibrator.test.ts` | 379 | TS2532 | Object is possibly 'undefined' | 🧊 冻结 | 补可选链 `?.` 或非空断言 `!` |
| 27 | `tests/__tests__/types/profile-types.spec.ts` | 335 | TS2344 | Type 'true' does not satisfy the constraint 'never' | ✅ 已偿还 | `assertNever<Equals<X,X>>()` → `assertNever<never>()` |

**冻结理由**：各自 P3 优先级，无运行时影响。`severity` 字段为测试 mock 对象多出的字段（源码 ValidationRule 类型无此字段）；`profile-types.spec.ts` 的 `never` 约束为类型级测试断言写法问题（已于 2026-08-05 修复）。

---

## 3. 非冻结错误清单（49 项 — 2026-08-05 新发现）

> **警示**：这些错误不在原冻结基线中，属于基线建立时遗漏或后续引入的错误。  
> 根据门禁策略，**非冻结错误必须立即修复，不允许追加到冻结基线**。

### 3.1 Widget 空安全回归测试（7 项）

| # | 文件 | 行 | 错误码 | 错误信息 | 修复方案 |
|---|------|----|--------|---------|---------|
| 1 | `src/cockpit/widgets/WidgetNullSafety.regression.test.tsx` | 60 | TS2352 | WatchlistData 转换不兼容 (price: undefined) | 改用 `as unknown as WatchlistData` 两步转换 |
| 2 | 同上 | 71 | TS2352 | WatchlistData 转换不兼容 (changePercent: undefined) | 同上 |
| 3 | 同上 | 82 | TS2352 | WatchlistData 转换不兼容 (price+changePercent: undefined) | 同上 |
| 4 | 同上 | 106 | TS2352 | WatchlistData 转换不兼容 | 同上 |
| 5 | 同上 | 126 | TS2352 | MarketIndexData 转换不兼容 (price: undefined) | 改用 `as unknown as MarketIndexData` 两步转换 |
| 6 | 同上 | 137 | TS2352 | MarketIndexData 转换不兼容 (change+changePercent: undefined) | 同上 |
| 7 | 同上 | 163 | TS2352 | MarketIndexData 转换不兼容 (全部 undefined) | 同上 |

**根因**：`WatchlistData` / `MarketIndexData` 的 `price` / `change` / `changePercent` 声明为可选（`number | undefined`），但测试用 `as WatchlistData` 直接转换包含 `undefined` 的对象字面量时 TS 拒绝。需用 `as unknown as` 两步转换。

### 3.2 ACL 版本覆盖测试（5 项）

| # | 文件 | 行 | 错误码 | 错误信息 | 修复方案 |
|---|------|----|--------|---------|---------|
| 8 | `src/core/acl.versionedOverrides.test.ts` | 5 | TS6133 | 'inferOperation' 未使用 | 删除未使用导入 |
| 9 | 同上 | 6 | TS6133 | 'AclCheckResult' 未使用 | 删除未使用导入 |
| 10 | 同上 | 9 | TS6133 | 'registerBuiltinVersionedOverrides' 未使用 | 删除未使用导入 |
| 11 | 同上 | 11 | TS6133 | 'StoreName' 未使用 | 删除未使用导入 |
| 12 | 同上 | 475 | TS6133 | 'engineBuiltin' 未使用 | 删除未使用变量 |

### 3.3 DataBridge 转发处理器测试（9 项）

| # | 文件 | 行 | 错误码 | 错误信息 | 修复方案 |
|---|------|----|--------|---------|---------|
| 13 | `src/core/databridge.forward-handler.test.ts` | 9 | TS6133 | 'StoreName' 未使用 | 删除未使用导入 |
| 14 | 同上 | 27 | TS2322 | string 不能赋值给 EnvelopeAction | 用 `as EnvelopeAction` 或补类型断言 |
| 15 | 同上 | 227 | TS6133 | 'putSpy' 未使用 | 删除未使用变量 |
| 16 | 同上 | 229 | TS2345 | 回调参数类型不兼容 | 标注参数类型 `(store: string, val: unknown, key: string)` |
| 17 | 同上 | 229 | TS7006 | 'store' 隐式 any | 补类型标注 `store: string` |
| 18 | 同上 | 229 | TS6133 | 'val' 未使用 | 加 `_` 前缀或删除 |
| 19 | 同上 | 229 | TS7006 | 'val' 隐式 any | 补类型标注 `val: unknown` |
| 20 | 同上 | 229 | TS6133 | 'key' 未使用 | 加 `_` 前缀或删除 |
| 21 | 同上 | 229 | TS7006 | 'key' 隐式 any | 补类型标注 `key: string` |

### 3.4 DB 连接测试（1 项）

| # | 文件 | 行 | 错误码 | 错误信息 | 修复方案 |
|---|------|----|--------|---------|---------|
| 22 | `src/data/db-connection.test.ts` | 476 | TS6133 | 'firstDb' 未使用 | 删除未使用变量 |

### 3.5 localStorage 管理器测试（1 项）

| # | 文件 | 行 | 错误码 | 错误信息 | 修复方案 |
|---|------|----|--------|---------|---------|
| 23 | `src/lib/localStorageManager.test.ts` | 10 | TS6133 | 'afterEach' 未使用 | 删除未使用导入 |

### 3.6 Store 审计分析器测试（10 项）

| # | 文件 | 行 | 错误码 | 错误信息 | 修复方案 |
|---|------|----|--------|---------|---------|
| 24 | `src/lib/store-audit/analyzer.test.ts` | 78 | TS2532 | Object is possibly 'undefined' | 补非空断言 `!` 或可选链 `?.` |
| 25 | 同上 | 79 | TS2532 | 同上 | 同上 |
| 26 | 同上 | 80 | TS2532 | 同上 | 同上 |
| 27 | 同上 | 81 | TS2532 | 同上 | 同上 |
| 28 | 同上 | 88 | TS2532 | 同上 | 同上 |
| 29 | 同上 | 89 | TS2532 | 同上 | 同上 |
| 30 | 同上 | 96 | TS2532 | 同上 | 同上 |
| 31 | 同上 | 264 | TS2532 | 同上 | 同上 |
| 32 | 同上 | 272 | TS2532 | 同上 | 同上 |
| 33 | 同上 | 280 | TS2532 | 同上 | 同上 |

### 3.7 z-index 调试日志测试（3 项）

| # | 文件 | 行 | 错误码 | 错误信息 | 修复方案 |
|---|------|----|--------|---------|---------|
| 34 | `src/lib/zIndexDebugLogger.test.ts` | 34 | TS6133 | 'getUtils' 未使用 | 删除未使用变量 |
| 35 | 同上 | 34 | TS6133 | 'devVal' 未使用 | 删除未使用变量 |
| 36 | 同上 | 681 | TS2352 | MutationRecord 转换不兼容 | 改用 `as unknown as MutationRecord` 两步转换 |

### 3.8 种子服务测试（9 项）

| # | 文件 | 行 | 错误码 | 错误信息 | 修复方案 |
|---|------|----|--------|---------|---------|
| 37 | `src/services/system/seedService.test.ts` | 136 | TS18046 | 'payload' is of type 'unknown' | 补类型断言 `as SeedPayload` |
| 38 | 同上 | 137 | TS18046 | 同上 | 同上 |
| 39 | 同上 | 138 | TS18046 | 同上 | 同上 |
| 40 | 同上 | 139 | TS18046 | 同上 | 同上 |
| 41 | 同上 | 140 | TS18046 | 同上 | 同上 |
| 42 | 同上 | 141 | TS18046 | 同上 | 同上 |
| 43 | 同上 | 142 | TS18046 | 同上 | 同上 |
| 44 | 同上 | 143 | TS18046 | 同上 | 同上 |
| 45 | 同上 | 144 | TS18046 | 同上 | 同上 |

### 3.9 再平衡用例测试（2 项）

| # | 文件 | 行 | 错误码 | 错误信息 | 修复方案 |
|---|------|----|--------|---------|---------|
| 46 | `src/services/useCase/rebalancePortfolio.useCase.test.ts` | 174 | TS18048 | 'h.marketValue' is possibly 'undefined' | 补非空断言 `!` 或可选链 `?.` |
| 47 | 同上 | 476 | TS18048 | 同上 | 同上 |

### 3.10 基础设施极限测试（2 项）

| # | 文件 | 行 | 错误码 | 错误信息 | 修复方案 |
|---|------|----|--------|---------|---------|
| 48 | `tests/__tests__/integration/infrastructure-extreme.test.ts` | 264 | TS2322 | '"balanced"' is not assignable to 'StrategyTemplateId' | 改用合法的 StrategyTemplateId 值 |
| 49 | 同上 | 266 | TS2739 | GlobalCollectPolicy 缺少 5 个属性 | 补全 `maxSymbols` / `defaultBatchSize` / `rateLimitPerMinute` / `rateLimitPerHour` / `rateLimitPerDay` |

### 3.11 非冻结错误分类汇总

| 错误码 | 含义 | 数量 | 占比 |
|--------|------|------|------|
| TS6133 | Declared but never read | 14 | 29% |
| TS2532 | Object is possibly 'undefined' | 10 | 20% |
| TS18046 | Is of type 'unknown' | 9 | 18% |
| TS2352 | Conversion may be a mistake | 8 | 16% |
| TS2739 | Missing properties from type | 1 | 2% |
| TS2322 | Type not assignable | 2 | 4% |
| TS2345 | Argument type not assignable | 1 | 2% |
| TS7006 | Parameter implicitly any | 3 | 6% |
| TS18048 | Possibly 'undefined' (access) | 2 | 4% |
| **合计** | — | **49** | 100% |

---

## 4. tsc:prod P0 问题（2026-08-05 新发现 → 2026-08-05 已修复 ✅）

> **状态更新（2026-08-05 22:00）**：本节原描述的 75 个 P0 嵌套 import 错误**已全部修复**。
> 验证命令：`node ./node_modules/typescript/bin/tsc -p tsconfig.prod.json --noEmit` 退出码 = 0。
> 双向回归测试（2026-08-05）抽样验证 15 个文件 import 块已干净，无嵌套 import 残留。
> 详见 `docs/reports/p0-cleanup-acceptance-report-2026-08-05.md` §3 双向测试矩阵。
>
> **历史警告（修复前）**：tsc:prod 实际退出码曾为 2（RED），与本文档 §1 原始描述的"绿灯"矛盾。
> 这是 v9-health-audit SKILL §0 铁律所警告的"文档失准"问题的真实案例。

### 4.1 问题描述（历史状态，已修复）

`tsc -p tsconfig.prod.json --noEmit` 曾报告 75 个语法错误（TS1003 / TS1005 / TS1109 / TS1434），分布在 15 个 src/ 文件中。**截至 2026-08-05，全部 15 个文件已修复，tsc:prod 退出码 = 0。**

### 4.2 根因

**非法嵌套 import**：`import { safeFormatNumber, safeFormatPercent } from '@/lib/format'` 被错误插入到已有 import 块的中间，例如：

```typescript
// src/lib/localStorageManager.ts 第 18-19 行（错误）
import {
import { safeFormatNumber, safeFormatPercent } from '@/lib/format'  // ← 非法嵌套
  type EncryptedPayload,
  getOrCreateCryptoKey,
  ...
} from './localStorageCrypto'
```

### 4.3 受影响文件（15 个）

| # | 文件 | 错误行 |
|---|------|--------|
| 1 | `src/apps/analysis/AnalysisApp.tsx` | 10 |
| 2 | `src/cockpit/widgets/PortfolioOverviewWidget.tsx` | 12 |
| 3 | `src/components/organisms/input/CollectionSwimlane.tsx` | 16 |
| 4 | `src/components/organisms/input/CollectionTimeline.tsx` | 13 |
| 5 | `src/components/organisms/input/TraceReplayPanel.tsx` | 17 |
| 6 | `src/components/organisms/shared/LLMConfigWidget.tsx` | 21 |
| 7 | `src/lib/localStorageManager.ts` | 19 |
| 8 | `src/pages/output/ProfileBrowsePage.tsx` | 77 |
| 9 | `src/services/file-import/proofreadReportGenerator.ts` | 15 |
| 10 | `src/services/file-import/unifiedFileValidator.ts` | 20 |
| 11 | `src/services/hybrid-proofread/cloudSyncClient.ts` | 6 |
| 12 | `src/services/output/factorDashboard.ts` | 13 |
| 13 | `src/services/scoring/v6ScoreService.ts` | 26 |
| 14 | `src/services/stock-analysis/scoringStrategy.ts` | 45 |
| 15 | `src/services/useCase/getUnifiedStockView.useCase.ts` | 14 |

### 4.4 修复方案（已执行 ✅）

将嵌套的 `import { safeFormatNumber, safeFormatPercent } from '@/lib/format'` 提取到文件顶部作为独立 import 语句，从原有 import 块中移除。

**优先级**：P0（阻塞构建，必须立即修复）

**执行状态（2026-08-05）**：✅ 已完成。15 个文件全部修复，tsc:prod 退出码 = 0。
- 双向回归测试：正向验证 tsc:prod 退出码 = 0；逆向验证 Grep `import\s*\{[^}]*\bimport\b` 在 src/**/*.ts* 中 0 匹配。
- 验收报告：`docs/reports/p0-cleanup-acceptance-report-2026-08-05.md`
- 清理脚本：`scripts/p0-cleanup.sh`（10 步自动化验证）

---

## 5. 错误分类汇总（更新后）

### 5.1 冻结基线（原 27 → 剩余 24）

| 错误码 | 含义 | 数量 |
|--------|------|------|
| TS2739 | Missing properties from type | 7 |
| TS2540 | Cannot assign to read-only property | 5 |
| TS2532 | Object is possibly 'undefined' | 4 |
| TS6133 | Declared but never read | 2 |
| TS18046 | Is of type 'unknown' | 3 |
| TS2322 | Type not assignable | 2 |
| TS6192 | All imports unused | 0（已消失）|
| TS2339 | Property does not exist | 2 |
| TS2344 | Type does not satisfy constraint | 0（已偿还）|
| **合计** | — | **24** |

### 5.2 非冻结错误（49 项）

详见 §3.11。

### 5.3 tsc:prod P0（原 75 项 → 已修复 0 项 ✅）

详见 §4。**2026-08-05 22:00 已全部修复，tsc:prod 退出码 = 0。**

---

## 6. 偿还计划

### Sprint 0（立即，P0）
- **tsc:prod import 嵌套修复**（§4，15 个文件）：将嵌套的 `import { safeFormatNumber, safeFormatPercent } from '@/lib/format'` 提取为独立 import。预计 0.5 人日。

### Sprint 1（本周，P2）
- **非冻结错误修复**（§3，49 项）：按文件分批修复，优先处理 TS6133（14 项，删除未使用变量/导入）和 TS2532（10 项，补非空断言）。预计 1.5 人日。
- **交易用例测试**（#13-21，9 项）：批量补全 mock Order 对象的 `amount` 和 `accountType` 字段。预计 0.5 人日。
- **marketDataContract 测试**（#23-24，2 项）：从 mock 对象中移除 `severity` 字段或补到 ValidationRule 类型。预计 0.5 人日。

### Sprint 2（下周，P3）
- **IDB 预检测试**（#6-12，7 项）：重构 mock 策略，使用 `Object.defineProperty` 或 `vi.stubGlobal` 替代直接赋值 readonly 属性。预计 1 人日。
- **行业图表测试**（#3-5，3 项）：补 `as` 类型断言到 `captured.*` 变量。预计 0.5 人日。

### Sprint 3（迭代末，P3）
- **其他零散**（#22, #25-26，3 项）：移除未使用变量、补可选链。预计 0.5 人日。

**预计总工时**：~5 人日

---

## 7. 门禁策略

- `tsc:test` 在 husky pre-commit 中保持 **非 BLOCK** 模式（当前状态）
- `tsc:prod` 在 husky pre-commit 中保持 **BLOCK** 模式（当前状态，但因 §4 P0 问题实际为 RED）
- 新增的 tsc:test 错误（不在本基线中的）**必须立即修复**，不允许追加到冻结基线
- 每次偿还 Sprint 完成后，更新本文件的"冻结基线明细"段落，删除已修复项，并在本文末记录偿还记录
- 冻结基线数量应**单调递减**，禁止新增

---

## 8. 偿还记录

| 日期 | 偿还项 | 修复人 | 剩余 | 备注 |
|------|--------|--------|------|------|
| 2026-08-05 | 基线建立 | 体系化检查 | 27 | 初始冻结 |
| 2026-08-05 | #27 profile-types.spec.ts:335 assertNever 误用 | ProfileItem 同步任务 | 26 | 改为 `assertNever<never>()` |
| 2026-08-05 | #1 HotSectorWidget.test.tsx:23 | 未知（顺带修复） | 25 | 已消失 |
| 2026-08-05 | #2 IndustryV4Radar-SubIndicatorBar.logger.test.tsx:11 | 未知（顺带修复） | 24 | 已消失 |
| 2026-08-05 | 发现 49 个非冻结错误 + 75 个 tsc:prod P0 | 本次审计 | 24+49 | 详见 §3、§4 |

---

## 9. vitest 测试套件运行结果（2026-08-05）

> **执行命令**：`npx vitest run --no-coverage --reporter=dot`
> **退出码**：1（失败）
> **时长**：848.89s（约 14 分钟）

### 9.1 总体统计

| 指标 | 数值 |
|------|------|
| 测试文件总数 | 526 |
| 通过测试文件 | 518 |
| 失败测试文件 | 7 |
| 跳过测试文件 | 1 |
| 测试用例总数 | 9128 |
| 通过测试用例 | 9091 |
| 失败测试用例 | 15 |
| 跳过测试用例 | 22 |

### 9.2 失败用例明细（15 项 / 7 文件）

| # | 测试文件 | 失败用例 | 行号 | 错误类型 | 错误信息摘要 |
|---|---------|---------|------|---------|------------|
| 1 | `scripts/verify-logger-components.test.tsx` | IndustryV4Radar 渲染并打印 logger.info | 81 | AssertionError | expected null to be truthy（SVG 未渲染） |
| 2 | 同上 | SubIndicatorBar 渲染并打印 logger.info | 125 | AssertionError | expected null to be truthy（SVG 未渲染） |
| 3 | `tests/e2e-verify-25stocks.integration.test.ts` | 25 只随机抽样全流程端到端校对 | 676 | AssertionError | 池流转应 100%: expected 0 to be 100 |
| 4 | `tests/SectorHeatmapWidget.test.tsx` | renders empty heatmap when sectors array is empty | 78 | TestingLibraryElementError | Unable to find text "暂无数据"（实际显示"加载失败"） |
| 5 | `tests/ui-components.test.tsx` | Toggle > 应该调用 onPressedChange when clicked | 209 | AssertionError | expected spy called with [false], got [true] |
| 6 | 同上 | Toggle > 应该apply variant styles correctly | 227 | Error | expected class "bg-transparent", got "bg-secondary" |
| 7 | 同上 | Toggle > 应该apply size styles correctly | 235 | Error | expected class "h-8", got "h-10" |
| 8 | `src/data/db-connection.test.ts` | VersionError + DEV + deleteDB 成功 + 重连成功 | 374 | TypeError | successReq.onsuccess is not a function |
| 9 | 同上 | VersionError + DEV + deleteDB 成功 + 重连失败 | 455 | TypeError | retryFailReq.onerror is not a function |
| 10 | 同上 | VersionError + DEV + deleteDB 成功 + 重连触发 onupgradeneeded | 492 | TypeError | successReq.onupgradeneeded is not a function |
| 11 | 同上 | VersionError + DEV + 重试次数超限后拒绝重连 | 867 | TypeError | failReq2.onerror is not a function |
| 12 | `tests/unit/tofixed-p0-regression.test.tsx` | ScoreStatsCards avgScore=null 时优雅降级 | 401 | AssertionError | TypeError: Cannot read properties of null (reading 'toFixed') |
| 13 | 同上 | ScoreStatsCards avgScore=undefined 时优雅降级 | 416 | AssertionError | TypeError: Cannot read properties of undefined (reading 'toFixed') |
| 14 | 同上 | MarketSentimentWidget totalStocks=0 时不显示 NaN | 513 | AssertionError | result contains 'Infinity'（除零未兜底） |
| 15 | `tests/__tests__/scripts/daily-doc-validation.test.ts` | doc-cross-ref-sync.ts > 修复断裂的相对链接并同步索引 | 210 | AssertionError | expected 0 to be greater than or equal to 1 |

### 9.3 失败原因分类

| 根因类别 | 失败数 | 影响文件 | 说明 |
|---------|--------|---------|------|
| **组件 API 漂移** | 4 | `ui-components.test.tsx`, `SectorHeatmapWidget.test.tsx` | Toggle 组件 variant/size 样式变更（`bg-transparent`→`bg-secondary`，`h-8`→`h-10`）；SectorHeatmapWidget 空数据文案变更（"暂无数据"→"加载失败"） |
| **Mock 对象不完整** | 4 | `db-connection.test.ts` | IDBRequest mock 缺少 `onsuccess`/`onerror`/`onupgradeneeded` 方法（mock 策略与源码 `withTimeout` 重构不匹配） |
| **组件空安全回归** | 3 | `tofixed-p0-regression.test.tsx` | `ScoreStatsCards` 和 `MarketSentimentWidget` 未对 null/undefined/0 做除零兜底，`toFixed` 直接调用导致崩溃或 `Infinity` 显示 |
| **SVG 渲染失败** | 2 | `verify-logger-components.test.tsx` | `IndustryV4Radar`/`SubIndicatorBar` 在 jsdom 环境下未渲染 SVG（可能因 recharts 版本或 props 缺失） |
| **端到端集成失败** | 1 | `e2e-verify-25stocks.integration.test.ts` | 池流转准确率 0%（可能因 `poolTransitionEngine` 配置变更或 mock 数据问题） |
| **文档校验逻辑变更** | 1 | `daily-doc-validation.test.ts` | `doc-cross-ref-sync.ts` 的 `updates.length` 预期 ≥1 但实际为 0（索引同步逻辑变更） |

### 9.4 与 47 个非冻结 tsc:test 错误的关系

**结论：47 个非冻结 tsc:test 类型错误与 15 个 vitest 运行时失败之间无直接因果关系。**

| 对比维度 | tsc:test 类型错误（47 项） | vitest 运行时失败（15 项） |
|---------|--------------------------|--------------------------|
| 错误性质 | 编译期类型检查 | 运行时行为断言 |
| 主要错误码 | TS6133(未使用)、TS2532(可能 undefined)、TS18046(unknown)、TS2352(类型转换) | AssertionError、TypeError、TestingLibraryElementError |
| 影响机制 | 不影响 vitest 运行（vitest 使用 esbuild 转译，跳过类型检查） | 直接导致测试失败 |
| 修复优先级 | P2（不阻塞测试运行，但阻塞 tsc:test 门禁） | P1（直接导致测试套件 RED） |

**唯一交叉文件**：`src/data/db-connection.test.ts` 同时存在 tsc:test 错误（TS6133 `firstDb` 未使用，line 500）和 4 个运行时失败，但二者根因不同（前者是未使用变量，后者是 mock 对象方法缺失）。

### 9.5 构建阻塞分析

| 构建阶段 | 阻塞状态 | 阻塞原因 |
|---------|---------|---------|
| `tsc:prod`（prebuild 前置） | 🔴 **阻塞**（退出码 2） | §4 记录的 75 个语法错误（15 个文件非法嵌套 import） |
| `vite build` | 🔴 **阻塞** | 依赖 `tsc:prod` 通过 |
| `vitest run` | 🟡 **部分失败**（退出码 1） | 15 个运行时失败（§9.2），但 9091/9128 用例通过 |
| `tsc:test` | 🔴 **阻塞**（退出码 2） | 24 冻结 + ~48 非冻结 类型错误 |

**关键发现**：47 个非冻结 tsc:test 错误**不会**导致 vitest 测试套件失败（vitest 使用 esbuild 转译，跳过类型检查）。测试失败由独立的运行时问题导致。但 `tsc:prod` P0 问题（§4）会阻塞 `vite build`，进而阻塞 `pretest:e2e`（`npm run build` 前置）。

---

## 10. 验证命令

```bash
# 验证当前 tsc:test 错误数
C:/nvm4w/nodejs/node.exe ./node_modules/typescript/bin/tsc -p tsconfig.test.json --noEmit 2>&1 | Select-String "error TS" | Measure-Object | Select-Object -ExpandProperty Count
# 预期输出：约 63（24 冻结 + ~48 非冻结，含新增 format.test.ts/Progress.test.tsx 等），修复后应递减

# 验证 tsc:prod（当前为 RED — P0 问题未修复）
C:/nvm4w/nodejs/node.exe ./node_modules/typescript/bin/tsc -p tsconfig.prod.json --noEmit; echo $?
# 预期输出：0（修复 §4 P0 后），当前为 2（75 个语法错误）

# 执行僵尸路径引用审计
C:/nvm4w/nodejs/node.exe ./node_modules/tsx/dist/cli.mjs scripts/audit/audit-stale-path-reference.ts
# 输出：5895 个僵尸路径（主要为 CHANGELOG.md 历史引用，非阻塞）

# 执行完整测试套件
npx vitest run --no-coverage --reporter=dot
# 预期输出：7 failed | 518 passed | 1 skipped（526），15 failed | 9091 passed | 22 skipped（9128）
```

---

## 11. 追加测试修复与全量构建验证（2026-08-05 23:30）

> 在完成 §9 记录的 15 项 vitest 失败修复后，执行完整测试套件回归验证时发现 8 项追加失败（4 类根因），已全部修复并通过最终全量验证。

### 11.1 追加修复明细（8 项 / 4 文件）

| # | 测试文件 | 失败用例数 | 根因类别 | 修复方案 |
|---|---------|-----------|---------|---------|
| 1 | `tests/e2e-verify-25stocks.integration.test.ts` | 1 | ENOENT：`outputs/` 目录不存在 | 在 `writeFileSync` 前添加 `mkdirSync(path.dirname(outPath), { recursive: true })` |
| 2 | `tests/e2e-verify-redundancy.integration.test.ts` | 1 | 同上 | 同上 |
| 3 | `src/cockpit/widgets/WatchlistMoversWidget.test.tsx` | 3 | Mock 目标不匹配：测试 mock `MarketDataProvider.useMarketData`，但组件实际使用 `useMarketDataStore` | 重写为 `vi.hoisted` + `vi.mock('@/store/marketDataStore')` selector 模式（与 PortfolioOverviewWidget.test.tsx 一致） |
| 4 | `tests/unit/pre-push-scope-boundary.test.ts` | 3 | 测试脚本提取 pre-push scope 校验段时未包含 `source scope-regex.sh`，导致 `validate_scope: command not found` | 在生成的测试脚本中添加 `. "${SCOPE_REGEX_PATH}"` source 语句 |

### 11.2 Flaky 测试说明

在回归验证过程中，`src/data/db-migrations.test.ts`（1 项）和 `src/cockpit/widgets/PortfolioOverviewWidget.test.tsx`（1 项）出现 flaky 失败（单独运行通过，全量套件中失败）。根因为 `node_modules/.vite` 缓存中保存了旧版本测试文件的 transform 产物，导致测试名和断言不匹配。**清理 `node_modules/.vite` 缓存后两项均稳定通过**，无需代码修改。

### 11.3 最终全量构建验证结果

| 验证项 | 状态 | 退出码 | 详情 |
|--------|------|--------|------|
| **tsc:prod** | ✅ 通过 | 0 | 75 个语法错误和非法嵌套 import 已全部解决（§4） |
| **vitest run** | ✅ 通过 | 0 | **9667 passed / 0 failed / 22 skipped**（548 个测试文件，547 passed / 1 skipped） |
| **vite build** | ✅ 通过 | 0 | `✓ built in 8.17s`，仅 chunk 体积警告（非错误） |

**执行命令序列**：
```bash
# 1. 清理缓存
Remove-Item -Recurse -Force node_modules\.vite, dist

# 2. 类型检查（退出码 0）
npm run tsc:prod

# 3. 完整测试套件（退出码 0，9667 passed / 0 failed）
npx vitest run --reporter=default

# 4. 生产构建（退出码 0，✓ built in 8.17s）
npm run build
```

### 11.4 修复文件清单

| 文件 | 修改类型 | 改动摘要 |
|------|---------|---------|
| `tests/e2e-verify-25stocks.integration.test.ts` | 修改 | 添加 `mkdirSync` 导入和目录创建调用 |
| `tests/e2e-verify-redundancy.integration.test.ts` | 修改 | 同上 |
| `src/cockpit/widgets/WatchlistMoversWidget.test.tsx` | 重写 | Mock 从 `MarketDataProvider.useMarketData` 改为 `useMarketDataStore` selector 模式 |
| `tests/unit/pre-push-scope-boundary.test.ts` | 修改 | 添加 `SCOPE_REGEX_PATH` 常量和 `. source` 语句 |
| `docs/tech-debt/frozen-tsc-test-baseline-2026-08-05.md` | 修改 | 新增 §11 章节（本节） |
