---
plan_version: v1.0.0
plan_date: 2026-08-19
code_version: 2.0.0-rc.1
spec_file: .trae/specs/pre-launch-sop-suite/spec.md
status: draft
---

# 任务队列：上线前 SOP 体系文档编写与注册

> **总览**：本任务队列将 spec.md 的 13 条 Rule AC + 4 条 Rubric AC 映射为 14 个原子任务。按「准备 → P0 SOP（S04/S05/S06） → P1 SOP（S01/S02/S03/S07） → 总览页 → 注册引用 → 自检验证」的依赖顺序排列。

---

## 任务优先级图例

| 标记 | 含义 | 说明 |
|------|------|------|
| 🔴 P0 | 阻断性 | 对应上线前必须完成的 SOP（S04/S05/S06），不完成无法进入 Review |
| 🟠 P1 | 重要 | 其余 SOP + 注册引用，完成后 SOP 体系闭环 |
| 🟡 P2 | 优化 | 总览页等增强项，缺失不影响核心使用 |

---

## Task 0：准备工作 — 创建目录 + 校验 doc_id 可用性 + 提取 package.json 命令清单

- **Status**：pending
- **Priority**：🟠 P1
- **Parent ACs**：R1, R3, R5, R13
- **Dependencies**：无（第一个任务）
- **Description**：
  1. 创建目录 `docs/guides/sops/`（如不存在）。
  2. 运行 `npm run audit:doc-id:json` 确认 `V9-DOC-SOP-001` 至 `V9-DOC-SOP-008`（含总览页）均未被占用；如有冲突，顺延为 `V9-DOC-SOP-011` 起并记录。
  3. 提取 `package.json` 中 scripts 的全部命令名（~200 条），存为临时参考文件（`temp/sop-command-reference.json`，不入库，仅编写 SOP 时校验使用）。
  4. 扫描 8 篇被引用的目标文档（FR-3 映射表）是否真实存在，读取其 frontmatter 版本号与 doc_id，写入参考清单。

- **Task-local Test Requirements (TRs)**：

| TR-ID | 类型 | 验证内容 | 通过条件 | 证据来源 |
|-------|------|---------|---------|---------|
| T0-R1 | rule | `docs/guides/sops/` 目录存在 | `Test-Path docs/guides/sops` → True | PowerShell / LS 输出 |
| T0-R2 | rule | 目标 doc_id 无冲突 | audit:doc-id 输出中不含 SOP 编号 | `npm run audit:doc-id:json` 输出片段 |
| T0-R3 | rule | package.json 命令清单生成 | JSON 文件中命令数 ≥ 180 条 | `wc -l` 或 `Object.keys().length` 输出 |
| T0-R4 | rule | 被引用的 8 篇文档均存在且 frontmatter 完整 | 8 篇路径全部命中 + version/doc_id 字段存在 | Grep 汇总表 |

---

## Task 1：编写 S05 — 上线前全面体检 SOP（P0 最高优先级）

- **Status**：pending
- **Priority**：🔴 P0
- **Parent ACs**：R2, R3, R8, R9, R10, R13, U1
- **Dependencies**：Task 0（准备）
- **Description**：
  编写 `docs/guides/sops/S05-pre-launch-checklist.md`，覆盖：
  1. **前置条件**：AkShare 服务已启动、前端构建环境就绪、测试数据准备。
  2. **操作步骤**（20+ 步，对齐 Husky 全量门禁 + 发布校验）：
     - Step 1-8：环境校验（env:check、密钥扫描 secrets、venv 健康）
     - Step 9-14：类型双检 + 核心门禁（tsc:prod、tsc:test、audit:layers、audit:atomic、audit:db-references、audit:acl-consistency）
     - Step 15-17：Mock 清扫 + 真数测试（audit:mock-modules、AkShare 启动校验、test:e2e-verify 25 股票）
     - Step 18：RAG 幻觉门禁（`npm run test:rag-gate`）
     - Step 19：复杂度不增（complexity-scan + baseline 比对）
     - Step 20：契约一致性（audit:agents-consistency --strict）
     - Step 21-22：全量文档审计（audit:docs + audit:doc-integrity + audit:doc-id-reverse）
     - Step 23：可信单元测试（test:stable）
     - Step 24：生产构建验证（build）
  3. **通过标准**：P0/P1/P2 分级表（≥ 10 项 P0）+ 6 维度加权评分模板。
  4. **常见失败与修复**：Top 5 失败（tsc:prod 幻影错误、层违规、硬编码 Critical、Mock 残留、RAG 幻觉检测不通过），对应引用 SKILL 修复路径。
  5. **证据与归档**：报告输出路径规范、综合评分表模板、Go/No-Go 会议纪要模板。
  6. **真数测试独立章节**（FR-5 强制）：明确禁止 MOCK、AkShare 启动命令、25+ 股票覆盖清单（沪深 10 + 港股 5 + 美股 5 + ETF 5）。
  7. **引用**：复用 `上线前全面校验报告-v2.0.0.md` 的评分维度与权重。

