---
title: CollectionPlanPanel V6 设计校对分析报告
type: reports
domain: qa
phase: planning
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "校对日期: 2026-07-09 校对对象: `src/components/organisms/input/CollectionPlanPanel.tsx` V6 设计基准:..."
tags: [qa, collection, audit]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# CollectionPlanPanel V6 设计校对分析报告

> **校对日期**: 2026-07-09
> **校对对象**: `src/components/organisms/input/CollectionPlanPanel.tsx`
> **V6 设计基准**: `../reference/data-collection-route-ui-audit.md` 第3节
> **校对方法**: 逐项对比 V6 设计要求与 V9 当前实现

---

## 一、V6 采集方案整合面板设计要求（基准）

根据 `../reference/data-collection-route-ui-audit.md` 第3.1节，V6 采集方案整合面板包含以下功能模块：

### 1.1 四层数据源架构图
- **L1 腾讯财经**：实时行情主源，延迟 ~50ms
- **L2 AKShare**：A股数据备用源，延迟 ~200ms
- **L3 Kimi Work**：AI增强数据源，延迟 ~500ms
- **L4 MockProvider**：离线模拟数据，延迟 ~10ms
- **视觉要求**：每层带颜色标识（L1绿/L2蓝/L3橙/L4灰）

### 1.2 维度接口映射表
- **表头**：维度 | 接口 | 方法 | 缓存
- **数据行**：8个维度（01-08）对应的API接口路径
- **视觉要求**：禁用维度半透明显示（opacity-50）
- **交互要求**：点击维度可跳转到维度配置

### 1.3 8维度频率配置表
- **展示内容**：每个启用维度的频率、批次大小、数据源优先级、存储策略、重要性等级、字段列表
- **视觉要求**：
  - 维度代码带颜色标识（使用 `DIMENSION_COLORS`）
  - 重要性等级使用 Badge 组件（`IMPORTANCE_BADGE_VARIANT`）
  - 存储策略使用标签（全量存储/轻量索引）
  - 数据源优先级使用箭头连接（akshare → ifind → mock）
  - 字段列表使用标签组展示

### 1.4 额度预估面板（V6 设计，V9 缺失）
- **月调用3卡片**：
  - 月调用总量（带颜色标识：绿色<1000/黄色<5000/红色>=5000）
  - 日上限（GLOBAL_LIMITS.rateLimitPerDay）
  - AKShare额度（固定值或从配置读取）
- **额度进度条**：使用率 = 月调用总量 / (日上限 × 30)，带颜色标识
- **Kimi套餐选择**：Andante/Allegretto/Presto 三档
- **8维度频率表**：交叉表（维度 × 频率 × 数据源）
- **限流配置展示**：分钟/小时/日限流参数

### 1.5 接口测试弹窗（V6 设计，V9 缺失）
- **5接口一键测试**：AKShare/iFinD/Yahoo/天眼查/学术
- **多源对比展示**：每个接口的测试状态、延迟、消息
- **降级测试结果**：主源失败时自动测试备用源

---

## 二、V9 CollectionPlanPanel 当前实现状态

### 2.1 已实现功能

| 功能模块 | 实现状态 | 代码位置 | 说明 |
|---------|---------|---------|------|
| 四层数据源架构图 | ? 已实现 | L21-L54 | 包含 L1-L4 四层，带颜色标识 |
| 维度接口映射表 | ? 已实现 | L56-L66, L128-L167 | 包含8个维度的API映射，禁用维度半透明 |
| 8维度频率配置表 | ?? 部分实现 | L72-L88, L171-L201 | 仅展示频率、批次、数据源，缺少存储策略/重要性/字段 |
| 限流配置展示 | ? 已实现 | L205-L222 | 展示分钟/小时/日限流参数 |

### 2.2 缺失功能

| 功能模块 | V6 设计要求 | V9 当前状态 | 差距 |
|---------|-----------|-----------|------|
| 维度频率配置表增强 | 存储策略/重要性/字段列表 | ? 未实现 | 100% 缺失 |
| 额度预估面板 | 月调用3卡片+进度条+Kimi套餐 | ? 未实现 | 100% 缺失 |
| 接口测试弹窗 | 5接口一键测试+多源对比 | ? 未实现 | 100% 缺失 |
| 维度颜色标识 | 维度代码带 DIMENSION_COLORS | ? 未实现 | 100% 缺失 |

