# 项目记忆（V9 智能投研复盘系统）

## 设计体系
- **宋韵美学**：亮色用 `stone` 暖灰系（底 stone-50/100、正文 stone-800、强调 emerald-500）；暗色统一为 `neutral` 高级灰（hue 0，零彩度）。只改 `dark:*` 段，不动亮色 stone。
- **令牌层级**：L1 `THEME_TOKENS` / L2 `COLOR_TOKENS` / L3 `COLOR_SHADES`+`twText/twBg/twBorder` / L4 `chartColors` / L5 股票红涨绿跌固定色 / L6 `SEMANTIC_COLOR_ROLES`。
- UI 颜色必须走令牌；A 股涨跌色固定，不随主题。
- **设计令牌映射表**：`docs/design-token-mapping.md` 按业务场景映射 L1–L6 使用方式；`.vscode/token-snippets.code-snippets` 提供常用令牌代码片段；`design-tokens/figma-to-project.json` 与 `project-to-figma.json` 维护设计变量↔代码令牌双向映射（54 条）。

## 架构与门禁
- 分层依赖见 `AGENTS.md` §一；新增模块按「类型→Store→Service→UI」四步集成。
- 质量门禁用**系统 Node 24** + 项目 `node_modules` 关沙箱跑：`npm run audit`（10 道）+ `tsc:prod` + `lint:colors`。
- **Husky 预提交门禁**（`.husky/pre-commit`）：lint-staged → `lint:colors` → `tsc:prod` → `audit:layers` → `audit:atomic` → `audit:docs` → `verify:tokens` → `audit:tokens` → `audit:jsdoc` → `audit:complexity`，共 10 项；`pre-push` 运行 `test:clean` + `build`。
- **⚠️ Vitest exclude 陷阱（2026-07-12 修复）**：`vite.config.ts` 的 `test.exclude` 必须写 `**/node_modules/**`（前导 globstar），仅写 `node_modules/**` 无法匹配**嵌套**的 `packages/*/node_modules`，会把 pino/thread-stream/process-warning 等第三方测试误收进门禁（造成 141 个"失败文件"噪声、pre-push 长期假红）。`test:clean` 当前为 `vitest run`（无 --exclude）+ 正确 exclude；剩余 38 个真实失败见 Task #9。
- 当前为 **12 道门禁全绿/预存不阻塞** 基线；新增代码不得触发 layers/atomic/hardcode/token/lint:colors/tests 阻塞。
- 行情 URL 已集中至 `src/config/marketDataEndpoints.ts`；API 路径/接口映射必须进 `src/config/collectConfig.ts`。

## 原子组件体系（Atomic Design）
- **四层目录**：`src/components/{atoms,molecules,organisms,templates}/`，各层有 `index.ts` 桶导出。
- **层级边界**（`audit:atomic` 强制）：atom 不引 store/service/molecule/organism/template/page/app；molecule 不引 organism/template/store/service；template 不引 organism/store/service。
- **迁移状态**：阶段 1–5 **全部完成** ✅。5 个阶段：体系建立 → ui/ 物理迁移 → 业务目录有机体化（11 域 63 文件）→ 模板提取+试点页面布局统一 → Shim 清理（14 旧目录+7 顶层 shim 删除，46 处导入归一化）。
- **目录现状**：`src/components/` 仅剩 `atoms/ molecules/ organisms/ templates/ chart/ cabin/ cockpit/ widgets/ componentRegistry.ts`；**0 shim 残留**，消费者导入全部走 `@/components/{atoms,molecules,organisms,templates}/...` 规范路径（旧路径已不存在，编译器自动强制）。
- **注册表**：`src/components/componentRegistry.ts` 全量 `active`（0 migrating）。
- **audit:atomic 基线**：**0 违规、0 警告**（133 文件全量通过）。
- **chart/ 与 cockpit/cabin/widgets**：registry 标注 active + targetPath=sourcePath（不物理搬，Widget 注册表耦合）。

## 数据采集
- 类型：`src/types/modules/collection.types.ts`；配置：`src/config/dataSourceRegistry.ts`、`src/config/collectConfig.ts`。
- 服务：`src/services/data-collector/`（orchestrator / pipeline / qualityMetricsCollector）。
- 状态：`src/store/collectionRuntimeStore.ts`、`src/store/sevenDimConfigStore.ts`、`src/store/dataTestStore.ts`。
- 事件名：`collect:triggered`、`source:start/success/fail`、`fallback`、`transform`、`write:start/success/fail`、`complete`、`task:status`、`collect:trace`。

## 驾驶舱 Widget 扩展
新增 Widget 必改三处：`src/cockpit/core/widgetRegistry.ts`、`src/constants/cockpit.constants.ts` 的 `DEFAULT_WIDGET_CONFIG` + `WIDGET_DEFAULT_DATA_SOURCE`；组件消费 `useMarketData()`，颜色走令牌。