- **Task-local TRs**：

| TR-ID | 类型 | 验证内容 | 通过条件 | 证据来源 |
|-------|------|---------|---------|---------|
| T1-R1 | rule | 5 段式章节完整存在 | Grep 5 个章节标题全部命中 | 文件内 Grep 输出 |
| T1-R2 | rule | 所有 npm 命令均真实存在 | 提取 S05 中 `npm run <x>` / `npx <y>`，逐一在 package.json / node_modules/.bin 中验证 | 交叉校验脚本输出 0 缺失 |
| T1-R3 | rule | 真数测试章节存在且含 3 个强制关键词 | `禁止 MOCK` + `uvicorn collect_endpoints` + `25` 3 词均命中 | Grep 3 词 count ≥ 1 |
| T1-R4 | rule | P0 分级表包含 ≥ 10 个 P0 项 | 分级表格中 P0 行数 ≥ 10 | 手动计数 |
| T1-R5 | rule | 6 维度加权评分模板存在（权重和 = 100%） | 6 维度名匹配（文档/架构/数据链/UI/UX/测试），权重之和 = 100 | 手动校验表格 |
| T1-R6 | rule | frontmatter 版本号正确（code_version=2.0.0-rc.1, version=v1.0.0, doc_id=V9-DOC-SOP-005） | 3 字段值逐一匹配 | Grep 并比对 |
| T1-U1 | rubric | 步骤明确度 + 失败修复覆盖度 | 评分 ≥ 1.5 / 2.0 | Reviewer 评分表 |

---

## Task 2：编写 S04 — 合并前集成测试 SOP

- **Status**：pending
- **Priority**：🔴 P0
- **Parent ACs**：R2, R3, R13, U1, U3
- **Dependencies**：Task 0
- **Description**：
  编写 `docs/guides/sops/S04-pre-merge-integration.md`，覆盖：
  1. **前置条件**：PR 已通过 lint-staged、个人开发分支已更新到 main 最新、无冲突。
  2. **操作步骤**：
     - Step 1：Gate:quick（7 项审计）+ 输出解读
     - Step 2：Widget 注册完整性（audit:widget-registry）+ 四层注册表回归
     - Step 3：可信单元测试（test:stable），解读 quarantine 的含义与处理方式
     - Step 4：类型双检（tsc:prod 必 BLOCK，tsc:test 仅 WARN）
     - Step 5：复杂度扫描（复杂度不增原则）
     - Step 6：生产构建烟雾验证（build 成功 + 产物大小检查）
     - Step 7：统一量化质量聚合报告（gate:aggregate）
     - Step 8：集成测试套件（test:integration 或 test:databridge 子集）
  3. **通过标准**：Gate:quick 0 BLOCK + test:stable 通过率 ≥ 99% + build 成功。
  4. **常见失败与修复**：Top 5（层违规修复指南、Mock 残留清扫命令、tsc:prod 幻影错误 tsc --force、Widget 漏登修复路径、复杂度超基线）。
  5. **证据与归档**：PR 评论区粘贴模板（各门禁结果链接、测试报告附件）。
  6. **引用**：`how-to-use-audit-scripts.md` 各命令详解链接。

- **Task-local TRs**：

| TR-ID | 类型 | 验证内容 | 通过条件 | 证据来源 |
|-------|------|---------|---------|---------|
| T2-R1 | rule | 5 段式章节完整 | Grep 5 章节标题命中 | 文件 Grep |
| T2-R2 | rule | 引用的 npm 命令均真实存在 | 命令交叉校验 0 缺失 | 校验脚本输出 |
| T2-R3 | rule | frontmatter doc_id=V9-DOC-SOP-004 + 版本号正确 | 3 字段匹配 | Grep 比对 |
| T2-U1 | rubric | 步骤明确度 + 失败修复覆盖度 | 评分 ≥ 1.5 | Reviewer 评分 |

---

## Task 3：编写 S06 — 版本发布与部署 SOP

