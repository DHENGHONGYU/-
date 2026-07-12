# 插件目录索引

> **用途**: 快速定位所有插件技能文件，兼容 VS Code / TRAE / Kimi Code 等编辑器  
> **同步日期**: 2025-07-12

---

## 快速访问清单（Ctrl+点击跳转）

| 插件 | 扁平化 SKILL.md（推荐） | 脚本工具 | 整理文档 |
|------|------------------------|---------|---------|
| ifind | [plugins/ifind/SKILL.md](ifind/SKILL.md) | [ifind/scripts/ifind_tool.py](ifind/scripts/ifind_tool.py) | [docs/plugins/ifind.md](../docs/plugins/ifind.md) |
| imf | [plugins/imf/SKILL.md](imf/SKILL.md) | [imf/scripts/imf_tool.py](imf/scripts/imf_tool.py) | [docs/plugins/imf.md](../docs/plugins/imf.md) |
| kimi-webbridge | [plugins/kimi-webbridge/SKILL.md](kimi-webbridge/SKILL.md) | — | [docs/plugins/kimi-webbridge.md](../docs/plugins/kimi-webbridge.md) |
| scholar | [plugins/scholar/SKILL.md](scholar/SKILL.md) | [scholar/scripts/scholar_tool.py](scholar/scripts/scholar_tool.py) | [docs/plugins/scholar.md](../docs/plugins/scholar.md) |
| sec_edgar | [plugins/sec_edgar/SKILL.md](sec_edgar/SKILL.md) | [sec_edgar/scripts/sec_edgar_tool.py](sec_edgar/scripts/sec_edgar_tool.py) | [docs/plugins/sec_edgar.md](../docs/plugins/sec_edgar.md) |
| tianyancha | [plugins/tianyancha/SKILL.md](tianyancha/SKILL.md) | [tianyancha/scripts/tianyancha_tool.py](tianyancha/scripts/tianyancha_tool.py) | [docs/plugins/tianyancha.md](../docs/plugins/tianyancha.md) |
| world_bank_open_data | [plugins/world_bank_open_data/SKILL.md](world_bank_open_data/SKILL.md) | [world_bank_open_data/scripts/world_bank_open_data_tool.py](world_bank_open_data/scripts/world_bank_open_data_tool.py) | [docs/plugins/world_bank_open_data.md](../docs/plugins/world_bank_open_data.md) |
| yahoo_finance | [plugins/yahoo_finance/SKILL.md](yahoo_finance/SKILL.md) | [yahoo_finance/scripts/yahoo_finance_tool.py](yahoo_finance/scripts/yahoo_finance_tool.py) | [docs/plugins/yahoo_finance.md](../docs/plugins/yahoo_finance.md) |
| yuandian_law | [plugins/yuandian_law/SKILL.md](yuandian_law/SKILL.md) | [yuandian_law/scripts/yuandian_law_tool.py](yuandian_law/scripts/yuandian_law_tool.py) | [docs/plugins/yuandian_law.md](../docs/plugins/yuandian_law.md) |

---

## 按编辑器使用说明

### VS Code / TRAE

1. 打开 `plugins/README.md` 或 `docs/plugins/index.md`
2. 按住 `Ctrl`（Windows）/`Cmd`（Mac），点击蓝色链接直接跳转
3. 无效链接会显示红色波浪线（已启用 `markdown.validate.fileLinks.enabled`）

### Kimi 桌面版自带 Code

Kimi Code 编辑器基于 Monaco，支持以下方式：

1. **文件树导航**：在左侧文件树中展开 `plugins/` → `<plugin-name>/` → `SKILL.md`
2. **命令面板搜索**：`Ctrl+P` → 输入 `plugins/ifind/SKILL.md`
3. **快速打开脚本**：下方提供了一键打开脚本

### 其他编辑器（Cursor / Windsurf 等）

均兼容 VS Code 的 `.vscode/settings.json` 配置，Markdown 链接自动可点击。

---

## 一键打开脚本（Bash）

```bash
# 快速打开指定插件的 SKILL.md（在 VS Code/TRAE 中）
# 用法: open-skill <plugin-name>
open-skill() {
  local plugin=$1
  if [ -f "plugins/$plugin/SKILL.md" ]; then
    code "plugins/$plugin/SKILL.md"  # VS Code
    # trae "plugins/$plugin/SKILL.md"  # TRAE（如支持命令行）
  else
    echo "插件 '$plugin' 不存在，可用: ifind imf scholar sec_edgar tianyancha world_bank_open_data yahoo_finance yuandian_law"
  fi
}

# 示例
open-skill ifind
open-skill yahoo_finance
```

---

## 目录结构速查

```
plugins/
├── README.md                    ← 当前文件（快速索引）
├── ifind/
│   ├── SKILL.md                 ← ✅ 扁平化路径（推荐）
│   ├── skills/ifind/SKILL.md    ← 原始嵌套路径（隐藏）
│   ├── scripts/ifind_tool.py    ← Python 调用脚本
│   ├── README.md                ← 插件 README
│   └── bundle.zip               ← 插件包
├── imf/
│   ├── SKILL.md
│   ├── skills/imf/SKILL.md
│   └── scripts/imf_tool.py
├── ...（其他 7 个插件结构相同）
└── kimi-webbridge/
    ├── SKILL.md
    ├── skills/kimi-webbridge/SKILL.md
    └── README.md
```

---

## 路径问题速查

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| 点击 `C:\Users\DELL\...` 路径打不开 | 这是 Kimi 安装目录，不在工作区 | 使用本目录下的 `plugins/<name>/SKILL.md` |
| `plugins/ifind/skills/ifind/SKILL.md` 找不到 | 路径重复嵌套，已隐藏 | 使用 `plugins/ifind/SKILL.md` |
| 资源管理器中看不到 `skills/` 目录 | 被 `files.exclude` 隐藏 | 直接展开 `plugins/<name>/` 看 `SKILL.md` |

---

*本文件与 `docs/plugins/index.md` 同步维护，更新时请同时修改两者。*
