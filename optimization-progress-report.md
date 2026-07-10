# 优化计划执行进度报告

> 基于 `optimization-plan.md` 按 P0→P1→P2 优先级推进
> 报告时间：2026-07-10

## 一、本次完成项

### 1. 颜色硬编码收尾 ✅

| 文件 | 处理内容 |
|------|----------|
| `src/pages/analysis/IntelligentScorePage.tsx` | PDF 导出模板中 14 处 HEX 颜色全部替换为 `COLOR_SHADES` 令牌引用 |
| `src/components/input/wizard-steps/ExecutionMonitorStep.tsx` | 14 处 Tailwind 颜色类替换为 `twText/twBorder` 令牌引用 |
| `src/cockpit/widgets/AITradeReviewWidget.tsx` | 移除未使用的 `twBg` 导入 |

**门禁结果**：
- `npm run audit:hardcode`：0 颜色违规（仅 26 条静默回退 Warning）

### 2. P0 核心层深层嵌套优化 ✅

| 文件 | 函数 | 原问题 | 优化方式 |
|------|------|--------|----------|
| `src/core/databridge.ts` | `forward` | 嵌套 try-catch 深度 4 | 提取 `assertAclWithFallback` 辅助方法，提前返回 |
| `src/core/databridgeHandlers.ts` | `DeleteStockHandler.handle` | 3 层级联删除循环嵌套深度 4 | 拆分为 `deleteSymbolKeyRecords/deleteIndexedRecords/deleteScannedRecords` 三个私有方法 |
| `src/core/entityValidators.ts` | `validateOrder` | if-else-if 链 4 分支 ×2 | 提取 `validateSymbol/validateDirection/validateQuantity/validatePrice` 谓词函数 |
| `src/mcp/core/notification.ts` | `emit` | 嵌套 for+try+if 深度 4 | 卫语句提前返回 + 提取 `notifyListener` 私有方法 |
| `src/data/db-migrations.ts` | `runMigrations` | 嵌套 try+for+if+try 深度 6 | 提取 `rollbackMigrations` 辅助函数 |

### 3. 修复 tsc:prod / 基础质量门禁阻塞 ✅

| 文件 | 问题 | 修复方式 |
|------|------|----------|
| `src/store/collectionWizardStore.ts` | `withBroadcast` 使用旧版 wrapper API，tsc 报大量隐式 any | 改为新版 `withBroadcast(event, payload)` 独立调用，补充 `broadcastWizard` 辅助函数 |
| `src/components/input/DataCollectionWizard.tsx` | 引用缺失的 wizard step 文件；Button variant 错误；未使用 Play 导入 | 补齐 4 个 step 文件；`destructive` → `danger`；移除 Play 导入 |
| `src/components/input/wizard-steps/*.tsx` | API 类型不匹配、Checkbox 事件错误、Tailwind 硬编码 | 补齐 `ApiConfig.timeoutMs`；`onCheckedChange` → `onChange`；颜色改令牌 |
| `src/pages/output/DashboardPage.tsx` | 未使用导入被误删导致 tsc 错误 | 恢复需要的导入 |

## 二、质量门禁状态

| 门禁 | 状态 | 备注 |
|------|------|------|
| `npm run tsc:prod` | ✅ 通过 | 无类型错误 |
| `npm run audit:layers` | ✅ 通过 | 0 违规 / 0 警告 |
| `npm run audit:hardcode` | ✅ 通过 | 0 颜色违规 |
| `npm run audit`（全套）| ⚠️ MCP 审计未通过 | 4 处 direct-service-import（见下方） |
| `npm run test -- --run` | ⏳ 运行中 | 后台任务 X9psm7 |

## 三、嵌套评审指标对比

| 指标 | 优化前 | 优化后 | 变化 |
|------|--------|--------|------|
| 真实深层嵌套（≥4 层） | 66 | 61 | ↓ 5（-7.6%） |
| 过长 if-else-if 链 | 32 | 30 | ↓ 2（-6.3%） |
| 重复条件 | 194-195 | 195 | 基本持平 |

## 四、剩余 P0 项（待继续）

| 序号 | 文件 | 方法 | 问题 |
|------|------|------|------|
| 2 | `src/mcp/core/server.ts` | `readResource` | 真实嵌套深度 5 |
| 6 | `src/mcp/core/client.ts` | `readResource` | 真实嵌套深度 4 |
| 5 | `src/data/sectorDefinitions.ts` | `matchStocksToSectors` | 真实嵌套深度 4 |

## 五、新增发现（非优化计划原范围）

`npm run audit` 中 `audit-mcp.ts` 发现 4 处 direct-service-import 违规：
- `src/components/collection/CollectionReportPanel.tsx:18`
- `src/pages/input/CollectTaskPage.tsx:23`
- `src/pages/input/FetcherConfigPage.tsx:57`
- `src/pages/trading/TradingFlowPage.tsx:14`

建议：如 MCP 架构审计属于 11 道门禁之一，需后续统一整改为 MCPClient 调用。

## 六、下一步建议

1. 完成剩余 3 项 P0 核心层嵌套优化
2. 评估是否将 MCP direct-service-import 纳入本次优化范围
3. 进入 P1 服务层中优项（42 项）
4. 回归 `npm run audit` + `tsc:prod` + 测试套件
