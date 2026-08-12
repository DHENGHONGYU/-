# windows-deploy-verify.ps1 - Windows 部署核心验证
# 路径策略：所有路径动态探测，无硬编码绝对路径，支持跨用户/跨盘符移植
# 日志策略：通过 PathTrace 模块输出 [PathTrace] 详细日志，便于排查定位问题
# 模块依赖: PathTrace.psd1 / PathTrace.psm1 (同目录)

$ErrorActionPreference = "Continue"

# ====== 导入 PathTrace 模块（带降级回退） ======
$_ptModuleLoaded = $false
$_ptModulePath = Join-Path $PSScriptRoot "PathTrace.psd1"
if ([string]::IsNullOrEmpty($PSScriptRoot)) {
    $_ptModulePath = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "PathTrace.psd1"
}

# 尝试从脚本同目录导入
if (Test-Path $_ptModulePath) {
    try {
        Import-Module $_ptModulePath -Force -ErrorAction Stop
        $_ptModuleLoaded = $true
    } catch {
        # psd1 导入失败，尝试 psm1
        $_ptModulePath = $_ptModulePath -replace '\.psd1$', '.psm1'
        if (Test-Path $_ptModulePath) {
            Import-Module $_ptModulePath -Force -ErrorAction Stop
            $_ptModuleLoaded = $true
        }
    }
}

# 尝试从全局 PSModulePath 导入
if (-not $_ptModuleLoaded) {
    try {
        Import-Module PathTrace -Force -ErrorAction Stop
        $_ptModuleLoaded = $true
    } catch {
        $_ptModuleLoaded = $false
    }
}

# 降级回退: 模块不可用时定义内联函数（保持脚本独立可运行）
if (-not $_ptModuleLoaded) {
    function Write-PathTrace {
        param(
            [string]$Message,
            [ValidateSet("INFO","OK","WARN","ERR","DEBUG")][string]$Level = "INFO",
            [ValidateRange(0,4)][int]$Indent = 0
        )
        $color = switch ($Level) {
            "OK"    { "Green" }
            "WARN"  { "Yellow" }
            "ERR"   { "Red" }
            "DEBUG" { "DarkCyan" }
            default { "DarkGray" }
        }
        $indentStr = "  " * $Indent
        Write-Host ("  [PathTrace] " + $Level.PadRight(4) + " | " + $indentStr + $Message) -ForegroundColor $color
    }
    function Find-PythonExe {
        param([string]$RepoRoot, [string]$EnvVenvPath, [switch]$IncludeSystemPath = $true)
        $candidates = @()
        if (-not [string]::IsNullOrEmpty($EnvVenvPath)) {
            $candidates += (Join-Path $EnvVenvPath "Scripts\python.exe")
        }
        $candidates += (Join-Path $RepoRoot ".venv\Scripts\python.exe")
        $candidates += (Join-Path $RepoRoot "venv\Scripts\python.exe")
        $candidates += (Join-Path $RepoRoot "backend\.venv\Scripts\python.exe")
        $candidates += (Join-Path $RepoRoot "backend\venv\Scripts\python.exe")
        foreach ($c in $candidates) {
            if (Test-Path $c) { return $c }
        }
        if ($IncludeSystemPath) {
            $sysPy = Get-Command python -ErrorAction SilentlyContinue
            if ($sysPy) { return $sysPy.Source }
        }
        return $null
    }
    Write-PathTrace "PathTrace 模块不可用，使用内联降级函数" -Level WARN
} else {
    Write-PathTrace "PathTrace 模块已加载 (来源: $(if($_ptModulePath -match '\.psd1$'){'清单'}else{'代码'}))" -Level OK
}

# ====== 动态路径探测（使用 $PSScriptRoot 自动变量，兼容 powershell -File） ======
Write-PathTrace "=== 路径探测开始 ==="
if ([string]::IsNullOrEmpty($PSScriptRoot)) {
    Write-PathTrace "`$PSScriptRoot 为空，回退到 MyInvocation" -Level WARN
    $PSScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
    Write-PathTrace "MyInvocation.MyCommand.Path = $($MyInvocation.MyCommand.Path)"
}
$ScriptDir_Abs = $PSScriptRoot
$RepoRoot_Abs  = Split-Path -Parent $ScriptDir_Abs
Write-PathTrace "PSScriptRoot  = $ScriptDir_Abs" -Level OK
Write-PathTrace "RepoRoot_Abs  = $RepoRoot_Abs (Split-Path -Parent)" -Level OK

