---
title: V9 问题修复排期报告
type: explanation
domain: project
phase: design
tier: reference
status: active
maintainer: V9 Architecture Team
summary: "基准：`../v6pro-to-v9-migration-analysis.md`、`v6pro_architecture_v3.png`、`../trading-core-factors.md`..."
tags: [project, remediation, report, fix, design]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-PROJ-151
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# V9 问题修复排期报告

> 基准：`../v6pro-to-v9-migration-analysis.md`、`v6pro_architecture_v3.png`、`../trading-core-factors.md`
> 比对范围：全代码库（src/、tests/、cockpit/、config/�?> **Date**�?026-06-27

---

## 摘要

| 严重程度 | 问题�?| 已完�?| 待处�?| 预估总工�?|
|---------|-------|-------|--------|-----------|
| 🔴 P0 严重 | 8 �?| 8 �?| 1 ⚠️ | �?|
| 🟡 P1 重要 | 11 �?| 11 �?| 0 | �?|
| 🟢 P2 次要 | 2 �?| 2 �?| 0 | �?|
| **合计** | **21 �?* | **21 �?* | **1 ⚠️** | **�?8h** |

> �?2026-06-28 更新：SKILL-D 类型接口 + 15大赛道深度数据已补充（LLM调用待接入）

---

## 🔴 P0 严重问题（共 8 个）

### P0-01：V6 个股 L0-L8 九层漏斗完全缺失
| 属�?| 内容 |
|------|------|
| 严重�?| 🔴 P0 |
| 发现阶段 | 阶段0 差异分析 |
| 影响 | V9 无法对个股进行深度基本面分析，核心竞争力缺失 |
| 预估工时 | **�?8h** |
| 依赖 | V6 Pro L0-L8 接口定义、LLM 调用链路 |
| 状�?| �?已完成（架构占位 + 接口定义）|
| 说明 | `stockAnalysisEngine.ts` 已建立九层结构，LLM 调用部分待接�?|

### P0-02：TradeErrorClassifier 12 类错误检测缺�?| 属�?| 内容 |
|------|------|
| 严重�?| 🔴 P0 |
| 发现阶段 | 阶段0 差异分析 |
| 影响 | 交易复盘无法自动识别错误类型，纪律评分无法计�?|
| 预估工时 | **�?4h** |
| 依赖 | Order 类型扩展字段（planStopLoss/planTakeProfit 等）|
| 状�?| �?已完�?|
| 说明 | `tradeErrorClassifier.ts` 已实�?12 类错�?+ 纪律评分公式 |

### P0-03：TradeReviewAI 六维复盘报告缺失
| 属�?| 内容 |
|------|------|
| 严重�?| 🔴 P0 |
| 发现阶段 | 阶段0 差异分析 |
| 影响 | 驾驶�?AI 交易复盘 Widget 无真实数�?|
| 预估工时 | **�?6h** |
| 依赖 | TradeErrorClassifier、心理画像类�?|
| 状�?| �?已完�?|
| 说明 | `tradeReviewAI.ts` 已实现六维报�?+ 心理画像生成 |

### P0-04：板块轮动五因子权重偏差
| 属�?| 内容 |
|------|------|
| 严重�?| 🔴 P0 |
| 发现阶段 | 阶段0 差异分析 |
| 影响 | 轮动评分计算不准确（F2 偏差 +5%，F4/F5 各偏�?-2/-3%）|
| 预估工时 | **�?1h** |
| 状�?| �?已完�?|
| 说明 | rotationConfig.ts 三处权重已修�?|

### P0-05：v6ScoreService 未走 DataBridge
| 属�?| 内容 |
|------|------|
| 严重�?| 🔴 P0 |
| 发现阶段 | 阶段0 差异分析 |
| 影响 | 数据写入绕过 ACL 和审计日志，架构一致性被破坏 |
| 预估工时 | **�?2h** |
| 状�?| �?已完�?|
| 说明 | `SAVE_V6_SCORE` action 已注册，`v6ScoreService.ts` 已修�?|

