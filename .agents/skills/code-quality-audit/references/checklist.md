# 代码质量合规检查清单（可测试）

> 审查时逐项核对，标记 ✅ 通过 / ❌ 阻断 / ⚠️ 警告，并附证据（file:line 或命令输出）。
> 机器门禁：`node scripts/quality-gate-check.cjs --project <dir> --json` 可一次性产出 JSON 报告。

| # | 维度 | 检查项 | 严重级 | 验证方式 |
|---|------|--------|--------|----------|
| 1 | 分层 D1 | pages/components/store/services 不直连 `@/data/db` | Blocking | `npm run audit:layers` / 脚本 `layer-import-direction` |
| 2 | 分层 D2 | 新模块遵循「类型→Store→Service→UI」四步 | Blocking | `npm run audit:contract` |
| 3 | 类型 D3 | 无 `any`、无 `@ts-ignore`、接口先行 | Blocking | `npm run lint` / 脚本 `no-explicit-any`+`no-ts-ignore` |
| 4 | 零硬编码 D4 | 颜色走令牌、引擎参数走 config、无魔法数字 | Major | `npm run audit:hardcode`+`lint:colors` / 脚本 `ui-hardcoded-colors` |
| 5 | 日志 D5 | 核心分支 `logger.info`、错误带 context、前缀规范 | Major | `npm run audit:contract` |
| 6 | 清理 D6 | useEffect 订阅/监听配对 cleanup | Major | 脚本 `event-listener-cleanup` / `audit:contract` |
| 7 | 命名 D7 | 命名约定 + 路由集中注册 | Minor | `npm run audit:routes`+`audit:deadcode` |
| 8 | 协议 D8-P1 | 写库经 `DataBridge.forward` | Blocking | grep `dataBridge.forward` / 无 `db.put` |
| 9 | 协议 D8-P2 | 信封 `EnvelopeFactory.create` 含 traceId | Blocking | grep EnvelopeFactory.create |
| 10 | 协议 D8-P3 | 模块在 `ACL_MATRIX` 注册 | Blocking | grep ACL_MATRIX / `audit:contract` |
| 11 | 协议 D8-P4 | Store 变更后 `withBroadcast(EVENT_NAMES.X)` | Major | grep withBroadcast |
| 12 | 协议 D8-P5 | API 响应 `{code,data,message}` + code 判断 | Major | 人工/测试 |
| 13 | 协议 D8-P6 | DB_VERSION/STORE_NAME/ACL 同步 | Blocking | `npm run audit:reserved-stores`+`audit:contract` |
| 14 | 测试 D9 | 协议层有契约测试；tsc 通过 | Blocking/Major | `npm test -- --run`+`npx tsc --noEmit` |

## 通过门槛（合并前必须全部满足）

- ✅ 第 1–3、8–10、13–14 项：0 阻断违规
- ✅ `npm run audit`（layers/hardcode/contract/tests）整体通过
- ✅ `npx tsc --noEmit` 通过
- ⚠️ 第 4–7、11–12 项：警告须给出整改说明，可协商后合并

## 审查产出模板

```markdown
## 代码质量合规审查报告
- 工程：<path>
- 模式：V9 门禁 / 通用启发式
- 结论：PASS / PASS_WITH_WARNINGS / FAIL
- 门禁 JSON：<quality-gate-check.cjs 输出>
- 阻断项（若有）：<file:line + 规则 + 修复建议>
- 警告项（若有）：<...>
- 协议合规：DataBridge ✅ Envelope ✅ ACL ✅ Broadcast ✅
```
