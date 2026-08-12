---
name: "feature-window-context-doc"
description: "诊断并修复功能窗口上下文文档无法打开的问题，覆盖IDE侧、浏览器侧、运行时侧三类场景。Invoke when user reports '无法打开功能窗口上下文文档'、'help window not opening'、'context document fails to load'、'功能窗口打不开'、'文档弹窗空白'、'点击帮助无反应'等关键词，或在安装新开发环境后遇到功能窗口/帮助面板/上下文文档加载失败。"
version: v1.0.0
last_updated: 2026-08-11
change_log:
  - version: v1.0.0
    changes: "C 类版本闭环(2026-08-11)：补全 change_log 初始条目"
    date: 2026-08-11
---

# 功能窗口上下文文档无法打开 — 诊断与修复 SKILL v1.0.0

> **定位**：开发环境与应用运行时的故障排除 SKILL。覆盖 IDE 功能窗口、浏览器弹窗、应用运行时帮助文档三类场景的根因诊断与修复。
> **适用范围**：FinSightV9 开发者及所有使用 VSCode/Cursor/Trae + Kimi WebBridge 的开发环境。
> **强制等级**：每次新环境安装/克隆后必须执行一次环境验证（§四）。

---

## 一、触发条件（Invoke When）

满足以下任一即应激活本 SKILL：

- 用户报告"无法打开功能窗口上下文文档"、"功能窗口打不开"。
- 用户描述"点击帮助/文档/?按钮无反应"、"弹窗空白"、"文档加载失败"。
- 新环境安装/克隆后，IDE 侧边栏、底部面板、AI 助手窗口无法加载项目上下文。
- Kimi WebBridge 自动化过程中，目标页面的功能窗口/文档弹窗无法打开或快照为空。
- 开发工具（VSCode/Cursor/Trae/CodeBuddy）的某些功能面板报错或显示异常。

---

## 二、根因分类速查表

| 分类 | 症状 | 概率 | 快速判断 |
|------|------|------|----------|
| **A. IDE/编辑器配置缺失** | 侧边栏空白、功能面板报错、AI 窗口无法加载 | 35% | 其他项目是否正常？ |
| **B. 浏览器弹窗拦截** | `window.open()` 无反应、新标签页被拦截 | 25% | 浏览器地址栏是否有拦截图标？ |
| **C. 依赖缺失或版本不匹配** | 功能窗口组件渲染失败、控制台报错 `MODULE_NOT_FOUND` | 20% | `npm ls` 是否有 UNMET？ |
| **D. 路径/路由配置错误** | 文档路径 404、路由守卫拦截 | 12% | Network 面板是否 404？ |
| **E. 权限/安全策略** | CSP 拦截、iframe 跨域、本地文件访问被拒 | 5% | 控制台是否有 CSP 报错？ |
| **G. AI 客户端上下文面板** | Kimi 客户端右侧上下文文件列表点击无反应、无法预览文件 | 5% | 重启客户端是否恢复？ |

---

## 三、诊断流程（5 步强制法，禁止跳步）

### Step 1 · 场景确认（锁定故障域）

首先确认问题发生在哪一侧：

```
用户报告问题
    │
    ├─→ 发生在 IDE/编辑器内部？ ──→ 进入 A 类诊断（§三.A）
    │   (侧边栏/底部面板/AI窗口)
    │
    ├─→ 发生在浏览器运行时？ ──→ 进入 B/C/D/E 类诊断（§三.B）
    │   (点击帮助按钮/文档弹窗/新窗口)
    │
    ├─→ 发生在 AI 客户端上下文面板？ ──→ 进入 G 类诊断（§三.G）
    │   (Kimi 桌面客户端右侧上下文文件列表点击无反应)
    │
    └─→ 发生在 Kimi WebBridge 自动化时？ ──→ 进入 F 类诊断（§三.F）
        (snapshot 为空/click 无反应/navigate 失败)
```

**必须收集的信息**：
- [ ] 使用的 IDE/浏览器/操作系统版本
- [ ] 问题的具体复现步骤（点击了什么、期望发生什么、实际发生什么）
- [ ] 控制台报错信息（IDE DevTools / 浏览器 F12 / WebBridge 日志）
- [ ] 是否为全新环境安装后首次出现？

### Step 2 · 环境基线检查（A 类：IDE/编辑器侧）

