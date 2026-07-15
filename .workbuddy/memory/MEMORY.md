# 项目记忆（V9 智能投研复盘系统）

## 设计体系
- 宋韵美学：亮色 stone 暖灰系；暗色统一 neutral 高级灰（hue 0）。只改 `dark:*` 段，不动亮色 stone。
- 令牌层级 L1 `THEME_TOKENS` → L6 `SEMANTIC_COLOR_ROLES`；UI 颜色必须走令牌，A 股红涨绿跌固定不随主题。
- 映射表 `docs/design-token-mapping.md`；figma↔project 双向映射 `design-tokens/*.json`。

## 架构与门禁
- 分层依赖见 `AGENTS.md` §一；新模块按「类型→Store→Service→UI」四步集成。
- Husky 预提交 10 项：lint-staged→lint:colors→tsc:prod→audit:layers→audit:atomic→audit:docs→verify:tokens→audit:tokens→audit:jsdoc→audit:complexity；pre-push: test:clean+build。
- 质量基线 12 道门禁全绿；新增代码不得触发 layers/atomic/hardcode/token/lint:colors/tests 阻塞。
- 行情 URL 集中 `src/config/marketDataEndpoints.ts`；API 映射进 `src/config/collectConfig.ts`。
- 门禁复测用系统 Node24 直驱 tsx：`node ./node_modules/tsx/dist/cli.mjs scripts/xxx.ts`（`npm run` 在 git-bash 偶报 "Could not determine Node.js install directory"）。

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
