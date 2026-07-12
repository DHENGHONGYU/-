# TECH-DEBT.md — 技术债管理文档

> **版本**: v1.0.0 | **日期**: 2026-07-05
> **适用范围**: V9 项目技术债登记、跟踪、清理
> **核心原则**: 技术债必须记录、定期清理、防止累积

---

> **2026-07-12 核实批注**（双重校对，doc-code-dual-proofreading 技能）：以下债务项已实际完成/无效，状态待更新：
> - **TD-004**（api.ts 缺 JSDoc）：`src/services/api.ts` **已不存在**，债务无效。
> - **TD-005**（calculateScore 120 行）：`calculateScore` 函数**未找到**（已删/改名），债务无效。
> - **TD-006**（硬编码 API 端点）：端点已集中至 `src/config/marketDataEndpoints.ts`，债务已清。
> - **🆕 TD-007**（已撤销·误报，2026-07-12 23:55 复核）：此前观察到 `riskEngine.ts` 9 处 tsc 错误，经双重校对——`Order` 类型（`src/data/types/types.order.ts:13`）**已含** `direction`/`quantity`/`price`/`createdAt` 完整字段，`riskEngine.ts` L5 `import type { Order } from '@/data/types'` 路径正确（re-export 自 types.order）。复跑 `tsc:prod` 多次均 **0 错误**（非增量缓存，tsconfig 未启用 incremental）。初判为 tsc 模块解析瞬时状态导致的误报，**非真实债务**。

---

## 一、技术债定义与分类

### 1.1 什么是技术债？

**定义**: 技术债是为了快速交付而采用的临时妥协方案，需要在后续迭代中修复。

**类比**: 就像金融债务，技术债也需要"还本付息"（修复成本随时间指数增长）。

**典型场景**:
- 为了赶工期，跳过单元测试
- 为了快速验证，使用硬编码配置
- 为了兼容旧代码，保留遗留 API
- 为了演示效果，省略错误处理

### 1.2 技术债分类

| 类型 | 说明 | 示例 |
|------|------|------|
| **代码债** | 代码质量不佳 | 重复代码、过长函数、复杂逻辑 |
| **设计债** | 架构设计不合理 | 模块耦合、接口混乱、缺少抽象 |
| **测试债** | 测试覆盖不足 | 缺少单元测试、无集成测试 |
| **文档债** | 文档缺失或过时 | 无 API 文档、注释不完整 |
| **依赖债** | 过期或有漏洞的依赖 | 老旧库、安全漏洞 |
| **性能债** | 性能优化不足 | 未懒加载、重复计算、内存泄漏 |

### 1.3 优先级定义

| 优先级 | 标签 | 说明 | 处理时限 |
|--------|------|------|----------|
| **P0** | `tech-debt:critical` | 影响功能/安全，必须立即修复 | < 1 周 |
| **P1** | `tech-debt:high` | 影响可维护性，强烈建议修复 | < 1 月 |
| **P2** | `tech-debt:medium` | 影响代码质量，可选改进 | < 1 季度 |
| **P3** | `tech-debt:low` | 不影响功能，可选优化 | 待规划 |

---

## 二、技术债管理流程

### 2.1 发现与登记

#### 发现渠道

1. **代码审查**: 审查者发现技术债，记录到 PR 评论
2. **定期复盘**: 每周/每月代码复盘，主动发现技术债
3. **问题反馈**: 线上问题、Bug 修复时，发现根因是技术债
4. **重构计划**: 规划重构时，识别需要清理的技术债

#### 登记方式

**方式 1: GitHub Issue（推荐）**

```markdown
---
title: "[Tech Debt] 评分引擎性能优化"
labels: ["tech-debt", "tech-debt:high"]
assignees: []
---

## 技术债描述

**类型**: 性能债
**优先级**: P1
**发现日期**: 2026-07-05
**发现人**: @xiaoying-ying

## 问题描述

评分引擎处理 10000+ 数据时耗时 > 5s，影响用户体验。

## 根因分析

使用嵌套循环计算评分，时间复杂度 O(n²)。

## 解决方案

优化为哈希表 + 分批处理，目标时间复杂度 O(n)，耗时 < 500ms。

## 验收标准

- [ ] 单元测试覆盖优化后的代码（覆盖率 > 80%）
- [ ] 性能测试通过（10000 条数据 < 500ms）
- [ ] 回归测试通过（现有功能未受影响）

## 计划完成时间

2026-07-19

## 状态跟踪

- [ ] 🔴 待规划
- [ ] 🟡 进行中
- [ ] ✅ 已完成
- [ ] ⚪ 已延期

## 相关资料

- 相关 PR: #
- 相关 Issue: #
- 性能测试报告: docs/performance/
```

