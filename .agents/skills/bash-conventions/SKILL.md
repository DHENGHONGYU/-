---
skill_id: V9-SKILL-BASH
name: "bash-conventions"
description: "项目级 Shell/Bash 执行规范与命令速查：Git Bash 路径规范（/g/ ↔ G:\\ 转换）、Python 解释器固化（受管 .venv，package.json 为真相源）、验证与门禁命令速查、执行后联动义务（改什么跑什么）、禁止命令清单。Invoke when 在本项目运行任何构建/测试/审计脚本与 Git 命令前、排查命令路径错误、或改完代码不确定该跑哪几条门禁时。"
version: v1.0.0
last_updated: 2026-08-23
change_log:
  - version: v1.0.0
    changes: "基于 S 级 Skill 5 段式骨架模板 [_SKILL-TEMPLATE.md](.agents/skills/_SKILL-TEMPLATE.md) 物理化迁移：自用户级 ~/.trae-cn/skills/v9-bash-conventions 归位项目单一物理源（AGENTS.md §十六契约的操作手册）"
    date: 2026-08-23
mandatory: false
---

# bash-conventions — 项目级 Shell 执行规范与命令速查 — v1.0.0

> 本技能是 `AGENTS.md` §十六（Bash 使用约定）的**操作手册**。§十六是契约（必须遵守什么），本技能是速查（具体怎么执行）。两者冲突时以 `AGENTS.md` 当前版本为准。

---

## 一、触发条件

- 在本项目执行任何命令前（确认路径、入口、禁项）
- 命令因路径问题失败（`/g/...` 与 `G:\...` 混淆、空格路径未加引号）
- 需要选择正确的验证/门禁命令时（改完代码不知道跑哪几条）
- 需要新增 Python 脚本入口时（解释器路径固化规则）

---

## 二、前置检查

| # | 检查项 | 方法 | 通过标准 |
|---|--------|-----|---------|
| 1 | 当前工作目录 | `pwd -W` 取 Windows 路径 | 不直接用 `pwd` 的 `/g/...` 输出 |
| 2 | Python 入口 | 一律经 `package.json` npm script，解释器为受管 `.venv\Scripts\python.exe`（package.json 为真相源） | 禁止在脚本/文档中引入第二个解释器路径 |
| 3 | 依赖安装约束 | 任何 `pip install` / `npm install` 新依赖需用户显式确认 | 禁止擅自装包 |

---

## 三、阶段化 SOP

### 1. 路径规范速查

| 场景 | 正确做法 |
|------|---------|
| Git Bash 返回 `/g/FinSightV9/...` | 转换为 `G:\FinSightV9\...`（大写盘符 + 反斜杠）再给 Windows 工具 |
| 需要当前目录 Windows 路径 | `pwd -W` |
| 路径含空格 | 一律加双引号：`"C:\Program Files\Git\bin\bash.exe"` |
| 工作区外文件 | 先复制进工作区只操作副本，禁止直接改原文件 |

### 2. 常用命令速查

**验证与门禁（改代码后）**：`npm run test`（vitest 全量）/ `npm run tsc:prod`（生产类型）/ `npm run tsc`（含测试）/ `npm run gate:quick`（6 项审计串联）/ `npm run gate:dev`（提交前）/ `npm run audit`（全量，耗时）/ `npm run lint`

**单项审计（按需）**：`audit:layers`（跨层调用）/ `audit:acl-consistency`（改 Store 后必跑）/ `audit:mock-modules` / `audit:hardcode` / `audit:deadcode` / `audit:docs` / `audit:tokens`（基线只减不增）/ `complexity-scan`

**数据字典与构建**：`build:stock-dict`（+`:verify`）/ `build:sw-industry`（+`:verify`）/ `npm run dev`（调试后必须终止）/ `npm run build`

### 3. 执行后联动义务（改什么，跑什么）

| 触发动作 | 必跑 |
|---------|------|
| 新增/修改 `src/store/` 下 Store | `npm run audit:acl-consistency` |
| 文件迁移 / 目录重构 | `npm run audit:layers` + 全文件类型旧路径扫描 |
| 回滚操作 | 回滚验证五项：`tsc` → `audit:docs` → 接口文档 → `audit:layers` → `test` |
| 修改 token/颜色相关代码 | `npm run audit:tokens` |
| 组件/Widget 迁移收尾 | `docs/ui-migration-checklist.md` 逐项核对 |

### 4. 禁止命令清单

- 任何需要 sudo / 管理员权限的命令
- `rm -rf` 指向 `src/`、`docs/`、`scripts/` 等受管目录；跨盘符删除
- `git push --force`、`git reset --hard`、`git clean -fd`（未经用户显式确认）
- 修改 `.env`、`.env.local`、`.env.development.local`（密钥类文件只读）
- 未经确认的 `npm install` / `pip install` 新依赖
- 常驻进程残留；调试启动的 dev server 用完必须终止

### 5. 执行纪律

1. 单命令默认预算 60s；构建/全量测试显式声明预期耗时
2. 有依赖的多步命令串联；独立只读命令并行发起
3. 每条命令附一句说明（为什么跑）
4. 失败如实报告退出码与 stderr，禁止掩盖为"成功"；反复失败停止重试并给安全回退

### 6. 受管沙箱内 Git 全树扫描防段错误

根因：受管沙箱对 `git status`/`git diff` 全树 `stat()/readdir()` 做文件系统拦截，偶发原生访问越权（`0xC0000005` / 退出码 -1073741819），同一命令返回行数跳变。命令选择优先顺序：
1. 判"某文件是否脏" → 单文件确定性比对：`git hash-object <文件>` 与 `git rev-parse HEAD:<path>`（HEAD 无该路径 = 未跟踪新增）
2. 需全树状态 → 禁用沙箱执行 `git status --porcelain`
3. 只读校验（`git --version`/`git config`/单文件哈希）沙箱内通常稳定

纪律：禁止盲信默认沙箱下的 `git status`/`git diff` 读数，以 blob 哈希或沙箱外结果为准。

---

## 四、陷阱与经验教训

| # | 陷阱 | 后果 | 规避 |
|---|------|-----|-----|
| 1 | 拿 `pwd` 的 `/g/...` 直接给 Windows 工具 | 路径解析失败 | `pwd -W` 或手动转换盘符格式 |
| 2 | 引入第二个 Python 解释器路径 | 环境漂移 | 一律经 package.json 固化的受管 `.venv` |
| 3 | 盲信沙箱内 `git status` 跳变读数 | 误判文件存在/修改状态 | 单文件哈希比对裁决 |
| 4 | 改完代码不跑联动门禁 | 违规混入提交 | 按 §3 联动义务表执行 |
| 5 | dev server 调试后残留 | 端口占用/资源泄漏 | 用完必须终止 |

---

## 五、完成交付物清单

| # | 交付物 | 验证方法 |
|---|--------|---------|
| 1 | 命令执行附中文说明与退出码 | 每条可追溯 |
| 2 | 改动的联动门禁实跑记录 | 退出码 0 证据 |
| 3 | 失败时如实报告 + 安全回退方案 | 无"假成功"掩盖 |
