# 2026-08-07 Agent集群修复变更日志

> **版本**: v2.0.0 → v2.1.0
> **日期**: 2026-08-07
> **执行方式**: AI Agent集群并行执行（3批 × 5个subagent）
> **修复项**: 14项（P0×5 + P1×6 + P2×3）

---

## 一、修复总览

| 优先级 | 任务数 | 完成 | 成功率 |
|--------|--------|------|--------|
| P0（阻塞） | 5 | 5 | 100% |
| P1（严重） | 6 | 6 | 100% |
| P2（优化） | 3 | 3 | 100% |
| **总计** | **14** | **14** | **100%** |

---

## 二、P0级修复（5项）

### P0-1: 清理routes.ts无效路由
- **文件**: `src/config/routes.ts`
- **变更**: 删除3个注释路由（MockTestPage/StockQuoteDashboardDemoPage/WidgetPriceGuardVerifyPage）
- **验证**: audit:deadcode 从3违规→0，tsc:prod通过

### P0-2: 修复fetchMarketData假按钮
- **文件**: `src/mcp/servers/data-collector/dataCollectorServer.ts`
- **变更**: 空数据响应→结构化错误响应（isError:true），描述标注[未实现]
- **验证**: tsc:prod通过，dataCollectorServer测试7/7通过

### P0-3: 提取3处硬编码API路径到config层
- **新建**: `src/config/apiEndpoints.ts`
- **修改**: stockSearchClient.ts / cloudEmbeddingService.ts / llmSearchAgent.ts
- **发现**: Smartbox路径复用已有marketDataEndpoints.ts的TENCENT_SMARTBOX_API
- **验证**: tsc:prod通过，audit:hardcode不再报告这3个文件

### P0-4: 修复MCP ACL权限矩阵不一致
- **文件**: `src/config/mcpAclMatrix.ts`
- **变更**: 确认list_pool_items/list_groups为纯查询，从排除注释移除，消除注释矛盾
- **验证**: tsc:prod通过，mcpAclInterceptor测试76/76通过

### P0-5: 构建文档交叉索引基线
- **新建**: `scripts/cross-index/build-master-index.ps1`
- **修复**: `scripts/cross-index/build-doc-relations.ps1`（2个bug）
- **生成**: master-index.json(757文档) + relation-index.json + baseline-report
- **基线数据**: 总链接1760，未解析520，孤儿307，重要层级孤儿64

---

## 三、P1级修复（6项）

### P1-1: CollectionProgress颜色硬编码清理
- **新建**: `src/constants/collectionColors.ts`
- **修改**: `src/components/organisms/pool/CollectionProgress.tsx`（14处→0）
- **验证**: audit:hardcode不再报告该文件

### P1-2: NewsCrawler URL+魔法数字清理
- **新建**: `src/config/newsSources.ts`
- **修改**: `src/services/data-collector/collectors/NewsCrawler.ts`（4 URL + 5魔法数字→0）
- **验证**: audit:hardcode URL 9→5，魔法数字 9→4

### P1-3: isCollecting重构验证
- **发现**: Store已实现collectingDimensions:string[] + isCollecting:boolean双字段同步
- **修改**: 补全7DimConfigStore测试9处collectingDimensions断言
- **验证**: 76+73测试全通过

### P1-4: 文档版本漂移修复
- **文件**: `docs/reference/adr-014-vector-search-over-tfidf.md`
- **变更**: code_version从2.1.0→2.0.0（与package.json对齐）
- **验证**: audit:docs退出码0

### P1-5: MOCK_STOCK_LIBRARY标记@deprecated
- **文件**: `src/services/input/mockStockLibrary.ts`
- **变更**: 添加完整@deprecated JSDoc含迁移说明
- **确认**: 无生产代码引用

### P1-6: MCP Server文档更新
- **文件**: `docs/reference/adr-mcp-server-lifecycle.md`
- **变更**: 新增10启用+5禁用Server表格 + 恢复流程章节
- **验证**: audit:docs通过，759文档版本一致

---

## 四、P2级修复（3项）

### P2-1: PoolBoardPage颜色硬编码清理
- **新建**: `src/constants/poolStatusColors.ts`
- **修改**: `src/pages/analysis/PoolBoardPage.tsx`（5处→0）

### P2-2: InputDashboard颜色硬编码清理
- **修改**: `src/apps/input/InputDashboard.tsx`
- **复用**: 已有HOVER.bgStone50Half令牌（theme.tokens.helpers.ts）

### P2-3: @doc标签验证
- **发现**: 18/19核心文件已有@doc标签（数组格式`@doc [V9-DOC-XXX]`）
- **修复**: dataLayer.ts空引用`@doc []`→填充真实doc_id
- **实际覆盖率**: 100个文件已有@doc标签，54个文件为空引用

---

## 五、双向回归测试结果

### 正向验证（修复目标达成）

