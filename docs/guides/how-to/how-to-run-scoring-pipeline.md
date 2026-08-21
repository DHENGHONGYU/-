---
doc_id: V9-DOC-DEV-017
title: "如何运行采集与评分流水线"
domain: project
status: active
last_updated: 2026-08-17
---
covers_code:
  - src/config/dbConfig.ts
  - src/services/scoring/v6-engine/config.ts


---
title: 如何运行采集与评分流水线
type: how-to
domain: data
phase: deployment
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "15 分钟上手的采集+评分全流程操作指南，覆盖数据采集、V6 评分计算、结果查看与常见问题排查"
tags: [data, collection, scoring, pipeline, v6]
version: v1.0.0
last_updated: 2026-07-19
code_version: "2.0.0-rc.2"
doc_id: V9-DOC-DATA-077
related_docs: [V9-DOC-DATA-015, V9-DOC-BACK-020]
referenced_by: [V9-DOC-BACK-046]
change_log:
  - version: v1.0.0
    changes: Initial version established
    date: 2026-07-19
---

# 如何运行采集与评分流水线

> **版本**：v1.0.0  
> **更新日期**：2026-07-19  
> **适用范围**：需要在 15 分钟内完成从数据采集到 V6 评分出分的完整流程，并能自行排查常见问题的用户与开发者
---

## 前置检查清单

开始运行流水线前，请逐项确认以下前置条件：

- [ ] 本地开发环境已就绪（Node.js ≥ 18，npm 可用）
- [ ] 项目依赖已安装完成（`npm install` 执行成功）
- [ ] 浏览器支持 IndexedDB（Chrome / Edge / Firefox 最新稳定版）
- [ ] 数据库 `V6ProDB` 已初始化（版本 32，首次启动自动创建）
- [ ] 已准备 1 只以上目标股票代码用于试跑（如 600519.SH）
- [ ] 已阅读 [数据采集契约](../../reference/data-collector-contract.md) 了解采集通道定义
- [ ] 已阅读 [V6 评分契约](../../reference/scoring-contract.md) 了解评分口径

---

## 阶段 1：数据采集（约 5 分钟）

### 1.1 采集通道概览

采集层统一位于 `src/services/data-collector/`，按数据类型划分通道：

| 数据类型 | Store 名称 | 说明 |
|----------|-----------|------|
| `daily_quotes` | `dailyQuotes` | 日线 K 线 / 行情数据 |
| `financial_report` | `financialReports` | 财务报表数据 |
| `news` | `news` / `newsStockMap` | 新闻舆情数据 |
| `sector_data` | `sectorScores` | 板块 / 行业数据 |

> **架构约束**：采集层写入一律经 DataBridge 信封路由至 IndexedDB（`V6ProDB`），Store 名称以 `src/config/dbConfig.ts` 的 `STORE_NAME` 为准。

### 1.2 执行采集

**方式一：通过 UI 触发（推荐新用户）**

1. 打开 V9 应用，进入输入舱（Input / 采集面板）
2. 在股票代码输入框中填入目标代码（支持批量，逗号分隔）
3. 勾选需要采集的数据类型（建议首次全选：K 线 + 财报 + 新闻）
4. 点击「开始采集」按钮
5. 等待进度条完成，查看采集结果摘要

**方式二：通过代码触发（适合调试）**

```typescript
import { runCollection } from '@/services/data-collector/dataCollectorService'

const result = await runCollection({
  id: 'manual-001',
  symbolList: ['600519.SH', '000858.SZ'],
  dataTypes: ['daily_quotes', 'financial_report'],
  schedule: 'once',
  priority: 'high',
  createdAt: new Date().toISOString(),
})

console.log(`采集完成：成功 ${result.success} / 失败 ${result.failed}，质量分 ${result.qualityScore}`)
```

### 1.3 采集结果验证

采集完成后必须验证数据已正确落库，再进入评分阶段：

1. **数量验证**：目标股票的记录数 > 0，且质量分不低于 80
2. **完整性验证**：无大面积 `missing` 字段，关键字段（收盘价、财务主表）齐全
3. **时效性验证**：数据日期与当前交易日接近

```typescript
import { dataLayer } from '@/data/dataLayer'

// 验证行情数据
const quotes = await dataLayer.dailyQuotes.getBySymbol('600519.SH')
console.log(`K线记录数：${quotes?.history?.length ?? 0}`)

// 验证财报数据
const finance = await dataLayer.financialReports.getBySymbol('600519.SH')
console.log(`财报状态：${finance ? '已落库' : '缺失'}`)
```

