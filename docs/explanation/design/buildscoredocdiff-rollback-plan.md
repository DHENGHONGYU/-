---
title: buildscoredocdiff-rollback-plan
tier: important
code_version: 2.0.0
---

---
tier: important
code_version: 2.0.0
---

# buildScoreDocDiff 修复 — 生产部署回滚预案

> **版本**: v1.0 | **日期**: 2026-07-04
> **变更类型**: Bug 修复 + 新增功能
> **影响范围**: 评分拍照比对功能模块
> **风险等级**: 🟡 中(修改 1 个文件,3 处变更,涉及核心评分服务)
> **回滚预估时间**: 完整回滚 ≤ 5 分钟 / 部分回滚 ≤ 3 分钟

---

## 一、部署概览

### 1.1 变更文件清单

| 文件路径 | 操作 | 变更行数 | 风险等级 |
|----------|------|----------|----------|
| [src/services/analysis/scoreDocService.ts](../../src/services/analysis/scoreDocService.ts) | 修改 | +75 / -1 | 🟡 中 |

### 1.2 变更内容详情

本次修改包含 3 处变更,均集中在 `src/services/analysis/scoreDocService.ts`:

#### 变更 1:添加 DEFAULT_THRESHOLDS 导入(第 11 行)

```typescript
// 新增行
import { DEFAULT_THRESHOLDS } from '@/services/scoring/v6-engine/config'
```

**目的**: 为变更 3(替换硬编码)提供常量引用。

#### 变更 2:新增 ScoreDocDiff 接口与 buildScoreDocDiff 函数(第 111-184 行)

```typescript
/** 评分文档差异结构(用于历史版本对比面板) */
export interface ScoreDocDiff {
  newerVersion: number
  olderVersion: number
  compositeDelta: number
  l3vDelta: number
  layerChanges: Array<{
    code: string
    oldScore: number
    newScore: number
    delta: number
  }>
  addedLayers: string[]
  removedLayers: string[]
  ratingChanged: boolean
  oldRating: string
  newRating: string
}

export function buildScoreDocDiff(newer: ScoreDocVersion, older: ScoreDocVersion): ScoreDocDiff {
  // ... 完整实现
}
```

**目的**: 修复 `ScoreHistoryPanel.tsx` 与 `src/services/analysis/__tests__/scoreDocService.test.ts` 中对不存在的 `buildScoreDocDiff` 函数的引用错误。

#### 变更 3:替换硬编码(第 305 行,原第 229 行)

```typescript
// 修复前
const coreStocks = all.filter((d) => d.composite >= 4.0).length

// 修复后
const coreStocks = all.filter((d) => d.composite >= DEFAULT_THRESHOLDS.rating.strongBuy).length
```

**目的**: 消除硬编码,遵守 AGENTS.md 第三节「零硬编码」契约,使核心股票阈值与 `DEFAULT_THRESHOLDS.rating.strongBuy` 保持同步。

### 1.3 影响分析

| 影响面 | 说明 |
|--------|------|
| **直接调用方** | `ScoreHistoryPanel.tsx`(UI 组件)、`scoreDocService.test.ts`(单元测试) |
| **间接影响** | 评分历史版本对比面板的用户体验(从无法渲染 → 可正常渲染差异) |
| **数据兼容性** | ✅ 完全兼容(未修改数据结构,仅新增函数) |
| **API 兼容性** | ✅ 完全兼容(新增导出,未删除或修改现有导出) |
| **配置兼容性** | ✅ 完全兼容(引用已存在的 `DEFAULT_THRESHOLDS` 常量) |

---

## 二、部署前验证结果

### 2.1 验证清单

| 验证项 | 命令 | 结果 | 说明 |
|--------|------|------|------|
| 类型检查 | `npx tsc --noEmit` | ✅ | `scoreDocService.ts` 与 `ScoreHistoryPanel.tsx` 均无类型错误 |
| ESLint | `npx eslint src/services/analysis/scoreDocService.ts` | ✅ | 0 errors,19 warnings(均为预存在) |
| 单元测试 | `npx vitest run src/services/analysis/__tests__/scoreDocService.test.ts` | ✅ | 4/4 通过(buildScoreDocDiff) |
| 穿行测试 | `npx vitest run walkthroughScoreDoc` | ✅ | 43/43 通过(2.49s) |
| 架构审计 | `npm run audit:layers` | ✅ | 0 violations,1 warning(预存在的 SectorAnalysisPage 警告) |
| 生产构建 | `npx vite build` | ⚠️ | 失败(预存在的 `trade.constants` 导入问题,与本次修改无关) |

### 2.2 预存在问题的说明

