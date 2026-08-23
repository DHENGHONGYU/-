---
skill_id: V9-SKILL-ENV-PATH
name: "windows-env-path-doctor"
description: "Windows 环境路径硬编码诊断与修复：开发环境跨机器迁移（用户目录变化）时，自动识别当前用户、全量扫描项目残留的旧用户绝对路径（C:/Users/<user>/...）、给出可移植修复方案（%USERPROFILE%/os.homedir()/相对路径），并 --verify-current 正向校验。Invoke when 环境迁移/换电脑、路径静默失效排查、用户目录硬编码清理、或迁移后构建脚本假成功时。"
version: v1.0.0
last_updated: 2026-08-23
change_log:
  - version: v1.0.0
    changes: "基于 S 级 Skill 5 段式骨架模板 [_SKILL-TEMPLATE.md](.agents/skills/_SKILL-TEMPLATE.md) 物理化迁移：自用户级 ~/.trae-cn/skills/v9-windows-env-path-doctor 归位项目单一物理源（scripts/scan.cjs 扫描器随迁）"
    date: 2026-08-23
mandatory: false
---

# Windows 环境路径硬编码诊断与修复 — v1.0.0

> 用途：开发环境从一台 Windows 机器迁移到另一台（用户目录变化）时，项目里写死的旧用户绝对路径会
> **静默失效**（路径不存在、文件读不到、构建/脚本假成功）。本技能做三件事：
> ① 自动识别"当前用户"；② 全量扫描残留的旧用户绝对路径；③ 给出可移植修复并 `--verify-current` 正向校验。

---

## 一、触发条件

- 环境迁移 / 换电脑（典型：用户目录由 `C:/Users/DELL` 变为 `C:/Users/huawei`）
- 路径静默失效排查（文件读不到、脚本假成功）
- 用户目录绝对路径硬编码清理
- **文件信号**：`scripts/**`、`src/**`、`package.json`、`vite.config.ts`、`tsconfig*.json`

**协作**：命令入口与解释器规范 → `bash-conventions`。

---

## 二、前置检查

| # | 检查项 | 方法 | 通过标准 |
|---|--------|-----|---------|
| 1 | 当前环境识别 | `echo $USERNAME` / `echo $USERPROFILE` / `whoami` | 一律从环境变量取，**绝不写死用户名** |
| 2 | 扫描器可用 | `node .agents/skills/windows-env-path-doctor/scripts/scan.cjs --verify-current` | 工具链正向校验通过 |
| 3 | 修复边界确认 | 仅修"项目代码/脚本/配置"里的真实硬编码 | `_ref*/`、`archive/`、`docs-backup*/` 历史快照与 `.workbuddy/memory/*` 叙述性内容忽略 |

---

## 三、阶段化 SOP

### Step 1 — 运行扫描器（正向校验 + 全量扫描）

```bash
node .agents/skills/windows-env-path-doctor/scripts/scan.cjs --verify-current
# 仅扫描： node .agents/skills/windows-env-path-doctor/scripts/scan.cjs
# JSON 输出： ... --json
```

扫描器行为：
- 从 `USERPROFILE` 取 `currentUser`，不写死
- 递归扫描 `src/ scripts/ python/ plugins/ public/` + 根配置（跳过 `node_modules/ dist/ coverage/ archive/ _ref*/ docs-backup*/ cache/ outputs/ releases/ e2e/ .git/`）
- 正则 `/([A-Za-z]):[\\/]+Users[\\/]+(<name>)/` 捕获所有 `盘符:\Users\<name>`，**单/双反斜杠、正斜杠全覆盖**（修正 Grep 假阴性）
- 分类：
  - `WORKBUDDY_RUNTIME`：位于 `.workbuddy/binaries/...` → harness 解析，合法跳过
  - `CROSS_USER`：`<name> != currentUser` → 指向不存在用户，**P0 必修**
  - `SAME_USER_HARDCODE`：`<name> == currentUser` 但写死 → 本机可跑、换机即断，**P1 可移植性必修**
  - `.workbuddy/memory/*` 命中 → 病史叙述，忽略

### Step 2 — 修复真实硬编码

仅对 `CROSS_USER` 与 `SAME_USER_HARDCODE` 两类动手：
- `C:/Users/<user>/Desktop/foo.csv` → `%USERPROFILE%/Desktop/foo.csv`（Windows 脚本/PS1）或 `path.join(os.homedir(), 'Desktop', 'foo.csv')`（Node/Python 代码）
- 优先改**源头**，避免一次性全文替换触发"自修改陷阱"（替换脚本须放仓库外执行）

### Step 3 — 复验

重跑 `scan.cjs --verify-current`，确认 `CROSS_USER` 与 `SAME_USER_HARDCODE` 计数归零、工具链校验通过。

---

## 四、陷阱与经验教训

| # | 陷阱 | 后果 | 规避 |
|---|------|-----|-----|
| 1 | 脚本写死用户名常量 | 换机即断（本技能要消灭的反模式） | Step 0 一律从 `$USERNAME`/`$USERPROFILE`/`os.homedir()` 取 |
| 2 | Grep 用 `反斜杠+\|` alternation 模式 | 假阴性误报"已干净" | 必须用自带 `scan.cjs` 或大小写敏感字面 Grep 交叉确认 |
| 3 | 替换脚本源码含被替换模式串且 walk 到自己 | 自身模式被破坏成空操作 | 替换脚本放仓库外（如 `%TEMP%`），walk 根触及不到 |
| 4 | 沙箱内批量全树遍历/写入 | 原生段错误（退出码 139）误报成功 | 批量扫描/改写须禁用沙箱执行 |
| 5 | 把记忆文件里的旧路径当硬编码修 | 破坏病史叙述 | 仅修代码/脚本/配置的真实硬编码 |

---

## 五、完成交付物清单

| # | 交付物 | 验证方法 |
|---|--------|---------|
| 1 | 扫描报告（控制台 + 可选 `--json`） | 分类计数明确 |
| 2 | `--verify-current` 输出可移植 | `crossUser=0` 且 `sameUserHardcode=0` |
| 3 | 修复 diff（仅真实硬编码） | 历史快照/叙述内容未动 |
| 4 | 一句话结论：项目是否已环境可移植 | 结论有扫描证据支撑 |

**历史根因**：旧机用户目录写死，换机静默失效；已知唯一真实硬编码曾位于 `scripts/pressure-concentration-test.ts:446`（commit `995d828` 修复为 `%USERPROFILE%/Desktop/...csv`）。
