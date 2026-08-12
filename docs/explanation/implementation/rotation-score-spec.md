---
title: Rotation Score Service 实现规格
version: v0.9.0-migration-implemented
last_updated: 2026-06-25
maintainer: V9 Architecture Team
status: active
change_log:
  - version: v0.9.0-migration-implemented
    changes: "C 类版本闭环(2026-08-11)：change_log 对齐当前版本"
    date: 2026-06-25
  - date: 2026-06-25
    author: Documentation Governor
    desc: 注入 Frontmatter 元数据（Phase 3 版本化）
---
> **Status**: Current  
> **Version**: v0.9.0-migration-implemented  
> **Last Updated**: 2026-06-25

# Rotation Score Service 实现规格

## 1. 定位与职责

`src/services/analysis/rotationScoreService.ts` 提供板块轮动量化评分模型。该模型从景气、资金、估值、β+相关性、量能五个维度对板块进行打分，输出综合评分、共振强度、信号分级、预警等级与下跌性质判定，为 Sector 分析页与投资组合调仓提供数据支持。

## 2. 目录结构

```text
src/services/analysis/
└── rotationScoreService.ts      # 板块轮动评分模型实现

tests/
└── rotationScoreService.test.ts # 模型单元测试
```

## 3. 模型概述

### 3.1 五因子十六指标

| 因子 | 权重 | 满分 | 子指标数量 | 角色 |
| --- | --- | --- | --- | --- |
| F1 景气因子 | 0.40 | 40 | 5 | 唯一趋势主导，买入核心依据 |
| F2 资金因子 | 0.30 | 30 | 4 | 确认机构态度，买入共振条件 |
| F3 估值因子 | 0.15 | 15 | 3 | 仅做赔率参考，不独立触发买入 |
| F4 β+相关系数 | 0.10 | 10 | 2 | 风格匹配度，轮动触发条件 |
| F5 量能因子 | 0.05 | 5 | 2 | 量价确认，过滤脉冲信号 |

### 3.2 市场风格周期

`MARKET_STYLES` 定义三种风格周期：

- `growth`：成长主导期
- `value`：价值修复期
- `balanced`：均衡震荡期

每种风格对应不同的仓位上限、现金要求与下跌性质容忍度。

## 4. 输入

主要输入参数：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `sectorCode` | `string` | 板块代码 |
| `sectorName` | `string` | 板块名称 |
| `scoreDate` | `string` | 评分日期（YYYY-MM-DD） |
| `subScores` | `Record<string, number>` | 16 个子指标得分 |
| `poolStocks` | `Array<{ symbol; name; v6Composite? }>` | 成分股/股票池 |
| `analysisReport` | `string`（可选） | 分析报告 |
| `modelUsed` | `string`（可选） | 模型版本标识 |

> 真实场景中，子指标得分应由外部行情/财务/宏观数据填充；当前 `saveDefaultRotationScores` 使用 `SECTOR_DEFINITIONS` 中的静态 `composite` 值作为兜底映射。

## 5. 输出

核心输出类型 `RotationSectorScore`（定义于 `src/data/types.ts`）：

```ts
export interface RotationSectorScore {
  id: string                      // sectorCode__scoreDate
  sectorCode: string
  sectorName: string
  swLevel1?: string
  swLevel2?: string
  swLevel3?: string
  scoreDate: string
  f1Jingqi: number                // 景气因子得分
  f2Zijin: number                 // 资金因子得分
  f3Guzhi: number                 // 估值因子得分
  f4Beta: number                  // β+相关系数得分
  f5Nengliang: number             // 量能因子得分
  total: number                   // 综合总分 0-100
  resonance: number               // 共振强度 0-10
  signal: string                  // 信号标签
  alertLevel: string              // 预警等级
  declineType: string             // 下跌性质
  poolStocks: Array<{ symbol: string; name: string; v6Composite?: number }>
  analysisReport?: string
  modelUsed: string
  createdAt: string
}
```

### 5.1 派生指标

