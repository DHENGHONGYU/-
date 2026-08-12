# TD-015 跨配置源引用治理总结报告

| 项目 | 内容 |
|:---|:---|
| 报告类型 | 技术债治理总结报告 |
| 技术债编号 | TD-015 |
| 治理日期 | 2026-08-09 |
| 关联技术债 | TD-012（directDataAPI 重复副本迁移，已完成） |
| 看板状态 | ✅ Done |
| 报告归档位置 | deliverables/software-company/td-015-governance-summary-2026-08-09.md |

---

## 一、执行摘要

TD-015「跨配置源引用治理（dataSourceUrls vs marketDataEndpoints）」于 2026-08-09 完成全生命周期治理。本次治理解决了 `src/config/dataSourceUrls.ts`（绝对 URL，Node/Electron 直连）与 `src/config/marketDataEndpoints.ts`（Vite proxy 路径，浏览器专用）两份配置源并存导致的 4 处混淆问题。

**核心成果**：
- ✅ 3 处高风险代码问题已治理（跨源引用隐式化 + 死代码 + 误导性命名）
- ✅ 3 个代码文件 + 4 个文档文件完成同步更新
- ✅ 3 文件 GetDiagnostics 全 0 错误，一致性脚本退出码 = 0
- ✅ 看板状态正式切换为 Done，文档全链路归档

**关键决策**：
- 不拆分 tushareProvider 为 browser/node 版本（已有运行时环境检测，拆分违反"避免过度工程化"）
- 死代码直接删除（MOCK_TENCENT/SINA/NETEASE 经 Grep 确认无消费者）
- 运行时常量重命名为语义化名称（MOCK_AKSHARE → AKSHARE_LOCAL）

---

## 二、关键指标对比

### 2.1 代码层指标

| 指标 | 治理前 | 治理后 | 变化 | 改善率 |
|:---|:---:|:---:|:---:|:---:|
| dataSourceUrls.ts 常量数 | 16 | 13 | -3 | 18.75% 精简 |
| 死代码常量数 | 3 | 0 | -3 | 100% 清除 |
| MOCK_* 误导性命名 | 4 | 2 | -2 | 50% 消除 |
| 跨源引用隐式三元表达式 | 1 | 0 | -1 | 100% 显式化 |
| resolveTushareUrl() 函数 | 0 | 1 | +1 | 环境检测逻辑封装 |
| 文件总行数（3 文件） | ~1450 | ~1420 | -30 | 2.07% 精简 |

### 2.2 配置源分工清晰度

| 维度 | 治理前 | 治理后 |
|:---|:---|:---|
| 配置源分工文档 | ❌ 无 | ✅ 两份配置文件顶部均有分工说明 |
| MOCK_* 命名说明 | ❌ 无 | ✅ 记录已删除常量 + 重命名原因 |
| 跨源引用警示 | ❌ 无 | ✅ tushareProvider + multiSourceFetcher 注释说明 |
| 环境检测逻辑 | 🟡 隐式三元表达式 | ✅ 显式 resolveTushareUrl() 函数 |

### 2.3 文档同步指标

| 文档 | 治理前状态 | 治理后状态 |
|:---|:---|:---|
| TECH-DEBT.md | 🟡 缓解中 | ✅ Done |
| CHANGELOG.md | ❌ 无 TD-015 条目 | ✅ 已追加 P2-P3 治理条目 |
| development-log.md | ❌ 无阶段二十一 | ✅ 已追加（87 行） |
| directDataAPI-migration-report | 🟡 P2/P3 待规划 | ✅ P2 已完成，P3 暂缓 |

---

## 三、验证结果

### 3.1 类型安全验证

