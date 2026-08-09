# FinSightV9 v2.0.0-rc.1 Release Notes

**发布日期**: 2026-08-09  
**版本类型**: Release Candidate (RC)  
**平台**: Windows x64  

---

## 概述

本次发布修复了 Electron 应用在开发和打包环境下 Python Sidecar 路径解析的核心问题，新增了完整的诊断日志体系，并完成了 PyInstaller + NSIS 端到端自动化打包流水线。

---

## 修复项

### 1. Sidecar 路径解析修复 (P0)

**问题**: `app.isPackaged` 在 `npx electron` 开发模式下返回 `true`，导致 Sidecar 使用不存在的打包路径，进程启动失败。

**修复**: 统一使用 `process.env.VITE_DEV_SERVER_URL` 作为开发/生产模式判断标准。

| 文件 | 修改内容 |
|------|---------|
| `electron/main.ts` L275 | 代理判断 `app.isPackaged` → `!process.env.VITE_DEV_SERVER_URL` |
| `electron/sidecar.ts` L348 | Sidecar 路径判断 `app.isPackaged` → `process.env.VITE_DEV_SERVER_URL` |

**路径解析策略**:

| 模式 | 判断条件 | Python 解释器 | 入口脚本 | 工作目录 |
|------|---------|--------------|---------|---------|
| 开发 | `VITE_DEV_SERVER_URL` 已设置 | `.venv\Scripts\python.exe` | `backend/sidecar_entry.py` | 项目根目录 |
| 生产 | `VITE_DEV_SERVER_URL` 未设置 | `resources/v9-python-sidecar/v9-python-sidecar.exe` | (PyInstaller 打包) | `resources/v9-python-sidecar/` |

### 2. PyInstaller frozen 模式 multiprocessing 冲突修复 (P0)

**问题**: PyInstaller 打包后，`multiprocessing.Process` 使用 spawn 方式启动子进程时，Python 注入 `--multiprocessing-fork` 参数，`argparse` 不识别该参数导致子进程崩溃 (exit code 2)。

**修复**:

| 文件 | 修改内容 |
|------|---------|
| `backend/sidecar_entry.py` L323-328 | `if __name__ == "__main__"` 块添加 `freeze_support()` 调用 |
| `backend/sidecar_entry.py` L241-250 | argparse 添加 `--multiprocessing-fork` 参数识别 (`argparse.SUPPRESS`) |

### 3. unittest 模块排除修复 (P1)

**问题**: PyInstaller spec 文件排除了 `unittest` 模块，但 `embedding_daemon` 间接依赖 `unittest.mock`，导致运行时报 `No module named 'unittest'`。

**修复**: 从 `backend/v9_sidecar.spec` 的 `excludes` 列表中移除 `unittest`。

### 4. 端口配置统一 (P1)

**问题**: 测试代码 `fetcherClient.test.ts` 误用 8765 (daemon 内部端口) 作为 AKShare Collector 的 mock baseURL，应为 8000。

**修复**: 统一端口分配标准：

| 端口 | 服务 | 前端直连 |
|------|------|---------|
| 8000 | AKShare Collector | Yes |
| 8001 | Embedding Service | Yes (via `/api/embed/*`) |
| 8765 | Embedding Daemon (内部) | No |

### 5. 依赖版本冲突修复 (P1)

**问题**: `concurrently@10.0.3` 拉入 `yargs@18.0.0` 与 `electron-builder@25.1.8` 需要的 `yargs@^17` API 不兼容。

**修复**: `package.json` 添加 npm `overrides` 强制 electron-builder 使用 `yargs@17.7.3`。

---

## 新增功能

### 诊断日志体系

在 Sidecar 启动链路的 3 个关键位置添加了结构化日志，输出到 `%APPDATA%\v9-intelligent-research-review-system\logs\`：

#### 1. 应用启动日志 (`electron-main.log`)

```
[INFO] [main] App ready, initializing... {"mode":"production","VITE_DEV_SERVER_URL":"(not set)",
  "platform":"win32","arch":"x64","electronVersion":"33.4.11","nodeVersion":"20.18.3",
  "appPath":"C:\\...\\resources\\app.asar"}
```

**输出字段**: mode, VITE_DEV_SERVER_URL, V9_PYTHON_EXE, platform, arch, electronVersion, nodeVersion, appPath

#### 2. 代理模式日志 (`electron-main.log`)

```
[INFO] [main] [Proxy] Production mode — creating Electron proxy handler
[INFO] [main] [Proxy] Development mode — Vite dev server handles proxy, skipping Electron proxy
```

#### 3. 端口绑定日志 (`electron-main.log`)

```
[INFO] [sidecar] Starting Python Sidecar {"mode":"production",
  "ports":{"daemon":8765,"embedding":8001,"collector":8000},
  "portBinding":{"daemon":"127.0.0.1:8765 (Embedding Daemon)",
                 "embedding":"127.0.0.1:8001 (Embedding Service)",
                 "collector":"127.0.0.1:8000 (AKShare Collector)"}}