针对 VSCode / Cursor / Trae / CodeBuddy 的功能窗口问题：

#### 2.1 配置文件完整性检查

```bash
# 检查 IDE 配置是否存在且未损坏
ls -la .vscode/settings.json .vscode/extensions.json
ls -la .trae/settings.json .trae/mcp.json 2>/dev/null
ls -la .codebuddy/settings.local.json 2>/dev/null
```

**关键点提示**：
- `.vscode/settings.json` 必须存在，否则 IDE 功能窗口可能无法正确加载项目上下文。
- `.trae/mcp.json` 若损坏会导致 MCP 功能面板空白。

#### 2.2 扩展/插件状态检查

```bash
# VSCode: 检查必需扩展是否安装
code --list-extensions | grep -E "(eslint|prettier|typescript|tailwind)"

# 检查扩展是否有更新提示（过时扩展可能导致功能面板异常）
```

**安装时强制提示 ⭐**：
> **每次新环境安装后，必须执行**：
> 1. 安装 `.vscode/extensions.json` 中推荐的全部扩展。
> 2. 在 Cursor/Trae 中确认 AI 助手插件已启用且有网络连接。
> 3. 重启 IDE（完全退出再打开，非仅重载窗口）。

#### 2.3 工作区信任与权限

```bash
# 检查工作区是否被信任（VSCode 不受信任时部分功能禁用）
# 在 VSCode 命令面板执行: Workspaces: Manage Workspace Trust
```

#### 2.4 常见 A 类根因与修复

| 根因 | 症状 | 修复命令/操作 |
|------|------|---------------|
| 配置 JSON 语法错误 | 功能面板空白或报错 | 检查并修复 `.vscode/settings.json` 语法 |
| 扩展未安装 | 对应功能窗口缺失 | 安装 `extensions.json` 推荐列表 |
| 扩展版本过旧 | 功能异常/兼容性问题 | 更新扩展到最新版 |
| 工作区不受信任 | 部分功能被禁用 | 命令面板 → Manage Workspace Trust → 信任 |
| 缓存损坏 | 面板内容不更新或空白 | `Ctrl+Shift+P` → "Reload Window" |
| MCP 配置错误 | AI 功能窗口无法连接 | 检查 `.trae/mcp.json` 语法与路径 |

### Step 3 · 浏览器与运行时检查（B/C/D/E 类）

针对应用运行时功能窗口/弹窗无法打开：

#### 3.1 浏览器弹窗拦截检查（B 类）

```bash
# 手动验证 window.open 是否被拦截
# 在浏览器控制台执行:
(() => {
  const win = window.open('about:blank', '_blank');
  if (!win || win.closed || typeof win.closed === 'undefined') {
    return 'POPUP_BLOCKED';
  }
  win.close();
  return 'POPUP_OK';
})()
```

**修复**：引导用户将当前站点加入弹窗白名单，或使用 `window.open` 的替代方案（如 Modal/Drawer 组件内嵌文档）。

#### 3.2 依赖完整性检查（C 类）

```bash
# 每次新环境克隆后必须执行
npm ci

# 验证依赖树完整性
npm ls --depth=0

# 检查是否有 peer dependency 警告
npm ls 2>&1 | grep -E "(WARN|ERR|unmet)"
```

**安装时强制提示 ⭐**：
> **必须使用 `npm ci` 而非 `npm install`**：
> - `npm ci` 严格遵循 `package-lock.json`，确保版本一致。
> - `npm install` 可能升级依赖，导致功能组件版本不匹配。

#### 3.3 路由与路径检查（D 类）

```bash
# 验证文档/帮助路由是否存在
npx tsc --noEmit
npm run audit:routes

# 检查 public/ 目录下的静态文档是否存在
ls -la public/docs/ 2>/dev/null || echo "public/docs/ 不存在"
```

#### 3.4 安全策略检查（E 类）

```bash
# 检查 vite.config.ts 中的 CSP 配置
grep -n "Content-Security-Policy\|csp\|security" vite.config.ts

# 检查是否有 iframe 跨域限制
# 浏览器控制台搜索: Refused to frame / refused to load
```

### Step 4 · Kimi WebBridge 专项检查（F 类）

针对 WebBridge 自动化时的窗口问题：

#### 4.1 Daemon 状态检查

