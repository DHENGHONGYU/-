# V9 系统代码重构执行方案

> **生成时间**: 2026-07-04  
> **基于**: 知识图谱分析结果  
> **目标**: 消除循环依赖、拆分超大文件、提升代码可维护性

---

## 一、问题总览

### 1.1 循环依赖（5 处，P0 级）

| # | 循环链 | 根因 |
|---|--------|------|
| 1 | `core/databridge.ts` → `services/scoring/hotSectorAnalyzer.ts` → `data/dataLayer.ts` → `core/databridge.ts` | DataBridge 不应依赖 services 层 |
| 2 | `core/databridge.ts` → `services/scoring/rotationSignalDetector.ts` → `data/dataLayer.ts` → `core/databridge.ts` | 同上 |
| 3 | `core/databridge.ts` → `services/scoring/valuePitAnalyzer.ts` → `data/dataLayer.ts` → `core/databridge.ts` | 同上 |
| 4 | `services/export/backtestExportService.ts` → `store/backtestStore.ts` → `services/export/backtestExportService.ts` | Store 不应依赖 services |
| 5 | `store/backtestStore.ts` → `services/export/backtestExportService.ts` → `constants/backtest.constants.ts` → `store/backtestStore.ts` | 常量文件不应依赖 store |

### 1.2 超大文件（28 个，>500 行）

**Top 10 需拆分文件**：

| 文件 | 行数 | 职责 | 拆分建议 |
|------|------|------|----------|
| `constants/uiText.ts` | 1192 | UI 文案常量 | 按模块拆分为 `uiText.input.ts`、`uiText.analysis.ts` 等 |
| `services/analysis/stockAnalysisEngine.ts` | 1149 | 股票分析引擎 | 拆分为 `stockAnalysisEngine.ts`（Facade）+ `stockAnalysisCalculators.ts` + `stockAnalysisUtils.ts` |
| `services/data-collector/mockDataCollection.ts` | 1027 | Mock 数据 | 按数据类型拆分 |
| `store/orderStore.ts` | 954 | 订单状态管理 | 拆分为 `orderStore.ts` + `orderCalculations.ts` + `orderUtils.ts` |
| `data/types.ts` | 890 | 类型定义 | 按领域拆分为 `types/order.types.ts`、`types/stock.types.ts` 等 |
| `data/sectorSkillData.ts` | 879 | 行业技能数据 | 按行业拆分 |
| `core/databridge.ts` | 863 | 数据桥接 | 按域拆分为 `dataBridge.analysis.ts`、`dataBridge.trading.ts` 等 |
| `services/trading/tradeErrorClassifier.ts` | 767 | 交易错误分类 | 拆分为 `tradeErrorClassifier.ts` + `tradeErrorRules.ts` |
| `store/executionStore.ts` | 762 | 执行状态 | 拆分为 `executionStore.ts` + `executionCalculations.ts` |
| `services/input/batchImportService.ts` | 729 | 批量导入 | 拆分为 `batchImportService.ts` + `batchImportValidators.ts` |

---

## 二、执行计划

### Phase 1: 消除循环依赖（P0）

#### Task 1.1: 修复 DataBridge 循环依赖

**问题**：`core/databridge.ts` 依赖 `services/scoring/*`，违反分层规则（core 不应依赖 services）

**方案**：
1. 在 `core/databridge.ts` 中移除对 `hotSectorAnalyzer`、`rotationSignalDetector`、`valuePitAnalyzer` 的直接导入
2. 通过依赖注入或事件机制解耦
3. 在 `services/scoring/` 中创建注册函数，将 analyzer 注册到 DataBridge

**验证**：
```bash
npm run audit:layers
# 期望：0 violations
```

#### Task 1.2: 修复 backtestStore 循环依赖

**问题**：`store/backtestStore.ts` 依赖 `services/export/backtestExportService.ts`，违反分层规则（store 不应依赖 services）

**方案**：
1. 将 `backtestExportService` 的导出逻辑移至 `store/backtestStore.ts` 内部
2. 或创建独立的 `services/export/backtestExportOrchestrator.ts` 作为中间层

**验证**：
```bash
npx tsc --noEmit
npm test -- backtest --run
```

### Phase 2: 拆分超大文件（P1）

#### Task 2.1: 拆分 `constants/uiText.ts`（1192 行）