- **Status**：pending
- **Priority**：🔴 P0
- **Parent ACs**：R2, R3, R13, U3
- **Dependencies**：Task 0, Task 1（引用 S05 综合评分结论作为前置）
- **Description**：
  编写 `docs/guides/sops/S06-release-deployment.md`，覆盖：
  1. **前置条件**：S05 上线体检综合评分 ≥ 80 分、所有 P0 项 BLOCK 0、Go/No-Go 会议已审批、CHANGELOG 草稿已准备。
  2. **操作步骤**：
     - Step 1：版本号规则说明（SemVer：MAJOR.MINOR.PATCH，当前 2.0.0-rc.1 → 2.0.0 的特例处理）
     - Step 2：CHANGELOG 生成与校对（`npm run release:changelog-bump` + 人工增补 Breaking Changes）
     - Step 3：Git Tag 规范（`vX.Y.Z`，annotated tag，签名要求）
     - Step 4：生产构建（Web + Electron 双端：`npm run build` + Electron 打包校验 `dist-electron/`）
     - Step 5：构建产物校验（文件大小、哈希值、关键资源存在性）
     - Step 6：Windows 部署清单（引用 DEPLOYMENT-CHECKLIST 模板）
     - Step 7：回滚预案演练（git revert、patch 回滚、db migration 回滚三条路径）
     - Step 8：发布后冒烟（首页加载、5 舱路由、真数数据采集各 1 次）
  3. **通过标准**：Tag 推送成功 + 双端构建产物生成 + 回滚演练 3 条路径均 exit 0。
  4. **常见失败与修复**：Top 5（Electron 打包 UPX 问题、npm 发布权限、Git Tag 冲突、构建 OOM、回滚 migration 失败）。
  5. **证据与归档**：发布公告模板、Tag 校验日志、构建哈希清单。
  6. **引用**：`DEPLOYMENT-CHECKLIST-2026-08-14.md` 作为专项检查附录模式示例。

- **Task-local TRs**：

| TR-ID | 类型 | 验证内容 | 通过条件 | 证据来源 |
|-------|------|---------|---------|---------|
| T3-R1 | rule | 5 段式章节完整 | Grep 5 章节标题命中 | 文件 Grep |
| T3-R2 | rule | 命令校验 0 缺失 | package.json 交叉匹配 | 校验脚本 |
| T3-R3 | rule | 包含 Electron 构建章节（dist-electron + upx 提及） | `dist-electron` 与 `upx` 关键词命中 | Grep count ≥ 1 |
| T3-R4 | rule | 包含 3 条回滚路径（git revert / patch / migration） | 3 种路径关键词均命中 | Grep 3 词 count ≥ 1 |
| T3-R5 | rule | frontmatter doc_id=V9-DOC-SOP-006 + 版本正确 | 3 字段匹配 | Grep 比对 |
| T3-U1 | rubric | 步骤明确度 + 失败修复 | ≥ 1.5 | Reviewer 评分 |

---

## Task 4：编写 S02 — 日常开发与代码提交 SOP

- **Status**：pending
- **Priority**：🟠 P1
- **Parent ACs**：R2, R3, R13, U1, U2
- **Dependencies**：Task 0
- **Description**：
  编写 `docs/guides/sops/S02-daily-development.md`，覆盖：
  1. **前置条件**：环境已通过 S01 验证、分支已创建。
  2. **操作步骤**：
     - Step 1：分支策略（feat/xxx、fix/xxx、docs/xxx、chore/xxx 命名 + 从 main checkout）
     - Step 2：模块开发 Checklist（引用 module-completion-standard 的 DoD 6 要素）
     - Step 3：十域同步清单（引用 module-sync-checklist SKILL：类型/消费者/测试/Mock/监控/注册表/文档/配置/Store/记忆）
     - Step 4：提交前预检 Gate:dev（逐项展开 6 个子步）
     - Step 5：Git 提交规范（引用 git-commit-governance：Conventional Commits 格式、作用域守卫 v2 规则、`git commit --only` 防夹带实操示例）
     - Step 6：pre-commit 门禁通过验证（22 步 + 解读各 BLOCK/WARN 级别）
  3. **通过标准**：pre-commit 22 步全绿、无 WARN 级 hardcode Critical/Major。
  4. **常见失败与修复**：Top 5（提交文件数超限、跨层混合提交、tsc:prod 幻影错误、ESLint auto-fix 副作用、文档 doc-id 违规）
  5. **证据与归档**：规范的 commit message 示例、staged 文件数核对截图模板。
  6. **引用**：`git-commit-governance.md`（提交规范守卫）、`module-completion-standard.md`（DoD）、`how-to-use-audit-scripts.md §命令1 gate:dev`。

- **Task-local TRs**：

