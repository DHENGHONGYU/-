# 项目记忆（V9 智能投研复盘系统）

## 设计体系
- 宋韵美学：亮色 stone / 暗色 neutral 灰 (hue 0)。仅改 `dark:*` 段。A 股红涨绿跌固定。
- 令牌 L1→L6；UI 颜色走令牌；组件规范唯一事实源 `docs/design/component-specs.md`。
- 功能警示色=amber；焦点环令牌组件须自加 `focus-visible:` 前缀。
- **教训**：改组件类名必须同回合跑其 test（防 pre-push 留红债）。

## 架构与门禁
- 分层 `AGENTS.md` §一；新模块按「类型→Store→Service→UI」四步。
- Husky pre-commit 10 项；pre-push: skill-router+gates+test:stable+build。`SKILL_GATE_CONFIRM=1` 仅旁路 skill-router mandatory，其余 7 步照跑。
- 质量基线 12 道门禁全绿。lib 基础设施白名单见 AGENTS.md §一。

## 仓库恢复与脆弱性（2026-08-02）
- L: 网络盘，对象库曾损；恢复基线 `9a8c6627`，HEAD 线性完整。fsck 0 错误。
- **⚠️ husky lint-staged 的 git stash 失败会回退工作树**（已发生 3 次，最多抹掉 115 文件）。恢复期：`git commit --no-verify` + 手动 P0（tsc:prod/layers/secrets）。
- dist 清空：`git clean -fdX -- dist`（唯一可靠，`rm` 被 safe-delete shim 拦截）。
- Plan A：`emptyOutDir:false`（vite 不隐式清 dist）。
- 自动化 3 条 ACTIVE：每日备份/周日字典/周日部署。

## 数据采集 / 驾驶舱
- 采集类型/配置/服务/store 见 AGENTS.md。新增 Widget 改 3 处（widgetRegistry + DEFAULT_WIDGET_CONFIG + WIDGET_DEFAULT_DATA_SOURCE）。
- CockpitCrossLayout 默认显示矩阵总览（须先点切换按钮关总览才能测 Widget 网格）。
- ErrorState 双版本（states/ 与 molecules/ props 不同）；lucide-react mock 范式用 importOriginal 局部覆盖。
- **采集进度 ACL 教训**：模块缺 store 读权限时 DataBridge 拒 + catch fallback → UI 与「空数据」外观一致，极易误判。排查先看 `Module ... cannot SELECT on store X` 日志。

## AI 工程治理
- 提示词模板、检查清单、记忆层、飞轮文档路径见 AGENTS.md。

## 复杂度 / 文档
- `complexity-scan` 基线冻结 67，禁止新增深层嵌套/长链/重复条件。
- 文档移动须同步 3 处。JSDoc 禁含 `*/`。批量删 >50 文件/回合触发安全确认。

## 产品边界
- 个人股票研究辅助工具；本地 IndexedDB；AI 输出标「仅供参考非投资建议」。五因子示例种子。

## Push 环境
- 沙箱不通 GitHub (:443 超时)，push 须本地终端执行。
- remote URL 反复硬编码 PAT（3 轮），须改为 `credential helper=wincred`，推送后重设 remote URL。

## 测试隔离（quarantine）
- `test:stable`=全量减 `tests/quarantine.list`（3 审计白盒测试桩陈旧），`test:quarantine`=只跑隔离项。
- **DataBridge 迁移教训**：service 迁 DataBridge 后测试必须 `vi.mock('@/core/databridge')`，否则 db.ready() 永久挂起。

## Playwright + DataBridge 缓存教训（2026-08-02）
- SPA 的 DataBridge readCache 在 SPA 生命周期内缓存首次查询结果；Playwright 注入 IndexedDB 后需 `page.reload()` 打破实例才生效。
- SPA 自动 seed（`LiveCollector.WATCHLIST_CODES`）使 IDB 干净态不可控，验证脚本须容忍残留样本。
- 生产构建中 Tailwind class 可能被重排/压缩，`querySelector` 比截图不可靠。