```

#### 4. 路径解析日志 (`electron-main.log`)

**开发模式**:
```
[INFO] [sidecar] [Sidecar Path] Development mode path resolution {"mode":"development",
  "VITE_DEV_SERVER_URL":"http://localhost:3000","V9_PYTHON_EXE":".venv\\Scripts\\python.exe",
  "__dirname":"D:\\FinSightV9\\dist-electron","projectRoot":"D:\\FinSightV9",
  "pythonExe":".venv\\Scripts\\python.exe","entryScript":"D:\\FinSightV9\\backend\\sidecar_entry.py",
  "entryScriptExists":true}
```

**生产模式**:
```
[INFO] [sidecar] [Sidecar Path] Production mode path resolution {"mode":"production",
  "resourcesPath":"C:\\...\\resources","sidecarDir":"C:\\...\\resources\\v9-python-sidecar",
  "exe":"C:\\...\\v9-python-sidecar.exe","exeExists":true}
```

#### 5. Sidecar 进程日志 (`sidecar.log`)

记录 Python 进程的 stdout/stderr 输出，包括启动信息、Uvicorn 运行状态、健康检查结果。

### GitHub Actions 自动化流水线

新增 `.github/workflows/build-release.yml`，支持：
- Tag 推送 (`v*`) 自动触发构建
- 手动触发 (workflow_dispatch)
- 自动创建 GitHub Draft Release
- 构建产物上传为 Artifact

---

## 测试验证结果

### 开发模式

| 验证项 | 结果 |
|--------|------|
| 模式检测 | `mode=development` |
| Python 解释器 | `.venv\Scripts\python.exe` |
| 入口脚本存在 | `entryScriptExists=true` |
| 端口绑定 | 8765/8001/8000 |
| Sidecar 健康检查 | 通过 |

### 生产模式 (NSIS 安装版)

| 验证项 | 结果 |
|--------|------|
| 安装路径 | `C:\Users\<username>\AppData\Local\Programs\FinSightV9\` |
| 模式检测 | `mode=production` |
| Sidecar exe 存在 | `exeExists=true` |
| `--multiprocessing-fork` 错误 | 不出现 |
| 端口 8001 健康检查 | `status=loading, model=all-MiniLM-L6-v2` |
| 端口 8765 健康检查 | `status=loading, model=all-MiniLM-L6-v2` |
| Electron 代理 | 生产模式自动启用 |

### 构建产物

| 产物 | 路径 | 大小 |
|------|------|------|
| PyInstaller Sidecar | `dist/v9-python-sidecar/v9-python-sidecar/` | 996 MB |
| NSIS 安装包 | `release/FinSightV9 Setup 2.0.0.exe` | 589 MB |

---

## 已知限制

1. **AKShare Collector 未打包**: `akshare_collector.py` 不存在于 `backend/` 目录，Collector 服务在打包版中被跳级，数据采集使用前端直连 API 降级方案。
2. **模型延迟加载**: Embedding 模型在首次请求时加载，健康检查返回 `status=loading` 属正常行为。
3. **无代码签名**: 安装包未进行数字签名，Windows SmartScreen 可能提示风险警告。

---

## 升级指南

### 从旧版本升级

1. 通过控制面板或 `Uninstall FinSightV9.exe /S` 卸载旧版本
2. 运行 `FinSightV9 Setup 2.0.0-rc.1.exe` 安装新版本
3. 首次启动后检查日志目录：`%APPDATA%\v9-intelligent-research-review-system\logs\`

### 开发者

1. 拉取最新代码
2. `npm install` (应用 yargs overrides)
3. `npm run electron:compile` 验证编译
4. `npm run electron:dev` 启动开发模式

---

## 文件变更清单

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `electron/main.ts` | 修改 | 添加启动日志、代理模式日志；`app.isPackaged` → `VITE_DEV_SERVER_URL` |
| `electron/sidecar.ts` | 修改 | 添加端口绑定日志、路径解析日志；`app.isPackaged` → `VITE_DEV_SERVER_URL` |
| `backend/sidecar_entry.py` | 修改 | 添加 `freeze_support()`、`--multiprocessing-fork` argparse 识别 |
| `backend/v9_sidecar.spec` | 修改 | 移除 `unittest` 排除 |
| `backend/requirements.txt` | 新增 | Python 依赖清单 (95 packages) |
| `package.json` | 修改 | 添加 `overrides.yargs`、`--publish never` |
| `src/services/fetcher/fetcherClient.test.ts` | 修改 | 端口 8765 → 8000 |
| `.github/workflows/build-release.yml` | 新增 | GitHub Actions CI/CD 流水线 |
| `docs/release-notes/RELEASE-NOTES.md` | 新增 | 发布说明文档 |
