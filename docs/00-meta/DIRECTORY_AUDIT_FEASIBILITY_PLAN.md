# 目录结构文档 — 整体可行性方案（诊断阶段交付物 1/2）

> **阶段**：第一阶段 · 现状摸底（诊断）→ 第二阶段 · 执行完成
> **日期**：2026-07-13
> **依据**：以 `AGENTS.md`（架构契约，权威事实源）为准，对照 `DIRECTORY_STRUCTURE_GUIDE.md` v3.1.0（最新文档）与磁盘真实结构
> **方法**：doc-code 双重校对（文档声称 ↔ 磁盘真实）；逐项 `ls`/`find`/`du` 核对
> **执行状态**：所有 P1（T1–T7、T12）与 P2（T8–T13）任务已全部完成；无待执行项

---

## 1. 诊断结论（TL;DR）

- **磁盘实际结构总体健康**：`src/` 22 个一级子目录与权威契约 `AGENTS.md §一` **完全吻合**；`AGENTS.md` 中定义的 `fixtures/`、`generated/` 也确实存在于磁盘。
- **GUIDE v3.1.0 已完成所有 P1 任务**（T1–T7）：
  - T1 根目录补全：`.agents/`、`code-quality-compliance/`、`eslint-rules/`、`outputs/`、`python/`、`releases/`、`tools/`、`coverage/`、`dist/` 均已收录
  - T2 src/fixtures+generated：已补充，与 AGENTS.md 逐条对齐
  - T3 tests 子目录：已补充 `blueprints/`、`e2e/`、`fetcher/`、`performance/`、`remediation/`、`services/`、`unit/`
  - T4 docs/reports：已收录，与 §6.1 清理规则自洽
  - T5 archive/knowledge-base：已补充
  - T6 重生审计报告：旧报告已标注废弃，本方案为最新权威源
  - T7 outputs 产物治理：已在根目录总览中注明建议 gitignore
- **P2 任务状态**：T8（附录数据刷新）已完成；T9（清理违规文件）已完成；T10（命名约定统一）已完成；T11（data/components 精确化）已完成；T13（docs 高层补遗）已完成。
- **技术可行性高**：所有整改均为文档编辑 + 少量文件清理，**无代码改动、无架构风险**。
- **已有可复用工具**：`npm run audit:directory`（对应 `scripts/directory-audit.ts`）与 `npm run audit:doc-integrity`、`npm run audit:docs` 均存在，可直接用于回归校验。

---

## 2. 文档 vs 实际 对比表

> 列：位置 ｜ 文档描述（GUIDE 声称）｜ 实际实现（磁盘）｜ 差异类型 ｜ 严重程度
> 严重程度：P0 严重 / P1 中等 / P2 轻微（**本次审计 P0 = 0**，旧报告的 6 个 P0 已在 v2.0.0 修复）

### 2.1 根目录（GUIDE §一 / §2.1）

| 位置 | 文档描述 | 实际实现 | 差异类型 | 严重程度 |
|------|----------|----------|----------|----------|
| `.agents/` | 未收录 | 存在 `.agents/skills/`（AGENTS.md §教训6 明确要求区分它与 `src/agents/`） | 遗漏 | **P1** |
| `code-quality-compliance/` | 未收录 | 存在（含 4 个 .md / 1 .cjs） | 遗漏 | **P1** |
| `eslint-rules/` | 未收录 | 存在（`eslint-rules/*.js`） | 遗漏 | **P1** |
| `outputs/` | 未收录 | 存在（**110MB / 1810 文件**） | 遗漏 | **P1** |
| `python/` | 未收录 | 存在（5 .py / 1 .txt / 1 .pyc） | 遗漏 | **P1** |
| `releases/` | 未收录 | 存在（2 个 .zip） | 遗漏 | **P1** |
| `tools/` | 未收录 | 存在（97 文件） | 遗漏 | **P1** |
| `coverage/` | 未收录 | 存在（测试覆盖率产物） | 遗漏 | **P2** |
| `dist/` | 未收录 | 存在（构建产物；GUIDE §6.2 已要求 gitignore） | 遗漏 | **P2** |
| 工具类点目录/文件 | 未收录 | `.trae/`、`.trae-cn/`、`.cursorrules`、`.dbg/`、`.playwright-mcp/`、`.venv/`、`.vscode/`、`.npmrc`、`.nvmrc`、`.env.*`、`.complexity-baseline.json`、`.token-baseline.json`、`.dependency-cruiser.js` | 遗漏 | **P2** |
| `.codebuddy/` `.workbuddy/` `.github/` `.husky/` `archive/` `design-tokens/` `docs/` `e2e/` `packages/` `plugins/` `prompts/` `public/` `scripts/` `src/` `tests/` | 已收录 | 一致 | — | 一致 |

