---
title: S07 · 上线后运维与应急 SOP
type: sop
domain: operations
phase: post-launch
tier: T2
status: active
maintainer: V9 Architecture Team
summary: "上线后 48h 值守模板（3+ 岗：架构师 OnCall / 前端值班 / 产品值班 + 飞书值班群）；P0 故障 5 层分级上报矩阵（发现/影响/临时修复/永久修复/复盘）+ RCA 模板；引用 troubleshooting.md 并补 gap-3：夜间值班 1 分钟快速定位日志路径法。"
tags: [sop, operations, incident-response, oncall, p0-matrix, rca-template]
version: v1.0.0
last_updated: 2026-08-19
code_version: "2.0.0-rc.2"
doc_id: V9-DOC-SOP-007
related_docs:
  - V9-DOC-TR-001   # how-to-troubleshooting.md（引用原文 5 大类 + 补 gap-3）
  - V9-DOC-SOP-006  # S06 发布部署（前置）
referenced_by: []
change_log:
  - version: v1.0.0
    changes: "Initial version：48h 值守模板 3 岗；P0 故障 5 层上报矩阵 + RCA 模板；补 troubleshooting.md gap-3：夜间值班 1 分钟快速定位日志存储路径。"
    date: 2026-08-19
---

# S07 · 上线后运维与应急 SOP

> **编号**：S07 · **适用场景**：[S06 发布部署](./S06-release-deployment.md) 成功上线后，**48 小时值守期**内的监控、巡检、故障分级处置、P0 应急上报、事后根因分析（RCA）全流程。  
> **执行角色**：架构师 OnCall（技术决策 + 回滚拍板人）· 前端值班（日志提取 + 临时 Fix）· 产品值班（用户反馈接听 + 公告话术） + 飞书「V9-值守应急群」全员协同。  
> **预计耗时**：值守 48h（被动响应）；单 P0 故障处理 15–120 分钟；RCA 5 个工作日。  
> **规范等级**：🟧 强约束（T2）。**P0 级故障 15 分钟未启动临时修复 = 升级产品总监 + CTO 双通知**；任何 P0 故障 5 工作日内必须产出 RCA 文档。

---

## 参考文档与缺口补充声明

| # | 文档 | 引用/补充说明 |
|---|------|--------------|
| 1 | [How to 故障排查指南](../how-to/how-to-troubleshooting.md) | 5 大故障分类（类型/构建/网络/权限/性能）+ 对应诊断命令均引用不重写；§4 Fix-3 补 **gap-3：夜间值班同事不熟悉项目，1 分钟内定位日志存放在哪里（Sentry / 本地 / IndexedDB / 边缘 CDN 四源定位法）**。 |
| 2 | [S06 发布部署 SOP](./S06-release-deployment.md) | 回滚双方案（镜像回滚 / index-history 替换）在本 SOP §二 2.D 直接调用。 |

---

## 一、前置条件（值守开始前）

| # | 条件 | 验证 |
|---|------|------|
| PC-1 | **值守表已排定**（§二 2.A 模板已填），每个岗均有主备（Primary / Backup），Backup 联系方式已写 | 飞书群公告发布后已全员确认 👍 |
| PC-2 | **监控四件套已配置**：Sentry（错误监控）+ Lighthouse（性能）+ Apdex（体验）+ 健康探测 `/health`（容器健康） | Sentry 新建 `v$NEW_VER` release；飞书告警群已绑定「新版本错误 > 5/h → @oncall」规则 |
| PC-3 | **回滚预案已双预演**：S06 §2.D D-3 方案 A/B 均在预发环境实际执行过，**实际回滚耗时 ≤ 5 分钟**有记录 | 预演记录在 `docs/reports/release/<版本>/07-rollback-verification.md` |
| PC-4 | **产品公告话术 ready**：「功能 X 已上线」/「紧急回滚公告」两份 draft 已保存到群文件，经 PR 审核 | 群文件 2 个 doc 存在 |
| PC-5 | 值守时段非凌晨（北京时间 06:00–23:00）；若必须夜间上线（罕见），需安排夜班双岗 + 行政支持 | 发布时间确认 |

---

## 二、操作步骤

### 2.A · 48 小时值守表模板（≥ 3 岗主备共 6 人 · 8h 一轮班）

