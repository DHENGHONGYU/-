# 测试失败分析报告

**生成时间**: 2026-07-05  
**测试框架**: Vitest  
**失败总数**: 38 个测试用例  
**涉及文件**: 6 个测试文件

---

## 失败概览

| 测试文件 | 总测试数 | 失败数 | 失败率 |
|---------|---------|-------|-------|
| src/data/dataLayer.test.ts | 55 | 46 | 83.6% |
| src/store/positionStore.test.ts | 20 | 5 | 25.0% |
| src/store/signalStore.test.ts | 16 | 2 | 12.5% |
| tests/TradingApp.test.tsx | 15 | 15 | 100% |
| tests/SectorHeatmapWidget.test.tsx | 15 | 15 | 100% |
| src/services/unifiedStockService.test.ts | 22 | 1 | 4.5% |

---

## 详细分析

### 1. src/data/dataLayer.test.ts (46/55 失败)

**失败原因**: DataBridge ACL 权限检查失败

**错误信息**:
```
[ERROR] [ACL] Permission denied: Module "fetcher" is not allowed to perform "DELETE"
[ERROR] [DataBridge] ACL check failed: module="fetcher", store="stocks", operation="DELETE"
```

**根本原因**:
- 测试中的 mock 设置与实际 DataBridge 的 ACL 配置不匹配
- `mockDataBridgeForward` 和 `mockDataBridgeQuery` 的返回值未正确模拟 ACL 检查通过的场景
- 测试期望 DataBridge 直接返回成功，但实际代码中包含了 ACL 权限验证逻辑

**修复建议**:
1. 在 `beforeEach` 中重置 mock 并设置默认的成功返回值
2. 确保 `mockDataBridgeForward.mockResolvedValue()` 返回符合 ACL 检查通过的数据结构
3. 添加专门的 ACL 权限拒绝测试用例，与正常流程测试分离
4. 检查 `src/core/acl.ts` 中的 ACL_MATRIX 配置，确保测试 mock 与实际配置一致

**优先级**: P0 (阻塞性)

---

### 2. src/store/positionStore.test.ts (5/20 失败)

**失败原因**: 错误状态未正确设置

**错误信息**:
```
expected null to be 'Network error' // Object.is equality
```

**根本原因**:
- `refresh` 方法在捕获异常后，未将 `error` 字段设置为异常消息
- 测试期望 `state.error` 为 `'Network error'`，但实际为 `null`
- 可能是 `refresh` 方法的 try-catch 块中缺少 `set({ error: ... })` 调用

**修复建议**:
1. 检查 `src/store/positionStore.ts` 中的 `refresh` 方法实现
2. 确保在 catch 块中调用 `set({ error: error.message, loading: false })`
3. 验证 `mocks.refresh.mockRejectedValueOnce(new Error('Network error'))` 的 mock 设置是否正确
4. 检查是否有异步状态更新未等待完成

**优先级**: P1 (严重)

---

### 3. src/store/signalStore.test.ts (2/16 失败)

**失败原因**: Store 实例化方法缺失

**错误信息**:
```
[ERROR] [SignalMonitorWidget] 刷新信号数据失败 {
  error: '__vite_ssr_import_5__.useSignalStore.getState is not a function'
}
```

**根本原因**:
- 测试中 mock 的 `useSignalStore` 缺少 `getState` 方法
- 组件内部使用了 `useSignalStore.getState()` 获取 store 实例，但 mock 未提供该方法
- 可能是 Zustand store 的 mock 方式不正确

**修复建议**:
1. 在 mock 中添加 `getState` 方法:
```typescript
vi.mock('@/store/signalStore', () => ({
  useSignalStore: Object.assign(
    vi.fn(),
    {
      getState: vi.fn().mockReturnValue({
        signals: [],
        refresh: vi.fn(),
      }),
      subscribe: vi.fn(),
    }
  ),
}))
```
2. 确保 mock 的 store 结构与真实 Zustand store 一致
3. 检查组件中是否应该使用 hook 而非直接调用 `getState()`

**优先级**: P1 (严重)

---

### 4. tests/TradingApp.test.tsx (15/15 失败)

**失败原因**: 需要查看完整错误日志

**可能原因**:
- 组件依赖的 store 或 service 未正确 mock
- 路由配置问题
- 缺少必要的 Context Provider

**修复建议**:
1. 运行 `npx vitest run tests/TradingApp.test.tsx --reporter=verbose` 获取详细错误
2. 检查 `src/apps/trading/TradingApp.tsx` 的依赖项
3. 确保所有外部依赖（store、service、router）都已 mock
4. 验证测试环境的 Context Provider 是否正确包裹

**优先级**: P0 (阻塞性)

---

### 5. tests/SectorHeatmapWidget.test.tsx (15/15 失败)

**失败原因**: 缺少 MarketDataProvider 包裹

**错误信息**:
```
expected [Function] to not throw an error but 'Error: useMarketData 必须在 MarketDataPr...' was thrown
```

