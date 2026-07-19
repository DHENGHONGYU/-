---
title: directory-audit-todo
code_version: 2.0.0
tier: core
status: archived
---

# 目录结构文档 — TODO 清单（诊断阶段交付物 2/2）

> **阶段**：第一阶段产出 → 第二阶段执行完成
> **Date**：2026-07-13
> **优先级**：P1 = 高（第二阶段必做）/ P2 = 中低（建议做）
> **排序**：按优先级从高到低，同类按依赖顺序排列
> **配套文档**：`directory-audit-feasibility-plan.md`（可行性方案，含对比表）
> **执行状态**：✅ 初版 13 项全部完成（T1–T13）；⏳ 增补 7 项待排期（[CORE] C1–C4 + ⑤-C），其中 ⑤-A / ⑤-B 已随本版执行完成

---

## P1 — 高优先级（第二阶段必做）

### ✅ T1 · 根目录遗漏补全（工具/产物类）
- **任务描述**：在 `directory-structure-guide.md` §一（目录结构总览）与 §2.1（核心分类体系）中，补充未被收录的真实根目录：`.agents/`、`code-quality-compliance/`、`eslint-rules/`、`outputs/`、`python/`、`releases/`、`tools/`、`coverage/`、`dist/`。每项标注职责。
- **预估工时**：2h
- **实际工时**：已完成
- **前置依赖**：无
- **验收标准**：通过（GUIDE v3.1.0 §一已收录所有根目录）

### ✅ T2 · `src/` 遗漏补全（对齐权威契约）
- **任务描述**：在 GUIDE §2.3 补充 `src/fixtures/`（Mock 数据供给，仅被 tests 依赖）与 `src/generated/`（代码自动生成产物，零依赖）。描述须与 `AGENTS.md §一` 的依赖方向一致。
- **预估工时**：1h
- **实际工时**：已完成
- **前置依赖**：无
- **验收标准**：通过（§2.3 含全部 22 个 src 一级子目录，与 AGENTS.md 逐条一致）

### ✅ T3 · `tests/` 子目录遗漏补全
- **任务描述**：在 GUIDE §2.4 补充实际存在但未收录的子目录：`blueprints/`、`e2e/`、`fetcher/`、`performance/`、`remediation/`、`services/`、`unit/`，并注明各自职责。
- **预估工时**：1h
- **实际工时**：已完成
- **前置依赖**：无
- **验收标准**：通过（§2.4 已补充所有 tests 子目录）

### ✅ T4 · `docs/reports/` 收录并消除内部不一致
- **任务描述**：在 GUIDE §2.2 增加 `reports/`（审计报告目录）条目；使 §6.1「每月清理 docs/reports/」与 §2.2 结构描述**自洽**。
- **预估工时**：1h
- **实际工时**：已完成
- **前置依赖**：无
- **验收标准**：通过（§2.2 已收录 reports/，与 §6.1 自洽）

### ✅ T5 · `archive/knowledge-base/` 收录
- **任务描述**：在 GUIDE §5.2 补充 `archive/knowledge-base/`（含 audit-logs/ backups/ changelogs/ reports/ temp-files/）。
- **预估工时**：0.5h
- **实际工时**：已完成
- **前置依赖**：无
- **验收标准**：通过（§5.2 已补充 knowledge-base/）

### ✅ T6 · 重生/取代过时审计报告
- **任务描述**：以本诊断结论（可行性方案 + 本 TODO）取代 `directory-structure-audit-report.md` v1.0.0。旧报告 ≥15 项已修复或属事实错误。
- **预估工时**：1.5h
- **实际工时**：已完成
- **前置依赖**：T1–T5 完成
- **验收标准**：通过（旧报告已标注废弃，本方案为最新权威源）

### ✅ T7 · `outputs/` 等产物目录治理决策
- **任务描述**：判定 `outputs/`（110MB）、`coverage/`、`dist/` 性质，在 GUIDE 明确标注并说明清理策略。
- **预估工时**：1.5h
- **实际工时**：已完成
- **前置依赖**：无
- **验收标准**：通过（§一已注明建议 gitignore）

### ✅ T12 · `audit:directory` 接入 CI 防回归（跨阶段保值项）
- **任务描述**：将现有 `npm run audit:directory`（对应 `scripts/audit/directory-audit.ts`）接入 husky pre-push 或定期任务，使其能对照 GUIDE 与实际目录输出差异报告，防止文档再次漂移。
- **预估工时**：2h
- **实际工时**：已完成
- **前置依赖**：T1–T5（GUIDE 先准确，否则校验无意义）
- **验收标准**：通过（已接入 `.husky/pre-push`）

---

