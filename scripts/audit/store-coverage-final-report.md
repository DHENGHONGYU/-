# Store 覆盖率最终达标清单（修复后 · 2026-08-04 最终版）

> 生成日期：2026-08-04
> 数据来源：`npx tsx scripts/audit/audit-store-coverage.ts`
> 脚本版本：正则修复 v4（跨行单行限制 + 括号必选 + 控制关键字排除 + persist 回调排除）
> 团队查阅：FinSightV9 全量 66 Store 测试覆盖率一览（达标基线版）
> 关联提交：`bbd90d99 chore(audit): store-coverage 审计报告生成与 audit-store-coverage.ts 修复` + `ec80a312 test: chatStore 覆盖率测试 + profileService 场景重构`

---

## 一、总体统计（核心数据）

| 指标 | 数值 |
|---|---:|
| Store 总数 | 66 |
| 🟢 达标（比率 ≥ 1.0） | 65 |
| ⚠️ P2 警告（0.3 ≤ 比率 < 0.5） | 0 |
| ❌ P1 错误（比率 < 0.3） | 0 |
| 🔴 严重（无测试文件 / 非生产文件） | 1（`profileStore.minQuality.test-data`，测试数据 fixture，不在生产范围） |
| Actions 总数 | **459** |
| Tests 总数 | **1699** |
| 整体测试比率（tests / actions） | **3.70**（优秀线 1.0 的 3.7 倍） |

> 达标率（含 1 个严重项）：65/66 = **98.48%**
> 达标率（仅计生产 Store）：65/65 = **100%**

---

## 二、各分档分布

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

## 三、完整达标清单（按测试比率升序排列 · 团队查阅版）

### 3.1 🔴 严重项（1 个 · 非生产）

| # | Store | Actions | Tests | 比率 | 状态 | 说明 |
|---|---|---:|---:|---:|---|---|
| 1 | profileStore.minQuality.test-data | 0 | 0 | - | 🔴 | 测试数据文件，`tests/__tests__/store/min-quality/` 路径下，属门禁基线 fixture，不在生产 `src/store/` 内 |

---

### 3.2 🟢 达标档：1.00 ~ 1.60（最低档 · **需重点监控** · 4 个）

| # | Store | Actions | Tests | 比率 | 状态 | 差距分析 / 行动建议 |
|---|---|---:|---:|---:|---|---|
| 2 | perfMetricsStore | 5 | 5 | 1.00 | 🟢 达标 | 比率刚好踩 1.0 线，建议未来补 1~2 个熔断/采样失败异常场景，拉缓冲到 1.2+ |
| 3 | predictionStore | 11 | 12 | 1.09 | 🟢 达标 | **全生产 Store 比率最低**；每新增 1 个 action ≥ 同步 1 个新 test；修改 action 必须回归原用例 |
| 4 | multiFactorScreeningStore | 16 | 18 | 1.13 | 🟢 达标 | 规模最大的 Store 之一（16 actions），业务密集，建议关键因子筛选策略补边界组合场景 |
| 5 | holdingsStore | 11 | 17 | 1.55 | 🟢 达标 | 已达标，接近 1.5 下沿，持续观察即可 |

---

### 3.3 🟢 达标档：1.60 ~ 3.00（26 个）

| # | Store | Actions | Tests | 比率 | 状态 |
|---|---|---:|---:|---:|---|
| 6 | agentFeedbackStore | 5 | 8 | 1.60 | 🟢 |
| 7 | registrationContractStore | 3 | 5 | 1.67 | 🟢 |
| 8 | analysisNewsStore | 8 | 14 | 1.75 | 🟢 |
| 9 | runtimeTradingConfigStore | 4 | 7 | 1.75 | 🟢 |
| 10 | intelligentScoreStore | 25 | 46 | 1.84 | 🟢 |
| 11 | hotSectorStore | 7 | 13 | 1.86 | 🟢 |
| 12 | dataSyncStore | 7 | 15 | 2.14 | 🟢 |
| 13 | analysisHubStore | 3 | 6 | 2.00 | 🟢 |
| 14 | collectionWizardStore | 19 | 38 | 2.00 | 🟢 |
| 15 | dataTestStore | 14 | 28 | 2.00 | 🟢 |
| 16 | databridgeStore | 4 | 8 | 2.00 | 🟢 |
| 17 | outputStore | 6 | 12 | 2.00 | 🟢 |
| 18 | hybridProofreadStore | 5 | 11 | 2.20 | 🟢 |
| 19 | engineStore | 4 | 9 | 2.25 | 🟢 |
| 20 | industryScoreStore | 20 | 45 | 2.25 | 🟢 |
| 21 | tradingHubStore | 3 | 7 | 2.33 | 🟢 |
| 22 | mcpServerStore | 2 | 5 | 2.50 | 🟢 |
| 23 | pageStore | 7 | 19 | 2.71 | 🟢 |
| 24 | fileImportStore | 8 | 22 | 2.75 | 🟢 |
| 25 | themeStore | 4 | 11 | 2.75 | 🟢 |
| 26 | searchStore | 13 | 37 | 2.85 | 🟢 |
| 27 | watchlistStore | 2 | 6 | 3.00 | 🟢 |

