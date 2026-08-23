---
skill_id: V9-SKILL-CODE-QUALITY
name: "code-quality-audit"
description: "代码质量合规审查：把代码质量从主观感觉变成可逐项核对、可机器断言的合规体检。覆盖分层/依赖方向/类型安全/零硬编码/事件清理/日志规范 + DataBridge/Envelope/ACL 数据接口协议。Invoke when 用户要求审查代码质量、新模块集成/提交前合规体检、排查直连 db 被拦/ACL 权限拒绝/事件泄漏、或需要可测试质量门禁时。"
version: v1.0.0
last_updated: 2026-08-23
change_log:
  - version: v1.0.0
    changes: "基于 S 级 Skill 5 段式骨架模板 [_SKILL-TEMPLATE.md](.agents/skills/_SKILL-TEMPLATE.md) 物理化迁移：自用户级 ~/.trae-cn/skills/v9-code-quality-audit 归位（references/ + scripts/quality-gate-check.cjs 随迁）"
    date: 2026-08-23
mandatory: true
---

# 代码质量合规审查（Code Quality Audit）— v1.0.0

> 覆盖三大块：**通用代码原则**（分层/依赖方向/类型安全/零硬编码/日志可观测/资源清理）、
> **代码结构严谨性**（四步集成契约：类型→Store→Service→UI，每步可独立回滚）、
> **数据接口协议**（DataBridge 总线 / Envelope 信封 / ACL / withBroadcast / API 响应信封 / IndexedDB 版本管理）。

---

## 一、触发条件

- **显式触发**：「审查/评审代码」「检查代码质量」「合规体检」「提交前检查」
- **文件信号**：改动 `src/core/**`、`src/services/**`、`src/store/**`、`src/components/**`
- **事件触发**：PR Review、新模块/新页面/新 Widget/新 Store 集成
- **问题现象**：直连 db 被拦、DataBridge.forward 失败、ACL 权限拒绝、事件监听内存泄漏

**不触发场景**：纯文档/文案改动；与代码质量无关的功能咨询。

**协作 Skill**：`architecture-debt-remediation`（债务修复）、`dev-checklist`（场景化清单）、`module-sync-checklist`（交付闸口）。

---

## 二、前置检查

| # | 检查项 | 命令 / 方法 | 通过标准 |
|---|--------|-----------|---------|
| 1 | 契约基线 | 读 `AGENTS.md` 权威规则源 | 明确分层/协议约束 |
| 2 | 工程模式探测 | `node .agents/skills/code-quality-audit/scripts/quality-gate-check.cjs --project . --json` | 判定 V9 模式（有 `src/core/databridge.ts`）或通用模式 |
| 3 | 基线门禁快照 | `npx tsc --noEmit` + `npm run audit` 套件 | 记录基线违规数作对照 |

---

## 三、阶段化 SOP（五步工作流）

### Step 1 — 识别工程类型与基线

优先读 `AGENTS.md` / `ARCHITECTURE.md` / `DATA_DEFINITION.md` 作权威规则源；用 `quality-gate-check.cjs` 自动探测模式（V9 模式跑内置 `npm run audit` 套件，通用模式跑零依赖启发式）。

### Step 2 — 运行机器门禁（确定性基线）

```bash
npx tsc --noEmit
npm run audit          # layers/hardcode/deadcode/docs/routes/mcp/token/tests 等
npm test -- --run
node .agents/skills/code-quality-audit/scripts/quality-gate-check.cjs --project . --json
```

退出码：0=通过（含仅警告）/ 1=存在阻塞级违规 / 2=执行错误。

### Step 3 — 结构化 + 协议深度审查

机器门禁覆盖不了的部分，按 `references/quality-dimensions.md` 的 D1–D9 逐项核对，重点 **D8 数据接口协议**（见 `references/data-interface-protocol.md`）：

- 写库是否 `dataBridge.forward(envelope)`（无 `db.put` 直连）
- 信封 `EnvelopeFactory.create` 是否含 `traceId`
- 模块是否在 `ACL_MATRIX` 注册、`ENVELOPE_ACTION` 是否新增 case
- Store 变更后是否 `withBroadcast(EVENT_NAMES.X, …)`
- API 响应是否 `{ code, data, message }` 并做 `code` 判断
- `DB_VERSION` / `STORE_NAME` / `ACL_MATRIX` 是否同步递增

### Step 4 — 产出合规报告

按 `references/checklist.md` 末尾「审查产出模板」：结论（PASS / PASS_WITH_WARNINGS / FAIL）、门禁 JSON、阻断项（file:line + 规则 + 修复建议）、协议合规矩阵。

### Step 5 — 验证门禁可重现

每条发现附**可复跑的命令或正则**；修复后重跑 Step 2，阻塞项归零再允许合并。

### 修复边界（自主 vs 需确认）

- **可自主修复**（低风险可逆）：提取硬编码颜色到 `src/constants/theme.tokens.ts`、魔法数字到 `src/config/thresholds.ts`、补事件清理、调整 import 修复跨层违规
- **需人工确认**：新增常量/配置项、改接口签名、删/重命名已导出符号、DB_VERSION 变更、跨 3+ 模块重构

---

## 四、陷阱与经验教训

| # | 陷阱 | 后果 | 规避 |
|---|------|-----|-----|
| 1 | 只信门禁绿灯不看协议合规 | DataBridge 绕过隐患漏检 | Step 3 D8 人工核对不可省 |
| 2 | 报告纯文字结论无可复跑命令 | 结论不可验证、易漂移 | 每条发现附命令/正则 |
| 3 | 把通用模式当 V9 模式跑 | 引用不存在的 audit 脚本报错 | Step 1 先探测模式 |
| 4 | 自主修复越过边界（改导出符号） | 破坏消费方 | 严格遵守修复边界表 |
| 5 | 门禁退出码被管道吞掉 | 假绿灯 | `> log 2>&1; echo EXIT=$?`，禁 `| tail` |

---

## 五、完成交付物清单

| # | 交付物 | 存在位置 | 验证方法 |
|---|--------|---------|---------|
| 1 | 合规报告（结论 + 阻断项 + 协议矩阵） | 最终回复 / `outputs/` | 含 file:line 证据 |
| 2 | 门禁 JSON 输出 | `quality-gate-check.cjs --json` | 可复跑 |
| 3 | 阻塞项清零 | 重跑 Step 2 | 退出码 0 |

**参考文件**（随技能迁移）：`references/quality-dimensions.md`（D1–D9 详解）、`references/data-interface-protocol.md`（D8 协议）、`references/checklist.md`（检查矩阵 + 报告模板）、`scripts/quality-gate-check.cjs`（零依赖自适应门禁器）。