| TR-ID | 类型 | 验证内容 | 通过条件 | 证据来源 |
|-------|------|---------|---------|---------|
| T4-R1 | rule | 5 段式章节完整 | Grep 5 章节命中 | 文件 Grep |
| T4-R2 | rule | 命令均存在 | 交叉校验 0 缺失 | 校验脚本 |
| T4-R3 | rule | 十域同步清单列出 10 个域名 | 10 域名称（类型/消费者/测试/Mock/监控/注册表/文档/配置/Store/记忆）全部命中 | Grep 10 词 count ≥ 10 |
| T4-R4 | rule | `git commit --only` 有实操示例 | 代码块中出现 `git commit --only` + 具体路径示例 | Grep 代码块 |
| T4-R5 | rule | frontmatter doc_id=V9-DOC-SOP-002 + 版本正确 | 3 字段匹配 | Grep 比对 |
| T4-U1 | rubric | 步骤明确度 + 失败修复 | ≥ 1.5 | Reviewer 评分 |
| T4-U2 | rubric | 新成员首次提交无障碍度贡献分 | S02 部分评分 ≥ 1.5，计入 S01-S03 综合 | Reviewer 评分 |

---

## Task 5：编写 S01 — 开发环境搭建与准备 SOP

- **Status**：pending
- **Priority**：🟠 P1
- **Parent ACs**：R2, R3, R13, U1, U2
- **Dependencies**：Task 0
- **Description**：
  编写 `docs/guides/sops/S01-dev-env-setup.md`，覆盖：
  1. **前置条件**：Windows 10+ / macOS 12+、管理员权限、Git 客户端、Node.js 推荐版本（从 .nvmrc 读取）。
  2. **操作步骤**：
     - Step 1：Node 版本安装与校验（nvm 安装 / 直接安装 Node 24，`node -v`、`npm -v` 校验）
     - Step 2：仓库克隆与分支设置（Git 配置用户名邮箱、LF 行尾、SSH key）
     - Step 3：npm 依赖安装（`npm ci` 优先，fallback `npm install`，处理常见的 node-gyp / native 模块编译失败）
     - Step 4：Python 虚拟环境 + AkShare 安装（venv 创建、requirements.txt 安装、uvicorn 可用性校验）—— 双平台命令
     - Step 5：Vite 代理配置说明（.env.example 复制为 .env.local，VITE_DATA_SOURCE_TYPE=real/mock 切换说明）
     - Step 6：Husky 钩子安装（`npm run prepare` / `npx husky` 校验 .husky/pre-commit 可执行）
     - Step 7：首次环境全量验证（`npm run gate:dev` + `npm run build` 双通）
  3. **通过标准**：`npm run gate:dev` 退出码 0、`npm run build` 成功、前端页面加载正常。
  4. **常见失败与修复**：Top 5（Node 版本不兼容、npm install network 超时、Python venv 路径中文、Husky 钩子无执行权限、Vite 端口占用）。
  5. **证据与归档**：首次验证的 gate:dev 输出截图、构建成功日志保存路径。
  6. **引用**：`docs/guides/tutorials/getting-started.md`（已有入门文档链接，S01 补充 AkShare / Husky / 真数环境部分）。

- **Task-local TRs**：

| TR-ID | 类型 | 验证内容 | 通过条件 | 证据来源 |
|-------|------|---------|---------|---------|
| T5-R1 | rule | 5 段式章节完整 | Grep 5 章节命中 | 文件 Grep |
| T5-R2 | rule | 命令均存在 | 交叉校验 0 缺失 | 校验脚本 |
| T5-R3 | rule | 双平台命令（Windows + macOS）均出现 | `PowerShell`/`cmd` 与 `brew`/`bash` 关键词出现 ≥ 1 组 | Grep 计数 |
| T5-R4 | rule | 包含 Python venv + AkShare（uvicorn）安装与启动命令 | `venv` + `uvicorn` + `AkShare` 三词均命中 | Grep 3 词 |
| T5-R5 | rule | frontmatter doc_id=V9-DOC-SOP-001 + 版本正确 | 3 字段匹配 | Grep 比对 |
| T5-U1 | rubric | 步骤明确度 + 失败修复 | ≥ 1.5 | Reviewer 评分 |
| T5-U2 | rubric | 新成员环境搭建无障碍度贡献分 | S01 部分评分 ≥ 1.5，计入综合 | Reviewer 评分 |

---

## Task 6：编写 S03 — 代码审查 SOP