```markdown
# V9 v<版本号> 上线后 48 小时值守表
发布时间：YYYY-MM-DD HH:MM (UTC+8)
值守周期：发布时刻起 48h

## 岗位说明
- 🟥 架构师 OnCall：技术决策 / 回滚拍板 / 跨模块疑难 / P0 升级联络
- 🟧 前端值班：日志提取 / 临时修复 PR / 复现 / Sentry 标记
- 🟩 产品值班：用户反馈接听 / 公告发布 / 话术准备 / 非技术问题分流

## 排班表（8h 一轮）
[周期 1] 发布日 Day1 上午（HH:MM–HH:MM+8h）
  | 岗位        | Primary（主） | 备用（Backup） | 飞书账号 / 手机       |
  |------------|------------|-------------|---------------------|
  | 架构师 OnCall | @张三      | @李四        | 138-XXXX-XXXX         |
  | 前端值班     | @王五      | @赵六        | 139-XXXX-XXXX         |
  | 产品值班     | @产品A     | @产品B       | 群内 @ / 手机         |

[周期 2] 发布日 Day1 下午 → 夜间（HH:MM+8h – HH:MM+16h）
（同上，换另一班人；禁止一人连两班）

[周期 3] 发布日 Day1 夜间 → Day2 上午（HH:MM+16h – HH:MM+24h）
[周期 4] Day2 上午 → 下午
[周期 5] Day2 下午 → 夜间
[周期 6] Day2 夜间 → Day3 上午（48h 截止点：发布时 + 48h）
（每个周期均保持主备 6 人覆盖）

## 联络约定
1. 主渠道：飞书群「V9-值守应急群」；消息前加前缀：【巡检】【告警】【P0】【P1】【公告】
2. P0 级：除群消息外，主叫号码拨打架构师 OnCall 手机（3 次未接自动转 Backup）
3. 非工作时间允许 @silent（普通信息免打扰），但 P0/P1 仍走强提醒
```

### 2.B · 48h 标准化巡检 Checklist（每 4 小时一次）

> 每次巡检 = 架构师 OnCall 或前端值班执行，完成后在群内发【巡检】+ 结果。共 12 轮（48h / 4h）。

| 维度 | 巡检项 | 命令 / 操作 | 正常基准 | 异常 → 升级级别 |
|------|-------|------------|---------|--------------|
| 可用性 | `/health` 健康检查（部署域名） | `Invoke-RestMethod https://<域名>/health` | HTTP 200 + `status: ok` | ≠ ok → **P0** |
| 可用性 | 核心页面 4 个 200 OK（首页 / 看板 / 个股页 / V6 报告页） | 浏览器或 curl 4 条 → 200 | 4/4 成功 | 任意 1 条非 200 → **P1** |
| 错误监控 | Sentry 过去 4h 新错误数 | Sentry 控制台：Issues → Filter by `release:v<X.Y>` | 增量错误 ≤ 20；其中 FATAL = 0 | FATAL ≥1 → P0；错误 > 50 → **P1** |
| 错误监控 | Top 1 Error 事件数是否异常增长（同比前 4h > 3×） | Sentry Graph 对比 | 倍率 ≤ 2× | 3× 以上 → **P1** |
| 性能 | Lighthouse CI：首页性能分（生产域） | `npx lhci autorun --collect.url=https://<域名>` | Perf ≥ 85 分 | Perf < 70 → **P1** |
| 性能 | Apdex T = 2s | APM 平台（如接入） | Apdex ≥ 0.95 | Apdex < 0.8 → **P1** |
| 性能 | JS Bundle 体积：主 chunk ≤ 6MB（压缩前） | `dist/assets/index-*.js` size + gzip | ≤ 6MB | 超 +20% → **P1**（超基线） |
| 数据 | IndexedDB schema 版本 = N？（v2.x DB_VERSION） | DevTools Application → Storage → IDB | 版本号 = DB_VERSION = 35 | 版本号≠ → **P1**（migration 失败） |
| 数据 | V6 评分接口返回 200（抽样 3 只股票） | UI 操作或 curl API | 3/3 成功；无 HTTP 500 | 任意 1 条 5xx → **P1** |
| 安全 | XSS Payload 14 条（E2E XSS）快速回归 | `npm run test:e2e-verify -- --xss-only` | 14/14 通过（引用 DEPLOYMENT-CHECKLIST） | ≤13 → **P0** |
| 反馈 | 飞书/客服用户反馈通道有无"页面异常/白屏/数据错" | 产品值班检查邮件 / 群 / 工单 | 0 条 P0 反馈 | 白屏/崩溃类 → **P0**；数据错 → **P1** |
| 日志 | 4 类日志路径可访问，有增量（见 gap-3 定位法 §4 Fix-3） | 手动登 4 平台，各取最近 1h 日志条数 | 每平台增量 ≥ 1 条（有访问） | 任一平台 0 条 2h → **P1**（日志采集断了） |

