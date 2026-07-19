---
title: 颜色硬编码治�?- P1 批次技术日�?
type: reference
domain: backend
phase: retrospective
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "颜色硬编码治�?P1 批次技术日志，TOP 5 热点文件重构记录"
tags: [backend, refactor, management]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# 颜色硬编码治�?- P1 批次技术日�?
**日期**: 2026-07-05  
**版本**: v2.0.0  
**批次**: P1 - TOP 5 热点文件重构

---

## 任务概述

完成 TOP 5 热点文件的颜色硬编码重构，将 Tailwind 颜色类替换为颜色令牌系统引用�?
---

## 完成内容

### 1. MockTestPage.tsx (23 �?�?0 �?

**文件路径**: `src/pages/MockTestPage.tsx`

**修改内容**:
- 导入 `COLOR_SHADES`, `CHART_PALETTE`
- 替换所�?`bg-slate-*`, `text-rose-*`, `text-emerald-*`, `text-cyan-*`, `text-amber-*` 等硬编码
- 使用 `COLOR_SHADES.slate[950]`, `COLOR_SHADES.rose[400]` 等令牌引�?- 使用 `CHART_PALETTE.background` 替代背景�?
**验证**: �?tsc --noEmit 通过

---

### 2. ExecutionPlanCard.tsx (19 �?�?0 �?

**文件路径**: `src/apps/trading/components/ExecutionPlanCard.tsx`

**修改内容**:
- 导入 `COLOR_SHADES`, `twText`
- 重构 `PHASE_BADGE_COLORS` 映射表，使用 `${COLOR_SHADES.blue[100]} ${twText('blue', 800)}` 格式
- 重构 `directionClass` 涨跌颜色
- 重构风险检查项颜色（blocker/warning/info�?- 重构错误信息卡片颜色

**验证**: �?tsc --noEmit 通过

---

### 3. PhaseStepper.tsx (13 �?�?0 �?

**文件路径**: `src/apps/trading/components/PhaseStepper.tsx`

**修改内容**:
- 导入 `COLOR_SHADES`, `twBg`, `twText`, `twBorder`
- 重构 `PHASE_COLORS` 映射表，使用 `twBg('blue', 500)` 等辅助函�?- 重构 `getLineStyle()` 连线颜色逻辑
- 重构节点圆圈颜色（reached/current/unreached�?- 重构结果指示器颜色（success/failed/partial�?- 重构断裂线颜�?
**验证**: �?tsc --noEmit 通过

---

### 4. ValuePitPage.tsx (12 �?�?0 �?

**文件路径**: `src/pages/analysis/ValuePitPage.tsx`

**修改内容**:
- 导入 `COLOR_SHADES`, `twText`
- 重构 `STRENGTH_CONFIG` 信号强度颜色
- 重构 `scoreColor` 评分颜色逻辑
- 重构轮动信号检测图标颜色（CheckCircle/XCircle�?- 重构建仓建议卡片背景色和边框�?
**验证**: �?tsc --noEmit 通过

---

### 5. BacktestPage.tsx (11 �?�?0 �?

**文件路径**: `src/pages/analysis/BacktestPage.tsx`

**修改内容**:
- 导入 `COLOR_SHADES`, `twText`, `twBg`, `twBorder`
- 重构 `metrics` 数组中的颜色定义
- 重构错误卡片边框和背景色
- 重构净值曲线背景渐�?- 重构交易方向标签颜色（买�?卖出�?
**验证**: �?tsc --noEmit 通过

---

## 技术决�?
### 1. 令牌选择策略

**决策**: 优先使用 `COLOR_SHADES` 对象，复杂场景使�?`twText/twBg/twBorder` 辅助函数

**理由**:
- `COLOR_SHADES` 提供完整的色阶定义，类型安全
- 辅助函数在动态拼接场景下更灵�?- 保持代码可读性和一致�?
### 2. 颜色语义映射

**决策**: 保持业务语义与颜色的映射关系

**示例**:
- 上涨/成功 �?`green`
- 下跌/失败 �?`red`
- 警告/中等 �?`yellow`/`amber`
- 信息/中�?�?`blue`/`gray`

### 3. 暗色模式支持

**决策**: 使用 `COLOR_SHADES` �?`*Dark` 变体

**示例**:
```typescript
<div className={`${COLOR_SHADES.red[500]} ${COLOR_SHADES.red['200Dark']}`}>
  红文�?+ 暗色模式浅红
</div>
```

---

## 质量指标

| 指标 | 重构�?| 重构�?| 改善 |
|------|--------|--------|------|
| 颜色硬编码数 | 78 �?| 0 �?| -100% |
| 涉及文件�?| 5 �?| 5 �?| - |
| Token 消�?扫描 | ~20,000 | ~5,000 | -75% |
| 类型安全 | �?| �?| 保持 |

---

## 后续计划

### P2 批次（待执行�?
1. **ESLint 规则创建**
   - 创建 `no-hardcoded-tailwind-colors` 自定义规�?   - 配置 `.eslintrc.js` 启用规则
   - 添加自动修复功能

2. **测试文件颜色断言更新**
   - 搜索测试文件中的颜色断言
   - 替换为令牌引用断言
   - 更新测试文档

3. **剩余文件迁移**
   - 迁移 30 �?P2 优先级文�?   - 更新违规清单缓存

---

## 验证命令

```powershell
# 类型检�?npx tsc --noEmit

# 硬编码扫�?npm run audit:hardcode -- --export-inventory

# 查看违规清单
cat docs/reports/hardcoded-colors-inventory.json
```

---

## 相关文件

- `../../../../AGENTS.md` - §3.5 颜色令牌使用规范
- `src/constants/theme.tokens.ts` - 颜色令牌定义
- `docs/reports/hardcoded-colors-inventory.json` - 违规清单缓存
- `../../../../CHANGELOG.md` - v2.0.0 变更记录

---

**状�?*: �?完成  
**下一�?*: P2 批次 - ESLint 规则创建与测试文件更�?