- **Status**：pending
- **Priority**：🟠 P1
- **Parent ACs**：R2, R3, R13, U1, U2, U3
- **Dependencies**：Task 0, Task 4（引用 S02 的提交卫生要求作为 CR 前置）
- **Description**：
  编写 `docs/guides/sops/S03-code-review.md`，覆盖：
  1. **前置条件**：Author 已通过 S04 集成测试自检、PR 描述完整（问题/方案/测试证据）、无合并冲突。
  2. **操作步骤**：
     - Step 1：Reviewer 角色分工（Architect 审架构 / Senior 审质量 / Junior 审细节）
     - Step 2：架构审查 Checklist（层调用合规、DataBridge 信封使用、ACL 正确、循环依赖）
     - Step 3：安全审查 Checklist（XSS、注入、敏感数据、密钥暴露、权限越权）
     - Step 4：质量审查 Checklist（测试覆盖、硬编码、JSDoc、复杂度、命名规范）
     - Step 5：严重度分级（Blocker / Critical / Major / Minor / Nitpick 五级定义与处理 SLA）
     - Step 6：不合格 PR 评论模板（结构化、带证据、不情绪化）
     - Step 7：Approve 条件（所有 Blocker/Critical 修复、至少 1 个 Senior Approve）
  3. **通过标准**：PR 至少 1 个 Approve + 0 unresolved Blocker/Critical comment。
  4. **常见失败与修复**：Top 5（跨层调用违规修复指引、DataBridge ACL 配置错误、测试不足补充指引、命名规范修正、JSDoc 补充模板）。
  5. **证据与归档**：PR Review 评论模板、CR 结论记录（通过/退回/需修改）规范。
  6. **引用**：`docs/guides/CODE-REVIEW.md`、`git-commit-governance.md`。

- **Task-local TRs**：

| TR-ID | 类型 | 验证内容 | 通过条件 | 证据来源 |
|-------|------|---------|---------|---------|
| T6-R1 | rule | 5 段式章节完整 | Grep 5 章节命中 | 文件 Grep |
| T6-R2 | rule | 命令校验（如有引用命令）0 缺失 | 交叉匹配 | 校验脚本 |
| T6-R3 | rule | 严重度分级包含 5 级定义 | Blocker / Critical / Major / Minor / Nitpick 5 词均命中 | Grep 5 词 |
| T6-R4 | rule | 架构/安全/质量三维各有 ≥ 5 条检查项 | 每维度 ≥ 5 个 checklist 条目 | 手动计数 |
| T6-R5 | rule | frontmatter doc_id=V9-DOC-SOP-003 + 版本正确 | 3 字段匹配 | Grep 比对 |
| T6-U1 | rubric | 步骤明确度 + 失败修复 | ≥ 1.5 | Reviewer 评分 |
| T6-U2 | rubric | 新成员首次提交 CR 无障碍度 | S03 部分评分 ≥ 1.5 | Reviewer 评分 |

---

## Task 7：编写 S07 — 上线后运维与应急响应 SOP

- **Status**：pending
- **Priority**：🟠 P1
- **Parent ACs**：R2, R3, R13, U1, U3
- **Dependencies**：Task 0, Task 3（引用 S06 回滚预案作为应急分支）
- **Description**：
  编写 `docs/guides/sops/S07-post-launch-ops.md`，覆盖：
  1. **前置条件**：版本已成功发布、监控告警通道已配置、值班人员已通知。
  2. **操作步骤**：
     - Step 1：发布后 30 分钟健康监控（system:health + 关键指标：首屏加载、数据采集成功率、错误率）
     - Step 2：告警分级响应 SLA（P0 Incident < 5min 响应、P1 < 15min、P2 < 1h）
     - Step 3：常规问题排查路径（引用 how-to-troubleshooting.md 的索引：前端 / 后端 / 数据 / MCP 通道 / IndexedDB）
     - Step 4：用户反馈闭环流程（Issue 分类 → 复现 → 修复优先级 → Hotfix / 常规修复）
     - Step 5：热修复流程（hotfix/xxx 分支创建 → 最小改动修复 → 紧急 CR → S06 快速发布路径）
     - Step 6：每日文档健康度提醒（`npm run daily-doc:validate`）与月度/季度审计调度
     - Step 7：事故复盘报告模板（时间线、根因、修复措施、预防改进 5 段式）
  3. **通过标准**：发布后 24h 监控无 P0 告警、用户反馈 P0 Issues ≤ 0。
  4. **常见失败与修复**：Top 5（真数接口超时降级、IndexedDB 版本迁移失败、MCP Server 通道异常、UI 渲染崩溃定位、Electron 启动白屏）。
  5. **证据与归档**：监控 Dashboard 截图保存、Incident 报告归档规范。
  6. **引用**：`how-to-troubleshooting.md`、`how-to-troubleshooting-deploy-checklist.md`。

- **Task-local TRs**：

