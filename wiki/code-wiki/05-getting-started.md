---
title: 05 - 项目运行方式
type: reference
domain: architecture
status: frozen
version: 2.0.1
last_updated: 2026-08-22
code_version: "2.0.0-rc.2"
tag: FINAL
change_log:
  - version: 2.0.1
    changes: "基准日校对(2026-08-22)：R1取真值(P4 frontmatter.version 裸值=2.0.0) → R2 PATCH++(2.0.1) / last_updated 刷新 / change_log 闭环"
    date: 2026-08-22
---

# 05 - 项目运行方式 🏁

> 文档体系版本: **v2.0.0 · FINAL** | 本文档修订: rev.3（最终版 · 两轮交叉核对 · 修正 VITE_AKSHARE_BASE_URL 双场景/audit=22项/gate:dev=8条 等 5 项）| 基于 package.json 2.0.0-rc.2 + vite.config.ts 实际配置编写

## 1. 环境要求

| 依赖 | 要求 |
|------|------|
| Node.js | 按 `.nvmrc` 版本（配套 lockfile，**强制 `npm ci` 安装**） |
| 包管理 | npm（禁用 yarn/pnpm） |
| Python | 3.x + venv（仅真实数据采集需要；受管 venv 路径固化于 package.json 脚本） |
| 操作系统 | Windows 主力开发环境（含 PowerShell 专属脚本）；macOS/Linux 可运行核心流程 |

## 2. 快速启动（浏览器形态）

```bash
# 1. 安装依赖（锁定版本）
npm ci

# 2. 启动开发服务器（端口 5199，predev 自动跑 tsc:prod 类型检查）
npm run dev
# → http://localhost:5199

# 3. 生产构建（prebuild 自动类型检查）
npm run build

# 4. 预览生产构建
npm run preview
```

### 2.1 环境变量配置

复制 `.env.example` 为 `.env`（参考 `.env.local.example`）：

```bash
VITE_DATA_SOURCE_TYPE=mock        # mock | rest | websocket（真实数据切 real/rest）
VITE_API_BASE_URL=/api            # REST 基础地址
VITE_WS_URL=ws://localhost:8080/ws
VITE_LLM_BASE_URL=https://api.deepseek.com
VITE_LLM_MODEL=deepseek-chat
# 按运行形态选择：浏览器 PWA 模式须设为 /api/akshare（走 Vite 代理避免 CORS）
# Electron 侧车模式可直连 http://localhost:8000（主进程内无 CORS 限制）
VITE_AKSHARE_BASE_URL=http://localhost:8000
VITE_LOG_LEVEL=info               # debug | info | warn | error
```

**安全红线**：LLM/Tushare/Qwen API Key 禁止写入 `.env`（VITE_ 前缀会暴露进前端 bundle），必须在应用内 UI 配置页填写，经 AES-GCM 加密存 localStorage。

### 2.2 Vite 代理（vite.config.ts）

开发服务器自动代理以下路径（解决 CORS 与编码问题）：

| 路径 | 目标 | 说明 |
|------|------|------|
| `/api/collect`、`/api/akshare` | 127.0.0.1:8000 | Python 采集服务 |
| `/api/embed` | 127.0.0.1:8001 | Embedding 服务 |
| `/health` | 127.0.0.1:8000 | 健康检查 |
| 腾讯行情/K线 | qt.gtimg.cn | GBK→UTF-8 + gzip/br 解压 + 自定义 kline 代理插件 |
| 新浪行情 | hq.sinajs.cn | GBK→UTF-8 |

## 3. 真实数据模式（Python 侧车）

```bash
# 1. 设置环境变量
# .env 中 VITE_DATA_SOURCE_TYPE=real

# 2. 启动 Python AKShare 采集服务
uvicorn collect_endpoints:app --host 0.0.0.0 --port 8000 --reload

# 或使用统一侧车入口（同时启动 3 个服务）
python backend/sidecar_entry.py
#   Collector   :8000（FastAPI 数据采集）
#   Embedding   :8001（本地向量化）
#   Daemon      :8765（守护）
```

