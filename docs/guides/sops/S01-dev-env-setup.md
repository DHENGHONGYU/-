---
title: S01 · 开发环境搭建 SOP
type: sop
domain: dev-environment
phase: onboarding
tier: T2
status: active
maintainer: V9 Architecture Team
summary: "新成员从零 60 分钟内完成可启动环境：Git/Node（与 .nvmrc 一致）/Python venv + AkShare/依赖安装/Husky/IDE 插件；跨平台 Windows + macOS/Linux 双命令集；引用 how-to-troubleshooting.md 并补充缺口 1：首次 Node 版本装错的 3 步回退。"
tags: [sop, onboarding, env-setup, cross-platform, venv, nvm]
version: v1.0.0
last_updated: 2026-08-19
code_version: "2.0.0-rc.2"
doc_id: V9-DOC-SOP-001
related_docs:
  - V9-DOC-TR-001   # how-to-troubleshooting.md
  - V9-DOC-GIT-001  # git-commit-governance.md
referenced_by: [V9-DOC-SOP-002]
change_log:
  - version: v1.0.0
    changes: "Initial version：新成员 60 分钟从零到可启动环境的 9 步标准流程；跨平台双命令；补充 troubleshooting.md 缺口1：首次 Node 版本误装时的 3 步回退方案。"
    date: 2026-08-19
---

# S01 · 开发环境搭建 SOP

> **编号**：S01 · **适用场景**：新成员入项 onboarding、更换电脑、重建污染环境三种场景。  
> **执行角色**：新成员 + 1 名 Mentor（最后 Step 9 复核） · **预计耗时**：**≤ 60 分钟**（Step 4 Python venv 下载 AkShare 是瓶颈步骤，建议走内网镜像）  
> **规范等级**：🟧 强约束（T2）。**新成员首次 commit 前必须 Step 9 通过**；污染环境重建需走「全卸载 + 重装」路径，禁止半吊子"覆盖式修复"。

---

## 参考文档与缺口补充声明

| # | 文档 | 引用/补充说明 |
|---|------|--------------|
| 1 | [How to 故障排查指南](../how-to/how-to-troubleshooting.md) | 原文 5 大分类（类型/构建/网络/权限/性能）已覆盖常见问题，本文不重写；§4 Fix-1 补充**缺口 1：首次使用 nvm 时装错 Node 版本（如 nvm install 20 而非 22），如何 3 步回退不残留**。 |
| 2 | [AGENTS.md v1.6.0 §十六 Bash 约定](../../../AGENTS.md) | Windows 双平台命令规范、脚本禁止写死用户名等真相源。 |

---

## 一、前置条件（Prerequisites）

| # | 条件 | 判定 |
|---|------|------|
| PC-1 | 操作系统：Windows 11 22H2+ 或 macOS 13+ 或 Ubuntu 22.04+（3 种官方支持） | 人工核对 |
| PC-2 | 磁盘剩余空间 ≥ 10GB（node_modules + dist + venv + 备份） | `df -h` / `Get-PSDrive C` 检查 |
| PC-3 | 企业内网 + 外网访问权限（GitHub、npm registry、PyPI 镜像均可达） | `curl -I https://github.com` 200 OK |
| PC-4 | 已申请 GitHub 组织 Write 权限 + 产品仓 Clone URL（SSH 推荐） | `ssh -T git@github.com` 返回 Hi <用户名> |
| PC-5 | 新成员已阅读 AGENTS.md §一 架构分层 + §三 SKILL 列表（**心智准备**，不做强制考试） | Mentor 口头提问 3 题通过即可 |

---

## 二、操作步骤（9 步 · 跨平台双命令集）

> **标记约定**：每条命令先给出 **Windows PowerShell 5/7+**（大多数成员），紧随 `macOS / Linux (bash/zsh)` 版本。仅当两平台一致时简写「双平台：」。

### STEP 1 — 安装 Git（≥ 2.43）+ Clone 仓库

```powershell
# —— Windows ——
# 若尚未安装 Git：winget 包管理器安装（推荐）
winget install --id Git.Git -e --source winget
# 重启终端使 PATH 生效
git --version   # 预期 ≥ 2.43

# 配置身份（企业邮箱）
git config --global user.name  "张三（真名，不是别名）"
git config --global user.email "zhangsan@公司域名"
# 推荐 GPG 签名（可选但加分）
git config --global commit.gpgsign true
git config --global gpg.program "C:\Program Files\Git\usr\bin\gpg.exe"

# Clone 仓库（SSH 优先，防止 Token 过期失效）
cd d:\
git clone git@github.com:<组织>/FinSightV9.git
cd d:\FinSightV9
```

