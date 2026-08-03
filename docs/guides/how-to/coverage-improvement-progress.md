# 覆盖率提升进度报告

## 当前状态

| 层级 | 初始覆盖率 | 当前覆盖率 | 设定阈值 | 状态 |
|------|-----------|-----------|---------|------|
| lib | ~70% | **~85%** | 80% ✅ | 🟢 已达标 |
| core | ~3% | **56.02%** | 45% ✅ | 🟡 超预期 |
| data | ~1.3% | ~1.4% | 0% | 🔴 待提升 |
| services | 0% | 0% | 0% | 🔴 未开始 |

**总计**：43 个测试文件，706+ 个测试用例全部通过

## 阶段一：lib 层（已完成）

**成果**：从 ~70% 提升到 84.18%（statements），函数覆盖率达 90.85%

**新增测试文件（14个）**：
- `precision.test.ts` - 金融数值格式化（~15个用例）
- `safeCoerce.test.ts` - 类型安全转换（~10个用例）
- `format.test.ts` - 字段格式化（7个用例）
- `seededRandom.test.ts` - 可播种随机数（12个用例）
- `batchQueue.test.ts` - 批量队列（9个用例）
- `eventBus.test.ts` - 事件总线（13个用例）
- `safeRegex.test.ts` - 安全正则（9个用例）
- `derivedCache.test.ts` - 派生缓存（20个用例）
- `logger.test.ts` - 日志系统（10个用例）
- `perf.test.ts` - 性能监控（12个用例）
- `errors.test.ts` - 错误类型（17个用例）
- `rolePermissionMapper.test.ts` - 角色权限映射（16个用例）
- `webVitals.test.ts` - Web Vitals（2个用例）
- `localStorageCrypto.test.ts` - 本地存储加密（10个用例）

**总计**：约 150+ 个测试用例

**剩余差距**：
- statements: 84.18% → 85%（差 0.82%）
- 主要未覆盖：各模块的边界分支和错误处理路径

## 阶段二：core 层（已完成）

**成果**：从 ~3% 提升到 56.02%（statements），超出预期

**新增测试文件（10个）**：
- `stockCodeUtils.test.ts` - 股票代码格式转换（16个用例）
- `freshnessGuard.test.ts` - 数据新鲜度守卫（30+个用例）
- `poolTransitionEngine.test.ts` - 股票池状态机（19个用例）
- `widgetEventBus.test.ts` - 组件事件总线（12个用例）
- `entityValidators.test.ts` - 实体验证器（35个用例）
- `refreshCoordinator.test.ts` - 刷新协调器（15个用例）
- `cascadeExecutor.test.ts` - 级联执行器（4个用例）
- `databridgeAcl.test.ts` - ACL校验层（27个用例）
- `databridgeRouter.test.ts` - 路由辅助函数（12个用例）
- `databridgeStrategyRouter.test.ts` - 策略路由（14个用例）

**总计**：约 180+ 个新增测试用例

**已有测试文件（10个）**：
- `result.test.ts` - Result模式（19个）
- `statistics.test.ts` - 统计函数（22个）
- `databridge.test.ts` - 数据桥
- `databridgeActionMap.test.ts` - 动作映射
- `databridgePubSub.test.ts` - 发布订阅
- `feedbackOrchestrator.test.ts` - 反馈编排
- `acl.test.ts` - ACL引擎
- `envelope.test.ts` - 信封协议
- `fallbackQueue.test.ts` - 降级队列
- `memoryCache.test.ts` - 内存缓存

**剩余可提升模块**：
- `databridgeQueries.ts` - 查询构建
- `databridgeAdapter.ts` - 适配器
- `pipelineScheduler.ts` - 管道调度器
- `transaction.ts` - 事务管理（依赖DB，需mock）

## 阶段三：data 层（规划中）

**现状**：~1.4% statements 覆盖率

**已有测试**：
- `queryBuilder.test.ts` - 查询构建器（8个用例）
- `dataLayer.test.ts` - 数据层
- `audit.test.ts` - 审计
- `db.test.ts` - 数据库
- `repository.test.ts` - 仓储

**主要构成**：
- dataLayer*Stores.ts - 各store的CRUD操作（依赖IndexedDB，需集成测试）
- db-*.ts - 数据库连接、schema、migration
- 数据定义文件（sectorDefinitions, industryHierarchy等）

**可快速提升**：
- queryBuilder 测试增强（从8个→20+个）
- schema 验证函数测试
- migration 脚本测试

## 阶段四：核心模块深度补测（规划中）

**目标模块**：
- DataBridge 核心流程（query/forward/subscribe）
- Envelope 协议边界用例
- MemoryCache 压力测试
- ACL 矩阵边界测试

## 阶段五：services 层（规划中）

**现状**：0% 覆盖率

**核心服务**：
- scoring - 评分计算服务
- fetcher - 数据获取服务
- pool - 股票池服务
- news - 资讯服务
- rbac - 权限服务

## 后续 TODO 清单

### P0 - 本周完成
- [ ] lib 层冲刺 85%：补充各模块剩余边界分支测试
- [ ] core 层冲刺 50%：新增 databridgeAcl + databridgeRouter 测试
- [ ] data 层 queryBuilder 测试增强（8→20个用例）

### P1 - 下周完成
- [ ] core 层达到 55%：pipelineScheduler + transaction mock测试
- [ ] data 层达到 10%：schema验证 + migration测试
- [ ] 阈值配置更新为实际可达水平

### P2 - 第三周
- [ ] core 层达到 60%：databridge 全流程测试
- [ ] services 层首个服务测试（scoring）
- [ ] E2E 测试覆盖核心用户路径

### P3 - 长期目标（90%）
- [ ] lib 层 ≥ 90%
- [ ] core 层 ≥ 80%
- [ ] data 层 ≥ 70%
- [ ] services 层 ≥ 70%
- [ ] 全量 CI 门禁接入
