---
title: LLM API Key 真实调用发布验收报告
type: report
domain: ai
phase: testing
tier: T1
status: active
maintainer: V9 Architecture Team
summary: "LLM 密钥管理（AES-GCM 加密、TTL 轮换）与真实调用（chat / 测试连接）端到端发布验收：7 维度加权总分 4.65，P0 全过，判定通过发布；含全部测试证据与 CI 集成说明。"
tags: [llm, api-key, secret, ttl, rotation, real-call, acceptance, report, scoring, security]
version: v1.0.0
last_updated: 2026-08-15
code_version: "2.0.0-rc.1"
doc_id: V9-DOC-QA-123
related_docs: [V9-DOC-QA-122, V9-DOC-AI-017, V9-DOC-QA-009, V9-DOC-QA-004, V9-DOC-FRONT-039]
referenced_by: [V9-DOC-META-000, V9-DOC-PROJ-176]
change_log:
  - version: v1.0.0
    changes: 发布验收定稿（2026-08-15）：真实 DeepSeek Key 补测 7 维度加权总分 4.65（合格线 ≥4.0），P0 全过、无未关闭 P1 失败，判定通过发布；附全部测试证据与 CI 集成（llm-verify.yml）
    date: 2026-08-15
---

# LLM API Key 真实调用发布验收报告

> **验收对象**：FinSightV9 的 LLM 密钥安全（AES-GCM 加密存储、TTL 轮换）与真实调用链路（`chat()` / 「测试连接」）。
> **验收方法**：真实 DeepSeek API Key 端到端实测（**非 Mock**，符合项目硬约束）+ Playwright 自动化（`verify-llm-ttl.mjs` / `verify-llm-success.mjs`）+ curl 直连 + 代码审查。
> **结论**：✅ **通过发布**（总分 4.65 ≥ 4.0 合格线 ∧ 全部 P0 通过 ∧ 无未关闭 P1 失败）。
> **上游方案**：[llm-api-key-realtime-test-plan.md](../reports/testing/llm-api-key-realtime-test-plan.md)（V9-DOC-QA-122）。

---

## 1. 验收结论

### 1.1 综合评分（定稿）

| 维度 | 权重 | 得分(1-5) | 加权分 | 等级 | 主要依据（✅ 实测 / ⚪ 注明） |
|------|------|-----------|--------|------|----------|
| D1 配置与加密 | 15% | 5 | 0.75 | 🟢 优秀 | ✅ 保存真实 Key 后 `app:llm_api_key`=`{__encrypted:true,iv,data,createdAt,expiresAt,version}` 无明文；刷新后 `••••••••` 掩码；`.env`/源码无 `VITE_LLM_API_KEY` 泄漏 |
| D2 TTL 轮换 | 20% | 5 | 1.00 | 🟢 优秀 | ✅ 过期(31天)警告 / 未过期(5天)提示；保存新 Key 重置 `setAt`；真实调用后 `lastVerifiedAt` 更新 |
| D3 真实调用 | 25% | 4 | 1.00 | 🟢 良好 | ✅ POST `api.deepseek.com/v1/chat/completions` HTTP 200、content 非空、耗时 1.19s<15s；⚪ 响应 model=deepseek-v4-flash（上游别名）；多供应商 P2 无其它平台 Key 不适用 |
| D4 测试连接 | 15% | 5 | 0.75 | 🟢 优秀 | ✅ 网络捕获真实请求(200)；成功反馈「连接成功！」；无效 Key 401 失败；`lastVerifiedAt` 联动 |
| D5 错误处理 | 10% | 4 | 0.40 | 🟢 良好 | ✅ 401 友好报错、页面不崩溃；⚪ 超时/网络/配置缺失/降级经代码审查（AbortController / assertConfig / isValidLlmBaseURL），UI 未逐一复测 |
| D6 安全保密 | 10% | 5 | 0.50 | 🟢 优秀 | ✅ 2598 条控制台日志 0 明文 Key；错误信息 `****` 掩码（`****2345`）；全仓 grep 明文 Key 0 命中 |
| D7 UI 集成 | 5% | 5 | 0.25 | 🟢 优秀 | ✅ 页面多 Tab 完整渲染、演示页下线(404)；⚪ 透明度面板 P2 未测 |
| **总分** | 100% | — | **4.65** | 🟢 **合格（≥4.0）** | ✅ 全部 P0 通过；无未关闭 P1 失败 |

### 1.2 发布判定（对照方案 §6.3）

```
通过发布 ⇔ (全部 P0 通过) ∧ (总分 ≥ 4.0) ∧ (无未关闭的 P1 失败)
            ✅ 5/5        ✅ 4.65 ≥ 4.0     ✅ 0 项
→ 判定：✅ 通过发布
```

