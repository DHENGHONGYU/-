---
skill_id: V9-SKILL-HEALTH-AUDIT
name: v9-health-audit
version: v1.0.0
last_updated: 2026-07-25
category: code-quality
tags: [health-audit, progress-review, state-drift, benchmark, project:finsightv9]
title: "FinSightV9 健康度复检与状态自洽审计"
description: "FinSightV9 开发进度/健康度复检、行业对标、评分与状态自洽校验。核心交付物是 outputs/dev-health-review-YYYY-MM-DD.md + 评分雷达。最大价值在于\"检测方法\"：用实时工具（git / automation_update / tsc / vitest）校验状态事实，杜绝直接采信 MEMORY.md 或治理文档导致的\"假绿灯/假红灯/状态失准\"。适用于二次开发前体检、\"再次检查进度和健康度\"类诉求、门禁回归定位、文档vs现实矛盾核对。"
agent_created: true
triggers:
  keywords: [健康度, 进度检查, 健康度复检, 二次开发, 门禁体检, 状态校验, 文档vs现实, 状态失准, 评分, 行业对标, health check, progress review, benchmark, state drift, 假绿灯, 假红灯]
  files: ["outputs/dev-health-review-*.md", "docs/reports/project-management/development-lessons-learned.md"]
  events: [health-review, pre-secondary-dev, state-drift-check, gate-regression]
gates: ["tsc:prod 真实退出码捕获：禁止用 | tail 掩盖退出码", "audit:layers 实跑退出码 = 0", "automation_update list 真实条数 vs 治理文档声称条数交叉核对"]
mandatory: false
covers_docs: []
related_skills: [v9-bash-conventions, v9-tsc-gate-scope-audit]
freshness_policy:
  review_cycle: quarterly
  trigger_events: [pre-secondary-dev, gate-regression, state-drift-detected]
search_priority: high
search_keywords: [健康度复检, 进度检查, 状态自洽, 假绿灯, 假红灯, 行业对标, 评分雷达]
---

# finsight-health-audit — FinSightV9 健康度复检与状态自洽审计

> 目的：在二次开发 / 复检 / 对标时，给出**经实时工具复验**的进度、健康度、评分，
> 并沉淀可复用的"检测方法"与"教训库"。本 SKILL 是 2026-07-23 一次真实复检的结晶：
> 当时 MEMORY.md 与 V9-DOC-KB-001 同时声称 `tsc:prod=0 错误`、`9 条 ACTIVE 自动化`，
> 但实时工具复验发现 tsc:prod 实际 EXIT=2/27 错误、自动化仅 3 条真正注册。

---

## 0. 核心铁律（最重要）

**实时工具优先于记忆。** 任何状态类事实（自动化条数、门禁是否通过、分支、文件数、
测试失败数）在下结论前**必须**用工具实时查，记忆/治理文档文字仅作线索、不作证据。
本项目 §1.3 与 memory 铁律早已确立此点，但本次复检证明它仍会被违反（文档失准）。

绝对禁止：
- 直接把 MEMORY.md / 经验教训库里的数字当作"当前真实状态"写进结论。
- 用 `cmd | tail` 跑门禁——`tail` 会吞掉退出码，导致 RED 被误判为 GREEN。
- 用"记忆里说 9 条"反推"现在应该有 9 条"——以 `automation_update list` 为准。

---

## 1. 按序检测法（二次开发前/复检必跑 D1–D6）

> 顺序即纪律：先拿真实状态，再对标，最后评分。每步产出可追溯的 file:line / 退出码。

### D1 — git 真实状态
```bash
cd /g/FinSightV9
git rev-parse --abbrev-ref HEAD      # 当前分支
git rev-list --count HEAD            # 提交总数
git log --oneline -5                 # 最近提交
git status --short | wc -l           # 工作树脏文件数（注意：大量脏文件≠坏，可能是未提交修复）
```

