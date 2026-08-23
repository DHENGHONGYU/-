---
title: "FinSightV9 v2.0.0-rc.2 Release Notes"
domain: project
status: active
last_updated: 2026-08-23
code_version: 2.0.0-rc.2
version: v1.1.0
change_log:
  - version: v1.1.0
    changes: "精简：删除流水线行为/验证清单/升级指南/自检清单细节，保留变更摘要+关键修复+已知限制"
    date: 2026-08-23
---

# FinSightV9 v2.0.0-rc.2 Release Notes

**发布日期**: 2026-08-09 | **版本类型**: Release Candidate | **平台**: Windows x64 | **前序版本**: v2.0.0-rc.1

## 变更摘要（rc.2 vs rc.1）

| 分类 | 变更项 | 严重程度 |
|------|--------|---------|
| 🔧 CI/CD 修复 | Node.js 20 → **22**（对齐 engines 约束） | **P0** |
| 🔧 CI/CD 修复 | Torch 改 CPU 索引，避免 2GB+ CUDA 包 | **P0** |
| 📝 文档修钉 | NSIS 安装包文件名修正 + fetcherClient.ts 补录 | **P1** |
| 📝 文档新增 | GitHub 连接问题网络排查报告 | **P1** |
| 🛡️ 安全加固 | Git stash 拦截 hook | **P2** |

## 核心修复

### 1. CI Node.js 20 → 22 (P0)

`build-release.yml` 的 `NODE_VERSION` 从 20 改为 22，对齐 `package.json` engines.node (`>=22`) 和 `.nvmrc` (`22`)。

### 2. Torch CPU 索引安装 (P0)

在 `pip install -r requirements.txt` 之前单独安装 CPU 版 torch：

```yaml
pip install torch==2.13.0 --index-url https://download.pytorch.org/whl/cpu
```

| 指标 | rc.1 (CUDA) | rc.2 (CPU) |
|------|:-----------:|:----------:|
| 包体积 | ~2.2 GB | ~280 MB |
| 安装耗时 | 8-12 min | 1-2 min |
| NSIS 安装包 | ~1.5 GB | ~589 MB |

## 已知限制（继承 rc.1）

1. **AKShare Collector 未打包**：数据采集使用前端直连 API 降级方案
2. **模型延迟加载**：Embedding 模型首次请求时加载，健康检查 `status=loading` 属正常
3. **无代码签名**：Windows SmartScreen 可能提示风险警告

## 开发者本地构建

```powershell
# 建议用 CPU 版 torch 与 CI 对齐
.venv\Scripts\python.exe -m pip install torch==2.13.0 --index-url https://download.pytorch.org/whl/cpu
npm run sidecar:build
npm run electron:compile
npm run electron:dev
```