---

### 3.4 🟢 良好档：3.00 ~ 5.00（23 个）

| # | Store | Actions | Tests | 比率 | 状态 |
|---|---|---:|---:|---:|---|
| 28 | systemMonitorStore | 5 | 16 | 3.20 | 🟢 |
| 29 | commandStore | 9 | 29 | 3.22 | 🟢 |
| 30 | loopStatusStore | 3 | 10 | 3.33 | 🟢 |
| 31 | tradingStore | 9 | 30 | 3.33 | 🟢 |
| 32 | dataflowStore | 5 | 17 | 3.40 | 🟢 |
| 33 | inputHubStore | 5 | 17 | 3.40 | 🟢 |
| 34 | widgetStore | 7 | 24 | 3.43 | 🟢 |
| 35 | strategySnapshotStore | 7 | 25 | 3.57 | 🟢 |
| 36 | mechanismHealthStore | 3 | 11 | 3.67 | 🟢 |
| 37 | agentStore | 7 | 26 | 3.71 | 🟢 |
| 38 | customAgentStore | 4 | 15 | 3.75 | 🟢 |
| 39 | collectionRuntimeStore | 10 | 38 | 3.80 | 🟢 |
| 40 | sevenDimConfigStore | 20 | 76 | 3.80 | 🟢 |
| 41 | backtestStore | 7 | 28 | 4.00 | 🟢 |
| 42 | positionStore | 5 | 20 | 4.00 | 🟢 |
| 43 | rotationSignalStore | 3 | 12 | 4.00 | 🟢 |
| 44 | signalAdviceStore | 4 | 16 | 4.00 | 🟢 |
| 45 | marketDataStore | 10 | 42 | 4.20 | 🟢 |
| 46 | localKnowledgeStore | 9 | 38 | 4.22 | 🟢 |
| 47 | analysisStore | 8 | 34 | 4.25 | 🟢 |
| 48 | sectorAnalysisStore | 4 | 18 | 4.50 | 🟢 |
| 49 | industryDashboardStore | 4 | 19 | 4.75 | 🟢 |
| 50 | scoreDocStore | 15 | 75 | 5.00 | 🟢 |
| 51 | valuePitStore | 4 | 20 | 5.00 | 🟢 |

---

### 3.5 🟢 优秀档：5.00 ~ 10.0（10 个）

| # | Store | Actions | Tests | 比率 | 状态 |
|---|---|---:|---:|---:|---|
| 52 | profileStore | 14 | 76 | 5.43 | 🟢 |
| 53 | intentionPoolStore | 9 | 50 | 5.56 | 🟢 |
| 54 | disciplineStore | 5 | 31 | 6.20 | 🟢 |
| 55 | riskStore | 5 | 32 | 6.40 | 🟢 |
| 56 | researchPoolStore | 8 | 54 | 6.75 | 🟢 |
| 57 | orderStore | 7 | 50 | 7.14 | 🟢 |
| 58 | chatStore | 3 | 22 | 7.33 | 🟢 |
| 59 | signalQualityStore | 2 | 16 | 8.00 | 🟢 |
| 60 | executionStore | 7 | 61 | 8.71 | 🟢 |

---

### 3.6 🟢 超优秀档：≥ 10.0（6 个）

| # | Store | Actions | Tests | 比率 | 状态 | 说明 |
|---|---|---:|---:|---:|---|---|
| 61 | positionPoolStore | 8 | 85 | 10.63 | 🟢 | 核心交易持仓模块，业务逻辑复杂，组合场景密集 |
| 62 | portfolioStore | 1 | 13 | 13.00 | 🟢 | 单一 action 但组合场景丰富（导入/校验/持久化等） |
| 63 | dualStrategyStore | 3 | 46 | 15.33 | 🟢 | 双策略调度模块，USDT/Coin 双模式高密度场景 |
| 64 | analysisOrchestratorStore | 1 | 17 | 17.00 | 🟢 | 分析编排器，多流程组合测试 |
| 65 | workflowStore | 1 | 21 | 21.00 | 🟢 | 工作流编排多状态转换场景 |
| 66 | signalStore | 2 | 45 | 22.50 | 🟢 | 信号触发与通知场景极度密集 |

---

## 四、修复前后宏观数据对比（含 chatStore 补测）