> ⚠️ **上线前测试禁止 MOCK，必须使用真实数据**（项目硬约束）。Mock 残留检测：`npm run audit:mock-modules`。

## 4. 桌面端形态（Electron）

```bash
# 开发模式（编译 electron 主进程 + 拉起 dev server + 启动侧车）
npm run electron:dev
# 内部：tsc -p electron/tsconfig.json → dist-electron/main.js
#       VITE_DEV_SERVER_URL=http://localhost:3000 指向 dev server
#       V9_PYTHON_EXE=.venv\Scripts\python.exe 指定 Python

# 打包侧车（PyInstaller）
npm run sidecar:build

# 完整安装包（NSIS，输出 release/）
npm run electron:build
```

## 5. 质量检查与测试命令

### 5.1 日常开发

| 命令 | 用途 |
|------|------|
| `npm run lint` | ESLint（--max-warnings 2000） |
| `npm run lint:colors` | 颜色令牌专项检查 |
| `npm run tsc:prod` | 生产代码类型检查（tsconfig.prod.json，仅源码不含测试） |
| `npm run tsc:test` | 测试代码类型检查 |
| `npm run test` | Vitest 全量单元测试 |
| `npm run test:watch` | 监听模式 |
| `npm run gate:dev` | 提交前完整门禁（lint-staged + tsc:prod + 6 项审计 = 共 8 条命令串行） |
| `npm run gate:quick` | 快速门禁（8 项审计） |

### 5.2 测试矩阵

| 命令 | 范围 |
|------|------|
| `npm run test:unit` | 单元测试（排除组件测试） |
| `npm run test:component` | 组件测试 |
| `npm run test:store` / `test:service` | Store / Service 专项 |
| `npm run test:p0:core` | P0 核心链路（cascadeExecutor / databridgeAdapter / acl） |
| `npm run test:databridge:gate` | DataBridge 门禁（dataflow + bootstrap + acl） |
| `npm run test:e2e` | Playwright E2E（前置自动 build） |
| `npm run test:e2e:visual` | 视觉回归（`:update` 更新快照，Docker 版本可用） |
| `npm run test:rag-all` | RAG 全链路（幻觉回归/真实 LLM/E2E/性能） |
| `npm run test:e2e-verify` | 25 股票端到端验证 + 冗余校验 + V6 评分区分度 |
| `npm run coverage` | 覆盖率报告 |

### 5.3 审计体系（40+ 脚本）

```bash
npm run audit            # 聚合审计（22 项串行：audit:layers/directory/hardcode/deadcode/
                         #   docs/doc-integrity/routes/mcp/token/tests/reserved-stores/
                         #   tokens/verify:colorSoT/mapping-integrity/execution-paths/
                         #   split-quality/typography/db-references/acl-consistency/
                         #   mock-modules/widget-registry/complexity-scan）

# 高频单项
npm run audit:layers              # 分层依赖违规（期望 0）
npm run audit:acl-consistency     # ACL 矩阵与 ACTION_TO_STORE_MAP 一致性
npm run audit:db-references       # STORE_NAME ↔ Schema ↔ Envelope 映射一致性
npm run audit:hardcode            # 硬编码扫描
npm run audit:deadcode            # 死代码（-- --staged 只查暂存区）
npm run audit:docs                # 文档同步
npm run audit:mock-modules        # Mock 残留
npm run audit:secrets             # 密钥泄露
```

### 5.4 Git 提交卫生（硬约束）

- **禁止 `git add -A`**（防误提交临时产物/密钥）
- 提交前必须核对 staged 文件数与目标一致
- 关键提交使用 `git commit --only <paths>` 物理防夹带
- **禁止 `--no-verify` 跳过钩子**（除非用户明确要求）
- Conventional Commits 格式：`type(scope): description`（英文冒号；scope 白名单：core/services/store/hooks/components/pages/config/docs/tests）

## 6. 常用工程脚本