### D2 — tsc:prod 真实退出码（关键 RED 源）
```bash
cd /g/FinSightV9
C:/nvm4w/nodejs/node.exe ./node_modules/typescript/bin/tsc -p tsconfig.prod.json --noEmit > /tmp/tsc_prod.log 2>&1
echo "TSC_EXIT=$?"                    # 必须看这个，不是看 tail 输出
grep -c "error TS" /tmp/tsc_prod.log  # 错误总数
cat /tmp/tsc_prod.log                 # 完整错误，定位 file:line
```
> 教训：受管 Node22 跑 tsc 可能 worker 崩溃；用**系统 Node24**（`C:/nvm4w/nodejs/node.exe`）直驱。

### D3 — 门禁脚本清单 + 关键门禁实跑
```bash
# 列出 audit/tsc/test/verify 类脚本
node -e "const p=require('./package.json'); Object.keys(p.scripts).filter(k=>/audit|tsc|test|verify|lint/.test(k)).forEach(k=>console.log(k+': '+p.scripts[k]))"
# 实跑分层门禁（系统 Node24 直驱 tsx）
C:/nvm4w/nodejs/node.exe ./node_modules/tsx/dist/cli.mjs scripts/audit/audit-layer-calls.ts
```

### D4 — 自动化注册真实条数（SoT = 工具，非记忆）
- 调用 `automation_update` 工具，`mode=list`，读取真实 ACTIVE 列表。
- 与 MEMORY.md / V9-DOC-KB-001 声称条数比对；差异即"声称注册 vs 真实注册"漂移。
- 本项目实测：文档称 9 条，工具仅 3 条（A+H 字典刷新 / CloudStudio 周构建 / 每日 Git 备份）。

### D5 — 测试基线（争议文件直接实跑，分目录防爆）
- 当文档对测试失败数互相打架时，**直接实跑争议文件**而非全量：
```bash
C:/nvm4w/nodejs/node.exe ./node_modules/vitest/vitest.mjs run \
  tests/CockpitShell.panel.test.tsx tests/IndustryChainWidget.test.tsx tests/services/profileService.test.ts \
  --no-coverage
grep -E "Test Files|Tests |Duration" <log>
```
- 全量 vitest 在受管 Node22 下会因 worker 崩溃失败 → **分目录批量跑** + 用系统 Node24。
- 本项目实测：三大"失败大头"文件 37 passed / 0 failed，证明"82 failed"一版已过时。

### D6 — 文档 vs 现实矛盾扫描
- 用 Grep 在 `MEMORY.md` / `docs/06-project-management/development-lessons-learned.md`
  中找状态数字（"tsc:prod = 0"、"9 ACTIVE"、"23 failed"），与实际工具输出逐一对照。
- 每个矛盾记录：`文档声称 X` @ file:line  vs `工具实测 Y`。

### D7 — CI 真实性核查（防"无 CI"误判 + 防门禁假绿灯）
```bash
cd /g/FinSightV9
ls .github/workflows/                              # 先确认 CI 是否真存在，勿直接下"无 CI"结论
# 逐 workflow 读 on: 触发分支；检查每个 run: 引用的外部脚本是否真实存在
grep -rn "run:" .github/workflows/ | grep -E "\.sh$|\.ps1$"
# 对被引用的脚本做存在性校验（缺失即假绿灯）
ls scripts/check-types.sh 2>/dev/null || echo "⚠️ 被 CI 引用的脚本不存在 → 假绿灯"
```
> 教训：本次复检初版报告写"无 CI 管线"，实则 `.github/workflows/quality-check.yml` 早有 13 job（SHA-pinned 加固）；且其 `typecheck` 引用**不存在的 `scripts/check-types.sh`** → 类型门禁从未真正校验（假绿灯）。铁律：**先 `ls .github/workflows/` 再下结论；凡 `run: *.sh/*.ps1` 必验证文件存在**。修复 = 把失效引用改为真实 `npm run tsc:prod`。

---

## 2. 检测方法库（可跨项目复用）