**方式 2: 代码注释（临时记录）**

```typescript
// TODO(TECH-DEBT-001): 提取为公共函数
// 优先级: P1
// 发现日期: 2026-07-05
// 计划完成: 2026-07-19
// 说明: 多个模块都有相同的数据验证逻辑，应提取为 src/lib/validators.ts
function validateInput(data: unknown) {
  // ...
}
```

**方式 3: 技术债清单（本文档 §3）**

直接在本文档登记，适合快速记录。

### 2.2 评估与优先级排序

#### 评估维度

| 维度 | 权重 | 说明 |
|------|------|------|
| **影响范围** | 30% | 影响多少模块/用户？ |
| **严重程度** | 30% | 是否影响功能/安全/性能？ |
| **修复成本** | 20% | 修复需要多少时间？ |
| **累积成本** | 20% | 不修复，后续成本是否指数增长？ |

#### 优先级计算

```
优先级得分 = 影响范围 × 0.3 + 严重程度 × 0.3 + 修复成本 × 0.2 + 累积成本 × 0.2

P0: 得分 > 80
P1: 得分 60-80
P2: 得分 40-60
P3: 得分 < 40
```

#### 优先级调整因素

**升级（提高优先级）**:
- 线上问题根因是技术债 → 升级为 P0
- 技术债影响新功能开发 → 升级为 P1
- 安全漏洞 → 升级为 P0

**降级（降低优先级）**:
- 受影响的模块已废弃 → 降级为 P3
- 有临时绕过方案 → 降级为 P2
- 修复成本远高于收益 → 降级为 P3

### 2.3 规划与分配

#### 规划原则

1. **20% 规则**: 每个迭代预留 20% 时间清理技术债
2. **优先级优先**: 先清理 P0，再清理 P1
3. **批量清理**: 相关的技术债批量清理（提高效率）
4. **预防为主**: 新代码不产生技术债（通过代码审查保证）

#### 分配策略

| 优先级 | 分配方式 | 示例 |
|--------|----------|------|
| **P0** | 立即分配，最高优先级 | 当前迭代必须完成 |
| **P1** | 规划到后续 2 个迭代内 | 下个迭代或下下个迭代 |
| **P2** | 规划到后续季度内 | 3 个月内完成 |
| **P3** | 待规划，有空闲时间再处理 | 不承诺完成时间 |

#### 迭代规划模板

```markdown
## 迭代 2026-07-15 ~ 2026-07-29

### 新功能开发（80% 时间）

- [ ] 功能 A
- [ ] 功能 B

### 技术债清理（20% 时间）

- [ ] [TD-001] 评分引擎性能优化（P1，5 小时）
- [ ] [TD-002] 提取数据验证逻辑（P1，3 小时）

### 总计

- 新功能: 40 小时
- 技术债: 8 小时（20%）
- 总计: 48 小时
```

### 2.4 执行与跟踪

#### 执行流程

```
1. 从技术债清单选择高优先级项
   ↓
2. 创建 GitHub Issue（如尚未创建）
   ↓
3. 创建修复分支（命名：fix/tech-debt-XXX）
   ↓
4. 修复技术债
   ↓
5. 补充测试（覆盖率 > 80%）
   ↓
6. 提交审查（使用 PR 模板）
   ↓
7. 合并到主分支
   ↓
8. 更新技术债清单（标记已完成）
```

#### 跟踪方式

**GitHub Project 看板**（推荐）:

```
📋 待规划 → 🔨 进行中 → 👀 审查中 → ✅ 已完成 → 🗄️ 已归档
```

**技术债清单**（本文档 §3）:

定期更新状态（🔴 待规划 / 🟡 进行中 / ✅ 已完成 / ⚪ 已延期）

#### 进度报告

**每周报告**（团队会议）:

```markdown
## 技术债清理进度（2026-07-05 周）

### 本周完成

- ✅ [TD-002] 提取数据验证逻辑
- ✅ [TD-005] 补充单元测试

### 进行中

- 🟡 [TD-001] 评分引擎性能优化（50% 完成）

### 下周计划

- [ ] [TD-003] 重构评分引擎架构
- [ ] [TD-004] 更新 API 文档
```