---

## 三、V6 与 V9 功能完整性对比

### 3.1 采集方案整合面板完整度评分

| 功能模块 | V6 完整度 | V9 实现度 | 差距 | 优先级 |
|---------|---------|---------|------|-------|
| 四层数据源架构图 | 100% | 100% | 0% | - |
| 维度接口映射表 | 100% | 90% | 10% | P2 |
| 8维度频率配置表 | 100% | 40% | 60% | P1 |
| 额度预估面板 | 100% | 0% | 100% | P1 |
| 接口测试弹窗 | 100% | 0% | 100% | P0 |
| 维度颜色标识 | 100% | 0% | 100% | P2 |
| **加权平均** | **100%** | **~38%** | **~62%** | - |

### 3.2 缺失功能详细清单

#### P0 缺失（核心功能）
1. **接口测试弹窗**
   - V6 设计：5接口一键测试（AKShare/iFinD/Yahoo/天眼查/学术）
   - V9 状态：完全缺失
   - 影响：无法验证数据源连接状态
   - 建议：新建 `ApiTestDialog` 组件（已创建框架）

#### P1 缺失（重要功能）
2. **额度预估面板**
   - V6 设计：月调用3卡片+额度进度条+Kimi套餐选择
   - V9 状态：完全缺失
   - 影响：用户无法直观了解额度使用情况
   - 建议：新建 `QuotaEstimatePanel` 组件

3. **8维度频率配置表增强**
   - V6 设计：展示存储策略/重要性等级/字段列表
   - V9 状态：仅展示频率/批次/数据源
   - 影响：用户无法查看维度的完整配置信息
   - 建议：增强现有 `dimensionEstimates` 计算逻辑

#### P2 缺失（优化功能）
4. **维度颜色标识**
   - V6 设计：维度代码使用 `DIMENSION_COLORS` 着色
   - V9 状态：使用普通 Badge
   - 影响：视觉辨识度降低
   - 建议：在维度代码 Badge 上应用 `DIMENSION_COLORS`

5. **维度接口映射表交互**
   - V6 设计：点击维度可跳转到维度配置
   - V9 状态：纯展示，无交互
   - 影响：用户需要手动滚动查找维度
   - 建议：添加点击跳转功能

---

## 四、补全方案

### 4.1 P0：接口测试弹窗（ApiTestDialog）

**文件路径**：`src/components/organisms/input/ApiTestDialog.tsx`（已创建框架）

**待实现功能**：
- 5接口测试（AKShare/iFinD/Yahoo/天眼查/学术）
- 测试状态展示（待测试/测试中/正常/异常）
- 延迟时间显示
- 单个接口测试和全部测试功能
- 真实 API 调用（当前使用 setTimeout 模拟）

**依赖**：
- 需要后端提供测试接口（`/api/test/akshare` 等）
- 或使用 `fetcherService` 的测试方法

### 4.2 P1：额度预估面板（QuotaEstimatePanel）

**文件路径**：`src/components/organisms/input/QuotaEstimatePanel.tsx`（待创建）

**功能设计**：
```typescript
interface QuotaEstimatePanelProps {
  symbolCount: number
  dimensions: DimensionConfig[]
}

// 展示内容：
// 1. 月调用3卡片
//    - 月调用总量（estimateTotalMonthlyCalls）
//    - 日上限（GLOBAL_LIMITS.rateLimitPerDay）
//    - AKShare额度（从配置或 API 获取）
// 2. 额度进度条
//    - 使用率 = 月调用总量 / (日上限 × 30)
//    - 颜色标识：绿色<30%/黄色<70%/红色>=70%
// 3. Kimi套餐选择
//    - Andante/Allegretto/Presto 三档
//    - 每档对应不同的月调用上限
// 4. 8维度频率表
//    - 交叉表：维度 × 频率 × 数据源 × 月调用次数
```

### 4.3 P1：8维度频率配置表增强

**修改文件**：`src/components/organisms/input/CollectionPlanPanel.tsx`

