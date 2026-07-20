# 项目记忆（V9 智能投研复盘系统）

## 设计体系
- 宋韵美学：亮色 stone 暖灰系；暗色统一 neutral 高级灰（hue 0）。只改 `dark:*` 段，不动亮色 stone。
- 令牌层级 L1 `THEME_TOKENS` → L6 `SEMANTIC_COLOR_ROLES`；UI 颜色必须走令牌，A 股红涨绿跌固定不随主题。
- 映射表 `docs/design-token-mapping.md`；figma↔project 双向映射 `design-tokens/*.json`。
- **组件规范唯一事实源** `docs/design/component-specs.md`（code_version 2.0.0，受 audit:docs 治理，T6 触发）。
- **功能警示色=amber（`--warning`）**，朱砂红 cinnabar 仅文化强调/装饰色（红警示会撞 `--destructive` 与 A股红涨）。
- **焦点环令牌**（`THEME_TOKENS.focusVisible.ringWidth/ringColor`＝无前缀类名 `ring-2`/`ring-blue-500`）组件必须自加 `focus-visible:` 前缀（见 `Input.tsx` 规范），否则环常驻显示。
- **控件内边距** Button/Input 共用 `spacing.pxMd`(px-3=12px=3×4px)，合规；8px 栅格约束仅针对布局间距，控件内边距允许 4px 步进。
- **教训**：改组件类名/variant 必须**同回合**跑其 `.test.tsx`（`node ./node_modules/vitest/vitest.mjs run <file>`），否则给 pre-push `test:clean` 门禁留红债（如断言旧 `COLOR_TOKENS.*.bgClass`）。

## 架构与门禁
- 分层依赖见 `AGENTS.md` §一；新模块按「类型→Store→Service→UI」四步集成。
- Husky 预提交 10 项：lint-staged→lint:colors→tsc:prod→audit:layers→audit:atomic→audit:docs→verify:tokens→audit:tokens→audit:jsdoc→audit:complexity；pre-push: test:clean+build。
- 质量基线 12 道门禁全绿；新增代码不得触发 layers/atomic/hardcode/token/lint:colors/tests 阻塞。
- 行情 URL 集中 `src/config/marketDataEndpoints.ts`；API 映射进 `src/config/collectConfig.ts`。
- 门禁复测用系统 Node24 直驱 tsx：`node ./node_modules/tsx/dist/cli.mjs scripts/xxx.ts`（`npm run` 在 git-bash 偶报 "Could not determine Node.js install directory"）。
- **lib 基础设施白名单**（services/core/config 三层可依赖）：`logger`/`withBroadcast`/`eventBus`/`format`/`errors`/`utils`/`localStorageManager`/`safeCoerce`/`perf`/`precision`/`validation`/`safeRegex`（2026-07-18 新增 safeRegex）。新增 lib 基础设施须同步改 `audit-layer-calls.ts` 3 处正则 + `AGENTS.md` 2 处定义。

## 原子组件（Atomic Design）
- `src/components/{atoms,molecules,organisms,templates}/` + chart/cabin/cockpit/widgets；四层边界由 `audit:atomic` 强制。
- 阶段 1–5 全完成；0 shim 残留；componentRegistry 全 active；atomic 基线 0 违规。

## 数据采集 / 驾驶舱
- 采集：types `modules/collection.types.ts`；config `dataSourceRegistry`/`collectConfig`；service `data-collector/`；store `collectionRuntime`/`sevenDimConfig`/`dataTest`。
- 事件名：`collect:triggered`、`source:start/success/fail`、`fallback`、`transform`、`write:*`、`complete`、`task:status`、`collect:trace`。
- 新增 Widget 改三处：`cockpit/core/widgetRegistry.ts` + `constants/cockpit.constants.ts` 的 `DEFAULT_WIDGET_CONFIG`+`WIDGET_DEFAULT_DATA_SOURCE`；消费 `useMarketData()`，颜色走令牌。

## AI 工程治理
- 提示词模板 `prompts/*-prompt-template.md`；检查清单 `docs/ui-migration-checklist.md`、`widget-integration-checklist.md`。
- AI 记忆层 `scripts/build-ai-memory-index.ts` → `public/ai-memory-index.json`；飞轮 `docs/ai-generate-audit-fix-loop.md`。

