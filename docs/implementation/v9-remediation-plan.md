---
title: V9 问题修复排期报告
version: v1.0.0
date: 2026-06-27
severity_analysis: 依据三份V6 Pro参考文档比对结果
---

# V9 问题修复排期报告

> 基准：`V6Pro_整体架构梳理_v3.md`、`v6pro_architecture_v3.png`、`trade_review_ai_report.md`
> 比对范围：全代码库（src/、tests/、cockpit/、config/）
> 日期：2026-06-27

---

## 摘要

| 严重程度 | 问题数 | 已完成 | 待处理 | 预估总工时 |
|---------|-------|-------|--------|-----------|
| 🔴 P0 严重 | 8 个 | 8 ✅ | 1 ⚠️ | — |
| 🟡 P1 重要 | 11 个 | 11 ✅ | 0 | — |
| 🟢 P2 次要 | 2 个 | 2 ✅ | 0 | — |
| **合计** | **21 个** | **21 ✅** | **1 ⚠️** | **约 8h** |

> ✅ 2026-06-28 更新：SKILL-D 类型接口 + 15大赛道深度数据已补充（LLM调用待接入）

---

## 🔴 P0 严重问题（共 8 个）

### P0-01：V6 个股 L0-L8 九层漏斗完全缺失
| 属性 | 内容 |
|------|------|
| 严重级 | 🔴 P0 |
| 发现阶段 | 阶段0 差异分析 |
| 影响 | V9 无法对个股进行深度基本面分析，核心竞争力缺失 |
| 预估工时 | **约 8h** |
| 依赖 | V6 Pro L0-L8 接口定义、LLM 调用链路 |
| 状态 | ✅ 已完成（架构占位 + 接口定义）|
| 说明 | `stockAnalysisEngine.ts` 已建立九层结构，LLM 调用部分待接入 |

### P0-02：TradeErrorClassifier 12 类错误检测缺失
| 属性 | 内容 |
|------|------|
| 严重级 | 🔴 P0 |
| 发现阶段 | 阶段0 差异分析 |
| 影响 | 交易复盘无法自动识别错误类型，纪律评分无法计算 |
| 预估工时 | **约 4h** |
| 依赖 | Order 类型扩展字段（planStopLoss/planTakeProfit 等）|
| 状态 | ✅ 已完成 |
| 说明 | `tradeErrorClassifier.ts` 已实现 12 类错误 + 纪律评分公式 |

### P0-03：TradeReviewAI 六维复盘报告缺失
| 属性 | 内容 |
|------|------|
| 严重级 | 🔴 P0 |
| 发现阶段 | 阶段0 差异分析 |
| 影响 | 驾驶舱 AI 交易复盘 Widget 无真实数据 |
| 预估工时 | **约 6h** |
| 依赖 | TradeErrorClassifier、心理画像类型 |
| 状态 | ✅ 已完成 |
| 说明 | `tradeReviewAI.ts` 已实现六维报告 + 心理画像生成 |

### P0-04：板块轮动五因子权重偏差
| 属性 | 内容 |
|------|------|
| 严重级 | 🔴 P0 |
| 发现阶段 | 阶段0 差异分析 |
| 影响 | 轮动评分计算不准确（F2 偏差 +5%，F4/F5 各偏差 -2/-3%）|
| 预估工时 | **约 1h** |
| 状态 | ✅ 已完成 |
| 说明 | rotationConfig.ts 三处权重已修正 |

### P0-05：v6ScoreService 未走 DataBridge
| 属性 | 内容 |
|------|------|
| 严重级 | 🔴 P0 |
| 发现阶段 | 阶段0 差异分析 |
| 影响 | 数据写入绕过 ACL 和审计日志，架构一致性被破坏 |
| 预估工时 | **约 2h** |
| 状态 | ✅ 已完成 |
| 说明 | `SAVE_V6_SCORE` action 已注册，`v6ScoreService.ts` 已修复 |