**增强内容**：
```typescript
// 在 dimensionEstimates 计算中增加：
const dimensionEstimates = useMemo(() => {
  return dimensions
    .filter((d) => d.enabled)
    .map((dim) => {
      const frequencyLabel = FREQUENCY_LABELS[dim.frequency]
      const sources = dim.sources.map((s) => DATA_SOURCE_LABELS[s]).join(' → ')
      const storageLabel = STORAGE_TYPE_LABELS[dim.storageType]
      const importanceLabel = IMPORTANCE_LABELS[dim.importance]
      const importanceVariant = IMPORTANCE_BADGE_VARIANT[dim.importance]
      const fields = dim.fields.join(', ')
      
      return {
        code: dim.code,
        name: dim.name,
        frequency: frequencyLabel,
        sources,
        batchSize: dim.batchSize,
        cacheTtl: dim.cacheTtl,
        storageType: storageLabel,
        importance: importanceLabel,
        importanceVariant,
        fields,
      }
    })
}, [dimensions])
```

**UI 增强**：
- 维度代码使用 `DIMENSION_COLORS` 着色
- 重要性等级使用 Badge 组件（`importanceVariant`）
- 存储策略使用标签展示
- 字段列表使用标签组展示（最多显示5个，超出显示"+N"）

### 4.4 P2：维度颜色标识

**修改文件**：`src/components/organisms/input/CollectionPlanPanel.tsx`

**实现方式**：
```typescript
// 在维度频率配置表中，维度代码 Badge 应用 DIMENSION_COLORS
import { DIMENSION_COLORS } from '@/config/collectConfig'

<Badge 
  variant="outline" 
  className={DIMENSION_COLORS[est.code]}
>
  {est.code}
</Badge>
```

### 4.5 P2：维度接口映射表交互

**修改文件**：`src/components/organisms/input/CollectionPlanPanel.tsx`

**实现方式**：
```typescript
// 在维度接口映射表中，添加点击跳转功能
const handleDimensionClick = (code: string) => {
  // 滚动到对应的维度配置行
  const element = document.getElementById(`dimension-${code}`)
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
}

<tr 
  key={mapping.code}
  onClick={() => handleDimensionClick(mapping.code)}
  className="cursor-pointer hover:bg-muted/50"
>
  {/* ... */}
</tr>
```

---

## 五、实施优先级与时间估算

| 优先级 | 功能模块 | 工作量 | 依赖 | 建议时间 |
|-------|---------|-------|------|---------|
| P0 | 接口测试弹窗 | 中 | 后端测试接口 | 1-2天 |
| P1 | 额度预估面板 | 中 | 无 | 1天 |
| P1 | 8维度频率配置表增强 | 低 | 无 | 0.5天 |
| P2 | 维度颜色标识 | 低 | 无 | 0.5天 |
| P2 | 维度接口映射表交互 | 低 | 无 | 0.5天 |
| **总计** | - | - | - | **3.5-4.5天** |

---

## 六、校对结论

### 6.1 当前实现状态
- **整体完整度**：~38%（距离 V6 设计）
- **已实现**：四层数据源架构图、维度接口映射表、基础频率配置表、限流配置
- **缺失**：接口测试弹窗、额度预估面板、维度颜色标识、配置表增强

### 6.2 核心差距
1. **接口测试功能完全缺失**（P0）：无法验证数据源连接状态
2. **额度预估面板完全缺失**（P1）：用户无法直观了解额度使用情况
3. **维度配置信息展示不完整**（P1）：缺少存储策略/重要性/字段等关键信息

### 6.3 建议实施路径
1. **第一阶段（P0，1-2天）**：实现接口测试弹窗（ApiTestDialog）
2. **第二阶段（P1，1.5天）**：实现额度预估面板 + 增强频率配置表
3. **第三阶段（P2，1天）**：添加维度颜色标识 + 接口映射表交互

### 6.4 风险提示
- **接口测试弹窗**依赖后端测试接口，如后端未提供，需先实现后端接口或使用 `fetcherService` 的测试方法
- **额度预估面板**的 Kimi套餐选择需要明确三档套餐的具体参数（月调用上限、价格等）
- **维度颜色标识**需要确保 `DIMENSION_COLORS` 在暗色模式下可见性良好

---

**报告生成时间**：2026-07-09
**校对人员**：AI Assistant
**审核状态**：待审核