```bash
# —— macOS / Linux ——
brew install git      # macOS
sudo apt install git  # Ubuntu

git config --global user.name  "Zhang San"
git config --global user.email "zhangsan@公司域名"
cd ~/workspace
git clone git@github.com:<组织>/FinSightV9.git && cd FinSightV9
```

**通过**：`git remote -v` 显示 2 行（fetch/push 均指向组织仓）。

### STEP 2 — 安装 Node.js（**严格与 .nvmrc 对齐，禁止裸装 node MSI**）

```powershell
# —— Windows ——
# 安装 nvm-windows（版本管理）
winget install CoreyButler.NVMforWindows
# 重启终端后：
nvm list available
# 读取 .nvmrc 指定版本并安装
$NVMRC_VER = Get-Content .nvmrc -Raw
nvm install $NVMRC_VER
nvm use $NVMRC_VER
node -v   # 应与 Get-Content .nvmrc 完全一致（例如 v22.11.0）
npm  -v   # 应 ≥ 10（Node 22 自带 npm 10.x）
```

```bash
# —— macOS / Linux ——
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.zshrc   # 或 ~/.bashrc
nvm install       # 无参数时读取当前目录 .nvmrc 自动安装
nvm use
node -v && npm -v
```

**通过**：`node -v` 与 `cat .nvmrc` 字符串完全相等（差一位 patch 也算失败，强制严格一致）。

### STEP 3 — 安装项目依赖（npm ci 优先，不要裸 npm i）

```powershell
# —— 双平台 ——
# npm ci = 按 package-lock.json 精确版本安装，保证 CI/本地一致
npm ci
# 若锁文件损坏（极端情况），允许一次性 npm install，完成后立即恢复 npm ci
```

**耗时**：约 5–10 分钟（首次内网慢）。  
**通过**：无 `ERR!`，最后输出 `added XXXX packages in XXXs`，`ls node_modules/vite` 存在。

### STEP 4 — Python 虚拟环境 + AkShare（真数数据服务）

```powershell
# —— Windows（项目使用"受管 venv"，路径固定在 AGENTS.md §十六，禁止自己配 venv 根目录）———
# 4.1 若 Python ≥ 3.11 尚未安装：
winget install Python.Python.3.11 -e
# 4.2 创建受管 venv（目录与 AGENTS.md §十六保持一致，禁止自己改 venv 根目录）
# Windows 默认位于 $env:USERPROFILE\.workbuddy\binaries\python\envs\default\
python -m venv "$env:USERPROFILE\.workbuddy\binaries\python\envs\default"
# 4.3 安装 AkShare + 后端依赖（使用 PyPI 国内镜像加速，推荐阿里镜像）
node scripts/run-venv-python.cjs -m pip install --upgrade pip
node scripts/run-venv-python.cjs -m pip install akshare uvicorn fastapi pandas numpy  `
  -i https://mirrors.aliyun.com/pypi/simple/ --trusted-host mirrors.aliyun.com
# 4.4 验证
node scripts/run-venv-python.cjs -c "import akshare; print('akshare version =', akshare.__version__)"
```

```bash
# —— macOS / Linux ——
brew install python@3.11 || sudo apt install python3.11 python3.11-venv
# macOS/Linux 受管 venv 位于 $HOME/.workbuddy/binaries/python/envs/default/
python3.11 -m venv "$HOME/.workbuddy/binaries/python/envs/default"
node scripts/run-venv-python.cjs -m pip install --upgrade pip
node scripts/run-venv-python.cjs -m pip install akshare uvicorn fastapi pandas numpy \
  -i https://mirrors.aliyun.com/pypi/simple/
node scripts/run-venv-python.cjs -c "import akshare; print('akshare =', akshare.__version__)"
```

**耗时**：约 10–20 分钟（AkShare 下载体积大，建议走镜像）。  
**通过**：输出 `akshare version = 1.xx.xx`，且 `--verify-current` exit 0：

```powershell
node scripts/run-venv-python.cjs --verify-current
# → 输出 [venv] OK: interpreter=..., akshare=installed, packages=XXX
```

### STEP 5 — 配置环境变量（`.env.local`）

```powershell
# —— 双平台 ——
# 复制模板并填入真实值（参考 .env.example 的注释）
Copy-Item .env.example .env.local    # Windows
cp        .env.example .env.local    # macOS/Linux

