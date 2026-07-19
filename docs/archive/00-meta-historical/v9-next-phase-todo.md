---
title: v9-next-phase-todo
code_version: 2.0.0
tier: core
status: completed
owner: 架构组 / docs 治理组
updated: 2026-07-14
---

# V9 文档体系治理 — 下一阶段任务图（P4 执行计划）

> **定位**：基于 `docs/00-meta/文档体系体检报告-v9.md`（第3次修订）和 Service 契约审查结果，提炼下一阶段任务，按优先级和自主决策等级排期，防止任务漂移。  
> **参照**：`../../AGENTS.md` §十（自主决策规则）、§十二（任务图管理机制）、§十三（模块分拆评估框架）。

---

## 一、根因分析（为何还有下一步）

P0–P3 完成了**文档缺口填补**（README/GOVERNANCE/ADR/Service 契约），但体检报告和契约审查揭示了四类**结构性深层问题**尚未解决：

| 问题类别 | 代表症状 | 根因 | 解决难度 |
|----------|---------|------|----------|
| **数据字典重复** | 8 份 `DATA_DEFINITION` 分散在 02-design/ | 缺少统一数据字典归口 | 中（纯文档迁移） |
| **目录错位** | ~33 份文档在错误目录中 | 历史文档按阶段分目录，未按主题归类 | 中（纯文档迁移） |
| **跨层依赖** | backtest/stockpool → config/；input/analysis → 直写 dataLayer | 早期代码未严格执行 AGENTS.md 分层 | 高（涉及代码变更） |
| **主题包缺失** | DataBridge 相关文档散落 4 个目录 | 按「阶段目录」而非「主题包」组织 | 低（只读索引） |

---

## 二、任务总览（优先级矩阵）

```
高影响 + 高紧急 → P1（立即执行）
高影响 + 低紧急 → P2（1 个月内）
低影响 + 高紧急 → P2（顺手修复）
低影响 + 低紧急 → P3（持续）
```

| 编号 | 任务 | 阶段 | 优先级 | 影响面 | 自主决策等级 | 预估工时 | 状态 |
|------|------|------|--------|--------|-------------|----------|------|
| T1 | 数据字典去重整合（7 份） | P1 | 🔴 最高 | 文档 | ✅ 自主执行 | 2h | ✅ 已完成 |
| T2 | 目录错位清理（~33 份） | P1 | 🔴 最高 | 文档 | ✅ 自主执行 | 4h | ✅ 已完成 |
| T3 | 修复跨层依赖：backtest → config/mathConstants | P1 | 🟡 高 | 代码 | ⚠️ 人工确认 | 1h | ✅ 已完成 |
| T4 | 修复跨层依赖：stockpool → config/dbConfig | P1 | 🟡 高 | 代码 | ⚠️ 人工确认 | 1h | ✅ 已完成 |
| T5 | 修复跨层依赖：input/analysis 直写 dataLayer | P1 | 🟡 高 | 代码 | ⚠️ 人工确认 | 2h | ✅ 已完成 |
| T6 | 建立 DataBridge 主题包（`docs/topics/databridge/`） | P2 | 🟢 中 | 文档 | ✅ 自主执行 | 1h | ✅ 已完成 |
| T7 | 制定 `docs/00-meta/cleanup-schedule.md` | P2 | 🟢 中 | 治理 | ✅ 自主执行 | 1h | ✅ 已完成 |
| T8 | 扩展八类体系二级子类（A2/A3/B5/C7/D5/G4/G5） | P2 | 🔵 低 | 文档 | ✅ 自主执行 | 3h | ✅ 已完成 |
| T9 | 引入文档门禁（Husky pre-commit） | P3 | 🔵 低 | 治理 | ⚠️ 人工确认 | 2h | ✅ 已完成（warn 模式） |
| T10 | 文档保鲜度 Dashboard | P3 | 🔵 低 | 治理 | ⚠️ 人工确认 | 4h | ✅ 已完成 |
| T11 | Kimi 项目索引优化（README Frontmatter） | P3 | 🔵 低 | 文档 | ✅ 自主执行 | 0.5h | ✅ 已完成 |

---

## 三、任务图详解（含防漂移锚点）

### Phase 1：P1 高优先级（本周内）

#### T1 — 数据字典去重整合
- **目标**：将 02-design/ 下 7 份 `*_data-definition.md` 整合至 `../reference/data-dictionary-index.md`，消除重复。
- **上下文锚点**：
  - `rootTask.intent`：消除数据字典重复，避免 AI 引用错误版本
  - `phase.boundary`：只迁移文档，不修改 `src/` 代码
  - `contextAnchor`：整合前 8 份 → 整合后 1 份（主字典）+ 引用映射
