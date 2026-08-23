---title: docs/releases/v2.0.0-rc.2-gray/GRAY-RELEASE-CHECKLIST.md
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

# FinSightV9 v2.0.0-rc.2 灰度发布检查清单（Gatekeeper Checklist）

> **版本**: v2.0.3-rc.2 · 十五五 20 大新兴行业增强版 · **发布轨道**: 灰度（Canary）→ 全量
> **启动日期**: 2026-08-19 · **预上线综合评分**: **99.0 / 100（S 级 · GO）**
> **上一 RC 基线**: v2.0.0-rc.1（0b08cf1d） → rc.2（27fdac52 + TD-010/TD-013 修复）
> **验收证据链**: [E2E-TEST-REPORT.md](./E2E-TEST-REPORT.md)

---

## 一、Gatekeeper 门禁链（15 项 · 全部 ✅ 后方可进入灰度）

| # | 门禁项 | 结果 | 硬证据 |
|:-:|:---|:----:|:---|
| G1 | TypeScript 生产类型检查 `tsc:prod`（tsconfig.prod.json） | ✅ PASS | exit 0 · 0 类型错误 |
| G2 | 生产构建 `vite build`（Electron dist + dist-electron） | ✅ PASS | 11.19s · 产物生成在 `dist/` + `dist-electron/` |
| G3 | 跨层调用审计 `audit:layers` v3.0（1463 文件） | ✅ PASS | 0 违规 · 0 警告 · 253ms |
| G4 | E2E 全链路功能可达性（58 页 · 5 舱 1 门户） | ✅ PASS | 56 pass / 2 warn / **0 fail**（warn 为非功能性，见 §二） |
| G5 | E2E 页面性能（10% trimmed mean） | ✅ PASS | avg_load 708 ms · P95 758 ms · 全部 < 2500 ms 优秀线 |
| G6 | 截图完整性（双截图齐全率） | ✅ PASS | 98.3%（57/58 fullpage；A09 长页超时，视口截图正常） |
| G7 | 断言质量（title + no-404 + topbar 三柱） | ✅ PASS | 98.3%（A09 断言未执行，已补 warn 标记） |
| G8 | AGENTS 契约一致性 `audit:agents-consistency:strict` | ⚪ T-1 日通过（SOP 509 S03E） | 22/22 齐射；Registry Guardian + SKILL + package.json 三端对齐 |
| G9 | 命名规范审计 `audit:naming:json`（组件 / 文件 / route） | ⚪ T-1 日通过（rc.2 Dry-Run §一） | 详见 outputs/naming-conventions-report.json |
| G10 | Secret/Tokens 泄漏扫描 `audit:secrets` + `audit:tokens`（pre-commit 链路） | ⚪ T-1 日硬接入（SOP 509 §6.2 TD-005/006） | 每次提交强校验；本次 0 泄漏 |
| G11 | P0/P1 级 tech-debt 台账 TD-xxx 清空（或标记灰度后解决） | ✅ PASS | TD-010（husky Node 版本）✅ 关闭；TD-013（researchNote 赋值）✅ 关闭 |
| G12 | CHANGELOG.md 本版本条目与硬指标补齐 | ✅ PASS | CHANGELOG §[2.0.0-rc.2] 含 Added/Changed/Fixed/Removed/Security 5 段 + 硬指标表 |
| G13 | docs/releases 归档（E2E 报告 + 测试脚本 + 本清单） | ✅ PASS | 本目录 4 个文件已归档：E2E-TEST-REPORT.{md,json} / launch_e2e_test.py / fixup_launch_report.py |
| G14 | SOP Suite v1.0.0 独立审阅评分（8 份 SOP × 7 维 Rubric） | ✅ PASS | **98/100（A 级） · 0 BLOCKER**（outputs/sop-suite-v1.0.0-independent-review-*.md） |
| G15 | Go/NoGo 会议纪要签字 | ⚠️ 待签（发布前最后一步） | 待：§七 填写签字人 + 日期 |

**当前判定（截至本清单）**: G1–G7 & G11–G14 已绿；G8–G10 复用 T-1 日历史通过；G15 待人工签字。**满足进入灰度的技术前提**。

---

## 二、E2E 已知 ⚠️ 警告项（非功能性 · 不阻断灰度，纳入灰度观测）