| 编号 | 方法 | 何时用 | 命令/做法 |
|---|---|---|---|
| M1 | 实时工具优先 | 任何状态事实 | 见 §0 铁律 |
| M2 | 真实退出码捕获 | 跑门禁/类型检查 | `cmd > /tmp/log 2>&1; echo EXIT=$?`  **禁止 `\| tail`** |
| M3 | 争议文件直跑 | 文档对测数打架 | vitest 指定具体文件，看 Tests 行 |
| M4 | 文档vs现实矛盾扫描 | 校准治理文档 | Grep 状态数字 ↔ 工具输出对照 |
| M5 | 分目录批量 vitest | 全量崩 worker | 按 src/tests 子目录分批 + 系统 Node24 |
| M6 | 自动化 SoT 校验 | 定时任务盘点 | `automation_update list` 为唯一真相源 |
| M7 | 类型回归根因定位 | tsc:prod RED | 读完整错误，按 `widened literal` / `possibly undefined` 归类 |
| M8 | CI 真实性核查 | 报告"无 CI"/门禁可信度 | `ls .github/workflows/` + 校验 `run:` 引用的 `.sh/.ps1` 脚本存在性（缺失=假绿灯） |
| M9 | 失败测试分类诊断 | 复检测试基线 / 修 flaky+drift | 四归类（断言漂移/严格空检/真缺陷/环境flaky）+ 最小修复；Node21+ fetch 用 Object.defineProperty |

---

## 3. 真实修复闭环 SOP（tsc:prod 回归示例）

当出现 `D2` RED 时的最小变更闭环：

1. **读完整错误**，归类根因（本项目 27 错 = 26 同类 + 1 严格空检）。
2. **定位根因**：`widgetRegistry.ts` 26 错源于 `WIDGET_DEFAULT_DATA_SOURCE` 常量的
   `type` 字段被 `ACTIVE_DATA_SOURCE`（= `import.meta.env.VITE_* || CONST`）拓宽为 `string`，
   不兼容 `DataSourceConfig.type: DataSourceType`。
3. **最小变更**（不动被其他模块依赖的导出符号）：
   - 在常量上方加局部类型别名 `const activeDs: DataSourceType = ACTIVE_DATA_SOURCE as DataSourceType`
   - 给常量加注解 `export const WIDGET_DEFAULT_DATA_SOURCE: Record<string, DataSourceConfig> = {`
   - 块内 `type: ACTIVE_DATA_SOURCE,` → `type: activeDs,`（`replace_all`）
   - 在 `stockCodeUtils.ts` 把 `suffixMatch[1].toLowerCase()` → `suffixMatch[1]?.toLowerCase()`
   - 在 `cockpit.constants.ts` 顶部补 `import { DataSourceConfig, DataSourceType } from '@/types/modules/widget.types'`
4. **复跑 `D2`** 至 `TSC_EXIT=0`。
5. **跑关联门禁** `audit:layers`（项目强制：代码改动走 module-sync-checklist 的十域同步 + 门禁）。
6. **复跑争议测试** 确认无回归（本项目 37 passed / 0 failed 保持）。
7. **校准文档**（见 §4）。

> 反模式：不要为了消除 `string` 拓宽而把 `ACTIVE_DATA_SOURCE` 导出类型直接改窄——
> 它还在 `marketDataStore.ts` / `MarketDataProvider.tsx` 做 `=== DATA_SOURCE_TYPE.MOCK` 比较，
> 局部类型别名最安全。

### 3.5 失败测试分类诊断 SOP（复检测试基线必跑）

当 `D5` 跑出失败用例（如本项目基线 30 failed / 21 失败文件），按四归类、最小修复：

1. **断言漂移（TEST DRIFT）** — 源码字段/行为已变，测试还按旧契约断言。
   判定：读源码确认被断言的字段/枚举/计数在当前实现下是**一致且有意**的（如
   `addStock` 默认 `researchStatus='candidate'`、批量导入把"已存在"记为 `skipped` 而非
   `failed`、证据说明在 `content` 而非 `summary`），则**改测试**对齐源码，不动源码。
2. **严格空检 / TS 拓宽** — 见 M7，改源码类型注解或可选链 `?.`。
3. **真实缺陷（REAL BUG）** — 源码逻辑错误（如 `source` 字段被错误赋值、异步
   `broadcast` 破坏同步有序投递）。修源码，并复跑关联测试确认。
4. **环境 / flaky** — Node21+ 下 `vi.stubGlobal('fetch')` 静默失效（全局 `fetch`
   getter 不可配置）→ 改 `Object.defineProperty(globalThis,'fetch',{configurable:true,writable:true})`；
   计时/负载类 flaky（store/组件渲染、benchmark 并行 vs 串行）**单独实跑验证 pass 即可，
   不强行修源码**，仅在确为断言过严时放宽阈值（如 `speedup>0.5`）。

