---
title: V9 策略文档表头规范与检查清单
version: v1.1.0
last_updated: 2026-08-11
maintainer: V9 Architecture Team
status: active
change_log:
  - version: v1.1.0
    changes: "C 类版本闭环(2026-08-11)：补全 change_log 初始条目"
    date: 2026-08-11
---

# V9 策略文档表头规范与检查清单

> **Status**: Active
> **Version**: v1.1.0（§3.8 新增跨平台 Python 3.10+ 检查脚本全 7 段 + §6 新增 Markdown 预览器升级方案 H1-H6 完整层级 + 表格/代码块/列表）
> **Last Updated**: 2026-08-11
>
> 本文档定义 `docs/explanation/strategy/` 下所有策略类文档的**统一表头格式规范**，包含 YAML frontmatter 五字段模板、引用块标题结构、字段语义，以及可复制粘贴的自动化检查命令（PowerShell / 跨平台 Python 3.10+ / Node 脚本）。
> v1.1 新增：§3.8 跨平台 Python 3.10+ 检查脚本（7 段 × 零第三方依赖 + 1 份独立脚本） + §6 Markdown 预览器升级配置方案。
> 目标读者：策略文档维护者、文档治理执行者、架构评审者。

---

## 1. 结构模板（可复制）

每个策略 `.md` 文件 **必须** 以如下两段严格结构开头，之后再跟正文一级章节（如 `## 1. 策略定义`）。

### 1.1 YAML Frontmatter（文件开头 1–7 行）

```yaml
---
title: 文档中文标题（英文标识）
version: vX.Y.Z
last_updated: YYYY-MM-DD
maintainer: V9 Architecture Team
status: active
---
```

### 1.2 引用块标题（紧跟 frontmatter 之后，约 9–18 行）

```markdown
# 文档中文标题（英文标识）

> **Status**: Active
> **Version**: vX.Y.Z（可选：版本变更摘要，如 v4.7 资金流向二次确认）
> **Last Updated**: YYYY-MM-DD
>
> 本文档定义 V9 的 XXX（策略名），属于 XXX 分类体系中的第 X 梯队。一句话描述策略核心逻辑 / 应用场景。
> 可选：vX.Y 新增：XXX。
> 可选：vX.Y 新增：YYY。
> 目标读者：策略开发者、交易员、架构评审者。

---
```

### 1.3 行位置对齐建议（便于 grep 扫描）

| 行号 | 内容 | 检查要点 |
|------|------|---------|
| L1 | `---` | frontmatter 起始分隔符，无前置空行 |
| L2 | `title:` | 首字母小写，`title:` 与正文间一空格 |
| L3 | `version:` | 严格 `vX.Y.Z` 语义化版本，禁止 `V` 大写或纯数字 |
| L4 | `last_updated:` | ISO 短日期 `YYYY-MM-DD`，与引用块 Last Updated 保持一致 |
| L5 | `maintainer:` | 默认 `V9 Architecture Team`，跨团队时补充具体团队 |
| L6 | `status:` | 枚举：`active` / `draft` / `deprecated` / `archived`，**小写** |
| L7 | `---` | frontmatter 结束分隔符，与起始 `---` 配对 |
| L8 | 空行 | frontmatter 与一级标题间**必须**有一空行 |
| L9 | `# 标题` | 一级标题，建议与 YAML `title` 字段完全一致 |
| L10 | 空行 | 一级标题与引用块间一空行 |
| L11 | `> **Status**: Xxx` | Status 首字母**大写**（Active / Draft / Deprecated / Archived） |
| L12 | `> **Version**: vX.Y.Z` | 可追加括号版本摘要 |
| L13 | `> **Last Updated**: YYYY-MM-DD` | 必须与 YAML `last_updated` 同日 |
| L14 | `>` | 空引用行（视觉分隔） |
| L15–L17 | `> ...` | 文档简介、版本增量、目标读者 |
| L18 | `---` | 标题段与正文第一节的分隔线 |

---

## 2. 字段语义定义

