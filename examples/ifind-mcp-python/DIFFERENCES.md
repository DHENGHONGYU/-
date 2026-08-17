# iFinD MCP Python 实现 vs TypeScript 原始实现 — 差异对照表

> 对照基准：V9 数据血缘追踪文档 v1.4.0，TypeScript 源码 `src/services/data-collector/`、`src/core/databridge.ts`

---

## 一、语言与平台差异

| 差异维度 | TypeScript 原版 | Python 实现 | 差异说明 |
|---------|----------------|------------|---------|
| 语言 | TypeScript 5.x (strict mode) | Python 3.10+ | TS 有编译期类型检查，Python 运行时检查；Python 用 `dataclass` + `IntEnum` 模拟 TS 的 `interface` + `enum` |
| 异步模型 | `Promise` / `async-await` | `asyncio` / `async-await` | 语义等价，但 TS 的 `Promise.all()` 对应 Python 的 `asyncio.gather()`；Python 需显式管理事件循环 (`asyncio.run()`) |
| 类型系统 | 结构化类型 (`interface`, `type`) | 名义类型 (`dataclass`, `Enum`) | TS 的 `interface` 是结构匹配，Python 的 `dataclass` 是名义匹配；Python 用 `Optional[X]` 替代 TS 的 `X | null` |
| 模块导入 | ES Module `import` / `export` | Python `import` | TS 支持 tree-shaking 和路径别名 (`@/`)，Python 用相对/绝对导入 |
| 泛型/Lambda | 完整泛型 + `=>` 箭头函数 | `TypeVar` + `def` / `lambda` | Python 的 `Callable[[str], dict]` 对应 TS 的 `(symbol: string) => McpArgs` |

---

## 二、运行时环境差异

| 差异维度 | TypeScript 原版 (浏览器) | Python 实现 (独立进程) | 差异说明 |
|---------|------------------------|----------------------|---------|
| 存储层 | IndexedDB (`db.put/store.get`) | 内存字典 `self._stores: dict` | Python 版无持久化，进程退出即丢失；TS 版通过 `idb` 库实现 53 个 ObjectStore |
| 网络请求 | `fetch()` + Vite Proxy | `aiohttp` (HTTP 模式) / 纯 Mock | TS 版走浏览器原生 `fetch`，经 Vite 代理转发到后端；Python 版 `_call_http` 是框架代码，实际走 Mock |
| MCP 调用 | `run_mcp()` 工具 (Trae MCP 框架) | `McpClient.call_tool()` 模拟 | TS 版通过 Trae 的 MCP 运行时调用真实 iFinD 服务；Python 版 `run_mcp()` 是模拟函数，生产需替换为真正的 MCP JSON-RPC 客户端 |
| 日志系统 | `getLogger()` (结构化日志) | `print()` / 无日志框架 | TS 版有完整的日志分级、上下文绑定；Python 版仅用 `print` 输出 |
| 事件总线 | `eventBus` (发布订阅) | 回调函数 `on_event` | TS 版用全局 `eventBus` 解耦模块间通信；Python 版用直接回调传递 |
| 状态管理 | Zusand Store (响应式) | 无状态管理 | TS 版 `sevenDimConfigStore` 等是 Zusand 响应式 Store；Python 版无状态管理，数据通过参数传递 |

---

## 三、架构简化

| 差异维度 | TypeScript 原版 | Python 实现 | 差异说明 |
|---------|----------------|------------|---------|
| 文件粒度 | 25+ 文件，高度模块化 | 8 文件，单文件承载多职责 | TS 版按职责拆分：`mcpCollector.ts`、`dimensionDataTypes.ts`、`fieldMerger.ts`、`kimiAIService.ts` 等独立文件；Python 版将相关逻辑合并在同一文件中 |
| 依赖注入 | 无框架，手动组装 | 构造函数注入 | 两者均无 DI 框架，但 TS 版通过模块级单例 (`export const dataBridge = new DataBridge()`) 共享实例，Python 版通过构造函数传递 |
| 配置管理 | `config/dbConfig.ts`、`config/collectConfig.ts` 等分散配置 | 集中在 `dimension_mapping.py` | TS 版配置分散在多个 config 文件中；Python 版将所有映射配置集中在一个文件 |
| 错误处理 | 分层错误处理 (`EnvelopeError`、`McpError` 等自定义错误类) | 通用 `Exception` + 字符串错误码 | TS 版有完整的错误类型体系；Python 版用 `McpToolErrorCode` 枚举 + 简单错误字符串 |
| 重试机制 | `fallbackQueue` 异步重试队列 | 无 | TS 版 `DataBridge` 内置失败重试队列 (`FallbackQueue`)；Python 版无重试机制 |
| 缓存层 | `MemoryCache` (LRU 缓存) | 无 | TS 版 `DataBridge` 内建内存缓存；Python 版 `DataBridge` 直接读写字典，无缓存层 |

