---
skill_id: V9-SKILL-BASH
name: bash-conventions
description: FinSightV9 项目级 Bash 执行规范与命令速查技能。当需要在本项目运行任何 shell 命令（构建、测试、审计脚本、Git、Python 脚本、文件操作）时使用；也适用于排查命令路径错误（/g/ 与 G:\ 混淆）、Python 解释器漂移、门禁命令选择困难等问题。
agent_created: true
tags:
  - bash
  - shell
  - conventions
  - cheatsheet
  - project:finsightv9
triggers:
  keywords: [跑命令, 执行脚本, npm run, Git Bash, 路径转换, 终端操作, 构建, 跑测试, 审计脚本, Python 脚本, pip, vitest, tsc, 门禁]
  files: []
  events: [bash-invoke, command-failure, path-error]
gates:
  - 按正文 §4「执行后联动义务」表选择必跑命令（改什么跑什么）
mandatory: false
covers_docs: [AGENTS.md §十六]
---

# bash-conventions — FinSightV9 Bash 执行规范与命令速查

本技能是 `AGENTS.md` §十六（Bash 使用约定，v1.5.2 新增）的**操作手册**。§十六是契约（必须遵守什么），本技能是速查（具体怎么执行）。两者冲突时以 `AGENTS.md` 当前版本为准。

## 触发词

跑命令、执行脚本、npm run、Git Bash、路径转换、终端操作、构建、跑测试、审计脚本、Python 脚本、pip、vitest、tsc、门禁。

## 何时使用

- 在本项目执行任何 Bash 命令前（确认路径、入口、禁项）。
- 命令因路径问题失败时（`/g/...` 与 `G:\...` 混淆、空格路径未加引号）。
- 需要选择正确的验证/门禁命令时（改完代码不知道跑哪几条）。
- 需要新增 Python 脚本入口时（解释器路径固化规则）。

## 1. 路径规范速查

| 场景 | 正确做法 |
|------|---------|
| Git Bash 返回 `/g/FinSightV9/...` | 转换为 `G:\FinSightV9\...`（大写盘符 + 反斜杠）再给 Windows 工具使用 |
| 需要当前目录 Windows 路径 | `pwd -W`（不要拿 `pwd` 的 `/g/...` 输出直接用） |
| 路径含空格 | 命令行中一律加双引号：`"C:\Program Files\Git\bin\bash.exe"` |
| 工作区外文件 | 先复制进 `G:\FinSightV9`，只操作副本；禁止直接改原文件 |

## 2. Python 环境（固化，禁止漂移）

- 项目 Python 脚本一律经 `package.json` npm script 调用，解释器已固化为受管 venv：
  `C:/Users/DELL/.workbuddy/binaries/python/envs/default/Scripts/python.exe`
- 新增 Python 脚本入口 = 在 `package.json` 登记 npm script 并沿用同一路径；禁止在脚本/文档/提示词中引入第二个解释器路径。
- 禁止向系统 Python 或受管 venv 安装依赖；任何 `pip install` 需用户显式确认。

## 3. 常用命令速查表

### 验证与门禁（改代码后）

| 目的 | 命令 |
|------|------|
| 单元测试（全量一次跑完） | `npm run test`（即 `vitest run`） |
| 类型检查（生产配置） | `npm run tsc:prod` |
| 类型检查（含测试配置） | `npm run tsc` |
| 快速门禁（6 项审计串联） | `npm run gate:quick` |
| 提交前门禁（lint-staged + tsc + 审计） | `npm run gate:dev` |
| 全量审计（22 项，耗时长） | `npm run audit` |
| ESLint | `npm run lint` |

### 单项审计（按需）

| 场景 | 命令 |
|------|------|
| 跨层调用违规 | `npm run audit:layers` |
| ACL 白名单一致性（改 Store 后必跑） | `npm run audit:acl-consistency` |
| Mock 残留审查 | `npm run audit:mock-modules` |
| 硬编码颜色/数值 | `npm run audit:hardcode` |
| 死代码 | `npm run audit:deadcode` |
| 文档同步 | `npm run audit:docs` |
| Token 合规（基线只减不增） | `npm run audit:tokens` |
| 圈复杂度 | `npm run complexity-scan` |

### 数据字典与构建

| 目的 | 命令 |
|------|------|
| 生成股票字典 | `npm run build:stock-dict` |
| 校验股票字典 | `npm run build:stock-dict:verify` |
| 生成申万行业 | `npm run build:sw-industry` |
| 校验申万行业覆盖 | `npm run build:sw-industry:verify` |
| 开发服务器（调试后必须终止） | `npm run dev` |
| 生产构建 | `npm run build` |

## 4. 执行后联动义务（改什么，跑什么）

| 触发动作 | 必跑 |
|---------|------|
| 新增/修改 `src/store/` 下 Store | `npm run audit:acl-consistency` |
| 文件迁移 / 目录重构 | `npm run audit:layers` + 全文件类型旧路径扫描（§二） |
| 回滚操作 | §二 回滚验证五项：`tsc` → `audit:docs` → 接口文档 → `audit:layers` → `test` |
| 修改 token/颜色相关代码 | `npm run audit:tokens`（违规基线只减不增） |
| 组件/Widget 迁移收尾 | `docs/ui-migration-checklist.md` 逐项核对 |

## 5. 禁止命令清单（契约 §16.4 摘要）

- 任何需要 sudo / 管理员权限的命令。
- `rm -rf` 指向 `src/`、`docs/`、`scripts/` 等受管目录；跨盘符删除。
- `git push --force`、`git reset --hard`、`git clean -fd`（未经用户显式确认）。
- 修改 `.env`、`.env.local`、`.env.development.local`（密钥类文件只读）。
- 未经用户确认的 `npm install` / `pip install` 新依赖。
- 交互式或常驻进程命令；调试启动的 dev server 用完必须终止，禁止残留后台 Node/Vite 进程。

## 6. 执行纪律

1. 单命令默认预算 60s；构建/全量测试类显式声明预期耗时。
2. 有依赖关系的多步命令用 `&&` 串联；独立只读命令并行发起。
3. 每条命令附一句中文说明（为什么跑）。
4. 失败时如实报告退出码与 stderr，禁止掩盖为"成功"；工具反复失败时停止重试并给出安全回退方案。