### 2.1 YAML Frontmatter 字段

| 字段 | 必填 | 取值规范 | 用途 |
|------|------|---------|------|
| `title` | ✅ | 自由文本，建议 `中文名（英文标识）` 结构 | 文档检索、IDE 标签页、站点导航展示 |
| `version` | ✅ | `v{主版本}.{次版本}.{修订号}`，语义化 | 重大改动 +1，功能新增 +0.1，勘误/格式 +0.0.1 |
| `last_updated` | ✅ | `YYYY-MM-DD`（ISO 8601 短格式） | 文档新鲜度判断，与引用块 `Last Updated` 强一致 |
| `maintainer` | ✅ | 团队名（默认 `V9 Architecture Team`）或人名列表 | 问题追溯、Owner 识别 |
| `status` | ✅ | `active` / `draft` / `deprecated` / `archived`（小写） | 文档生命周期管理 |

### 2.2 引用块字段

| 字段 | 大写规则 | 与 YAML 关系 |
|------|---------|-------------|
| `**Status**` | 冒号后首字母大写（Active / Draft / Deprecated / Archived） | 语义相同，展示层适配 |
| `**Version**` | `vX.Y.Z` 前缀 + 可选括号说明 | 必须与 YAML `version` 基础版本号一致，括号说明可仅在展示层出现 |
| `**Last Updated**` | 严格 `YYYY-MM-DD` | **必须**与 YAML `last_updated` 值完全相同；若不一致以引用块过期处理 |

---

## 3. 检查命令清单（复制即用）

以下命令在 PowerShell（Windows）/ Git Bash 中均可执行，工作目录固定为仓库根。

### 3.1 列出 strategy 目录所有 md 文件

```powershell
Get-ChildItem docs/explanation/strategy -Recurse -Filter *.md | Select-Object -ExpandProperty FullName
```

### 3.2 检查每个文件是否有 frontmatter 五字段齐全（正向）

```powershell
# 五字段总数应为 (文档数 × 5)
Select-String -Path docs/explanation/strategy/*.md -Pattern '^(title|version|last_updated|maintainer|status):' | Measure-Object | Select-Object -ExpandProperty Count
```

预期：**7 文档 × 5 = 35 行**（若小于 35 表示有文档缺字段）。

### 3.3 检查 `last_updated` 是否全部等于今天（动态日期）

```powershell
$today = Get-Date -Format 'yyyy-MM-dd'
Select-String -Path docs/explanation/strategy/*.md -Pattern "^last_updated: $today" | Measure-Object | Select-Object -ExpandProperty Count
```

预期：输出 **7**（等于文档数即全绿）。

### 3.4 检查 `last_updated` 与引用块 `Last Updated` 是否**双向一致**（关键校验）

```powershell
$docs = Get-ChildItem docs/explanation/strategy/*.md
$failures = @()
foreach ($d in $docs) {
  $content = Get-Content $d.FullName
  $yaml = ($content | Select-String -Pattern '^last_updated:\s*(\S+)' | ForEach-Object { $_.Matches[0].Groups[1].Value })
  $block = ($content | Select-String -Pattern '>\s*\*\*Last Updated\*\*:\s*(\S+)' | ForEach-Object { $_.Matches[0].Groups[1].Value })
  if ($yaml -ne $block) { $failures += "$($d.Name): yaml=$yaml block=$block" }
}
if ($failures.Count -eq 0) { "PASS: 所有文档 YAML 与引用块 last_updated 双向一致" } else { $failures }
```

预期：`PASS: ...`

### 3.5 检查 Status 枚举合规（仅允许 active / draft / deprecated / archived）

```powershell
Select-String -Path docs/explanation/strategy/*.md -Pattern '^status:\s*(?!(active|draft|deprecated|archived)$).*$'
```

预期：**无输出**（无匹配 = 全合规）。

### 3.6 检查引用块 Status / Version / Last Updated 三行齐备

```powershell
Select-String -Path docs/explanation/strategy/*.md -Pattern '>\s*\*\*(Status|Version|Last Updated)\*\*:' | Group-Object Path | Where-Object { $_.Count -lt 3 } | Select-Object Name
```

