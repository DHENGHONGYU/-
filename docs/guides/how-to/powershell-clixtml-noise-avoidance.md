# PowerShell 脚本 CLIXML 噪声规避指南

> 当 Trae IDE 的 AI agent 通过 PowerShell SDK 执行脚本时，`Write-Host` 产生的 `InformationRecord` 对象会被序列化为 CLIXML 格式，导致输出中出现大量 XML 噪声。本指南提供规避方案。

## 1. 问题诊断

### 1.1 现象

AI agent 执行 PowerShell 脚本时，输出混入大量 CLIXML 序列化数据：

```xml
<Objs Version="1.1.0.1" xmlns="http://schemas.microsoft.com/powershell/2004/04">
  <Obj S="information" RefId="0">
    <TN RefId="0">
      <T>System.Management.Automation.InformationRecord</T>
      <T>System.Object</T>
    </TN>
    <ToString>PHASE 1/4: Repo State Pre-check</ToString>
    ...
  </Obj>
</Objs>
```

### 1.2 根因链

```
Write-Host → Information 流 → InformationRecord 对象
    → PowerShell SDK Invoke() 捕获
    → CLIXML 序列化 → XML 噪声
```

| 环节 | 说明 |
|---|---|
| `Write-Host` | PSv5+ 写入 **Information 流**（`Write-Information`），生成 `InformationRecord` 对象 |
| PowerShell SDK | `PowerShell.Invoke()` 捕获所有输出流，包括 Information 流 |
| Trae IDE 捕获器 | 将 `InformationRecord` 对象序列化为 CLIXML 格式 |
| 显示 | AI agent 日志中出现大量 XML 噪声 |

### 1.3 影响范围

- **受影响**：通过 AI agent 命令执行的 PowerShell 脚本（RunCommand 工具）
- **不受影响**：IDE 集成终端（Terminal 面板）中手动运行的脚本
- **不受影响**：独立 PowerShell 进程（`powershell -File script.ps1`）

### 1.4 判定方法

```powershell
# 检查脚本是否使用 Write-Host
Select-String -Path *.ps1 -Pattern 'Write-Host'

# 测试是否产生 CLIXML 噪声
# 坏：Write-Host 会产生 InformationRecord
Write-Host "test message" -ForegroundColor Red
# 输出中包含 <Objs Version="1.1.0.1" ...>

# 好：[Console]::WriteLine() 直接写入 stdout
[Console]::WriteLine("test message")
# 输出中只有纯文本
```

## 2. 解决方案

### 2.1 核心替换规则

| 原代码 | 替换为 | 说明 |
|---|---|---|
| `Write-Host "msg"` | `[Console]::WriteLine("msg")` | 直接写入 stdout，绕过 Information 流 |
| `Write-Host "msg" -ForegroundColor Red` | `Write-Line "msg" 'Red'` | 通过自定义 helper 保留颜色 |
| `Write-Host ""` | `[Console]::WriteLine()` | 空行 |
| `Write-Host "msg1"; Write-Host "msg2"` | `[Console]::WriteLine("msg1"); [Console]::WriteLine("msg2")` | 多条输出 |

### 2.2 标准 Helper 函数

将以下代码段加入脚本头部，替代 `Write-Host`：

```powershell
# ═══════════════════════════════════════════════════════════════
# CLIXML-safe logging helpers
#
# IMPORTANT: Use [Console]::WriteLine() instead of Write-Host to avoid
# PowerShell's Information stream generating InformationRecord objects.
# When Trae IDE's AI agent executes commands via PowerShell SDK, these
# InformationRecord objects get serialized to CLIXML, producing massive
# XML noise in the output. [Console]::WriteLine() writes directly to stdout,
# bypassing the Information stream entirely.
# ═══════════════════════════════════════════════════════════════

function Write-Banner([string]$m) {
  $bar = '=' * 72
  [Console]::WriteLine()
  [Console]::WriteLine($bar)
  [Console]::WriteLine("  $m")
  [Console]::WriteLine($bar)
}

function Write-Info([string]$m)    { [Console]::WriteLine("[INFO ] $m") }
function Write-Ok([string]$m)      { [Console]::WriteLine("[ OK  ] $m") }
function Write-Warn([string]$m)    { [Console]::WriteLine("[WARN ] $m") }
function Write-Err([string]$m)     { [Console]::WriteLine("[FAIL ] $m") }

function Write-Line([string]$text, [string]$color = 'Gray') {
  try {
    $prev = [Console]::ForegroundColor
    [Console]::ForegroundColor = $color
    [Console]::WriteLine($text)
  } catch {
    [Console]::WriteLine($text)
  } finally {
    try { [Console]::ForegroundColor = $prev } catch {}
  }
}
```

### 2.3 替换对照表