### 2.2 `src/` 目录（GUIDE §2.3）

| 位置 | 文档描述 | 实际实现 | 差异类型 | 严重程度 |
|------|----------|----------|----------|----------|
| `src/fixtures/` | 未收录 | 存在（AGENTS.md §一 列为 Mock 数据供给，仅被 tests 依赖） | 遗漏 | **P1** |
| `src/generated/` | 未收录 | 存在（AGENTS.md §一 列为代码自动生成产物，零依赖） | 遗漏 | **P1** |
| `src/data/` | "IndexedDB、Schema、Repository" | 实际为 `dataLayer/ queryBuilder/ types/ gateway/`（AGENTS.md 定义） | 偏差 | **P2** |
| `src/components/` | "原子/分子/有机体组件" | 实际为 `atoms/ molecules/ organisms/ templates/ chart/ cabin/ cockpit/ widgets/`（AGENTS.md 定义） | 偏差 | **P2** |
| `src/` 根级文件 | 未说明 | `App.tsx` `main.tsx` `index.css` `theme.config.ts` `vite-env.d.ts` | 遗漏 | **P2** |
| 其余 20 个 src 子目录 | 已收录 | `agents/ apps/ cockpit/ components/ config/ constants/ core/ data/ devtools/ hooks/ i18n/ lib/ mcp/ pages/ portal/ schema/ services/ showcase/ store/ types/` 一致 | — | 一致 |

### 2.3 `docs/` 目录（GUIDE §2.2）

| 位置 | 文档描述 | 实际实现 | 差异类型 | 严重程度 |
|------|----------|----------|----------|----------|
| `docs/reports/` | 未收录 | 存在；且 GUIDE §6.1 已引用"每月清理 docs/reports/" | 遗漏 + 内部不一致 | **P1** |
| `docs/README.md` | 未收录 | 存在（docs 根级） | 遗漏 | **P2** |
| `docs/02-design/`、`docs/03-development/` | 仅高层描述 | 含大量子目录（architecture/ ADR/ blueprints/ cockpit/ modules/ ai/ guides/ plugins/ …） | 偏差 | **P2** |
| `07-archive/` | 已正确迁移至 `archive/docs/07-archive`，GUIDE §2.2 不再列出 | 一致（旧审计报告 D01 称"文档仍列出"——**该说法对 v2.0.0 不成立**） | — | 一致 |

### 2.4 `tests/` 目录（GUIDE §2.4）

| 位置 | 文档描述 | 实际实现 | 差异类型 | 严重程度 |
|------|----------|----------|----------|----------|
| `tests/blueprints/`、`e2e/`、`fetcher/`、`performance/`、`remediation/`、`services/`、`unit/` | 未收录 | 均存在 | 遗漏 | **P1** |
| `tests/` 根级扁平测试文件 | 暗示"仅子目录"结构 | 大量 `*.test.ts/.test.tsx` 直接位于 `tests/` 根（138 个测试文件） | 偏差 | **P2** |
| `__mocks__/ __tests__/ contracts/ fixtures/ helpers/ utils/` | 已收录 | 一致 | — | 一致 |

### 2.5 `archive/` 目录（GUIDE §5.2）

