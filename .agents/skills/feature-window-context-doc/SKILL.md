---
skill_id: V9-SKILL-FEATURE-WINDOW-CONTEXT-DOC
name: "feature-window-context-doc"
description: "诊断并修复功能窗口上下文文档无法打开的问题，覆盖IDE侧、浏览器侧、运行时侧三类场景。Invoke when user reports '无法打开功能窗口上下文文档'、'help window not opening'、'context document fails to load'、'功能窗口打不开'、'文档弹窗空白'、'点击帮助无反应'等关键词，或在安装新开发环境后遇到功能窗口/帮助面板/上下文文档加载失败；Kimi WebBridge 自动化时 snapshot/click 无反应、新克隆后首次启动 IDE 侧边栏空白。"
version: "v1.0.2"
last_updated: "2026-08-23"
change_log:
  - version: v1.0.2
    changes: "跨平台 SKILL 体系统一(2026-08-23)：补全 skill_id 对齐 registry，junction 单一物理源加载，统一索引与跨平台加载契约登记"
    date: 2026-08-23
  - version: v1.0.1
    changes: "Batch-B P0-1 段补齐：基于 S 级 Skill 5 段式骨架模板重构，原 8 段自定义长文（触发条件+根因分类+诊断5步+环境检查清单+根因速查表+红线清单+验证命令+变更日志，含 Step4/Step5 重复段与 G 类 Kimi 客户端专项）合并重映射为标准一~五段；§二前置检查合并场景分类铁律+环境基线表格化（7 项），保留原 6 类根因概率速查为 §二附录；§三诊断 SOP 拆 5 个 Phase（场景锁定→IDE侧→浏览器/运行时→Kimi客户端/WebBridge→验证修复）；§四扩展至 8 条教训（后果+规避双字段），固化 npm ci 禁止 npm install 等红线；§五交付物≥10 项+必要且充分条件声明。"
    date: 2026-08-21
  - version: v1.0.0
    changes: "C 类版本闭环(2026-08-11)：补全 change_log 初始条目"
    date: 2026-08-11
mandatory: false
---

# 功能窗口上下文文档诊断修复技能 — v1.0.1

> **版本**: v1.0.1 | **日期**: 2026-08-21 | **校验基准**: V9 新环境安装 SOP + VSCode/Cursor/Trae 工作区配置基线 + Kimi 桌面客户端 v2.0+
> **适用范围**: FinSightV9 开发者 — IDE 功能窗口 / 浏览器帮助弹窗 / Kimi 桌面客户端上下文面板 / WebBridge 自动化四类场景
> **输出格式**: 故障域定位 → 根因对照表 → 分 Phase 修复命令 → 验证结果 → 交付物勾表

---

## 一、触发条件（Invoke When · RULE-TPL 三标签标注：显式触发 / 脚本/审计触发 / 设计/协议触发）

- **显式触发 1**：用户明确报错「无法打开功能窗口上下文文档」「help window not opening」「context document fails to load」「功能窗口打不开」「文档弹窗空白」「点击帮助无反应」等关键词
- **显式触发 2**：应用运行时点击帮助按钮/文档按钮/问号图标无反应；文档 404 / iframe 跨域加载失败；控制台报 CSP / MODULE_NOT_FOUND / 新标签页被拦截
- **脚本/审计触发 3**：Kimi WebBridge / Playwright / agent-browser 自动化过程中目标页面的功能窗口/文档弹窗无法打开、`snapshot` 为空、`click` 返回成功但页面无反应（event.isTrusted 假触发问题）
- **脚本/审计触发 4**：新 IDE / 新环境安装后，运行健康检查脚本（`check-ide-feature-window.bat` 或 `node scripts/ide/check-feature-window.js`）FAIL；或 husky 启动前的环境自检报窗口/文档能力异常
- **设计/协议触发 5**：克隆/安装新开发环境；IDE（VSCode / Cursor / Trae / WorkBuddy / CodeBuddy）版本大升级；侧边栏扩展 / 底部面板组件 / AI 助手窗口新增或配置 schema 变更；功能窗口路由注册 / 文档静态资源 CDN 路径变更后需要回归

