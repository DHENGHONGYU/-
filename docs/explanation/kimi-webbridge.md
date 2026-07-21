---
title: Kimi WebBridge 插件
type: explanation
domain: frontend
phase: planning
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "功能域: 浏览器自动化控制（导航、点击、输入、截图、PDF 保存） 版本: 1.9.21 原始路径:..."
tags: [frontend, plan, explanation]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-FRONT-045
referenced_by: [V9-DOC-META-000, V9-DOC-PROJ-331, V9-DOC-PROJ-176, V9-DOC-PROJ-097, V9-DOC-PROJ-149]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# Kimi WebBridge 插件

> **功能域**: 浏览器自动化控制（导航、点击、输入、截图、PDF 保存）  
> **版本**: 1.9.21  
> **原始路径**: [`plugins/kimi-webbridge/SKILL.md`](../../plugins/kimi-webbridge/SKILL.md)（扁平化） / [`plugins/kimi-webbridge/skills/kimi-webbridge/SKILL.md`](../../plugins/kimi-webbridge/skills/kimi-webbridge/SKILL.md)（嵌套）  
> **同步日期**: 2025-07-12

---

## 简介

Kimi WebBridge 让 AI 通过本地守护进程控制用户的真实浏览器，利用用户的实际登录会话与网站交互。支持导航、点击、输入、读取、截图、PDF 保存等操作。

守护进程地址：`http://127.0.0.1:10086`

## 工具清单

| 工具 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `navigate` | `url`, `newTab`(bool), `group_title` | `{success, url, tabId}` | 打开页面，首次调用会创建标签页 |
| `find_tab` | `url`, `active`(bool) | `{success, url, tabId}` | 选择已打开的标签页作为当前页 |
| `snapshot` | — | `{url, title, tree}` + `@e` refs | 可访问性树（文本），用于读取页面内容和定位元素 |
| `click` | `selector` (@e ref 或 CSS) | `{success, tag, text}` | 合成点击事件 |
| `fill` | `selector`, `value` | `{success, tag, mode}` | 支持 `<input>`/`<textarea>` 和 `[contenteditable]` 富文本编辑器 |
| `evaluate` | `code` (支持 async/await) | `{type, value}` | 在页面中执行 JS |
| `cdp` | `method`, `params` | 原始 CDP 响应 | Chrome DevTools Protocol 透传，底层逃逸方案 |
| `screenshot` | `format`(png\|jpeg), `quality`(0-100), `selector`, `path` | `{format, path, sizeBytes, mimeType}` | 截图保存到文件路径 |
| `network` | `cmd`(start\|stop\|list\|detail), `filter`, `requestId` | 请求/响应数据 | 网络请求监控 |
| `upload` | `selector`, `files`(string[]) | `{success, fileCount}` | 文件上传 |
| `save_as_pdf` | `paper_format`, `landscape`, `scale`, `print_background`, `path` | `{path, sizeBytes, mimeType, pageTitle}` | 将当前页面渲染为 PDF |
| `list_tabs` | — | `{success, tabs:[]}` | 查看当前会话中的标签页 |
| `close_tab` | — | `{success, closed}` | 关闭当前标签页 |
| `close_session` | — | `{success, closed}` | 关闭会话中的所有标签页 |

## 标签页与会话管理

### 当前标签页

单标签页工具（`snapshot`, `click`, `fill`, `screenshot`, `save_as_pdf`）作用于**当前标签页**——即最近一次通过 `navigate` 打开或 `find_tab` 选中的标签页。

- **打开页面**：需要页面共存时（对比、交叉引用）使用 `newTab:true`；否则省略
- **返回 earlier tab**：使用 `find_tab`，传入标签页的**完整 URL**
- 如果 `find_tab` 返回 "no open tab found"，使用 `navigate` + `newTab:true` 重新打开

### 会话（Session）

**一个任务 = 一个会话 = 一个标签页组。** 会话将所有标签页收集到一个标签页组中，方便用户查看。

- 任务开始时选一个会话名称，之后的所有命令都使用同一会话名
- 会话名应基于**任务**而非网站（如 `camping-research`, `phone-compare`）
- `group_title` 是人性化的组标签，用**用户的语言**，在第一次 `navigate` 时设置

```bash
# 第一个标签页：设置会话 + 组标签
curl -s -X POST http://127.0.0.1:10086/command \
  -d '{"action":"navigate","args":{"url":"https://example.com","newTab":true,"group_title":"任务名称"},"session":"task-name"}'

# 同一会话的另一个网站 → 自动加入同一组
curl -s -X POST http://127.0.0.1:10086/command \
  -d '{"action":"navigate","args":{"url":"https://another.com","newTab":true},"session":"task-name"}'
```

任务完成后，用户不再需要页面时调用 `close_session` 清除组。

## 调用格式

### macOS / Linux

```bash
curl -s -X POST http://127.0.0.1:10086/command \
  -H 'Content-Type: application/json' \
  -d '{"action":"navigate","args":{"url":"https://example.com","newTab":true,"group_title":"任务"},"session":"task"}'
```