| 文件 | GetDiagnostics 结果 | 状态 |
|:---|:---:|:---:|
| [src/services/data-collector/tushareProvider.ts](file:///d:/FinSightV9/src/services/data-collector/tushareProvider.ts) | 0 错误 0 警告 | ✅ |
| [src/config/dataSourceUrls.ts](file:///d:/FinSightV9/src/config/dataSourceUrls.ts) | 0 错误 0 警告 | ✅ |
| [src/services/data-collector/multiSourceFetcher.ts](file:///d:/FinSightV9/src/services/data-collector/multiSourceFetcher.ts) | 0 错误 0 警告 | ✅ |

### 3.2 自动化脚本验证

| 验证项 | 脚本 | 结果 | 状态 |
|:---|:---|:---:|:---:|
| directDataAPI 一致性 | `node scripts/audit-directDataAPI-consistency.mjs` | exit code = 0 | ✅ |
| 适配层完整性 | 同上（内置检查） | 8 项运行时 + 2 项类型 export 齐全 | ✅ |

### 3.3 向后兼容性验证

| 验证项 | 结果 | 状态 |
|:---|:---:|:---:|
| tushareProvider 环境检测逻辑 | resolveTushareUrl() 保持原有 if/else 语义 | ✅ |
| dataSourceUrls 剩余常量 | 13 个常量全部保留，仅删除死代码 | ✅ |
| multiSourceFetcher 运行时行为 | AKSHARE_LOCAL_BASE_URL 值不变（'http://localhost:8000'） | ✅ |
| 消费者零破坏 | 3 个消费者无需修改业务逻辑 | ✅ |

---

## 四、变更文件清单

### 4.1 代码文件（3 个）

| # | 文件 | 变更类型 | 变更内容 |
|:---:|:---|:---|:---|
| 1 | [tushareProvider.ts](file:///d:/FinSightV9/src/services/data-collector/tushareProvider.ts) | 重构 | 新增 resolveTushareUrl() 函数（L89-106）+ 替换内联三元表达式 + 注释更新 |
| 2 | [dataSourceUrls.ts](file:///d:/FinSightV9/src/config/dataSourceUrls.ts) | 清理 + 重命名 | 删除 3 死代码 + MOCK_AKSHARE → AKSHARE_LOCAL + 注释更新 |
| 3 | [multiSourceFetcher.ts](file:///d:/FinSightV9/src/services/data-collector/multiSourceFetcher.ts) | 更新 | import 路径 + 使用处更新 + 注释更新 |

### 4.2 文档文件（4 个）

| # | 文件 | 变更类型 | 变更内容 |
|:---:|:---|:---|:---|
| 4 | [TECH-DEBT.md](file:///d:/FinSightV9/docs/reports/TECH-DEBT.md) | 状态切换 | TD-015 状态 → Done + P2-P3 治理进展记录 |
| 5 | [CHANGELOG.md](file:///d:/FinSightV9/CHANGELOG.md) | 追加 | TD-015 P2-P3 治理条目（4 项变更 + 验证结果） |
| 6 | [development-log.md](file:///d:/FinSightV9/docs/reports/changelogs/development-log.md) | 追加 | 阶段二十一（87 行：时间线 + 实现细节 + 验证 + 问题） |
| 7 | [directDataAPI-migration-report-2026-08-09.md](file:///d:/FinSightV9/deliverables/software-company/directDataAPI-migration-report-2026-08-09.md) | 更新 | 第五章后续建议状态更新 |

---

## 五、治理决策记录

### 5.1 关键决策 1：不拆分 tushareProvider

| 维度 | 内容 |
|:---|:---|
| 原方案 | 拆分为 tushareProvider.browser.ts + tushareProvider.node.ts |
| 实际方案 | 提取 resolveTushareUrl() 函数，保持单文件设计 |
| 决策依据 | L141-145 已有运行时环境检测（typeof window === 'undefined'），拆分违反"避免过度工程化"原则 |
| 收益 | 减少文件数 + 保持单一真相源 + 环境检测逻辑显式化 |

### 5.2 关键决策 2：死代码直接删除

| 维度 | 内容 |
|:---|:---|
| 对象 | MOCK_TENCENT_BASE_URL / MOCK_SINA_BASE_URL / MOCK_NETEASE_BASE_URL |
| 决策依据 | Grep 全仓扫描确认无任何消费者（FetcherConfigPage 使用 dataSourceRegistry 的 DATA_SOURCE_ENDPOINTS） |
| 收益 | 消除误导性命名 + 减少 dataSourceUrls.ts 维护负担 |

### 5.3 关键决策 3：MOCK_AKSHARE 重命名为 AKSHARE_LOCAL

| 维度 | 内容 |
|:---|:---|
| 原命名 | MOCK_AKSHARE_BASE_URL（暗示 Mock 数据） |
| 新命名 | AKSHARE_LOCAL_BASE_URL（反映运行时直连本地 Python 服务） |
| 决策依据 | multiSourceFetcher.ts L85 运行时使用该常量直连 :8000，是运行时常量而非展示常量 |
| 收益 | 命名反映真实语义 + 消除 MOCK_ 前缀误导 |

### 5.4 关键决策 4：P3-2 命名规范统一暂缓

| 维度 | 内容 |
|:---|:---|
| 暂缓项 | 统一命名规范（`*_DIRECT_URL` / `*_PROXY_PATH` 后缀） |
| 暂缓原因 | 需重命名 ~15 个常量 + 全量回归，收益有限 |
| 长期方案 | 保留为 TD-015 P3 可选长期方案，2026-09-30 前评估 |

---

## 六、治理生命周期

| 阶段 | 时间 | 状态 | 交付物 |
|:---|:---|:---:|:---|
| 发现与记录 | 2026-08-09 | ✅ | TECH-DEBT.md 新增 TD-015 |
| P0 缓解措施 | 2026-08-09 | ✅ | 警示注释 + 配置源分工说明 |
| P2-1 tushareProvider 治理 | 2026-08-09 | ✅ | resolveTushareUrl() 函数 |
| P2-2 死代码清理 + 重命名 | 2026-08-09 | ✅ | 删除 3 + 重命名 1 |
| P3-1 MOCK_* 部分重命名 | 2026-08-09 | ✅ | 保留确实是 Mock 的 2 个 |
| P3-2 命名规范统一 | 长期 | 🟡 暂缓 | 可选方案 |
| 看板状态切换 | 2026-08-09 | ✅ | TECH-DEBT.md → Done |
| 文档归档同步 | 2026-08-09 | ✅ | 4 处文档全同步 |
| **总结报告生成** | **2026-08-09** | **✅** | **本报告** |

---

## 七、后续展望

| 优先级 | 任务 | 时间 | 状态 |
|:---:|:---|:---|:---:|
| P3 | 命名规范统一（`*_DIRECT_URL` / `*_PROXY_PATH` 后缀） | 2026-09-30 前评估 | 🟡 暂缓 |
| 监控 | 持续监控新代码是否引入跨配置源混淆引用 | 持续 | 🟢 进行中 |
| 复盘 | 季度技术债复盘会议评估 TD-015 治理效果 | 2026-09-30 | 🟡 待规划 |

---

## 八、附录：自动化验证脚本使用方式

```bash
# 运行 directDataAPI 一致性检查（含适配层完整性验证）
node scripts/audit-directDataAPI-consistency.mjs

# 退出码说明
# 0 = 全部一致（适配层完整 or 独立副本一致）
# 1 = 存在不一致项
```

建议将此脚本加入 CI / pre-commit hook，长期守护 TD-012 + TD-015 不回归。