### 2.C · P0 故障分级上报 5 层矩阵（FR-11）

> 字段：**发现时间 → 影响范围 → 临时修复 → 永久修复 → 复盘时间**

| 层级 | 字段 | 操作/模板 | SLA 时限（从发现时刻起） |
|:---:|------|---------|:---:|
| 1️⃣ | **发现时间**（T0） | 「【P0】发现：YYYY-MM-DD HH:MM · 现象：<例>首页白屏 · 发现人：值班人姓名 · 版本：vX.Y.Z」 | 立即记录（≤ 1 min） |
| 2️⃣ | **影响范围**（Impact） | 按「用户×功能×时长」三维量化：<br>① 影响用户量（< 1% / 1~10% / > 10% / 全站）<br>② 影响功能数（单点 / 核心功能 1 个 / 多个核心 / 全站不可用）<br>③ 预期中断时长（< 10 min / 10~60 min / > 60 min）<br>→ 综合评级：**Sev A（最严重）→ D** | T0 + 10 min 内定级 |
| 3️⃣ | **临时修复**（Mitigation） | 3 选 1（按优先级）：<br>　① **S06 §D-3 方案 A 回滚**（推荐，≤ 3 min）<br>　② 方案 B index-history 替换（A 失败时 ≤ 5 min）<br>　③ Feature Flag 关闭（若有 Flag 机制且本功能受控 ≤ 1 min）<br>执行后立即公告：「临时修复已部署，请用户 Hard Refresh」 | T0 + 15 min 内必须启动；T0 + 30 min 内必须恢复服务 |
| 4️⃣ | **永久修复**（Permanent Fix） | HOTFIX 分支流程（S06 §2.A HOTFIX 豁免规则）：<br>　① `hotfix/<patch>_<简述>` 分支出 main<br>　② commit 修复 + 最小化测试（HOTFIX 允许跳过 S05 非相关步骤 → 需 3 签）<br>　③ S06 §2.B 单向打 PATCH Tag（如 v2.0.1）<br>　④ HOTFIX 部署上线（灰度 ≥ 10 min 再全量） | T0 + 4h 内完成代码 + SLA；≤ 24h 部署全量（Sev A 要求 ≤ 12h） |
| 5️⃣ | **复盘时间 + RCA**（RCA：Root Cause Analysis） | **RCA 交付物（必填）**：<br>`docs/reports/rca/YYYY-MM-DD_v<版本>_<故障简述缩写>.md`（见附 A RCA 模板） | **≤ T0 + 5 个工作日**提交 + 复盘会议召开 + 跟进项进入 Backlog 排期 |

### 附 A · RCA 标准模板（5 字段配套）