**拆分策略**：
```
constants/uiText.ts (1192 行)
├── constants/uiText.input.ts        (~200 行)
├── constants/uiText.analysis.ts     (~300 行)
├── constants/uiText.trading.ts      (~250 行)
├── constants/uiText.output.ts       (~200 行)
├── constants/uiText.command.ts      (~150 行)
└── constants/uiText.common.ts       (~92 行)
```

**步骤**：
1. 按模块提取文案常量到独立文件
2. 在原文件中 re-export 所有类型
3. 更新所有引用方
4. 运行 `npm run audit:hardcode` 验证

#### Task 2.2: 拆分 `services/analysis/stockAnalysisEngine.ts`（1149 行）

**拆分策略**：
```
services/analysis/stockAnalysisEngine.ts (1149 行)
├── services/analysis/stockAnalysisEngine.ts          (~300 行，Facade)
├── services/analysis/stockAnalysisCalculators.ts     (~400 行，计算逻辑)
├── services/analysis/stockAnalysisUtils.ts           (~250 行，工具函数)
└── services/analysis/stockAnalysisTypes.ts           (~199 行，类型定义)
```

**步骤**：
1. 提取类型定义到 `stockAnalysisTypes.ts`
2. 提取工具函数到 `stockAnalysisUtils.ts`
3. 提取计算逻辑到 `stockAnalysisCalculators.ts`
4. 保留 Facade 入口在 `stockAnalysisEngine.ts`
5. 运行 `npx tsc --noEmit` 验证

#### Task 2.3: 拆分 `store/orderStore.ts`（954 行）

**拆分策略**：
```
store/orderStore.ts (954 行)
├── store/orderStore.ts              (~400 行，状态管理)
├── store/orderCalculations.ts       (~300 行，计算逻辑)
└── store/orderUtils.ts              (~254 行，工具函数)
```

**步骤**：
1. 提取计算逻辑到 `orderCalculations.ts`
2. 提取工具函数到 `orderUtils.ts`
3. 保留状态管理在 `orderStore.ts`
4. 运行 `npm test -- order --run` 验证

### Phase 3: 治理硬编码（P1）

#### Task 3.1: 提取颜色常量

**方案**：
1. 在 `src/constants/colors.ts` 中定义颜色常量映射
2. 优先治理高频违规文件（`cockpit/widgets/*`、`apps/trading/*`）
3. 使用正则替换批量修复

**验证**：
```bash
npm run audit:hardcode
# 期望：硬编码颜色数量显著下降
```

#### Task 3.2: 提取魔法数字

**方案**：
1. 分类提取：
   - 超时配置 → `src/config/timeoutConfig.ts`
   - UI 尺寸 → `src/constants/uiDimensions.ts`
   - 业务阈值 → `src/services/scoring/v6-engine/config.ts`
2. 按文件逐步替换

**验证**：
```bash
npm run audit:hardcode
# 期望：魔法数字数量显著下降
```

---

## 三、验证清单

### 每阶段完成后验证

```bash
# 1. 类型检查
npx tsc --noEmit

# 2. 单元测试
npm test -- --run

# 3. 架构审计
npm run audit:layers
npm run audit:hardcode

# 4. 知识图谱更新
npx tsx scripts/extract-code-graph.ts

# 5. 构建验证
npm run build
```

### 成功指标

- ✅ 循环依赖：5 → 0
- ✅ 超大文件（>1000 行）：3 → 0
- ✅ 硬编码颜色：730 → <100
- ✅ 魔法数字：1557 → <300

---

## 四、风险与回滚

### 风险点

1. **循环依赖修复**：可能影响 DataBridge 的事件路由机制
2. **大文件拆分**：可能引入导入路径错误
3. **硬编码提取**：可能影响 UI 样式一致性

### 回滚方案

每个 Task 完成后提交 Git commit，若发现问题可快速回滚：
```bash
git log --oneline -10
git revert <commit-hash>
```

---

## 五、时间估算

| Phase | 任务 | 预计时间 |
|-------|------|----------|
| Phase 1 | 消除循环依赖 | 2-3 小时 |
| Phase 2 | 拆分超大文件 | 4-6 小时 |
| Phase 3 | 治理硬编码 | 3-4 小时 |
| **总计** | | **9-13 小时** |

---

## 六、下一步行动

1. **立即执行**：Phase 1（消除循环依赖）
2. **本批次完成**：Phase 2（拆分 Top 3 超大文件）
3. **后续批次**：Phase 3（治理硬编码）

**当前批次目标**：完成 Phase 1 + Phase 2 Top 3