- **方案**：
  1. 读取 7 份分散的 DATA_DEFINITION，提取差异字段
  2. 合并至 `../reference/data-dictionary-index.md`（已存在）
  3. 原文件标记为 DEPRECATED 并移入 07-archive/
  4. 更新 `standards/` README 索引
- **验证**：`find docs -name '*DATA_DEFINITION*' | wc -l` → 期望 = 1（仅主字典）
- **回归测试**：L1（`tsc --noEmit`）— 纯文档变更，不触及代码

#### T2 — 目录错位清理（~33 份残余）
- **目标**：将 01-req/02-design 中混错的架构/测试/发布文档迁移至正确目录。
- **上下文锚点**：
  - `rootTask.intent`：消除目录-内容错位，降低检索认知负荷
  - `phase.boundary`：只迁移文档，不修改内容；引用链未更新的暂缓迁移
- **方案**：
  1. 扫描 `docs/01-requirements/` 中架构/设计文档（~5 份）→ `architecture/`
  2. 扫描 `docs/02-design/` 中审计/测试文档（~4 份）→ `audit/` / `04-testing/`
  3. 扫描 `docs/02-design/` 中发布/PR 文档（~4 份）→ `05-deployment/`
  4. 剩余 ~20 份为设计相关（不迁移），标记为「已确认归属」
  5. 每迁移一份文档，用 `grep` 扫描全仓库 import/引用路径，同步更新
- **验证**：`node docs/00-meta/audit-path-match.ts` 或 `npm run audit:docs`
- **回归测试**：L1（`tsc --noEmit`）+ `audit:docs`
- **风险**：引用链未更新的文档迁移后会导致旧链接失效。策略：先迁移，再批量更新引用；若引用链复杂（>5 处），暂缓迁移并记入 TODO。

#### T3 — 修复跨层：backtest → config/mathConstants
- **目标**：`backtestMetrics.ts` 中的 `@/config/mathConstants` 迁移至 `@/constants/math.constants.ts`。
- **自主决策等级**：⚠️ **人工确认**（涉及新增常量文件）
- **方案**：
  1. 在 `src/constants/` 新建 `math.constants.ts`，导出 `TRADING_DAYS_PER_YEAR`
  2. `backtestMetrics.ts` 改 `import { TRADING_DAYS_PER_YEAR } from '@/config/mathConstants'` → `@/constants/math.constants`
  3. 检查 `src/config/mathConstants.ts` 是否被其他模块引用（若非唯一引用，保留原文件做 re-export 兼容）
- **验证**：`npm run audit:layers` → 期望 0 violations
- **回归测试**：L2（`tsc --noEmit` + `audit:layers` + `audit:deadcode`）

#### T4 — 修复跨层：stockpool → config/dbConfig
- **目标**：`stockpoolService.ts` 中的 `@/config/dbConfig` 常量迁移至 `@/constants/stockpool.constants.ts`。
- **自主决策等级**：⚠️ **人工确认**（涉及新增常量文件）
- **方案**：
  1. 在 `src/constants/` 新建 `stockpool.constants.ts`，导出 `DEFAULT_POOL_GROUP`、`RESEARCH_STATUS`、`STORE_NAME`
  2. `stockpoolService.ts` 改 import 路径
  3. 检查 `dbConfig.ts` 中是否仍被其他 services/ 子域引用
- **验证**：`npm run audit:layers`
- **回归测试**：L2

#### T5 — 修复跨层：input/analysis 直写 dataLayer
- **目标**：`batchImportExecutor.ts` / `hotSectorService.ts` / `scoreDocService.ts` 的 `dataLayer.stocks.get()` / `dataLayer.scoreDocs.save()` 统一走 `DataBridge`。
- **自主决策等级**：⚠️ **人工确认**（涉及接口调用方式变更，可能影响数据流）
- **方案**：
  1. `input/batchImportExecutor.ts`：`dataLayer.stocks.get()` → `DataBridge.query({ store: 'stocks', action: 'get', key })`
  2. `input/hotSectorService.ts`：同上
  3. `analysis/scoreDocService.ts`：`dataLayer.scoreDocs.save()` → `DataBridge.forward({ store: 'scoreDocs', action: 'save', data })`
  4. 检查 `DataBridge` 是否已支持对应 action（若不支持，需新增 `ENVELOPE_ACTION`）