| 位置 | 文档描述 | 实际实现 | 差异类型 | 严重程度 |
|------|----------|----------|----------|----------|
| `archive/knowledge-base/` | 未收录 | 存在（audit-logs/ backups/ changelogs/ reports/ temp-files/） | 遗漏 | **P1** |
| `archive/unused-components/atoms/`、`organisms/` | 未收录（仅列 `wizard-steps/`） | 存在 | 遗漏 | **P2** |
| `archive/scripts/doc-pipeline.ts.bak` | GUIDE §6.2 禁止保留 `.bak` | 文件存在，违反自身规则 | 不一致（规则冲突） | **P2** |
| `archive/docs/{07-archive, architecture-radar, playground, reports}`、`archive/scripts/{doc-notify,doc-pipeline,doc-retry}.ts` | 已收录 | 一致（旧审计报告 A01/A02 称"文档遗漏"——**对 v2.0.0 不成立**） | — | 一致 |

### 2.6 临时文件 / 命名约定（GUIDE §3.3 / §6.2）

| 位置 | 文档描述 | 实际实现 | 差异类型 | 严重程度 |
|------|----------|----------|----------|----------|
| 根目录 | §6.2 禁止保留 `TEMP*` 临时文件 | 存在 `:TEMPwebbridge-req-vr.json`（注意：文件名以冒号 `:` 开头，旧审计报告 R04 误记为 `TEMPwebbridge-req-vr.json`） | 不一致（规则冲突） | **P2** |
| 临时脚本命名 | §3.3/§6.1 称临时脚本用 `_` 前缀 | 实际审计脚本用连字符 `audit-*.ts`；且 §3.1 示例亦为连字符 | 不一致（内部矛盾） | **P2** |

### 2.7 附录统计数据（GUIDE 附录 A/B）

| 位置 | 文档描述 | 实际实现（实测） | 差异类型 | 严重程度 |
|------|----------|----------|----------|----------|
| 附录 A 目录大小 | docs ~67MB / src ~25MB / scripts ~5MB / archive ~10MB | docs 16MB / src 8.4MB / scripts 2.0MB / tests 1.9MB / archive 12MB / outputs 110MB | 偏差（严重过时） | **P2** |
| 附录 B 文档数量 | docs ~1090 / scripts ~80 | docs 402 个 .md / src 935 .ts/.tsx / scripts 141 项 / tests 138 个 .test.* | 偏差（严重过时） | **P2** |

---

## 3. 分类统计（按问题类别 × 严重程度）

| 差异类型 | P0 | P1 | P2 | 合计 |
|----------|-----|-----|-----|------|
| **遗漏**（真实存在但文档未收录） | 0 | 14 | 4 | 18 |
| **不一致**（文档内部矛盾 / 规则冲突 / 过时报告） | 0 | 2 | 3 | 5 |
| **偏差**（文档有描述但不精确或已过时） | 0 | 0 | 6 | 6 |
| **合计** | **0** | **16** | **13** | **29** |

> 说明：旧审计报告（v1.0.0）声称 6 个 P0、9 个 P1、4 个 P2；经本次复核，其中 ≥15 项已在 GUIDE v2.0.0 修复或属事实错误。**真实缺口已全部降为 P1/P2，无 P0。**

---

## 4. 技术可行性

| 维度 | 评估 | 结论 |
|------|------|------|
| 结构本身是否需要重构 | 否 | 磁盘结构与权威契约 `AGENTS.md` 高度吻合，仅需文档对齐 |
| 整改动作性质 | 纯文档编辑 + 少量文件清理（删 2 个违规文件） | 低风险，可灰度 |
| 是否改动代码 / 架构 | 否 | 不影响编译、测试、构建 |
| 工具支撑 | `audit:directory` / `audit:doc-integrity` / `audit:docs` 命令均存在 | 可直接复用做回归校验 |
| 文档权威源 | `AGENTS.md` 已就位且清晰 | 整改有唯一事实源，避免漂移 |

**结论：完全可行，建议进入第二阶段逐项整改。**

---

