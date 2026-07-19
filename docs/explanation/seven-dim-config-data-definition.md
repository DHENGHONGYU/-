---
title: DEPRECATED - seven-dim-config-data-definition.md
type: explanation
domain: data
phase: planning
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "⚠️ 此文件已废弃�?026-07-14�?> 数据定义已整合至..."
tags: [data, data-definition, definition]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-DATA-068
referenced_by: [V9-DOC-PROJ-174, V9-DOC-META-000, V9-DOC-PROJ-176, V9-DOC-PROJ-182, V9-DOC-PROJ-149]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# DEPRECATED - seven-dim-config-data-definition.md

> ⚠️ **此文件已废弃**�?026-07-14�?> 
> 数据定义已整合至 `docs/reference/data-dictionary-index.md`，请通过主索引访问最新定义�?
---

> **Version**: v1.0.0
> **Last Updated**: 2026-07-01
> **Maintainer**: 架构资产治理�?
# 七维采集配置模块 �?数据字典

> 生成日期�?026-07-01
> 模块范围：`src/config/collectConfig.ts` · `src/store/sevenDimConfigStore.ts`
> 规范：所有数据结构必须先定义 TypeScript 接口；组件内禁止硬编码频率、数据源、维度配置、限流参数，必须从此字典对应�?`collectConfig.ts` 常量引用�?> 来源参考：V6 Pro `cockpit-app/src/data/collectConfig.ts`（`createPresetConfig`），适配 V9 架构�?
---

## 一、TypeScript 类型与接口定�?
### 1.1 UpdateFrequency �?采集频率枚举

**来源**: `src/config/collectConfig.ts:19-30`
**类型**: `type` 联合字面�?**用�?*: 描述维度采集的更新频率，配合 `FREQUENCY_MINUTES` 换算为分钟数用于调度

| 枚举�?| 中文标签（`FREQUENCY_LABELS`�?| 分钟数（`FREQUENCY_MINUTES`�?| 描述 |
|--------|------------------------------|------------------------------|------|
| `'realtime'` | 实时 | 5 | 准实时采集（5 分钟一次） |
| `'1h'` | 每小�?| 60 | 每小时采�?|
| `'3h'` | �?3 小时 | 180 | �?3 小时采集 |
| `'daily'` | 每日 | 1440 | 每日采集 |
| `'3d'` | �?3 �?| 4320 | �?3 天采�?|
| `'weekly'` | 每周 | 10080 | 每周采集 |
| `'biweekly'` | 每两�?| 20160 | 每两周采�?|
| `'monthly'` | 每月 | 43200 | 每月采集 |
| `'quarterly'` | 每季�?| 129600 | 每季度采�?|
| `'manual'` | 手动 | 0 | 仅手动触发，不参与自动调�?|

**约束**: �?10 个值；`manual` �?`FREQUENCY_MINUTES` �?0，调度器需跳过；其他频率的最小调度周期为 5 分钟�?
### 1.2 DataSourceType �?数据源类型枚�?
**来源**: `src/config/collectConfig.ts:61`
**类型**: `type` 联合字面�?**用�?*: 标识采集器使用的外部数据源，按优先级列表依次回退尝试

| 枚举�?| 中文标签（`DATA_SOURCE_LABELS`�?| 描述 |
|--------|------------------------------|------|
| `'akshare'` | AKShare | AKShare 开源金融数据接�?|
| `'ifind'` | iFinD | 同花�?iFinD 终端数据 |
| `'yahoo'` | Yahoo | Yahoo Finance 海外行情 |
| `'tianyancha'` | 天眼�?| 天眼查企业工商数�?|
| `'scholar'` | 学术 | 学术文献/专利数据�?|
| `'cache'` | 缓存 | 本地缓存命中（不发起外部请求�?|

**约束**: �?6 个值；`DimensionConfig.sources` 为数组，按顺序回退；`cache` 仅作回退兜底，不应作为首选源�?
### 1.3 StorageType �?存储策略枚举

**来源**: `src/config/collectConfig.ts:76`
**类型**: `type` 联合字面�?**用�?*: 描述维度数据的持久化策略，与 `DataDimensionMeta.storageStrategy` 对齐