**每月报告**（月度复盘）:

```markdown
## 技术债月度报告（2026-07）

### 清理统计

- 清理完成: 5 个
- 新增: 2 个
- 净减少: 3 个

### 优先级分布

- P0: 0 个（目标: 0）
- P1: 3 个（目标: < 5）
- P2: 8 个（目标: < 10）
- P3: 若干（不计入）

### 下月计划

- 清理 3 个 P1 技术债
- 审查新增技术债，评估优先级
```

---

## 三、技术债清单

> **说明**: 本文档记录所有已发现的技术债。定期更新状态。

---

### P0: 必须修复（影响功能/安全）

#### [TD-001] 评分引擎性能问题

- **发现日期**: 2026-07-05
- **类型**: 性能债
- **问题描述**: 评分引擎处理 10000+ 数据时耗时 > 5s
- **根因**: 使用嵌套循环，时间复杂度 O(n²)
- **解决方案**: 优化为哈希表，时间复杂度 O(n)
- **计划完成**: 2026-07-12
- **状态**: 🟡 进行中
- **负责人**: @xiaoying-ying
- **相关 Issue**: #123

---

### P1: 强烈建议（影响可维护性）

#### [TD-002] 重复代码：数据验证逻辑

- **发现日期**: 2026-07-05
- **类型**: 代码债
- **问题描述**: 多个模块都有相同的数据验证逻辑
- **根因**: 未提取为公共函数
- **解决方案**: 提取为 `src/lib/validators.ts`
- **计划完成**: 2026-07-19
- **状态**: ✅ 已完成
- **负责人**: @xiaoying-ying
- **相关 Issue**: #124

#### [TD-003] 单元测试覆盖率不足

- **发现日期**: 2026-07-05
- **类型**: 测试债
- **问题描述**: `src/services/` 覆盖率仅 65%（目标 80%）
- **根因**: 开发时未同步编写测试
- **解决方案**: 补充单元测试，重点覆盖核心逻辑
- **计划完成**: 2026-07-26
- **状态**: 🔴 待规划
- **负责人**: @xiaoying-ying
- **相关 Issue**: #125

#### [TD-004] API 文档不完整

- **发现日期**: 2026-07-05
- **类型**: 文档债
- **问题描述**: `src/services/api.ts` 缺少 JSDoc 注释
- **根因**: 开发时未及时添加注释
- **解决方案**: 补充 JSDoc 注释，生成 API 文档
- **计划完成**: 2026-08-02
- **状态**: 🔴 待规划
- **负责人**: @xiaoying-ying
- **相关 Issue**: #126

---

### P2: 可选改进（影响代码质量）

#### [TD-005] 函数过长：评分计算函数

- **发现日期**: 2026-07-05
- **类型**: 代码债
- **问题描述**: `calculateScore()` 函数 120 行
- **根因**: 未拆分函数
- **解决方案**: 拆分为 `validateInput()` + `calculate()` + `normalize()`
- **计划完成**: 2026-08-15
- **状态**: 🔴 待规划
- **负责人**: @xiaoying-ying
- **相关 Issue**: #127

#### [TD-006] 硬编码配置：API 端点

- **发现日期**: 2026-07-05
- **类型**: 设计债
- **问题描述**: API 端点硬编码在多个文件中
- **根因**: 快速开发时未提取为配置
- **解决方案**: 提取为 `src/config/api.ts`
- **计划完成**: 2026-08-30
- **状态**: 🔴 待规划
- **负责人**: @xiaoying-ying
- **相关 Issue**: #128

---

### P3: 待规划（不影响功能）

#### [TD-007] 注释不完整

- **发现日期**: 2026-07-05
- **类型**: 文档债
- **问题描述**: 部分复杂函数缺少 JSDoc 注释
- **根因**: 开发时未及时添加注释
- **解决方案**: 补充 JSDoc 注释
- **计划完成**: 待规划
- **状态**: 🔴 待规划
- **负责人**: 未分配
- **相关 Issue**: #129

#### [TD-008] 依赖过期

- **发现日期**: 2026-07-05
- **类型**: 依赖债
- **问题描述**: `lodash` 版本过期（v4.17.21 → v4.17.23）
- **根因**: 未定期更新依赖
- **解决方案**: 更新依赖，检查兼容性
- **计划完成**: 待规划
- **状态**: 🔴 待规划
- **负责人**: 未分配
- **相关 Issue**: #130

