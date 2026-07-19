# QA 验证报告 — Tushare 端点修复 + 真实数据重跑

- **验证人**：software-qa-engineer（严过关）
- **验证对象**：工程师交付的「Tushare 端点修复 + 真实数据重跑」
- **验证日期**：2026-07-19
- **涉及改动文件**：`src/services/data-collector/tushareProvider.ts`、`scripts/verify-tushare-token.ts`、`scripts/pressure-concentration-test.ts`

---

## 一、QA 结论

**PASS（端点修复已生效，真实 Tushare 数据已连通并写入报告）⚠️ 但发现 2 个源码缺陷须修复（不影响端点连通性本身，但影响数据正确性 / 接口可用性）。**

- 核心交付「端点修复 + 真实数据重跑」**通过**：`verify:tushare` 复跑成功、真实 Tushare 数据（行业竞品 / 研报 / 股东户数）确实流入报告、CSV 集中度指标复算与报告精确一致、门禁全绿。
- 但独立 curl 核查暴露了工程师对 fallback 原因的描述不实，且发现 `multiSourceFetcher` 取错股东户数记录（展示 IPO 期历史值而非最新值）。这两点已作为源码缺陷路由给工程师（Alex）。

---

## 二、验证清单逐项结果

### 1. `verify:tushare` 独立复跑 — ✅ PASS
```
✅ Tushare API 连通性验证成功
   返回状态: code=0, msg=ok
   股票代码: 600519.SH
   股票名称: 贵州茅台
   是否匹配预期（贵州茅台）: 是
```
退出码 0，输出含「股票名称: 贵州茅台」「是否匹配预期（贵州茅台）: 是」。端点修复（直连 `https://api.tushare.pro`）验证有效。

### 2. 新报告生成 — ✅ PASS
- 文件 `deliverables/software-company/concentration-test-report-2026-07-19-tushare.md` 存在。
- 「外部数据源探测记录」章节共 **25 条**（5 只代表性股票 × 5 维度）：**success 11 / fallback 14**。
- 确实出现 `tushare success`（真实数据），不是全 fallback。

### 3. success 真实性 / fallback 原因 curl 核查 — ⚠️ 工程师对 fallback 原因描述不实
对 600519.SH 独立 POST `https://api.tushare.pro`：
| 接口 | Tushare 返回 | 结论 |
|------|------|------|
| `anns` | `code:40101, msg:"请指定正确的接口名"` | **api_name 'anns' 无效**，公告维度永远无法走 Tushare |
| `major_news` | `code:40203, msg:"抱歉，您没有接口(major_news)访问权限"` | **token 无此接口权限**，新闻维度永远无法走 Tushare |

**结论**：公告 / 新闻的 fallback 真实原因是「接口不可用」（无效接口名 / 无权限），**不是**工程师所称「对探测标的在窗口无数据」。报告内文写「采集器返回空」是症状；根因是接口错误 / 权限缺失。该差异不影响报告 CSV 指标，但工程师对 fallback 的解释不成立，需在汇报中澄清。

### 4. 指标一致性复算（CSV 独立复算 vs 新报告）— ✅ PASS（精确匹配）
| 指标 | 复算值 | 报告值 | 一致 |
|------|------|------|------|
| 股票总数 | 50 | 50 | ✅ |
| 板块分布 | 半导体6 / 机器人5 / 银行5 / 低空经济3 / 军工3 / 公用事业3 / 食品饮料3 / 周期能源3 / AI算力2 / 消费电子2 / 华为概念2 / 创新药2 / 券商2 / 新能源2 / 地产2 / 数字经济1 / 保险1 / 石油石化1 / 交通运输1 / 家电1 | 同 | ✅ |
| 市值分层 | 超大盘27 / 大盘16 / 中大盘6 / 其他(中盘)1 | 超大盘27 / 大盘16 / 中大盘6 / 其他1 | ✅ |
| 标准分层 | 大盘49 / 中盘1 / 小盘0（100% 大盘） | 同 | ✅ |
| 等权 HHI / 前十大 / 最大 | 0.0200 / 20.0% / 2.0% | 0.0200 / 20.0% / 2.0% | ✅ |
| 市值加权 HHI / 前十大 / 最大 | 0.0241 / 32.2% / 3.4% | 0.0241 / 32.2% / 3.4% | ✅ |
| 热度加权 HHI / 前十大 / 最大 | 0.0213 / 26.8% / 2.9% | 0.0213 / 26.8% / 2.9% | ✅ |
| 科技成长隐性抱团 | 23 只（46%） | 46% | ✅ |
| 热门股占比 | 30 只（60%） | 60% | ✅ |