预期：**无输出**（缺字段的文档才会出现）。

### 3.7 全量一键扫描（合并以上，输出结构化汇总）

```powershell
$docs = Get-ChildItem docs/explanation/strategy/*.md
$today = Get-Date -Format 'yyyy-MM-dd'
$rows = foreach ($d in $docs) {
  $c = Get-Content $d.FullName
  $title  = ($c | Select-String -Pattern '^title:\s*(.+)' | ForEach-Object { $_.Matches[0].Groups[1].Value })
  $yamlVer= ($c | Select-String -Pattern '^version:\s*(\S+)'        | ForEach-Object { $_.Matches[0].Groups[1].Value })
  $yamlDt = ($c | Select-String -Pattern '^last_updated:\s*(\S+)'   | ForEach-Object { $_.Matches[0].Groups[1].Value })
  $stat   = ($c | Select-String -Pattern '^status:\s*(\S+)'         | ForEach-Object { $_.Matches[0].Groups[1].Value })
  $bDt    = ($c | Select-String -Pattern '>\s*\*\*Last Updated\*\*:\s*(\S+)' | ForEach-Object { $_.Matches[0].Groups[1].Value })
  $bVer   = ($c | Select-String -Pattern '>\s*\*\*Version\*\*:\s*(\S+)' | ForEach-Object { $_.Matches[0].Groups[1].Value.TrimEnd('（') })
  [PSCustomObject]@{
    文档       = $d.Name
    标题       = $title
    YAML版本   = $yamlVer
    块版本      = $bVer
    版本一致   = $yamlVer -eq $bVer
    YAML日期   = $yamlDt
    块日期      = $bDt
    日期一致   = $yamlDt -eq $bDt
    日期新鲜   = $yamlDt -eq $today
    Status     = $stat
    Status合法 = @('active','draft','deprecated','archived') -contains $stat
  }
}
$rows | Format-Table -AutoSize
```

### 3.8 跨平台 Python 3.10+ 检查脚本（零第三方依赖，Windows / macOS / Linux 通用）

> **运行前提**：Python 3.10 及以上；工作目录固定为仓库根（`-d FinSightV9`）；无需 `pip install` 任何包。
> 独立脚本位置：[scripts/audit/audit_strategy_doc_headers.py](../../scripts/audit/audit_strategy_doc_headers.py)（推荐直接运行，比复制粘贴更稳定）

#### 3.8.1 列出 strategy 目录所有 md 文件

```python
from pathlib import Path

for p in sorted(Path('docs/explanation/strategy').rglob('*.md')):
    print(p.resolve())
```

#### 3.8.2 检查每个文件是否有 frontmatter 五字段齐全（正向）

```python
from pathlib import Path
import re

KEYS = ('title', 'version', 'last_updated', 'maintainer', 'status')
pattern = re.compile(r'^(title|version|last_updated|maintainer|status):', re.MULTILINE)

files = list(Path('docs/explanation/strategy').glob('*.md'))
total = sum(len(pattern.findall(p.read_text(encoding='utf-8'))) for p in files)
expected = len(files) * 5
print(f'五字段总数: {total} / 预期 {expected}  {"PASS" if total == expected else "FAIL"}')
```

预期：`五字段总数: 35 / 预期 35  PASS`

#### 3.8.3 检查 `last_updated` 是否全部等于今天（动态日期）

```python
from pathlib import Path
import re
from datetime import date

TODAY = date.today().isoformat()
pattern = re.compile(r'^last_updated:\s*(\S+)', re.MULTILINE)

files = list(Path('docs/explanation/strategy').glob('*.md'))
fresh = 0
for p in files:
    m = pattern.search(p.read_text(encoding='utf-8'))
    if m and m.group(1) == TODAY:
        fresh += 1
    elif m:
        print(f'[NOT FRESH] {p.name}: {m.group(1)} (today={TODAY})')
    else:
        print(f'[MISSING  ] {p.name}: last_updated 字段缺失')
print(f'新鲜文档: {fresh} / 总文档 {len(files)}  {"ALL FRESH" if fresh == len(files) else "NEEDS UPDATE"}')
```