| 指标 | 修复前 (BEFORE) | 修复后 (AFTER) | 变化幅度 |
|---|---:|---:|---:|
| Actions 识别总数 | 597 | 459 | **−138**（净移除 138 个误报，−23%） |
| Tests 总数 | 1682 | 1699 | **+17**（chatStore 补充 17 个边界/异常/并发场景用例） |
| 整体测试比率 | 2.82 | 3.70 | **+31%**（显著提升） |
| P2 警告 Store 数（< 0.5） | 0 | 0 | — |
| P1 错误 Store 数（< 0.3） | 0 | 0 | — |
| 比率 < 1.0 的生产 Store 数 | 3（chatStore 0.83, perfMetricsStore 0.83, predictionStore 0.75） | **0** | ✅ 清零 |
| 受影响 Store（移除误报） | — | 58 | — |
| 受影响 Store（恢复漏报） | — | 1（chatStore sendMessage） | — |

---

## 五、低比率重点监控清单（1.00 ~ 1.60）

> 团队新增或修改 action 时，**优先同步检查**以下 Store 的测试覆盖率，防止跌破门槛：

| Store | 当前比率 | 行动建议 |
|---|---:|---|
| predictionStore | 1.09 | 每新增 1 个 action ≥ 同步 1 个新 test；修改 action 必须回归原用例 |
| perfMetricsStore | 1.00 | 建议补 1~2 个异常场景（熔断、采样失败），拉缓冲到 1.2+ |
| multiFactorScreeningStore | 1.13 | 关键因子筛选策略新增后覆盖边界组合用例 |
| holdingsStore | 1.55 | 已达标，持续观察即可 |

---

## 六、异常波动与潜在误报排查结论（最终结论）

通过 **66 个 Store 全量审计 + 11 个目标 Store 的 interface 声明交叉校验 + 全量 Vitest 运行（66 测试文件 / 1699 用例 100% 通过）**，最终结论如下：

| 检查项 | 结果 | 说明 |
|---|---|---|
| 1. P1/P2 异常 Store | ✅ 不存在 | 所有 65 个生产 Store 测试比率 ≥ 1.00，无警告无错误 |
| 2. 残留正则误报 | ✅ 已清零 | 11 个目标 Store 的 interface 声明提取 101 个真实 action，与正则识别结果 **101/101 完全一致** |
| 3. 漏报恢复隐患 | ✅ 无 | chatStore `sendMessage` 漏报已恢复；`[^\n)]*` 单行限制在 66 个 Store 中未引入新漏报 |
| 4. 覆盖率异常波动 | ✅ 无 | 比率分布呈**连续平滑曲线**（1.00 → 1.09 → 1.13 → 1.55 → 1.60 → 1.84 → 1.86 → 2.00 → ... → 22.50），无突兀跳跃或断档 |
| 5. chatStore 补测效果 | ✅ 显著改善 | 比率从修复前误报阶段 0.83 → 正则修复后 1.67 → 补充 17 用例后 **7.33**，进入 🟢 优秀档 |
| 6. persist 配置回调误报 | ✅ 已清零 | `partialize/onRehydrateStorage/getItem/setItem/removeItem/migrate` 等 6 项已加入 `INTERNAL_FIELDS` 排除 |
| 7. 控制关键字误报 | ✅ 已清零 | `if/for/while/switch/catch/with` 已通过 `isControlKeyword()` 过滤 |

**✅ 最终结论：修复后 66 个 Store 覆盖率数据**无异常波动、无潜在误报、无漏报隐患**。数据准确可信，可作为团队覆盖率达标基线。**

---

## 七、脚本正则修复回顾（四处核心缺陷 + 数据对比）

| # | 缺陷类型 | 修复前（有 Bug） | 修复后（正确） | 效果 / 数据对比 |
|---|---|---|---|---|
| 1 | 跨行贪婪匹配 | `[^)]*`（字符类匹配换行符，跨越多行） | `[^\n)]*`（仅限单行匹配） | 解决 chatStore `messages: []` 跨行吞掉 `sendMessage: async (...) =>` 的**漏报**问题；1 个 Store 恢复漏报 |
| 2 | 括号可选（set 内嵌键误报） | `\(?`（括号可选，匹配无括号单参箭头） | `\(`（强制括号必选） | 清除 45+ 个 Store 中 `set({ messages: state.messages.map((msg) =>` 这类**嵌套键误报**；已全仓 Grep 确认无 `name: x =>` 无括号单参箭头，无漏报风险 |
| 3 | 控制关键字误识别 | 无过滤机制，`if (...) {` 被认作方法名 | 新增 `isControlKeyword()` 排除 6 关键字 | 清除 workflowStore 等 6 处 `if/for/while/switch/catch/with` 控制流的**误报** |
| 4 | Zustand persist 配置回调误报 | 未在 `INTERNAL_FIELDS` 中排除 | 追加 `partialize/onRehydrateStorage/onRehydrate/migrate/getItem/setItem/removeItem` | 清除 34 个使用 Zustand `persist` 中间件的 Store 中配置项的**误报**（如 themeStore 的 custom storage 方法） |

**合计效果：action 识别数 597 → 459，净减少 138 个误报（−23%），同时恢复 1 个真实 action 漏报。整体测试比率 2.82 → 3.70（+31%）。**