### Windows (PowerShell / cmd)

Windows shell 会破坏非 ASCII 字符，**必须通过文件体发送请求**：

1. 将 JSON 写入唯一命名的临时文件（不要用 `echo`/`heredoc`）
2. 使用 `curl.exe`（不是 `curl`，PowerShell 会将其别名为 `Invoke-WebRequest`）
3. 请求完成后删除临时文件

```powershell
curl.exe -s -X POST http://127.0.0.1:10086/command -H "Content-Type: application/json" --data-binary "@$env:TEMP\webbridge-req-<random>.json"
```

## 核心使用建议

### 1. 优先使用 snapshot 而非 CSS/JS 选择器

`snapshot` 返回基于语义角色/名称的 `@e` 引用，直接使用 click/fill 即可。这些引用在 CSS 类哈希变化时依然有效。

仅在以下情况回退到 `evaluate` (JS)：
- 目标在 snapshot 中没有 `@e` 引用
- 需要 snapshot 中没有的属性（如 `href`）
- 需要复杂的事件序列或滚动

### 2. Evaluate 技巧

- 使用紧凑的 `JSON.stringify(data)`，不要加 `null, 2` 格式化
- 多次调用共享页面的 JS 作用域，重复声明 `const`/`let` 会抛出 `SyntaxError`。用 IIFE 隔离作用域：
  ```javascript
  (() => { const x = ...; return x; })()
  ```

### 3. 文本输入使用 fill

`fill` 支持：
- `<input>` / `<textarea>` → 返回 `mode: "value"`
- `[contenteditable]` 富文本编辑器（ProseMirror, TipTap, Lexical, Slate, Quill 等）→ 返回 `mode: "contenteditable"`

`fill` 是**清除并插入**：现有内容会被替换。如需追加，先通过 `evaluate` 读取当前值，拼接后再 `fill`。

### 4. 表单提交 / 特殊按键

没有单独的 "按 Enter" 工具。提交表单时直接点击提交按钮。如需派发按键事件（如 Escape 关闭弹窗）：

```bash
{"action":"evaluate","args":{"code":"document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))"}}
```

### 5. 截图

```bash
# 默认：PNG 可视区域，守护进程选择临时路径
curl ... -d '{"action":"screenshot","args":{}}'

# 可选：JPEG 质量、仅元素、自定义输出路径
curl ... -d '{"action":"screenshot","args":{"format":"jpeg","quality":60}}'
curl ... -d '{"action":"screenshot","args":{"selector":"@e123"}}'
```

自定义 `path` 会被直接写入（自动创建父目录，覆盖已有文件）。

### 6. 保存为 PDF

```bash
curl ... -d '{"action":"save_as_pdf","args":{"paper_format":"a4","landscape":false,"scale":1.0,"print_background":true,"path":"output.pdf"}}'
```

参数：
- `paper_format`: `letter`（默认）\| `a4` \| `legal` \| `a3` \| `tabloid`
- `landscape`: `false`（默认）
- `scale`: `1.0`（默认），范围 `[0.1, 2.0]`
- `print_background`: `true`（默认）— 保留背景色
- `path`: 自定义输出路径；省略时守护进程使用 OS 临时目录

PDF 大小上限 100 MB，超过则拒绝。

## 已知限制

1. **严格检查 `event.isTrusted` 的网站**：部分银行门户、验证码会忽略 `click`/`fill`（因为触发了 DOM 级别合成事件，`isTrusted=false`）。告知用户需要手动交互。（通过 `cdp` 协议级可实现可信输入，但属于高级用法）

2. **跨域 iframe**：`fill`, `click`, `evaluate`, `snapshot` 作用于顶层框架。如果目标元素在跨域 iframe 中，直接导航到 iframe 的 URL。

## 故障排除

### 工具调用失败（守护进程或扩展未就绪）

**如果无法连接守护进程，自行启动——不要询问用户。** 守护进程已运行时此操作无害。

**macOS / Linux:**
```bash
~/.kimi-webbridge/bin/kimi-webbridge start
```

**Windows (PowerShell):**
```powershell
& "$env:USERPROFILE\.kimi-webbridge\bin\kimi-webbridge.exe" start
```

然后重试工具调用。如果仍然失败——或浏览器扩展无法连接——请用户访问帮助页面：
- 英文：https://www.kimi.com/features/webbridge
- 中文：https://www.kimi.com/zh-cn/features/webbridge

**不要自动运行 `stop` / `restart` / `uninstall`** —— 这些会杀死正在运行的守护进程。

### 版本不匹配

如果工具返回 **"Please update the Kimi WebBridge extension"**，告知用户更新浏览器扩展并重试：
- 英文：https://www.kimi.com/features/webbridge
- 中文：https://www.kimi.com/zh-cn/features/webbridge

---

*本文档与 [`plugins/kimi-webbridge/SKILL.md`](../../plugins/kimi-webbridge/SKILL.md) 同步，更新时请同时修改两者。*