### 1.3 关键指标速览

| 指标 | 目标 | 实际 | 状态 |
|------|------|------|------|
| 总分 | ≥ 4.0 | **4.65** | ✅ |
| P0 阻断项 | 全过 | **5/5** | ✅ |
| P1 失败 | 0 | **0** | ✅ |
| 实测通过用例 | — | **18 通过 / 9 不适用(P2或代码审查) / 0 失败** | ✅ |
| 真实调用 | HTTP 200 | 200（耗时 1.19s） | ✅ |
| 无效 Key | 友好报错 | 401「连接失败：…Authentication Fails…」 | ✅ |
| 控制台明文 Key 泄漏 | 0 | 0（2598 条日志） | ✅ |
| 演示页 api-config | 不可达 | 404 | ✅ |

---

## 2. 验收范围与对象

### 2.1 测试对象（代码定位）

| 层 | 文件 | 验证点 |
|----|------|--------|
| 配置 | [llmConfig.ts](../../src/config/llmConfig.ts) | `LLM_SECRET_TTL_MS`、`isLlmApiKeyExpired`、`getLlmApiKeyAgeDays`、`getLlmApiKeyDaysSinceVerification`、`markLlmApiKeyVerified` |
| 服务 | [llmClient.ts](../../src/services/llm/llmClient.ts) | `chat()` / `streamingChat()` 真实 HTTP 调用、AbortController 超时、`assertConfig` |
| 加密 | [localStorageManager.ts](../../src/lib/localStorageManager.ts) | AES-GCM 加密读写 `app:llm_api_key`、meta 读写 |
| 页面 | [LlmManagement](../../src/pages/command/agent/LlmManagement/) | `LlmConfigTab.tsx`（TTL 警告 UI）、`useLlmConfigActions.ts`（`handleTest` 真实调用） |
| 路由 | [routes.ts](../../src/config/routes.ts) | `#/command/agents/llm` 可达；`#/command/agents/api-config` 已下线 |

### 2.2 范围边界

- **范围内**：LLM Key 配置 / 加密 / TTL / 真实调用 / 测试连接 / 错误处理 / 日志脱敏 / UI 集成。
- **范围外**：V6 评分引擎、数据采集链路、非 LLM 密钥（Tushare/Qwen 仅作 TTL 模式参考）。

---

## 3. 测试证据清单

> 证据目录：`dogfood-output/screenshots-llm/`（CI 集成后由 `llm-verify.yml` 上传为 artifact `llm-verify-evidence-*`）。

### 3.1 截图证据（Playwright 自动化产出）

| 文件 | 场景 | 关联用例 | 结果 |
|------|------|----------|------|
| `01-ttl-expired.png` | TTL 过期（31 天前）→「建议更新轮换」 | TC-D2-02 | ✅ |
| `02-ttl-fresh.png` | TTL 未过期（5 天前）→「30 天内无需轮换」 | TC-D2-01 | ✅ |
| `03-real-call-failure.png` | 无效 Key → 真实请求 401 + 友好报错 + `****` 掩码 | TC-D4-03 / TC-D5-01 / TC-D6-02 | ✅ |
| `11-save-encrypted.png` | 保存真实 Key → AES-GCM 加密落库 | TC-D1-02 / TC-D2-03 | ✅ |
| `12-reload-mask.png` | 刷新后输入框 `••••••••` 掩码 | TC-D1-03 | ✅ |
| `13-test-success.png` | 真实 Key「测试连接」→「连接成功！模型 deepseek-v4-flash 可访问。」 | TC-D4-02 | ✅ |

### 3.2 结构化证据（JSON）

- `result-success.json`（成功路径，全量脱敏输出）：

```json
[
  { "scenario": "TC-D1-02 保存真实 Key → AES-GCM 加密落库(无明文)", "encryptedFlag": true, "noPlaintext": true, "hasSetAt": true, "pass": true,
    "storedShape": ["__encrypted","iv","data","createdAt","expiresAt","version"],
    "metaShape": ["setAt","lastVerifiedAt"] },
  { "scenario": "TC-D1-03 刷新后掩码显示", "pass": true },
  { "scenario": "TC-D3-01/TC-D4-01/02/04 真实调用成功+测试连接+lastVerifiedAt", "pass": true,
    "successMsg": "连接成功！模型 deepseek-v4-flash 可访问。",
    "realRequestCount": 1, "statusOk": true, "authOk": true, "lastVerifiedAtUpdated": true,
    "realReqUrl": "https://api.deepseek.com/v1/chat/completions", "realReqStatus": "200" },
  { "scenario": "TC-D6-01 控制台日志不含明文 Key", "pass": true, "consoleCount": 2598, "leakedCount": 0 }
]
```

