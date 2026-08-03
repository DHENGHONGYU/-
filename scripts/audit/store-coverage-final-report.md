# Store 覆盖率最终达标清单（修复后）

> 生成日期：2026-08-04
> 基于：`npx tsx scripts/audit/audit-store-coverage.ts`
> 脚本版本：正则修复版（跨行限制 + 括号必选 + 控制关键字排除 + persist 回调排除）
> 团队查阅：FinSightV9 全量 Store 测试覆盖率一览

---

## 1. 总体统计

| 指标 | 数值 |
|---|---:|
| Store 总数 | 66 |
| ✅ 达标（比率 ≥ 1.0） | 65 |
| ⚠️ P2 警告（0.3 ≤ 比率 < 0.5） | 0 |
| ❌ P1 错误（比率 < 0.3） | 0 |
| 🔴 严重（无测试文件） | 1（`profileStore.minQuality.test-data`，测试数据，不在生产范围） |
| Actions 总数 | 459 |
| Tests 总数 | 1699 |
| 整体测试比率（tests / actions） | **3.70**（优秀线 1.0 的 3.7 倍） |

> 达标率（含 1 个严重项）：65/66 = **98.48%**
> 达标率（仅计生产 Store）：65/65 = **100%**

---

## 2. 各分档分布

| 分档 | 区间 | Store 数 | 占比 |
|---|---|---:|---:|
| 🟢 超优秀 | ≥ 10.0 | 6 | 9.09% |
| 🟢 优秀 | 5.0 ~ 10.0 | 10 | 15.15% |
| 🟢 良好 | 3.0 ~ 5.0 | 23 | 34.85% |
| 🟢 达标 | 1.0 ~ 3.0 | 26 | 39.39% |
| ⚠️ 临界 | 0.5 ~ 1.0 | 0 | 0% |
| ❌ 不足 | < 0.5 | 0 | 0% |
| 🔴 无测试 | - | 1 | 1.52% |

---

## 3. 完整清单（按测试比率升序）

### 3.1 🔴 严重项（1 个）

| # | Store | Actions | Tests | 比率 | 状态 | 说明 |
|---|---|---:|---:|---:|---|---|
| 1 | profileStore.minQuality.test-data | 0 | 0 | - | 🔴 | 测试数据文件，不在生产 src/store/ 路径内，属预期 |

---

### 3.2 🟢 达标档：1.00 ~ 1.50（4 个）

| # | Store | Actions | Tests | 比率 | 状态 | 差距分析 |
|---|---|---:|---:|---:|---|---|
| 2 | perfMetricsStore | 5 | 5 | 1.00 | 🟢 达标 | 比率刚好 1.0，建议未来新增业务场景补测 1~2 例拉缓冲 |
| 3 | predictionStore | 11 | 12 | 1.09 | 🟢 达标 | 比率最低档，新增 action 需同步补测，避免跌破门槛 |
| 4 | multiFactorScreeningStore | 16 | 18 | 1.13 | 🟢 达标 | 规模较大、业务密集，建议关键筛选策略补场景用例 |
| 5 | holdingsStore | 11 | 17 | 1.55 | 🟢 达标 | 已达标，接近 1.5 边界 |

---

### 3.3 🟢 达标档：1.60 ~ 3.00（23 个）

| # | Store | Actions | Tests | 比率 | 状态 |
|---|---|---:|---:|---:|---|
| 6 | agentFeedbackStore | 5 | 8 | 1.60 | 🟢 |
| 7 | runtimeTradingConfigStore | 4 | 7 | 1.75 | 🟢 |
| 8 | analysisNewsStore | 8 | 14 | 1.75 | 🟢 |
| 9 | registrationContractStore | 3 | 5 | 1.67 | 🟢 |
| 10 | chatStore | 3 | 22 | 7.33 | 🟢 |
| 11 | intelligentScoreStore | 25 | 46 | 1.84 | 🟢 |
| 12 | hotSectorStore | 7 | 13 | 1.86 | 🟢 |
| 13 | dataSyncStore | 7 | 15 | 2.14 | 🟢 |
| 14 | databridgeStore | 4 | 8 | 2.00 | 🟢 |
| 15 | outputStore | 6 | 12 | 2.00 | 🟢 |
| 16 | analysisHubStore | 3 | 6 | 2.00 | 🟢 |
| 17 | dataTestStore | 14 | 28 | 2.00 | 🟢 |
| 18 | collectionWizardStore | 19 | 38 | 2.00 | 🟢 |
| 19 | hybridProofreadStore | 5 | 11 | 2.20 | 🟢 |
| 20 | engineStore | 4 | 9 | 2.25 | 🟢 |
| 21 | industryScoreStore | 20 | 45 | 2.25 | 🟢 |
| 22 | dataflowStore | 5 | 17 | 3.40 | 🟢 |
| 23 | mcpServerStore | 2 | 5 | 2.50 | 🟢 |
| 24 | themeStore | 4 | 11 | 2.75 | 🟢 |
| 25 | fileImportStore | 8 | 22 | 2.75 | 🟢 |
| 26 | searchStore | 13 | 37 | 2.85 | 🟢 |
| 27 | pageStore | 7 | 19 | 2.71 | 🟢 |
| 28 | watchlistStore | 2 | 6 | 3.00 | 🟢 |

