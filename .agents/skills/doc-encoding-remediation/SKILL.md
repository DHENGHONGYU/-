---
skill_id: V9-SKILL-DOC-ENCODING
name: "doc-encoding-remediation"
description: "文档编码乱码诊断与安全转码：发现 .md/.ts 中文乱码、中文变问号、或准备执行文档链接修复（fix-doc-refs 等）前，先用确定性判据诊断编码（严格 UTF-8 失败且 gb18030 成功 = GBK）、四重护栏安全转码（备份+往返校验）、固化根因（scripts/lib/encoding.ts 的 readTextAdaptive/writeTextUtf8）。Invoke when 文档乱码、GBK 二次损坏风险排查、链接修复前置编码确认、或新增文本读写脚本时。"
version: v1.0.0
last_updated: 2026-08-23
change_log:
  - version: v1.0.0
    changes: "基于 S 级 Skill 5 段式骨架模板 [_SKILL-TEMPLATE.md](.agents/skills/_SKILL-TEMPLATE.md) 物理化迁移：自用户级 ~/.trae-cn/skills/v9-doc-encoding-remediation 归位项目单一物理源（2026-07-21 全仓 261 GBK 文档清零实战提炼）"
    date: 2026-08-23
mandatory: false
---

# 文档编码乱码诊断与安全转码 — v1.0.0

> **核心铁律：链接修复前必须先确认全仓无 GBK。** Node 的 UTF-8 读取遇非法字节静默替换为 U+FFFD 且不抛错，
> GBK 双字节序列几乎必然被替换 → 再 utf-8 写回 = 整篇永久性二次损坏。

---

## 一、触发条件

- `docs/` 或 `outputs/` 下 `.md` 出现中文乱码（`?` 替代、整篇损坏）、中文变问号 / U+FFFD
- **准备执行文档链接修复**（`fix-doc-refs.ts`、`fix-cross-references.ts`、`scripts/fix/*.ts`）：前置条件 = 先确认全仓无 GBK，否则硬编码 utf-8 脚本会把 GBK 读成乱码再写回
- 新增/修改任何涉及文本读写的脚本

**根因（已固化）**：链接修复脚本族原硬编码 `readFileSync(p,'utf-8')` / `writeFileSync(p,c,'utf-8')`。现统一走 `scripts/lib/encoding.ts` 的 `readTextAdaptive()`（严格 UTF-8 → 回退 gb18030 → 保底宽松 UTF-8）与 `writeTextUtf8()`（恒 UTF-8 写回）。

---

## 二、前置检查

| # | 检查项 | 方法 | 通过标准 |
|---|--------|-----|---------|
| 1 | 排除目录清单 | `cache/gbk-backup/`、`docs-backup-*/`、`node_modules/`、`coverage/` | 扫描前先排除，否则备份目录污染结果 |
| 2 | 判定工具选择 | 确定性解码判据（Node `TextDecoder` fatal 模式） | **禁用 `charset_normalizer`**（utf8+坏字节文件会段错误；`u16=True` 是假信号） |
| 3 | 根因 helper 存在 | `scripts/lib/encoding.ts` | `readTextAdaptive` / `writeTextUtf8` 可用 |

---

## 三、阶段化 SOP

### 阶段 1：编码探测（确定性判据）

**判据：严格 UTF-8 解码失败 且 严格 gb18030 解码成功 = GBK。**

```typescript
import { readFileSync } from 'fs'
const utf8 = new TextDecoder('utf-8', { fatal: true })
const gbk = new TextDecoder('gb18030', { fatal: true })
function classify(buf: Buffer): 'UTF8' | 'GBK' | 'OTHER' {
  try { utf8.decode(buf); return 'UTF8' }
  catch { try { gbk.decode(buf); return 'GBK' } catch { return 'OTHER' } }
}
```

分类统计输出 `UTF8_OR_ASCII / GBK / OTHER(utf8 为主 + 少量坏字节)`，产出探测报告（数量、分布、OTHER 性质判定）。

### 阶段 2：安全转码（GBK→UTF-8，四重护栏）

1. **仅**处理探测标定的 GBK 文件，绝不碰 UTF-8 / OTHER
2. 写回前原文件复制至 `cache/gbk-backup/`（可一键还原）
3. **往返校验**：`utf8字节 → decode utf-8 → encode gb18030 == 原字节`，否则跳过并报警
4. 逐文件异常隔离，单文件失败不影响其余

读写统一用 `readTextAdaptive()` / `writeTextUtf8()`。

### 阶段 3：根因固化校验

```bash
grep -rn "writeFileSync(.*'utf-8')" scripts/
# 应 0 结果（全部走 encoding.ts）；残留则改为导入 readTextAdaptive / writeTextUtf8
```

### 阶段 4：验收复测

```
复测（排除备份目录后）：GBK_TOTAL = 0 且 docs/_GBK = 0 → 通过
```

同时确认 `cache/gbk-backup/` 保留原始 GBK 备份（2026-07-21 基线 261 个原始文件，可还原）。

---

## 四、陷阱与经验教训

| # | 陷阱 | 后果 | 规避 |
|---|------|-----|-----|
| 1 | 仓库有 GBK 时直接 `--apply` 链接修复 | 永久性二次损坏 | 先转码再修复链接 |
| 2 | 用 `charset_normalizer` 判定 | 段错误 + u16 假信号 | 确定性解码判据（fatal TextDecoder） |
| 3 | 把 OTHER（utf8+坏字节）当 GBK | 误转码扩大损失 | OTHER 仅 ~3% 坏字节，单独字节修补收尾 |
| 4 | 复测不排除备份目录 | `GBK=0` 永远测不出 | `cache/gbk-backup/` 必须排除 |
| 5 | fix 脚本硬编码 `utf-8` 读写 | 静默替换毁掉整篇 | 统一走 `encoding.ts` helper |

---

## 五、完成交付物清单

| # | 交付物 | 存在位置 | 验证方法 |
|---|--------|---------|---------|
| 1 | 编码探测报告（GBK 数量/分布/OTHER 判定） | `outputs/` | 确定性判据证据 |
| 2 | 三维 Grep：fix 脚本族无残留硬编码 `writeFileSync(...,'utf-8')` | 诊断记录 | 0 结果 |
| 3 | 转码复测 `GBK_TOTAL=0`（排除备份目录） | 复测日志 | 实测数字 |
| 4 | 原始备份保留 | `cache/gbk-backup/` | 可一键还原 |
| 5 | 根因固化确认 | `scripts/lib/encoding.ts` | 已被 fix 脚本族引用 |

**关联资产**：处置报告 `outputs/gbk-encoding-remediation-report.md`。