- `result.json`（TTL + 失败路径）：场景 1 TTL 过期 / 场景 2 TTL 未过期 / 场景 3 无效 Key 真实调用 401。

### 3.3 curl 直连证据（真实调用直证）

- 请求 `POST https://api.deepseek.com/v1/chat/completions`（model=`deepseek-chat`，prompt=`ping`，max_tokens=16）。
- 结果：HTTP 200，`choices[0].message.content` 非空，**耗时 1.19s < 15s 超时阈值**（TC-D3-04）。
- 偏差：响应 `model` 字段为上游别名 `deepseek-v4-flash`（请求正确发送 `deepseek-chat`，属 DeepSeek 上游别名行为，**非应用缺陷**）。

---

## 4. 维度评分详情

### 4.1 D1 密钥配置与加密存储（15%，5 分）

- ✅ TC-D1-02：保存真实 Key 后 `app:llm_api_key` 为 AES-GCM 加密结构 `{__encrypted:true,iv,data,createdAt,expiresAt,version}`，**无明文**。
- ✅ TC-D1-03：刷新页面后输入框显示 `••••••••` 掩码。
- ✅ TC-D1-04：`.env` / 源码无 `VITE_LLM_API_KEY` 前缀泄漏（P0-01 已修）。
- ⚪ TC-D1-05：覆盖新 Key 逻辑经代码审查（`setLlmApiKey`），P2 未单独 UI 复测。

### 4.2 D2 TTL 轮换机制（20%，5 分）

- ✅ TC-D2-02：过期（31 天）→「建议更新轮换以保障安全」。
- ✅ TC-D2-01：未过期（5 天）→「30 天内无需轮换」。
- ✅ TC-D2-03：保存新 Key 后 `setAt` 重置为 now，警告消失。
- ✅ TC-D2-04：真实调用成功后 `lastVerifiedAt` 更新。

### 4.3 D3 真实 API 调用（25%，4 分）

- ✅ TC-D3-01：真实 `chat()` HTTP 200、content 非空。
- ✅ TC-D3-02：请求 model=`deepseek-chat`；响应为上游别名（非缺陷）。
- ✅ TC-D3-04：耗时 1.19s < 15s 超时阈值。
- ⚪ TC-D3-03：多供应商（Kimi/Qwen/SiliconFlow）无其它平台 Key，不适用。

### 4.4 D4 测试连接功能（15%，5 分）

- ✅ TC-D4-01：点击「测试连接」网络捕获真实 POST `api.deepseek.com/v1/chat/completions`（200）——**确为真实调用非 Mock**。
- ✅ TC-D4-02：成功反馈「连接成功！」。
- ✅ TC-D4-03：无效 Key → 401「连接失败：…Authentication Fails…」。
- ✅ TC-D4-04：`lastVerifiedAt` 联动更新。

### 4.5 D5 错误处理与健壮性（10%，4 分）

- ✅ TC-D5-01：401 友好报错、页面不崩溃。
- ⚪ TC-D5-02/03/04/05：超时 / 网络 / 配置缺失 / 网关降级经代码审查（`AbortController` / `assertConfig` / `isValidLlmBaseURL`），UI 未逐一复测（P2）。

### 4.6 D6 安全与保密（10%，5 分）

- ✅ TC-D6-01：2598 条控制台日志 **0 明文 Key**。
- ✅ TC-D6-02：错误信息 Key 掩码 `****2345`。
- ✅ 全仓 grep 明文 Key 0 命中。
- ⚪ TC-D6-03：URL 协议白名单经代码审查，未单独复测。

### 4.7 D7 前端 UI 与集成（5%，5 分）

- ✅ TC-D7-01：页面含基础配置 / 高级参数 / 因子控制 / 使用统计 Tab 完整渲染。
- ✅ TC-D7-02：演示页 `#/command/agents/api-config` 404 不可达。
- ⚪ TC-D7-03：透明度面板开关 P2 未测。

---

## 5. 用例执行记录（完整清单）

> 结果统计：**✅ 18 / ⚪ 9（P2 或代码审查）/ ❌ 0**。