---

#### [TD-009] cockpit 组件中硬编码颜色

- **发现日期**: 2026-07-06
- **类型**: 代码债
- **问题描述**: `src/cockpit/widgets/MarketIndicesWidget.tsx` 等组件直接使用 Tailwind 颜色类名（如 `text-red-500`），未使用颜色令牌系统
- **根因**: 开发时未遵守颜色令牌规范（AGENTS.md §3.5）
- **解决方案**: 替换为 `COLOR_TOKENS` 或 `COLOR_SHADES`
- **计划完成**: 2026-07-15
- **状态**: 🔴 待规划
- **负责人**: @DENGHONGYU
- **相关 Issue**: 待创建

#### [TD-010] 单元测试 Worker 崩溃

- **发现日期**: 2026-07-06
- **类型**: 测试债 / 性能债
- **问题描述**: 运行 `npm test` 时 tinypool worker 意外退出（exit code 1），导致部分测试失败或中断
- **根因**: 内存不足或 Windows 下的进程管理问题
- **临时方案**: 使用 `--pool forks` 参数运行测试
- **解决方案**: 调查 Worker 崩溃根因，修复内存泄漏或配置问题，使默认 `npm test` 稳定运行
- **计划完成**: 2026-07-20
- **状态**: 🔴 待规划
- **负责人**: @DENGHONGYU
- **相关 Issue**: 待创建

#### [TD-011] ESLint 输出为空导致 pre-review 误判

- **发现日期**: 2026-07-06
- **类型**: 工具债
- **问题描述**: `pre-review-check.ts` 脚本中 ESLint 检查输出为空，导致误判为失败
- **根因**: ESLint 输出太大，导致 `execSync` 缓冲区溢出
- **解决方案**: 使用临时文件捕获输出（已在 v2.1 中修复）
- **计划完成**: 2026-07-06
- **状态**: ✅ 已完成
- **负责人**: @DENGHONGYU
- **相关 Issue**: 无

---

## 四、技术债预防

### 4.1 代码审查门禁

**原则**: 新代码不产生技术债（或明确记录）

**审查清单**:
- [ ] 无重复代码（或已提取为公共函数）
- [ ] 函数长度 < 50 行（或已拆分）
- [ ] 文件长度 < 300 行（或已拆分）
- [ ] 单元测试覆盖率 > 80%
- [ ] JSDoc 注释完整
- [ ] 无硬编码配置（或已提取为 config）

**例外处理**:
- 如必须临时妥协，记录为技术债（GitHub Issue 或代码注释）
- 在 PR 描述中说明原因和后续计划

### 4.2 定期复盘

**每周复盘**（周五下午）:
- 检查本周代码是否产生新技术债
- 如有，立即登记并评估优先级

**每月深度复盘**（月末）:
- 审查技术债清单，更新优先级
- 规划下月清理计划
- 分析技术债根因，改进开发流程

### 4.3 自动化检查

**工具配置**:
- ESLint: 检查代码质量（复杂度、重复代码）
- SonarQube: 检查技术债指标（可选）
- Dependabot: 自动更新依赖（GitHub App）

**指标监控**:
- 代码复杂度趋势（目标: 不增长）
- 测试覆盖率趋势（目标: 持续提高）
- 技术债数量趋势（目标: 净减少）

---

## 五、技术债清理策略

### 5.1 清理原则

1. **优先级优先**: 先清理 P0，再清理 P1
2. **小步快跑**: 每次清理范围控制在 1-3 天
3. **测试先行**: 清理前先补充测试（防止引入 Bug）
4. **逐步重构**: 避免大规模重构（分批进行）
5. **文档同步**: 清理后更新文档（防止文档过时）

### 5.2 清理模式

#### 模式 1: 童子军规则（日常）

**原则**: 离开代码时，让其比来时更干净。

**做法**:
- 修改代码时，顺手修复附近的技术债
- 例如：修改函数时，顺手拆分过长函数

**优点**: 逐步改进，不占用专门时间  
**缺点**: 需要团队高度自律

#### 模式 2: 迭代预留（定期）

**原则**: 每个迭代预留 20% 时间清理技术债。

**做法**:
- 规划迭代时，明确分配技术债清理任务
- 例如：每个迭代清理 2-3 个 P1 技术债

**优点**: 有计划、可跟踪  
**缺点**: 需要团队纪律（不轻易占用技术债时间）

#### 模式 3: 专项重构（集中）