# 关键项检查（不要使用默认占位符）
#   VITE_MCP_API_KEY=<TRAEGrant 提供>
#   VITE_APP_TITLE=FinSight V9 · 智能投研平台
#   VITE_DATA_SOURCE_TYPE=real        # 日常开发也可用 mock，但上线前必须切换 real
#   VITE_AKSHARE_ENDPOINT=http://127.0.0.1:8000
#   PYTHON_VENV_PATH=<受管 venv 绝对路径>（不填默认走 ensure-venv 路径）
notepad .env.local    # Windows；macOS: open -a "Visual Studio Code" .env.local
```

### STEP 6 — Husky v5.x 钩子激活

```powershell
# —— 双平台（npm ci 已通过 "scripts.postinstall" 自动触发；如失败手动补）
npx husky install
# 验证钩子文件存在
ls .husky/pre-commit .husky/pre-push .husky/commit-msg
```

**通过**：3 个文件均存在且 `git config --get core.hooksPath` 返回 `.husky`。

### STEP 7 — 启动开发服务器（冒烟自测）

```powershell
# —— 双平台 ——
# 终端 1：启动 AkShare 后端（真数模式可选；日常开发如未用真数可跳过本终端，仅走 Vite）
node scripts/run-venv-python.cjs -m uvicorn collect_endpoints:app --host 127.0.0.1 --port 8000 --reload

# 终端 2：启动 Vite
npm run dev
```

**通过**（30 秒内）：
- Vite 控制台无 ERROR；输出 `Local:   http://localhost:5173/`
- 浏览器访问 `http://localhost:5173/` 显示「FinSight V9 · 智能投研平台」登录页或首页
- 控制台无 500 / 404 循环（健康检查 /health 返回 JSON）

### STEP 8 — IDE / 编辑器插件配置（推荐 VSCode 1.92+）

**必须插件**（Workspace 推荐列表：`.vscode/extensions.json`，VSCode 打开仓时会弹出 Install All）：
- ✅ `dbaeumer.vscode-eslint` — ESLint 实时代错（保存时自动修复）
- ✅ `bradlc.vscode-tailwindcss` — Tailwind CSS 类名补全
- ✅ `esbenp.prettier-vscode` — Prettier 格式
- ✅ `vitest.explorer` — Vitest 侧边栏运行
- ✅ `foxundermoon.shell-format` — `.sh` 脚本格式化
- ✅ `usernamehw.errorlens` — 行内高亮 ESLint/TSC 错误

**Workspace Settings 验证**：`.vscode/settings.json` 含 `"editor.formatOnSave": true` + `"editor.defaultFormatter": "esbenp.prettier-vscode"` + `"eslint.validate": ["typescript","typescriptreact"]`（已受仓管控，勿擅自修改）。

### STEP 9 — 最终冒烟 + Mentor 复核

```powershell
# —— 双平台 ——
# 执行首次综合门禁（1 分钟，用于验证 22 步 pre-commit 能跑通）
npm run env:check
npm run audit:secrets
npm run tsc:prod
npm run audit:layers
npm run test:unit:quick
```

**Mentor 复核要点**（必做 checklist）：
1. `node -v` 与 `.nvmrc` 严格一致？
2. `git remote -v` 指向组织仓 SSH 地址？
3. `git config user.email` 是企业邮箱？
4. 打开 VSCode 打开仓 → 右下角无"ESLint 初始化失败 / TSC 初始化失败"提示？
5. `npm run dev` 启动首页正常，控制台 0 ERROR？

**Mentor 在 onboarding 记录页打勾签字，新成员才能加入 S02 日常开发。**

---

## 三、通过标准

| 项 | 通过阈值 |
|----|---------|
| STEP 1–6 均通过 | 对应判定条全部 ✅ |
| npm run dev 首页 | 无 ERROR，< 30s 启动，首页加载完成 |
| Mentor 复核 5 项 | 5/5 全 ✅ |
| 综合门禁（STEP 9） | 5 条命令 exit 0 |
| 全流程总耗时 | ≤ 60 分钟（超时即需排查，必要时走 §4 Fix-1 清理重装） |

---

## 四、常见失败与修复（Top 5 · 含 troubleshooting 缺口补充）