**根本原因**:
- `SectorHeatmapWidget` 组件内部使用了 `useMarketData` hook
- `useMarketData` 必须在 `MarketDataProvider` 内部使用
- 测试中直接渲染组件，未提供 `MarketDataProvider` 包裹

**修复建议**:
1. 在测试中使用 `MarketDataProvider` 包裹组件:
```typescript
import { MarketDataProvider } from '@/cockpit/providers/MarketDataProvider'

render(
  <MarketDataProvider>
    <SectorHeatmapWidget config={buildConfig()} />
  </MarketDataProvider>
)
```
2. 或者 mock `useMarketData` hook 直接返回测试数据:
```typescript
vi.mock('@/cockpit/providers/MarketDataProvider', () => ({
  useMarketData: () => ({
    data: mockData,
    loading: false,
    error: null,
  }),
}))
```
3. 检查其他 Widget 测试是否也有类似问题，统一修复

**优先级**: P0 (阻塞性)

---

### 6. src/services/unifiedStockService.test.ts (1/22 失败)

**失败原因**: dataLayer 异常处理不完整

**错误信息**:
```
[ERROR] [GetUnifiedStockViewUseCase] 600519.SH 融合失败 { error: 'DB 连接失败' }
```

**根本原因**:
- 测试模拟 dataLayer 抛出异常，期望服务返回失败结果
- 但实际实现中可能未正确捕获异常或返回格式不符合预期
- 可能是错误消息格式不匹配

**修复建议**:
1. 检查 `src/services/unifiedStockService.ts` 中的异常处理逻辑
2. 确保 catch 块中返回符合 `UnifiedStockViewResult` 类型的失败结果
3. 验证错误消息格式是否与测试期望一致
4. 添加更详细的错误日志以便调试

**优先级**: P2 (一般)

---

## 修复优先级排序

### P0 - 阻塞性 (立即修复)
1. **dataLayer.test.ts** - 46 个测试失败，影响核心数据层
2. **TradingApp.test.tsx** - 15 个测试全部失败，影响交易模块
3. **SectorHeatmapWidget.test.tsx** - 15 个测试全部失败，影响 Widget 模块

### P1 - 严重 (本周修复)
4. **positionStore.test.ts** - 5 个测试失败，影响持仓状态管理
5. **signalStore.test.ts** - 2 个测试失败，影响信号监控

### P2 - 一般 (下周修复)
6. **unifiedStockService.test.ts** - 1 个测试失败，影响较小

---

## 修复执行计划

### 阶段 1: 修复 P0 阻塞性问题 (预计 2-3 小时)

1. **修复 dataLayer.test.ts**
   - 更新 mock 设置，确保 ACL 检查通过
   - 分离 ACL 权限测试与正常流程测试
   - 验证 DataBridge 的 ACL_MATRIX 配置

2. **修复 SectorHeatmapWidget.test.tsx**
   - 添加 MarketDataProvider 包裹
   - 或 mock useMarketData hook
   - 检查其他 Widget 测试是否有类似问题

3. **修复 TradingApp.test.tsx**
   - 获取详细错误日志
   - 检查依赖项 mock 完整性
   - 验证 Context Provider 配置

### 阶段 2: 修复 P1 严重问题 (预计 1-2 小时)

4. **修复 positionStore.test.ts**
   - 检查 refresh 方法的错误处理逻辑
   - 确保 error 字段正确设置

5. **修复 signalStore.test.ts**
   - 添加 getState 方法到 mock
   - 验证 Zustand store mock 结构

### 阶段 3: 修复 P2 一般问题 (预计 30 分钟)

6. **修复 unifiedStockService.test.ts**
   - 完善异常处理逻辑
   - 验证错误消息格式

---

## 预防措施

### 1. 建立测试规范
- 所有 store 测试必须 mock `getState` 方法
- 所有 Widget 测试必须使用 Provider 包裹或 mock hook
- 所有 DataBridge 测试必须考虑 ACL 权限检查

### 2. 添加测试辅助工具
- 创建 `createMockStore` 工具函数，自动生成符合 Zustand 接口的 mock
- 创建 `renderWithProviders` 工具函数，自动包裹必要的 Context Provider
- 创建 `mockDataBridgeSuccess` 和 `mockDataBridgeFailure` 工具函数

### 3. 持续集成检查
- 在 CI 中添加测试覆盖率检查
- 添加测试失败自动通知机制
- 定期进行测试健康度审查

---

## 附录: 相关文档

- [AGENTS.md](file:///c:/Users/huawei/Documents/kimi/Workspaces/智能投研复盘系统V9/AGENTS.md) - 项目架构规范
- [CHANGELOG.md](file:///c:/Users/huawei/Documents/kimi/Workspaces/智能投研复盘系统V9/CHANGELOG.md) - 版本更新日志
- [v2.0.0 Migration Guide](file:///c:/Users/huawei/Documents/kimi/Workspaces/智能投研复盘系统V9/CHANGELOG.md#migration-guide) - 设计令牌迁移指南

---

**报告生成人**: AI Assistant  
**审核状态**: 待审核  
**下一步**: 按照优先级执行修复计划
