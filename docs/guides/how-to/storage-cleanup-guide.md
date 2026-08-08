# 存储清理维护指南

## 概述

FinSightV9 项目随着开发迭代，会产生大量临时文件、测试产物和缓存，导致磁盘占用膨胀。本指南描述了项目内置的自动化清理方案，帮助开发者定期释放磁盘空间。

- **清理脚本**: [scripts/cleanup-storage.ts](../../../scripts/cleanup-storage.ts)
- **CI 工作流**: [.github/workflows/storage-cleanup-weekly.yml](../../../.github/workflows/storage-cleanup-weekly.yml)
- **package.json 命令**: `clean:storage` / `clean:storage:deep` / `clean:storage:report`

---

## 一、清理级别

脚本支持两个清理级别，由浅入深：

### Safe 级（默认）

仅清理可随时重建的临时文件和测试产物，**不影响任何运行时功能**。

| 目标 | 说明 | 重建方式 |
|------|------|---------|
| `test-results/` | Playwright 测试产物（截图/trace视频） | 重跑 `npm run test:e2e` |
| `coverage/` | istanbul 覆盖率 HTML 报告 | `npm run test:coverage` |
| `.tmp/` | embedding 服务运行日志 | 运行时自动重建 |
| `verdaccio-storage/` | 本地 npm 私有仓库缓存 | `npm install` |
| `dist/` | Vite 构建产物 | `npm run build` |
| `outputs/*.log` | coverage 运行日志 | 重跑 coverage |

### Deep 级（`--deep`）

在 safe 级基础上，额外清理跨平台无用文件和重复缓存。

| 目标 | 说明 | 重建方式 |
|------|------|---------|
| `backend/wheels/` | Linux manylinux wheel 包（Windows 无法使用） | Linux 部署时 `pip download -r backend/requirements.txt` |
| `.hf_cache/models--BAAI--bge-large-zh-v1.5/` | HuggingFace 旧格式重复缓存 | 无需重建（`hub/` 下已有完整副本） |

> **注意**: Deep 级清理后，`.hf_cache/hub/models--BAAI--bge-large-zh-v1.5/`（1.74 GB 标准格式缓存）会保留，embedding 功能不受影响。

---

## 二、使用方法

### 2.1 Dry-Run 检查（不删除任何文件）

```bash
# safe 级 dry-run
npm run clean:storage

# deep 级 dry-run
npm run clean:storage:deep
```

### 2.2 执行清理

```bash
# safe 级清理（释放 ~845 MB）
npx tsx scripts/cleanup-storage.ts --execute

# deep 级清理（释放 ~1.6 GB）
npx tsx scripts/cleanup-storage.ts --deep --execute
```

### 2.3 仅查看存储占用报告

```bash
npm run clean:storage:report
```

### 2.4 命令参数一览

| 参数 | 说明 |
|------|------|
| `--execute` | 实际执行删除（默认 dry-run） |
| `--deep` | 启用 deep 级清理（默认 safe 级） |
| `--report` | 仅输出存储占用报告，不做任何操作 |

---

## 三、安全设计

1. **默认 dry-run**: 不加 `--execute` 参数时仅检查，不删除
2. **保护目录**: 脚本绝不触碰 `src/`、`docs/`、`scripts/`、`.git/`、`package-lock.json`、`.venv/`、`node_modules/`
3. **Windows EPERM 处理**: 如遇文件占用（进程持有句柄），需先停止相关进程:
   - embedding 服务: `Get-Process python | Stop-Process -Force`
   - Playwright 残留: `Get-Process chrome-headless-shell | Stop-Process -Force`
4. **GitHub Actions CI**: 仅清理 CI runner 上的产物，不影响本地磁盘；在日志中输出本地清理提醒

---

## 四、GitHub Actions 自动化

### 配置文件

[.github/workflows/storage-cleanup-weekly.yml](../../../.github/workflows/storage-cleanup-weekly.yml)

### 触发方式

- **定时**: 每周一 03:00 UTC（北京时间 11:00）
- **手动**: GitHub Actions 页面 → "Storage Cleanup (Weekly)" → Run workflow

### CI 执行内容

1. Checkout 代码 + 安装 Node 20 + tsx
2. 生成存储占用报告（CI runner 视角）
3. 执行 safe 级清理（清理 git 追踪的构建产物如 dist）
4. 清理 CI 缓存（pip / npm / apt）
5. 输出清理后报告
6. 在日志中输出开发者本地清理提醒

> **注意**: `test-results/`、`coverage/`、`.tmp/` 等目录在 `.gitignore` 中，CI checkout 不包含它们。真正的本地磁盘清理需开发者手动执行。

---

## 五、清理效果参考（2026-08-07 首次执行）

| 指标 | 清理前 | 清理后 | 释放 |
|------|--------|--------|------|
| 总大小 | 5,254 MB (5.13 GB) | 3,653 MB (3.57 GB) | 1,601 MB (30.5%) |
| 临时文件数 | ~9,608 | 0 | 9,608 |

详细报告: [outputs/storage-cleanup-report-2026-08-07.md](../../../outputs/storage-cleanup-report-2026-08-07.md)

---

## 六、常规维护建议

1. **每周执行一次 safe 级清理**，特别是在跑过 Playwright E2E 测试后
2. **每月执行一次 deep 级清理**，清理 Linux wheel 和重复缓存
3. **如长期不用 embedding 功能**，可手动删除 `.hf_cache/` 全部内容，再释放 1.74 GB
4. **避免 test-results 积压**: Playwright 配置中可限制保留的 trace 数量