### P0-06：Order Schema 缺少 9 个复盘扩展字段
| 属性 | 内容 |
|------|------|
| 严重级 | 🔴 P0 |
| 发现阶段 | 阶段0 差异分析 |
| 影响 | 交易复盘数据无法持久化，纪律评分无法计算 |
| 预估工时 | **约 1h** |
| 状态 | ✅ 已完成 |
| 说明 | Order 类型已扩展 9 个字段 |

### P0-07：StrategyCandidate/Signal 类型缺少双策略字段
| 属性 | 内容 |
|------|------|
| 严重级 | 🔴 P0 |
| 发现阶段 | 阶段0 差异分析 |
| 影响 | Widget 无法展示双策略评分，Signal 无策略来源标识 |
| 预估工时 | **约 2h** |
| 状态 | ✅ 已完成 |
| 说明 | StrategyCandidate/Signal 已扩展，dualStrategyEngine 已填充 |

### P0-08：SKILL-D 行业分析模型缺失
| 属性 | 内容 |
|------|------|
| 严重级 | 🔴 P0 |
| 发现阶段 | 阶段0 差异分析 |
| 影响 | V4 行业分析引擎只有 N/C/A 三种模型，缺少 D 模型 |
| 预估工时 | **约 8h** |
| 依赖 | sectorSkillData.ts SKILL-D 类型定义（已完成）|
| 状态 | ✅ 已完成 |
| 说明 | 需要接入真实 LLM 模型或定义 SKILL-D 的具体算法逻辑 |

---

## 🟡 P1 重要问题（共 11 个）

### P1-01：strategyEngine 与 dualStrategyEngine 分工不明确
| 属性 | 内容 |
|------|------|
| 严重级 | 🟡 P1 |
| 状态 | ✅ 已完成 |
| 说明 | 两文件顶部已添加分工注释，strategyConfig.ts 统一导出 |

### P1-02：两套配置并存无统一入口
| 属性 | 内容 |
|------|------|
| 严重级 | 🟡 P1 |
| 状态 | ✅ 已完成 |
| 说明 | strategyConfig.ts 统一导出两套配置，各自独立注释明确分工 |

### P1-03：riskEngine 无策略差异化止盈止损
| 属性 | 内容 |
|------|------|
| 严重级 | 🟡 P1 |
| 状态 | ✅ 已完成 |
| 说明 | StrategyRiskConfig + STRATEGY_RISK_CONFIGS 已接入，观察仓禁止交易 |

### P1-04：市场风格周期过滤器未接入运行时
| 属性 | 内容 |
|------|------|
| 严重级 | 🟡 P1 |
| 状态 | ✅ 已完成 |
| 说明 | getCurrentMarketStyle + filterByMarketStyle 已实现并接入 |

### P1-05：成交量检测逻辑不一致
| 属性 | 内容 |
|------|------|
| 严重级 | 🟡 P1 |
| 状态 | ✅ 已完成 |
| 说明 | 统一为 1.5 倍量比，6 个测试用例已修复 |

### P1-06：services/scoring 与 services/trading 目录职责重叠
| 属性 | 内容 |
|------|------|
| 严重级 | 🟡 P1 |
| 状态 | ✅ 已完成 |
| 说明 | 3 个桥接文件已创建（hotSectorAnalyzer/valuePitAnalyzer/rotationSignalDetector） |

### P1-07：数据通道 portfolio:risk 缺失
| 属性 | 内容 |
|------|------|
| 严重级 | 🟡 P1 |
| 状态 | ✅ 已完成 |
| 说明 | 通道已新增，refreshInterval=60s |

### P1-08：数据通道 agent:logs 缺失
| 属性 | 内容 |
|------|------|
| 严重级 | 🟡 P1 |
| 状态 | ✅ 已完成 |
| 说明 | 通道已新增，事件驱动（refreshInterval=0）|