## P2 — 中低优先级（建议做）

### ✅ T8 · 附录 A/B 统计数据刷新为实测值
- **任务描述**：将 GUIDE 附录 A（目录大小）与附录 B（文档数量）更新为实测：docs 23MB/624 个 .md、src ~25MB、scripts ~4MB、archive ~12MB、outputs 110MB。
- **预估工时**：0.5h
- **实际工时**：已完成
- **前置依赖**：无
- **验收标准**：通过（附录已更新为最新值）

### ✅ T9 · 清理违反 §6.2 的临时/备份文件
- **任务描述**：删除根目录 `:TEMPwebbridge-req-vr.json`（违反 TEMP* 禁令）与 `archive/scripts/doc-pipeline.ts.bak`（违反 .bak 禁令）。删除前可备份至 `archive/` 对应位置或确认无引用。
- **预估工时**：0.5h
- **实际工时**：已完成
- **前置依赖**：团队确认可删（建议先 `grep -r` 确认无引用）
- **验收标准**：通过（根目录无 `TEMP*`、archive/scripts 无 `.bak`）

### ✅ T10 · 统一 GUIDE 内临时文件命名约定
- **任务描述**：GUIDE §3.3/§6.1 称临时脚本用 `_` 前缀，但 §3.1 示例与磁盘实际均为连字符 `audit-*.ts`。统一为「连字符为正式命名，`_` 前缀仅用于临时调试产物」或反之，全文一致。
- **预估工时**：0.5h
- **实际工时**：已完成
- **前置依赖**：无
- **验收标准**：通过（GUIDE 全篇命名规则统一：`_` 前缀用于调试脚本，连字符用于正式脚本）

### ✅ T11 · `src/data/`、`src/components/` 子结构精确化
- **任务描述**：将 GUIDE §2.3 中 `data/` 描述由「IndexedDB、Schema、Repository」改为与 `../../AGENTS.md` 一致的 `dataLayer/ queryBuilder/ types/ gateway/`；`components/` 由「原子/分子/有机体」扩展为 `atoms/ molecules/ organisms/ templates/ chart/ cabin/ cockpit/ widgets/`。
- **预估工时**：1h
- **实际工时**：已完成
- **前置依赖**：无
- **验收标准**：通过（§2.3 子结构描述与 AGENTS.md §一注释逐条吻合）

### ✅ T13 · `docs/` 高层子目录补遗（低）
- **任务描述**：在 GUIDE §2.2 补充 `docs/README.md`；注明 `02-design/`、`03-development/` 含多级子目录（architecture/ ADR/ blueprints/ ai/ guides/ plugins/ …），说明 §2.2 为高层视图、细节以子目录为准。
- **预估工时**：0.5h
- **实际工时**：已完成
- **前置依赖**：无
- **验收标准**：通过（§2.2 已补充 README.md 及子目录说明）

---

## 第二阶段增补工作流（治理深化 · 统一排期）

> **用户决策（2026-07-13）**：① ⑤ 只做文档部分；⑤ 与 [CORE] 四步合并为统一总待办。文档部分（⑤-A / ⑤-B）已随本版执行完成；代码整改（⑤-C）与 [CORE]（C1–C4）待用户批准后执行。

### ⏳ [CORE] 核心检查文档治理（待批准执行）

- **C1 · 修 GOVERNANCE §七 3 死链**
  - **任务描述**：删除/补建 `../reference/code-review.md`、`../explanation/design/tech-debt.md`、`./cleanup-schedule.md` 失效引用（已核实磁盘 MISSING）。
  - **预估工时**：0.5h ｜ **前置依赖**：无 ｜ **验收标准**：GOVERNANCE §七 无失效引用。
- **C2 · 填实 GUIDE §2.2 `[CORE]` 列**
  - **任务描述**：分 `[CORE-SOP]`（人跑：development-workflow-sop / ui-migration-checklist / widget-integration-checklist / a11y-checklist / 月度文档体检检查清单）与 `[CORE-AUTO]`（CI 跑：doc-trigger-action-map / doc-update-trigger.ts / code-review-guide / ai-generate-audit-fix-loop），8–12 个。
  - **预估工时**：1.5h ｜ **前置依赖**：无 ｜ **验收标准**：`[CORE]` 列非空且 `audit:docs` 通过。
- **C3 · 重写 GOVERNANCE §七 为「核心检查文档索引」**
  - **任务描述**：与 GUIDE `[CORE]` 列对齐，不新建平行文件（守单一真相源铁律）。
  - **预估工时**：1h ｜ **前置依赖**：C2 ｜ **验收标准**：§七 与 GUIDE `[CORE]` 列一致。