```markdown
# RCA · <P0 故障标题>（如 v2.0.0 首页白屏 27 分钟）
## 1. 基本信息
- 发现时间 (T0)：YYYY-MM-DD HH:MM（北京时间）
- 服务恢复时间 (Tr)：YYYY-MM-DD HH:MM
- 用户侧中断时长：XX 分钟（Tr - T0）
- 影响范围：用户 X% · 功能 Y · 量化 Z 条 Sentry Error
- 总损失评估：可用率从 99.9% 降至 9X.X%（计算 48h 窗口）
- 发现人 / 处理人 / 架构师拍板人：

## 2. 时间线（精确到分钟）
[HH:MM] 监控告警触发（Sentry 错误 >50/h）
[HH:MM+X] 值班人开始排查（已执行§4 Fix-3 日志定位）
[HH:MM+Y] 定位根因：……
[HH:MM+Z] 启动 <临时修复方案A/B/Flag>
[HH:MM+W] 服务恢复（验证：首页 200 + Sentry error 回落）

## 3. 根本原因 Root Cause（5 Whys）
Why 1：页面白屏？→ 因为 <原因>。
Why 2：为什么会出现 <原因>？→ 因为……
Why 3：为什么没在 S05 发现？→ 因为……
Why 4：为什么测试没覆盖？→ 因为……
Why 5：为什么监控未在 1 分钟内告警？→ 因为……

## 4. 临时修复过程复盘（Mitigation Critique）
- 临时修复是否在 T0+15 内启动？（是/否，原因：）
- 方案 A/B 是否成功？（若失败，为什么？后续如何避免？）
- Feature Flag 机制是否可用？若不可用，为什么？

## 5. 永久修复清单（Preventive Actions = P1~P10）
| 编号 | Action（必须可执行，含 Owner / Due / Status） | 优先级 | 分类 |
|------|--------------------------------------------|:---:|------|
| P1 | ……（例：补 XSS 14 条 Payload 中的第 15 条 Base64 类） | 🔴 P0 | 测试覆盖 |
| P2 | ……（例：Lighthouse CI Perf < 70 时自动打回 PR） | 🟠 P1 | 质量门禁 |
| P3 | …… | 🟡 P2 | 运维优化 |

## 6. 跟进项状态（2 周 / 4 周 / 8 周复查点）
| 复查日期 | 完成率 | 备注 |
|---------|-------|------|
| 2026-MM-DD（2 周后） | X% | — |
| 2026-MM-DD（4 周后） | Y% | — |
| 2026-MM-DD（8 周后） | Z% | —；P1+ 项清零；RCA 关闭 |

## 7. 复盘会议记录
日期：YYYY-MM-DD；参会人：；结论：（学习要点 & 流程变更 & 分享范围）
```

### 2.D · 值守 48h 结束交接流程

```markdown
【值守结束公告】@all
版本号：vX.Y.Z
值守开始：YYYY-MM-DD HH:MM → 结束：YYYY-MM-DD HH:MM（= 48h）

## 48h 关键指标汇总
  · 可用性：100% / 或 99.XX%（中断 XX 分钟 1 次）
  · Sentry 错误总数：XXX（其中 FATAL = N）
  · P0/P1 故障次数：N 次 P0（附 RCA 链接）· N 次 P1
  · 用户反馈数：N 条（P0/P1 各 N）
  · Lighthouse Perf 平均分：XX.X

## 遗留项（交接 Backlog / Release Notes）
  1. <例> Stale Element E2E 偶发（quarantine ticket #TCK-3612 已开，Owner @王五 Due 下周五）
  2. <例> ……

## 正式解除值守
  值班模式切换为「常规工作日响应」。任何遗留的 P0，请直联架构师 OnCall。
  —— 架构师 OnCall 主备 签名：_______ / _______（日期）
```

---

## 三、通过标准（值守结束判定）

| 类别 | 判定 |
|------|------|
| ✅ **Gold**（理想状态） | 48h 内 P0 = 0 次；P1 ≤ 2 次；可用性 ≥ 99.95%；用户好评无白屏反馈；R12 轮巡检全绿 |
| ✅ **Silver**（允许发布但带遗留） | P0 ≤ 1 次且临时修复 ≤ 15 min；P1 ≤ 4；≥ 99.9%；RCA 已提交 + Preventive Actions 已排期 |
| 🟡 **Bronze**（交付但需 HOTFIX） | P0 ≥ 2 或 单次中断 > 30 min；RCA 2 份；≤ 24h 内 HOTFIX PATCH 已发布 |
| 🔴 **Fail** | P0 ≥ 3 或 可用性 < 99.5% → 需触发全量回归：回到 S05 重新体检 + 架构专项 Review + HOTFIX |

**值守成功结论 = Gold 或 Silver**（Bronze 需要 3 签 + 产品总监同意；Fail = 上线失败）。

---

## 四、常见失败与修复（Top 5 · 含 troubleshooting gap-3 补）

