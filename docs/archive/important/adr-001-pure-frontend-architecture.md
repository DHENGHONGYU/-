---
doc_id: V9-DOC-EXP-908
title: adr-001-pure-frontend-architecture
code_version: "2.0.0-rc.2"
tier: reference
version: v1.0.0
last_updated: 2026-08-11
change_log:
  - version: v1.0.0
    changes: "C 类版本闭环(2026-08-11)：补全 change_log 初始条目"
    date: 2026-08-11
---



# ADR-001: 纯前端无后端架构

> **状态**: Accepted  
> **决策日期**: 2026-06-20  
> **版本**: v1.0.0（由骨架扩写）

---

## 1. 背景（Context）

V9 作为面向个人投资者的智能投研复盘系统，需要满足以下约束：

- **合规风险**：金融数据投资建议涉及合规风险，个人开发者难以承担监管责任。
- **部署成本**：独立开发者无法承担服务器运维成本（数据库、CDN、SSL 证书、备案等）。
- **数据隐私**：用户持仓、交易记录等敏感数据不应上传到第三方服务器。
- **离线需求**：用户需要在无网络环境下查看已采集的数据和复盘报告。

在 V6 阶段，系统曾依赖后端 API 获取行情数据和用户认证，但受限于个人开发者的资源约束，后端服务的稳定性和数据合规性成为瓶颈。

### 触发条件

- V9 立项时明确面向「个人股票研究/复盘辅助」，非机构级产品。
- 2026-06-20 架构评审会议确认：V9 生命周期内不引入后端服务。

---

## 2. 决策（Decision）

**V9 采用纯前端架构（Browser-Only PWA），无后端服务。**

- 所有业务逻辑运行于浏览器端（JavaScript/TypeScript）。
- 数据持久化采用本地 IndexedDB（见 ADR-002）。
- 外部数据通过 `fetcher` 服务直接调用第三方行情 API（如 Tushare、Yahoo Finance）。
- 部署为静态 SPA，适配 GitHub Pages/Vercel/Netlify 等免费托管（见 ADR-004）。
- AI 输出明确标注「仅供参考，非投资建议」，规避合规风险。

### 决策理由

- **Why not 自建后端**：个人开发者无法承担运维成本、合规风险和数据安全责任。
- **Why not SaaS 后端**：第三方 SaaS 服务（如 Firebase、Supabase）存在数据隐私风险和长期成本。
- **PWA 优势**：Service Worker 支持离线访问；IndexedDB 支持大数据量本地存储；install 后体验接近原生 App。

---

## 3. 备选方案（Alternatives Considered）

| 方案 | 优点 | 缺点 | 结论 |
|------|------|------|------|
| **A. 纯前端 PWA**（最终选择） | 零运维成本、数据本地自管、离线可用 | 计算能力受限（无法跑复杂 ML 模型）、数据同步依赖用户手动导出 | ✅ 采纳 |
| **B. 轻量后端（Serverless）** | 可跑复杂计算、可集中管理 API Key | 有运维成本、数据隐私风险、合规责任 | ❌ 否决 |
| **C. 混合架构（前端 + BFF）** | 前后端分离，前端轻量 | 增加复杂度，对个人开发者不友好 | ❌ 否决 |
| **D. Electron 桌面应用** | 更强的本地计算能力、文件系统访问 | 包体积大、更新分发复杂、跨平台测试成本高 | ❌ 否决（但 V10 可重新评估） |

---

## 4. 后果（Consequences）

### 正面影响

- **零运维成本**：无需服务器、数据库、域名备案。
- **数据隐私**：用户数据完全本地存储，不上传任何第三方。
- **离线可用**：PWA + IndexedDB 支持无网络环境下查看历史数据。
- **快速部署**：静态文件直接上传 CDN，秒级更新。

### 负面影响 / 技术债

- **计算能力受限**：无法运行服务端复杂模型（如 LLM 微调、大规模回测），所有计算必须在浏览器端完成。
  - **缓解**：LLM 调用走外部 API（如 Kimi、OpenAI），本地仅做 prompt 编排和结果解析。
  - **技术债**：`./design/tech-debt.md` — 「浏览器端回测引擎性能瓶颈」（大样本回测可能导致 UI 卡顿）。
- **API Key 安全**：第三方 API Key 存储在 localStorage（加密存储），存在被提取的风险。
  - **缓解**：`localStorageManager.setEncrypted()` 加密存储；用户自行管理 API Key。
- **数据同步**：多设备间数据无法自动同步，依赖用户手动导出/导入 JSON。
  - **缓解**：`../reference/deployment.md` §数据备份/恢复策略。

### 影响范围

| 模块 | 影响 |
|------|------|
| `src/services/fetcher/` | 必须适配纯前端环境，处理 CORS、限流、API Key 管理 |
| `src/data/` | IndexedDB 是唯一持久化方案，Schema 设计须考虑浏览器限制 |
| `src/services/llm/` | LLM 调用走外部 API，本地只做 prompt 编排 |
| `public/manifest.json` | PWA 配置（主题色、图标、Service Worker） |
| `vite.config.ts` | 构建配置须适配静态托管（`base` 路径、`manualChunks`） |

---

## 5. 实施与验证

### 实施步骤

- [x] Step 1：确认技术栈（Vite + React + TypeScript + Tailwind CSS）
- [x] Step 2：配置 PWA（manifest.json + Service Worker）
- [x] Step 3：实现 IndexedDB 数据层（见 ADR-002）
- [x] Step 4：实现 fetcher 服务（CORS 代理、限流、缓存）
- [x] Step 5：配置静态托管部署（GitHub Pages/Vercel）
- [ ] Step 6：补充离线体验（Service Worker 缓存策略优化）
- [ ] Step 7：多设备数据同步方案（JSON 导出/导入 → 未来评估云同步）

### 验证命令

```bash
npm run build        # 验证静态产物生成
npm run test:clean   # 验证核心测试通过
```

### 回滚条件

- 监管要求必须引入后端服务（极不可能，但需关注）。
- 用户规模 > 1 万且需要集中数据管理（V10 评估）。

---

## 6. 关联文档

| 文档 | 路径 |
|------|------|
| ADR-002（IndexedDB） | `../reference/adr-002-indexeddb-over-localstorage.md` |
| ADR-004（HashRouter） | `adr-004-hashrouter-static-hosting.md` |
| 全局架构总览 | `./overview.md` §1、§2 |
| 部署基线 | `docs/reference/deployment.md` |
| 原始提案 | `docs/reference/v9-system-blueprint.md` §2.1 |

---

## 7. 状态变更记录

| 日期 | 状态 | 变更人 | 备注 |
|------|------|--------|------|
| 2026-06-20 | proposed | @architect | 初始提案 |
| 2026-06-20 | accepted | 架构组 | 架构评审通过，作为 V9 基础架构决策 |
| 2026-07-12 | accepted | docs 治理组 | 扩写为完整 ADR v1.0.0 |
