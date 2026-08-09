# CHECKLIST — PathTrace 提交前快速对照表

> 新成员提交前必读。涵盖本地预检、错误对照、Hook 排障三大场景。
> 详细规范见 [CONTRIBUTING.md](CONTRIBUTING.md) §3。

---

## 1. 提交前预检清单（Push 前逐项过一遍）

### 1.1 代码改动检查

- [ ] 修改了 `PathTrace.psm1` 中的函数后，同步更新了 `PathTrace.psd1` 的 `FunctionsToExport`
- [ ] 如果新增/删除了 7 个核心函数之一，同步更新了 `pre-push-pathtrace-check.ps1` 的 `$requiredFuncs` 数组
- [ ] `ModuleVersion` 已升级到 `X.Y.Z`（X>=1），与即将打的 git tag 一致
- [ ] `.psm1` 的 `Export-ModuleMember -Function` 列表与 `.psd1` 的 `FunctionsToExport` 完全一致
- [ ] 没有引入中文路径或非 ASCII 字符到脚本文件名中

### 1.2 本地预检（必须通过）

```powershell
# 完整预检（推荐，7 项检查）
.\scripts\pre-push-pathtrace-check.ps1

# 超高速模式（跳过语法解析，仅版本/导出门控）
.\scripts\pre-push-pathtrace-check.ps1 -SkipSyntax

# 最完整模式（追加 16 项测试套件）
.\scripts\pre-push-pathtrace-check.ps1 -RunTests

# 失败时输出详细诊断（内联 [DIAG] + 汇总 dump）
.\scripts\pre-push-pathtrace-check.ps1 -Verbose
```

**通过标准**: `PASS: 11+  FAIL: 0  WARN: 0` → exit 0 → 可以安全 push

### 1.3 预检项对照表

| 序号 | 检查项 | 通过条件 | 失败时 CI 对应 |
|------|--------|---------|---------------|
| 1 | 文件完整性 | 7 个必需文件全部存在 | validate step 1 |
| 2 | ModuleVersion 门控 | `>= 1.0.0` | validate step 3 |
| 3 | 7 核心函数声明 | FunctionsToExport 全包含 | validate step 3 |
| 4 | psm1/psd1 导出交叉 | Compare-Object diff = 0 | validate step 4 |
| 5 | PS AST 语法解析 | Parser::ParseFile 无 errors | validate step 2 |
| 6 | 流水线阻断模拟 | validate=FAIL 时下游 SKIP 逻辑一致 | — |
| 7 | 测试套件 (可选) | exit 0 | test job (3 matrix) |

---

## 2. 错误对照表（常见 FAIL → 原因 → 修复）

### 2.1 文件完整性类

| 错误信息 | 根因 | 修复 |
|---------|------|------|
| `[FAIL] File exists: PSD1 (PathTrace.psd1)` | 文件被误删或路径错误 | `git checkout scripts/PathTrace.psd1` 恢复 |
| `[FAIL] File exists: PSM1 (PathTrace.psm1)` | 同上 | `git checkout scripts/PathTrace.psm1` |
| `[FAIL] File exists: Workflow (pathtrace-ci.yml)` | CI 配置缺失 | `git checkout .github/workflows/pathtrace-ci.yml` |

**-Verbose 诊断提示**: 失败时会输出 MISSING 文件的预期路径、PSScriptRoot、CWD 和同级文件列表，帮助快速定位。

### 2.2 版本号类

| 错误信息 | 根因 | 修复 |
|---------|------|------|
| `[FAIL] ModuleVersion 0.9.0 >= 1.0.0` | PSD1 版本号 < 1.0.0 | 编辑 `scripts/PathTrace.psd1`，设 `ModuleVersion = '1.X.Y'` |
| `Test-ModuleManifest parses` FAIL | PSD1 语法错误（引号/逗号缺失） | 检查 PSD1 文件语法，特别注意 `@()` 数组和字符串引号 |

### 2.3 函数导出类