```bash
# Windows (PowerShell)
& "$env:USERPROFILE\.kimi-webbridge\bin\kimi-webbridge.exe" status

# 若未运行，启动它
& "$env:USERPROFILE\.kimi-webbridge\bin\kimi-webbridge.exe" start
```

#### 4.2 浏览器扩展检查

- 确认 Kimi WebBridge 浏览器扩展已安装且已启用。
- 检查扩展版本是否与 SKILL 要求一致（错误提示含 "Please update" 时需更新）。

#### 4.3 跨域 iframe 问题

若功能窗口位于跨域 iframe 中：
- `snapshot` / `click` / `fill` 仅操作顶层 frame。
- **修复**：导航到 iframe 的 URL 直接操作。

#### 4.4 `event.isTrusted` 问题

某些站点严格检查 `event.isTrusted`，会忽略 WebBridge 的合成点击：
- 症状：`click` 返回成功但页面无反应。
- **修复**：告知用户该页面需要手动交互，或使用 `cdp` 低级协议。

### Step G · AI 客户端上下文面板检查（G 类：Kimi 桌面客户端右侧上下文）

> **适用场景**：Kimi 桌面客户端右侧"上下文"面板中，文件列表显示正常，但点击文件后无法打开/预览内容，或面板空白/不更新。

#### G.1 快速恢复（90% 问题可解决）

| 操作 | 步骤 | 预期结果 |
|------|------|----------|
| **重启 Kimi 客户端** | 完全退出（任务栏托盘右键退出）→ 重新打开 | 上下文面板重新加载 |
| **重新添加文件** | 移除上下文中的文件 → 重新拖拽/选择添加 | 文件可正常点击打开 |
| **切换工作区** | 切换到其他工作区再切回 | 触发上下文面板刷新 |
| **清除客户端缓存** | Kimi 设置 → 高级 → 清除缓存 | 消除缓存损坏导致的面板异常 |

#### G.2 文件路径与权限检查

```bash
# 检查文件是否存在且可读
ls -la <文件路径>

# 检查文件路径是否包含特殊字符或中文编码问题
# 若文件路径过长或含特殊符号，尝试复制到项目根目录后重新添加
```

**常见问题**：
- 文件被移动/重命名后，上下文面板中的路径失效 → 重新添加文件。
- 文件权限不足（如只读、加密）→ 检查文件属性。
- 文件过大（> 1MB 的 markdown/txt）→ 客户端可能拒绝预览，尝试拆分文件。

#### G.3 客户端版本与网络检查

- **检查 Kimi 客户端版本**：确保为最新版（旧版本可能存在上下文面板 Bug）。
- **检查网络连接**：Kimi 客户端部分功能需联网，离线时上下文面板可能受限。
- **检查登录状态**：若登录态失效，部分功能（如上下文同步）可能不可用 → 重新登录。

#### G.4 替代方案（当面板完全无法使用时）

若上下文面板持续无法使用，可采用以下替代方式向 AI 提供文件上下文：

1. **直接粘贴代码片段**：复制关键文件内容到对话输入框。
2. **使用 `@` 提及**：在输入框中输入 `@` 后选择文件（若客户端支持）。
3. **使用 WebBridge + 本地脚本**：通过 `scripts/query-ai-memory.ts` 提取文件内容后手动发送。
4. **分文件发送**：将大文件拆分为多个小片段，逐段发送给 AI。

#### G.5 安装时强制提示 ⭐

> **每次安装或更新 Kimi 桌面客户端后，必须执行**：
> 1. 确认上下文面板能正常显示文件列表。
> 2. 随机点击 1-2 个文件，确认能打开预览。
> 3. 若无法打开，立即执行 G.1 的"重启客户端"操作。
> 4. 记录客户端版本号，便于后续问题复现时定位。

### Step 5 · 验证修复

针对 WebBridge 自动化时的窗口问题：

#### 4.1 Daemon 状态检查

```bash
# Windows (PowerShell)
& "$env:USERPROFILE\.kimi-webbridge\bin\kimi-webbridge.exe" status

# 若未运行，启动它
& "$env:USERPROFILE\.kimi-webbridge\bin\kimi-webbridge.exe" start
```

#### 4.2 浏览器扩展检查

- 确认 Kimi WebBridge 浏览器扩展已安装且已启用。
- 检查扩展版本是否与 SKILL 要求一致（错误提示含 "Please update" 时需更新）。

#### 4.3 跨域 iframe 问题

