---
title: V9 模块完成度逆向校验 — 修复行动清单
version: v1.0.0
last_updated: 2026-06-27
maintainer: Quality Auditor
status: active
---

# V9 模块完成度逆向校验 — 修复行动清单

> **审计范围**：批次 A-E（28 个模块）  
> **问题总数**：30 个（0 P0 + 1 P1 + 29 P2）  
> **已修复**：14 个（批次 A + 导航路径 + P1 回测）  
> **待修复**：16 个（18 P2）

---

## 一、P0 级问题（立即修复）

| 编号 | 模块 | 问题描述 | 文件路径 | 状态 |
|:---|:---|:---|:---|:---|
| — | — | **无 P0 级问题** | — | — |

---

## 二、P1 级问题（高优先级，尽快修复）

| 编号 | 模块 | 问题描述 | 文件路径 | 状态 |
|:---|:---|:---|:---|:---|
| C6-P1-001 | 策略回测 | 仅占位页，核心功能完全未实现（回测引擎、参数配置、结果图表、绩效指标） | `src/pages/analysis/BacktestPage.tsx` | ✅ 已修复 |

**修复内容**：
1. ✅ 创建策略回测核心引擎（`BacktestEngine.ts`）— 支持三种策略、信号/订单双源、逐日模拟交易
2. ✅ 实现参数配置界面（策略选择、时间范围、初始资金、手续费/滑点/仓位上限）
3. ✅ 实现回测结果图表（净值曲线 SVG 可视化）
4. ✅ 实现绩效指标计算（总收益、年化收益、最大回撤、夏普比率、胜率等）
5. ✅ 交易记录表格与持仓快照展示
6. ✅ 报告导出功能（PDF/Excel）

---

## 三、P2 级问题（中优先级，规划修复）

### 3.1 导航路径问题

| 编号 | 模块 | 问题描述 | 文件路径 | 状态 |
|:---|:---|:---|:---|:---|
| B2-P2-001 | 录入看板 | 快捷操作卡片中保留 `/input/prototype` 链接，该路由已删除 | `src/apps/input/InputDashboard.tsx:248` | ✅ 已修复（prototype 路由已删除，链接已移除） |
| D1-P2-001 | 交易舱 Hub | "交易信号"和"模拟持仓"链接均指向 `/trading`，导航路径不明确 | `src/pages/trading/TradingHubPage.tsx:36/42` | ✅ 已修复（模拟持仓改为 `/trading/holdings`） |
| E2-P2-003 | 总控舱 Hub | "系统监控"和"配置管理"链接均指向 `/command`，导航路径不明确 | `src/pages/command/CommandHubPage.tsx:35/41` | ✅ 已修复（系统监控 `/command/monitor`，配置管理 `/command/config`） |

### 3.2 缺失 Zustand Store（核心问题）

| 编号 | 模块 | 当前状态管理 | 建议 Store | 文件路径 | 修复成本 |
|:---|:---|:---|:---|:---|:---|
| B1-P2-002 | 输入舱 Hub | useState | `inputHubStore.ts` | `src/pages/input/InputHubPage.tsx` | 30 分钟 |
| B2-P2-003 | 录入看板 | usePoolData hook | `poolStore.ts` | `src/apps/input/InputDashboard.tsx` | 2 小时 |
| B3-P2-004 | 批量导入 | usePoolData hook | `poolStore.ts` | `src/apps/input/BulkImportPanel.tsx` | 1 小时 |
| B4-P2-005 | 热门板块 | usePoolData hook | `poolStore.ts` | `src/apps/input/HotSectorPanel.tsx` | 1 小时 |
| B5-P2-006 | 本地知识库 | useState | `localDocStore.ts` | `src/pages/input/LocalKnowledgePage.tsx` | 1 小时 |
| B6-P2-007 | 采集测试 | useState | `dataTestStore.ts` | `src/apps/input/DataTestPanel.tsx` | 30 分钟 |
| C1-P2-002 | 分析舱 Hub | useState | `analysisHubStore.ts` | `src/pages/analysis/AnalysisHubPage.tsx` | 30 分钟 |
| C2-P2-003 | V4 行业评分 | useIndustryScorePage hook | `industryScoreStore.ts` | `src/hooks/cabin/useIndustryScorePage.ts` | 2 小时 |
| C3-P2-004 | V6 个股评分 | useState | `stockScoreStore.ts` | `src/pages/analysis/StockAnalysisPage.tsx` | 2 小时 |
| C4-P2-005 | V6 智能评分 | useIntelligentScorePage hook | `intelligentScoreStore.ts` | `src/hooks/cabin/useIntelligentScorePage.ts` | 2 小时 |
| C5-P2-006 | 行业分析 | useState | `sectorStore.ts` | `src/pages/analysis/SectorAnalysisPage.tsx` | 2 小时 |
| C7-P2-007 | 评分文档 | useState | `scoreDocStore.ts` | `src/pages/analysis/ScoreDocPage.tsx` | 1 小时 |
| C8-P2-008 | 智能资讯 | useState | `newsStore.ts`（已有，需迁移） | `src/pages/analysis/NewsPage.tsx` | 1 小时 |
| D1-P2-002 | 交易舱 Hub | useState | `tradingHubStore.ts` | `src/pages/trading/TradingHubPage.tsx` | 30 分钟 |
| D2-P2-003 | 交易信号 | 9 个 useState | `tradingStore.ts` | `src/apps/trading/TradingApp.tsx` | 2 小时 |
| D3-P2-004 | 策略快照 | 10 个 useState | `strategySnapshotStore.ts` | `src/pages/trading/StrategySnapshotPage.tsx` | 2 小时 |
| E1-P2-001 | 输出舱 | useState | `outputStore.ts` | `src/apps/output/OutputApp.tsx` | 1 小时 |
| E3-P2-005 | 总控舱 | useState | `commandStore.ts` | `src/apps/command/CommandApp.tsx` | 1 小时 |