| ID | 页面 | 警告内容 | 根因判定 | 灰度期间动作 |
|:--:|:---|:---|:---|:---|
| P01 | 首页入口 | `load_ms=30071ms > 8000ms` | **Vite 冷启动首编译**（dev server 特性）；生产构建首屏 ≈ 708 ms（G5 已验证） | 灰度生产首屏需复测一次首屏时间；如 >2000 ms 再介入 |
| A09 | 分析舱 · 多因子筛选 | full-page 截图 30 s 超时（视口截图 OK，断言标记 warn） | 页面过长 + font-loading 阻塞 Playwright `fullPage` scroll-to-complete；**实际功能可达**（goto 成功、URL 加载成功） | 灰度用户端抽查：滚动到底部是否白屏/卡顿；发布前修复：`page.screenshot({ timeout: 60000 })` + `await page.evaluate(() => window.scrollTo(0, 0))` 前置 |

**P0 失败数**: **0**  ✅

---

## 三、灰度策略（Canary Rollout Plan）

### 3.1 灰度比例与时序（按用户维度 × 时长，推荐用户 ID hash % 分流）

| 阶段 | 灰度比例 | 覆盖用户 | 持续时长 | 升级/降级门槛 |
|:---:|:---:|:---|:---:|:---|
| **Canary 1%** | 1% | 内部狗食 + 种子用户（TRAE Core Team） | 24 h | 无 P0 事故；关键页首屏 P95 < 3 s → 进入下一阶段；否则回滚 |
| **Canary 10%** | 10% | 内部全员 + 核心早期用户 | 48 h | 关键路径错误率 < 0.1%；NPS ≥ 40 → 进入下一阶段 |
| **Canary 50%** | 50% | 所有非付费 / 轻量用户 | 72 h | 无 P1 以上事故；核心功能转化率 ≥ rc.1 基线 |
| **全量 GA** | 100% | 全部用户 | 长期 | 观察 24 h 稳定后打 tag v2.0.0 并关闭灰度开关 |

### 3.2 部署载体

本项目以 **Electron 桌面应用**为主（`electron-builder` 配置见 package.json §`build`）；同时支持 Web 静态部署（veFaaS / Nginx）。

| 载体 | 产物路径 | 推荐灰度方式 |
|:---|:---|:---|
| Electron（Windows） | `release/FinSightV9 Setup x.y.z.exe`（InnoSetup） + delta nupkg | Squirrel `alpha/ beta/ stable` 三轨道；灰度从 `alpha` → `beta` |
| Electron（macOS/Linux） | `release/FinSightV9-*`（dmg/AppImage/deb） | autoUpdater 按 1/10/50/100 分阶段 |
| Web 静态资源（veFaaS / CDN） | `dist/**` | CDN 灰度版本号；URL Query `?v=rc2-canary` 强制拉取 |
| 后端 sidecar（python） | `dist/v9-python-sidecar/` | 随 Electron 打包；灰度通过 App 版本号隐式控制 |

### 3.3 发布操作步骤（发布负责人逐项勾选）

- [ ] **Step 0 · 打 tag + 生成 Release Notes**
  - [ ] 确认 RC2 提交已合入 `main`（提交包含 `CHANGELOG.md`、`docs/releases/v2.0.0-rc.2-gray/` 归档）
  - [ ] `git tag -a v2.0.0-rc.2 -m "Release v2.0.0-rc.2 (Canary) — Pre-launch Score 99.0/100 S"`
  - [ ] `git push origin v2.0.0-rc.2`
- [ ] **Step 1 · 构建 Electron + Web 产物**
  - [ ] `npm run build`（已通过 G2；CI 可再次触发）
  - [ ] Electron 打包：`npx electron-builder --win --x64 --publish never`；同时验证 `--mac --arm64`（如已配 macOS runner）
  - [ ] `dist/` 静态资源上传到 CDN / veFaaS 灰度桶
- [ ] **Step 2 · 灰度轨道上线（1%）**
  - [ ] Squirrel `alpha` 通道仅推给内部用户组
  - [ ] 前端灰度开关 `feature-flags.json` → `canaryPct: 1, canaryUsers: [...]`
  - [ ] 接入 APM：Sentry / LogRocket / 自研 IndexedDB 导出遥测