| TR-ID | 类型 | 验证内容 | 通过条件 | 证据来源 |
|-------|------|---------|---------|---------|
| T7-R1 | rule | 5 段式章节完整 | Grep 5 章节命中 | 文件 Grep |
| T7-R2 | rule | 命令校验 0 缺失 | 交叉匹配 | 校验脚本 |
| T7-R3 | rule | 包含 3 级告警 SLA（P0/P1/P2 响应时间） | 三词 + 时间阈值（5min/15min/1h）均出现 | Grep 组合命中 |
| T7-R4 | rule | 包含热修复分支策略（hotfix/xxx 命名） | `hotfix/` 关键词 + 步骤说明 | Grep 命中 |
| T7-R5 | rule | frontmatter doc_id=V9-DOC-SOP-007 + 版本正确 | 3 字段匹配 | Grep 比对 |
| T7-U1 | rubric | 步骤明确度 + 失败修复 | ≥ 1.5 | Reviewer 评分 |

---

## Task 8：编写 SOP 总览页（README.md / S00-sop-overview）

- **Status**：pending
- **Priority**：🟡 P2
- **Parent ACs**：R1, U3, U4
- **Dependencies**：Task 1-7 全部完成（需汇总 7 篇 SOP 信息）
- **Description**：
  编写 `docs/guides/sops/README.md`，作为 SOP 体系总览入口。内容：
  1. SDLC 7 阶段流程图（ASCII）+ 每阶段名称、SOP 编号、输入、输出、负责人的汇总表格。
  2. 快速跳转链接（S01→S07 顺序链接）。
  3. 「我现在需要做什么？」决策树：按场景（新员工/开发功能/准备上线/出问题了）四分支跳转对应 SOP。
  4. SOP 版本与兼容性声明（当前版本 v1.0.0，兼容 AGENTS.md v1.6.0，code_version 2.0.0-rc.1）。
  5. SOP 变更记录模板（后续版本迭代在此登记）。
  6. Frontmatter：doc_id=V9-DOC-SOP-000（总览页编号）。

- **Task-local TRs**：

| TR-ID | 类型 | 验证内容 | 通过条件 | 证据来源 |
|-------|------|---------|---------|---------|
| T8-R1 | rule | 总览页存在且列出 7 篇 SOP 链接 | 7 个相对路径全部可点击（文件存在） | Grep + 文件校验 |
| T8-R2 | rule | 决策树 4 场景均有跳转链接 | 新员工/开发功能/准备上线/出问题 四分支有链接 | Grep 4 场景词 |
| T8-R3 | rule | frontmatter doc_id=V9-DOC-SOP-000 + 版本正确 | 3 字段匹配 | Grep 比对 |
| T8-U3 | rubric | 7 阶段闭环完整性（总览页视角） | 评分 ≥ 2.0（流程图 + 输入输出链完整） | Reviewer 评分 |
| T8-U4 | rubric | 文档专业性与结构清晰度 | ≥ 1.5 | Reviewer 评分 |

---

## Task 9：REGISTRY_INDEX 注册 — 8 篇 SOP doc_id 全量登记

- **Status**：pending
- **Priority**：🟠 P1
- **Parent ACs**：R5, R11, FR-4.1
- **Dependencies**：Task 0-8 全部完成（需 8 篇 SOP 的真实 doc_id、标题、路径）
- **Description**：
  1. 打开 `docs/meta/REGISTRY_INDEX.md`，找到合适的插入位置（建议「标准操作流程」分类，如无则新建该分类 section）。
  2. 按 `doc_id / title / path / version / summary / tier / status` 的统一格式插入 8 行登记。
  3. 确保与其他条目的字段格式严格一致（表格对齐、无缺失字段）。
  4. 运行 `npm run audit:doc-id-reverse --changed-only` 验证无 blocking 违规。

- **Task-local TRs**：

| TR-ID | 类型 | 验证内容 | 通过条件 | 证据来源 |
|-------|------|---------|---------|---------|
| T9-R1 | rule | 8 篇 SOP 均出现在 REGISTRY_INDEX 中 | Grep 8 个 doc_id（SOP-000 ~ SOP-007）count = 8 | Grep 计数 |
| T9-R2 | rule | audit:doc-id 无 blocking 违规 | 命令退出码 0 且无「missing-file」级告警 | 命令输出截图/日志 |
| T9-R3 | rule | 每行格式包含 7 个标准字段 | 8 行均含 doc_id/title/path/version/summary/tier/status | 手动核对表格 |

---

## Task 10：AGENTS.md 追加 §十七 SOP 体系索引章节