**原则**: 当技术债累积到一定程度，规划专项重构迭代。

**做法**:
- 当 P1 技术债 > 10 个时，规划 1-2 个迭代专门重构
- 例如：重构评分引擎架构（涉及 5 个技术债）

**优点**: 集中清理、效果好  
**缺点**: 占用新功能开发时间（需要管理层支持）

### 5.3 清理案例

#### 案例 1: 代码债清理（提取公共函数）

**技术债**: [TD-002] 重复代码：数据验证逻辑

**清理步骤**:
```
1. 识别重复代码（3 个模块都有相同验证逻辑）
   ↓
2. 补充单元测试（覆盖现有逻辑，防止重构引入 Bug）
   ↓
3. 提取为公共函数（src/lib/validators.ts）
   ↓
4. 替换原有代码（3 个模块都调用公共函数）
   ↓
5. 运行回归测试（确保功能未受影响）
   ↓
6. 更新技术债清单（标记已完成）
```

**清理代码**:
```typescript
// ❌ 清理前：3 个模块都有相同逻辑
// src/services/fundFlowService.ts
function validateInput(data: unknown) {
  if (!data || typeof data !== 'object') throw new Error('Invalid input');
  if (!('stockCode' in data)) throw new Error('Missing stockCode');
  // ...
}

// src/services/scoringService.ts
function validateInput(data: unknown) {
  if (!data || typeof data !== 'object') throw new Error('Invalid input');
  if (!('stockCode' in data)) throw new Error('Missing stockCode');
  // ...
}

// ✅ 清理后：提取为公共函数
// src/lib/validators.ts
export function validateStockData(data: unknown): data is StockData {
  if (!data || typeof data !== 'object') throw new Error('Invalid input');
  if (!('stockCode' in data)) throw new Error('Missing stockCode');
  // ...
  return true;
}

// src/services/fundFlowService.ts
import { validateStockData } from '@/lib/validators';
function processData(data: unknown) {
  validateStockData(data);
  // ...
}
```

#### 案例 2: 性能债清理（优化算法）

**技术债**: [TD-001] 评分引擎性能问题

**清理步骤**:
```
1. 编写性能测试（记录当前耗时 5s）
   ↓
2. 分析性能瓶颈（Profiler 显示嵌套循环占 90% 时间）
   ↓
3. 优化算法（嵌套循环 O(n²) → 哈希表 O(n)）
   ↓
4. 运行性能测试（确认耗时 < 500ms）
   ↓
5. 运行回归测试（确保功能未受影响）
   ↓
6. 更新技术债清单（标记已完成）
```

**清理代码**:
```typescript
// ❌ 清理前：嵌套循环 O(n²)
function calculateScore(stocks: StockData[]): Score[] {
  const scores: Score[] = [];
  for (let i = 0; i < stocks.length; i++) {
    let score = 0;
    for (let j = 0; j < factors.length; j++) {
      score += stocks[i].value * factors[j].weight;
    }
    scores.push({ stockCode: stocks[i].code, score });
  }
  return scores;
}

// ✅ 清理后：哈希表 O(n)
function calculateScore(stocks: StockData[]): Score[] {
  const factorMap = new Map(factors.map(f => [f.name, f.weight]));
  
  return stocks.map(stock => {
    let score = 0;
    for (const [key, value] of Object.entries(stock.factors)) {
      const weight = factorMap.get(key) || 0;
      score += value * weight;
    }
    return { stockCode: stock.code, score };
  });
}
```

---

## 六、工具与自动化

### 6.1 GitHub 配置

#### Issue 模板 (`.github/ISSUE_TEMPLATE/tech-debt.md`)

```markdown
---
name: Tech Debt
about: 登记技术债
title: "[Tech Debt] "
labels: tech-debt
assignees: ""
---

## 技术债描述

**类型**: [代码债/设计债/测试债/文档债/依赖债/性能债]
**优先级**: [P0/P1/P2/P3]
**发现日期**: YYYY-MM-DD

## 问题描述

<!-- 描述技术债的具体表现 -->

## 根因分析

<!-- 为什么会产生这个技术债？ -->

## 解决方案

<!-- 如何修复这个技术债？ -->

## 验收标准

- [ ] 标准 1
- [ ] 标准 2

## 计划完成时间

YYYY-MM-DD

## 相关资料

- 相关 PR: #
- 相关 Issue: #
```

#### Project 看板