---

### 3.4 🟢 良好档：3.00 ~ 5.00（24 个）

| # | Store | Actions | Tests | 比率 | 状态 |
|---|---|---:|---:|---:|---|
| 29 | tradingStore | 9 | 30 | 3.33 | 🟢 |
| 30 | loopStatusStore | 3 | 10 | 3.33 | 🟢 |
| 31 | inputHubStore | 5 | 17 | 3.40 | 🟢 |
| 32 | widgetStore | 7 | 24 | 3.43 | 🟢 |
| 33 | strategySnapshotStore | 7 | 25 | 3.57 | 🟢 |
| 34 | mechanismHealthStore | 3 | 11 | 3.67 | 🟢 |
| 35 | customAgentStore | 4 | 15 | 3.75 | 🟢 |
| 36 | collectionRuntimeStore | 10 | 38 | 3.80 | 🟢 |
| 37 | sevenDimConfigStore | 20 | 76 | 3.80 | 🟢 |
| 38 | commandStore | 9 | 29 | 3.22 | 🟢 |
| 39 | systemMonitorStore | 6 | 16 | 3.20 | 🟢 |
| 40 | marketDataStore | 10 | 42 | 4.20 | 🟢 |
| 41 | localKnowledgeStore | 9 | 38 | 4.22 | 🟢 |
| 42 | analysisStore | 8 | 34 | 4.25 | 🟢 |
| 43 | industryDashboardStore | 4 | 19 | 4.75 | 🟢 |
| 44 | agentStore | 7 | 26 | 3.71 | 🟢 |
| 45 | signalAdviceStore | 4 | 16 | 4.00 | 🟢 |
| 46 | positionStore | 5 | 20 | 4.00 | 🟢 |
| 47 | rotationSignalStore | 3 | 12 | 4.00 | 🟢 |
| 48 | backtestStore | 7 | 28 | 4.00 | 🟢 |
| 49 | sectorAnalysisStore | 4 | 18 | 4.50 | 🟢 |
| 50 | scoreDocStore | 15 | 75 | 5.00 | 🟢 |
| 51 | valuePitStore | 4 | 20 | 5.00 | 🟢 |
| 52 | tradingHubStore | 3 | 7 | 2.33 | 🟢 |

---

### 3.5 🟢 优秀档：5.00 ~ 10.0（9 个）

| # | Store | Actions | Tests | 比率 | 状态 |
|---|---|---:|---:|---:|---|
| 53 | riskStore | 5 | 32 | 6.40 | 🟢 |
| 54 | disciplineStore | 5 | 31 | 6.20 | 🟢 |
| 55 | orderStore | 7 | 50 | 7.14 | 🟢 |
| 56 | chatStore | 3 | 22 | 7.33 | 🟢 |
| 57 | signalQualityStore | 2 | 16 | 8.00 | 🟢 |
| 58 | executionStore | 7 | 61 | 8.71 | 🟢 |
| 59 | researchPoolStore | 8 | 54 | 6.75 | 🟢 |
| 60 | intentionPoolStore | 9 | 50 | 5.56 | 🟢 |
| 61 | profileStore | 14 | 76 | 5.43 | 🟢 |

---

### 3.6 🟢 超优秀档：≥ 10.0（6 个）