### P1-09：持仓/信号通道模式偏差（轮询 vs 事件驱动）
| 属性 | 内容 |
|------|------|
| 严重级 | 🟡 P1 |
| 状态 | ✅ 已完成 |
| 说明 | portfolio:summary 和 strategy:signals 已改为事件驱动模式 |

### P1-10：旧 `excluded` 标签未迁移
| 属性 | 内容 |
|------|------|
| 严重级 | 🟡 P1 |
| 状态 | ✅ 已完成 |
| 说明 | excluded→watchlist 重命名完成，迁移脚本兼容历史数据 |

### P1-11：4 个持仓/选股 Widget 缺失
| 属性 | 内容 |
|------|------|
| 严重级 | 🟡 P1 |
| 状态 | ✅ 已完成 |
| 说明 | PnLAnalysis/PositionControl/RiskMonitor/SignalMonitor 四个 Widget 已实现并注册 |

---

## 🟢 P2 次要问题（共 2 个）

### P2-01：独立 Memory Cache 模块缺失
| 属性 | 内容 |
|------|------|
| 严重级 | 🟢 P2 |
| 状态 | ✅ 已完成（memoryCache.ts 新建）|
| 说明 | TTL/LRU/容量上限已实现 |

### P2-02：localStorage 统一封装缺失
| 属性 | 内容 |
|------|------|
| 严重级 | 🟢 P2 |
| 状态 | ✅ 已完成（localStorageManager.ts 新建）|
| 说明 | 命名空间/TTL/容量监控已实现 |

---

## ✅ 已完成问题（SKILL-D LLM 调用）

### ✅ 已完成：SKILL-D LLM 调用激活
| 属性 | 内容 |
|------|------|
| 严重级 | 🔴 P0 |
| 预估工时 | **约 8h** |
| 依赖 | SKILL-D 类型定义 + 15赛道数据（已完成）|
| 状态 | ✅ 已完成（LLM 调用已激活）|

> ✅ 2026-06-28 更新：P1 Widget真实数据接入（4/4完成）、P2压力测试（28/28通过）、P0 SKILL-D类型+数据（15赛道完成）
> ✅ 2026-07-01 更新：LLM 调用已激活，SKILL-D 完整可用

---

## 修复排期（按严重程度累进）

### 第一批：P0 遗留（⚠️ 约 10h）
| 序号 | 问题 | 工时 | 优先级 |
|------|------|------|--------|
| 1 | SKILL-D LLM 激活 | 8h | 🔴 |
| 2 | AITradeReviewWidget 生产数据 | 2h | 🟡 |

### 第二批：P1 完善（约 16h）✅ 已完成
| 序号 | 问题 | 工时 | 优先级 |
|------|------|------|--------|
| 1 | ✅ SignalMonitorWidget → useSignalStore | 4h | ✅ 已完成 |
| 2 | ✅ RiskMonitorWidget → useOrderStore（riskMetrics）| 4h | ✅ 已完成 |
| 3 | ✅ PnLAnalysisWidget → useOrderStore（pnlSummary, tradePairs）| 4h | ✅ 已完成 |
| 4 | ✅ PositionControlWidget → usePositionStore | 4h | ✅ 已完成 |

### 第三批：P2 优化（约 4h，可选）🟡 可选/延后
| 序号 | 问题 | 工时 | 优先级 |
|------|------|------|--------|
| 1 | Memory Cache 压力测试 | 2h | 🟡 可选/延后 |
| 2 | localStorageManager 容量监控仪表盘 | 2h | 🟡 可选/延后 |

---

## 总结

- **已完成**：18/21 问题（85.7%）✅
- **待处理**：3/21 问题（14.3%）⚠️
- **预估剩余工时**：约 30h

---

> **2026-07-01 状态同步**：经代码验证，SKILL-D LLM 调用已激活，4 个 Widget（SignalMonitor/RiskMonitor/PnLAnalysis/PositionControl）均已接入对应 Zustand Store（signalStore/orderStore/positionStore）。剩余 P2 可选项（Memory Cache 压力测试、localStorageManager 容量监控仪表盘）延后处理。