预期：`新鲜文档: 7 / 总文档 7  ALL FRESH`

#### 3.8.4 检查 `last_updated` 与引用块 `Last Updated` 是否**双向一致**（关键校验）

```python
from pathlib import Path
import re

yaml_re  = re.compile(r'^last_updated:\s*(\S+)', re.MULTILINE)
block_re = re.compile(r'>\s*\*\*Last Updated\*\*:\s*(\S+)', re.MULTILINE)

files = list(Path('docs/explanation/strategy').glob('*.md'))
failures = []
for p in files:
    c = p.read_text(encoding='utf-8')
    ym = yaml_re.search(c)
    bm = block_re.search(c)
    y, b = (ym.group(1) if ym else None), (bm.group(1) if bm else None)
    if y != b:
        failures.append(f'{p.name}: yaml={y!r} block={b!r}')

if not failures:
    print('PASS: 所有文档 YAML 与引用块 last_updated 双向一致')
else:
    print('FAILURES:')
    for f in failures:
        print(' -', f)
```

预期：`PASS: 所有文档 YAML 与引用块 last_updated 双向一致`

#### 3.8.5 检查 Status 枚举合规（仅允许 active / draft / deprecated / archived）

```python
from pathlib import Path
import re

LEGAL = {'active', 'draft', 'deprecated', 'archived'}
status_re = re.compile(r'^status:\s*(\S+)', re.MULTILINE)

files = list(Path('docs/explanation/strategy').glob('*.md'))
illegal = []
for p in files:
    m = status_re.search(p.read_text(encoding='utf-8'))
    if not m:
        illegal.append(f'{p.name}: [缺失 status 字段]')
    elif m.group(1) not in LEGAL:
        illegal.append(f'{p.name}: {m.group(1)!r} 不在允许集合 {LEGAL}')

if not illegal:
    print('PASS: 所有文档 status 枚举合法')
else:
    print('ILLEGAL status:')
    for i in illegal:
        print(' -', i)
```

预期：`PASS: 所有文档 status 枚举合法`

#### 3.8.6 检查引用块 Status / Version / Last Updated 三行齐备

```python
from pathlib import Path
import re

keys_re = re.compile(r'>\s*\*\*(Status|Version|Last Updated)\*\*:', re.MULTILINE)

files = list(Path('docs/explanation/strategy').glob('*.md'))
missing = []
for p in files:
    found = {m.group(1) for m in keys_re.finditer(p.read_text(encoding='utf-8'))}
    if len(found) < 3:
        missing.append(f'{p.name}: 仅发现 {sorted(found)}  (缺失 { {"Status","Version","Last Updated"} - found} )')

if not missing:
    print('PASS: 所有文档引用块 Status / Version / Last Updated 三行齐备')
else:
    print('MISSING block keys:')
    for m in missing:
        print(' -', m)
```

预期：`PASS: 所有文档引用块 Status / Version / Last Updated 三行齐备`

#### 3.8.7 全量一键扫描（合并 3.8.2–3.8.6，输出结构化 JSON 汇总）

