# 智能投研复盘系统 V9

> 面向中国 A 股个人投资者的研究决策与复盘工具
> 纯前端 PWA，数据本地主权，离线可用。

## 技术栈

- React 19 + TypeScript + Vite
- Tailwind CSS + shadcn/ui 风格组件
- Zustand（状态管理）
- React Router 7（HashRouter）
- IndexedDB（原生 API，本地数据主权）
- Recharts / lightweight-charts（图表）
- Electron + Python（AkShare / Tushare 数据采集，可选）

## 架构

五层分层架构，跨模块写操作统一走 `DataBridge.forward(StandardEnvelope)`：

```
L5 展示层：pages/, components/, portal/, cockpit/
L4 应用层：apps/（输入/分析/交易/输出/总控五舱）
L3 引擎层：services/, agents/
L2 数据层：data/, db/
L1 基础设施层：lib/, config/, core/
```

五舱工作流：**输入 → 分析 → 交易 → 输出 → 总控**。

核心原则：

- 纯前端，数据本地 IndexedDB 存储
- 所有跨模块写操作走 `DataBridge.forward(StandardEnvelope)`
- 股票池采用单表多状态：candidate / screened / deepDive / watching / archived
- 数据优先于界面；离线可用；配置驱动；测试先行；架构诚实

## 快速启动

```bash
npm ci          # 强制使用 npm ci，禁止 npm install（锁定依赖版本）
npm run dev
```

> **新环境提示**：若功能窗口（帮助文档、AI 面板）无法打开，请按序检查 IDE 扩展安装、工作区信任、浏览器弹窗拦截，详见 `.agents/skills/feature-window-context-doc/SKILL.md`。

## 常用命令

```bash
npm run lint      # ESLint
npm run test      # 单元测试
npm run build     # 生产构建
npm run preview   # 预览生产构建
npm run test:e2e  # Playwright E2E
npm run audit     # 聚合审计（分层/硬编码/文档/路由/MCP/令牌等）
npm run gate:dev  # 提交前质量门禁
```

## 数据采集

- **真实数据源**：AKShare / Tushare Pro / 腾讯行情 / 新浪行情
- **运行方式**：`VITE_DATA_SOURCE_TYPE=real` 需要启动 Python AkShare 服务：
  `uvicorn collect_endpoints:app --host 0.0.0.0 --port 8000 --reload`
- **上线前测试**：要求真实数据测试，禁止 MOCK 假数据

## 已实现功能

- 五舱导航框架（PortalShell）+ 驾驶舱 Dashboard（CockpitShell）
- IndexedDB 数据层 + DataBridge 信封化 + ACL 权限矩阵
- 输入舱：股票录入、搜索一键录入、批量导入、热门板块、候选池看板/列表、批量归档/流转、数据质量筛选
- 分析舱：V6 九维评分、V4 行业智能评分、V6 个股智能评分、筛选引擎（candidate→screened→deepDive）
- 交易舱：模拟买入/卖出、持仓订单、信号扫描与持久化
- 输出舱：数据导出、报告生成
- 总控舱：系统统计、数据重置、V6 Pro → V9 JSON 数据迁移
- 图表：K 线 + 均线 + OHLCV 浮层 + MACD/KDJ 指标副图（红涨绿跌 A 股配色）
- 数据采集：AKShare / Tushare 多源采集、熔断器、CSV 注入防护
- 数据迁移：V6 Pro → V9 JSON 全量迁移
- 单元测试 + Playwright E2E + 视觉回归

## 文档

文档中心入口：[docs/README.md](docs/README.md)

- 架构与设计：`docs/explanation/`
- 使用指南：`docs/guides/`
- 元数据与治理：`docs/meta/`
- 参考与契约：`docs/reference/`
- 版本更新：[CHANGELOG.md](CHANGELOG.md)

## 状态

- `tsc --noEmit`：通过
- `npm run lint`：通过
- `npm run test`：通过
- `npm run build`：通过