**不触发场景 · 减少误激活**：
- 已知的功能窗口实现未完成（功能处于 Beta/Coming-soon 状态，无对应文档）；
- 纯浏览器网络断开/文件系统权限被禁用等环境外部问题（非代码缺陷）。

**协作 Skill / 链式调用**：
- IDE 前置扫描→`v9-windows-env-path-doctor`（Windows 用户目录绝对路径硬编码排查 + toolchain 存在性验证）；
- 文档资源/路径→`stale-path-reference-audit`（僵尸/失效文档路径全仓扫）+ `docs-as-mirror`（文档与代码同步）；
- 开发环境模板→`doc-management-principles`（项目级 README / onboarding 文档统一规范）；
- 运行时回归→`webapp-testing`（UI 功能窗口浏览器端自动化回归）。

**不触发场景 · 减少误激活**：
- 纯业务功能 Bug（与文档/帮助/上下文面板加载机制无关，如数据展示错位、表单校验失败）；
- 生产环境服务端故障（Nginx/CDN/后端 API 宕机导致页面无法访问，不属于本技能范畴）。

**协作 Skill / 链式调用**：
- 前端/环境启动→`v9-windows-env-path-doctor`（Windows 用户目录绝对路径硬编码修复，检查工具链可移植性）；
- 类型/项目健康→`v9-tsc-gate-scope-audit` + `v9-tsc-test-error-diagnosis`（IDE 报错若为 tsc 配置/测试类型错误，转交其处理）；
- 构建/性能→`v9-performance-audit`（若面板卡顿非加载失败而是性能问题，由其排查 Bundle/渲染/内存泄漏）；
- 文档同步→`doc-freshness-governance`（文档路径变更后未同步导致的 404，配合其双版本校对）。

---

## 二、前置检查

> **铁律（诊断红线 · 违反任一必走弯路）**：① **故障域必须先锁定**：IDE/浏览器运行时/Kimi 客户端/WebBridge 四类场景路径完全不同，禁止在未锁定场景的情况下盲目跑脚本碰运气；② **新环境强制 `npm ci`**：禁止用 `npm install`（依赖漂移是 20% 根因，症状为 MODULE_NOT_FOUND、渲染失败、半白屏）；③ **必收 4 条信息**才给修复方案：IDE/浏览器/OS 版本、复现步骤、控制台报错截图、是否全新环境首次出现——缺任一都要求用户补，禁止凭经验猜；④ **IDE 扩展与工作区信任不得跳过**：VSCode/Cursor 未信任工作区时 30%+ 功能被静默禁用，扩展未安装对应面板直接空白；⑤ **每次诊断先存快照**：保存 `git status` + 环境变量 + 配置文件 hash，修复失败时可回到诊断前状态；⑥ **Kimi 客户端上下文异常优先重启+清缓存**：90% 问题可通过"完全退出托盘→重开→清缓存"解决，别先开复杂调试；⑦ **大文件（>1MB）禁止直接拖入上下文**：Kimi 客户端预览会失败或卡顿，典型症状：能显示文件名但点击无反应。