```python
from pathlib import Path
import re, json, sys
from datetime import date

TODAY = date.today().isoformat()
LEGAL_STATUS = {'active', 'draft', 'deprecated', 'archived'}
STRATEGY_DIR = Path('docs/explanation/strategy')
KEYS = ('title', 'version', 'last_updated', 'maintainer', 'status')

def parse_file(p: Path):
    raw = p.read_text(encoding='utf-8')
    lines = raw.splitlines()
    # --- frontmatter (strict L1..L7)
    start_ok = lines[0].strip() == '---' if lines else False
    end_ok = lines[6].strip() == '---' if len(lines) > 6 else False
    fm = {k: '' for k in KEYS}
    if start_ok and end_ok:
        for ln in lines[1:6]:
            m = re.match(r'^(title|version|last_updated|maintainer|status):\s*(.*)$', ln)
            if m: fm[m.group(1)] = m.group(2).strip()
    # --- h1 (must be first non-fm heading)
    h1 = ''
    for ln in lines[7:15]:
        m2 = re.match(r'^#\s+(.+)$', ln)
        if m2: h1 = m2.group(1).strip(); break
    # --- block keys
    c = raw
    bs = re.search(r'>\s*\*\*Status\*\*:\s*(\S+)', c, re.MULTILINE)
    bv = re.search(r'>\s*\*\*Version\*\*:\s*(\S+)', c, re.MULTILINE)
    bd = re.search(r'>\s*\*\*Last Updated\*\*:\s*(\S+)', c, re.MULTILINE)
    block_status = bs.group(1).strip() if bs else ''
    block_ver_raw = bv.group(1).strip() if bv else ''
    block_ver = re.sub(r'（.*$', '', block_ver_raw)  # strip Chinese-paren version note
    block_date = bd.group(1).strip() if bd else ''
    # --- counts
    fm_field_count = sum(1 for k in KEYS if fm[k])
    # --- assemble
    return {
        'FileName': p.name,
        'L1_delim': start_ok,
        'L7_delim': end_ok,
        'FmFields': fm_field_count,
        'FmComplete': fm_field_count == 5,
        'YamlTitle': fm['title'], 'H1': h1, 'TitleMatch': fm['title'] == h1,
        'YamlVer': fm['version'], 'BlockVer': block_ver, 'VerMatch': fm['version'] == block_ver,
        'YamlDate': fm['last_updated'], 'BlockDate': block_date,
        'DateMatch': fm['last_updated'] == block_date,
        'DateFresh': fm['last_updated'] == TODAY,
        'Maintainer': fm['maintainer'],
        'YamlStatus': fm['status'], 'BlockStatus': block_status,
        'StatusLegal': fm['status'] in LEGAL_STATUS,
    }

rows = [parse_file(p) for p in sorted(STRATEGY_DIR.glob('*.md'))]
print(json.dumps(rows, ensure_ascii=False, indent=2))
# 汇总判断：任一 False 即整体 FAIL
any_fail = any(False in (r['L1_delim'], r['L7_delim'], r['FmComplete'], r['TitleMatch'],
                         r['VerMatch'], r['DateMatch'], r['DateFresh'], r['StatusLegal'])
               for r in rows)
print(f'\nOVERALL: {"PASS" if not any_fail else "FAIL"}  [docs={len(rows)}×18checks={len(rows)*18}]',
      file=sys.stderr)
sys.exit(1 if any_fail else 0)
```

预期：`OVERALL: PASS  [docs=7×18checks=126]`，exit code = 0。

> 独立脚本（含以上逻辑）：`python scripts/audit/audit_strategy_doc_headers.py`，可直接在 CI 中作为门禁步骤调用（exit code 1 会阻断流水线）。

---

## 4. 故障快速修复指南

| 问题现象 | 根因 | 修复动作 |
|---------|------|---------|
| frontmatter 字段总数 < 35 | 某文档缺字段（缺 `maintainer` 最多发） | 按 §1.1 模板补齐五字段，顺序严格 title/version/last_updated/maintainer/status |
| `last_updated` 与引用块 `Last Updated` 不一致 | 改了一半忘改另一半 | 同时改 §1.1 L4 和 §1.2 L13，保证同日 |
| `Status` 枚举非法（如 Active / ActiveCase） | 大小写或拼写错误 | YAML 层改为小写枚举，引用块层改为首字母大写（对应关系：active→Active / draft→Draft 等） |
| `version` 格式不合规（如 `1.0.0` / `v1.0`） | 缺 `v` 前缀或修订号缺省 | 统一为 `v{主}.{次}.{修}` 三位，如 `v1.0.0` |
| 一级标题与 `title` 字段不一致 | 历史改名只改一处 | 保持 §1.1 L2 与 §1.2 L9 文本完全相同 |
| frontmatter 后有空行缺失或多空行 | 粘贴时缩进误操作 | L7 `---` 之后只能有 **1** 个空行（L8），下一行（L9）必须是 `# 标题` |