| # | 失败场景 | 根因 | 修复命令 / 操作 | 说明 |
|---|---------|------|---------------|------|
| Fix-1 | **首次装 Node 版本错误**（如 nvm install 20 → 装了 v20，但 .nvmrc 是 22）— **troubleshooting 文档缺口 1** | 新成员未先读 .nvmrc，直接看 Node 官网下载 LTS | **标准 3 步回退不残留**：<br>1. `nvm uninstall 20` 删错版本（Windows）/ `nvm uninstall 20`（macOS）<br>2. `nvm cache clear` 清缓存避免复用旧 bin<br>3. 重新执行 STEP 2（读 `.nvmrc` + `nvm install`）<br>**严禁**：直接下载 MSI / pkg 覆盖安装（会污染全局 node） | 🔺 troubleshooting 缺口 1 |
| Fix-2 | Python venv 报「No module named pip」/ ensurepip 缺失 | Windows Store 版 Python 默认不带 ensurepip | **修复**：卸载 Store 版 Python → 从 python.org 下载官方 3.11 安装包（勾选 "Add to PATH" + "Install pip/ensurepip"）→ 重新 STEP 4 | troubleshooting §5.2 |
| Fix-3 | npm ci 报 `EBADENGINE` Unsuported engine | Node 版本与 package.json engines 字段不匹配 | **修复**：Fix-1 后重新 STEP 2，强制严格匹配 .nvmrc | troubleshooting §2.1 |
| Fix-4 | Husky 钩子不触发（commit 时无 env:check 输出） | core.hooksPath 配置错误或文件系统非执行权限 | `git config --global --unset core.hooksPath` 后项目级重设：`npx husky install`；Windows 另需 `chmod +x .husky/*`（Git Bash） | troubleshooting §1.3 |
| Fix-5 | npm run dev 后 5173 返回 404 循环或白屏 | Vite 缓存污染或 `index.html` 注入失败 | `rm -rf node_modules/.vite dist`（Windows：`Remove-Item -Recurse -Force node_modules/.vite, dist -ErrorAction SilentlyContinue`）后重新 `npm run dev` | troubleshooting §2.2 |
| Fix-6 | Clone 后 `tests/fixtures/*.parquet` / 大二进制文件显示为 1KB 指针（LFS 未拉） | 未安装 Git LFS 或 SSH 证书缺失 LFS 端点权限 | **3 步修复**：<br>1. 安装 LFS：`winget install GitHub.GitLFS`（Win）/ `brew install git-lfs`（macOS）<br>2. 全局初始化：`git lfs install`<br>3. 在项目仓拉取：`git lfs pull`（或重新 `git clone` 一次）<br>验证：`ls -lh tests/fixtures/` 正常 ≥几十 MB，不再是 LFS pointer | 常见新人首次拉取漏装 LFS；Mentor STEP 9 应肉眼核对 |

---

## 五、证据与归档

| # | 证据 | 命名 | 生成方式 |
|---|------|------|---------|
| E1 | 新成员 9 步完整日志（Mentor 在场才有效） | `onboarding-<域账号>-YYYY-MM-DD.log` | 将 STEP 1~9 的 PowerShell / bash 历史输出 tee 到该文件 |
| E2 | Mentor 复核签字页 | `onboarding-mentor-signoff-YYYY-MM-DD.md` | 记录 5 项复核结果 + Mentor 签字 + 通过结论 |
| E3 | STEP 9 综合门禁输出 | `onboarding-gate-smoke-<域账号>.log` | 5 条命令重定向 |

**归档目录**：`docs/reports/onboarding/YYYY-MM-DD_<域账号>/`

```powershell
$whoami = $env:USERNAME
$dir="docs/reports/onboarding/$(Get-Date -Format 'yyyy-MM-dd')_$whoami"
New-Item -ItemType Directory -Force $dir
# 将三项证据放入
```

---

## 六、阶段跳转

- **前置**：PC-1 ~ PC-5 全部满足（人工核对 + 网络可达）
- **成功**：STEP 9 Mentor 复核 5/5 → 进入 [S02 日常开发与提交 SOP](./S02-dev-workflow.md)
- **失败**：总耗时 > 60 分钟或 2 项以上 BLOCK 级失败 → 执行 §4 Fix-1~Fix-3；若仍无法通过 → 切换工作机器或寻求 DevOps 同事协助