- **Status**：pending
- **Priority**：🟠 P1
- **Parent ACs**：R6, FR-4.2
- **Dependencies**：Task 0-8（需 8 篇 SOP 的路径和标题）
- **Description**：
  1. 打开 `AGENTS.md`，在「§十六 Bash 使用约定」之后插入新章节「§十七 SOP 体系索引」。
  2. 新章节包含：(a) SOP 体系说明（一句话）；(b) 7 + 1 篇 SOP 的「编号 · 标题 · 相对路径 · 一句话用途」汇总表。
  3. 不修改 AGENTS.md 的其他内容（特别是版本号、change_log、原有章节序号）。
  4. 注意：AGENTS.md 修改会触发 pre-commit 的 `audit:agents-consistency --changed` BLOCK 门禁，因此仅追加新章节文字，不改动任何现有契约定义（DB_VERSION、MCP 条目、Store 数等）。

- **Task-local TRs**：

| TR-ID | 类型 | 验证内容 | 通过条件 | 证据来源 |
|-------|------|---------|---------|---------|
| T10-R1 | rule | AGENTS.md 存在「§十七 SOP 体系索引」章节标题 | Grep 章节标题命中 | Grep 输出 |
| T10-R2 | rule | 列出 8 篇 SOP 的完整相对路径 | 8 个路径均为真实存在的文件 | Grep + 文件校验 |
| T10-R3 | rule | audit:agents-consistency --changed 通过（无 BLOCK 漂移） | 命令退出码 0 | 命令输出 |
| T10-R4 | rule | 原有 §一 ~ §十六章节未被修改 | git diff AGENTS.md 仅显示新增内容，无删除/修改旧章节行 | git diff 片段 |

---

## Task 11：docs/guides/how-to/README.md 新增「SOP 体系」索引块

- **Status**：pending
- **Priority**：🟠 P1
- **Parent ACs**：R7, FR-4.3
- **Dependencies**：Task 0-8
- **Description**：
  1. 打开 `docs/guides/how-to/README.md`，在合适位置（现有索引块之后）新增「## SOP 体系 · 按开发阶段索引」子块。
  2. 子块包含 7 阶段链接 + 总览页链接，按时间线排序（S01→S07→总览）。
  3. 每个链接附带一句话用途说明。

- **Task-local TRs**：

| TR-ID | 类型 | 验证内容 | 通过条件 | 证据来源 |
|-------|------|---------|---------|---------|
| T11-R1 | rule | README.md 存在「SOP 体系」块标题 | Grep 「SOP 体系」命中 | Grep 输出 |
| T11-R2 | rule | 8 篇 SOP 链接均在块中列出 | 8 个链接存在且路径正确 | Grep 计数 + 文件校验 |

---

## Task 12：docs/meta/README.md 登记 SOP 分类

- **Status**：pending
- **Priority**：🟠 P1
- **Parent ACs**：FR-4.4, R11
- **Dependencies**：Task 0-8
- **Description**：
  1. 打开 `docs/meta/README.md`，找到 Meta 索引的标准操作流程分类（如无则在合适位置新建该分类）。
  2. 登记 8 篇 SOP，格式与现有分类保持一致。
  3. 运行 `npm run audit:docs` 确认无 SOP 相关 inconsistency。

- **Task-local TRs**：

| TR-ID | 类型 | 验证内容 | 通过条件 | 证据来源 |
|-------|------|---------|---------|---------|
| T12-R1 | rule | meta/README.md 包含 SOP 分类与 8 篇文档登记 | Grep「标准操作流程」或 SOP 关键词 + 8 个 doc_id 命中 | Grep 输出 |
| T12-R2 | rule | audit:docs 无 SOP 相关告警 | 命令输出中不包含任何 SOP 文档路径 | 命令日志筛选 |

---

## Task 13：自检验证 — 命令引用完整性 + Rule AC 全量核对

- **Status**：pending
- **Priority**：🔴 P0
- **Parent ACs**：R3, R4, R11, R12, R13, C1
- **Dependencies**：Task 1-12 全部完成
- **Description**：
  1. 编写并运行一次性 Node 验证脚本（不入库，临时文件 `temp/verify-sop-commands.cjs`）：
     - 遍历 `docs/guides/sops/*.md` 8 篇文档
     - 用正则提取所有 `npm run <x>` / `npx <y>` / `node scripts/<z>` 调用
     - 逐一验证命令在 package.json 或 node_modules/.bin/ 或实际文件路径中存在
     - 输出缺失命令报告
  2. 运行 `npm run audit:docs` + `npm run audit:doc-id-reverse --changed-only`，全量验证 SOP 文档的引用与注册。
  3. 运行 `git diff --name-only` 验证约束 C1：无 src/tests/scripts 代码文件改动（仅 docs/ 与 AGENTS.md 的文档变动）。
  4. 逐一手动核对 13 条 Rule AC（R1-R13）的通过状态，生成 Checklist 表格。
  5. 将验证结论写入每个任务的 Completion Evidence。

- **Task-local TRs**：

