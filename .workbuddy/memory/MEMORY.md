# 项目记忆（V9 智能投研复盘系统）— 长期要点

## 令牌体系层级（重要）
- L1 THEME_TOKENS / L2 COLOR_TOKENS / L3 COLOR_SHADES / L4 chartColors / L5 STOCK_COLOR_TOKENS（股票红涨绿跌固定色，豁免主题切换）。

## 股票涨跌颜色例外（最高优先级）
- 中国A股：涨=红、跌=绿，固定色，不随主题变。

## 产品定位与合规口径
- 个人股票研究/复盘辅助工具，非金融产品；等保/备案豁免；本地 IndexedDB 自管、AI 内容标注「仅供参考非投资建议」。

## 质量门禁运行方式（环境陷阱）
- 审计/tsx 脚本与 vitest/tsc 均须用**系统 Node 24**（`C:/Program Files/nodejs/node.exe`）+ 项目 `node_modules` **关沙箱**跑；托管 node 在中文字路径下原生段错误。
- 门禁入口：`npm run audit`（11 道）+ `tsc:prod` + `lint:colors`。
- **audit:tests 是纯正则扫描**：`/:\s*any\b/`（no-any）与 `/@ts-ignore/`（no-ts-ignore）；`as any` 不触发，仅 WARNING 级（chinese-test-description / describe.skip / no-hardcoded-colors-in-tests）不阻塞。
- **lint:colors 脚本已修正**：去掉 `--max-warnings 0`（否则被基础配置 1434 条无关 warning 误伤），现仅以颜色 error 判级。
- A_MCP 的 16 处 direct-service-import 判为纯前端本地单例合理引用 → 可接受偏离，不 churn。
- **audit:hardcode「静默回退」已闭环结案**：2026-07-08 核验其 59/60 处违规全为 `?? 0`/`?? ''`/`|| ''` 防御性兜底（非真硬编码）；v3.1 已将「静默回退」过滤出阻塞违规（`scan()` L595 `f.category !== '静默回退'`）+ 行级降 `Warning`（L539），`_audit-pipeline` 退出码仅看 `totalViolations`。本会话复跑（系统 Node24 + `tsx/dist/cli.mjs` + 关沙箱）：837 文件 / **阻塞 0 / 退出码 0** / 60 警告=静默回退 → 确认降级生效、不再阻断 `npm run audit`。✅ 结案。
  - 伴随发现（已入审查报告）：event-listener-cleanup 启发式漏识别"订阅返回值清理"（`subscribeRef.current()` 范式）、ui-hardcoded-colors 含 test/令牌定义文件误报。

## 板块轮动数据准确性
- 五因子评分当前为合成种子，UI 须标「示例」避免伪装实时；真实信号走 `detectBySector`（聚合 dailyQuotes 真实日线）。

## 通用约定
- 删除类操作须用户先确认；尽量原地改、不新增散文档；Write 覆盖测试/源码前先查磁盘是否已存在。

## 文档↔代码双向检测（D10，已沉淀 Skill）
- `code-quality-compliance` Skill 新增 D10 维度：`references/doc-code-consistency.md` + `scripts/doc-code-consistency.cjs`（零依赖，提取代码事实 + 解析 AGENTS.md 数字 + 检测 RBAC 覆盖，输出 JSON）。
- 双向三向模型：方向A(文档→代码数字比对) / 方向B(代码→文档子系统覆盖) / 方向C(文档↔文档重复过期悬空)。
- 实测关键事实（2026-07-08）：AGENTS.md 数字滞后 → services 声明20/实测21、stores 声明47/实测49（Minor，非缺失）；STORE_NAME 33 与 blueprint 期望33 已对齐✅。
- **RBAC 文档缺口（已闭合，2026-07-08）**：v24 引入 rbac 服务子域 + 6 表(rbacUsers/rbacRoles/rbacPermissions/rbacUserRoles/rbacRolePermissions/rbacPermissionAuditLogs) + 7 ENVELOPE_ACTION。原 ARCHITECTURE.md 与 DATA_DEFINITION.md 完全无 RBAC 记录（AGENTS.md 仅 :669 migration 段局部提及）；已于 2026-07-08 补录（ARCHITECTURE.md §8 + DATA_DEFINITION.md §7），缺口闭合。后续新增 RBAC 表/动作须同步这两处。
- 文档↔文档陷阱：Glob 上限100被 node_modules 截断会制造悬空引用假阴性，核对前须 `find` 排除 node_modules。