| # | 检查项 | 命令 / 方法 | 通过标准 / 目的 |
|---|--------|-----------|----------------|
| 1 | 场景锁定：故障发生在哪一侧？ | 人工询问+观察：① IDE 内部？② 浏览器点击按钮？③ Kimi 桌面客户端右侧"上下文"？④ Kimi WebBridge 自动化？ | 四选一（可多类组合），后续 Phase 仅走对应分支，禁止全量乱扫 |
| 2 | 收集 4 条关键信息 | 向用户索取：① IDE/浏览器/OS 版本 ② 复现步骤（点击了什么/期望/实际） ③ 控制台报错（IDE DevTools / 浏览器 F12 / WebBridge 日志） ④ 是否全新环境首次出现 | 4/4 齐全才给修复方案；缺项明确告知用户需要补充 |
| 3 | 环境与配置基线（IDE 场景必跑） | `ls -la .vscode/settings.json .vscode/extensions.json .trae/settings.json .trae/mcp.json 2>$null`；VSCode 命令面板：`Workspaces: Manage Workspace Trust` | 配置文件存在且 JSON 语法合法；工作区已信任 |
| 4 | 依赖完整性与版本锁定（浏览器/运行时场景必跑） | `npm ci`（禁止 `npm install`）；`npm ls --depth=0 2>&1 \| grep -E '(WARN\|ERR\|unmet)'` 应为空；`node -v` 与 `.nvmrc` 一致；`npm -v` ≥ 9 | 依赖树干净；Node/npm 版本与项目基线匹配 |
| 5 | 诊断前快照保存 | `git status --short > outputs/feature-win-before.txt`；记录 `$env:USERPROFILE`、当前 IDE 安装路径 hash | 有前后对比基线，修复失败可回滚到诊断前 |
| 6 | 工具链路径可移植性（Windows 必跑） | 若 IDE 报错提示路径相关：Grep 硬编码用户根路径（形如 `<盘符>:/Users/<用户名>/`）于 `.vscode/*.json` / `.trae/*.json`；运行 `v9-windows-env-path-doctor` --verify-current | 无硬编码用户名路径（应走 `$env:USERPROFILE` / `%USERPROFILE%` 动态推导） |
| 7 | 运行时安全策略预扫（浏览器 404/CSP 场景必跑） | Grep -n `"Content-Security-Policy\|csp\|security"` vite.config.ts；`npx tsc --noEmit`；`npm run audit:routes`；`ls public/docs/ 2>$null \|\| echo 'public/docs/ 不存在'` | CSP 无误拦截；路由全部注册；静态文档路径存在 |

### 附录：原 6 类根因概率速查表（辅助场景锁定后快速定位）

| 分类 | 典型症状 | 先验概率 | 快速判断 |
|------|---------|---------|---------|
| **A. IDE/编辑器配置缺失** | 侧边栏空白、功能面板报错、AI 窗口无法加载 | 35% | 其他项目是否正常？→ 是 = 本项目配置问题；否 = IDE 全局问题 |
| **B. 浏览器弹窗拦截** | `window.open()` 无反应、新标签页被拦截 | 25% | 浏览器地址栏是否有拦截盾牌图标？→ 是 = B |
| **C. 依赖缺失或版本不匹配** | 功能窗口组件渲染失败、控制台 `MODULE_NOT_FOUND` | 20% | `npm ls` 是否 UNMET？→ 是 = C（90% 是 `npm install` 替代 `npm ci` 导致） |
| **D. 路径/路由配置错误** | 文档路径 404、路由守卫拦截 | 12% | Network 面板是否 404？→ 是 = D |
| **E. 权限/安全策略** | CSP 拦截、iframe 跨域、本地文件访问被拒 | 5% | 控制台是否含 `CSP / Refused to frame / refused to load`？→ 是 = E |
| **G. AI 客户端上下文面板 (Kimi)** | Kimi 客户端右侧上下文文件列表点击无反应、无法预览 | 5% | 完全退出 Kimi 托盘→重开是否恢复？→ 是 = G（90% 缓存损坏） |

---

## 三、阶段化 SOP

按 5 个 Phase 顺序执行：Phase 1 锁定故障域（每次必跑）→ Phase 2 IDE/编辑器分支 → Phase 3 浏览器/运行时分支 → Phase 4 Kimi 客户端 + WebBridge 分支 → Phase 5 统一验证。**仅 Phase 1 命中的场景分支需要走对应 Phase**，未命中可跳过（如：纯 Kimi 客户端问题不需走 Phase 2/3）。

### **目标**：目标场景下的功能窗口/帮助文档/上下文面板能正常打开，控制台无新增报错，`tsc` + `audit:layers` 全绿（若涉及代码修复）。

### Phase 1 · 故障域锁定（每次必跑，5 秒完成）

**交付物**: 故障域归属表（A/B/C/D/E/G + WebBridge 复选标记）

```
用户报告问题
    │
    ├─→ 发生在 IDE/编辑器内部？（侧边栏/底部面板/AI窗口） → A 类 → 走 Phase 2
    ├─→ 发生在浏览器点击帮助按钮/文档弹窗？            → B/C/D/E 类 → 走 Phase 3
    ├─→ 发生在 Kimi 桌面客户端"上下文"面板？            → G 类 → 走 Phase 4
    └─→ 发生在 Kimi WebBridge 自动化？（snapshot/click 失败） → WebBridge → 走 Phase 4
```