| 枚举�?| 中文标签（`STORAGE_TYPE_LABELS`�?| 描述 |
|--------|------------------------------|------|
| `'full'` | 全量存储 | 保留原始数据全量字段，支持回溯与重算 |
| `'lightweight'` | 轻量索引 | 仅保留索�?摘要字段，节省存储空�?|

**约束**: �?2 个值；`'full'` 适用�?K �?筹码等需要复算的数据，`'lightweight'` 适用于新�?研报等以查询为主的数据�?
### 1.4 DimensionImportance �?重要性等级枚�?
**来源**: `src/config/collectConfig.ts:87`
**类型**: `type` 联合字面�?**用�?*: 维度重要性分级，用于 UI 标识与限额分配；配合 `IMPORTANCE_BADGE_VARIANT` 映射 Badge 样式

| 枚举�?| 中文标签（`IMPORTANCE_LABELS`�?| Badge 变体（`IMPORTANCE_BADGE_VARIANT`�?| 描述 |
|--------|------------------------------|----------------------------------------|------|
| `'critical'` | 核心 | `destructive` | 核心维度，缺失将影响主流�?|
| `'high'` | �?| `default` | 高重要性，影响评分质量 |
| `'medium'` | �?| `secondary` | 中等重要�?|
| `'low'` | �?| `outline` | 低重要性，可选采�?|

**约束**: �?4 个值；用于 UI 排序与告警优先级�?
### 1.5 DimensionConfig �?单维度配置接�?
**来源**: `src/config/collectConfig.ts:100-121`
**用�?*: 描述 8 个采集维度中单个维度的完整配置，�?`DEFAULT_DIMENSIONS` 提供默认�?
| 字段 | 类型 | 必填 | 枚举/范围 | 描述 |
|------|------|------|-----------|------|
| `code` | `string` | �?| `'01'` ~ `'08'` | 维度代码�? 位字符串 |
| `name` | `string` | �?| - | 维度中文名称 |
| `enabled` | `boolean` | �?| - | 是否启用采集 |
| `frequency` | `UpdateFrequency` | �?| �?§1.1 | 采集频率 |
| `batchSize` | `number` | �?| �?1 | 单批采集标的�?|
| `sources` | `DataSourceType[]` | �?| �?§1.2 | 数据源优先级列表，按序尝�?|
| `cacheTtl` | `number` | �?| �?0 | 缓存 TTL（分钟） |
| `storageType` | `StorageType` | �?| �?§1.3 | 存储策略 |
| `fields` | `string[]` | �?| - | 采集字段列表 |
| `importance` | `DimensionImportance` | �?| �?§1.4 | 重要性等�?|

### 1.6 StrategyTemplateId �?策略模板 ID 枚举

**来源**: `src/config/collectConfig.ts:127`
**类型**: `type` 联合字面�?**用�?*: 标识预设的策略模板，Store 通过 `applyTemplate(id)` 一键切换维度组�?
| 枚举�?| 模板名称 | 描述 |
|--------|---------|------|
| `'value'` | 价值投�?| 低频深度采集，聚焦基本面与筹�?|
| `'growth'` | 成长投资 | 中频采集，关注行业趋势与新闻 |
| `'defense'` | 防御配置 | 低频广覆盖，侧重关联指数与长期数�?|
| `'cycle'` | 周期轮动 | 中频采集，跟踪行业排名与资金流向 |
| `'full'` | 全维�?| 高频全量采集，适用于深度研�?|

**约束**: �?5 个值；Store 初始默认�?`'value'`�?
### 1.7 StrategyTemplate �?策略模板接口

**来源**: `src/config/collectConfig.ts:129-141`
**用�?*: 策略模板定义，由 `STRATEGY_TEMPLATES` 常量提供 5 个预设模�?
| 字段 | 类型 | 必填 | 枚举/范围 | 描述 |
|------|------|------|-----------|------|
| `id` | `StrategyTemplateId` | �?| �?§1.6 | 模板唯一标识 |
| `name` | `string` | �?| - | 模板中文名称 |
| `description` | `string` | �?| - | 模板描述 |
| `dimensions` | `string[]` | �?| 元素�?`'01'` ~ `'08'` | 启用的维�?code 列表 |
| `updateInterval` | `UpdateFrequency` | �?| �?§1.1 | 更新频率 |
| `historyDays` | `number` | �?| �?1 | 历史数据天数 |
| `sources` | `DataSourceType[]` | �?| �?§1.2 | 数据源列�?|

