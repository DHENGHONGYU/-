---
doc_id: V9-DOC-PROJ-375
title: "FinSightV9 v2.0.0-rc.2 Release Notes (Draft)"
domain: project
status: active
last_updated: 2026-08-15
---

# FinSightV9 v2.0.0-rc.2 Release Notes (Draft)

**发布日期**: 2026-08-09  
**版本类型**: Release Candidate (RC)  
**平台**: Windows x64  
**前序版本**: v2.0.0-rc.1 (2026-08-09)  

> ⚠️ **Draft 状态**: 本文件为待发布草稿，包含 v2.0.0-rc.1 之后的增量变更说明。正式推送 tag `v2.0.0-rc.2` 后将替换 `RELEASE-NOTES.md` 为最终版本。

---

## rc.2 vs rc.1 变更摘要（增量）

| 分类 | 变更项 | 严重程度 | 影响范围 |
|------|--------|---------|---------|
| 🔧 **CI/CD 修复** | Node.js 版本 20 → **22**（对齐项目 engines 约束） | **P0 阻塞** | GitHub Actions 构建流水线 |
| 🔧 **CI/CD 修复** | Torch 安装改为 CPU 索引，避免拉取 2GB+ CUDA 包 | **P0 阻塞** | GitHub Actions 构建流水线（Sidecar 体积/时长） |
| 📝 **文档修钉** | Release Notes NSIS 安装包文件名修正 + fetcherClient.ts 补录 | **P1 严重** | 发布文档准确性 |
| 📝 **文档新增** | GitHub 连接问题网络排查报告入库 | **P1 严重** | 运维/部署参考 |
| 🛡️ **安全加固** | Git stash 拦截 hook 新增 | **P2 优化** | 本地开发流程（防止大文件误 stash） |

---

## 概述

v2.0.0-rc.2 基于 rc.1 进行**构建环境级 P0 修复**，确保 GitHub Actions 自动化流水线能在 30 分钟 timeout 内成功完成 NSIS 安装包构建。核心修复：

1. **Node 版本从 20 升级到 22**：消除 CI 与项目 `package.json` engines.node (`>=22`) / `.nvmrc` (`22`) 的不一致，防止 `npm ci` 因 engines 约束失败。
2. **Torch CPU 包显式安装**：在 `pip install -r requirements.txt` 之前，单独通过 `--index-url https://download.pytorch.org/whl/cpu` 安装 `torch==2.13.0` CPU 版，避免 PyPI 默认拉取 CUDA 版（~2.2GB）导致流水线超时或打包体积爆炸。

附带：Release Notes 文档准确性修钉、网络排查报告入库、Git stash 安全拦截 hook 等非构建阻断类改进。

---

## 修复项（rc.1 → rc.2 增量）

### 1. CI Node.js 版本升级：20 → 22 (P0 — 阻塞级)

