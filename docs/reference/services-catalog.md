---
title: V9 服务子域目录（Services Catalog）
type: reference
domain: backend
phase: development
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "定位：为 24 个服务子域提供统一文档锚点，消除「24 子域运行中但缺总览文档」的双向一致性落差。 实测来源：`src/services/` 24 个子域目录（2026-07-12 核对）。 状态：?..."
tags: [backend, log, reference]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# V9 服务子域目录（Services Catalog）

> **定位**：为 24 个服务子域提供统一文档锚点，消除「24 子域运行中但缺总览文档」的双向一致性落差。
> **实测来源**：`src/services/` 24 个子域目录（2026-07-12 核对）。
> **状态**：? P0 新增（目录骨架版）。每个子域的**接口契约 + 职责 + 数据流**须由各子域 owner 在 P0-6 后续迭代扩写为独立 `*_contract.md`（此处先给锚点与职责摘要，标记 `[TODO 扩写契约]`）。

---

## 使用约定

- 本目录是 24 子域的**唯一索引**；各子域详细契约文档命名 `{subdomain}-contract.md`，置于 `docs/architecture/services/`。
- 所有子域须遵守 `../../AGENTS.md` 分层：`services → core/data/lib(白名单)`，禁直写 db（经 `DataBridge`）。

---

## 子域清单（24 + 顶层文件）

| # | 子域 | 目录 | 职责摘要 | 契约状态 |
|---|------|------|----------|----------|
| 1 | ai-center | `src/services/ai-center/` | AI 中心：大模型调用编排、智能对比 | ? `ai-center-contract.md` |
| 2 | analysis | `src/services/analysis/` | 投研分析核心：指标计算、财报解析 | ? `analysis-contract.md` |
| 3 | backtest | `src/services/backtest/` | 回测引擎：策略回测与绩效 | ? `backtest-contract.md` |
| 4 | collection | `src/services/collection/` | 数据采集编排（orchestrator/pipeline/quality） | ? `collection-contract.md` |
| 5 | data-collector | `src/services/data-collector/` | 数据收集器：对接外部源、写 IndexedDB | ? `data-collector-contract.md` |
| 6 | execution | `src/services/execution/` | 交易执行：下单/撤单流程 | ? `execution-contract.md` |
| 7 | export | `src/services/export/` | 导出：报告/数据导出 | ? `export-contract.md` |
| 8 | fetcher | `src/services/fetcher/` | 行情/资讯抓取：API 适配 | ? `fetcher-contract.md` |
| 9 | hybrid-proofread | `src/services/hybrid-proofread/` | 混合校对：人机协同校验 | ? `hybrid-proofread-contract.md` |
| 10 | input | `src/services/input/` | 输入处理：用户录入/配置解析 | ? `input-contract.md` |
| 11 | llm | `src/services/llm/` | 大模型服务：prompt/对话管理 | ? `llm-contract.md` |
| 12 | news | `src/services/news/` | 新闻资讯：采集/清洗/标签 | ? `news-contract.md` |
| 13 | portfolio | `src/services/portfolio/` | 组合管理：持仓/权重 | ? `portfolio-contract.md` |
| 14 | pwa | `src/services/pwa/` | PWA：离线/推送/安装 | ? `pwa-contract.md` |
| 15 | rbac | `src/services/rbac/` | 权限：角色与访问控制 | ? `rbac-contract.md` |
| 16 | scoring | `src/services/scoring/` | 评分引擎：v6 五因子（合成种子，UI 标示例） | ? `scoring-contract.md` |
| 17 | screening | `src/services/screening/` | 选股/筛选：条件引擎 | ? `screening-contract.md` |
| 18 | stock-analysis | `src/services/stock-analysis/` | 个股分析：深度分析 | ? `stock-analysis-contract.md` |
| 19 | stockpool | `src/services/stockpool/` | 股票池：池管理/监控 | ? `stockpool-contract.md` |
| 20 | system | `src/services/system/` | 系统级：配置/健康/启动 | ? `system-contract.md` |
| 21 | trade | `src/services/trading/` | 交易域：交易实体/状态 | ? `trade-contract.md` |
| 22 | trading | `src/services/trading/` | 交易业务：组合/策略/风控编排 | ? `trading-contract.md` |
| 23 | useCase | `src/services/useCase/` | 用例层：业务用例编排 | ? `usecase-contract.md` |

### 顶层服务文件（非子域目录）

| 文件 | 职责 |
|------|------|
| `contracts/` | 服务间契约类型 |
| `errorBus/` | 错误总线 |
| `resilience/` | 弹性/重试/熔断 |
| `riskControlService` | 风控服务（与 trading 协作） |
| `unifiedStockService` | 统一股票数据服务（产出 `UnifiedStockData`） |
| `feedbackService` | 用户反馈服务 |

---

## 验收

- ? 24 子域 100% 在此有锚点（本文件）。
- ? 各子域独立契约文档：24/24 完成（P3-3 已完成）。
- 索引接入：本文件已被 `docs/README.md` B 类引用。