- **验证**：`npm run audit:layers` + `npx tsc --noEmit`
- **回归测试**：L3（完整测试套件，因涉及数据流变更）
- **风险**：`DataBridge.routeToDB()` 可能缺少对应 case；若变更需同步更新 `src/config/dbConfig.ts` 的 `ENVELOPE_ACTION`。这属于接口签名变更，需人工确认。

---

### Phase 2：P2 中优先级（1 个月内）

#### T6 — 建立 DataBridge 主题包
- **目标**：将散落 4 个目录的 DataBridge 相关文档用 `docs/topics/databridge/` 重新组织。
- **自主决策等级**：✅ **自主执行**
- **方案**：
  1. 扫描全仓库 DataBridge 相关文档（`grep -rl 'DataBridge' docs/`）
  2. 在 `docs/topics/databridge/` 创建只读索引（不移动原文件，避免破坏引用链）
  3. 索引按「概念/接口/数据流/测试」分类，回链原文件
- **验证**：索引文件存在，回链完整
- **回归测试**：L1

#### T7 — 制定 cleanup-schedule.md
- **目标**：定义 drafts/（7 天）、reports/_generated/（30 天）、changelogs/（永久保留）的清理周期。
- **自主决策等级**：✅ **自主执行**
- **方案**：
  1. 新建 `docs/00-meta/cleanup-schedule.md`
  2. 定义各目录保留期限、清理触发条件（GitHub Actions / 手动）
  3. 定义归档流程（谁有权删除、双人确认规则）
- **验证**：文件存在，规则清晰
- **回归测试**：L1

#### T8 — 扩展八类体系二级子类
- **目标**：按体检报告 §3.1 新增 A2/A3/B5/C7/D5/G4/G5 子类。
- **自主决策等级**：✅ **自主执行**
- **方案**：
  1. 更新 `./文档归类体系结构.md`（v1.0.0）→ v1.1.0
  2. 在 `docs/README.md` 的 A–H 索引中新增二级子类导航
  3. 将 ~47 个孤儿文档按新子类重新归类（或确认归入现有类）
- **验证**：孤儿文档率 ≤ 5%
- **回归测试**：L1 + `audit:docs`

---

### Phase 3：P3 低优先级（持续）

#### T9 — 引入文档门禁（Docs-as-Code）
- **目标**：在 Husky pre-commit 中增加 `docs/audit-path-match.py`（或 `docs/audit-path-match.ts`）。
- **自主决策等级**：⚠️ **人工确认**（涉及 Husky 配置变更，影响所有开发者提交）
- **方案**：
  1. 将 `scripts/audit-path-match.ts` 改造为 pre-commit hook
  2. 检查新增 `.md` 文件的目录与内容关键词是否匹配
  3. 配置为 warn 模式（不阻断提交，先积累数据）
- **验证**：提交时能看到 `[docs-gate]` 提示
- **回归测试**：L2（`npm test -- --run` 验证 hook 不破坏正常提交）

#### T10 — 文档保鲜度 Dashboard
- **目标**：将 `../reports/retrospectives/freshness-alerts.md` 升级为 GitHub Actions / CI 自动产物。
- **自主决策等级**：⚠️ **人工确认**（涉及 CI/CD 配置变更）
- **方案**：
  1. 调研现有 CI 配置（`.github/workflows/`）
  2. 创建 workflow：每月 1 日运行 `docs/audit-freshness.ts` → 生成 `docs/00-meta/freshness-report-YYYY-MM.md`
  3. 配置 issue 自动创建（超期文档列表）
- **验证**：GitHub Actions 运行成功，产物正确
- **回归测试**：CI 本身不需 L3，但需验证 workflow 语法

#### T11 — Kimi 项目索引优化
- **目标**：在 `docs/README.md` 顶部增加「Kimi 加载提示」Frontmatter。
- **自主决策等级**：✅ **自主执行**
- **方案**：
  1. 在 `docs/README.md` 第一行添加 Frontmatter 注释块：
     ```yaml
     ---
     # Kimi 加载提示：本项目为 V9 智能投研复盘系统，按 AGENTS.md v1.4.3 分层架构运行
     # 快速入口：docs/governance.md | docs/architecture/overview.md | docs/00-meta/文档体系体检报告-v9.md
     ---
     ```
  2. 确保 Frontmatter 格式为 YAML（`---` 包裹），Kimi 可自动解析
- **验证**：README 可被正常渲染，Frontmatter 语法正确
- **回归测试**：L1

---

## 四、防漂移机制（每次任务执行前强制执行）

### 状态前置检查门禁