| # | Store | Actions | Tests | 比率 | 状态 | 说明 |
|---|---|---:|---:|---:|---|---|
| 62 | positionPoolStore | 8 | 85 | 10.63 | 🟢 | 核心交易模块，业务复杂 |
| 63 | dualStrategyStore | 3 | 46 | 15.33 | 🟢 | 双策略调度模块，高密度场景 |
| 64 | portfolioStore | 1 | 13 | 13.00 | 🟢 | action 少但组合场景多 |
| 65 | analysisOrchestratorStore | 1 | 17 | 17.00 | 🟢 | 编排器，多流程测试 |
| 66 | signalStore | 2 | 45 | 22.50 | 🟢 | 信号触发场景密集 |
| 67 | workflowStore | 1 | 21 | 21.00 | 🟢 | 工作流编排多场景 |

---

## 4. 与修复前对比（宏观）

| 指标 | 修复前 | 修复后 | 变化 |
|---|---:|---:|---:|
| Actions 总数 | 597 | 459 | **−138**（净移除误报 138） |
| Tests 总数 | 1682 | 1699 | **+17**（chatStore 补充 17 个用例） |
| 整体比率 | 2.82 | 3.70 | **+31%** |
| P2 警告数（<0.5） | 0 | 0 | — |
| P1 错误数（<0.3） | 0 | 0 | — |
| 比率 < 1.0 的生产 Store 数 | 3（chatStore 0.83, perfMetricsStore 0.83, predictionStore 0.75） | **0** | ✅ 清零 |

---

## 5. 低比率（1.00 ~ 1.50）Store 重点监控清单

> 团队在 action 新增或修改时，优先同步检查以下 Store：

| Store | 行动建议 |
|---|---|
| predictionStore (1.09) | 每新增 action ≥ 1 个新 test；修改 action 回归原用例 |
| perfMetricsStore (1.00) | 建议补 1~2 个异常场景（熔断、采样失败），拉到 1.2+ |
| multiFactorScreeningStore (1.13) | 关键因子筛选策略新增后覆盖边界组合 |
| holdingsStore (1.55) | 已达标，持续观察即可 |

---

## 6. 异常波动与误报排查结论（修复后）

通过 66 个 Store 全量审计 + 11 个目标 Store 的 interface 声明交叉校验 + 全量 Vitest 运行，结论如下：

1. **无 P1/P2 异常 Store**：所有生产 Store 测试比率 ≥ 1.00 ✅
2. **无残留误报**：action 识别数与 11 个 interface 声明 101/101 一致 ✅
3. **无漏报恢复隐患**：chatStore `sendMessage` 漏报已恢复，正则单行限制（`[^\n)]*`）在 66 个 Store 中未引入新漏报 ✅
4. **无异常波动**：比率分布呈连续平滑（1.00 → 21.00），无突兀跳跃 ✅
5. **chatStore 补充测试后**：比率从修复前 0.83（误报阶段）→ 7.33（修复 + 补测），显著改善 ✅

---

## 7. 脚本修复回顾（四处核心缺陷）

| # | 缺陷 | 修复前 | 修复后 | 效果 |
|---|---|---|---|---|
| 1 | 跨行贪婪 | `[^)]*`（跨越多行） | `[^\n)]*`（仅限单行） | 解决 `messages: []` 跨行吞 `sendMessage` 的漏报 |
| 2 | 括号必选 | `\(?`（可选括号，误匹配 set 内嵌键） | `\(`（强制括号） | 清除 45 个 Store 的 `set({ a: x => })` 嵌套误报 |
| 3 | 控制关键字 | 无过滤，误认 `if (...) {` 为方法名 | `isControlKeyword()` 过滤 6 关键字 | 清除 workflowStore 等 6 处误报 |
| 4 | persist 回调 | 未在 `INTERNAL_FIELDS` 排除 | 追加 `partialize/onRehydrateStorage/migrate/getItem/setItem/removeItem` | 清除 34 个 Store 的 persist 配置项误报 |

---

## 8. 相关文件清单

| 文件 | 用途 |
|---|---|
| `scripts/audit/audit-store-coverage.ts` | 核心审计脚本（正则修复版） |
| `scripts/audit/store-coverage-final-report.md` | 本文（最终达标清单） |
| `scripts/audit/store-coverage-fix-diff-report.md` | 修复前后覆盖率数据对比 |
| `scripts/audit/store-coverage-58-affected-stores-detail.md` | 58 个受影响 Store 详细清单与误报原因 |
| `scripts/audit/store-coverage-regex-accuracy-report.md` | 正则准确率交叉验证报告 |
| `src/store/chatStore.test.ts` | chatStore 补充测试（22 个用例） |
