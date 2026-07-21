# 代码-文档同步差异清单

> **Status**: Current  
> **Version**: v0.9.0-doc-sync-gap-001  
> **Last Updated**: 2026-06-26  
> 使用说明：每次扫描后在此清单中记录新增/修改文件与缺失文档的对应关系，按优先级逐条闭环。

---

## 扫描元信息

| 项目 | 内容 |
|------|------|
| 扫描日期 | 2026-06-26 |
| 扫描范围 | `src/` 新增/修改文件；`docs/implementation/v9-issue-resolution-schedule.md` 待执行项 |
| 扫描依据 | `docs/implementation/doc-sync-execution-plan.md` |
| 扫描责任人 | Doc-Sync Agent |

---

## 差异项清单

### 已闭环（本次扫描前已处理）

| 模块 | 代码文件 | 同步文档 | 闭环日期 | 验证结果 |
|------|----------|----------|----------|----------|
| 金融业务 Widget | `src/cockpit/widgets/*`、`src/services/stock-analysis/*`、`src/services/data-collector/*` | `ARCHITECTURE.md`、`DATA_DEFINITION.md` | 2026-06-26 | tsc/lint/test/build 通过 |
| AI 中心板块 | `src/constants/ai-center.constants.ts`、`src/constants/health.constants.ts`、`src/types/modules/ai-center.types.ts`、`src/services/ai-center/*` | `docs/AI_CENTER_DATA_DEFINITION.md`、`docs/AI_CENTER_VUE3_EXAMPLES.md` | 2026-06-26 | tsc/lint 通过 |
| NewsPage PoC | `src/pages/news-v6/*`、`src/services/news/newsService.ts` | `docs/NEWS_DATA_DEFINITION.md` | 2026-06-26 | tsc/lint 通过 |
| 代码-文档同步机制 | `docs/implementation/doc-sync-execution-plan.md` | `docs/08-implementation-plan.md`、`CHANGELOG.md` | 2026-06-26 | tsc/lint 通过 |

---

### 待处理

#### 高优先级（P0/P1）

| ID | 模块 | 涉及文件 | 缺失文档类型 | 问题描述 | 优先级 | 建议责任人 | 状态 |
|----|------|----------|--------------|----------|--------|------------|------|
| ~~GAP-001~~ | ~~V9 问题整改闭环~~ | ~~`src/vite-env.d.ts`、`.env.example`~~ | ~~数据字典/类型声明~~ | ~~DOC-001：已确认 `VITE_AKSHARE_BASE_URL` 在 `src/vite-env.d.ts` 中存在声明~~ | ~~P1~~ | ~~Doc-Sync-Fix~~ | ~~已闭环 2026-06-26~~ |
| ~~GAP-002~~ | ~~数据流引擎~~ | ~~`src/core/dataflow/*`~~ | ~~架构说明/数据字典~~ | ~~已新增 `docs/DATAFLOW_DATA_DEFINITION.md`；`docs/05-engine-specs.md` 已引用该字典并保持“部分实现”状态~~ | ~~P1~~ | ~~Architecture-Fix~~ | ~~已闭环 2026-06-26~~ |
| GAP-003 | 数据融合引擎 | `src/services/unifiedStockService.ts` | 架构说明/数据字典 | 2.1.9 数据融合引擎未实现或缺少文档化说明 | P1 | Architecture-Fix | 待执行 |
| ~~GAP-004~~ | ~~路由规格同步~~ | ~~`src/config/routes.ts`~~ | ~~路由规格~~ | ~~DOC-007：已更新 `docs/06-routing-specs.md` 第 8 节，补全 `/analysis/news-v6`、`/trading/holdings`、`/mock-test` 等路由~~ | ~~P1~~ | ~~Doc-Sync-Fix~~ | ~~已闭环 2026-06-26~~ |
| ~~GAP-005~~ | ~~质量门禁基线~~ | ~~`docs/09-quality-gates.md`~~ | ~~质量门禁~~ | ~~DOC-006：已更新 E2E 状态、硬编码基线（749）、死代码基线（0/0/16）；跨层调用基线修正为 0/0~~ | ~~P1~~ | ~~Doc-Sync-Fix~~ | ~~已闭环 2026-06-26~~ |
| GAP-006 | 文档版本号统一 | `docs/01~10`、`docs/implementation/*` | frontmatter | DOC-005：核心/实施文档 `Version` frontmatter 未全部统一为 `v0.9.0-doc-sync-plan`；需批量扫描更新 | P1 | Doc-Sync-Fix | 部分闭环 |
| GAP-007 | 评分报告生成 | `src/services/analysis/*`（待实现） | 架构说明/数据字典 | 2.2.1 评分报告生成尚未落地，文档与实际代码存在偏差 | P1 | TBD | 待规划 |
| GAP-008 | 板块轮动评分引擎接入 | `src/services/analysis/rotationScoreService.ts` | 架构说明 | 2.4.1 引擎代码已存在，但 `SectorAnalysisPage` 接入状态与文档需同步 | P1 | TBD | 待执行 |

#### 中优先级（P2）

| ID | 模块 | 涉及文件 | 缺失文档类型 | 问题描述 | 优先级 | 建议责任人 | 状态 |
|----|------|----------|--------------|----------|--------|------------|------|
| GAP-009 | 数据字典索引 | `docs/*DATA_DEFINITION*.md` | 索引页 | 缺少 `docs/DATA_DICTIONARY_INDEX.md` 汇总所有模块数据字典入口 | P2 | Doc-Sync Agent | 待执行 |
| ~~GAP-010~~ | ~~自动化扫描脚本~~ | ~~`scripts/audit/audit-doc-sync.ts`~~ | ~~工具脚本~~ | ~~已实现 `scripts/audit/audit-doc-sync.ts`，支持 git diff 与全量 src 扫描；`npm run audit:docs` 通过，0 个未引用文件~~ | ~~P2~~ | ~~Doc-Sync Agent~~ | ~~已闭环 2026-06-26~~ |
| GAP-011 | Agent 运行时框架 | `src/agents/*` | 架构说明 | 2.17 Agent 运行时框架代码已存在，但架构说明与监控文档待补齐 | P2 | Architecture-Fix | 待执行 |
| GAP-012 | 操作反馈闭环 | `src/components/ui/`、各 App | UI/UX 规格 | 2.20 操作反馈闭环增强尚未落地，文档与实际存在偏差 | P2 | Interaction-Fix | 待规划 |

---

## 闭环检查清单

每处理完一条差异项，请勾选并补充信息：

- [ ] 代码变更已提交
- [ ] 对应文档已更新
- [ ] `CHANGELOG.md` 已追加条目
- [ ] `npm run tsc` 通过
- [ ] `npm run lint` 通过
- [ ] 相关测试通过
- [ ] `npm run build` 通过
- [ ] 本清单状态已更新为“已闭环”

---

## 历史记录

| 版本 | 日期 | 变更内容 |
|------|------|----------|
| v0.9.0-doc-sync-gap-001 | 2026-06-26 | 首次扫描，记录已闭环 4 项、待处理 12 项 |