生产构建失败的原因是 `src/services/trading/tradeErrorClassifier.ts` 引用了 `trade.constants.ts` 中不存在的 `PERCENTAGE_BASE`、`MAX_SCORE`、`MIN_SCORE` 常量。此问题与本次 `buildScoreDocDiff` 修复**完全无关**,属于独立的 P0 问题,不在本次回滚范围内。

---

## 三、回滚触发条件

### 3.1 必须回滚的条件(任一满足即触发)

| # | 条件 | 检测方式 | 严重度 |
|---|------|----------|--------|
| 1 | `ScoreHistoryPanel.tsx` 渲染崩溃 | 用户反馈 / 错误监控 | 🔴 高 |
| 2 | `buildScoreDocDiff` 返回错误数据(如 delta 计算错误) | 单元测试失败 / 用户反馈 | 🔴 高 |
| 3 | `getFileLibraryStats` 返回错误的 coreStocks 统计 | 用户反馈 / 数据校验 | 🟡 中 |
| 4 | 类型检查出现新错误 | `npx tsc --noEmit` | 🟡 中 |
| 5 | 穿行测试失败 | `npx vitest run walkthroughScoreDoc` | 🔴 高 |

### 3.2 可选回滚的条件

| # | 条件 | 检测方式 | 严重度 |
|---|------|----------|--------|
| 6 | 性能回退(buildScoreDocDiff 执行时间 > 100ms) | 性能监控 | 🟢 低 |
| 7 | ESLint 新增 warnings | `npm run lint` | 🟢 低 |

---

## 四、回滚步骤

### 4.1 完整回滚(推荐:撤销全部 3 处变更)

**适用场景**: 变更 1+2+3 均需回滚(如 buildScoreDocDiff 逻辑错误)

**预估时间**: ≤ 5 分钟

**操作步骤**:

```powershell
# 步骤 1:进入项目目录
cd C:\Users\huawei\Documents\kimi\Workspaces\智能投研复盘系统V9

# 步骤 2:查看 git 状态,确认修改文件
git status src/services/analysis/scoreDocService.ts

# 步骤 3:查看具体变更
git diff src/services/analysis/scoreDocService.ts

# 步骤 4:回滚到修改前版本(假设修改前已提交)
# 方式 A:如果修改未提交,使用 checkout
git checkout HEAD -- src/services/analysis/scoreDocService.ts

# 方式 B:如果修改已提交,使用 revert
git revert <commit-hash> --no-edit

# 步骤 5:验证回滚结果
npx tsc --noEmit 2>&1 | Select-String "scoreDocService"
# 预期:无输出(因 ScoreHistoryPanel.tsx 会重新报错,这是回滚的预期状态)

# 步骤 6:确认 ScoreHistoryPanel.tsx 重新报错(预期行为)
npx tsc --noEmit 2>&1 | Select-String "ScoreHistoryPanel"
# 预期:显示 buildScoreDocDiff 不存在的错误

# 步骤 7:重启开发服务器(如运行中)
# Ctrl+C 停止 vite dev,然后重新启动
npm run dev
```

### 4.2 部分回滚方案 A:仅回滚变更 3(硬编码替换)

**适用场景**: `DEFAULT_THRESHOLDS.rating.strongBuy` 引用导致问题,但 `buildScoreDocDiff` 功能正常

**预估时间**: ≤ 2 分钟

**操作步骤**:

```typescript
// 编辑 src/services/analysis/scoreDocService.ts 第 305 行
// 将:
const coreStocks = all.filter((d) => d.composite >= DEFAULT_THRESHOLDS.rating.strongBuy).length
// 改回:
const coreStocks = all.filter((d) => d.composite >= 4.0).length
```

**验证**:

```powershell
npx vitest run walkthroughScoreDoc --reporter=default
# 预期:43/43 通过(测试 4.6 会因硬编码而通过,因为 4.0 === DEFAULT_THRESHOLDS.rating.strongBuy)
```

### 4.3 部分回滚方案 B:仅回滚变更 2(buildScoreDocDiff 函数)

**适用场景**: `buildScoreDocDiff` 函数导致问题,但 P1 硬编码修复正常

**预估时间**: ≤ 3 分钟

**操作步骤**:

```typescript
// 编辑 src/services/analysis/scoreDocService.ts
// 删除第 111-184 行的 ScoreDocDiff 接口与 buildScoreDocDiff 函数
// 保留第 11 行的 DEFAULT_THRESHOLDS 导入
// 保留第 305 行的 DEFAULT_THRESHOLDS.rating.strongBuy 引用
```