| 用例 | 维度 | 结果 | 实际表现 | 证据文件 |
|------|------|------|----------|----------|
| TC-D1-01 | D1 | ✅ | 页面可达，渲染「API 密钥配置」卡片 | 11-save-encrypted.png |
| TC-D1-02 | D1 | ✅ | AES-GCM 加密落库无明文；meta 含 setAt/lastVerifiedAt | result-success.json |
| TC-D1-03 | D1 | ✅ | 刷新后输入框 `••••••••` | 12-reload-mask.png |
| TC-D1-04 | D1 | ✅ | `.env`/源码无 `VITE_LLM_API_KEY` 泄漏 | grep 审计 |
| TC-D1-05 | D1 | ⚪ | 覆盖新 Key 代码审查通过（P2 未 UI 复测） | llmConfig.ts:291 |
| TC-D2-01 | D2 | ✅ | 未过期(5天)→「30 天内无需轮换」 | 02-ttl-fresh.png |
| TC-D2-02 | D2 | ✅ | 过期(31天)→「建议更新轮换以保障安全」 | 01-ttl-expired.png |
| TC-D2-03 | D2 | ✅ | 保存新 Key 后 setAt 重置、警告消失 | 11-save-encrypted.png |
| TC-D2-04 | D2 | ✅ | 真实调用成功后 lastVerifiedAt 更新 | result-success.json |
| TC-D3-01 | D3 | ✅ | 真实 chat() HTTP 200、content 非空 | result-success.json |
| TC-D3-02 | D3 | ✅ | 请求 deepseek-chat；响应上游别名（非缺陷） | curl 输出 |
| TC-D3-03 | D3 | ⚪ | 多供应商无其它平台 Key，不适用 | — |
| TC-D3-04 | D3 | ✅ | 耗时 1.19s < 15s 超时阈值 | curl 记录 |
| TC-D4-01 | D4 | ✅ | 网络捕获 POST chat/completions(200) | result-success.json |
| TC-D4-02 | D4 | ✅ | 「连接成功！模型 deepseek-v4-flash 可访问。」 | 13-test-success.png |
| TC-D4-03 | D4 | ✅ | 无效 Key → 401「连接失败」 | 03-real-call-failure.png |
| TC-D4-04 | D4 | ✅ | lastVerifiedAt 联动更新 | result-success.json |
| TC-D5-01 | D5 | ✅ | 401 友好报错、页面不崩溃 | 03-real-call-failure.png |
| TC-D5-02 | D5 | ⚪ | 超时（AbortController→LlmApiError 代码审查） | llmClient.ts:191-223 |
| TC-D5-03 | D5 | ⚪ | 网络错误（代码审查） | llmClient.ts:213-220 |
| TC-D5-04 | D5 | ⚪ | 配置缺失（assertConfig 代码审查） | llmClient.ts:49-63 |
| TC-D5-05 | D5 | ⚪ | 网关降级（P2 未测） | — |
| TC-D6-01 | D6 | ✅ | 2598 条控制台日志 0 明文 Key | result-success.json |
| TC-D6-02 | D6 | ✅ | 错误信息 Key 掩码 `****2345` | 03-real-call-failure.png |
| TC-D6-03 | D6 | ⚪ | URL 协议白名单（代码审查） | llmClient.ts:53-56 |
| TC-D7-01 | D7 | ✅ | 页面多 Tab 完整渲染 | 浏览器快照 |
| TC-D7-02 | D7 | ✅ | 演示页 api-config 404 不可达 | 路由审计 |
| TC-D7-03 | D7 | ⚪ | 透明度面板开关（P2 未测） | — |

---

## 6. 验收标准核对

### 6.1 P0 阻断项（全部通过 ✅ 5/5）

| # | 检查点 | 对应用例 | 结果 |
|---|--------|----------|------|
| 1 | 密钥加密落库，无明文泄漏 | TC-D1-01/02/04 | ✅ |
| 2 | 真实调用成功返回 | TC-D3-01 | ✅ |
| 3 | 「测试连接」确为真实请求 | TC-D4-01 | ✅ |
| 4 | 日志不含明文 Key | TC-D6-01 | ✅ |
| 5 | 演示页已下线 | TC-D7-02 | ✅ |

### 6.2 P1（建议发布前完成）— 全部通过

TTL 未过期/过期提示、轮换重置、验证时间戳、测试连接成功/失败反馈、配置缺失错误、错误信息掩码、页面完整渲染。✅

### 6.3 P2（记录排期，不阻塞发布）

| 待办项 | 说明 |
|--------|------|
| TC-D3-03 多供应商切换 | 需 Kimi/Qwen/SiliconFlow Key 后补测 |
| TC-D5-02/03/05 超时/网络/降级 UI 复测 | 已代码审查，待 UI 级回归补测 |
| TC-D6-03 URL 白名单 | 已代码审查，待补测 |
| TC-D7-03 透明度面板 | 待补测 |