---

## 二、常量定�?
### 2.1 DEFAULT_DIMENSIONS �?8 个维度默认配�?
**来源**: `src/config/collectConfig.ts:195-292`
**类型**: `DimensionConfig[]`（长�?8�?**用�?*: 定义 8 个采集维度的默认配置，作为模板生成与重置的基�?
| code | name | enabled | frequency | batchSize | sources | cacheTtl(分钟) | storageType | importance |
|------|------|---------|-----------|-----------|---------|--------------|-------------|------------|
| `'01'` | 基本信息 | `true` | `monthly` | 50 | `['akshare','ifind']` | 43200 | `full` | `low` |
| `'02'` | K线数�?| `true` | `daily` | 100 | `['akshare']` | 1440 | `full` | `medium` |
| `'03'` | 筹码分布 | `true` | `3d` | 50 | `['akshare','ifind']` | 4320 | `full` | `high` |
| `'04'` | 重大事项 | `true` | `daily` | 30 | `['akshare','ifind']` | 1440 | `lightweight` | `high` |
| `'05'` | 热点新闻 | `true` | `daily` | 50 | `['akshare','yahoo']` | 720 | `lightweight` | `medium` |
| `'06'` | 行业竞品 | `true` | `weekly` | 20 | `['akshare','ifind']` | 10080 | `lightweight` | `medium` |
| `'07'` | 关联指数 | `true` | `weekly` | 30 | `['akshare','ifind','yahoo']` | 10080 | `lightweight` | `low` |
| `'08'` | 研报中心 | `true` | `daily` | 20 | `['ifind']` | 1440 | `lightweight` | `critical` |

**fields 字段清单**:
- `01`: `name, industry, marketCap, pe, pb, roe`
- `02`: `open, close, high, low, volume, amount, ma5, ma20, ma60`
- `03`: `chipDistribution, holderCount, costDistribution`
- `04`: `announcements, notices, reports`
- `05`: `title, summary, source, url, publishedAt`
- `06`: `industryRank, competitors, marketShare`
- `07`: `indexCode, etfCode, correlation, fundFlow`
- `08`: `reportTitle, rating, targetPrice, analyst, summary`

**约束**: 维度 code �?`DataDimensionType`（`src/data/types.ts:694-703`）的 `01_basic`~`08_research` 8 个维度完全对齐�?
### 2.2 STRATEGY_TEMPLATES �?5 个策略模�?
**来源**: `src/config/collectConfig.ts:143-189`
**类型**: `StrategyTemplate[]`（长�?5�?**用�?*: 预设 5 个策略模板，覆盖典型投研场景

| id | name | dimensions | updateInterval | historyDays | sources |
|----|------|-----------|----------------|-------------|---------|
| `value` | 价值投�?| `['01','02','03','04']` | `daily` | 252 | `['akshare','ifind']` |
| `growth` | 成长投资 | `['01','02','03','05','06']` | `daily` | 126 | `['akshare','yahoo']` |
| `defense` | 防御配置 | `['01','02','03','07']` | `weekly` | 504 | `['akshare','ifind']` |
| `cycle` | 周期轮动 | `['01','02','05','06','07']` | `daily` | 252 | `['akshare','yahoo']` |
| `full` | 全维�?| `['01','02','03','04','05','06','07','08']` | `daily` | 756 | `['akshare','ifind','yahoo']` |

**约束**: `full` 模板覆盖全部 8 个维度；其他模板为子集；`STRATEGY_TEMPLATES[0]` �?`value` �?Store 默认模板�?
### 2.3 GLOBAL_LIMITS �?全局限流参数

**来源**: `src/config/collectConfig.ts:320-333`
**类型**: `as const` 只读对象
**用�?*: 全局采集限流与缓存参数，所有维度共�?
| 字段 | 类型 | �?| 描述 |
|------|------|----|------|
| `maxSymbols` | `number` | 500 | 最大标的数 |
| `defaultBatchSize` | `number` | 50 | 默认批量大小 |
| `rateLimitPerMinute` | `number` | 10 | 每分钟限�?|
| `rateLimitPerHour` | `number` | 200 | 每小时限�?|
| `rateLimitPerDay` | `number` | 2000 | 每天限流 |
| `l1CacheTtl` | `number` | 300 | L1 缓存 TTL（秒�?|