| TR-ID | 类型 | 验证内容 | 通过条件 | 证据来源 |
|-------|------|---------|---------|---------|
| T13-R1 | rule | SOP 引用命令 0 缺失 | 验证脚本输出「Missing commands: 0」 | 脚本输出日志 |
| T13-R2 | rule | audit:docs + audit:doc-id 均 0 BLOCK | 两条命令退出码均为 0 | 命令日志 |
| T13-R3 | rule | 约束 C1 合规：改动文件仅限 docs/guides/sops/* + 3 个索引文件 + AGENTS.md | `git diff --name-only` 过滤后无 src/tests/scripts/* 文件 | git diff 列表 |
| T13-R4 | rule | 13 条 Rule AC 至少 12 条通过（≥ 92%） | R1-R13 Checklist 中 Pass ≥ 12 | 手动核对表 |
| T13-R5 | rule | 7 篇 SOP frontmatter 的 code_version 字段全部=2.0.0-rc.1、version=v1.0.0 | 14 次 Grep 全部匹配 | Grep 汇总表 |

---

## 任务依赖图（Dependency Graph）

```
Task 0 (准备)
├──> Task 1 (S05 上线体检 P0) ──┐
├──> Task 2 (S04 集成测试 P0) ───┤
├──> Task 3 (S06 发布部署 P0) ───┤
├──> Task 4 (S02 日常开发 P1) ───┤
├──> Task 5 (S01 环境搭建 P1) ───┼──> Task 8 (总览页 P2) ──┐
├──> Task 6 (S03 代码审查 P1) ───┤                         ├──> Task 9 (REGISTRY注册)
└──> Task 7 (S07 运维应急 P1) ───┘                         ├──> Task 10 (AGENTS追加)
                                                           ├──> Task 11 (how-to README)
                                                           ├──> Task 12 (meta README)
                                                           └──> Task 13 (自检验证 P0)
```

**并行组**：
- **并行组 A（P0 SOP）**：Task 1 / Task 2 / Task 3 可并行编写（相互无依赖，只依赖 Task 0）。
- **并行组 B（P1 SOP）**：Task 4 / Task 5 / Task 6 / Task 7 可并行编写。
- **串行组**：Task 8-13 必须等 A + B 全部完成后顺序执行。

---

## Plan 完成声明

本 tasks.md 已将 spec.md 的 13 条 Rule AC 和 4 条 Rubric AC 全部映射到 14 个任务的 Task-local TR 中。每个 TR 均为 rule 或 rubric 类型，具备明确的通过条件与证据来源。优先级按 P0（上线前必须）→ P1（体系完整）→ P2（体验增强）分配。

**Rule AC 覆盖率矩阵（任务级）**：

| AC 编号 | 对应任务（至少 1 个 TR 覆盖） |
|--------|--------------------------|
| R1 (目录) | Task 0 (T0-R1) + Task 8 (T8-R1) |
| R2 (5段式) | Task 1-7 (每任务 T?-R1) |
| R3 (命令真实) | Task 0 (T0-R3) + Task 1-7 (每任务 T?-R2) + Task 13 (T13-R1) |
| R4 (文档链接) | Task 0 (T0-R4) + Task 13 (T13-R2) |
| R5 (doc_id无冲突) | Task 0 (T0-R2) + Task 9 (T9-R2) |
| R6 (AGENTS §十七) | Task 10 (T10-R1, T10-R2, T10-R3) |
| R7 (how-to README) | Task 11 (T11-R1, T11-R2) |
| R8 (真数测试章节) | Task 1 (T1-R3) |
| R9 (分级 ≥10 P0) | Task 1 (T1-R4) |
| R10 (6维评分模板) | Task 1 (T1-R5) |
| R11 (audit:docs通过) | Task 12 (T12-R2) + Task 13 (T13-R2) |
| R12 (C1:无代码改动) | Task 13 (T13-R3) |
| R13 (版本号一致) | Task 1-7 (每任务 T?-R6/5/3) + Task 13 (T13-R5) |

**Rubric AC 映射**：

| AC 编号 | 评分维度 | 评分任务 |
|--------|---------|---------|
| U1 (NFR2) | SOP 步骤明确度+失败修复 | Reviewer 在每个任务的 T?-U1 分项评分后取平均 |
| U2 (NFR6) | 新成员首次提交无障碍度 | Task 5 (S01) + Task 4 (S02) + Task 6 (S03) 的 T?-U2 综合 |
| U3 (Coverage) | 7 阶段闭环完整性 | Task 8 (T8-U3) + 各任务交叉引用一致性（Review 总评） |
| U4 (DocQuality) | 文档专业性与结构清晰度 | Task 8 (T8-U4) + 其余 7 篇的 Reviewer 主观评分平均 |