**问题**（rc.1 缺陷）：
- [package.json](file:///d:/FinSightV9/package.json#L6-L8) `engines.node: ">=22"`
- [.nvmrc](file:///d:/FinSightV9/.nvmrc) 内容为 `22`
- 但 rc.1 版本 [build-release.yml](file:///d:/FinSightV9/.github/workflows/build-release.yml#L19) 配置 `NODE_VERSION: '20'`

**影响**：
- CI 环境中 `npm ci` 可能因 engines 约束失败（`EBADENGINE`），或静默降级运行导致不兼容 API 异常
- 与本地开发环境（Node 22）不一致，出现"本地过 CI 挂"类难以复现的构建问题

**修复**（rc.2）：

| 文件 | 修改内容 |
|------|---------|
| `.github/workflows/build-release.yml` L19 | `NODE_VERSION: '20'` → `NODE_VERSION: '22'` |

**一致性验证**：

| 配置项 | 值 | 状态 |
|--------|---|:----:|
| package.json engines.node | `>=22` | ✅ |
| .nvmrc | `22` | ✅ |
| build-release.yml NODE_VERSION | `22` | ✅ |
| actions/setup-node@v4 supports Node 22 | 支持 | ✅ |

---

### 2. CI Torch 安装优化：显式 CPU 索引 (P0 — 阻塞级)

**问题**（rc.1 缺陷）：
- [backend/requirements.txt](file:///d:/FinSightV9/backend/requirements.txt#L83) 中 `torch==2.13.0` 未指定额外索引
- pip 默认从 PyPI 解析 torch，会优先匹配 **CUDA 版本轮子**（`torch-2.13.0+cu128`，约 2.2GB）
- GitHub Actions `windows-latest` runner 磁盘容量约 14GB，下载 + 解压 + PyInstaller 处理 CUDA DLL 链极易超时（CI timeout = 30min）
- 且 CUDA 版 torch 包含 NVCC/CUDNN 等 GPU 运行时，对桌面应用纯 CPU 推理场景完全冗余
- [v9_sidecar.spec L22](file:///d:/FinSightV9/backend/v9_sidecar.spec#L22) 注释已明确要求使用 CPU 索引安装

**影响**：
- CI 构建大概率超时失败
- 即使成功，NSIS 安装包体积会膨胀至 1.5GB+（CPU 版约 589MB）
- PyInstaller 收集 torch CUDA DLL 时可能因路径/签名问题失败

**修复**（rc.2）：

在 CI Python 依赖安装步骤中，**先单独安装 torch CPU 版**，再执行 requirements.txt（pip 会识别已安装的 torch 并跳过重复安装）：

```yaml
# build-release.yml L45-52
- name: Create Python venv & install dependencies
  run: |
    python -m venv .venv
    .venv\Scripts\python.exe -m pip install --upgrade pip
    # 先单独安装 CPU 版本 torch（避免从 PyPI 拉取 2GB+ CUDA 包导致超时）
    .venv\Scripts\python.exe -m pip install torch==2.13.0 --index-url https://download.pytorch.org/whl/cpu
    .venv\Scripts\python.exe -m pip install -r backend/requirements.txt
    .venv\Scripts\python.exe -m pip install pyinstaller
```

**轮子来源对比**：

| 配置方式 | 索引 | 匹配轮子 | 体积 | 安装耗时 |
|---------|------|---------|------|---------|
| rc.1（错误） | PyPI 默认 | `torch-2.13.0+cu128-cp314-cp314-win_amd64.whl` | ~2.2 GB | ~8-12 min（可能超时） |
| rc.2（正确） | `download.pytorch.org/whl/cpu` | `torch-2.13.0+cpu-cp314-cp314-win_amd64.whl` | ~280 MB | ~1-2 min |

> **参考经验**：当 CUDA 轮子源不可达或不需要 GPU 时，必须通过 `--index-url` 或 `--extra-index-url` 显式指定 CPU 轮子索引；否则 pip 只会从可达源解析，默认落回 CUDA 包（或因源不可达直接失败）。

**关键约束说明**：

| 约束 | 说明 |
|------|------|
| 本项目 Embedding 推理 | sentence-transformers 运行在 CPU，不需要 CUDA |
| PyInstaller 打包目标 | 桌面应用分发，CPU 版保证兼容性（不要求用户机器装 NVIDIA 驱动） |
| NSIS 安装包体积 | CPU 版约 589MB，CUDA 版约 1.5GB+，影响下载/分发效率 |
| torch 版本对齐 | CPU 索引安装的 `2.13.0+cpu` 与 requirements.txt `2.13.0` 语义兼容 |

---

### 3. Release Notes 文档准确性修钉 (P1 — 严重)

**问题 A**（rc.1 缺陷）：
- [RELEASE-NOTES.md L166](file:///d:/FinSightV9/docs/release-notes/RELEASE-NOTES.md#L166) NSIS 安装包路径写为 `FinSightV9 Setup 2.0.0.exe`，遗漏 `-rc.1` 后缀，与实际文件名不符。

**修复**：
- `release/FinSightV9 Setup 2.0.0.exe` → `release/FinSightV9 Setup 2.0.0-rc.1.exe`

**问题 B**（rc.1 缺陷）：
- 「文件变更清单」仅列 `fetcherClient.test.ts`，但 `git show 364e631d` 实际同时修改了 `fetcherClient.ts`（实现层 baseURL 修正）。

**修复**：
- 拆分为独立两行，分别标注实现文件和测试文件的变更说明。

---

## 新增文档/配置（rc.1 → rc.2 增量）

### 1. GitHub 连接问题网络排查报告 (P1 — 严重)

新增文件：`docs/release-notes/NETWORK-TROUBLESHOOTING.md`

| 章节 | 内容 |
|------|------|
| 故障现象 | git push 大流量 POST 被 RST、小流量 HTTP GET 正常的不对称行为 |
| 网络诊断 | DNS/TCP/HTTPS 三维健康检查（8 个域名） |
| 根因判定 | 运营商 DPI/防火墙 RST + Tracking Ref 污染 + Husky hook 兼容三重因素 |
| 解决方案 | 4 条路径（本地代理 > 拆分推送 > SSH 切换 > bundle 手工导出） |
| 本地已就绪 | NSIS 安装包 + RC commit + tag 本地已完备，GitHub 不可用时可离线交付 |
| 执行清单 | 网络恢复后按步骤推送和监控 Actions |

### 2. Git Stash 安全拦截 Hook (P2 — 优化)

新增文件：
- `.husky/pre-stash`
- `.husky/setup-stash-guard.sh`

**目的**：防止 `git stash` 将 `.gitignore` 中排除的大文件（如 1.3GB 模型文件、构建产物）误纳入，导致 `.git/objects` 目录膨胀。

---

## GitHub Actions 流水线行为变更总览（rc.1 → rc.2）

```
rc.1 流水线 (build-release.yml):
  ├─ Setup Node 20  ❌  ← engines 不匹配
  ├─ Setup Python 3.14
  ├─ npm ci  ⚠️ 可能 EBADENGINE
  ├─ pip install -r requirements.txt  ❌  ← 拉 CUDA torch (2.2GB)
  │                                  ↑  超时 / 体积爆炸风险
  ├─ sidecar:build (PyInstaller)
  ├─ electron:build (NSIS)
  └─ Create Draft Release

rc.2 流水线 (build-release.yml):
  ├─ Setup Node 22  ✅  ← 对齐 .nvmrc + engines
  ├─ Setup Python 3.14
  ├─ npm ci  ✅  engines 兼容
  ├─ pip install torch==2.13.0 --index-url .../cpu  ✅  ← CPU 版 (~280MB)
  ├─ pip install -r requirements.txt  ✅  ← torch 已安装，跳过
  ├─ pip install pyinstaller
  ├─ sidecar:build (PyInstaller)
  ├─ electron:build (NSIS)
  └─ Create Draft Release
```

---

## 构建预期（rc.2）

| 指标 | rc.1 (未修正) | rc.2 (修正后) | 改善 |
|------|:------------:|:------------:|------|
| Node 版本一致性 | ❌ 20 vs 22 | ✅ 22 vs 22 | 完全对齐 |
| Torch 包类型 | ⚠️ CUDA 版 (2.2GB) | ✅ CPU 版 (280MB) | 体积减少 87% |
| Torch 安装耗时 | 8-12 min (风险) | 1-2 min (稳定) | 耗时减少 80% |
| Sidecar 打包耗时 | ~6 min (CUDA DLL 多) | ~4 min (CPU DLL 精简) | 改善约 30% |
| 流水线总时长 | 高概率超时(>30min) | 预估 12-18 min | 稳定在 timeout 内 |
| NSIS 安装包体积 | ~1.5GB (CUDA 冗余) | ~589 MB (CPU 精简) | 体积减少 60%+ |

---

## 测试验证清单（rc.2 CI 验证项）

推送到 GitHub 后，监控 [build-release workflow](https://github.com/DHENGHONGYU/-/actions) 以下关键步：

| Step | 验证内容 | 预期结果 |
|------|---------|---------|
| Setup Node.js | Node 版本输出 | `v22.x` |
| Install Node dependencies | `npm ci` 结果 | ✅ 通过，无 EBADENGINE 警告 |
| pip install torch (CPU) | 轮子来源 + 版本 | 显示 `download.pytorch.org/whl/cpu`，版本 `2.13.0+cpu` |
| pip install -r requirements.txt | torch 状态 | `Requirement already satisfied: torch==2.13.0` |
| sidecar:build | PyInstaller 完成 | 无 `No module named 'unittest'` 错误 |
| electron:build | NSIS 产物 | `release/FinSightV9 Setup 2.0.0-rc.2.exe` 存在 |
| Upload installer artifact | 上传成功 | 非空，文件名含 `rc.2` |
| Create GitHub Release | Draft 创建成功 | `This is a pre-release` 已勾选，内容为本文档 |

---

## 已知限制（继承 rc.1，无新增）

1. **AKShare Collector 未打包**: `akshare_collector.py` 不存在于 `backend/` 目录，Collector 服务在打包版中被跳级，数据采集使用前端直连 API 降级方案。
2. **模型延迟加载**: Embedding 模型在首次请求时加载，健康检查返回 `status=loading` 属正常行为。
3. **无代码签名**: 安装包未进行数字签名，Windows SmartScreen 可能提示风险警告。

---

## 升级指南

### 测试团队（NSIS 安装包）

1. 通过控制面板或 `Uninstall FinSightV9.exe /S` 卸载旧版本
2. 运行 `FinSightV9 Setup 2.0.0-rc.2.exe` 安装新版本
3. 首次启动后检查日志目录：`%APPDATA%\v9-intelligent-research-review-system\logs\`

### 开发者（本地构建）

1. 拉取最新代码（包含 rc.2 修复）
2. 确认 Node 版本：`node -v` → `v22.x`
3. `npm install`（应用 yargs overrides + 同步 lockfile）
4. 构建 Sidecar：
   ```powershell
   # 注意：本地也建议用 CPU 版 torch，与 CI 对齐
   .venv\Scripts\python.exe -m pip install torch==2.13.0 --index-url https://download.pytorch.org/whl/cpu
   npm run sidecar:build
   ```
5. `npm run electron:compile` 验证编译
6. `npm run electron:dev` 启动开发模式

### CI/CD 触发

```powershell
# 打 rc.2 tag 并推送（需先解决网络问题）
git tag v2.0.0-rc.2 <commit-hash>
git push origin v2.0.0-rc.2 --no-verify
# 或手动触发 workflow_dispatch，输入 version = v2.0.0-rc.2
```

---

## 文件变更清单（rc.1 → rc.2 增量）

| 文件 | 变更类型 | 严重程度 | 说明 |
|------|---------|:--------:|------|
| `.github/workflows/build-release.yml` | 修改 | **P0** | NODE_VERSION 20→22；新增 torch CPU 安装步骤（L49-50） |
| `docs/release-notes/RELEASE-NOTES.md` | 修改 | **P1** | L166 版本号修正（2.0.0 → 2.0.0-rc.1）；L205 补录 fetcherClient.ts |
| `docs/release-notes/NETWORK-TROUBLESHOOTING.md` | 新增 | **P1** | GitHub 连接问题网络排查报告（8 章节） |
| `.husky/pre-stash` | 新增 | **P2** | Git stash 拦截 hook |
| `.husky/setup-stash-guard.sh` | 新增 | **P2** | Stash guard 安装脚本 |
| `docs/release-notes/RELEASE-NOTES-v2.0.0-rc.2.md` | 新增 | **P2** | 本文件（rc.2 Draft 说明） |

---

## rc.2 推送前自检清单

- [ ] 上述 5 个修改文件 + 1 个新增文档已 `git add` 并 commit
- [ ] commit message: `chore(release): v2.0.0-rc.2 CI fix + docs update`
- [ ] git tag: `v2.0.0-rc.2` 指向正确 commit
- [ ] 可选：本地跑 `npm run electron:compile` 验证编译无回归
- [ ] 网络就绪（代理配置 / ghproxy 可达 / SSH 配置）
- [ ] 推送命令：`git push origin <commit>:refs/heads/main --no-verify` + `git push origin v2.0.0-rc.2 --no-verify`

---

**文档生成时间**: 2026-08-09 (Draft)  
**下次修订**: 推送成功并验证 CI 通过后，将本文件内容合并到 `RELEASE-NOTES.md` 并删除 Draft 后缀