---

## 四、功能完整性

| 差异维度 | TypeScript 原版 | Python 实现 | 差异说明 |
|---------|----------------|------------|---------|
| 数据标准化 | `MarketDataAdapter` 统一适配层 | 无 | TS 版有专门的标准化层将不同来源的原始数据映射为统一接口；Python 版直接透传 MCP 返回数据 |
| SSE/轮询 | `DataFlowEngine` 双模式推送 | `subscribe` 回调 | TS 版 `DataFlowEngine` 管理 12 个独立通道，支持 SSE 和轮询；Python 版仅支持内存回调通知 |
| KIMI AI 增强 | 真实 KIMI API 调用 | `_mock_kimi_enhance()` 模拟 | TS 版调用真实 KIMI API 进行新闻摘要和研报解读；Python 版返回固定模板文本 |
| 采集进度 | `COLLECTION_EVENTS` 6 级事件 | `PipelineEvent` 5 级事件 | TS 版有更细粒度的进度事件（含百分比、ETA）；Python 版简化了事件分级 |
| 熔断器 | 集成到 `adaptiveSourceOrchestrator`，与 `multiSourceFetcher` 自动联动 | 独立模块，需手动调用 `get_available_sources()` | TS 版熔断器在 fetch 函数内部自动生效；Python 版需显式过滤 |
| 降级链 | 6 条降级链，每条 2-4 级 | 相同链配置 | 降级链逻辑完全一致，但 TS 版有更多真实数据源实现 |
| 14维度 MCP 映射 | 18 个 Tool 调用，含 `get_esg_data`、`get_risk_indicators` | 同 18 个 Tool | 维度映射完全一致，Python 版额外添加了 Dim 04 的 `get_risk_indicators` 子查询 |
| Excel 导出 | 无 (Pipeline 不负责导出) | 无 | 采集管线不负责导出，属于上层消费逻辑 |

---

## 五、设计模式差异

| 差异维度 | TypeScript 原版 | Python 实现 | 差异说明 |
|---------|----------------|------------|---------|
| 单例模式 | 模块级 `export const` 单例 | 构造函数创建新实例 | TS 版 `dataBridge`、`eventBus` 等是模块级单例；Python 版每次 `DataBridge()` 创建新实例 |
| 观察者模式 | `eventBus` + `subscribe` 全局事件总线 | 回调函数 `on_event` 参数传递 | Python 版 `DataBridge.subscribe()` 是简化版，仅支持 Store 级订阅，不支持通配符 |
| 策略模式 | `DIMENSION_TO_MODE` 映射 + `resolveDimensionMode()` 路由 | `DIMENSION_TO_MODE` 字典 + `_trace_*` 方法路由 | 路由逻辑完全一致，TS 版用 `switch` 语句，Python 版用 `if/elif` |
| 装饰器模式 | React HOC (`ErrorBoundary`, `memo`) | Python 装饰器 `@with_circuit_breaker` | Python 版额外提供了熔断器装饰器，TS 版无等效语法糖 |
| 工厂模式 | `EnvelopeFactory` 创建标准信封 | `Envelope` dataclass 直接构造 | TS 版用工厂方法保证信封格式一致性；Python 版用 `__post_init__` 自动生成 `envelope_id` |

---

## 六、Python 实现独有的增强