**创建 GitHub Project**:
1. 进入仓库 → Projects → New Project
2. 选择模板 "Board"
3. 创建列：📋 待规划 / 🔨 进行中 / 👀 审查中 / ✅ 已完成 / 🗄️ 已归档
4. 添加自动化规则：
   - 当 Issue 添加 `tech-debt` 标签 → 添加到 📋 待规划
   - 当 Issue 分配给某人 → 移动到 🔨 进行中
   - 当 PR 关联 Issue → 移动到 👀 审查中
   - 当 Issue 关闭 → 移动到 ✅ 已完成

### 6.2 自动化脚本

#### 生成技术债报告 (`scripts/generate-tech-debt-report.ts`)

```typescript
#!/usr/bin/env tsx

/**
 * 生成技术债报告
 * 使用：npm run tech-debt:report
 */

import { execSync } from 'child_process';

function main() {
  // 1. 从 GitHub API 获取技术债 Issue
  const issues = execSync('gh issue list --label tech-debt --json number,title,labels,priority,createdAt', { encoding: 'utf-8' });
  const techDebts = JSON.parse(issues);
  
  // 2. 按优先级分组
  const grouped = {
    P0: techDebts.filter((t: any) => t.labels.includes('tech-debt:critical')),
    P1: techDebts.filter((t: any) => t.labels.includes('tech-debt:high')),
    P2: techDebts.filter((t: any) => t.labels.includes('tech-debt:medium')),
    P3: techDebts.filter((t: any) => t.labels.includes('tech-debt:low')),
  };
  
  // 3. 生成报告
  console.log('# 技术债报告');
  console.log(`生成时间: ${new Date().toISOString()}`);
  console.log('');
  console.log(`## 统计`);
  console.log(`- P0: ${grouped.P0.length} 个`);
  console.log(`- P1: ${grouped.P1.length} 个`);
  console.log(`- P2: ${grouped.P2.length} 个`);
  console.log(`- P3: ${grouped.P3.length} 个`);
  console.log(`- 总计: ${techDebts.length} 个`);
  console.log('');
  console.log('## 详情');
  // ...
}

main();
```

**配置** (`package.json`):
```json
{
  "scripts": {
    "tech-debt:report": "tsx scripts/generate-tech-debt-report.ts"
  }
}
```

### 6.3 VS Code 插件

**推荐插件**:
- **Todo Tree**: 高亮代码中的 `TODO`/`FIXME`/`TECH-DEBT` 注释
- **SonarLint**: 实时检测代码质量和技术债
- **Code Metrics**: 显示代码复杂度（圈复杂度、函数长度等）

**配置** (`settings.json`):
```json
{
  "todo-tree.general.tags": ["TODO", "FIXME", "TECH-DEBT"],
  "todo-tree.highlight.customHighlight": {
    "TECH-DEBT": {
      "foreground": "red",
      "icon": "alert"
    }
  },
  "sonarlint.rules": {
    "complexity": "error",
    "duplicated-blocks": "warning"
  }
}
```

---

## 七、总结

### 技术债管理核心要点

1. **必须记录**: 所有技术债都要登记（GitHub Issue 或本文档）
2. **定期清理**: 每个迭代预留 20% 时间清理技术债
3. **优先级明确**: P0/P1/P2/P3 分级，优先清理高优先级
4. **预防为主**: 代码审查门禁，新代码不产生技术债
5. **工具支持**: GitHub Project + 自动化脚本 + VS Code 插件

### 技术指标

| 指标 | 目标 | 监控方式 |
|------|------|----------|
| **P0 技术债数量** | 0 | 每周检查 |
| **P1 技术债数量** | < 5 | 每月检查 |
| **测试覆盖率** | > 80% | `npm test -- --coverage` |
| **代码复杂度** | 圈复杂度 < 10 | ESLint `complexity` 规则 |
| **技术债清理率** | > 新增率 | 每月统计 |

### 下一步行动

- [ ] 登记现有技术债（填写本文档 §3）
- [ ] 创建 GitHub Issue 模板（`.github/ISSUE_TEMPLATE/tech-debt.md`）
- [ ] 创建 GitHub Project 看板（技术债管理）
- [ ] 配置自动化脚本（`npm run tech-debt:report`）
- [ ] 规划首次技术债清理迭代

---

**文档维护**: 本文档由技术负责人维护，每月更新技术债清单。

**反馈渠道**: 如有疑问或建议，请联系 @xiaoying-ying 或在 GitHub Discussion 中讨论。