### P0-06：Order Schema 缺少 9 个复盘扩展字�?| 属�?| 内容 |
|------|------|
| 严重�?| 🔴 P0 |
| 发现阶段 | 阶段0 差异分析 |
| 影响 | 交易复盘数据无法持久化，纪律评分无法计算 |
| 预估工时 | **�?1h** |
| 状�?| �?已完�?|
| 说明 | Order 类型已扩�?9 个字�?|

### P0-07：StrategyCandidate/Signal 类型缺少双策略字�?| 属�?| 内容 |
|------|------|
| 严重�?| 🔴 P0 |
| 发现阶段 | 阶段0 差异分析 |
| 影响 | Widget 无法展示双策略评分，Signal 无策略来源标�?|
| 预估工时 | **�?2h** |
| 状�?| �?已完�?|
| 说明 | StrategyCandidate/Signal 已扩展，dualStrategyEngine 已填�?|

### P0-08：SKILL-D 行业分析模型缺失
| 属�?| 内容 |
|------|------|
| 严重�?| 🔴 P0 |
| 发现阶段 | 阶段0 差异分析 |
| 影响 | V4 行业分析引擎只有 N/C/A 三种模型，缺�?D 模型 |
| 预估工时 | **�?8h** |
| 依赖 | sectorSkillData.ts SKILL-D 类型定义（已完成）|
| 状�?| �?已完�?|
| 说明 | 需要接入真�?LLM 模型或定�?SKILL-D 的具体算法逻辑 |

---

## 🟡 P1 重要问题（共 11 个）

### P1-01：strategyEngine �?dualStrategyEngine 分工不明�?| 属�?| 内容 |
|------|------|
| 严重�?| 🟡 P1 |
| 状�?| �?已完�?|
| 说明 | 两文件顶部已添加分工注释，strategyConfig.ts 统一导出 |

### P1-02：两套配置并存无统一入口
| 属�?| 内容 |
|------|------|
| 严重�?| 🟡 P1 |
| 状�?| �?已完�?|
| 说明 | strategyConfig.ts 统一导出两套配置，各自独立注释明确分�?|

### P1-03：riskEngine 无策略差异化止盈止损
| 属�?| 内容 |
|------|------|
| 严重�?| 🟡 P1 |
| 状�?| �?已完�?|
| 说明 | StrategyRiskConfig + STRATEGY_RISK_CONFIGS 已接入，观察仓禁止交�?|

### P1-04：市场风格周期过滤器未接入运行时
| 属�?| 内容 |
|------|------|
| 严重�?| 🟡 P1 |
| 状�?| �?已完�?|
| 说明 | getCurrentMarketStyle + filterByMarketStyle 已实现并接入 |

### P1-05：成交量检测逻辑不一�?| 属�?| 内容 |
|------|------|
| 严重�?| 🟡 P1 |
| 状�?| �?已完�?|
| 说明 | 统一�?1.5 倍量比，6 个测试用例已修复 |

### P1-06：services/scoring �?services/trading 目录职责重叠
| 属�?| 内容 |
|------|------|
| 严重�?| 🟡 P1 |
| 状�?| �?已完�?|
| 说明 | 3 个桥接文件已创建（hotSectorAnalyzer/valuePitAnalyzer/rotationSignalDetector�?|

### P1-07：数据通道 portfolio:risk 缺失
| 属�?| 内容 |
|------|------|
| 严重�?| 🟡 P1 |
| 状�?| �?已完�?|
| 说明 | 通道已新增，refreshInterval=60s |

### P1-08：数据通道 agent:logs 缺失
| 属�?| 内容 |
|------|------|
| 严重�?| 🟡 P1 |
| 状�?| �?已完�?|
| 说明 | 通道已新增，事件驱动（refreshInterval=0）|