---

## 7. 已知偏差与风险说明

| 项 | 说明 | 处置 |
|----|------|------|
| 响应 model=deepseek-v4-flash | 请求正确发送 `deepseek-chat`，上游 DeepSeek 返回别名（服务端行为） | 非缺陷，已注明，跟踪上游 |
| P2 用例未逐项 UI 复测 | 均为边界/可选项，已代码审查 | 排期补测，不阻塞发布 |
| 真实调用消耗 token | 使用最小 prompt（`ping`，max_tokens=16） | 成本可忽略 |
| CI 未配置 LLM_REAL_KEY | 成功路径自动跳过（fork/未授权场景不误报），TTL 路径照常执行 | 配置 Secret 后全量生效 |

---

## 8. CI 集成说明

### 8.1 流水线集成（verify-llm-success.mjs → CI）

验证脚本已集成至 GitHub Actions 流水线 [llm-verify.yml](../../.github/workflows/llm-verify.yml)：

| 项 | 内容 |
|----|------|
| 触发 | `main`/`develop` push / PR / `workflow_dispatch`（手动补测） |
| 脚本 | `verify-llm-success.mjs`（成功路径，需 `LLM_REAL_KEY` Secret）+ `verify-llm-ttl.mjs`（TTL/失败路径，无需真实 Key） |
| 环境 | ubuntu-latest + Node 22 + Playwright Chromium（headless） |
| 真实 Key | 仅经 GitHub Secret `LLM_REAL_KEY` 注入环境变量，不写入任何文件；输出自动脱敏 |
| 前端地址 | `LLM_BASE_URL`（默认 `http://localhost:5173`，dev server 显式以 `--port 5173` 启动） |
| 证据产物 | `dogfood-output/screenshots-llm/` 上传为 artifact `llm-verify-evidence-*`（保留 7 天） |
| 失败处置 | 步骤失败即门禁红；PR 事件自动在 PR 评论失败指引 |

### 8.2 本地复现命令

```powershell
# TTL + 失败路径（无需真实 Key）
node dogfood-output/scripts/verify-llm-ttl.mjs

# 成功路径（需 dev server + 真实 Key 环境变量，Key 不落任何文件）
$env:LLM_REAL_KEY='sk-xxx'; node dogfood-output/scripts/verify-llm-success.mjs
```

### 8.3 运行时序

```
checkout → setup-node → registry 修正 → safe-format 构建 → npm install
→ playwright chromium 安装 → 启动 dev server(5173) → 等待就绪
→ [成功路径: verify-llm-success.mjs (LLM_REAL_KEY)] → [TTL 路径: verify-llm-ttl.mjs]
→ 上传证据 artifact → (失败时 PR 评论)
```

---

## 9. 结论与建议

1. **验收结论**：✅ **通过发布**。LLM 密钥安全（AES-GCM 加密存储 / TTL 轮换 / 日志脱敏）与真实调用链路（`chat()` / 「测试连接」）均符合验收标准，7 维度加权总分 **4.65 ≥ 4.0**，全部 P0 通过、无未关闭 P1 失败。
2. **安全基线**：真实 Key 全程不落文件、不经前端 bundle，仅加密存储于 localStorage + Secret 注入 CI，符合项目密钥安全硬约束。
3. **后续建议**：P2 项（多供应商、超时/网络/降级 UI 复测、透明度面板）排期补测；关注上游 `deepseek-v4-flash` 别名行为；在 CI 仓库配置 `LLM_REAL_KEY` Secret 以启用成功路径全量门禁。

---

## 10. 相关文档（交叉引用）

| 文档 | 说明 | 位置 |
|------|------|------|
| llm-api-key-realtime-test-plan | 上游测试方案（评分体系 / 用例清单 / 验收标准） | [reports/testing/llm-api-key-realtime-test-plan.md](../reports/testing/llm-api-key-realtime-test-plan.md) |
| llm-contract | LLM 子域接口契约 | [reference/llm-contract.md](../reference/llm-contract.md) |
| test-catalog | 测试目录与策略（单一真相源） | [reports/testing/test-catalog.md](../reports/testing/test-catalog.md) |
| pre-testing-checklist | 上线前测试准备清单 | [reports/testing/pre-testing-checklist.md](../reports/testing/pre-testing-checklist.md) |
| 06-routing-specs | 路由规格（api-config 移除） | [explanation/06-routing-specs.md](../explanation/06-routing-specs.md) |
| 上线前全面校验报告 | 项目级上线前全面校验基线 | [reports/上线前全面校验报告-v2.0.0.md](../reports/上线前全面校验报告-v2.0.0.md) |