**门禁**：未锁定故障域前禁止输出任何修复命令。

### Phase 2 · A 类（IDE/编辑器侧）诊断与修复

**交付物**: 修复命令清单 + 验证结果

| 子步骤 | 修复点 | 命令 / 操作 | 通过标准 |
|--------|-------|------------|---------|
| 2.1 | 配置 JSON 语法校验 | 用 JSON 校验工具检查 `.vscode/settings.json` / `.trae/mcp.json`；`jq . <file >$null`（有 jq 时） | 语法合法；报错行号精确修复 |
| 2.2 | 扩展安装与更新 | VSCode：安装 `.vscode/extensions.json` 推荐全部；`code --list-extensions` 核对；旧扩展触发"更新提示"时必须更新 | 推荐扩展 100% 安装；版本非过时 |
| 2.3 | 工作区信任 | VSCode 命令面板 → `Workspaces: Manage Workspace Trust` → 信任当前工作区 | 无"不受信任"横幅 |
| 2.4 | MCP 配置连线 | `.trae/mcp.json` 路径/命令真实存在（Glob + Test-Path）；`npm run audit:mcp`（如有） | MCP Server 启动无 file not found |
| 2.5 | 终极恢复 | 以上均失败：`Ctrl+Shift+P → Reload Window`；仍失败：完全退出 IDE 托盘后重开 | 面板刷新后恢复 |

### Phase 3 · B/C/D/E 类（浏览器/运行时）诊断与修复

**交付物**: 四类根因对照表（含修复与通过标准）

**B 类 · 弹窗拦截（25%）**：
- 检测：在浏览器控制台执行 `(() => { const w = window.open('about:blank', '_blank'); if (!w || w.closed) return 'POPUP_BLOCKED'; w.close(); return 'POPUP_OK' })()`
- 修复：引导用户将当前站点加入浏览器弹窗白名单；若产品可控，优先改用 Modal/Drawer 内嵌文档（彻底绕开拦截）。

**C 类 · 依赖问题（20%）**：
```powershell
# 强制重新锁定依赖（90% 的 MODULE_NOT_FOUND 根因）
Remove-Item -Recurse -Force node_modules, package-lock.json  # 如 lock 文件污染也可删（注意：CI 必须用 package-lock.json）
npm ci                                                         # 严格按 package-lock.json 恢复
npm ls --depth=0 2>&1 | Select-String -Pattern "(WARN|ERR|unmet)"  # 应为空
```

**D 类 · 路径/路由 404（12%）**：
```powershell
# 路由注册完整
npm run audit:routes
# 文档静态资源存在
Test-Path public/docs/<target-doc>.md
# 路由守卫未误拦截
Grep -n "文档路由路径" src/config/routes.ts  # 存在且 enabled=true
```

**E 类 · CSP/跨域安全（5%）**：
- 检测：浏览器 F12 Console 搜索 `Refused to frame / Refused to load / CSP`；
- 修复：`vite.config.ts` 调整 `Content-Security-Policy` 响应头，白名单化目标文档源域名；iframe 场景启用同源或 `frame-ancestors`。

### Phase 4 · G 类（Kimi 客户端上下文）+ WebBridge 自动化修复

**交付物**: G 类快速恢复报告 + WebBridge 专项修复清单

**G 类 · Kimi 桌面客户端上下文面板（90% 用 G.1 解决）**：

| 顺序 | 操作（按序尝试，前一条成功即停） | 预期结果 |
|------|--------------------------------|---------|
| G.1 | 完全退出客户端（任务栏托盘右键 → 退出）→ 重新打开 → 再点文件 | 上下文面板刷新、可预览 |
| G.2 | 移除上下文中的文件 → 重新拖拽/选择添加 | 文件可正常点击打开 |
| G.3 | 切换工作区 → 切回；或设置 → 高级 → 清除缓存 | 触发上下文面板重建索引 |
| G.4 | 文件路径含特殊字符/中文/过长/ >1MB → 复制到项目根目录英文短路径后重新添加 | 客户端无编码/大小限制问题 |
| G.5 | 版本 Bug：更新 Kimi 客户端到最新版，或回退最近稳定版 | 升级后问题消失 |
| G.6 | 以上均失败 → 替代方案向 AI 提供上下文：①直接粘贴代码片段 ②输入框 `@` 提及（若支持） ③ WebBridge + 本地脚本提取 ④分文件发送 | 不阻塞开发，AI 能拿到文件上下文 |