| 错误信息 | 根因 | 修复 |
|---------|------|------|
| `[FAIL] All 7 core functions declared (missing: Find-PythonExe)` | PSD1 漏声明函数 | 在 `FunctionsToExport` 数组中添加缺失函数名 |
| `[FAIL] Export lists match (diff: <=Find-PythonExe)` | psm1 和 psd1 导出列表不一致 | 对比两文件，使 `Export-ModuleMember` 与 `FunctionsToExport` 完全一致 |

### 2.4 语法解析类

| 错误信息 | 根因 | 修复 |
|---------|------|------|
| `[FAIL] PathTrace.psm1 syntax error` | PS 语法错误（括号不匹配、关键字拼写等） | 检查错误行号，修复语法 |
| `[FAIL] pre-push-pathtrace-check.ps1 syntax error` | 预检脚本自身被改坏 | `git checkout scripts/pre-push-pathtrace-check.ps1` |

### 2.5 编码类（隐蔽错误）

| 错误信息 | 根因 | 修复 |
|---------|------|------|
| Hook 安装后 `Set-Content` 报 `utf8NoBOM` 错误 | PS 5.1 不支持 `utf8NoBOM` 编码 | 已修复：脚本改用 `.NET WriteAllText` + `UTF8Encoding($false)` |
| 脚本中出现中文乱码 | PS 5.1 解析非 ASCII 字符 | 脚本使用纯 ASCII，注释用英文 |
| Hook 文件含 BOM 导致 `#!/bin/sh` 失败 | BOM 字节被 bash 误读 | 已修复：安装时使用无 BOM 的 UTF-8 编码 |

---

## 3. Git pre-push Hook 排障指南

### 3.1 安装与卸载

```powershell
# 安装（push PathTrace 文件时自动触发预检）
.\scripts\pre-push-pathtrace-check.ps1 -InstallHook

# 卸载
.\scripts\pre-push-pathtrace-check.ps1 -UninstallHook
```

安装成功标志：`[pre-push hook] Installed at: .git\hooks\pre-push (XXXX bytes)`

### 3.2 Hook 不触发的常见原因

| 症状 | 根因 | 诊断 | 修复 |
|------|------|------|------|
| push 时没有任何 pre-check 输出 | push 的文件不匹配触发路径 | 检查改动文件是否匹配 `scripts/PathTrace*` 等模式 | 正常行为，无需修复 |
| push 时报 `Permission denied` | Hook 文件无执行权限 | `Get-Acl .git\hooks\pre-push` 查看是否有 DENY 规则 | 见下方 §3.3 |
| push 时报 `cannot spawn .git/hooks/pre-push` | Hook 文件不存在或路径错误 | `Test-Path .git/hooks/pre-push` | 重新安装：`-UninstallHook` 然后 `-InstallHook` |
| Hook 执行但报 `'pre-push' hook exited with error` | 预检脚本自身 FAIL | 直接运行 `.\scripts\pre-push-pathtrace-check.ps1 -Verbose` | 根据诊断信息修复 |

### 3.3 无执行权限模拟与修复

**症状**: `git push` 时报 `error: cannot spawn .git/hooks/pre-push: Permission denied`

**诊断**:
```powershell
# Windows: 检查 ACL 是否有 DENY 规则
$acl = Get-Acl .git\hooks\pre-push
$acl.Access | Where-Object { $_.AccessControlType -eq "Deny" }

# Linux/macOS: 检查文件权限
ls -la .git/hooks/pre-push
# 正常: -rwxr-xr-x  (有 x)
# 异常: -rw-r--r--  (无 x)
```

**修复**:
```powershell
# Windows: 移除 DENY 规则
$acl = Get-Acl .git\hooks\pre-push
$denyRules = $acl.Access | Where-Object { $_.AccessControlType -eq "Deny" }
foreach ($r in $denyRules) { $acl.RemoveAccessRule($r) | Out-Null }
Set-Acl -Path .git\hooks\pre-push -AclObject $acl

# 或直接重新安装（推荐）
.\scripts\pre-push-pathtrace-check.ps1 -UninstallHook
.\scripts\pre-push-pathtrace-check.ps1 -InstallHook

# Linux/macOS:
chmod +x .git/hooks/pre-push
```