---

## 5. 适用范围扩展（下一步建议）

本规范当前已覆盖 `docs/explanation/strategy/` 下 **7 个策略文档**，基线样本如下：

1. [breakout-trading-strategy.md](../explanation/strategy/breakout-trading-strategy.md) — 断线交易策略（参考母版）
2. [core-scarce-strategy.md](../explanation/strategy/core-scarce-strategy.md) — 核心稀缺资源策略
3. [hot-momentum-strategy.md](../explanation/strategy/hot-momentum-strategy.md) — 热门赛道策略
4. [value-bargain-strategy.md](../explanation/strategy/value-bargain-strategy.md) — 价值洼地策略
5. [watchlist-strategy.md](../explanation/strategy/watchlist-strategy.md) — 观察仓策略
6. [stock-selection-strategy.md](../explanation/strategy/stock-selection-strategy.md) — V9 选股策略总文档
7. [fake-breakout-technical-docs.md](../explanation/strategy/fake-breakout-technical-docs.md) — 假突破判定逻辑技术文档

下一步可推广到：
- `docs/explanation/design/*.md`（设计蓝图层）
- `docs/explanation/architecture/*.md`（架构说明层）
- `docs/explanation/implementation/*.md`（实施细节层）

---

## 6. Markdown 预览器升级配置方案（解决 H2/H3 标题、表格、列表、代码块渲染缺失问题）

> **适用场景**：本地文档抽检 HTML 预览（如本次 `strategy-doc-header-preview.html` 生成流程）。原最小实现仅支持 H1 / blockquote / `---`，未处理 H2-H6、列表、代码块、表格、加粗斜体，导致正文标题出现 `## 1. 策略定义` 原文泄漏。

### 6.1 现状诊断

| 语法 | 原最小 mdToHtml | 渲染现象 |
|------|----------------|---------|
| `# H1` | ✅ 处理 | 正常 |
| `## H2` / `### H3` — `###### H6` | ❌ 未处理 | 显示 `## 1. 策略定义` 原文泄漏 |
| `>` blockquote | ✅ 处理 | 蓝色左边框正常 |
| `---` horizontal rule | ✅ 处理 | 正常 |
| `**粗**` / `*斜*` / `` `code` `` | ❌ 未处理（仅 blockquote 内补了 **粗体**） | 正文内无样式，Markdown 符号泄漏 |
| `- 无序列表` / `1. 有序列表` | ❌ 未处理 | 纯文本，无符号 / 数字缩进 |
| ` ``` 围栏代码块 ``` ` | ❌ 未处理 | 三引号符号泄漏，无等宽 / 背景色 |
| `\| 表格 \|` （GFM 表） | ❌ 未处理 | 竖线符号泄漏，无边框无对齐 |
| `[链接](url)` / `![图](url)` | ❌ 未处理 | 括号 / 方括号符号泄漏 |

### 6.2 总体设计原则

1. **解析器分层**：Tokenizer → Block Parser → Inline Parser → HTML Renderer，四层解耦，便于未来替换（如换 `mistune` / `marked`）
2. **CSS 中心化**：所有样式统一通过 `<style>` 块注入，不写内联 style；用 `.md-body` 作用域防止污染页面其他元素
3. **双模式兼容**：
   - **Plan A（Stdlib Slim）**：纯 Python stdlib 手写解析器，零 pip 依赖，用于 CI 预检 / 离线机
   - **Plan B（Production）**：`pip install markdown`（Python）或 `npm install marked`（Node）走成熟解析器，用于日常文档站
4. **策略文档基线测试**：每次升级后用 `breakout-trading-strategy.md` L1-L100 做基准样例，断言 H2/H3 无 `##` 泄漏、表格不出现 `\|` 符号

### 6.3 Plan A — 纯 Stdlib 零依赖解析器（推荐用于当前抽检流程）