**WebBridge 自动化专项**：

| 子问题 | 修复 |
|-------|------|
| Daemon 未启动 | `& "$env:USERPROFILE\.kimi-webbridge\bin\kimi-webbridge.exe" start`；status 确认 running |
| 浏览器扩展未启用/版本错 | 打开 Chrome 扩展管理，确认 WebBridge 扩展 enabled；错误提示含 "Please update" 时升级扩展 |
| 跨域 iframe 操作失败 | `snapshot/click/fill` 只操作顶层 frame → 导航到 iframe 的 src URL 直接操作 |
| `event.isTrusted` 严格站点 | 症状：`click` 返回成功但页面无反应 → 告知用户需手动交互，或改用 `cdp` 低级协议 |

### Phase 5 · 验证修复（统一四级门禁）

**交付物**: 验证全绿报告

```powershell
# === 编译期门禁（代码修复必跑）===
npx tsc --noEmit
npm run tsc:prod
npm run audit:layers

# === 功能验证（手动）===
# 浏览器场景：npm run dev → 打开 http://localhost:5173 → 点击帮助/文档按钮 → 弹窗正常 → F12 无新增 CSP/404/MODULE 报错
# IDE 场景：完全退出 IDE → 重开 → 侧边栏/AI 窗口正常显示
# Kimi 客户端场景：完全退出 → 重开 → 添加 2-3 个文件 → 每个都能点击预览
```

**判定规则**：四级门禁任意 FAIL = 回到对应 Phase 重做；不得带病通过。

---

## 四、陷阱与经验教训

| # | 陷阱 / 反模式 | 后果 | 规避方法 |
|---|-------------|------|---------|
| 1 | 新环境用 `npm install` 替代 `npm ci` | 依赖漂移（20% C 类根因）：组件版本不匹配、MODULE_NOT_FOUND、渲染失败、半白屏 | 所有文档/脚本/CI 强制 `npm ci`；红线清单声明禁止 `npm install` |
| 2 | 未锁定故障域就盲目输出修复命令 | 四类场景根因完全不同，"全量发一堆命令让用户试"浪费 30+ 分钟，还可能把配置搞坏 | Phase 1 强制先问 4 条信息并锁定 A/B/C/D/E/G/WebBridge 之一，禁止跳步 |
| 3 | Kimi 客户端上下文异常先开复杂调试，不先重启清缓存 | 90% 的 G 类问题可通过"完全退出托盘→重开→清缓存"1 分钟解决，排查 1 小时 | G 类永远先执行 G.1-G.3 快速恢复三步，失败才进入 G.4+ 深挖 |
| 4 | 扩展版本过旧/未安装但 IDE 不直接报错 | 面板空白、功能静默失效、MCP 连接不上，排查指向"网络/权限"实际是扩展缺 | Phase 2 前置表 2.2 强制 `code --list-extensions` 与 `extensions.json` 核对，缺即装 |
| 5 | 工作区未信任（VSCode/Cursor）时以为是项目 Bug | 30%+ 功能被静默禁用，报错信息模糊，反复重装也解决不了 | Phase 2 前置表 2.3 强制检查工作区信任，不受信任就引导用户信任 |
| 6 | `.vscode/settings.json` / `.trae/mcp.json` JSON 语法坏了一个逗号 | 整个配置文件被 IDE 忽略，对应面板全白，肉眼扫 JSON 很难发现 | Phase 2 前置表 2.1 强制 JSON 校验工具 / `jq .` 机器校验，禁止人工目视 |
| 7 | Kimi 上下文加入 >1MB 大 Markdown/TXT | 客户端拒绝预览：能显示文件名但点击无反应，误以为"客户端崩溃" | Phase 2 前置铁律⑦声明禁止；建议拆分 < 500KB 再添加 |
| 8 | Windows 机器硬编码用户名路径（形如 `<盘符>:/Users/<用户名>/...`） | IDE/工具链换到同事机器（如 Huawei 用户名）后，路径直接不存在，面板报 file not found | Phase 2 前置 6 强制 `v9-windows-env-path-doctor --verify-current`，用户名必须动态推导 `$env:USERPROFILE` |