**验证**:
```powershell
# 确认无 DENY 规则
(Get-Acl .git\hooks\pre-push).Access | Where-Object { $_.AccessControlType -eq "Deny" }
# 应无输出

# 直接运行预检确认
.\scripts\pre-push-pathtrace-check.ps1 -SkipSyntax
```

### 3.4 紧急绕过（不推荐）

```bash
# 跳过 Hook 直接 push（仅在紧急情况，且确认代码无误时使用）
git push --no-verify
```

> **警告**: 绕过 Hook 后 CI 仍会运行完整检查。如果 CI 失败，需要手动修复并重新 push。

---

## 4. -Verbose 诊断模式详解

### 4.1 何时使用

- 预检 FAIL 但错误信息不够详细时
- 文件路径相关问题（不知道文件应该在哪里）
- ModuleVersion 解析失败需要看 PSD1 内容
- 函数导出不匹配需要对比完整列表

### 4.2 诊断输出内容

| 检查项 | -Verbose 额外输出 |
|--------|------------------|
| 文件完整性 | MISSING 文件预期路径、PSScriptRoot、CWD、同级文件列表 |
| ModuleVersion 门控 | 版本号对比详情、PSD1 路径、文件前 5 行内容 |
| 函数导出完整性 | Required/Declared/Missing 三个完整列表 |
| Test-ModuleManifest 异常 | 异常类型全名、完整错误消息 |

### 4.3 使用示例

```powershell
.\scripts\pre-push-pathtrace-check.ps1 -Verbose -SkipSyntax
# 输出:
#   [PASS] / [FAIL] ... (正常检查结果)
#   [DIAG] MISSING: PSD1 -> expected at: ... (紫色内联诊断)
#   ...
#   --- Diagnostic Dump (N entries) --- (失败时汇总)
#   [DIAG] ...
```

> **注意**: 失败时即使不加 `-Verbose`，也会自动输出汇总诊断 dump。`-Verbose` 额外提供执行过程中的实时内联诊断。

---

## 5. 快速决策流程图

```
git push 失败?
│
├─ "Permission denied" → §3.3 修复执行权限
│
├─ "pre-push hook exited with error" → 运行预检脚本
│   │
│   └─ .\scripts\pre-push-pathtrace-check.ps1 -Verbose
│       │
│       ├─ File Integrity FAIL → §2.1 (git checkout 恢复文件)
│       ├─ ModuleVersion FAIL  → §2.2 (升级版本号)
│       ├─ Functions Export FAIL → §2.3 (同步 psd1/psm1)
│       └─ Syntax FAIL → §2.4 (修复语法错误)
│
├─ Hook 完全不触发 → §3.2 检查触发路径匹配
│
└─ CI 失败（本地通过）→ 检查 CI 环境差异:
    ├─ PS 版本差异 (5.1 vs 7)
    ├─ 路径大小写敏感 (Linux vs Windows)
    └─ 依赖模块可用性
```

---

## 6. 相关文件索引

| 文件 | 用途 |
|------|------|
| [scripts/pre-push-pathtrace-check.ps1](scripts/pre-push-pathtrace-check.ps1) | 本地预检脚本（本文档核心） |
| [scripts/simulate-hook-permission-failure.ps1](scripts/simulate-hook-permission-failure.ps1) | Hook 权限失败模拟脚本 |
| [scripts/PathTrace.psd1](scripts/PathTrace.psd1) | 模块清单（ModuleVersion + FunctionsToExport） |
| [scripts/PathTrace.psm1](scripts/PathTrace.psm1) | 模块实现（Export-ModuleMember） |
| [.github/workflows/pathtrace-ci.yml](.github/workflows/pathtrace-ci.yml) | CI/CD 流水线配置 |
| [CONTRIBUTING.md](CONTRIBUTING.md) | 完整提交流程规范（§3 为 PathTrace 专项） |