若功能窗口位于跨域 iframe 中：
- `snapshot` / `click` / `fill` 仅操作顶层 frame。
- **修复**：导航到 iframe 的 URL 直接操作。

#### 4.4 `event.isTrusted` 问题

某些站点严格检查 `event.isTrusted`，会忽略 WebBridge 的合成点击：
- 症状：`click` 返回成功但页面无反应。
- **修复**：告知用户该页面需要手动交互，或使用 `cdp` 低级协议。

### Step 5 · 验证修复

修复后必须验证：

```bash
# 1. 类型检查通过
npx tsc --noEmit

# 2. 分层审计通过
npm run audit:layers

# 3. 功能窗口可正常打开（手动测试）
# 4. 控制台无新增报错（F12 DevTools）
```

---

## 四、开发环境安装检查清单（每次新环境必做）

> **本清单必须在每次克隆/安装后执行，作为关键提示嵌入 README 或 setup 脚本。**

### 4.1 前置条件

| 检查项 | 命令 | 期望结果 | 失败处理 |
|--------|------|----------|----------|
| Node 版本 | `node -v` | 与 `.nvmrc` 一致 | `nvm use` 或安装指定版本 |
| npm 版本 | `npm -v` | ≥ 9.0 | `npm install -g npm@latest` |
| Git 配置 | `git config --list` | user.name / user.email 已设置 | `git config --global user.name/email` |

### 4.2 依赖安装

```bash
# ⚠️ 强制使用 npm ci，禁止使用 npm install
npm ci

# 验证安装成功
npm run tsc:prod
```

### 4.3 IDE 配置

```bash
# 检查配置文件存在
test -f .vscode/settings.json && echo "✅ VSCode settings OK" || echo "❌ 缺少 .vscode/settings.json"
test -f .vscode/extensions.json && echo "✅ VSCode extensions OK" || echo "❌ 缺少 .vscode/extensions.json"

# 安装推荐扩展（VSCode）
# 在 IDE 中执行: Extensions → ... → Install Recommended Extensions
```

### 4.4 功能窗口验证（安装后首次）

```bash
# 启动开发服务器
npm run dev

# 在浏览器中验证以下功能窗口/文档可正常打开：
# 1. 帮助文档弹窗
# 2. Widget 配置说明
# 3. 本地知识库导入窗口 (showDirectoryPicker)
# 4. 数据测试页面
```

### 4.5 MCP/AI 工具配置（如使用 Trae/Cursor）

```bash
# 检查 MCP 配置
test -f .trae/mcp.json && cat .trae/mcp.json | head -20

# 验证 MCP 服务可连接
npm run audit:mcp
```

### 4.6 AI 客户端上下文面板验证（每次 Kimi 客户端更新后必做）

> **关键提示**：Kimi 桌面客户端右侧"上下文"面板是 AI 辅助开发的核心入口，必须确保可用。

```bash
# 验证步骤（手动）：
# 1. 打开 Kimi 桌面客户端，确认已登录
# 2. 将 2-3 个项目文件（如 README.md、AGENTS.md）添加到上下文面板
# 3. 点击每个文件，确认能打开预览内容
# 4. 若点击无反应 → 完全退出客户端 → 重新打开 → 重试
# 5. 若仍无法打开 → 清除客户端缓存（设置 → 高级 → 清除缓存）
```

**常见根因**：
- 客户端缓存损坏 → 清除缓存或重启客户端。
- 文件路径包含特殊字符 → 重命名文件或复制到英文路径后重新添加。
- 客户端版本 Bug → 更新到最新版或回退稳定版。
- 文件过大 → 拆分为小文件（建议单文件 < 500KB）。

---

## 五、常见根因与修复速查表