**注意**: 此回滚会导致 `ScoreHistoryPanel.tsx` 与 `scoreDocService.test.ts` 重新报错。需要同时注释或回滚这两个文件:

```powershell
# 临时注释 ScoreHistoryPanel.tsx 中的 buildScoreDocDiff 调用
# 临时跳过 scoreDocService.test.ts 中的 buildScoreDocDiff 测试
```

### 4.4 紧急回滚(生产环境热修复)

**适用场景**: 生产环境出现严重问题,需要立即回滚

**预估时间**: ≤ 1 分钟

**操作步骤**:

```powershell
# 步骤 1:立即停止生产服务
# (根据实际部署方式执行)

# 步骤 2:回滚代码
git checkout HEAD~1 -- src/services/analysis/scoreDocService.ts

# 步骤 3:重新构建(如生产构建可用)
npm run build

# 步骤 4:重启服务
# (根据实际部署方式执行)

# 步骤 5:通知相关人员
# 通知开发团队、产品、运维
```

---

## 五、回滚验证清单

### 5.1 完整回滚后的验证

| # | 验证项 | 命令 | 预期结果 |
|---|--------|------|----------|
| 1 | 文件状态 | `git status src/services/analysis/scoreDocService.ts` | 无修改 |
| 2 | 类型检查 | `npx tsc --noEmit 2>&1 \| Select-String "scoreDocService"` | 无输出(scoreDocService.ts 无错误) |
| 3 | ScoreHistoryPanel 报错 | `npx tsc --noEmit 2>&1 \| Select-String "ScoreHistoryPanel"` | 显示 buildScoreDocDiff 不存在(预期) |
| 4 | 穿行测试 | `npx vitest run walkthroughScoreDoc` | 失败(预期,因测试文件依赖 buildScoreDocDiff) |
| 5 | 单元测试 | `npx vitest run src/services/analysis/__tests__/scoreDocService.test.ts` | 失败(预期,因测试依赖 buildScoreDocDiff) |

### 5.2 部分回滚后的验证

根据回滚方案 A/B,执行对应的验证:

- **方案 A(仅回滚硬编码)**: 穿行测试 43/43 通过
- **方案 B(仅回滚 buildScoreDocDiff)**: 需同时回滚 ScoreHistoryPanel.tsx 与测试文件

---

## 六、决策树

```
生产环境异常
    │
    ├─ 是 ScoreHistoryPanel 渲染崩溃吗?
    │   ├─ 是 → 完整回滚(4.1)
    │   └─ 否 → 继续
    │
    ├─ 是 buildScoreDocDiff 返回错误数据吗?
    │   ├─ 是 → 完整回滚(4.1)或部分回滚 B(4.3)
    │   └─ 否 → 继续
    │
    ├─ 是 getFileLibraryStats 的 coreStocks 统计错误吗?
    │   ├─ 是 → 部分回滚 A(4.2)
    │   └─ 否 → 继续
    │
    ├─ 是类型检查出现新错误吗?
    │   ├─ 是 → 完整回滚(4.1)
    │   └─ 否 → 继续
    │
    ├─ 是穿行测试失败吗?
    │   ├─ 是 → 完整回滚(4.1)
    │   └─ 否 → 继续
    │
    └─ 其他问题 → 评估后决定回滚方案
```

---

## 七、风险评估

### 7.1 风险矩阵

| 风险项 | 概率 | 影响 | 风险等级 | 缓解措施 |
|--------|------|------|----------|----------|
| `buildScoreDocDiff` 计算逻辑错误 | 低 | 中 | 🟡 中 | 4 个单元测试 + 4 个穿行测试用例覆盖 |
| `DEFAULT_THRESHOLDS.rating.strongBuy` 值被修改导致 coreStocks 统计偏差 | 极低 | 低 | 🟢 低 | 阈值在 config.ts 中已固定为 4.0 |
| 新增导入导致循环依赖 | 极低 | 高 | 🟡 中 | 架构审计通过(services 同层依赖) |
| `ScoreHistoryPanel.tsx` 渲染异常 | 低 | 中 | 🟡 中 | 类型检查通过,引用正确 |
| 回滚后 `ScoreHistoryPanel.tsx` 重新报错 | 100% | 中 | 🟡 中 | 回滚预案中已说明(预期行为) |

### 7.2 回滚风险

| 风险项 | 概率 | 影响 | 缓解措施 |
|--------|------|------|----------|
| 完整回滚后 `ScoreHistoryPanel.tsx` 重新报错 | 100% | 中 | 需同时回滚或注释该组件 |
| 完整回滚后 `scoreDocService.test.ts` 测试失败 | 100% | 低 | 需同时回滚或跳过该测试 |
| 回滚操作误删其他修改 | 低 | 高 | 使用 `git checkout <file>` 而非 `git reset --hard` |

