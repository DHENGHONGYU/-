---
skill_id: V9-SKILL-DOC-ENCODING
name: doc-encoding-remediation
title: "文档编码乱码诊断与安全转码"
description: "FinSightV9 文档编码治理技能。当发现 .md/.ts 等文本文件出现中文乱码、或准备执行文档链接修复（fix-doc-refs 等）前，先诊断编码（GBK/gb18030 二次损坏风险）、安全转码（GBK→UTF-8，带往返校验与原文件备份）、固化根因（scripts/lib/encoding.ts 编码自适应 helper）。基于 2026-07-21 全仓 261 GBK 文档清零实战提炼。"
agent_created: true
category: doc-governance
triggers:
  keywords: [文档乱码, GBK, 编码修复, 链接修复前置, 二次损坏, fix-doc-refs, utf-8 硬编码, 中文变问号, U+FFFD, 编码探测]
  files:
    - "scripts/fix-doc-refs.ts"
    - "scripts/fix/*.ts"
    - "scripts/lib/encoding.ts"
  events: [doc-encoding-risk, pre-link-fix, gbk-detected]
gates:
  - "三维 Grep 确认 fix 脚本族无残留硬编码 writeFileSync(...,'utf-8')（已统一走 encoding.ts）"
  - "编码探测产出报告：严格 UTF-8 失败且 gb18030 成功 = GBK，禁止用 charset_normalizer"
  - "转码后复测：全仓 GBK_TOTAL=0（排除 cache/gbk-backup/ 后）"
mandatory: false
covers_docs: [outputs/gbk-encoding-remediation-report.md, scripts/lib/encoding.ts]
---

# 文档编码乱码诊断与安全转码

## 触发场景

- 发现 `docs/` 或 `outputs/` 下 `.md` 出现中文乱码（? 替代、整篇损坏）。
- **准备执行文档链接修复**（`fix-doc-refs.ts`、`fix-cross-references.ts`、`scripts/fix/*.ts` 等）：**前置条件 = 先确认全仓无 GBK**，否则硬编码 utf-8 脚本会把 GBK 读成乱码再写回 → 永久性二次损坏。
- 排查「中文变问号 / U+FFFD」类编码问题。
- 新增/修改任何涉及文本读写的脚本。

## 根因（必须理解）

链接修复脚本族原硬编码 `readFileSync(p,'utf-8')` / `writeFileSync(p,c,'utf-8')`。Node 的 UTF-8 读取遇非法字节**静默替换为 U+FFFD 且不抛错**，GBK 双字节序列几乎必然被替换 → 再 utf-8 写回 = 整篇损毁。

✅ **根因已固化**：`scripts/lib/encoding.ts` 提供 `readTextAdaptive()`（严格 UTF-8 → 回退 gb18030 → 保底宽松 UTF-8）与 `writeTextUtf8()`（恒 UTF-8 写回）。所有 fix 脚本应改用这两个 helper，杜绝二次损坏。

## 执行流程

### 阶段 1：编码探测（确定性判据，禁止用 charset_normalizer）

判据：**严格 UTF-8 解码失败 且 严格 gb18030 解码成功 = GBK**。

- ⚠️ `charset_normalizer.best()` 在「utf8 为主 + 少量坏字节」文件上会**段错误**；`u16=True` 是假信号（任意字节序列都能「合法」解成 UTF-16）。全程用确定性解码判据。
- 排除 `cache/gbk-backup/`、`docs-backup-*/`、`node_modules/`、`coverage/`、`dist-test/` 等。

```bash
# 用 Node 跑确定性探测（参考实现见阶段 4 末尾），分类统计：
#   UTF8_OR_ASCII / GBK / OTHER(utf8 为主 + 少量坏字节)
```

### 阶段 2：安全转码（GBK→UTF-8，四重护栏）

1. **仅**处理探测标定的 GBK 文件，绝不碰 UTF-8 / OTHER；
2. 写回前原文件复制至 `cache/gbk-backup/`（可一键还原）；
3. **往返校验**：`utf8字节 → decode utf-8 → encode gb18030 == 原字节`，否则跳过并报警；
4. 逐文件异常隔离，单文件失败不影响其余。

用 `readTextAdaptive()` 读、`writeTextUtf8()` 写。

### 阶段 3：根因固化校验

```bash
grep -rn "writeFileSync(.*'utf-8')" scripts/
# 应 0 结果（全部走 encoding.ts）；若有残留，改为导入 readTextAdaptive / writeTextUtf8
```

### 阶段 4：验收复测

```
复测（排除备份目录后）：
  GBK_TOTAL = 0 且 docs/_GBK = 0  → 通过
```

同时确认 `cache/gbk-backup/` 保留原始 GBK 备份以备还原。

**参考探测实现（确定性判据）**：

```typescript
import { readFileSync } from 'fs'
const utf8 = new TextDecoder('utf-8', { fatal: true })
const gbk = new TextDecoder('gb18030', { fatal: true })
function classify(buf: Buffer): 'UTF8' | 'GBK' | 'OTHER' {
  try { utf8.decode(buf); return 'UTF8' }
  catch { try { gbk.decode(buf); return 'GBK' } catch { return 'OTHER' } }
}
```

## Gates（交付前必跑）

- [ ] 三维 Grep：fix 脚本族无残留硬编码 `writeFileSync(...,'utf-8')`
- [ ] 编码探测报告产出（GBK 数量、分布、OTHER 性质判定）
- [ ] 复测 `GBK_TOTAL=0`（排除备份目录）
- [ ] 根因固化：`scripts/lib/encoding.ts` 已被 fix 脚本引用

## 常见陷阱

1. **直接 `--apply` 链接修复**：仓库有 GBK 文档时 = 二次损坏。必须先转码。
2. **用 charset_normalizer 判定**：段错误 + u16 假信号，不可靠。用确定性解码判据。
3. **把 OTHER（utf8+坏字节）当 GBK**：这类文件以 UTF-8 为主，仅 ~3% 坏字节，链接修复只会再损失那点，危害远低于 GBK，单独做字节修补收尾即可。
4. **备份目录被重新扫描**：`cache/gbk-backup/` 本身是 GBK 备份，复测必须排除，否则 `GBK=0` 永远测不出。

## 关联资产

- 处置报告：`outputs/gbk-encoding-remediation-report.md`
- 根因 helper：`scripts/lib/encoding.ts`（`readTextAdaptive` / `writeTextUtf8`）
- 原始备份：`cache/gbk-backup/`（261 个原始 GBK，可还原）