| 修复项 | 修复前 | 修复后 | 状态 |
|--------|--------|--------|------|
| audit:deadcode 路由缺失 | 3处 | 0处 | ✅ |
| audit:docs 版本漂移 | 1处 | 0处 | ✅ |
| audit:hardcode CollectionProgress | 14处 | 0处 | ✅ |
| audit:hardcode NewsCrawler URL | 4处 | 0处 | ✅ |
| audit:hardcode NewsCrawler 魔法数字 | 5处 | 0处 | ✅ |
| audit:hardcode API路径(stockSearch/embed/llm) | 3处 | 0处 | ✅ |
| audit:layers 跨层违规 | 0处 | 0处 | ✅ |
| tsc:prod 类型检查 | 通过 | 通过 | ✅ |
| ACL拦截器测试 | 76/76 | 76/76 | ✅ |
| 7DimConfigStore测试 | 76+73 | 76+73 | ✅ |

### 逆向验证（未引入新问题）

| 检查项 | 修复前 | 修复后 | 状态 |
|--------|--------|--------|------|
| audit:layers | 0违规 | 0违规 | ✅ 无新增 |
| audit:deadcode | 3违规+39警告 | 0违规+39警告 | ✅ 违规清零，警告不变 |
| audit:docs | 1违规 | 0违规 | ✅ 违规清零，文档数758→761 |
| audit:hardcode | 61处违规 | 28处违规 | ✅ 减少33处，无新增 |
| tsc:prod | 通过 | 通过 | ✅ 无类型错误 |

**结论**: 双向回归测试全部通过，所有P0和P1级任务修复目标已达成，未引入任何新问题。

---

## 六、修改文件清单

### 新建文件（6个）
| 文件 | 用途 |
|------|------|
| `src/config/apiEndpoints.ts` | API端点配置 |
| `src/config/newsSources.ts` | 新闻源配置 |
| `src/constants/collectionColors.ts` | 采集状态颜色令牌 |
| `src/constants/poolStatusColors.ts` | 股票池状态颜色令牌 |
| `scripts/cross-index/build-master-index.ps1` | 文档主索引构建脚本 |
| `docs/00-meta/ai-index/baseline-report-2026-08-07.json` | 交叉索引基线报告 |

### 修改文件（12个）
| 文件 | 修改内容 |
|------|----------|
| `src/config/routes.ts` | 删除3个无效路由 |
| `src/mcp/servers/data-collector/dataCollectorServer.ts` | 假按钮→错误响应 |
| `src/config/mcpAclMatrix.ts` | 修复注释矛盾 |
| `src/services/stock/stockSearchClient.ts` | 导入config常量 |
| `src/services/system/cloudEmbeddingService.ts` | 导入config常量 |
| `src/services/data-collector/llmSearchAgent.ts` | 导入config常量 |
| `src/components/organisms/pool/CollectionProgress.tsx` | 颜色令牌替换 |
| `src/services/data-collector/collectors/NewsCrawler.ts` | URL+魔法数字提取 |
| `src/services/input/mockStockLibrary.ts` | @deprecated标注 |
| `src/pages/analysis/PoolBoardPage.tsx` | 颜色令牌替换 |
| `src/apps/input/InputDashboard.tsx` | 颜色令牌替换 |
| `src/data/dataLayer.ts` | @doc空引用填充 |

### 文档更新（3个）
| 文件 | 修改内容 |
|------|----------|
| `docs/meta/GOVERNANCE.md` | 追加v2.1.0变更日志 |
| `docs/reference/adr-014-vector-search-over-tfidf.md` | code_version修正 |
| `docs/reference/adr-mcp-server-lifecycle.md` | MCP Server状态表格更新 |

### 测试文件更新（2个）
| 文件 | 修改内容 |
|------|----------|
| `src/store/sevenDimConfigStore.test.ts` | 补全3处collectingDimensions断言 |
| `tests/__tests__/sevenDimConfigStore.test.ts` | 补全6处collectingDimensions断言 |

### 脚本修复（2个）
| 文件 | 修改内容 |
|------|----------|
| `scripts/cross-index/build-master-index.ps1` | 新建 |
| `scripts/cross-index/build-doc-relations.ps1` | 修复2个bug |

---

## 七、重要发现

### 7.1 @doc标签体系已存在
审计中"src/零@doc标签"结论是搜索模式不匹配导致的误报：
- 实际格式: `@doc [V9-DOC-XXX, ...]`（数组格式）
- 搜索模式: `@doc V9-DOC-`（无括号，不匹配）
- 实际覆盖率: 100个文件已有@doc标签，54个文件为空引用`@doc []`

### 7.2 isCollecting重构已完成
Store中已实现 collectingDimensions:string[] + isCollecting:boolean 双字段同步，本次仅补全了测试断言。

### 7.3 文档交叉索引基线数据
- 总文档数: 757
- 总链接数: 1760（已解析1165，未解析520）
- 孤儿文档: 307（重要层级64个）
- doc_id覆盖率: 40.3%

---

## 八、后续建议

### 短期（1周内）
1. 修正审计搜索模式为 `@doc.*V9-DOC-` 以兼容数组格式
2. 填充剩余54个空`@doc []`文件
3. 治理64个important tier孤儿文档

### 中期（2周内）
1. 清理剩余28处audit:hardcode违规（dataLayer.test-utils/crawlerProvider/tushareProvider等）
2. 清理ESLint警告（当前2018处）
3. 建立audit:acl-consistency自动化脚本

### 长期（1月内）
1. 补充组件集成测试层
2. 建立数据质量仪表盘（6维指标）
3. 将交叉索引检查纳入CI门禁