| 增强项 | 说明 |
|-------|------|
| `McpSubQuery` dataclass | 将 TS 版散落在 `mcpCollector.ts` 中的子查询逻辑形式化为 `(name, serverName, toolName, buildArgs, parseResponse)` 五元组，使维度映射配置更结构化 |
| 自然语言查询函数族 | 将 18 个 Tool 的查询参数封装为 `_nl_query_*` 命名函数，替代 TS 版的模板字符串拼接，便于测试和复用 |
| `collect_dimension()` 便捷函数 | 一行代码完成单维度 MCP 采集，降低使用门槛 |
| `quick_collect()` 便捷函数 | 一行代码完成全部 14 个 MCP 维度的批量采集 |
| `main.py` 8 个分层示例 | 从底层 `run_mcp()` 到完整流水线，逐层演示，方便学习和调试 |
| 熔断器装饰器 `@with_circuit_breaker` | 让任意异步函数获得熔断保护，无需手动管理熔断器状态 |
| `McpClient.stats` 统计属性 | 内置调用统计（成功率、平均延迟），便于性能监控 |

---

## 七、Python 实现精简/省略的部分

| 省略项 | 原因 |
|-------|------|
| IndexedDB 持久化 | 示例代码，内存字典足够演示；生产环境可替换为 `sqlite3` 或 `aiofiles` |
| 真实 MCP JSON-RPC 通信 | 需要 iFinD API Key 和 MCP 运行时环境，示例用 Mock 数据替代 |
| `DataFlowEngine` 双模式推送 | 独立进程无 SSE/轮询需求，用回调 + `asyncio.Queue` 即可替代 |
| `fallbackQueue` 重试队列 | 简化示例，生产环境可用 `tenacity` 库实现 |
| `MemoryCache` LRU 缓存 | 简化示例，生产环境可用 `cachetools` 或 Redis |
| 结构化日志 (`getLogger`) | 示例代码，生产环境可用 `structlog` 或 `loguru` |
| 文件夹监控/热重载 | 浏览器开发特性，Python 独立脚本不需要 |
| `KimiAIService` 真实调用 | 需要 KIMI API Key，示例用固定模板文本替代 |
| React 组件层 (`ChipStrategyReviewPage` 等) | 纯后端采集管线，不涉及前端渲染 |

---

## 八、文件对应关系

| Python 文件 | TypeScript 文件 | 行数比 (Py:TS) | 功能覆盖度 |
|------------|----------------|---------------|-----------|
| `dimension_mapping.py` | `collectConfig.ts` + `dimensionDataTypes.ts` + `collection.types.ts` (部分) | ~300:600 | 90% — 完整映射配置，省略了部分类型定义的细粒度字段 |
| `mcp_client.py` | `run_mcp()` 工具调用 (Trae MCP 运行时) | ~200:N/A | 80% — 模拟了 MCP 协议，但真实通信需替换 |
| `mcp_collector.py` | `mcpCollector.ts` | ~200:250 | 95% — 核心逻辑完整，缺少 `parseResponse` 自定义解析器 |
| `multi_source_fetcher.py` | `multiSourceFetcher.ts` + `westockMcpSource.ts` + `tencentNewsMcpSource.ts` | ~200:450 | 70% — 降级链逻辑完整，但真实数据源实现用 Mock 替代 |
| `adaptive_source_orchestrator.py` | `adaptiveSourceOrchestrator.ts` | ~130:150 | 95% — 熔断器三态逻辑完整，额外增加了装饰器 |
| `data_bridge.py` | `databridge.ts` + `databridgeAcl.ts` + `fallbackQueue.ts` + `envelope.ts` | ~250:1200 | 50% — 核心 ACL + 审计逻辑完整，省略了缓存、重试、策略路由 |
| `collection_pipeline.py` | `collectionPipeline.ts` | ~250:500 | 85% — 维度路由 + 批量采集 + KIMI 增强完整，省略了真实数据源编排 |
| `main.py` | 无直接对应 (测试/示例) | ~350:N/A | N/A — Python 独有的演示入口 |

---

> **总结**：Python 实现是 TS 原版的**架构参考实现**，完整保留了维度映射、MCP 适配、降级链、熔断器、ACL 权限、采集流水线 6 层核心架构，省略了浏览器特有的 IndexedDB、SSE 推送、React 状态管理等前端特性，以及需要外部 API Key 的真实数据源调用。8 个文件共 ~1,800 行，覆盖 TS 原版 ~3,500 行核心逻辑的约 80% 功能。