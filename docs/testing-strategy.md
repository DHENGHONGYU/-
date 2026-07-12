# V9 三层测试策略

> 版本：v1.0.0 | 日期：2026-07-10
> 适用范围：V9 智能投研复盘系统所有新增模块

## 1. 测试分层

| 层级 | 范围 | 工具 | 目标 | 门禁位置 |
|------|------|------|------|----------|
| 单元测试 | 函数、Store、Service、工具类 | Vitest + jsdom | 覆盖率 ≥ 70%，核心模块 ≥ 85% | pre-commit / CI |
| 集成测试 | 跨模块调用、DataBridge、EventBus、Widget 注册 | Vitest + fake-indexeddb | 验证模块间契约与边界场景 | CI |
| E2E 测试 | 关键用户路径、路由、驾驶舱渲染 | Playwright | 覆盖核心流程，视觉回归可选 | 发布前 |

## 2. 关键边界场景清单

### 2.1 Widget 注册三处同步
新增 Widget 时必须同步：
1. `src/cockpit/core/widgetRegistry.ts` 注册模板
2. `src/constants/cockpit.constants.ts` 的 `DEFAULT_WIDGET_CONFIG` 注册默认配置
3. 同文件的 `WIDGET_DEFAULT_DATA_SOURCE` 注册数据源

集成测试应断言：所有注册在 `widgetRegistry` 中的 widgetId，均在后两者中存在对应配置。

### 2.2 DataBridge 转发
- 未知 action 应抛出 `EnvelopeError`
- Query 路径必须携带 `payload.store`
- 写操作成功后应触发缓存失效与审计日志
- 跨模块 ACL 校验失败应返回 `success: false`

### 2.3 Store 跨 Tab 广播
- `withBroadcast` 在写操作后应触发 `eventBus.emit`
- 广播失败不应阻塞写操作
- 多个 Store 订阅同一事件时，清理函数应正确移除监听

## 3. 新增模块测试义务

新增模块按「类型→Store→Service→UI」四步集成时，每步必须：
1. 类型：添加 `tests/__tests__/types/` 下的类型断言（复杂泛型）
2. Store：覆盖状态变化、选择器、异步 action、错误分支
3. Service：覆盖成功/失败/重试/边界输入
4. UI：覆盖渲染、交互、空状态、错误状态、事件监听清理

## 4. 测试命名与目录约定

- 单元测试：`src/xxx/ModuleName.test.ts` 或 `__tests__/ModuleName.test.ts`
- 集成测试：`tests/integration/xxx.integration.test.ts`
- E2E 测试：`e2e/xxx.spec.ts`
- 类型测试：`tests/__tests__/types/xxx.spec.ts`

## 5. 运行命令

```bash
# 全量单元测试
npm run test

# 仅运行与本次改动相关的测试（lint-staged 使用）
npm run test:staged

# 集成测试
npm run test -- tests/integration

# E2E
npm run test:e2e

# 覆盖率
npm run test:ci
```

## 6. 失败处理原则

- 单元测试失败直接阻断本地提交（Husky pre-commit）
- 集成测试失败阻断 PR 合并
- E2E 失败阻断发布，但允许在紧急修复中跳过并记录

## 7. 改进路线

- 短期：补齐 DataBridge、withBroadcast、Widget 注册三处同步测试
- 中期：引入集成测试套件，覆盖采集→存储→UI 反馈链路
- 长期：建立视觉回归基线，覆盖驾驶舱与股票池看板