# 立即切入项目根目录，后续相对路径写法才生效
try {
    Set-Location $RepoRoot_Abs -ErrorAction Stop
    Write-PathTrace "Set-Location -> $RepoRoot_Abs" -Level OK
} catch {
    Write-PathTrace "Set-Location 失败: $($_.Exception.Message)" -Level ERR
}

# ====== 定位 Python（通过 PathTrace 模块的 Find-PythonExe） ======
# 候选链优先级 (6 级):
#   [0] 环境变量 FIN_SIGHT_VENV_PATH（支持 .venv 在项目外部，如 D:\Projects\Data）
#   [1] $RepoRoot\.venv\Scripts\python.exe（默认位置）
#   [2] $RepoRoot\venv\Scripts\python.exe（备用命名）
#   [3] $RepoRoot\backend\.venv\Scripts\python.exe（后端子目录）
#   [4] $RepoRoot\backend\venv\Scripts\python.exe（后端备用）
#   [5] Get-Command python（系统 PATH 兜底）
Write-PathTrace "=== Python 解释器候选链探测 ==="

# 读取环境变量（传递给 Find-PythonExe）
$envVenv = [System.Environment]::GetEnvironmentVariable("FIN_SIGHT_VENV_PATH", [System.EnvironmentVariableTarget]::Process)

$PythonPath_Abs = Find-PythonExe -RepoRoot $RepoRoot_Abs -EnvVenvPath $envVenv
if ($PythonPath_Abs) {
    Write-PathTrace "最终选中 Python: $PythonPath_Abs" -Level OK
} else {
    Write-PathTrace "未找到任何可用 Python 解释器!" -Level ERR
}

# 其余路径常量（在此处定义，确保不影响函数作用域）
$ScriptsDir_Abs    = Join-Path $RepoRoot_Abs "scripts"
$BackendDir_Abs    = Join-Path $RepoRoot_Abs "backend"
$EmbeddingEnv_Abs  = Join-Path $ScriptsDir_Abs "embedding.env"
$ChaosTestPy_Abs   = Join-Path $ScriptsDir_Abs "chaos-test.py"
Write-PathTrace "ScriptsDir_Abs   = $ScriptsDir_Abs (exists=$(Test-Path $ScriptsDir_Abs))"
Write-PathTrace "BackendDir_Abs   = $BackendDir_Abs (exists=$(Test-Path $BackendDir_Abs))"
Write-PathTrace "EmbeddingEnv_Abs = $EmbeddingEnv_Abs (exists=$(Test-Path $EmbeddingEnv_Abs))"
Write-PathTrace "ChaosTestPy_Abs  = $ChaosTestPy_Abs (exists=$(Test-Path $ChaosTestPy_Abs))"
Write-PathTrace "=== 路径探测结束 ==="

# 同时给缺失 python 场景的提示信息准备候选路径
$HintCand_1 = Join-Path $RepoRoot_Abs ".venv\Scripts\python.exe"
$HintCand_2 = Join-Path $RepoRoot_Abs "venv\Scripts\python.exe"

# ====== 初始化计数器 ======
$script:pass = 0
$script:fail = 0
$script:skip = 0

function Check($name, $result, $isSkip=$false) {
    if ($isSkip) {
        Write-Host "[SKIP] $name"
        $script:skip++
        return
    }
    if ($result) {
        Write-Host "[PASS] $name"
        $script:pass++
    } else {
        Write-Host "[FAIL] $name"
        $script:fail++
    }
}

Write-Host "============================================="
Write-Host "  FinSightV9 Windows 部署验证"
Write-Host "============================================="
Write-Host ("项目根: " + $RepoRoot_Abs)
Write-Host ("脚本目: " + $ScriptDir_Abs)
Write-Host ("Python : " + $PythonPath_Abs)
Write-Host ""

# 1. Python & venv
Write-Host "--- 1. 环境前置检查 ---"
if ([string]::IsNullOrEmpty($PythonPath_Abs) -or -not (Test-Path $PythonPath_Abs)) {
    Write-Host ("       (候选: " + $HintCand_1 + ", " + $HintCand_2 + " 或系统 python)")
    Check "Python 解释器存在" $false
    Check "Python 版本" $false $true
    Check "venv 依赖完整" $false $true
    Check "PyTorch 可用"  $false $true
} else {
    Check "Python 解释器存在" $true
    $pyVer = & $PythonPath_Abs --version 2>&1
    Check "Python 版本" ($pyVer -match "3\.\d+")
    Write-Host ("       (" + $pyVer + ")")

    $depCheck = & $PythonPath_Abs -c "import torch,uvicorn,fastapi,requests; print('OK')" 2>&1
    Check "venv 依赖完整" ($depCheck -eq "OK")

    $torchInfo = & $PythonPath_Abs -c "import torch; print(str(torch.__version__)+' CUDA='+str(torch.cuda.is_available()))" 2>&1
    Check "PyTorch 可用" ($torchInfo -match "2\.\d+\.\d+")
    Write-Host ("       (" + $torchInfo + ")")
}