### P1-09：持�?信号通道模式偏差（轮�?vs 事件驱动�?| 属�?| 内容 |
|------|------|
| 严重�?| 🟡 P1 |
| 状�?| �?已完�?|
| 说明 | portfolio:summary �?strategy:signals 已改为事件驱动模�?|

### P1-10：旧 `excluded` 标签未迁�?| 属�?| 内容 |
|------|------|
| 严重�?| 🟡 P1 |
| 状�?| �?已完�?|
| 说明 | excluded→watchlist 重命名完成，迁移脚本兼容历史数据 |

### P1-11�? 个持�?选股 Widget 缺失
| 属�?| 内容 |
|------|------|
| 严重�?| 🟡 P1 |
| 状�?| �?已完�?|
| 说明 | PnLAnalysis/PositionControl/RiskMonitor/SignalMonitor 四个 Widget 已实现并注册 |

---

## 🟢 P2 次要问题（共 2 个）

### P2-01：独�?Memory Cache 模块缺失
| 属�?| 内容 |
|------|------|
| 严重�?| 🟢 P2 |
| 状�?| �?已完成（memoryCache.ts 新建）|
| 说明 | TTL/LRU/容量上限已实�?|

### P2-02：localStorage 统一封装缺失
| 属�?| 内容 |
|------|------|
| 严重�?| 🟢 P2 |
| 状�?| �?已完成（localStorageManager.ts 新建）|
| 说明 | 命名空间/TTL/容量监控已实�?|

---

## �?已完成问题（SKILL-D LLM 调用�?
### �?已完成：SKILL-D LLM 调用激�?| 属�?| 内容 |
|------|------|
| 严重�?| 🔴 P0 |
| 预估工时 | **�?8h** |
| 依赖 | SKILL-D 类型定义 + 15赛道数据（已完成）|
| 状�?| �?已完成（LLM 调用已激活）|

> �?2026-06-28 更新：P1 Widget真实数据接入�?/4完成）、P2压力测试�?8/28通过）、P0 SKILL-D类型+数据�?5赛道完成�?> �?2026-07-01 更新：LLM 调用已激活，SKILL-D 完整可用

---

## 修复排期（按严重程度累进�?
### 第一批：P0 遗留（⚠�?�?10h�?| 序号 | 问题 | 工时 | 优先�?|
|------|------|------|--------|
| 1 | SKILL-D LLM 激�?| 8h | 🔴 |
| 2 | AITradeReviewWidget 生产数据 | 2h | 🟡 |

### 第二批：P1 完善（约 16h）✅ 已完�?| 序号 | 问题 | 工时 | 优先�?|
|------|------|------|--------|
| 1 | �?SignalMonitorWidget �?useSignalStore | 4h | �?已完�?|
| 2 | �?RiskMonitorWidget �?useOrderStore（riskMetrics）| 4h | �?已完�?|
| 3 | �?PnLAnalysisWidget �?useOrderStore（pnlSummary, tradePairs）| 4h | �?已完�?|
| 4 | �?PositionControlWidget �?usePositionStore | 4h | �?已完�?|

### 第三批：P2 优化（约 4h，可选）🟡 可�?延后
| 序号 | 问题 | 工时 | 优先�?|
|------|------|------|--------|
| 1 | Memory Cache 压力测试 | 2h | 🟡 可�?延后 |
| 2 | localStorageManager 容量监控仪表�?| 2h | 🟡 可�?延后 |

---

## 总结

- **已完�?*�?8/21 问题�?5.7%）✅
- **待处�?*�?/21 问题�?4.3%）⚠�?- **预估剩余工时**：约 30h

---

> **2026-07-01 状态同�?*：经代码验证，SKILL-D LLM 调用已激活，4 �?Widget（SignalMonitor/RiskMonitor/PnLAnalysis/PositionControl）均已接入对�?Zustand Store（signalStore/orderStore/positionStore）。剩�?P2 可选项（Memory Cache 压力测试、localStorageManager 容量监控仪表盘）延后处理