关键坑：
- **重复测试文件**：同一 service 可能在 `src/<dir>/*.test.ts` 与 `tests/<dir>/*.test.ts`
  各有一份，两份都跑；修一处不够，需确认两份断言都对齐当前源码（本项目
  `researchReportSyncService` 即两份，仅 `tests/` 那份漂移，另一份 `src/` 早已正确）。
- **Node 运行时**：全量 vitest 用系统 Node24 直驱 `vitest.mjs`，避免受管 Node22 worker 崩溃。
- **端点下线**：反爬导致外部 API 下线（如 `EASTMONEY_*_API_UNAVAILABLE=true`）→ 测试改断言
  返回 `[]`，不模拟已失效端点。

---

## 4. 交付前文档校准（防状态失准复发）

修复/复检后，以实时工具为准更新：
- `G:/FinSightV9/.workbuddy/memory/MEMORY.md` — 运维自动化条数、tsc 真实状态、测试基线。
- `G:/FinSightV9/docs/06-project-management/development-lessons-learned.md`（V9-DOC-KB-001）
  — 同步失准的状态数字。

原则：文档写"实测 EXIT=0"可以；写"据记忆应为 0"不行。

---

## 5. 行业对标基准（评分维度与权重）

| 维度 | 权重 | 本项目（2026-07-23 修复前） | 行业领先实践 |
|---|---|---|---|
| 架构分层 | 9/10 | 分层清晰 + `audit:layers` 强制 | 单体分层 + 编译期边界校验 |
| 质量门禁 | 7/10 | 12 道 husky 门禁，但主门禁曾 RED | pre-commit 全绿 + 失败即阻塞 |
| 设计令牌 | 9/10 | L1–L6 单源 + `audit:tokens` | 设计令牌 SoT + 自动审计 |
| 测试 | 6/10 | 体量大但无覆盖率/变异门禁；全量崩 worker | 测试金字塔 + 覆盖率门禁 + 分片 |
| AI 治理 | 9/10 | 技能注册表/记忆索引/飞轮（solo 罕见） | — |
| 文档 | 4/10 | 噪音大（590K 行备份），治理文档失准 | 单一事实源 + 自动同步 |
| CI/CD | 3/10 | 无 CI；仅本地 husky + 定时脚本 | DORA 四指标可观测 |
| 状态自洽 | 2/10 | 文档与工具矛盾（本次铁证） | 状态由工具生成、文档只读派生 |

综合 **67/100（B-）**。短板集中在 CI/CD 与状态自洽，二者恰是"假绿灯"温床。

**DORA 四+一指标（当前缺失，建议补）**：部署频率 / 前置时间 / 变更失败率 / MTTR / 返工率（2024 新增第 5 指标，0–4%）。Elite 基准（2024/2025）：前置时间 <1 天、部署频率按需（每日多次）、变更失败率 0–5%、MTTR <1 小时；2025 起改百分位分布（Top 15% ≈ 原 Elite）。

### 5.1 标杆案例与参考来源锚点（二次检索时 re-pull，保持对标不陈旧）

> 2026-07-23 深度检索（5 组并行 WebSearch）沉淀。下次复检若行业实践有重大变化，按这些锚点重搜。

**可对照标杆项目**：
- **EpicReact**（工程化教科书）：GitHub Actions 全流水线 ESLint→tsc→Vitest（覆盖率 ≥92%）→Cypress E2E→Lighthouse(≥90)；Turborepo Monorepo；Husky+lint-staged；Conventional Commits；Docusaurus+TypeDoc 文档。→ 直接对标覆盖率门禁 / E2E / 性能门禁。
- **ModernReact**：状态分层（局部 useState/Context+useReducer，跨组件 Zustand/Jotai，服务端 React Query）；CI 含 E2E+依赖审计+语义化发布。→ 印证本项目 Zustand 选型，服务端状态层可参考。
- **IBM Carbon / Salesforce Lightning**：设计令牌单源（primitive→semantic→component）+ Figma↔React 1:1 + 令牌所有权人（design ops）防漂移 + 季度对齐。→ 印证本项目 L1–L6 + Figma 双向映射处行业上游。
- **Augment Cosmos / GitHub Spec Kit（2025）**：AI 多智能体（Coordinator/Specialist/Verifier）+ SDD 五阶段闸门（Constitution→Specify→Plan→Tasks→Implement），人工每阶段验证而非被动批准。→ 印证本项目技能注册表+记忆索引+飞轮+5 层路由+`finsight-health-audit` 技能处 2025 前沿。