| # | 失败场景 | 根因 | 修复命令 / 操作 | 说明 |
|---|---------|------|---------------|------|
| Fix-1 | **P0 回滚方案 A 失败（镜像不存在）** | CDN 保留期过短 | 立即切方案 B（S06 D-3）；事后调整保留期 ≥ 90 天 | S06 §D-3 引用 |
| Fix-2 | **巡检发现 Sentry 错误率 3× 增幅但无明显白屏**（边缘 case 出错） | 新功能触发了旧代码的未覆盖分支 | (1) 前端值班：Sentry 标记 5 条高频，抓 1 条 stack trace 定位到文件<br>(2) 若 30 min 内无法根因定位，Feature Flag 关新功能 + 公告 | troubleshooting §3.3 |
| Fix-3 | **夜间值班不熟悉项目，找不到日志路径**（Sentry / 本地 / IndexedDB / CDN 日志四源定位法）**troubleshooting gap-3** | 夜班人非核心开发者，记忆路径困难 | **1 分钟 4 源标准定位法**（详细步骤见下方）：<br>**步骤 1 — Sentry（最简单）**：飞书群 @Sentry Bot → `/sentry search release:v<VER> error.fatal:true` 或直接开 sentry.io → Issues → 选择 release<br>**步骤 2 — 应用本地日志（用户侧）**：让用户打开 DevTools Console / 截图；或产品仓内置「导出日志包」按钮（如已实现），文件 = `logs-package.zip`<br>**步骤 3 — IndexedDB / 前端持久化错误日志**：DevTools → Application → IndexedDB → `app_events` / `error_logs` Store，按时间过滤<br>**步骤 4 — 边缘 CDN / 服务端访问日志**：Edge Pages 控制台 → Logs → 选 deployment ID + 时间范围；或 OSS 桶 access log（按 GMT+8 时间戳取）<br>**聚合定位命令（值班人手边无工具时，仓内查日志文件/目录直达）**：<br>`Get-ChildItem -Path . -Recurse -Include *.log,logs,error*,output* -ErrorAction SilentlyContinue | Select-Object -First 20 FullName,Length,LastWriteTime`<br>（若需按 release 时间范围过滤追加：`| Where-Object { $_.LastWriteTime -gt (Get-Date).AddHours(-1) }`） | 🔺 gap-3 |
| Fix-4 | **P0 临时修复后产品公告话术不一致**（客服和产品说法不同） | 公告话术未提前准备 | 用 PC-4 已存的公告模板 draft；产品值班群内 1 分钟发布（禁止现场写话术）；事后更新公告库 | §一 PC-4 |
| Fix-5 | **RCA 5 Whys 只做到 2 层就停止**（例："写 bug 了" 作为 Why2，跳过 Why3-5） | 团队缺乏 RCA 习惯 | 强制 RCA 模板 §3 必须 5 层 Why 全填；架构师 Review 后才允许归档 | §2.C 附 A |

---

## 五、证据与归档

| # | 证据 | 命名 | 生成方式 |
|---|------|------|---------|
| E1 | 48h 值守排班表（带签字） | `01-oncall-schedule-v<ver>.md` | §2.A 模板填写后保存 |
| E2 | 12 轮巡检记录（每轮 12 项结果） | `02-12-rounds-checklist.xlsx` 或 `.md` | §2.B 表格每轮填 |
| E3 | 若有 P0 故障：5 层矩阵交付件 | `03-p0-incident-<T0日期>.md` | §2.C 1-5 层矩阵填写 |
| E4 | 若有 RCA：RCA 文档（附 A） | `docs/reports/rca/YYYY-MM-DD_v<ver>_<tag>.md` | 附 A 完整模板 |
| E5 | 值守结束交接公告 | `05-handover-v<ver>-YYYY-MM-DD.md` | §2.D 模板 |
| E6 | Sentry 48h 错误导出（CSV）+ Apdex 截图 | `06-sentry-48h.csv` + `07-apdex.png` | Sentry/APM 平台导出 |

**归档目录**：`docs/reports/operations/YYYY-MM-DD_v<版本号>/`

---

## 六、阶段跳转

- **前置阶段**：[S06 发布部署 SOP](./S06-release-deployment.md) 正式发布成功 + Entry 200+Title 通过
- **值守 Gold/Silver 通过 → 本轮 SDLC 闭环**：进入 Backlog 迭代（下一版本进入 S02 日常开发）
- **值守 Bronze**：HOTFIX 分支（S06 §2.A HOTFIX 豁免）+ 重新进入 S04 → S05 → S06 → S07 HOTFIX 版 48h 值守
- **值守 Fail**：全量回归回到 S05 体检 + 架构师专项 Review，失败 RCA 必须 ≤ 3 个工作日产出

> **运维承诺**：RCA Preventive Actions 的 P1+ 项 8 周清零率 ≥ 90%（Q4 每季度审计）。连续两个季度 < 80% 触发 SRE 流程专项改造。