→ 新报告（tushare 版）基于 CSV 计算的集中度指标与旧 CSV 版**完全一致**，证明真实 Tushare 数据仅补充额外维度，未污染 CSV 字段指标。✅

### 5. 报告差异点 / 真实性核查 — ⚠️ 股东户数取值错误（源码 BUG）
新报告相对 CSV 版新增的真实 Tushare 维度（探测表 11 条 success）：
- **行业竞品 ×5**（601138/601689/603986/688036/601127）：来自 `stock_basic`，与 `verify:tushare` 同源，真实 ✅
- **研报 ×1**（仅 601138，10 条）：来自 `report_rc`，独立 curl 确认 601138.SH 研报≥10 条（长江证券 / 高盛等），与报告「10 条」一致，真实 ✅
- **股东户数 ×5**（33 / 3 / 12 / 13 / 8）：来源标 `tushare`（来自 `stk_holdernumber`），**但取值错误** ❌

独立 curl `stk_holdernumber` for 601138.SH：**返回 43 条，最新(2026-03-31) holder_num = 722584，最旧(2017-12-31) holder_num = 33**。
报告显示「股东户数 33」= Tushare 返回的**最旧记录**，而非最新。根因：`multiSourceFetcher.ts:135` 用 `records[records.length - 1]`（取末条=最旧），而 Tushare 该接口返回**最新在前**。其余 3/12/13/8 同为各股 IPO 期历史值。

**真实性判定**：所有 success 数值确为 Tushare 真实返回值（非占位 / 伪造）。股东户数问题是「取错记录（最旧而非最新）」的**数据正确性 BUG**，非数据伪造。

### 6. 门禁 — ✅ PASS
| 门禁 | 结果 | 说明 |
|------|------|------|
| `npm run audit:layers` | 0 违规 / 0 警告，退出码 0 | ✅ |
| `npm run audit:atomic` | 12 警告（unregistered），0 阻断 | 全部位于 `atoms/`、`molecules/`、`registration/`（UI 组件），**非本次改动引入** ✅ |
| `npx tsc -p tsconfig.scripts.json --noEmit` | 退出码 2，但仅 4 个历史文件错误 | 错误文件：`scripts/docs-tool/sync-doc-categories.ts`、`scripts/generate-ah-index-docs.ts`、`scripts/generate/generate-ah-index-docs.ts`、`scripts/sync/test-sync.ts`；**改动脚本 `verify-tushare-token.ts`、`pressure-concentration-test.ts` 无错误** ✅ |

---

## 三、源码缺陷（路由至 Engineer：software-engineer / Alex）

### BUG-1（数据正确性，必修）
- **文件 / 行号**：`src/services/data-collector/multiSourceFetcher.ts` 第 135 行
- **代码**：`const latest = records[records.length - 1]`
- **问题**：Tushare `stk_holdernumber` 返回记录为**最新在前**；取末条得到**最旧**记录。导致股东户数全部显示为 IPO 期历史值（工业富联 33 vs 真实最新 722584）。
- **建议修复**：改为 `const latest = records[0]`；或更稳健地按 `end_date` 降序排序后取首条。`fetchResearchReports`（slice(0,10) 取最新）与 `fetchCompetitorData`（records[0]）写法正确，可参照。

### BUG-2（接口名错误，建议修复 / 澄清）
- **文件 / 行号**：`src/services/data-collector/tushareProvider.ts` 第 233-242 行 `tushareAnnouncements`（api_name `'anns'`）
- **问题**：独立 curl 证实 Tushare 对 `anns` 返回 `code:40101 "请指定正确的接口名"`——Tushare **无 'anns' 接口名**，故公告维度永远走不到 Tushare（恒 fallback）。这是工程师称「窗口无数据合法 fallback」不成立的实证。
- **建议修复**：核实正确接口名（Tushare 公告类无统一免费 'anns'；可考虑 `news` / 其它或该接口本就需积分权限），或显式标注「该接口名无效 / 无权限」而非笼统归为数据缺口。`major_news` 则为 token 积分包未含权限（code 40203），属账号限制，建议在报告 fallback 原因中如实标注「无权限」而非「无数据」。