> **质量阈值说明**：采集质量分阈值 80 定义于 `COLLECTION_QUALITY_THRESHOLD`，低于阈值时建议重采或检查数据源。

---

## 阶段 2：执行 V6 评分（约 5 分钟）

### 2.1 评分输入依赖

V6 评分引擎依赖采集层提供的数据，阶段 1 的数据完整性直接决定评分覆盖率：

| 输入数据 | 来源 Store | 影响的因子层 |
|----------|--------|-------------|
| 股票基础信息（price/pe/pb/roe） | `stocks` | L3v 估值层、L1 基本面层 |
| 日线 K 线 / 行情数据 | `dailyQuotes` | L8 风险层、L5 动量层、L4 盈利层 |
| 财务报表数据 | `financialReports` | L3f 健康层、L2 成长层、L7 预期层 |
| 板块 / 行业数据 | `sectorScores` | L-1 行业景气度层 |
| 新闻 / 舆情数据 | `news` 等 | L0 宏观层、L6 Hype 情绪层 |

### 2.2 执行 V6 评分

**方式一：通过 UI 触发**

1. 打开 V9 应用，进入分析舱（个股分析页面）
2. 选择目标股票代码
3. 点击「开始评分」按钮，等待 V6 引擎计算完成
4. 查看评分结果卡片（正常单票耗时 < 1 秒）

**方式二：通过代码触发**

```typescript
import { runV6Score } from '@/services/scoring/v6ScoreService'

// 单票评分
const result = await runV6Score('600519.SH')
if (result.success && result.data) {
  console.log(`综合评分：${result.data.score} / 5，评级：${result.data.rating}`)
}

// 批量评分
import { runV6ScoreBatch } from '@/services/scoring/v6ScoreService'
const batchResult = await runV6ScoreBatch(['600519.SH', '000858.SZ'])
console.log(`批量完成：成功 ${batchResult.success} 只，失败 ${batchResult.failed} 只`)
```

### 2.3 评分因子结构

V6 评分引擎按 11 层因子加权计算综合分（L-1 至 L8）：

| 层 ID | 因子名称 | 权重 | 数据来源 |
|-------|--------|------|------|
| L-1 | 行业景气度 | 10% | 基于 SKILL-C/N 行业分类 |
| L0 | STEEP 宏观环境 | 8% | 宏观指标数据 |
| L1 | 基本面质量 | 15% | 财报核心指标 |
| L2 | 成长能力 | 10% | 财报同比环比 |
| L3f | 财务健康度 | 10% | 资产负债与现金流 |
| L3v | 估值水平 | 8% | PE/PB/PEG 对比 |
| L4 | 盈利能力 | 8% | 利润率与回报率 |
| L5 | T-M 动量 | 5% | 价量-趋势指标 |
| L6 | Hype 情绪 | 7% | 舆情热度与资金流 |
| L7 | 综合预期 | 15% | 分析师预期标准化 |
| L8 | 风险因子 | 4% | K线结构与事件风险 |

> **权重配置**：默认权重定义于 `src/services/scoring/v6-engine/config.ts` 的 `DEFAULT_WEIGHTS`，调整方法见配置指南。

### 2.4 评分结果存储

评分结果同时写入三个消费通道：

- **IndexedDB**：`v6_scores` store，经 DataBridge 信封写入
- **Zustand Store**：`useV6ScoreStore`，供 UI 组件响应式订阅
- **审计追踪**：`ScoreAuditTrail` 记录每次评分的输入快照，可通过 `engine.audit()` 查询

---

## 阶段 3：查看评分结果（约 3 分钟）

### 3.1 在 UI 中查看

1. 打开 V9 应用，进入分析舱个股详情页
2. 评分结果面板展示以下核心字段：
   - **综合评分**：0-5 分制（同时显示 0-100 百分制换算）
   - **投资评级**：strong_buy / buy / hold / sell / strong_sell
   - **分层得分**：11 层因子各自的得分与权重
   - **置信度**：数据覆盖率与置信度等级
   - **风险提示**：触发的风险预警条目

### 3.2 通过代码查询评分结果