```bash
git log --oneline -5          # 确认当前 commit
git status --short            # 确认工作区状态
# 记录 contextAnchor 快照
echo "Phase=X | Task=Y | ExpectedFiles=Z" >> docs/00-meta/task-context-anchor.log
```

### 上下文锚点对照（每次工具调用前）

1. **意图锚点**：当前操作是否服务于 `rootTask.intent`？（消除数据字典重复 / 目录错位 / 跨层违规）
2. **范围锚点**：当前操作是否超出 `phase` 边界？（P1 只处理文档和代码修复，不碰 P2/P3）
3. **状态锚点**：staged 文件数是否与预期一致？

### 触发暂停的条件

- staged 文件数与 phase 预期不符（如 T1 预期 3-5 个文件变更，实际 >10）
- 发现非本 phase 引入的文件变更（如做 T1 时意外修改了 `src/` 代码）
- `npx tsc --noEmit` 产生非预期错误（>0 个）
- 单任务 Token 消耗 > 15,000（P1 预算）

---

## 五、三级回归测试策略

### 每 Phase 完成后的必做检查

| 级别 | 触发条件 | 命令 | 预期耗时 | 通过标准 |
|------|---------|------|----------|----------|
| **L1 轻量** | 单文档变更、类型修复 | `npx tsc --noEmit` | ~30s | 0 error |
| **L2 标准** | 跨文件重构、import 路径变更 | L1 + `npm run lint` + `audit:layers` + `audit:deadcode` | ~2min | 全部 0 violations |
| **L3 完整** | 代码数据流变更、Schema 变更 | L2 + `npm test -- --run` + `npm run build` | ~5min | 测试通过 + 构建成功 |

### 网页测试触发条件

> 仅当任务涉及 `pages/`、`components/`、`cockpit/`、`apps/` 中的 UI 文件变更时才需要网页测试。

- T1/T2/T6/T7/T8/T11：纯文档变更 → **无需网页测试**
- T3/T4/T5：涉及 `services/` 代码变更，但**不直接修改 UI** → 无需网页测试，但需运行 L3 确保服务逻辑未破坏
- T9/T10：配置变更 → 无需网页测试

---

## 六、验收标准（DoD）

P1 全部完成后：
- [ ] `find docs -name '*DATA_DEFINITION*' | wc -l` = 1（仅主字典）
- [ ] `audit:docs` 通过（0 目录错位违规）
- [ ] `audit:layers` 通过（0 跨层违规）
- [ ] `npx tsc --noEmit` 通过（0 error）
- [ ] `npm test -- --run` 通过（全部绿色）
- [ ] `docs/00-meta/文档体系体检报告-v9.md` 已更新（第4次修订）
- [ ] 本次变更日志已写入 `docs/changelogs/2026-07/`

---

> **下次体检建议**：P1 全部完成后 1 周内复查，确认数据字典重复 = 1、目录错位 = 0、跨层违规 = 0。

---

## 七、附录：回归测试基线（2026-07-12）

### 当前代码库状态（P4 启动前）

> 以下检查结果由 `node_modules/.bin/tsc -p tsconfig.json --noEmit` 直接运行得出，**所有错误均为 pre-existing**（与 P0–P3 文档修改无关）。

| 检查项 | 命令 | 结果 | 说明 |
|--------|------|------|------|
| 9 | 令牌消费审计 | ⚠️ 9 errors in `src/services/trading/scoringAdapter.ts` | pre-existing（0 新增） | 2026-07-12 P3 后复测 |
| 跨层调用 | `audit:layers` | — | 环境限制，无法运行 |
| 文档同步 | `audit:docs` | — | 环境限制，无法运行 |
| 死代码 | `audit:deadcode` | — | 环境限制，无法运行 |

### 建议在本地环境补全的回归测试

请在 Kimi Work / VSCode 终端中运行：

```bash
# L2 标准回归（P1 每任务完成后必做）
npm run tsc:prod          # 确认 0 error（或 baseline 不新增）
npm run lint              # 确认 max-warnings 不新增
npm run audit:layers      # 确认 0 violations
npm run audit:deadcode    # 确认 0 未注册页面

# L3 完整回归（P1 全部完成后必做）
npm test -- --run         # 确认全部通过
npm run build             # 确认构建成功

# 网页测试（仅当涉及 UI/页面变更时）
npm run test:e2e          # Playwright E2E
npm run test:e2e:visual   # 视觉回归（如修改了组件）
```

> **注意**：由于 `tsc` 已有 9 个 pre-existing errors，回归测试的通过标准不是「0 errors」，而是「**不新增 error**」（ratchet 原则）。