**约束**: `setSymbolCount` 会将传入�?clamp �?`[1, maxSymbols]`；`l1CacheTtl` 单位为秒，与维度�?`cacheTtl`（分钟）不同�?
### 2.4 DIMENSION_COLORS �?维度颜色映射

**来源**: `src/config/collectConfig.ts:298-307`
**类型**: `Record<string, string>`（键为维�?code，值为 Tailwind 背景类）
**用�?*: UI 维度色彩标识，用�?Badge/Tag/图表图例

| code | Tailwind 背景�?| 对应维度 |
|------|----------------|---------|
| `'01'` | `bg-blue-500` | 基本信息 |
| `'02'` | `bg-green-500` | K线数�?|
| `'03'` | `bg-purple-500` | 筹码分布 |
| `'04'` | `bg-orange-500` | 重大事项 |
| `'05'` | `bg-cyan-500` | 热点新闻 |
| `'06'` | `bg-pink-500` | 行业竞品 |
| `'07'` | `bg-indigo-500` | 关联指数 |
| `'08'` | `bg-red-500` | 研报中心 |

**约束**: �?8 个键值对；键�?string 类型（非字面量联合），使用时需做存在性判断�?
### 2.5 辅助函数

**来源**: `src/config/collectConfig.ts:345-358`

| 函数 | 签名 | 描述 |
|------|------|------|
| `estimateMonthlyCalls` | `(dimension: DimensionConfig, symbolCount: number) => number` | 计算单维度月调用次数；禁用或 `manual` 返回 0；按 `minutesPerMonth(43200) / intervalMinutes * ceil(symbolCount / batchSize)` 计算 |
| `estimateTotalMonthlyCalls` | `(dimensions: DimensionConfig[], symbolCount: number) => number` | 汇总所有启用维度的月调用总量，被 Store `monthlyCallEstimate` 派生方法调用 |

---

## 三、Store 接口定义

### 3.1 SevenDimConfigState �?七维采集配置 Store 状�?
**来源**: `src/store/sevenDimConfigStore.ts:35-87`
**实现**: `useSevenDimConfigStore`（Zustand `create`�?**初始状�?*: `activeTemplate='value'`、`symbolCount=40`、`historyDays=252`、`isDirty=false`、其余为 false/0/null

#### 3.1.1 状态字�?
| 字段 | 类型 | 初始�?| 描述 |
|------|------|--------|------|
| `activeTemplate` | `StrategyTemplateId` | `'value'` | 当前选中的策略模�?|
| `dimensions` | `DimensionConfig[]` | �?`value` 模板生成 | 8 个维度配�?|
| `symbolCount` | `number` | 40 | 目标标的数（clamp �?`[1, 500]`�?|
| `historyDays` | `number` | 252 | 历史数据天数（clamp �?`[1, 1000]`�?|
| `isDirty` | `boolean` | `false` | 是否有未保存的修�?|
| `isSaving` | `boolean` | `false` | 是否正在保存 |
| `isCollecting` | `boolean` | `false` | 是否正在执行采集 |
| `collectProgress` | `number` | 0 | 采集进度�?-100�?|
| `error` | `string \| null` | `null` | 错误信息 |

#### 3.1.2 派生计算方法

| 方法 | 签名 | 描述 |
|------|------|------|
| `enabledCount` | `() => number` | 已启用的维度数（`dimensions.filter(d => d.enabled).length`�?|
| `monthlyCallEstimate` | `() => number` | 月调用总量预估（调�?`estimateTotalMonthlyCalls`�?|
| `isClickable` | `() => boolean` | 是否可交互（`!isSaving && !isCollecting`），页面守卫 |
| `tooltipText` | `() => string` | 不可交互时的提示文本；保存中返回「配置保存中，请稍�?..」，采集中返回「采集进行中，请稍�?..」，否则空串 |

#### 3.1.3 Actions

