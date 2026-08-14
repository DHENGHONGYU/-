# FinSight V9 - 智能投研复盘系统

> 面向中国 A 股个人投资者的研究决策与复盘工具  
> 纯前端 PWA，数据本地主权，离线可用  
> **当前版本**：2.0.0-rc.1 | **基准日期**：2026-08-15

## 项目简介

FinSight V9 是一款专为 A 股个人投资者设计的智能投研复盘系统，采用纯前端架构，数据完全存储在本地 IndexedDB，确保数据主权和隐私安全。系统提供从股票录入、智能分析、模拟交易到数据输出的完整投研工作流。

## 核心特性

### 五舱工作流
- **输入舱**：股票录入、批量导入、热门板块、候选池管理
- **分析舱**：V6 九维评分、行业智能评分、筛选引擎
- **交易舱**：模拟买卖、持仓管理、信号扫描
- **输出舱**：数据导出、报告生成
- **总控舱**：系统统计、数据管理、配置中心

### 技术亮点
- 🏗️ **五层分层架构**：展示层 → 应用层 → 引擎层 → 数据层 → 基础设施层
- 🔒 **数据主权**：IndexedDB 本地存储，离线可用
- 📊 **专业图表**：K 线 + 均线 + MACD/KDJ 指标（A 股配色）
- 🔄 **DataBridge 信封协议**：跨模块写操作统一规范
- 🎨 **V5 Apple Business Design Tokens**：单一真相源令牌系统，内置运行时验证 Utility（开发环境自动校验令牌加载、主题切换后自动重验证）
- 🧪 **质量保障**：单元测试 + E2E 测试 + 视觉回归 + 自动化审计

## 技术栈

| 类别 | 技术选型 |
|------|---------|
| 前端框架 | React 19 + TypeScript + Vite |
| UI 组件 | Tailwind CSS + shadcn/ui 风格组件 |
| 状态管理 | Zustand |
| 路由 | React Router 7（HashRouter） |
| 数据存储 | IndexedDB（原生 API） |
| 图表库 | Recharts + lightweight-charts |
| 桌面端 | Electron（可选） |
| 数据采集 | Python AkShare / Tushare（可选） |

## 快速启动

```bash
# 1. 安装依赖（强制使用 npm ci 锁定版本）
npm ci

# 2. 启动开发服务器
npm run dev

# 3. 生产构建
npm run build
```

> **环境提示**：若功能窗口（帮助文档、AI 面板）无法打开，请检查 IDE 扩展安装、工作区信任、浏览器弹窗拦截设置。

## 常用命令

```bash
# 开发
npm run dev              # 启动开发服务器
npm run build            # 生产构建
npm run preview          # 预览生产构建

# 质量检查
npm run lint             # ESLint 代码检查
npm run test             # 单元测试
npm run test:e2e         # Playwright E2E 测试
npm run audit            # 聚合审计（分层/硬编码/文档/路由/MCP 等）
npm run gate:dev         # 提交前质量门禁

# 类型检查
npm run tsc:prod         # 生产代码类型检查
npm run tsc:test         # 测试代码类型检查
```

## 数据采集配置

### 真实数据源
系统支持多种数据源：
- **AKShare**：免费开源金融数据接口
- **Tushare Pro**：专业金融数据服务
- **腾讯行情 / 新浪行情**：实时行情数据

### 启动数据采集服务
```bash
# 设置环境变量
VITE_DATA_SOURCE_TYPE=real

# 启动 Python AkShare 服务
uvicorn collect_endpoints:app --host 0.0.0.0 --port 8000 --reload
```

> ⚠️ **重要**：上线前测试必须使用真实数据，禁止使用 Mock 数据。

## 架构设计

```
┌─────────────────────────────────────────┐
│  L5 展示层：pages/, components/         │
├─────────────────────────────────────────┤
│  L4 应用层：apps/（五舱）               │
├─────────────────────────────────────────┤
│  L3 引擎层：services/, agents/          │
├─────────────────────────────────────────┤
│  L2 数据层：data/, core/                │
├─────────────────────────────────────────┤
│  L1 基础设施层：lib/, config/           │
└─────────────────────────────────────────┘
```

**核心原则**：
- 所有跨模块写操作走 `DataBridge.forward(StandardEnvelope)`
- 股票池单表多状态：candidate → screened → deepDive → watching → archived
- 数据优先于界面；离线可用；配置驱动；测试先行

## 项目结构

```
FinSightV9/
├── src/
│   ├── apps/           # 五舱应用（输入/分析/交易/输出/总控）
│   ├── components/     # UI 组件库
│   ├── pages/          # 页面组件
│   ├── services/       # 业务服务层
│   ├── store/          # Zustand 状态管理
│   ├── core/           # 核心基础设施
│   ├── data/           # 数据层（IndexedDB）
│   ├── lib/            # 工具库
│   └── config/         # 配置文件
├── tests/              # 测试文件
├── docs/               # 文档中心
├── scripts/            # 构建和审计脚本
└── electron/           # Electron 桌面端（可选）
```

## 文档中心

- 📖 [文档首页](docs/README.md)
- 🏗️ [架构设计](docs/explanation/)
- 📚 [使用指南](docs/guides/)
  - [Design→Code 工作流规范](docs/guides/design-to-code-workflow.md) — 令牌系统 + 6 项门禁
  - [团队手册 · 设计哲学](docs/guides/team-handbook/01-design-philosophy.md) — 令牌体系与设计决策
- 🔧 [开发规范](docs/meta/)
- 📋 [API 契约](docs/reference/)
- 📝 [更新日志](CHANGELOG.md)
- 📦 [发布说明](docs/release-notes/RELEASE-NOTES-design-token-cleanup.md) — 设计令牌清理与 Utility 重构

## 开发规范

### 提交规范
- 使用 Conventional Commits 格式：`type(scope): description`
- 作用域白名单：core | services | store | hooks | components | pages | config | docs | tests
- 禁止使用中文冒号，必须使用英文冒号 `:`

### 代码质量
- 禁止硬编码用户路径（使用 `%USERPROFILE%` 或 `os.homedir()`）
- 禁止在 `.env` 中存储 API 密钥（使用 UI 配置页面）
- Console.log 必须替换为 logger.debug
- 禁止 Mock 数据注入生产组件

### Git 规范
- 禁止 `git add -A`（避免误提交）
- 提交前验证暂存文件数量
- Pre-commit hooks 自动检查代码质量
- 禁止提交临时产物文件

## 系统状态

| 检查项 | 状态 |
|--------|------|
| TypeScript 类型检查 | ✅ 通过 |
| ESLint 代码检查 | ✅ 通过 |
| 单元测试 | ✅ 通过 |
| 生产构建 | ✅ 通过 |

## 许可证

本项目仅供学习和研究使用。

---

**最后更新**：2026-08-15 | **版本**：2.0.0-rc.1 | **Git 基准**：初始化提交
