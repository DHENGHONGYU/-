# 项目记忆（V9 智能投研复盘系统）

## 设计体系
- **宋韵美学**：亮色用 `stone` 暖灰系（底 stone-50/100、正文 stone-800、强调 emerald-500）；暗色统一为 `neutral` 高级灰（hue 0，零彩度）。只改 `dark:*` 段，不动亮色 stone。
- **令牌层级**：L1 `THEME_TOKENS` / L2 `COLOR_TOKENS` / L3 `COLOR_SHADES`+`twText/twBg/twBorder` / L4 `chartColors` / L5 股票红涨绿跌固定色 / L6 `SEMANTIC_COLOR_ROLES`。
- UI 颜色必须走令牌；A 股涨跌色固定，不随主题。
- **设计令牌映射表**：`docs/design-token-mapping.md` 按业务场景映射 L1–L6 使用方式；`.vscode/token-snippets.code-snippets` 提供常用令牌代码片段；`design-tokens/figma-to-project.json` 与 `project-to-figma.json` 维护设计变量↔代码令牌双向映射（54 条）。

## 架构与门禁
- 分层依赖见 `AGENTS.md` §一；新增模块按「类型→Store→Service→UI」四步集成。
- 质量门禁用**系统 Node 24** + 项目 `node_modules` 关沙箱跑：`npm run audit`（10 道）+ `tsc:prod` + `lint:colors`。
- **Husky 预提交门禁**（`.husky/pre-commit`）：lint-staged → `lint:colors` → `tsc:prod` → `audit:layers` → `audit:docs` → `verify:tokens` → `audit:tokens` → `audit:jsdoc` → `audit:complexity`，共 9 项；`pre-push` 运行 `test:clean` + `build`。
- 当前为 **11 道门禁全绿/预存不阻塞** 基线；新增代码不得触发 layers/hardcode/token/lint:colors/tests 阻塞。
- 行情 URL 已集中至 `src/config/marketDataEndpoints.ts`；API 路径/接口映射必须进 `src/config/collectConfig.ts`。

## 原子组件体系（Atomic Design）
- **四层目录**：`src/components/{atoms,molecules,organisms,templates}/`，各层有 `index.ts` 桶导出。
- **层级边界**（`audit:atomic` 强制）：atom 不引 store/service/molecule/organism/template/page/app；molecule 不引 organism/template/store/service；template 不引 organism/store/service。
- **迁移状态**：阶段 1（体系建立）✅ + 阶段 2（ui/ → atoms/molecules 物理迁移，37 文件 + shim）✅ + 阶段 3 步骤 0（`audit:atomic` 脚本）✅ + 步骤 1（input/ 18 文件 → organisms/input/）✅；待执行：步骤 2（低风险域 ~22 文件）、步骤 3（analysis/ 13 文件）。
- **shim 兼容模式**：旧路径（`ui/`、`collection/`、`pool/`、`input/`）保留纯 re-export shim，消费者引用零改动；阶段 5 统一清理。
- **注册表**：`src/components/componentRegistry.ts` 登记 sourcePath/targetPath/level/status，`migrating` → `active` 翻转跟踪迁移进度。
- **audit:atomic 基线**：0 阻断违规、203 warning（173 stale-ui-import + 30 unregistered，过渡期预期）。
- **chart/ 与 cockpit/cabin/widgets**：仅 registry 标注不物理搬（Widget 注册表耦合）。

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
- **当前基线**：综合得分 93；跨层调用 0、颜色硬编码 0、深层嵌套 7、长链式条件 0、重复 if 条件 0、JSDoc 缺失 0、文档同步 0。

## 真实开发成本与盲区（2026-07-10 复盘）
- **UI 组件调配是高成本环节**：股票池看板跨舱迁移、驾驶舱 Widget 三处注册同步、颜色硬编码回扫（峰值 140 处）占用大量时间；AI 对架构治理型改动（迁移、目录重组、引用同步）稳定性不足。
- **编码系统性与逻辑性存在盲区**：分层架构执行偏差（lib/ 被业务污染、EventBus 绕过数据流）、深层嵌套与链式条件（`complexity-scan.ts` 基线：≥4 层嵌套 103 处、≥6 分支链 0 处、重复 if 条件 39 处；历史粗略扫描 66/32/194 已不适用）、硬编码阈值/路由路径/事件名、测试与文档滞后（JSDoc 缺失 632 处）。
- **改进抓手**：四步集成顺序必须门禁化；建立 UI 迁移检查清单；将嵌套深度/分支数/重复条件纳入 CI；常量优先；AI 提示词固定注入 `AGENTS.md` + `lint:colors` + JSDoc 模板。

- 个人股票研究/复盘辅助工具，非金融产品；本地 IndexedDB 自管；AI 输出标注「仅供参考非投资建议」。
- 五因子评分当前为合成种子，UI 须标「示例」；真实信号走 `detectBySector`。