| 方法 | 签名 | 副作�?| 描述 |
|------|------|--------|------|
| `applyTemplate` | `(templateId: StrategyTemplateId) => void` | `set isDirty=true` | 应用策略模板；重�?`dimensions`/`historyDays`；未找到模板时仅 warn 不抛�?|
| `toggleDimension` | `(code: string) => void` | `set isDirty=true` | 切换维度启用状�?|
| `setDimensionFrequency` | `(code: string, frequency: UpdateFrequency) => void` | `set isDirty=true` | 设置维度频率 |
| `setDimensionSources` | `(code: string, sources: DataSourceType[]) => void` | `set isDirty=true` | 设置维度数据�?|
| `setSymbolCount` | `(count: number) => void` | `set isDirty=true` | 设置标的数（clamp �?`[1, GLOBAL_LIMITS.maxSymbols]`�?|
| `setHistoryDays` | `(days: number) => void` | `set isDirty=true` | 设置历史天数（clamp �?`[1, 1000]`�?|
| `reset` | `() => void` | 重置全部状�?| 重置为默�?`value` 模板配置 |
| `saveConfig` | `() => Promise<void>` | `set isSaving/isDirty` | 保存配置（当前为 stub，预�?DataBridge 持久化）；重复调用会�?`isSaving` 守卫拦截 |
| `runCollection` | `() => Promise<void>` | `set isCollecting/collectProgress` | 执行采集（当前为 stub，模拟进�?0�?00）；重复调用会被 `isCollecting` 守卫拦截 |
| `clearError` | `() => void` | `set error=null` | 清除错误信息 |

**约束**:
- `saveConfig`/`runCollection` 通过 `isSaving`/`isCollecting` 实现幂等守卫，重入直�?return�?- 所有写操作均设�?`isDirty=true`，`reset`/`saveConfig` 成功后清零�?- `applyTemplate` 找不到模板时调用 `logger.warn` 并静默返回，不抛异常�?- `setSymbolCount`/`setHistoryDays` 会做边界 clamp�?
---

## 四、模块关�?
```
┌──────────────────────────────────────────────────────────────────�?�? 七维采集配置模块数据�?                                           �?�?                                                                 �?�? STRATEGY_TEMPLATES ──applyTemplate──�?dimensions (覆盖enabled/   �?�? DEFAULT_DIMENSIONS                    frequency)                 �?�?        �?                                  �?                   �?�?        �?                                  �?                   �?�? ┌─────────────────────�?        ┌──────────────────────�?       �?�? �?collectConfig.ts    │←────────�?sevenDimConfigStore  �?       �?�? �?- 枚举/接口/常量     �? import �?- Zustand Store      �?       �?�? �?- estimate*() 工具  �?        �?- 状�?派生/Actions   �?       �?�? └─────────────────────�?        └──────────┬───────────�?       �?�?                                           �?                    �?�?                                           �?                    �?�?                                 ┌──────────────────────�?       �?�?                                 �?UI 页面/组件          �?       �?�?                                 �?- 模板选择�?         �?       �?�?                                 �?- 维度开�?频率/�?   �?       �?�?                                 �?- 限额预估展示        �?       �?�?                                 �?- isClickable 守卫    �?       �?�?                                 └──────────────────────�?       �?└──────────────────────────────────────────────────────────────────�?```

**与既有模块的关系**:
- 维度 code `01`~`08` �?`src/data/types.ts:694` �?`DataDimensionType`（`01_basic`~`08_research`）对齐；8 个维度均已正式纳�?DataDimensionType 类型�?- `StorageType`（`'full' | 'lightweight'`）与 `DataDimensionMeta.storageStrategy`（`src/data/types.ts:708`）语义一致�?- `GLOBAL_LIMITS` 为全局限流基线，与 Widget 数据采集三层架构（`../reference/data-definition.md`）的 `COLLECTOR_DEFAULT_CONFIG` 互补：前者管宏观配额，后者管单任务执行参数�?
---

## 变更日志

| 日期 | 版本 | 变更内容 | 变更�?|
|------|------|----------|--------|
| 2026-07-01 | v1.0.0 | 初始创建：覆�?`collectConfig.ts` 全部类型定义�? 个枚�?+ 2 个接�?+ 1 个模�?ID 类型）与常量（`DEFAULT_DIMENSIONS`/`STRATEGY_TEMPLATES`/`GLOBAL_LIMITS`/`DIMENSION_COLORS` + 2 个辅助函数），以�?`sevenDimConfigStore.ts` �?`SevenDimConfigState` 接口�? 状态字�?+ 4 派生方法 + 10 Actions�?| 架构资产治理�?|