$policy = Get-ExecutionPolicy
Check "PowerShell 执行策略" ($policy -in @("RemoteSigned","Bypass","Unrestricted"))
Write-Host ("       (" + $policy + ")")

# 2. 配置文件
Write-Host ""
Write-Host "--- 2. 配置文件验证 ---"
$linuxPaths = 0
if (Test-Path $EmbeddingEnv_Abs) {
    $linuxPaths = (Select-String -Path $EmbeddingEnv_Abs -Pattern "/opt/|/etc/|/var/" -ErrorAction SilentlyContinue | Measure-Object).Count
}
Check "embedding.env 无 Linux 路径" ($linuxPaths -eq 0)

# .sh whitelist: husky pre-commit hooks + CI workflows simulation scripts
# These .sh must run in Git Bash (sh compatible env), core components of pre-commit hook
$shWhitelist = @(
    "audit-commit-scope.sh",
    "audit-gitignore-coverage.sh",
    "simulate-pre-push-blocking.sh"
)
$allShFiles = Get-ChildItem $ScriptsDir_Abs -Filter "*.sh" -Recurse -ErrorAction SilentlyContinue
$shResidual = @()
foreach ($f in $allShFiles) {
    if ($shWhitelist -notcontains $f.Name) {
        $shResidual += $f.FullName
    }
}
Check "scripts/ no .sh residual (whitelist: $($shWhitelist.Count) husky/CI hooks)" ($shResidual.Count -eq 0)
if ($shResidual.Count -gt 0) {
    Write-Host "       residual .sh files:" -ForegroundColor Red
    $shResidual | ForEach-Object { Write-Host ("         " + $_) -ForegroundColor Red }
}

$svcFiles = (Get-ChildItem $ScriptsDir_Abs -Filter "*.service" -Recurse -ErrorAction SilentlyContinue | Measure-Object).Count
Check "scripts/ 无 .service 残留" ($svcFiles -eq 0)

$dockerFiles = (Get-ChildItem $BackendDir_Abs -Filter "Dockerfile*" -Recurse -ErrorAction SilentlyContinue | Measure-Object).Count
Check "backend/ 无 Dockerfile 残留" ($dockerFiles -eq 0)

$envContent = @()
if (Test-Path $EmbeddingEnv_Abs) {
    $envContent = Get-Content $EmbeddingEnv_Abs -ErrorAction SilentlyContinue
}
$hasDaemon  = ($envContent | Select-String "EMBEDDING_USE_DAEMON=true").Count -gt 0
$hasLru     = ($envContent | Select-String "EMBEDDING_USE_LRU=true").Count -gt 0
# HF_HOME 支持任意盘符 [A-Za-z]:\ 绝对路径
$hasWinPath = ($envContent | Select-String "HF_HOME=[A-Za-z]:\\").Count -gt 0
Check "关键配置项正确 (daemon+LRU+Win路径)" ($hasDaemon -and $hasLru -and $hasWinPath)

# 3. 服务健康
Write-Host ""
Write-Host "--- 3. 服务健康检查 ---"
$svcOk = $false
$dmnOk = $false
try {
    $h = Invoke-RestMethod -Uri "http://127.0.0.1:8001/api/embed/health" -TimeoutSec 5
    $svcOk = ($h.status -eq "ok")
    Write-Host ("       backend=" + $h.backend + " daemon_enabled=" + $h.daemon_enabled + " circuit=" + $h.circuit_state)
} catch {
    $msg = $_.Exception.Message
    if ($msg.Length -gt 60) { $msg = $msg.Substring(0, 60) }
    Write-Host ("       Service 不可达: " + $msg)
}
Check "Service 在线" $svcOk

try {
    $d = Invoke-RestMethod -Uri "http://127.0.0.1:8765/daemon/health" -TimeoutSec 5
    $dmnOk = ($d.status -eq "ok")
    Write-Host ("       model=" + $d.model_id + " dim=" + $d.dimension + " fp16=" + $d.fp16)
} catch {
    $msg = $_.Exception.Message
    if ($msg.Length -gt 60) { $msg = $msg.Substring(0, 60) }
    Write-Host ("       Daemon 不可达: " + $msg)
}
Check "Daemon 在线" $dmnOk