## AI 辅助工程治理
- **提示词模板**：`prompts/system-prompt-template.md`、`component-prompt-template.md`、`service-prompt-template.md`、`store-prompt-template.md`、`types-prompt-template.md`。
- **检查清单**：`docs/ui-migration-checklist.md`、`docs/widget-integration-checklist.md`。
- **AI 记忆层**：`scripts/build-ai-memory-index.ts` 生成 `public/ai-memory-index.json`；`scripts/query-ai-memory.ts` 与 `src/services/system/aiMemoryService.ts` 支持关键词检索。
- **飞轮流程**：`docs/ai-generate-audit-fix-loop.md` 定义生成→审计→修正→再审计闭环。

## 架构健康度
- **仪表盘**：总控舱 `/command/health` 展示综合得分与 7 项指标（跨层调用、颜色硬编码、深层嵌套、长链式条件、重复 if 条件、JSDoc 缺失、文档同步）。
- **报告生成**：`npm run build:health` → `public/health-report.json`。
- **当前基线（2026-07-12 实测 public/health-report.json）**：综合得分 **90**；跨层调用 0、颜色硬编码 0、深层嵌套 0、长链式条件 0、重复 if 条件 0、**JSDoc 缺失 9**、文档同步 0。（注：本文件此前记"93 / JSDoc 0"为旧记忆，已据实修正。）

## 真实开发成本与盲区（2026-07-10 复盘）
- **UI 组件调配是高成本环节**：股票池看板跨舱迁移、驾驶舱 Widget 三处注册同步、颜色硬编码回扫（峰值 140 处）占用大量时间；AI 对架构治理型改动（迁移、目录重组、引用同步）稳定性不足。
- **编码系统性与逻辑性存在盲区**：分层架构执行偏差（lib/ 被业务污染、EventBus 绕过数据流）、深层嵌套与链式条件（`complexity-scan.ts` 基线：≥4 层嵌套 103 处、≥6 分支链 0 处、重复 if 条件 39 处；历史粗略扫描 66/32/194 已不适用）、硬编码阈值/路由路径/事件名、测试与文档滞后（JSDoc 缺失 632 处）。
- **改进抓手**：四步集成顺序必须门禁化；建立 UI 迁移检查清单；将嵌套深度/分支数/重复条件纳入 CI；常量优先；AI 提示词固定注入 `AGENTS.md` + `lint:colors` + JSDoc 模板。

- 个人股票研究/复盘辅助工具，非金融产品；本地 IndexedDB 自管；AI 输出标注「仅供参考非投资建议」。
- 五因子评分当前为合成种子，UI 须标「示例」；真实信号走 `detectBySector`。

## 复杂度整改（2026-07-12 已全归零）
- 三类债务权威口径（`complexity-scan`）现已 **0 深层嵌套 / 0 长链 / 0 重复条件**；自研 `measure-complexity-now.ts`（同函数逐字）仅余 C29 熔断状态机两处（per-function 不计重复，维持）。
- **重复条件清除四手法（必记）**：① 抽具名 helper 把 `if` 收进唯一一处（调用点不再有 `if`）；② 卫语句一正一反使文本不同；③ De Morgan 反转同义过滤；④ 多处分支合并为回调 helper。注意：单纯抽共享变量 `if (cond)` 两处仍判重，必须把 `if` 收进唯一一处或使文本真正不同。
- 门禁复测须用**系统 Node24 直驱 tsx**：`node ./node_modules/tsx/dist/cli.mjs scripts/xxx.ts`（`npm run` 在 git-bash 下偶报 "Could not determine Node.js install directory"，非真违规）。`.bin/tsc`/`.bin/tsx` 是 shell 包装，直跑会 `SyntaxError`。

## 文档自动更新体系（2026-07-12 N2/N3 闭环）
- **映射表**：`docs/00-meta/doc-trigger-action-map.md` §二是触发→动作 1:1 单一事实源；`scripts/doc-update-trigger.ts` `TRIGGER_RULES`（T1–T10）须与映射表同步。
- **目标文档**：T1–T9 共 19 个 `docsToUpdate` 路径已全部对齐磁盘真实文件（9 修订指向 `01-requirements/`、`02-design/`；4 新建 `STATE_MANAGEMENT/HOOKS_GUIDE/PAGE_STRUCTURE/cockpit-DATA_DEFINITION`）。
- **`--auto-update` 已落地**（非空桩）：`DocGenerator` 注册表扩展点（`defaultDocGenerator` 建骨架+幂等 `<!-- auto-update -->` 标记、`versionCheckGenerator` 对接 `doc:version-check`）；按 `auditDocs` 调 `audit:docs`。完整正文生成可后续注入生成器。
- **看板**：`docs/00-meta/doc-auto-update-kanban.md`（P0/P1/P2 全 ✅，体系任务全闭环：N1-N5、A1-A10、T1-T8、T7b、B7、C1-C5、B12、B15）。
- **坑**：JSDoc 注释禁含字面 `*/`（`**/` 会提前闭合块注释致 tsc 级联报错）。