- **C4 · 注入本地检索**
  - **任务描述**：把 `[CORE]` 文档打 `core-doc` tag 注入 `ai-memory-index.json`，使 `query-ai-memory` 可按 "SOP/校对/触发规则" 返回精确路径；`audit:directory` 比对清单 vs 磁盘。
  - **预估工时**：1.5h ｜ **前置依赖**：C2/C3 ｜ **验收标准**：`query-ai-memory "widget 集成 SOP"` 命中 `../reference/widget-integration-checklist.md`。

### ✅/⏳ ⑤ APP 分发器角色定位（用户指定：① 只做文档部分）

- **⑤-A · 扩 GUIDE §2.3 `apps/`/`portal/` 行 + 新增 §2.3.1 调用链与逐舱角色** ✅ 已完成（本次执行）
  - **任务描述**：`apps/`/`portal/` 行指向 §2.3.1；含 portal→apps→pages 链、command 三 dispatcher 嵌套、input/trading 角色模糊标注。
  - **验收标准**：§2.3.1 含三级加载链图 + 逐舱 App 分发器角色表。
- **⑤-B · 深化 `../explanation/cabins-overview.md` §2 为逐 App 角色定位** ✅ 已完成（本次执行）
  - **任务描述**：§2 含三级加载链图 + 逐舱 App 分发器角色表，标注 input/trading 角色模糊整改项。
  - **验收标准**：§2.2 逐舱表与 GUIDE §2.3.1 自洽。
- **⑤-C · 代码整改：apps/ 角色模糊治理（⏳ 需单独 PR / 决策，不在 ① 文档范围）**
  - **任务描述**：将 `apps/input/*Panel.tsx`、`apps/input/InputDashboard.tsx`、`apps/trading/components/`、`apps/trading/panels/` 迁回 `pages/` 或 `components/`，恢复薄分发器契约。
  - **预估工时**：3h ｜ **前置依赖**：团队确认迁移范围 ｜ **验收标准**：`audit:layers` 对 `apps/` 无页面组件越界；`apps/{cabin}/` 仅含 `{Cabin}App.tsx`。

---

## 汇总

| 优先级 | 任务 | 工时 | 状态 | 关键依赖 |
|--------|------|------|------|----------|
| P1 | T1 根目录补全 | 2h | ✅ 完成 | — |
| P1 | T2 src/fixtures+generated | 1h | ✅ 完成 | — |
| P1 | T3 tests 子目录 | 1h | ✅ 完成 | — |
| P1 | T4 docs/reports 自洽 | 1h | ✅ 完成 | — |
| P1 | T5 archive/knowledge-base | 0.5h | ✅ 完成 | — |
| P1 | T6 重生审计报告 | 1.5h | ✅ 完成 | T1–T5 |
| P1 | T7 outputs 产物治理 | 1.5h | ✅ 完成 | — |
| P1 | T12 audit:directory 接入 CI | 2h | ✅ 完成 | T1–T5 |
| P2 | T8 附录数据刷新 | 0.5h | ✅ 完成 | — |
| P2 | T9 清理违规文件 | 0.5h | ✅ 完成 | 团队确认 |
| P2 | T10 命名约定统一 | 0.5h | ✅ 完成 | — |
| P2 | T11 data/components 精确化 | 1h | ✅ 完成 | — |
| P2 | T13 docs 高层补遗 | 0.5h | ✅ 完成 | — |
| ⏳ | C1 修 GOVERNANCE §七 死链 | 0.5h | ⏳ 待执行 | — |
| ⏳ | C2 填实 GUIDE `[CORE]` 列 | 1.5h | ⏳ 待执行 | — |
| ⏳ | C3 重写 GOVERNANCE §七 索引 | 1h | ⏳ 待执行 | C2 |
| ⏳ | C4 注入本地检索 | 1.5h | ⏳ 待执行 | C2/C3 |
| ✅ | ⑤-A 扩 GUIDE §2.3.1 | 1h | ✅ 完成 | — |
| ✅ | ⑤-B 深化 cabins-overview §2 | 0.5h | ✅ 完成 | — |
| ⏳ | ⑤-C apps/ 角色模糊代码整改 | 3h | ⏳ 待执行 | 团队确认 |
| **合计** | **20 项** | **≈22h** | **✅ 15 完成 / ⏳ 5 待执行** | |

> **执行纪律**：诊断与执行严格分离。所有 P1（T1–T7、T12）与 P2（T8–T13）任务已全部完成。后续维护以 `../../AGENTS.md` 为权威事实源，每次提交前运行 `npm run audit:directory` 与 `npm run audit:docs` 验证一致性，防止文档漂移。