# 4. 功能测试
Write-Host ""
Write-Host "--- 4. 功能测试 ---"
$embedOk = $false
try {
    $body = @{texts=@("Windows 部署验证")} | ConvertTo-Json
    $r = Invoke-RestMethod -Uri "http://127.0.0.1:8001/api/embed" -Method Post -Body $body -ContentType "application/json" -TimeoutSec 30
    $embedOk = ($r.dimension -eq 1024)
    Write-Host ("       dim=" + $r.dimension + " elapsed=" + $r.elapsed_ms + "ms")
} catch {
    $msg = $_.Exception.Message
    if ($msg.Length -gt 60) { $msg = $msg.Substring(0, 60) }
    Write-Host ("       请求失败: " + $msg)
}
Check "Embedding 功能" $embedOk

$lruOk = $false
if ($embedOk) {
    try {
        $r2 = Invoke-RestMethod -Uri "http://127.0.0.1:8001/api/embed" -Method Post -Body $body -ContentType "application/json" -TimeoutSec 10
        $lruOk = ($r2.elapsed_ms -lt 5)
        Write-Host ("       第二次 elapsed=" + $r2.elapsed_ms + "ms lru_hit=" + $r2.lru_hit)
    } catch {
        Write-Host "       LRU 测试失败"
    }
}
Check "LRU 缓存命中" $lruOk

# 5. 无 Linux 调用
Write-Host ""
Write-Host "--- 5. Windows 兼容性 ---"
$scriptPatterns = @(
    (Join-Path $ScriptsDir_Abs "*.py"),
    (Join-Path $ScriptsDir_Abs "*.ps1")
)
$linuxCalls = (Select-String -Path $scriptPatterns -Pattern "systemctl|iptables|pgrep|killall|/proc/" -ErrorAction SilentlyContinue | Where-Object { $_.Filename -ne "windows-deploy-verify.ps1" } | Measure-Object).Count
Check "脚本无 Linux 系统调用" ($linuxCalls -eq 0)

$bashCalls = (Select-String -Path (Join-Path $ScriptsDir_Abs "*.py") -Pattern "subprocess.*bash|os\.system.*bash|subprocess.*\.sh" -ErrorAction SilentlyContinue | Measure-Object).Count
Check "无 bash/sh 调用" ($bashCalls -eq 0)

# 6. 进程查找验证
Write-Host ""
Write-Host "--- 6. 进程管理 ---"
$procOk = $false
if ([string]::IsNullOrEmpty($PythonPath_Abs) -or -not (Test-Path $PythonPath_Abs)) {
    Write-Host "       跳过：Python 解释器不可用"
    Check "wmic 进程查找" $false $true
} elseif (-not (Test-Path $ChaosTestPy_Abs)) {
    Write-Host ("       跳过：chaos-test.py 不存在 (" + $ChaosTestPy_Abs + ")")
    Check "wmic 进程查找" $false $true
} else {
    try {
        # 通过命令行参数传递 chaos-test.py 路径 (避免环境变量在子进程中丢失)
        $pyCmd = "import sys,importlib.util; _p=sys.argv[1]; spec=importlib.util.spec_from_file_location('chaos_test', _p); mod=importlib.util.module_from_spec(spec); spec.loader.exec_module(mod); print('PIDs=' + str(mod.find_process('embedding_daemon')))"
        $procResult = & $PythonPath_Abs -c $pyCmd $ChaosTestPy_Abs 2>&1
        Write-Host ("       " + $procResult)
        $procOk = $procResult -match "PIDs=\[\d+"
    } catch {
        $msg = $_.Exception.Message
        if ($msg.Length -gt 80) { $msg = $msg.Substring(0, 80) }
        Write-Host ("       进程查找失败: " + $msg)
    }
    Check "wmic 进程查找" $procOk
}

# 汇总
Write-Host ""
Write-Host "============================================="
Write-Host ("  PASS: " + $script:pass + "  FAIL: " + $script:fail + "  SKIP: " + $script:skip)
$total = $script:pass + $script:fail + $script:skip
Write-Host ("  TOTAL: " + $total)
if ($script:fail -eq 0) {
    Write-Host "  结果: 全部通过" -ForegroundColor Green
} elseif ($script:fail -le 2) {
    Write-Host ("  结果: 基本可用 (" + $script:fail + " 项失败)") -ForegroundColor Yellow
} else {
    Write-Host ("  结果: 不可用 (" + $script:fail + " 项失败)") -ForegroundColor Red
}
Write-Host "============================================="