| 命令 | 用途 |
|------|------|
| `npm run build:stock-dict` | 生成股票字典（受管 venv Python） |
| `npm run build:sw-industry` | 生成申万行业映射 |
| `npm run review:weekly` | 周度/月度复盘报告生成 |
| `npm run archive:run` | outputs 归档 |
| `npm run clean:temp` | 临时文件清理 |
| `npm run system:health` | 系统健康仪表盘 |
| `npm run generate:storeGraph` | Store 依赖图生成 |
| `npm run skill:route` | 技能路由查询 |
| `npm run skill:mirror` | L1 技能镜像同步（.agents → .workbuddy） |

## 7. 故障排查速查

| 症状 | 排查方向 |
|------|---------|
| 真实行情无数据 | Python 侧车是否启动（:8000/:8001）；Vite 代理目标须为 `127.0.0.1` |
| K 线返回 `v_pv_none_match` | 腾讯代理逗号编码问题（已内置 tencent-kline-proxy 插件，检查代理是否生效） |
| 中文乱码 | GBK 编码链路（代理 TextDecoder('gbk')） |
| tsc:prod 报错但错误全在 `*.test.ts` | tsconfig 作用域问题（参见 v9-tsc-gate-scope-audit 技能） |
| 按钮无响应/假绿灯 | 数据流完整性（参见 v9-data-flow-integrity-audit 技能：六阶段排查） |
| 功能窗口/帮助文档打不开 | IDE 扩展、工作区信任、浏览器弹窗拦截 |
| 换机器路径失效 | Windows 用户目录绝对路径硬编码（v9-windows-env-path-doctor 技能） |

## 8. 上线前检查（摘要）

完整 24 步门禁见 SOP S05（docs/guides/sops/）。核心红线：

1. 24 步强制门禁全绿（`npm run audit` + tsc + build + 测试矩阵）
2. **真数测试**（25 股票 E2E，禁 MOCK）
3. staged 文件数核对 + `--only` 精确提交
4. 版本号经 `npm version`（SemVer）管理，CHANGELOG 自动 bump

---

## 🏁 修订记录摘要（v2.0.0 FINAL · 两轮共 24 项事实漂移）

**本文档涉及的 5 项修正：**

| # | 漂移项 | 旧值 | 新值（最终）| 核实真相源 |
|---|-------|------|-----------|----------|
| 1 | VITE_AKSHARE_BASE_URL 约束 | 强制"必须 /api/akshare 匹配 Vite 代理"（与实现冲突）| **双场景说明**：① 浏览器 PWA → 必须 `/api/akshare`（Vite 代理防 CORS）；② Electron 侧车 → 可直连 `http://localhost:8000`（无 CORS）。默认值与 `.env.example` / `fetcherConfig.ts` L92 对齐 | `.env.example` + `.env.local.example` + `fetcherConfig.ts` L92 + `vite.config.ts` L247 proxy.rewrite 四方核对 |
| 2 | `npm run audit` 聚合项数 | 21 项串行 | **22 项串行**（补 audit:complexity-scan 第 22 项）| `package.json` L145 audit 命令链逐 && 计数 |
| 3 | `gate:dev` 命令组成 | "lint-staged + tsc + 6 项审计"（模糊 + tsc 名错）| **共 8 条命令串行**：`lint-staged` → `tsc:prod`（非裸 tsc）→ audit:layers/atomic/db-references/store-coverage/acl-consistency/deadcode | 逐段解析 `package.json` L80 `gate:dev` 实际命令串 |
| 4 | audit:\* npm 脚本数 | 67（间接影响本附录引用）| **66**（与 README 对齐）| `package.json` 脚本前缀计数 |
| 5 | test:\* npm 脚本数 | 45（间接影响本附录引用）| **44**（与 README 对齐）| 同上 |

> 完整 24 项漂移清单、两轮轮次归属、验证方法声明 → 见 [README.md §修订记录](README.md#🏁-修订记录--24-项事实漂移全清单v200-final)