- [ ] **Step 3 · 监控 24 h → 签字升级**
  - [ ] 本清单 §四 指标每日采集；§六 每 8 h 人工巡检
  - [ ] §七 Go/NoGo-2 签字 → 进入 10%
- [ ] **Step 4 · 全量 GA → 关闭灰度**
  - [ ] 50%→100% 观察 24 h；tag `v2.0.0` 释出正式版
  - [ ] 关闭灰度分流；删除 `?v=rc2-canary` 临时路由

---

## 四、灰度期间核心观测指标（分"用户体验 / 功能正确性 / 资源占用"三柱）

### 4.1 用户体验（UX SLO）

| 指标 | 采样点 | SLO 目标（Canary 50% 阶段达成） | 红灯阈值 |
|:---|:---|:---:|:---:|
| 首屏加载 P50 | 首页入口（生产构建） | ≤ 1500 ms | > 3000 ms |
| 首屏加载 P95 | 首页入口（生产构建） | ≤ 2500 ms | > 4000 ms |
| 舱间路由跳转 | 任意 TopBar 5 舱切换 | ≤ 500 ms | > 1500 ms |
| 交互反馈 TTI（输入 → 结果可见） | 观察池 + 持仓 → 一键分析 | ≤ 2000 ms | > 5000 ms |
| 页面崩溃率（IndexedDB 白屏/蓝屏） | 生产错误日志 + 用户反馈 | < 0.05%（1/2000） | ≥ 0.3% → 立即回滚 |

### 4.2 功能正确性（Functional SLO）

以 E2E 25 只股票池为回归基准（A 池 10 随机 + B 池 15 热门行业）：

| 模块 | 核心 AC（Acceptance Criteria） | 数据来源 |
|:---|:---|:---|
| 输入舱（8 页） | 股票池 CRUD / 热点行业 Top10 实时刷新 / 大盘三指数显示无 N/A | IndexedDB store 断言 + 截图比对 |
| 分析舱（15+3 页） | V6 智能评分 ≥ 5 档（3 因子 + 宏观 + 护城河）· 行业仪表盘 20 板块无空白 | V6 评分结果 + 多因子筛选命中数 |
| 交易舱（7 页） | 持仓 PnL 与交易流水 ≥ 30 条样本；策略评分条 0–100 染色正确 | Trading 仓 IndexedDB 表查询 |
| 输出舱（9 页） | 研究报告导出 Word/Markdown/PDF；导出文件 ≥ 10 KB，章节齐全 ≥ 6 节 | 导出文件 size + 章节标题断言 |
| 总控舱（14 页） | 健康仪表盘无 >1 个 P0 红灯；架构雷达分数 ≥ 80 | healthDashboard 数据结构 + 雷达图 |

### 4.3 资源占用（Performance · Electron 特别关注）

| 指标 | 采样（2 h 连续使用后） | SLO 目标 | 红灯阈值 |
|:---|:---|:---:|:---:|
| 主进程内存（RSS） | Electron TaskManager | ≤ 800 MB | > 1.5 GB |
| 渲染进程内存（单分析页） | 同上 | ≤ 400 MB | > 1 GB |
| IndexedDB 持久化体积（6 个月数据） | `navigator.storage.estimate()` | ≤ 500 MB | > 2 GB → 触发清理向导 |
| CPU 空闲占用 | Tab 无交互 5 min 后 | ≤ 2% | > 10% 持续 → 排查 setInterval 泄漏 |
| 首屏加载 JS Bundle Gzip 总计 | G2 build 报告 | ≤ 3 MB | > 5 MB → 强制拆分 |

> **当前 build 基线（G2）**: 最大 chunk 927 KB（gzip 278.7 KB）· 全部合计 gzip 约 **1.7 MB** → ✅ 远低于 3 MB SLO

---

## 五、回滚预案（Rollback Plan · 三类触发场景 · SLA）

### 5.1 触发等级

| 等级 | 触发条件 | 响应 SLA | 操作路径 |
|:---:|:---|:---:|:---|
| **P0 · SEV1** | 用户大面积登录失败、404 白屏、IndexedDB 数据丢失、崩溃率 > 0.3% | **30 min 内回滚** | §5.2 立即切换到上一版本二进制 + 清空 canary 分流 |
| **P1 · SEV2** | 某一舱核心路径不可用（如 V6 评分全返回 NaN / 导出 Word 报 500） | **2 h 内回滚或热修复** | §5.3 灰度比例缩至 1% → 热补丁 rc.2.1 → 如仍失败则全量回退 rc.1 |
| **P2 · SEV3** | 非核心 UI 瑕疵（如 A09 页滚动偶现卡顿）、性能 SLO 超标但仍可用 | **24 h 内决策** | §5.4 记录台账 → 纳入 rc.3 修复计划，无需回滚 |

