---
title: 运行环境统一配置
type: reference
domain: project
phase: development
tier: reference
status: active
maintainer: V9 Architecture Team
summary: "全平台统一的运行环境配置：Node/端口/环境变量/受管 venv/Docker，开发者与使用者共用"
tags: [wiki, environment, configuration, setup]
version: v1.0.0
last_updated: 2026-08-23
code_version: "2.0.0-rc.2"
doc_id: V9-DOC-WIKI-010
related_docs: [V9-DOC-WIKI-001, V9-DOC-WIKI-002]
change_log:
  - version: v1.0.0
    changes: "初版：统一吸收分散于 docs/wiki、.env.example、docker-compose.yml 的环境事实"
    date: 2026-08-23
---

# 运行环境统一配置

> 本文为跨平台统一的环境配置真相源；各平台配置卡中的环境差异以本文为准。
> 快速开始（使用者视角）另见 [code-wiki/05-getting-started.md](../code-wiki/05-getting-started.md)。

## 一、基础运行时

| 项 | 值 | 说明 |
|---|---|---|
| Node.js | 20（`.nvmrc` 锁定） | Docker 基线 `node:20-slim` |
| 包管理 | npm（npm workspace） | 禁止 `git add -A`，提交精确路径 |
| Python | 受管 venv（路径固化于 package.json） | Sidecar / 数据采集服务使用；Bash 约定禁止裸调系统 python |

## 二、端口与服务

| 服务 | 端口 | 说明 |
|---|---|---|
| Vite dev server（浏览器 PWA） | **5199** | `npm run dev` |
| Electron 开发模式 dev server | **3000** | `VITE_DEV_SERVER_URL`，容器内 3000 映射宿主 5199 |
| Python 数据采集服务（FastAPI） | **8000** | `COLLECTOR_TARGET` 默认 `http://127.0.0.1:8000` |
| Python Embedding 服务 | **8001** | `EMBEDDING_TARGET` |
| Sidecar Daemon | **8765** | Electron 侧车守护 |

## 三、关键环境变量

| 变量 | 用途 | 约束 |
|---|---|---|
| `VITE_DATA_SOURCE_TYPE` | 数据源类型（real/mock） | 上线前测试禁止 MOCK，必须真数 |
| `VITE_AKSHARE_BASE_URL` | AkShare 基址 | 浏览器 PWA 模式必须 `/api/akshare`（走 Vite 代理防 CORS）；Electron 侧车可直连 `:8000` |
| `COLLECTOR_TARGET` / `EMBEDDING_TARGET` | 后端服务地址 | Docker 内改为 `http://data-collector:8000` |
| `TEST_DB_NAME` | 测试数据库名 | 仅构建期/测试环境 |

> 安全约束：`.env*` 中禁止填写真实 API Key；LLM/Tushare/Qwen 密钥一律经 UI 配置页以 AES-GCM 加密写入 localStorage（TTL 30 天轮换）。仅 `VITE_` 前缀变量会注入前端 bundle。

## 四、启动方式

```powershell
npm install
npm run dev                    # 浏览器 PWA 开发（:5199）
npm run electron:dev           # Electron 桌面开发（:3000）
docker compose up -d frontend  # 容器方式（依赖 data-collector 服务）
```

## 五、门禁与验证命令（速查）

| 命令 | 用途 |
|---|---|
| `npm run tsc:prod` | 生产域类型检查（零容忍） |
| `npm run audit:layers` | 分层调用合规 |
| `npm run audit:platform-docs` | 跨平台 WIKI 契约一致性（本契约配套） |
| `npm run gate:quick` | pre-push 快速门禁聚合 |
| `npm run skill:mirror` | WorkBuddy 技能联接重建（幂等：联接复用/旧 cp 清理重建/降级 cp） |

完整门禁速查见 AGENTS.md §七 与 [docs/guides/sops/README.md](../../docs/guides/sops/README.md)（S02/S04/S05）。