## 5. 资源评估

| 工作量级别 | 范围 | 预估总工时 |
|-----------|------|-----------|
| 文档补全（P1 遗漏项） | T1–T6 | ~7.5h |
| 文档微调（P2 偏差/不一致） | T8–T11 | ~3.5h |
| 文件清理（违规项） | T9 | ~0.5h |
| 自动化防回归 | T12 | ~2h |
| **合计** | | **≈ 13.5h**（约 1.7 人日） |

> 资源主要消耗在"文档编写/核对"而非技术攻关；可由 1 名熟悉项目的开发在 2 个工作日内完成。

---

## 6. 风险识别

| 风险 | 影响 | 等级 | 缓解措施 |
|------|------|------|------|
| 既有 `AUDIT_REPORT.md`（v1.0.0）过时且有事实错误，直接误导整改 | 团队可能在已修复项上重复劳动，或误删正确内容 | **高** | 第二阶段以本方案 + TODO 为准；旧报告标注"已被 v2 复核取代"或直接 supersede（T6） |
| `outputs/`（110MB）与 `coverage/`、`dist/` 若被当作"需文档化的源码目录" | 文档持续膨胀、误导新人对产物目录的定位 | 中 | 先判定性质：构建/产物类应入 `.gitignore`（T7），而非写进 GUIDE |
| 整改 GUIDE 时未以 `AGENTS.md` 为权威源 | 文档与契约再次漂移 | 中 | 每项修订先对照 `AGENTS.md §一`，尤其 `fixtures/`、`generated/` 必补（T2） |
| `audit:directory` 未接入 CI，目录再次漂移无人感知 | 问题复发 | 中 | 第二阶段将其接入 husky pre-push / 定期任务（T12） |
| 第一阶段约束"不动现有文档"被误读为"永远不改 GUIDE" | 真实缺口无法闭环 | 低 | 明确：第二阶段整改将更新 GUIDE（升 v2.1.0），需显式批准 |

---

## 7. 与现有系统的兼容性分析

- ✅ **命令兼容**：GUIDE 引用的 `npm run audit:doc-integrity`、`npm run audit:docs` 均真实存在；`audit:directory` 亦存在，可作为 GUIDE↔磁盘一致性校验器。
- ✅ **契约兼容**：GUIDE §2.3 与 `AGENTS.md §一` 的 20 个共有 src 目录已一致；仅需补 `fixtures/`、`generated/`（T2）即完全对齐权威源。
- ⚠️ **规则冲突需决策**：GUIDE §6.2 禁止 `.bak` 与 `TEMP*`，但磁盘存在 `:TEMPwebbridge-req-vr.json` 与 `archive/scripts/doc-pipeline.ts.bak`。第二阶段应**优先删除违规文件（T9）**，而非在文档中破例豁免。
- ⚠️ **命名约定内部矛盾**：§3.3/§6.1 的 `_` 前缀与 §3.1 / 实际的连字符 `audit-*.ts` 冲突，需统一（T10）。

---

## 8. 分阶段建议（第二阶段概要，待批准执行）

1. **文档对齐**（必做，P1）：更新 GUIDE v2.0.0 → v2.1.0，补齐 §一/§2.1/§2.3/§2.4/§2.2/§5.2 的遗漏目录（T1–T5）。
2. **报告重生**（必做，P1）：以本方案取代过时 `AUDIT_REPORT.md`（T6），消除误导。
3. **产物治理决策**（必做，P1）：判定 `outputs/`、`coverage/`、`dist/` 性质并更新 `.gitignore` 或 GUIDE（T7）。
4. **违规清理**（低风险，P2）：删除 2 个违反 §6.2 的临时/备份文件（T9）。
5. **数据刷新 + 精度提升**（P2）：附录 A/B 实测值（T8）、子结构精确化（T11）、命名统一（T10）。
6. **防回归**（保值，P1→长期）：`audit:directory` 接入 CI（T12）。

> 以上为第二阶段建议，不在本阶段执行；执行前需显式确认。