### 3.3 功能缺失/规划中

| 编号 | 模块 | 问题描述 | 文件路径 | 状态 |
|:---|:---|:---|:---|:---|
| E1-P2-002 | 输出舱 | 输出功能单一，缺少报告生成、PDF 导出等功能 | `src/apps/output/OutputApp.tsx` | 📋 规划中 |
| E2-P2-004 | 总控舱 Hub | 4 个可扩展能力模块（AI体中心、风控网关、报告导出、信号质量复盘）标记为"数据层待建" | `src/pages/command/CommandHubPage.tsx:46-79` | 📋 规划中 |

### 3.4 无需修复

| 编号 | 模块 | 问题描述 | 文件路径 | 原因 |
|:---|:---|:---|:---|:---|
| E4-P2-006 | Mock 测试页 | 本地 Zustand Store 无法跨组件共享 | `src/pages/MockTestPage.tsx:16-26` | 测试页面，设计合理 |

---

## 四、修复工作量估算

| 类别 | 问题数 | 状态 | 优先级 |
|:---|:---|:---|:---|
| P1 级问题 | 1 | ✅ 已修复 | 🔴 紧急 |
| 导航路径问题 | 3 | ✅ 已修复 | 🟢 低 |
| 缺失 Zustand Store（核心） | 18 | 📋 待修复 | 🟡 中 |
| 功能缺失（规划中） | 2 | 📋 规划中 | 📋 规划 |
| **总计** | **24** | **4 已修复 / 18 待修复 / 2 规划中** | |

---

## 五、优先修复顺序建议

1. ✅ **P1 策略回测**：已完成（回测引擎 + UI 集成）
2. ✅ **导航路径问题**（3个）：已完成
3. **交易信号 Store**（D2-P2-003）：交易核心模块，状态管理分散（2 小时）
4. **策略快照 Store**（D3-P2-004）：状态最复杂，10 个 useState（2 小时）
5. **输入舱 Store**（B2-B4）：共享 usePoolData hook，可合并为一个 Store（4 小时）
6. **分析舱 Store**（C2-C5）：评分类模块，结构相似（8 小时）
7. **输出舱/总控舱 Store**（E1/E3）：功能相对简单（2 小时）

---

## 六、修复后预期效果

| 指标 | 当前状态 | 预期目标 |
|:---|:---|:---|
| L2 状态层完成率 | 62% | 100% |
| 健康模块数 | 27 | 28 |
| 过时模块数 | 1 | 0 |
| 跨组件状态共享 | 部分支持 | 全部支持 |
| 导航清晰度 | 中 | 高 |
| **回测功能覆盖率** | **0%** | **✅ 已实现（策略配置、绩效计算、结果展示、报告导出）** |
| **导航路径清晰度** | **低** | **✅ 已修复（所有 Hub 模块路径明确）** |