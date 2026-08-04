---
skill_id: V9-SKILL-ENV-PATH
name: v9-windows-env-path-doctor
version: v1.0.0
last_updated: 2026-07-25
category: devops
tags: [windows, environment, path, portability, migration, project:finsightv9]
title: "Windows 环境路径硬编码诊断与修复"
description: "诊断并修复 Windows 用户目录绝对路径硬编码（C:/Users/<user>/...），使项目在 DELL↔Huawei 等多用户机器间可移植。环境优先：Step 0 从 $USERNAME/$USERPROFILE 自动取当前用户，绝不写死用户名；提供 --verify-current 正向校验工具链存在。"
agent_created: true
triggers:
  keywords: [环境迁移, 机器迁移, 换电脑, DELL, Huawei, 路径硬编码, 用户目录写死, environment migration, hardcoded user path, portable path]
  files: ["scripts/**", "src/**", "package.json", "vite.config.ts", "tsconfig*.json", ".trae/**", ".trae/skills/**"]
  events: [on_env_change]
gates: ["node .trae/skills/v9-windows-env-path-doctor/scripts/scan.cjs --verify-current 输出可移植（crossUser=0 且 sameUserHardcode=0）"]
mandatory: false
covers_docs: []
related_skills: [v9-bash-conventions]
freshness_policy:
  review_cycle: quarterly
  trigger_events: [env-migration, on_env_change, machine-replace]
search_priority: medium
search_keywords: [环境迁移, 路径硬编码, 用户目录, 机器迁移, DELL, Huawei, 可移植路径]
---

# windows-env-path-doctor

> 用途：当开发环境从一台 Windows 机器迁移到另一台（典型：用户目录由
> `C:/Users/DELL` 变为 `C:/Users/huawei`）时，项目里写死的旧用户绝对路径会
> **静默失效**（路径不存在、文件读不到、构建/脚本假成功）。本技能做三件事：
> ① 自动识别"当前用户"；② 全量扫描项目里残留的旧用户绝对路径；③ 给出可移植
> 修复方案（`%USERPROFILE%` / `$USERPROFILE` / 相对路径），并 `--verify-current`
> 正向校验工具链在当前环境是否就绪。

## 铁律（来自历史踩坑）

1. **环境优先，绝不写死用户名。** Step 0 一律从 `$USERNAME` / `$USERPROFILE`
   / `os.homedir()` 取当前用户。任何把 `DELL`/`huawei` 之类写进脚本常量的做法
   都是本技能要消灭的反模式。
2. **Grep 对 `反斜杠 + | 模式` 会假阴性。** 本仓曾用
   `C:/Users/DELL|C:\\Users\\DELL|...` 这类 alternation 让 Grep 误报"已干净"。
   **验证必须用自带扫描器 `scan.cjs`（`--verify-current` 正向校验），或大小写敏感
   的字面 `DELL` Grep 交叉确认**——不要用含 `|` 的反斜杠模式当唯一证据。
3. **路径替换脚本自修改陷阱。** 写"路径替换"脚本时，其源码若含被替换的模式串，
   且 `os.walk` 根在仓内、遍历到自己文件，会把自身模式破坏成空操作。解法：脚本
   放**仓库外**（如 `C:/Users/<user>/AppData/Local/Temp/`），walk 根在仓内触及不到。
4. **批量文件遍历/写入须 sandbox-off。** 受管运行时沙箱对全树 `stat()/readdir()`
   偶发原生段错误（退出码 139 / -1073741819），非代码问题。任何批量扫描或改写
   必须 `dangerouslyDisableSandbox: true`，否则静默失败或崩于写入前却误报成功。
5. **记忆文件里的 DELL 是病史叙述，不是真实路径，不改。** 仅修"项目代码/脚本/
   配置"里的真实硬编码；`_ref*/`、`archive/`、`docs-backup*/` 历史快照与
   `.workbuddy/memory/*` 叙述性内容忽略。

## 执行流程

### Step 0 — 识别当前环境
```bash
echo "USERNAME=$USERNAME"
echo "USERPROFILE=$USERPROFILE"
whoami
ls /c/Users/            # 确认是否存在 huawei / DELL 等用户目录
```
扫描器 `scan.cjs` 内部同样用 `process.env.USERPROFILE` 取当前用户，不写死。

### Step 1 — 运行扫描器（正向校验 + 全量扫描）
```bash
node .workbuddy/skills/windows-env-path-doctor/scripts/scan.cjs --verify-current
# 或仅扫描： node .../scan.cjs
# JSON 输出： node .../scan.cjs --json
```
扫描器会：
- 从 `USERPROFILE` 取 `currentUser`；
- 递归扫描 `src/ scripts/ python/ plugins/ public/` + 根配置（跳过
  `node_modules/ dist/ coverage/ archive/ _ref*/ docs-backup*/ cache/ outputs/
  releases/ e2e/ .git/ packages/*/node_modules/`）；
- 用 `/([A-Za-z]):[\\/]+Users[\\/]+(<name>)/` 捕获所有 `盘符:\Users\<name>`，
  **单/双反斜杠、正斜杠都覆盖**（修正 Grep 假阴性）；
- 分类：
  - `WORKBUDDY_RUNTIME`：路径位于 `.workbuddy/binaries/...` → 由 harness 解析，合法，跳过；
  - `CROSS_USER`：`<name> != currentUser` → 指向不存在的用户，**P0 必修**；
  - `SAME_USER_HARDCODE`：`<name> == currentUser` 但仍是写死用户目录 → 本机可跑、
    换机即断，**P1 可移植性必修**；
  - `.workbuddy/memory/*` 命中 → 病史叙述，忽略。

### Step 2 — 修复真实硬编码
仅对 `CROSS_USER` 与 `SAME_USER_HARDCODE` 两类动手：
- `C:/Users/DELL/Desktop/foo.csv` → `%USERPROFILE%/Desktop/foo.csv`（Windows 脚本/PS1）
  或 `path.join(os.homedir(), 'Desktop', 'foo.csv')`（Node/Python 代码）；
- 优先改**源头**，避免一次性全文替换触发"自修改陷阱"（脚本放仓外执行）。

### Step 3 — 复验
重跑 `scan.cjs --verify-current`，确认 `CROSS_USER` 与 `SAME_USER_HARDCODE`
计数归零、`--verify-current` 工具链校验通过。

## 交付物
- 扫描报告（控制台 + 可选 `--json`）；
- 必要时的修复 diff；
- 一句话结论：项目是否已环境可移植。

## 关联
- 历史根因：旧机 `C:/Users/DELL/...` 写死，换 huawei 静默失效；
- 已知唯一真实硬编码曾位于 `scripts/pressure-concentration-test.ts:446`，
  已于 commit `995d828` 修复为 `%USERPROFILE%/Desktop/...csv`。