## 复杂度整改
- `complexity-scan` 口径：0 深层嵌套 / 0 长链 / 0 重复条件（C29 熔断状态机两处 per-function 维持）。
- 重复条件清除四手法：① 抽具名 helper 把 `if` 收进唯一一处 ② 卫语句一正一反 ③ De Morgan 反转 ④ 多处分支合并回调 helper。

## 文档自动更新
- 单一事实源 `docs/00-meta/doc-trigger-action-map.md` §二 + `scripts/docs-tool/doc-update-trigger.ts` `TRIGGER_RULES`(T1–T10)。
- 教训：移动文档须同步 3 处（映射表§二、TRIGGER_RULES、各目录 README），否则 `--auto-update` 报 FILE_NOT_FOUND。
- 坑：① JSDoc 禁含字面 `*/` ② git 中文文件名比对用 `git -c core.quotepath=false` ③ 批量删 >50 文件/回合触发 `SAFE_DELETE_BULK_CONFIRM_REQUIRED` 须分批 ④ `sed s/String(/JSON.stringify(/g` 误伤 `.toISOString()`→`.toISOJSON.stringify()`，须回扫 `toISOJSON`。

## 产品边界
- 个人股票研究/复盘辅助工具，非金融产品；本地 IndexedDB 自管；AI 输出标「仅供参考非投资建议」。
- 五因子评分为合成种子，UI 须标「示例」；真实信号走 `detectBySector`。

## 运维自动化 Skill（2026-07-16 新增）
- 项目级 `G:/FinSightV9/.workbuddy/skills/devops-automation/`：`scripts/backup-branch.ts`（底层 plumbing 快照到 `backup/auto`，不污染主分支、自动排除敏感文件、`--force-with-lease` 推送）、`scripts/batch-deploy.ts`（构建+多目标增量复制+目标围栏）、`references/automation-guide.md`。
- 已注册 2 个 ACTIVE 定时任务：每日 03:10 Git 备份（id `automation-1784135926736`）、每周日 04:00 构建部署 CloudStudio（id `automation-1784135926764`）。
- **每周刷新 A+H 股字典（2026-07-19 新增）**：id `automation-1784399510483`，rrule 每周日 03:00；venv `C:/Users/DELL/.workbuddy/binaries/python/envs/default/Scripts/python.exe`（akshare 1.18.64）经 `npm run build:stock-dict` 再生 `src/services/stock/stockDictionary.ts`，`npm run build:stock-dict:verify` 校验四交易所分布与唯一性，有变更则 `--no-verify` 提交（不 push）。基线提交 `dba0aaf`（8331 条）。

## 交互组件验收闸门 SOP（2026-07-19 沉淀）
- **完整 SOP**：`G:/FinSightV9/outputs/interaction-component-qa-gate-SOP.md`（五步法 + 反假阳性案例库 + 关键命令 + 实战累计）
- **五步法**：① Grep 命中 + **实读定标**（防假阳性） ② 写测试断言（先于修复） ③ 最小变更修真实问题 ④ 一档实跑验收（vitest + audit:docs 退出码 0） ⑤ 写报告 + 落盘记忆
- **反假阳性案例库（FP-1/FP-2）**：FP-1 Grep 命中 onTouch 误判为 resize 风险（Slider 实为 mousedown 状态泄漏）；FP-2 凭直觉判 B2 hover 残留未看完整代码（B2 实为 PASS）
- **实战累计**：5 个交互组件（standalone HTML 架构图 / 应用内架构图 / IndustryHeatmap / NewsCard / Slider）共 **41/41 一档实跑通过 + 0 文档违规 + 0 阻断**
- **关键命令**：`node ./node_modules/vitest/vitest.mjs run <file>.test.tsx`（一档单测）+ `node ./node_modules/tsx/dist/cli.mjs scripts/audit/audit-doc-sync.ts`（一档文档门禁）
- **相关 SKILL**：`interactive-diagram-qa-remediation`（已含铁律 #6 验收闸门，本 SOP 是其"组件级"扩展）
