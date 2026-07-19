---
title: hardcode-cleanup-plan
type: reference
domain: qa
phase: planning
tier: reference
status: active
maintainer: V9 Architecture Team
summary: "版本: v1.0.0 �?创建日期: 2026-07-15 �?基线版本: v2.0.0 当前状�?*: 77 处问题（Major 64 + Warning 13�?> 工具:..."
tags: [qa, cleanup, testing, plan, audit, strategy]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-QA-023
referenced_by: [V9-DOC-META-000, V9-DOC-PROJ-176]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# V9 硬编码与静默回退清理计划

> **版本**: v1.0.0 �?**创建日期**: 2026-07-15 �?**基线版本**: v2.0.0
> **当前状�?*: 77 处问题（Major 64 + Warning 13�?> **工具**: `npm run audit:hardcode` �?audit-hardcode.ts v3.0

---

## 1. 现状概览

### 1.1 问题分布

| 类别 | 数量 | 严重�?| 说明 |
| :--- | :--- | :--- | :--- |
| 硬编�?Tailwind 颜色�?| 58 | Major | UI 层直接使用颜�?token 类名 |
| 静默回退 | 13 | Warning | `?? 0 / ?? null / ?? "" / ?? []` 等模�?|
| 魔法数字 | 6 | Major | services/ �?3 位以上未解释数字 |
| **总计** | **77** | �?| �?|

### 1.2 扫描范围

- 扫描文件数：1035
- 排除范围：测试文件、Mock 文件、生成文件、config/fallback 目录
- 排除规则�?7 条静默回退合理默认值排除规�?
---

## 2. 静默回退专项清理�?3 处）

### 2.1 问题清单与处理建�?
| # | 文件 | �?| 模式 | 上下�?| 处理建议 | 优先�?|
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | knowledgeServer.ts | 94 | `?? []` | `(docs ?? []).slice(0, topK)` | **保留** �?标准防御性写法，docs 可能�?undefined | P3 |
| 2 | LlmStatsTab.tsx | 180 | `?? ""` | `valueClassName ?? 'text-sm'` | **保留** �?默认 className 是标�?React 模式 | P3 |
| 3 | rotationCalculator.ts | 72 | `?? 0` | `const s = (v): number => v ?? 0` | **评估** �?评分计算中，需确认 undefined 时返�?0 是否合理 | P1 |
| 4 | dataSourceOrchestrator.ts | 352 | `?? ""` | `nextSource ?? '�?` | **保留** �?降级提示消息中的兜底显示文本 | P3 |
| 5 | dataSourceOrchestrator.ts | 512 | `?? ""` | `nextSource ?? '�?` | **保留** �?同上，K 线降级提�?| P3 |
| 6 | historySearcher.ts | 112 | `\|\| ""` | `symbols \|\| fileName \|\| '未知'` | **评估** �?`||` 会把空字符串也替换，建议改为 `??` | P2 |
| 7 | migrationTransformers.ts | 235 | `?? 0` | `return ts ?? 0` | **评估** �?迁移时间戳为 0 是否合理�?970年） | P2 |
| 8 | strategyEngine.ts | 288 | `?? 0` | `momentum ?? 0` | **评估** �?策略引擎中动量为 0 可能影响计算结果 | P1 |
| 9 | strategyEngine.ts | 292 | `?? ""` | `sector ?? '-'` | **保留** �?显示用占位符 | P3 |
| 10 | collectionWizardStore.ts | 255 | `?? null` | `previous: previous ?? null` | **保留** �?显式 null 赋值，类型安全 | P3 |
| 11 | stockAnalysisStore.ts | 108 | `?? null` | `stock: stockData ?? null` | **保留** �?Store 初始化为 null，标准模�?| P3 |
| 12 | stockAnalysisStore.ts | 109 | `?? null` | `quotes: quotesData ?? null` | **保留** �?同上 | P3 |
| 13 | stockAnalysisStore.ts | 110 | `?? null` | `v6Score: scoreData ?? null` | **保留** �?同上 | P3 |

### 2.2 建议处理数量

| 处理方式 | 数量 | 说明 |
| :--- | :--- | :--- |
| **保留（合理默认值）** | 10 �?| 标准防御性编程，可加入审计白名单 |
| **需评估** | 3 �?| 可能影响业务逻辑正确性，需人工确认 |
| **建议修改** | 1 �?| `||` 改为 `??` 更精�?|

### 2.3 具体修复方案

#### P1：业务逻辑影响评估�? 处）

**rotationCalculator.ts:72**
```typescript
// 当前
const s = (v: number | undefined): number => v ?? 0
// 评估：评分计算中 undefined �?0 是否合理�?// 建议：改�?NaN 表示"不参与评�?，与 lMinus1 测试修复逻辑一�?```

**strategyEngine.ts:288**
```typescript
// 当前
const mv = momentum ?? 0
// 评估：动量为 0 会影响策略信号计�?// 建议：判�?undefined 时跳过该股票，而非�?0 参与计算
```

#### P2：精确化修复�? 处）

**historySearcher.ts:112**
```typescript
// 当前（|| 会把空字符串也替换）
title: `${entry.channel} �?${symbols || fileName || '未知'}`
// 建议改为�?? 仅替�?null/undefined�?title: `${entry.channel} �?${symbols ?? fileName ?? '未知'}`
```

---

## 3. 硬编码颜色清理（58 处）