```typescript
import { dataLayer } from '@/data/dataLayer'

// 读取已落库的评分结果
const score = await dataLayer.v6Scores.getBySymbol('600519.SH')
if (score) {
  console.log(`综合分：${score.score}`)
  console.log(`评级：${score.rating}`)
  console.log(`覆盖率：${score.coverageRate}`)
  console.log(`跳过层：${score.skippedLayers?.join(', ') ?? '无'}`)
  console.log(`引擎版本：${score.engineVersion}`)
}
```

### 3.3 评分结果质量检查清单

拿到评分结果后，请逐项校验以下指标：

- [ ] `score` 在 0-5 区间内
- [ ] `rating` 为 5 档评级之一且与分数区间一致
- [ ] `coverageRate` > 0.5（低于该值说明输入数据缺口大，评分可信度低）
- [ ] `skippedLayers` 中不含关键财务层（L1/L3f/L3v/L7）
- [ ] `engineVersion` 与当前代码版本一致
- [ ] `timestamp` 与最近采集时间接近（评分基于新数据）
- [ ] 交叉验证 `crossValidation.passed` 为 true

---

## 常见问题排查

### Q1：采集失败 / 采集结果为空？

**现象**：执行采集后返回失败，或成功数为 0。

**排查步骤**：
1. 确认网络连通且数据源可用（akshare / 第三方接口是否被限流）
2. 打开 F12 控制台，查看 `[data-collector]` 或 `[fetcher]` 前缀日志定位失败点
3. 检查 ACL 配置：确认 `fetcher` 角色对目标 store 有 write 权限
4. 查看采集历史：`collection_history` store 中记录了每次采集的失败原因
5. 确认股票代码格式正确（如 600519.SH，区分大小写与后缀）

### Q2：评分失败 / 评分结果为空？

**现象**：执行评分后返回失败，或评分结果为 0 分。

**排查步骤**：
1. 确认阶段 1 采集已完成，`dailyQuotes` 与 `financialReports` 均有数据
2. 打开控制台查看 `[V6ScoreEngine]` 前缀日志
3. 检查覆盖率：`coverageRate` 为 0 说明引擎未取到任何输入数据
4. 确认引擎已正确初始化：`V6ScoreEngine` 构造与计算器注册无异常
5. 查看 `skippedLayers`，确认是否因数据缺失导致大量层被跳过

### Q3：评分结果异常（恒为 0 或恒为 5）？

**现象**：所有股票评分相同，或评分固定在边界值。

**排查步骤**：
1. 检查权重配置：`DEFAULT_WEIGHTS` 各层权重之和必须为 1.0
2. 检查 `sanitizeScore` 清洗逻辑：确认输入中无 NaN / Infinity 污染
3. 检查输入数据：极端值（如负 PE、空财报）会拉偏因子得分
4. 检查评级映射：`rating` 阈值与分数区间是否匹配
5. 运行单测：`npm test -- v6-engine` 确认引擎逻辑未被破坏

### Q4：评分结果已计算但 UI 不显示？

**现象**：控制台能查到评分，但页面评分卡片为空。

**排查步骤**：
1. 确认评分写入的 store 名称与 `STORE_NAME` 常量一致
2. 检查 DataBridge 写入日志，确认信封已送达（可查 `command_audit_logs`）
3. 检查 ACL 配置：`analyzer` 角色对评分 store 需有 read 权限
4. 检查 symbol 格式：UI 查询代码与落库代码需完全一致（后缀/大小写不一致会导致查不到）

---

## 相关文档

| 文档 | 路径 | 说明 |
|------|------|------|
| 数据采集契约 | `../../reference/data-collector-contract.md` | 采集通道、数据格式与写入约定 |
| V6 评分契约 | `../../reference/scoring-contract.md` | V6 评分口径与接口定义 |
| 数据库配置 | `../../src/config/dbConfig.ts` | STORE_NAME / ACL_MATRIX / DB_VERSION |
| 引擎配置文件 | `../../src/services/scoring/v6-engine/config.ts` | 权重、阈值与行业基准定义 |
| 引擎核心实现 | `../../src/services/scoring/v6-engine/engine.ts` | V6ScoreEngine 主逻辑 |
| V6 评分服务 | `../../src/services/scoring/v6ScoreService.ts` | 单票/批量评分入口 |

---

> **维护提示**：本文档描述的采集通道、Store 名称与评分字段以代码为准。流程变更或接口调整后请同步修订本文档；发现文档与代码不一致时请提 issue 并参考 `docs/guides/how-to/README.md` 中的贡献指引。