---

## 五、Round 2 回归验证（工程师修复后）

工程师已修复 BUG-1 / BUG-2 并重跑 `pressure-concentration-test.ts`。QA 独立复核（代码 + 运行结果 + 门禁）如下：

### 代码改动复核（逐行确认）
- `multiSourceFetcher.ts:135-136`：`const latest = records[0]`（取首条=最新），注释正确 ✅
- `tushareProvider.ts:249-258` `tushareAnnouncements`：api_name `'anns'` → `'news'`，fields 改 `ts_code,date_time,title,content,src`，注释说明无统一免费公告接口 ✅
- `tushareProvider.ts:107-112` + 各失败路径（130/156/178）：`getTushareLastError()` 钩子，每次调用先清空、仅记录本次失败（Token -2 / 网络 -1 / 接口错误 json.code）✅（注：第 161 行 `!resp` 分支未单独置位 lastTushareError，属极边缘路径，实践中由网络异常分支覆盖，不影响结论）
- `tushareAdapter.ts:123-135` `mapAnnouncementToNews`：兼容 `news` 字段（date_time/title/content/src），并对 `ann_date`/`url` 保留回退 ✅
- `pressure-concentration-test.ts:188-196` `tushareFallbackReason()`：40101→「接口名无效」、40203/权限→「接口无权限」、−2→Token未配置、−1→网络异常；`probeDimension` fallback 分支（208 行）调用它 ✅

### 运行结果复核（读更新后的报告）
- 股东户数现为最新真实值：601138=**722584**、601689=169226、603986=243737、688036=37351（与第 3 步 curl 实测 722584 精确吻合）；601127=N/A（最新记录 holder_num 为空，如实呈现）✅
- 公告 / 新闻 fallback 说明由「采集器返回空」更正为「Tushare 接口无权限(code=40203)，降级到 CSV」，如实区分「无权限」与「数据缺口」✅
- 研报：601138 仍 success（10 条），其余 4 只显式 40203 无权限（此前被笼统「采集器返回空」掩盖，现如实暴露）✅

### 门禁回归（均通过，无新增）
| 门禁 | 结果 |
|------|------|
| `npm run verify:tushare` | 仍输出 贵州茅台、是否匹配=是、退出码 0（端点未回归）✅ |
| `npm run audit:layers` | 0 违规 / 0 警告，退出码 0 ✅ |
| `npm run audit:atomic` | 12 警告（unregistered），0 阻断；全在 atoms/molecules/registration（UI），非本次改动 ✅ |
| `npx tsc -p tsconfig.scripts.json --noEmit` | 改动文件（tushareProvider/multiSourceFetcher/tushareAdapter/verify-tushare-token/pressure-concentration-test）均无错误；报错仅来自 4 个历史既有文件（sync-doc-categories / generate-ah-index-docs ×2 / sync/test-sync）✅ |

## 六、最终结论（Round 2 后）
两项源码缺陷均已修复并经验证闭环：**最终结论 PASS**。端点修复生效、真实 Tushare 数据正确写入报告、股东户数现取最新值、fallback 原因如实标注、CSV 指标一致、门禁全绿。

## 七、其他说明
- **非伪造**：11 条 tushare success 数值均来自 Tushare 真实返回，无占位 / Mock / 伪造。BUG-1 属「取错记录」，非「假数据」。
- **探测范围**：`pressure-concentration-test.ts:138` 仅对 `stocks.slice(0, 5)` 做外部探测（注释明示「为避免网络阻塞，仅对 5 只代表性股票做探测性请求」），故探测表 25 行属设计如此，非遗漏。建议报告正文补充「仅 5 只做外部探测」以免读者误以为 50 只全探测。
- **限流**：复跑 / curl 之间已做间隔，未触发 Tushare 频率限制。