**检索源分类（re-pull 关键词）**：
- DORA/DevOps：`DORA metrics elite performers 2024 2025`、`engineering productivity benchmarks 2026`
- 前端工程化：`exemplary large TypeScript React open source project architecture testing CI/CD`、`React main tech stack best practices 2025`
- 设计令牌：`design tokens single source of truth Salesforce Lightning IBM Carbon Style Dictionary`
- 代码健康：`code quality metrics cyclomatic complexity duplication bus factor 2025`（Codium/Qodo/Codacy/Kiuwan）
- AI-SDD：`spec-driven development AI coding agents 2025`、`GitHub Spec Kit`、`ICSE 2026 LLM code generation architectural documentation`

**行业趋势警示（写入结论）**：
- **AI Velocity Paradox**（DORA 2025 + Faros）：AI 提个体产出但组织吞吐持平；瓶颈从"写代码"移到"评审/验证/部署"。高 AI 团队 PR +98% 但评审时间 +91%。本项目 30+ 审计+技能路由是正确提前布局，但缺 CI 使"验证"仍靠人工，恰卡瓶颈。
- **ICSE 2026 实证**：提供架构文档使 LLM 生成在正确性/架构一致性/模块化↑；提供组织知识（API 约定/团队规范）使 AI 决策合规 +49%。

---

## 6. 教训库（可复用，二次开发前回看）

- **L1 铁律**：状态事实实时工具校验，记忆/文档仅作线索。本次文档双双失准即证。
- **L2 tsc 拓宽陷阱**：`import.meta.env.X || CONST` 会把字面量联合类型拓宽为 `string` →
  给消费它的对象常量加 `as DataSourceType` 或局部类型别名 + 常量注解。
- **L3 严格空检**：正则捕获组 `[1]` 用可选链 `?.`，不要裸取。
- **L4 文档失准**：治理文档（MEMORY.md / V9-DOC-KB-001）可能声称过期状态 → 每次复检后校准。
- **L5 自动化漂移**："声称注册 N 条" ≠ "真实注册 N 条"，`automation_update list` 为准。
- **L6 退出码掩盖**：`| tail` 吞退出码，门禁一律 `> /tmp/log 2>&1; echo EXIT=$?`。
- **L7 worker 崩溃**：全量 vitest / 重型 tsx 在受管 Node22 崩 → 分目录 + 系统 Node24。
- **L8 环境迁移**：DELL↔Huawei 用户目录硬编码静默失效（见 windows-env-path-doctor 技能）。
- **L9 测试漂移优先级**：复检失败用例先判"源码是否一致有意"——是则改测试（低成本、零风险），否才改源码；同一 service 的 `src/` 与 `tests/` 两份测试文件都要核对。

---

## 7. 交付物模板

生成 `outputs/dev-health-review-YYYY-MM-DD.md`：
```
# FinSightV9 开发进度/健康度复检 — YYYY-MM-DD
## 综合评分：X/100（字母）
## 三大核心发现（实时复验）
1. tsc:prod → EXIT=? / ? 错误（file:line 证据）
2. 自动化 → 真实 ? 条（automation_update list），文档称 ? 条
3. 测试 → 争议文件实跑 ? passed / ? failed
## 八维评分表
## 行业对标要点
## 建议优先项（P0/P1）
```
附评分雷达（用 visualization / chart 模块渲染 8 维雷达 SVG）。

---

## 8. 何时不需要本 SKILL

- 纯诊断已完成、用户只要分数 → 直接出报告即可，不必再修代码。
- 仅改单一测试文件 → 走 `tsc-test-error-diagnosis` 即可。
- 涉及 databridge/ACL 数据流 → 走 `data-flow-integrity-audit`（mandatory）。