实现文件：[scripts/preview/render_markdown_preview.py](../../scripts/preview/render_markdown_preview.py)

**解析器能力列表（v1.0）**：

| 模块 | 支持语法 |
|------|---------|
| Block 层 | frontmatter 剥离 / `# H1`–`###### H6` 六层级 / `>` blockquote（合并连续行）/ `---` 水平分隔线 / ` ```lang` 围栏代码块 / 无序列表（`-`/`*`/`+`）/ 有序列表（`1.`/`2.`）/ GFM 管道表（含首行对齐 `:---` / `---: `）/ 普通段落 |
| Inline 层 | `**粗**` / `*斜*` / `` `行内代码` `` / `[文字](链接)` / `![alt](图片)` / 自动转义 HTML 特殊字符 |
| CSS 层 | `.md-body h1~h6`（按字号递减 + 下边框区分层级）/ `.md-body blockquote`（蓝色左边框）/ `.md-body table`（斑马纹 + 边框）/ `.md-body pre code`（浅灰背景 + 等宽 + 圆角）/ `.md-body ul/ol`（缩进 + 符号）/ `.md-body hr`（与一级标题分隔线风格一致） |

**CLI 用法**：

```bash
# 抽检一个文档的前 N 行（默认 L1-L100）
python scripts/preview/render_markdown_preview.py \
  --input docs/explanation/strategy/breakout-trading-strategy.md \
  --output outputs/tmp/strategy-doc-header-preview-v2.html \
  --head-lines 100 \
  --title "策略文档表头抽检预览 v2（解析器升级版）"

# 全量渲染（不传 --head-lines）
python scripts/preview/render_markdown_preview.py -i <md> -o <html>
```

### 6.4 Plan B — 生产级 Markdown 解析器（长期文档站方案）

若需要完整 GFM（脚注、任务列表、删除线、数学公式），推荐以下两套成熟方案二选一：

#### 6.4.1 Python 方案 — `pip install markdown`（+ GFM 扩展）

```bash
pip install markdown pymdown-extensions pygments
```

渲染脚手架（与 Plan A CLI 同构，仅替换 `md_to_html()` 函数体）：

```python
import markdown

def md_to_html(md_text: str, strip_fm: bool = True) -> str:
    text = re.sub(r'^---[\s\S]*?^---\r?\n', '', md_text, count=1, flags=re.MULTILINE) if strip_fm else md_text
    return markdown.markdown(
        text,
        extensions=[
            'extra',           # tables + fenced_code + footnotes + abbr + attr_list + def_list
            'sane_lists',
            'toc',
            'codehilite',      # pygments 语法高亮 (CSS .codehilite)
            'pymdownx.tilde',  # ~~删除线~~
            'pymdownx.tasklist',
        ],
        extension_configs={
            'codehilite': {'guess_lang': False, 'css_class': 'codehilite'},
            'pymdownx.tasklist': {'custom_checkbox': True},
        },
        output_format='html5',
    )
```

#### 6.4.2 Node 方案 — `npm install marked`（前端生态更贴近 V9 主站）

```bash
npm install --save-dev marked marked-highlight highlight.js
```

渲染脚手架（替换旧 Node CJS 中的 `mdToHtml()`）：

```javascript
const { marked } = require('marked');
const { markedHighlight } = require('marked-highlight');
const hljs = require('highlight.js');

marked.use(markedHighlight({
  langPrefix: 'hljs language-',
  highlight(code, lang) {
    return lang && hljs.getLanguage(lang)
      ? hljs.highlight(code, { language: lang }).value
      : hljs.highlightAuto(code).value;
  }
}));
marked.setOptions({ gfm: true, breaks: false, mangle: false, headerIds: true });

