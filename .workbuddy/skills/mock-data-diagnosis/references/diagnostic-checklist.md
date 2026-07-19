# 信息孤岛与兼容性风险诊断清单

> 来源：FinSightV9 2026-07-18 全量诊断实战。信息孤岛 = 系统存在多套独立且不互通的数据处理机制。

---

## 信息孤岛 4 种诊断信号

### 信号 1：平行数据通道（Parallel Data Flows）

**检测方式**：搜索是否存在两套完全独立的数据获取/存储机制

```bash
# 检测 Context 型数据提供器
grep -rn "createContext\|Provider.*Data\|useMarketData\|useDataSource" src/ --include="*.tsx" | grep -v node_modules

# 检测 Store 型数据提供器
grep -rn "create.*Store\|useMarketDataStore\|useDataSourceStore" src/ --include="*.ts" | grep -v node_modules

# 两者共存 = 平行通道
```

**FinSightV9 实战案例**：
- 通道 A：`MarketDataProvider`（React Context）→ 18 个 Cockpit Widget
- 通道 B：`useMarketDataStore`（Zustand Store）→ 36 个 Page
- 数据不互通：Widget 数据不入 Store，Page 更新 Widget 不感知

**判定标准**：
- 数据不互通 + 使用者 > 10 → P0
- 数据不互通 + 使用者 <= 10 → P1
- 数据互通但有冗余 → P2

**修复方向**：单通道写入 DataBridge → 统一从 Store 读 → 移除冗余通道

---

### 信号 2：同名重复模块（Duplicate Same-Name Modules）

**检测方式**：在 services/ 下找同名但不同子目录的文件

```bash
# 快速检查
find src/services -name "directDataAPI.ts" -o -name "marketData.ts" \
  -o -name "stockAPI.ts" -o -name "dataFetcher.ts" -o -name "adapter.ts" 2>/dev/null

# 验证是否多份都被引用
for f in $(find src/services -name "directDataAPI.ts" 2>/dev/null); do
  basename=$(basename $f .ts)
  echo "=== $f ==="
  grep -r "from.*$basename" src/ --include="*.ts" --include="*.tsx" | grep -v "\.test\." | grep -v node_modules | wc -l
done
```

**FinSightV9 实战案例**：
- `services/fetcher/directDataAPI.ts`（~650 行，完整实现）
- `services/data-collector/directDataAPI.ts`（~350 行，简化实现）
- 两份实现功能不同、各自被 8+ / 2+ 文件引用

**判定标准**：
- 两份都被生产引用且逻辑不同 → P0
- 一份仅有测试引用 → P2

**修复方向**：丰富版（fetcher）提升为 canonical 实现；简化版（data-collector）改为 re-export wrapper

---

### 信号 3：Widget 数据源声明 ≠ 运行时数据流

**检测方式**：对比 registry 声明 vs 运行时实际数据获取

```bash
# registry 声明
grep -A3 "defaultDataSource\|dataSource" src/cockpit/core/widgetRegistry.ts

# 运行时实际来源
grep -rn "useMarketData\|useDataSource\|taskScheduler\|MarketDataProvider" src/cockpit/widgets/ --include="*.tsx"
```

**FinSightV9 实战案例**：
- Registry 中 27 个 Widget 的 `defaultDataSource` 全部指向同一个常量 `WIDGET_DEFAULT_DATA_SOURCE`
- 运行时 Widget 通过 `useMarketData()`（React Context 注入）消费数据
- Context 数据来自 `taskScheduler` + `marketDataAdapter`，**不是**任何 Store

**判定标准**：声明 ≠ 实际 → P1（维护困难 + 数据分析工具失效）

**修复方向**：Registry 声明改为动态路由到实际数据源；或统一数据流后移除声明的常量占位

---

### 信号 4：Service 绕过 DataBridge（写入旁路）

**检测方式**：搜索 Service 中直接 import dataLayer Store

```bash
# 直接引用 dataLayer Store（非经 DataBridge）
grep -rn "from.*dataLayer.*Store\|from.*dataLayerStock\|from.*dataLayerScore" src/services/ --include="*.ts" --include="*.tsx" | grep -v "\.test\."

# 直接 import IndexedDB
grep -rn "from '@/data/db\|from '@/data/dataLayer'" src/services/ --include="*.ts" --include="*.tsx" | grep -v "\.test\."

# 统计数量
grep -rnl "from.*dataLayer.*Store\|from '@/data/db'" src/services/ --include="*.ts" --include="*.tsx" | grep -v "\.test\." | wc -l
```

**FinSightV9 实战案例**：
- `indexedDBProvider.ts`：直接 import 6 个 dataLayer Store 实例（stock/dailyQuote/financialReport/score/trading/content/watchlist）
- 共 7 个 Service 绕过 DataBridge 的 ACL 校验 + 审计日志

**判定标准**：绕过 DataBridge 写入 → P1；绕过 DataBridge 读取 → P2

**修复方向**：改为 `DataBridge.forward(envelope)` 写入 + `DataBridge.query()` 读取

---

## Mock→真实切换兼容性风险清单

### 风险 1：Mock 类型与规范类型不同步

**检测**：Mock 数据文件中是否内联定义了与 @/types/ 不一致的 interface

```bash
# 找 Mock 文件中的内联类型定义
grep -n "^interface\|^export interface\|^type.*=" \
  src/services/data-collector/mockDataCollection.ts \
  src/cockpit/data/mockDataProvider.ts \
  src/services/trading/mockDataGenerator.ts 2>/dev/null
```

**FinSightV9 实战案例**：
- `mockDataCollection.ts`：所有类型内联定义（`RawMarketData`、`CollectionTask` 等）
- `mockDataProvider.ts`：内联 `MarketIndex`、`SectorData`、`FundFlow`
- 与 `@/types/modules/widget.types.ts` 的规范类型可能不一致

**风险等级**：真实数据字段名/类型与 Mock 不同时 → 编译通过但崩溃 → P1

### 风险 2：配置弃用残留

**检测**：
```bash
grep -rn "DEPRECATED\|已废弃\|不可用\|保留占位\|legacy" src/config/ --include="*.ts"
```

**风险等级**：P2（无功能影响，增加配置复杂度）

### 风险 3：TODO/FIXME Mock 未清理

**检测**：
```bash
grep -rn "TODO.*mock\|FIXME.*mock\|HACK.*mock\|TODO.*fixture\|FIXME.*fixture" src/ --include="*.ts" --include="*.tsx" | grep -v "\.test\."
```

**风险等级**：P2（标记为临时方案但长期存在）

---

## 门禁盲区检查（诊断前置步骤）

在运行诊断前，先验证门禁扫描范围是否覆盖所有关键路径：

```bash
# 读审计脚本源码
cat scripts/audit-layer-calls.ts | grep -E "规则|RULE|check|scan" | head -20

# 逐条对比 AGENTS.md 分层规则 vs 审计脚本实际扫描
# 常见盲区：
# - store→fixtures 依赖（门禁不扫）
# - services→cockpit 依赖（门禁不扫）
# - services→lib（非白名单）依赖（可能不全）
```

**门禁假绿灯 = 最危险的盲区**。如果发现盲区：标注在报告"门禁盲区"节，建议扩展审计脚本。