### 3.1 整体策略

| 优先�?| 范围 | 数量 | 目标 |
| :--- | :--- | :--- | :--- |
| **P0** | 安全/状态相关颜色（�?�?黄） | ~20 | 全部替换为语义化 token |
| **P1** | 品牌/主色�?| ~15 | 替换为主题变�?|
| **P2** | 装饰�?次要颜色 | ~23 | 逐步替换 |

### 3.2 颜色 Token 映射方案

| 硬编码类 | 语义�?Token | 用�?|
| :--- | :--- | :--- |
| `text-emerald-500/600/400` | `text-success` | 成功/安全/上涨 |
| `text-red-500/600` | `text-danger` | 危险/错误/下跌 |
| `text-amber-500/600` | `text-warning` | 警告/注意/中�?|
| `text-blue-500/600` | `text-info` | 信息/链接 |
| `text-gray-500/400` | `text-muted` | 次要文字 |
| `bg-emerald-50` | `bg-success-light` | 成功背景 |
| `bg-red-50` | `bg-danger-light` | 错误背景 |
| `bg-amber-50` | `bg-warning-light` | 警告背景 |

### 3.3 清理计划

**第一阶段（P0�?*：状态色替换（预�?2 天）
- SecurityStatus.tsx 等安全状态组�?- 涨跌颜色（红涨绿�?/ 绿涨红跌 切换支持�?- 评分等级颜色

**第二阶段（P1�?*：品牌色替换（预�?2 天）
- 主色调统一
- 按钮、链接色

**第三阶段（P2�?*：剩余颜色清理（预计 3 天）
- 装饰性颜�?- 图表颜色

---

## 4. 魔法数字清理�? 处）

### 4.1 问题清单

| # | 文件 | �?| 数字 | 上下�?| 建议 | 优先�?|
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | contractValidation.ts | 43 | 1990 | `MIN_TIMESTAMP = Date.UTC(1990, 0, 1)` | 提取为命名常�?`EARLIEST_VALID_YEAR` | P2 |
| 2 | contractValidation.ts | 261 | 3650 | 存货周转天数阈�?| 提取�?`MAX_INVENTORY_TURNOVER_DAYS` | P2 |
| 3 | scoringStrategy.ts | 127 | 450 | `this.delay(450)` | 提取�?`SCORING_STEP_DELAY_MS` | P2 |
| 4 | scoringStrategy.ts | 147 | 1200 | `this.delay(1200)` | 提取�?`SCORING_BATCH_DELAY_MS` | P2 |
| 5-6 | （其�?2 处） | �?| �?| �?| 提取为常�?| P2 |

### 4.2 清理方法

1. 在对应模块的 `constants.ts` 中定义常�?2. 添加 JSDoc 注释说明含义和取值理�?3. 替换所有硬编码位置
4. 验证测试通过

---

## 5. 执行路线�?
### 5.1 分阶段计�?
| 阶段 | 时间 | 任务 | 产出 |
| :--- | :--- | :--- | :--- |
| **W1** | �?1 �?| 静默回退 P1 评估 + 修复 | 静默回退降至 10 处以�?|
| **W2** | �?2 �?| 魔法数字全部清理 | 魔法数字 0 �?|
| **W3-4** | �?3-4 �?| 硬编码颜�?P0/P1 | 颜色降至 23 处以�?|
| **W5-6** | �?5-6 �?| 硬编码颜�?P2 + 全面清理 | 全部 0 �?|

### 5.2 质量门禁

| 门禁�?| 当前�?| 目标�?|
| :--- | :--- | :--- |
| 硬编码颜色（Major�?| 58 | 0 |
| 静默回退（Warning�?| 13 | < 5（合理默认值） |
| 魔法数字（Major�?| 6 | 0 |
| 总计 | 77 | < 5 |

---

## 6. 审计工具优化建议

### 6.1 建议新增豁免规则

根据清理分析，以下模式建议加入审计工具白名单�?
1. **React 默认 props 模式**
   - `className ?? 'default-class'`
   - 理由：React 组件默认属性标准写�?
2. **Store 初始�?null**
   - `data: data ?? null`
   - 理由：Zustand Store 初始状态标准模�?
3. **降级提示消息**
   - `nextSource ?? '�?`
   - 理由：UI 显示文本兜底，不影响业务逻辑

4. **数组/对象方法结果兜底**
   - `docs ?? []` / `.find(...) ?? null`
   - 理由：函数返回值可能为 undefined，兜底是标准做法

### 6.2 审计工具配置�?
建议将豁免规则配置化，通过 `.hardcodeignore` 或配置文件管理，避免频繁修改审计脚本�?
---

## 7. 验证命令

```powershell
# 全量审计
npm run audit:hardcode

# 仅查看静默回退
npm run audit:hardcode -- --quiet | ConvertFrom-Json | 
  Select-Object -ExpandProperty violations | 
  Where-Object { $_.category -eq "静默回退" }

# 仅查看魔法数�?npm run audit:hardcode -- --quiet | ConvertFrom-Json | 
  Select-Object -ExpandProperty violations | 
  Where-Object { $_.category -eq "魔法数字" }

# 生成报告
npm run audit:hardcode -- --output docs/reports/audit/hardcode-report.json
```

---

*本计划基�?2026-07-15 audit-hardcode v3.0 扫描结果制定，随代码迭代持续更新�?