function mdToHtml(md) {
  const s = md.replace(/^---[\s\S]*?^---\r?\n/m, ''); // strip frontmatter
  return marked.parse(s);
}
```

### 6.5 升级验收标准（可视化 8 项）

生成预览 HTML 后，对照以下 8 项 **全绿方可判验收通过**：

| 项 | 验收点 | 正向断言（在 HTML 中搜索） |
|----|--------|-------------------------|
| H2-H6 标题 | 无 `##` / `###` 符号泄漏，且层级字号递减 | `<h2>`, `<h3>` 存在；文本中无 `## 1.` |
| 表格 | 无 `\|` 符号泄漏；有 `<table><thead>` 结构；斑马纹样式 | `<table class="md-table">` 存在；文本中无 `| 阈值 | 默认值 |` 原文 |
| 列表 | `<ul>` / `<ol>` 标签正确嵌套；每个列表项有 `<li>` 包裹；符号不泄漏 | `<ul><li>` / `<ol><li>` 存在 |
| 代码块 | 围栏 ``` 符号消失；`<pre><code>` 块；等宽字体背景色 | `<pre><code class="language-ts">` 存在；无 ` ```typescript ` 原文 |
| 行内粗/斜/码 | `**`, `*`, `` ` `` 符号消失；`<strong>`, `<em>`, `<code>` 标签 | 数量匹配；无符号泄漏 |
| 链接 / 图片 | `[xxx](yyy)` 结构消失；`<a href>` / `<img src>` 标签 | 正确属性值 |
| frontmatter 隐藏 | 无 `---` 符号泄漏；无 `title:`, `version:` 泄漏 | HTML 中无 `^---` / `^title:` 行 |
| blockquote 空行 | L14 空 `>` 渲染为段落留白；不是空 `<blockquote></blockquote>` 折叠 | 视觉上 Status 与简介之间有 ≥ 4px 间距 |

### 6.6 样式（CSS）配置基线（与 Plan A 一致，Plan B 可覆盖）

```css
.md-body{max-width:920px;margin:24px auto;padding:0 16px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans SC",sans-serif;line-height:1.75;color:#111827}
.md-body h1{font-size:26px;margin:28px 0 16px;padding-bottom:8px;border-bottom:2px solid #e5e7eb}
.md-body h2{font-size:22px;margin:24px 0 12px;padding-bottom:6px;border-bottom:1px solid #f3f4f6}
.md-body h3{font-size:18px;margin:20px 0 10px;color:#1f2937}
.md-body h4{font-size:16px;margin:16px 0 8px;color:#374151}
.md-body h5{font-size:15px;margin:14px 0 6px;color:#4b5563}
.md-body h6{font-size:14px;margin:12px 0 6px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em}
.md-body blockquote{border-left:4px solid #3b82f6;background:#f0f7ff;padding:10px 16px;margin:12px 0;border-radius:0 8px 8px 0;color:#1f2937}
.md-body blockquote + blockquote{margin-top:-4px}
.md-body blockquote strong{color:#111827}
.md-body table.md-table{border-collapse:collapse;margin:14px 0;width:100%;font-size:14px}
.md-body table.md-table th, .md-body table.md-table td{border:1px solid #e5e7eb;padding:8px 12px;vertical-align:top}
.md-body table.md-table th{background:#f9fafb;font-weight:600;text-align:left}
.md-body table.md-table tr:nth-child(2n) td{background:#fafafa}
.md-body pre{background:#0f172a;color:#e2e8f0;padding:14px 16px;border-radius:8px;overflow:auto;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:13px;line-height:1.55}
.md-body pre code{background:transparent;padding:0;color:inherit;font-size:inherit}
.md-body code:not(pre code){background:#f3f4f6;border-radius:4px;padding:1px 5px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.92em;color:#be123c}
.md-body ul, .md-body ol{margin:10px 0 10px 24px}
.md-body ul li{list-style:disc;padding-left:2px}
.md-body ol li{list-style:decimal;padding-left:2px}
.md-body li + li{margin-top:2px}
.md-body hr{border:none;border-top:1px solid #e5e7eb;margin:20px 0}
.md-body a{color:#2563eb;text-decoration:none;border-bottom:1px dashed #93c5fd}
.md-body a:hover{color:#1d4ed8;border-bottom-style:solid}
.md-body p{margin:8px 0}
```
