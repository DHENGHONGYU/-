# 运维与发布手册（Runbook）

> **定位**：定义 V9 的本地构建、预览、健康监控与常见故障处置，补 H 类运维缺口（P2-6）。
> **状态**：✅ P2 新增（骨架版）

---

## 1. 本地开发

```bash
npm install            # 安装依赖（node 22+）
npm run dev            # 启动 Vite 开发服务器
npm run build          # 生产构建
npm run preview        # 预览构建产物
```

## 2. 质量门禁（提交/推送）

- pre-commit：`lint-staged → lint:colors → tsc:prod → audit:layers → audit:atomic → audit:docs → verify:tokens → audit:tokens → audit:jsdoc → audit:complexity`
- pre-push：`test:clean → build`

> 任一门禁失败即停，禁止 `--no-verify` 绕过。

## 3. 架构健康监控

- 仪表盘：`/command/health`（综合评分 + 7 项指标：跨层调用 / 颜色硬编码 / 深层嵌套 / 长链 / 重复条件 / JSDoc 缺失 / 文档同步）。
- 报告生成：`npm run build:health` → `public/health-report.json`。
- 健康度基线：综合 93；7 项指标均 0/低（详见 `architecture/overview.md` §7）。

## 4. 常见故障处置

| 现象 | 可能原因 | 处置 |
|------|----------|------|
| `tsc:prod` 报 JSX 标签不匹配 | 组件标签未闭合（如 CockpitShell.tsx 已知预存问题） | 修复对应 JSX 闭合 |
| `audit:docs` 报未文档化文件 | 新增代码未补引用文档 | 补文档或回链 README |
| `lint:colors` 报错 | 组件出现裸 HEX/数字色类 | 改为令牌（见 token-usage-cookbook） |
| 构建产物缺失 | 依赖未装/版本错 | `npm ci` 重装 |
| AI 索引加载慢 | `.ai-index` 未更新 | 重跑 `build:ai-memory` 并同步 `docs/.ai-index/` |

## 5. 回滚

- 代码回滚：`git revert` 对应提交，重跑 pre-push 门禁。
- 文档回滚：归档至 `docs/07-archive/`，保留期 6 月（见 `07-archive/README.md`）。

## 6. 发布检查清单

- [ ] 12 道门禁全绿
- [ ] `/command/health` 达标（综合 ≥ 基线 93）
- [ ] `build:health` 产物生成
- [ ] CHANGELOG 更新
- [ ] 文档索引（README）同步