| # | 根因 | 场景 | 修复方案 |
|---|------|------|----------|
| 1 | `npm install` 导致依赖漂移 | 功能组件版本不匹配 | 删除 `node_modules`，改用 `npm ci` |
| 2 | IDE 扩展未安装 | 功能面板缺失/空白 | 安装 `.vscode/extensions.json` 推荐列表 |
| 3 | 工作区不受信任 | VSCode 部分功能禁用 | 信任工作区 |
| 4 | 浏览器弹窗拦截 | `window.open` 无反应 | 添加站点白名单或改用 Modal |
| 5 | `showDirectoryPicker` 未定义 | 本地文档导入窗口打不开 | 确认使用 HTTPS 或 localhost |
| 6 | WebBridge daemon 未启动 | 自动化时窗口无法操作 | 手动启动 daemon |
| 7 | CSP 策略拦截 | 文档 iframe 无法加载 | 调整 `vite.config.ts` CSP 配置 |
| 8 | 路由未注册 | 帮助文档 404 | 检查路由配置与注册 |
| 9 | IndexedDB 初始化失败 | 本地功能窗口无数据 | 检查浏览器存储权限与配额 |
| 10 | AI 记忆索引损坏 | IDE 上下文文档加载失败 | 重建索引：`npx tsx scripts/rebuild-ai-memory.ts` |
| 11 | **Kimi 客户端缓存损坏** | **上下文面板点击文件无反应** | **完全退出客户端 → 重新打开 → 或清除缓存** |
| 12 | **文件路径含特殊字符** | **上下文面板文件无法预览** | **重命名为英文路径后重新添加** |
| 13 | **Kimi 客户端版本 Bug** | **上下文面板空白或不更新** | **更新到最新版或回退稳定版** |

---

## 六、红线清单（禁止事项）

- ❌ **禁止在新环境中使用 `npm install` 替代 `npm ci`**（导致依赖漂移，功能组件版本不兼容）。
- ❌ **禁止跳过 IDE 扩展安装**（功能窗口依赖扩展提供的 API）。
- ❌ **禁止忽略弹窗拦截而不提供替代方案**（影响用户体验）。
- ❌ **禁止在不验证 tsc 通过的情况下提交修复**（可能引入新类型错误）。
- ❌ **禁止忽略 WebBridge 版本不匹配警告**（自动化行为不可预期）。
- ❌ **禁止在 Kimi 客户端上下文面板异常时继续开发**（先修复上下文面板，确保 AI 能正常加载文件）。
- ❌ **禁止将 > 1MB 的大文件直接加入上下文面板**（可能导致客户端卡顿或预览失败）。

---

## 七、验证命令汇总

```bash
# === 环境基线验证 ===
node -v && npm -v
git config --list | grep -E "user\.(name|email)"

# === 依赖验证 ===
npm ci
npm ls --depth=0 2>&1 | grep -E "(WARN|ERR)" || echo "依赖树干净"

# === 项目健康验证 ===
npm run tsc:prod
npm run audit:layers
npm run audit:mcp

# === IDE 配置验证 ===
test -f .vscode/settings.json && echo "✅" || echo "❌ 缺少 VSCode settings"
test -f .vscode/extensions.json && echo "✅" || echo "❌ 缺少 VSCode extensions"

# === 运行时功能窗口验证（手动） ===
# 1. npm run dev
# 2. 打开 http://localhost:5173
# 3. 点击各功能模块的帮助/文档按钮
# 4. 确认弹窗/新窗口/侧边栏正常加载

# === AI 客户端上下文面板验证（每次 Kimi 更新后） ===
# 1. 打开 Kimi 桌面客户端
# 2. 添加 2-3 个文件到上下文面板
# 3. 点击每个文件，确认能打开预览
# 4. 若无法打开 → 完全退出客户端 → 重新打开 → 重试
# 5. 若仍无法打开 → 清除客户端缓存 → 重新登录
# 1. npm run dev
# 2. 打开 http://localhost:5173
# 3. 点击各功能模块的帮助/文档按钮
# 4. 确认弹窗/新窗口/侧边栏正常加载
```

---

## 八、变更日志

### v1.1.0 (2026-07-13)
- 新增 **G 类诊断：AI 客户端上下文面板**（Kimi 桌面客户端右侧上下文文件点击无反应）。
- 新增快速恢复方案（重启客户端、重新添加文件、清除缓存、切换工作区）。
- 新增替代方案（直接粘贴代码片段、`@` 提及、WebBridge 脚本、分文件发送）。
- 在红线清单中新增"禁止在上下文面板异常时继续开发"。
- 在验证命令中新增 AI 客户端上下文面板验证步骤。
- 在根因速查表中新增 3 项 Kimi 客户端相关根因（缓存损坏、路径特殊字符、版本 Bug）。

### v1.0.0 (2026-07-13)
- 初始版本，覆盖 IDE 侧、浏览器侧、WebBridge 侧三类场景。
- 定义 5 步强制诊断流程与开发环境安装检查清单。
- 建立 10 项常见根因速查表与红线清单。
