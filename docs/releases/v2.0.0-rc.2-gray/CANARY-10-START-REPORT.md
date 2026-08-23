---title: docs/releases/v2.0.0-rc.2-gray/CANARY-10-START-REPORT.md
code_version: 2.0.0-rc.2
version: v2.0.3-rc.2
last_updated: 2026-08-23
change_log:
  - version: 2.0.3-rc.2
    changes: "基准校对(2026-08-23)：A类双轨(fm v2.0.2-rc.2 / 正文 v2.0.0-rc.2) → 取真值 max=2.0.2-rc.2 → PATCH++ 对齐 frontmatter/正文/change_log 三轨"
    date: 2026-08-23
  - version: v2.0.2-rc.2
    changes: "基准日校对(2026-08-22)：R1取真值(P1 change_log 最新条目=v2.0.1-rc.2) → R2 PATCH++(v2.0.2-rc.2) / last_updated 刷新 / change_log 闭环"
    date: 2026-08-22
- version: v2.0.1-rc.2
    changes: "基准日校对(2026-08-22)：R1取真值(P2 正文版本声明行=v2.0.0-rc.2) → R2 PATCH++(v2.0.1-rc.2) / last_updated 刷新 / change_log 闭环"
    date: 2026-08-22
---

﻿# Canary 10% 灰度发布启动报告

> **启动时间**: 2026-08-20
> **版本**: v2.0.3-rc.2 (release commit 420ed40)
> **发布轨道**: Beta (10% Canary)
> **持续时长**: 48h

---

## 一、启动配置

| 配置项 | 值 | 说明 |
|---|---|---|
| canary.enabled | **true** | 灰度开关已启用 |
| canaryPct | **10** | 10% 用户分流到 Canary |
| bucketVersion | **5** | 分流哈希版本（新 bucket） |
| forceCanaryQueryParam | v=rc2-canary-10 | 强制 Canary 测试参数 |
| release_tracks.beta | v2.0.0-rc.2 | Beta 轨道指向 rc.2 |

---

## 二、双实例部署

| 实例 | 端口 | 流量 | 版本 | 状态 |
|---|---|---|---|---|
| Stable GA | 5173 | 90% | v2.0.0 (stable) | ✅ 运行中 |
| Canary 10% | 5174 | 10% | v2.0.0-rc.2 (beta) | ✅ 运行中 |

---

## 三、验收标准

### 3.1 升级到 50% 的门槛
- [ ] 关键路径错误率 < 0.1%
- [ ] NPS ≥ 40
- [ ] 无 P0 级事故

### 3.2 回滚触发条件
- [ ] P0 事故（大面积登录失败、白屏、崩溃率 > 0.3%）→ 30min 内回滚
- [ ] P1 事故（核心模块不可用）→ 2h 内热修复或回滚
- [ ] P2 瑕疵（非核心 UI 问题）→ 24h 内决策

---

## 四、监控计划

| 时间窗口 | 监控项 | 负责人 |
|---|---|---|
| 0-2h | 首屏 P95、崩溃率、错误日志 | 值班 oncall |
| 2-8h | 核心功能 AC、资源占用 | QA + 运维 |
| 8-48h | NPS 调研、功能转化率 | 产品经理 |

---

## 五、下一步动作

- [ ] 监控 30min → 采集首波指标
- [ ] 验证关键路径（5 舱核心 AC）
- [ ] 填写 §六 监控日志
- [ ] §七 Go/NoGo 签字 → 进入 50%

---

*报告由 Canary 10% 启动流程自动生成*
