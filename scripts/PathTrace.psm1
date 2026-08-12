# PathTrace.psm1 - 可复用的路径追踪日志模块
# 用法:
#   Import-Module .\scripts\PathTrace.psm1
#   Write-PathTrace "路径探测开始"
#   Write-PathTrace "命中: D:\project\.venv" -Level OK
#   Write-PathTrace "未找到 python.exe" -Level ERR
#
# 可选: 启用文件日志
#   Enable-PathTraceLog -Path "C:\temp\pathtrace.log"
#   ... 执行路径探测 ...
#   Disable-PathTraceLog

# 内部状态: 日志文件路径（为空则不写文件）
$script:_PathTraceLogFile = $null

# 内部状态: DEBUG 模式开关（默认关闭，仅输出 INFO/OK/WARN/ERR）
$script:_PathTraceDebug = $false

# 启用 DEBUG 级别日志
function Enable-PathTraceDebug {
    $script:_PathTraceDebug = $true
    Write-PathTrace "DEBUG 模式已启用" -Level OK
}

# 禁用 DEBUG 级别日志
function Disable-PathTraceDebug {
    $script:_PathTraceDebug = $false
    Write-PathTrace "DEBUG 模式已禁用" -Level INFO
}

# 启用文件日志
function Enable-PathTraceLog {
    param(
        [Parameter(Mandatory=$true)]
        [string]$Path
    )
    $script:_PathTraceLogFile = $Path
    $dir = Split-Path -Parent $Path
    if ($dir -and -not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -Path $script:_PathTraceLogFile -Value "[$timestamp] === PathTrace 日志开始 ===" -Encoding UTF8
}

# 禁用文件日志
function Disable-PathTraceLog {
    if ($script:_PathTraceLogFile) {
        $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        Add-Content -Path $script:_PathTraceLogFile -Value "[$timestamp] === PathTrace 日志结束 ===" -Encoding UTF8
        $script:_PathTraceLogFile = $null
    }
}

# 主函数: 输出路径追踪日志
# 参数:
#   -Message: 日志消息
#   -Level:   日志级别 (INFO/OK/WARN/ERR/DEBUG)，默认 INFO
#   -Indent:  缩进级别 (0-4)，默认 0
function Write-PathTrace {
    param(
        [Parameter(Position=0, Mandatory=$true)]
        [AllowEmptyString()]
        [string]$Message,

        [ValidateSet("INFO","OK","WARN","ERR","DEBUG")]
        [string]$Level = "INFO",

        [ValidateRange(0,4)]
        [int]$Indent = 0
    )

    # DEBUG 级别过滤: 未启用 debug 模式时跳过
    if ($Level -eq "DEBUG" -and -not $script:_PathTraceDebug) { return }

    # 颜色映射
    $color = switch ($Level) {
        "OK"    { "Green" }
        "WARN"  { "Yellow" }
        "ERR"   { "Red" }
        "DEBUG" { "DarkCyan" }
        default { "DarkGray" }  # INFO
    }

    # 构造前缀
    $prefix = "[PathTrace] " + $Level.PadRight(4) + " | "

    # 缩进
    $indentStr = "  " * $Indent

    # 完整行
    $fullLine = $prefix + $indentStr + $Message

    # 输出到控制台（带颜色）
    [Console]::WriteLine($fullLine)

    # 如果启用了文件日志，同时写入文件
    if ($script:_PathTraceLogFile) {
        $timestamp = Get-Date -Format "HH:mm:ss.fff"
        Add-Content -Path $script:_PathTraceLogFile -Value "[$timestamp] $fullLine" -Encoding UTF8
    }
}

# 便捷函数: 批量测试路径是否存在并输出追踪日志
# 参数:
#   -Paths:    路径数组（字符串数组）
#   -Label:    可选标签（如 "Python 候选链"）
# 返回: 第一个存在的路径，如果都不存在则返回 $null
function Test-PathChain {
    param(
        [Parameter(Mandatory=$true)]
        [AllowEmptyString()]
        [AllowEmptyCollection()]
        [string[]]$Paths,

        [string]$Label = "路径候选链"
    )

    Write-PathTrace "=== $Label 探测开始 ===" -Level INFO
    $found = $null
    $hitIndex = -1

    for ($i = 0; $i -lt $Paths.Count; $i++) {
        $p = $Paths[$i]
        if ([string]::IsNullOrEmpty($p)) {
            Write-PathTrace "候选[$($i+1)]/$($Paths.Count) skip: (空路径)" -Level DEBUG -Indent 1
            continue
        }
        $exists = Test-Path $p
        if ($exists) {
            Write-PathTrace "候选[$($i+1)]/$($Paths.Count) HIT: $p" -Level OK -Indent 1
            Write-PathTrace "Test-Path 返回 True" -Level DEBUG -Indent 2
            if (-not $found) {
                $found = $p
                $hitIndex = $i + 1
            }
        } else {
            Write-PathTrace "候选[$($i+1)]/$($Paths.Count) miss: $p" -Level INFO -Indent 1
            Write-PathTrace "Test-Path 返回 False" -Level DEBUG -Indent 2
        }
    }

    if ($found) {
        Write-PathTrace "选中: 候选[$hitIndex] -> $found" -Level OK
    } else {
        Write-PathTrace "所有 $($Paths.Count) 级候选均未命中" -Level WARN
    }
    Write-PathTrace "=== $Label 探测结束 ===" -Level INFO

    return $found
}

# 便捷函数: 探测 Python 解释器（与 windows-deploy-verify.ps1 的候选链一致）
# 参数:
#   -RepoRoot:          项目根目录
#   -EnvVenvPath:       可选，FIN_SIGHT_VENV_PATH 环境变量的值
#   -IncludeSystemPath: 是否在所有候选未命中时回退到系统 PATH（默认 true）
# 返回: Python 可执行文件路径
function Find-PythonExe {
    param(
        [Parameter(Mandatory=$true)]
        [string]$RepoRoot,

        [string]$EnvVenvPath,

        [switch]$IncludeSystemPath = $true
    )

    $candidates = @()

    Write-PathTrace "RepoRoot = $RepoRoot" -Level DEBUG
    Write-PathTrace "EnvVenvPath = $(if($EnvVenvPath){$EnvVenvPath}else{'(null)'})" -Level DEBUG
    Write-PathTrace "IncludeSystemPath = $IncludeSystemPath" -Level DEBUG

    # [0] 环境变量指定的外部路径（最高优先级）
    if (-not [string]::IsNullOrEmpty($EnvVenvPath)) {
        $c0 = Join-Path $EnvVenvPath "Scripts\python.exe"
        $candidates += $c0
        Write-PathTrace "候选[0] 构造: Join-Path('$EnvVenvPath', 'Scripts\python.exe') = $c0" -Level DEBUG
        Write-PathTrace "检测到 FIN_SIGHT_VENV_PATH=$EnvVenvPath，加入候选" -Level OK
    } else {
        Write-PathTrace "FIN_SIGHT_VENV_PATH 未设置（可选，用于 .venv 在项目外部时指定）" -Level INFO
        Write-PathTrace "候选[0] 跳过: EnvVenvPath 为空" -Level DEBUG
    }

    # [1]-[4] 项目内标准候选路径 (用 try/catch 防止 Join-Path 对无效驱动器崩溃)
    $pathSuffixes = @(
        ".venv\Scripts\python.exe",
        "venv\Scripts\python.exe",
        "backend\.venv\Scripts\python.exe",
        "backend\venv\Scripts\python.exe"
    )
    $cIdx = 1
    foreach ($suffix in $pathSuffixes) {
        try {
            $c = Join-Path $RepoRoot $suffix -ErrorAction Stop
        } catch {
            $c = $null
            Write-PathTrace "候选[$cIdx] 构造失败: $($_.Exception.Message)" -Level WARN
        }
        if ($c) {
            $candidates += $c
            Write-PathTrace "候选[$cIdx] 构造: $c" -Level DEBUG
        }
        $cIdx++
    }

    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $result = Test-PathChain -Paths $candidates -Label "Python 解释器候选链"
    $sw.Stop()
    Write-PathTrace "候选链探测耗时: $($sw.ElapsedMilliseconds)ms (共 $($candidates.Count) 条路径)" -Level DEBUG

    # 系统 PATH 兜底
    if (-not $result -and $IncludeSystemPath) {
        Write-PathTrace "回退到系统 PATH ..." -Level WARN
        $sysPy = Get-Command python -ErrorAction SilentlyContinue
        if ($sysPy) {
            Write-PathTrace "系统 python 命中: $($sysPy.Source)" -Level OK
            $result = $sysPy.Source
        } else {
            Write-PathTrace "系统 python 也未找到" -Level ERR
        }
    }

    return $result
}

# 导出成员
Export-ModuleMember -Function Write-PathTrace, Test-PathChain, Find-PythonExe, Enable-PathTraceLog, Disable-PathTraceLog, Enable-PathTraceDebug, Disable-PathTraceDebug