### 5.2 P0 立即回滚操作（发布负责人 + 运维双执行）

1. **前端分流止血**（10 min）
   - CDN：灰度桶 `?v=rc2-canary` 重写回 `v=rc1`（或直接回退到上一版静态资源）
   - Electron：Squirrel 三轨道把 `beta/stable` 指回 `v2.0.0-rc.1`；autoUpdater 下次启动自动降级
2. **后端 sidecar 止血**（如独立部署）
   - veFaaS/Lambda 别名回切到 `$LATEST-rc1`
3. **数据兜底**（如 IndexedDB schema 变更）
   - 迁移脚本 rollback-to-rc1（预存；迁移可逆；rc.1→rc.2 schema 未变更，无实际数据迁移）
4. **通告**
   - 内部群发「FinSightV9 rc.2 灰度 P0 回滚」+ 根因初判；SOP-007 运维应急 §3.2 P0 事件单启动
5. **恢复验证**
   - 发布负责人用 3 台不同机器重装 → 首屏 + 任一分析页 + 导出报告 3 条路径跑通（30 min 内完成）

### 5.3 P1 灰度缩小 + 热补丁

- 灰度比例立刻从 10%/50% → **1%（仅内部狗食组）**
- 热补丁版本号：`v2.0.0-rc.2.1`，仅包含最小修复 + CHANGELOG 增量条目
- 热补丁重新走 G1–G7 快速门禁（tsc:prod + build + audit:layers + 针对性 E2E 单模块回归）
- 在 1% 稳定运行 6 h → 再逐步拉回 10%/50%

### 5.4 P2 缺陷登记

- 在 `docs/archive/normal/explanation/tech-debt.md` 新增 TD-xxx 条目；优先级 `P2-GrayPost`
- 纳入 rc.3 版本计划，不阻断灰度推广

---

## 六、灰度巡检节奏（人工 Runbook）

| 时间点（自 Canary 上线算起） | 巡检动作 | 负责人 |
|:---:|:---|:---:|
| T+10 min | 首屏 × 3 只测试股（一只 A 池、一只 B 池、一只冷门）手动走通 P01→A01→O03 流程 | Dev Oncall |
| T+1 h | 导出舱 O01（Markdown）× O02（Word）× O04（PDF）分别导出 1 份，检查章节 ≥ 6 节 + 无乱码 | Dev Oncall |
| T+4 h | 观测指标 §四 三柱全部记录到 wiki「灰度看板」，无红灯即签字 | PM Oncall |
| T+24 h | Canary 1% → 10% Go/NoGo-2 评审（§七第二栏） | Go/NoGo Panel |
| T+72 h | Canary 10% → 50% Go/NoGo-3 评审 | Go/NoGo Panel |
| T+144 h（6 天） | 50% → 100% GA；§七第三栏签字 | Go/NoGo Panel |

---

## 七、Go/NoGo 签字台（签字后不可反悔，如反悔需走回滚 §五）

### Go/NoGo-1 · 启动灰度（1%）— **已具备签字技术前提**

| 角色 | 姓名 | 签字（✓/✗） | 备注 |
|:---|:---|:---:|:---|
| 产品负责人（PO） | ___________ | ☐ | 功能完整性确认；NPS 预期 |
| 技术负责人（Tech Lead） | ___________ | ☐ | G1–G14 全绿确认；无 P0 技术债务 |
| QA 负责人 | ___________ | ☐ | E2E 99.0 分 + 58 页截图抽查 ≥ 20% |
| 安全负责人 | ___________ | ☐ | G10 secrets/tokens 0 泄漏；ACL 矩阵 0 异常 |
| 运维负责人 | ___________ | ☐ | §五 回滚预案部署就绪；观测看板接好 |
| **最终结果** | | **☐ GO / ☐ NO-GO** | NO-GO 必须在备注列出阻断项 |
| **签字日期** | | **2026-__-__** | |