| 派生指标 | 说明 |
| --- | --- |
| `total` | 五因子小计之和 |
| `resonance` | 基于总分与 F1/F2 的共振强度（0-10） |
| `signal` | 由 `getSignalGrade(resonance)` 得到：强/中强/中/弱/无信号 |
| `alertLevel` | 由 `getAlertLevel(f1, f2)` 得到：绿/黄/橙/红 |
| `declineType` | 由 `determineDeclineNature(...)` 得到：杀估值/杀业绩/杀逻辑 |

### 5.2 综合得分分档

`SCORE_BUCKETS` 将总分划分为四档：

| 分数区间 | 档位 | 建议仓位 |
| --- | --- | --- |
| ≥75 | 聚焦主升区 | 25%~35% |
| ≥55 | 埋伏建仓区 | 分批建仓，上限 30% |
| ≥35 | 回避区 | 不建仓，已持仓<10% |
| <35 | 冷落观察池 | 0%~5% |

## 6. 调用方式

需求中提到的 `calculateRotationScore`、`getRotationScores`、`getRotationAdvice` 与实际 API 对照如下：

| 需求函数 | 实际实现 | 说明 |
| --- | --- | --- |
| `calculateRotationScore` | `saveRotationScore(input)` | 计算并持久化单板块评分 |
| `getRotationScores` | `getRotationScores(sectorCode?)` | 查询评分记录 |
| `getRotationAdvice` | `getSignalGrade` / `getScoreBucket` / `getAlertLevel` | 获取信号、档位、预警建议 |

### 6.1 计算并保存单板块评分

```ts
import { saveRotationScore } from '@/services/analysis/rotationScoreService'

const result = await saveRotationScore({
  sectorCode: 'SW801080',
  sectorName: '电子',
  scoreDate: '2026-06-25',
  subScores: {
    F1A: 15, F1B: 8, F1C: 7, F1D: 5, F1E: 5,
    F2A: 10, F2B: 10, F2C: 5, F2D: 5,
    F3A: 8, F3B: 4, F3C: 3,
    F4A: 5, F4B: 5,
    F5A: 3, F5B: 2,
  },
  poolStocks: [{ symbol: '000001.SZ', name: '平安银行' }],
  analysisReport: '电子板块景气上行，资金净流入...',
})

if (result.success) {
  console.log(result.data.total, result.data.resonance, result.data.signal)
}
```

### 6.2 批量生成默认评分

```ts
import { saveDefaultRotationScores } from '@/services/analysis/rotationScoreService'

const result = await saveDefaultRotationScores('2026-06-25')
```

### 6.3 查询评分

```ts
import { getRotationScores } from '@/services/analysis/rotationScoreService'

// 全部
const all = await getRotationScores()

// 指定板块
const sector = await getRotationScores('SW801080')
```

### 6.4 获取建议

```ts
import {
  getSignalGrade,
  getScoreBucket,
  getAlertLevel,
} from '@/services/analysis/rotationScoreService'

const signal = getSignalGrade(resonance)   // { label, signalType, position, action }
const bucket = getScoreBucket(total)       // { label, pos, desc }
const alert = getAlertLevel(f1, f2)        // { name, color, condition, action }
```

### 6.5 导出 CSV

```ts
import { exportRotationCsv } from '@/services/analysis/rotationScoreService'

const csv = exportRotationCsv(dashboardData)
```

## 7. 当前状态

- **模型实现**：五因子十六指标、信号分级、预警等级、下跌性质判定、CSV 导出均已实现。
- **单元测试**：`tests/rotationScoreService.test.ts` 已覆盖核心计算与持久化路径，包括：
  - 子指标合成五因子
  - 量能因子非负截断
  - 共振强度计算
  - 信号分级、得分分档、预警等级
  - 下跌性质判定
  - 评分保存与校验
  - 批量默认评分生成
- **上层展示**：`SectorAnalysisPage` 展示待完善，目前模型输出已可消费，但 UI 页面尚未完整对接。