---

## 五、完成交付物清单

| # | 交付物 | 对应 Phase / 来源 | 验证方法 |
|---|--------|------------------|---------|
| 1 | 故障域锁定结论（A/B/C/D/E/G + WebBridge 复选） | Phase 1 | 四选一（或多选组合）有明确勾选 + 4 条信息齐全 |
| 2 | 依赖完整性报告 + Node/npm 版本匹配 | 前置检查 4 / Phase 3-C | `npm ci` 成功；`npm ls --depth=0` 无 WARN/ERR/unmet；node -v 对齐 .nvmrc |
| 3 | IDE 配置文件校验 + 扩展安装 + 工作区信任 | 前置检查 3 / Phase 2 | .vscode/.trae JSON 语法合法；extensions.json 推荐 100% 安装；工作区 trusted |
| 4 | MCP 配置连线（AI/功能窗口需 MCP 时） | Phase 2-4 | .trae/mcp.json 路径真实存在；audit:mcp PASS（如有） |
| 5 | 浏览器场景：弹窗白名单 + CSP 放行 + 路由注册 + 静态文档存在 | Phase 3-B/D/E | POPUP_OK；无 CSP 报错；audit:routes PASS；public/docs/<目标> 存在 |
| 6 | Kimi 客户端上下文：G.1-G.3 快速恢复结果（或 G.4-G.6 替代方案） | Phase 4-G | 添加 2-3 个文件 → 全部可预览；或替代方案已能向 AI 提供上下文 |
| 7 | WebBridge 自动化：daemon 运行 + 扩展版本匹配 + iframe/event.isTrusted 处理方案 | Phase 4-WebBridge | daemon status=running；扩展版本 OK；自动化脚本对目标页面可 snapshot+click |
| 8 | 编译期门禁（代码修复时必跑） | Phase 5 | tsc --noEmit 0 新增错误 + tsc:prod 0 错误 + audit:layers 0 违规 |
| 9 | 手动功能验证录像/截图 | Phase 5 | 目标窗口/面板/弹窗正常打开 + 控制台 0 新增报错 |
| 10 | 诊断前 → 修复后 git diff + 配置文件备份 | 前置检查 5 | `git diff --stat` 变更范围符合预期；原配置有 .bak 可回滚 |
| 11 | Windows 路径可移植性审计报告（Windows 必跑） | 前置检查 6 | 0 条硬编码 `<盘符>:/Users/<用户名>/` 格式路径，全部改为 `$env:USERPROFILE` 动态推导 |
| 12 | 根因归类与概率统计（回灌知识库） | 所有 Phase 综合 | 故障→根因→修复链路完整记录；若为新根因，追加到 §二附录速查表 + §四教训 |
| 13 | 替代方案可用性报告（主方案失败时） | Phase 4-G.6 | AI 仍可通过粘贴/@提及/WebBridge 脚本/分文件拿到上下文，不阻塞开发 |
| 14 | 修复结论 PASS/FAIL + 下一步建议 | 所有 Phase 综合 | 明确：本次是否完全修复？未修复的剩余症状是什么？下一轮诊断的启动点是什么？ |

**必要且充分条件**：
- 必要条件：① 故障域锁定完成（交付物 1）+ ② 对应 Phase 下的核心交付物（IDE 场景 3/4；浏览器场景 2/5；Kimi 场景 6；WebBridge 场景 7）+ ③ 编译期门禁（代码修复时 8）+ ④ 手动功能验证（9）全部通过；
- 充分条件：1-14 项全交付 + 用户复现路径验证"问题不再出现"+ 与诊断前基线对比"无引入新的报错/功能退化"。

> 交付物 1 缺失 = 禁止声称"已诊断完成"；核心交付物未通过 = 禁止声称"已修复"。