| 场景 | 原代码 | 新代码 |
|---|---|---|
| 普通信息 | `Write-Host "done"` | `[Console]::WriteLine("done")` |
| 带颜色信息 | `Write-Host "warning" -ForegroundColor Yellow` | `Write-Line "warning" 'Yellow'` |
| 空行 | `Write-Host ""` | `[Console]::WriteLine()` |
| 格式化文本 | `Write-Host "Count: $count"` | `[Console]::WriteLine("Count: $count")` |
| 对象列表 | `$items \| ForEach-Object { Write-Host $_ }` | `$items \| ForEach-Object { [Console]::WriteLine($_) }` |
| 条件输出 | `if ($ok) { Write-Host "OK" }` | `if ($ok) { [Console]::WriteLine("OK") }` |

### 2.4 需保留 Write-Host 的场景

以下场景 **必须** 使用 `Write-Host`，不可替换：

| 场景 | 原因 |
|---|---|
| 进度条（`Write-Host -NoNewline`） | `[Console]::WriteLine()` 不支持 `-NoNewline` |
| 进度覆盖（`\r` 回车） | 需要使用 `[Console]::CursorLeft` + `[Console]::Write()` |
| 交互式提示（`Read-Host` 前的提示） | SDK 模式下 `Read-Host` 行为不可预测 |

#### 进度条替代方案

```powershell
# 坏：Write-Host -NoNewline 产生 CLIXML
Write-Host -NoNewline "Progress: ["

# 好：使用 [Console]::CursorLeft + [Console]::Write()
[Console]::Write("Progress: [")
for ($i = 0; $i -lt 10; $i++) {
    [Console]::Write("=")
}
[Console]::WriteLine("]")
```

## 3. 迁移 Checklist

将现有 PowerShell 脚本迁移到 CLIXML-safe 模式时，按以下步骤执行：

1. **[ ] 扫描 `Write-Host` 使用位置**
   ```powershell
   Select-String -Path *.ps1 -Pattern 'Write-Host' -List
   ```

2. **[ ] 确认是否为可替换场景**
   - 普通输出 → 可替换
   - 进度条/`-NoNewline` → 需特殊处理
   - 交互式提示 → 保留 `Write-Host`

3. **[ ] 添加 helper 函数**
   - 将 2.2 节的 helper 加入脚本头部

4. **[ ] 批量替换**
   ```powershell
   # 示例：批量替换
   # Write-Host "msg" → [Console]::WriteLine("msg")
   # Write-Host "msg" -ForegroundColor X → Write-Line "msg" 'X'
   ```

5. **[ ] 验证输出**
   - 在 AI agent 中执行脚本
   - 确认输出中无 `<Objs Version="1.1.0.1"` 等 CLIXML 标记
   - 确认颜色输出在 IDE 集成终端中正常显示

6. **[ ] 验证功能**
   - 确认脚本逻辑不受影响
   - 确认退出码正确
   - 确认所有分支路径输出一致

## 4. 验证方法

### 4.1 CLIXML 检测

```powershell
# 运行脚本并检查输出中是否包含 CLIXML 标记
$output = & powershell -File script.ps1 2>&1
if ($output -match '<Objs Version=') {
    Write-Host "FAIL: CLIXML noise detected"
} else {
    Write-Host "PASS: No CLIXML noise"
}
```

### 4.2 双环境验证

推荐在两个环境中分别运行脚本：

| 环境 | 预期行为 |
|---|---|
| AI agent (RunCommand) | 输出干净，无 CLIXML |
| IDE 集成终端 | 颜色正常，输出格式一致 |

## 5. 常见问题

### Q1: 为什么 IDE 集成终端运行没问题？

IDE 集成终端启动的是**独立 PowerShell 进程**，而非通过 PowerShell SDK 的 `Invoke()` 方法执行。独立进程的 `Write-Host` 直接写入控制台，不经过 Information 流捕获和 CLIXML 序列化。

### Q2: `[Console]::WriteLine()` 不显示颜色？

`[Console]::WriteLine()` 本身支持 `[Console]::ForegroundColor`，但在 AI agent 环境中，颜色控制可能被终端模拟器过滤。这是预期行为——AI agent 关注内容而非颜色。

### Q3: `Write-Output` 可以替代吗？

不推荐。`Write-Output` 将对象放入**成功流**（Success Stream），PowerShell SDK 同样会捕获并序列化。只有 `[Console]::WriteLine()` 直接写入进程的 stdout 文件描述符，完全绕过所有 PowerShell 输出流。

### Q4: 对脚本性能有影响吗？

`[Console]::WriteLine()` 比 `Write-Host` 略快（跳过了 Information 流的对象封装和格式化），在大量输出场景下反而更快。

### Q5: 是否影响 `$ErrorActionPreference`？

不影响。`[Console]::WriteLine()` 仅影响输出方式，不改变 PowerShell 的错误处理行为。

## 6. 参考文件

- 实际应用示例：[scripts/git/clean-side-effects.ps1](file:///d:/FinSightV9/scripts/git/clean-side-effects.ps1)
- PowerShell 输出流说明：[about_Redirection](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_redirection)
- CLIXML 格式规范：[PowerShell XML Serialization](https://learn.microsoft.com/en-us/powershell/scripting/learn/remoting/windows-powershell-remoting?view=powershell-7.3)