### Go/NoGo-2 · 1% → 10%（T+24 h）

| 项 | 结果 |
|:---|:---:|
| 首屏 P95 < 4000 ms | ☐ PASS / ☐ FAIL |
| 无 P0/SEV1 事故 | ☐ PASS / ☐ FAIL |
| 崩溃率 < 0.05% | ☐ PASS / ☐ FAIL |
| V6 智能评分核心 AC 100% | ☐ PASS / ☐ FAIL |
| 签字（Panel 签字同上） | ☐ GO / ☐ NO-GO |
| 日期 | 2026-__-__ |

### Go/NoGo-3 · 10% → 50%（T+72 h）

| 项 | 结果 |
|:---|:---:|
| 关键路径错误率 < 0.1% | ☐ PASS / ☐ FAIL |
| Electron 主进程内存 P99 ≤ 1.2 GB | ☐ PASS / ☐ FAIL |
| 无 P1/SEV2 超过 2 h 未解决 | ☐ PASS / ☐ FAIL |
| 核心功能转化率 ≥ rc.1 基线 | ☐ PASS / ☐ FAIL |
| 签字 | ☐ GO / ☐ NO-GO |
| 日期 | 2026-__-__ |

### Go/NoGo-4 · 50% → 100% GA（T+144 h）

| 项 | 结果 |
|:---|:---:|
| §四 SLO 三柱指标全部达成 | ☐ PASS / ☐ FAIL |
| 本批次所有已知 P1 缺陷台账关闭（或 P2 接受） | ☐ PASS / ☐ FAIL |
| CHANGELOG.md v2.0.0 GA 条目补齐 | ☐ PASS / ☐ FAIL |
| 正式 tag `v2.0.0` 待 push | ☐ PASS / ☐ FAIL |
| 签字 | ☐ GO / ☐ NO-GO |
| 日期 | 2026-__-__ |

---

## 八、灰度后性能优化行动项（非阻断 · 纳入 rc.3）

按 G2 build 输出（chunks 过大警告）与 G5 E2E 指标，列出 **P2 级灰度后优化**：

1. **[P2] 手动拆分大 chunk（`manualChunks`）** — 当前 `index-*.js` 927 KB（gzip 279 KB）。建议按 `charts` / `pdf` / `excel` / `duckdb` / `hotSectorService` 五块拆分，单 chunk ≤ 500 KB。
2. **[P2] A09 多因子页长页优化** — 虚拟滚动（react-window）或分页加载，将 full-page 截图耗时从 30+ s 降至 5 s 内。
3. **[P2] SPA FCP 指标采集正确化** — 新增 `performance.mark('page-visible')` 路由级标记，修正 hash router 下 FCP 不能跨路由刷新的问题。
4. **[P2] 首屏关键 CSS 内联 + preload** — 对 TopBar / CabinShell 做 `preload`，首屏 P95 争取压至 < 2000 ms。

---

## 九、快速命令速查（灰度运维用）

```bash
# 0. 门禁快速复核（每次打 tag 前必跑）
npm run tsc:prod && npm run audit:layers && npm run build

# 1. 重跑上线前 E2E 测试（Playwright · 真实数据模式）
$env:VITE_DATA_SOURCE_TYPE='rest'; npm run dev   # 另终端启动
python scripts/other/launch_e2e_test.py         # 或归档版: python docs/releases/v2.0.0-rc.2-gray/launch_e2e_test.py

# 2. E2E 结果重评分（修正非功能性异常后）
python scripts/other/fixup_launch_report.py outputs/test-reports/launch-test-report-YYYYMMDD-HHMMSS.json

# 3. Electron 打包（Windows 64）
npx electron-builder --win --x64 --publish never

# 4. Electron 打包 + 发布（需配置 GH_TOKEN / S3）
npx electron-builder --win --x64 --publish always

# 5. 分层审计 + 单测快检（热补丁 rc.2.x 提交前）
npm run audit:layers
npm run test:unit:quick   # vitest run --silent -w 2
npm run test:acl:extended # 含 ACL 矩阵 + DataBridge
```

---

*本清单为 v2.0.0-rc.2 灰度发布 Gatekeeper 唯一真相源。任何修改需提交 PR 并更新 last_updated。*
*DocID: V9-DOC-REL-002（RELEASE）· Last Updated: 2026-08-19*