---

## 八、变更详情附录

### 8.1 完整 diff(参考)

```diff
--- a/src/services/analysis/scoreDocService.ts
+++ b/src/services/analysis/scoreDocService.ts
@@ -8,6 +8,7 @@
 import { dataLayer } from '@/data/dataLayer'
 import type { DataLayerResult, FileLibraryStats, ScoreDocVersion, V6LayerScore } from '@/data/types'
 import { getLogger } from '@/lib/logger'
+import { DEFAULT_THRESHOLDS } from '@/services/scoring/v6-engine/config'

 const logger = getLogger()

@@ -108,6 +109,79 @@
   }
 }

+/** 评分文档差异结构(用于历史版本对比面板) */
+export interface ScoreDocDiff {
+  newerVersion: number
+  olderVersion: number
+  compositeDelta: number
+  l3vDelta: number
+  layerChanges: Array<{
+    code: string
+    oldScore: number
+    newScore: number
+    delta: number
+  }>
+  addedLayers: string[]
+  removedLayers: string[]
+  ratingChanged: boolean
+  oldRating: string
+  newRating: string
+}
+
+export function buildScoreDocDiff(newer: ScoreDocVersion, older: ScoreDocVersion): ScoreDocDiff {
+  // ... 完整实现
+}
+
 export async function getNextVersion(symbol: string): Promise<number> {
   const versions = await dataLayer.scoreDocs.listBySymbol(symbol)
   if (versions.length === 0) return 1
@@ -226,7 +300,7 @@
     const totalComposite = all.reduce((sum, d) => sum + d.composite, 0)
-    const coreStocks = all.filter((d) => d.composite >= 4.0).length
+    const coreStocks = all.filter((d) => d.composite >= DEFAULT_THRESHOLDS.rating.strongBuy).length
```

### 8.2 相关文件(未修改,但受影响)

| 文件路径 | 影响类型 | 说明 |
|----------|----------|------|
| [src/components/analysis/score/ScoreHistoryPanel.tsx](../../src/components/organisms/analysis/score/ScoreHistoryPanel.tsx) | 引用方 | 调用 `buildScoreDocDiff`,类型检查通过 |
| [src/services/analysis/__tests__/scoreDocService.test.ts](file:///c:/Users/huawei/Documents/kimi/Workspaces/智能投研复盘系统V9/src/services/analysis/__tests__/scoreDocService.test.ts) | 测试 | 4 个 buildScoreDocDiff 测试用例通过 |
| [tests/__tests__/integration/walkthroughScoreDoc.sampled.test.ts](../../tests/__tests__/integration/walkthroughScoreDoc.sampled.test.ts) | 测试 | 43 个穿行测试用例通过 |

---

## 九、紧急联系与操作流程

### 9.1 紧急操作流程

1. **发现异常** → 立即记录现象与复现步骤
2. **评估严重度** → 参考第三节触发条件
3. **决定回滚方案** → 参考第六节决策树
4. **执行回滚** → 按第四节步骤操作
5. **验证回滚** → 按第五节清单验证
6. **通知相关方** → 开发团队、产品、运维
7. **事后复盘** → 分析根因,记录 lessons learned

### 9.2 回滚后任务

| 优先级 | 任务 | 负责方 |
|--------|------|--------|
| P0 | 分析回滚原因,定位根因 | 开发 |
| P0 | 修复根因问题 | 开发 |
| P1 | 重新部署修复版本 | 开发 + 运维 |
| P2 | 更新测试用例,覆盖遗漏场景 | 开发 |
| P2 | 更新文档,记录本次事件 | 开发 |

---

## 十、附录:验证命令速查

```powershell
# 类型检查(仅 scoreDocService 相关)
npx tsc --noEmit 2>&1 | Select-String "scoreDocService|ScoreHistoryPanel" -SimpleMatch

# ESLint(仅 scoreDocService)
npx eslint src/services/analysis/scoreDocService.ts

# 单元测试(buildScoreDocDiff)
npx vitest run src/services/analysis/__tests__/scoreDocService.test.ts --reporter=default

# 穿行测试(43 用例)
npx vitest run walkthroughScoreDoc --reporter=default

# 架构审计(分层调用)
npm run audit:layers

# 生产构建(注意:预存在 trade.constants 问题会导致失败)
npx vite build
```

---

## 十一、变更日志

| 版本 | 日期 | 变更摘要 |
|------|------|----------|
| v1.0 | 2026-07-04 | 初始版本:涵盖 3 处变更的完整回滚预案 |
