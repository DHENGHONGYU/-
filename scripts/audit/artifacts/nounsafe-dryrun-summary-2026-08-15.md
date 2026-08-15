# no-unsafe 自动化修复 Dry-Run 汇总 (2026-08-15)

| 分类 | 数量 |
|------|------|
| ✅ 自动补丁（模式 02/03/05/07/08/10） | 0 |
| ⚠️ 半自动候选（模式 01/02B/09/12） | 0 |
| 🛑 人工裁定（模式 13/14） | 0 |

补丁文件：`scripts/audit/artifacts/nounsafe-patches-2026-08-15.json`

## 一、自动补丁覆盖明细（可直接 --apply）

## 二、半自动 / 人工候选项


## 三、后续指令

- 确认补丁：`node scripts/audit/apply-no-unsafe-fix-patterns.cjs <report.json> --apply`
- 应用后务必 `npx tsc:prod` + 受影响域测试
- 每类 PAT-13/14 都需人工在 PR review 时二次裁定