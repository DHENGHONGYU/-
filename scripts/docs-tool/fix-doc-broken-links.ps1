param(
    [Parameter(Mandatory=$true)]
    [string]$DocPath,
    [switch]$DryRun = $false
)

$ErrorActionPreference = "Stop"
$PROJECT_ROOT = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$DOCS_DIR = Join-Path $PROJECT_ROOT "docs"

if (-not (Test-Path $DocPath)) {
    Write-Error "文件不存在: $DocPath"
    exit 1
}

$DocPath = Resolve-Path $DocPath
$DocDir = Split-Path $DocPath -Parent
$content = Get-Content $DocPath -Raw -Encoding UTF8
$originalContent = $content

$changes = @()

function Resolve-RelativePath {
    param([string]$BaseDir, [string]$RelPath)
    try {
        $combined = Join-Path $BaseDir $RelPath
        return [System.IO.Path]::GetFullPath($combined)
    } catch {
        return $null
    }
}

function Make-RelativePath {
    param([string]$BaseDir, [string]$TargetPath)
    try {
        $baseUri = New-Object System.Uri($BaseDir.TrimEnd('\') + '\')
        $targetUri = New-Object System.Uri($TargetPath)
        $rel = $baseUri.MakeRelativeUri($targetUri).ToString()
        return $rel -replace '/', '\'
    } catch {
        return $TargetPath
    }
}

function Find-FileInDocs {
    param([string]$FileName)
    $results = Get-ChildItem -Path $DOCS_DIR -Recurse -Filter $FileName -File -ErrorAction SilentlyContinue
    if (-not $results) { return @() }
    return @($results.FullName)
}

function Repair-Target {
    param([string]$Target)
    if ($Target -match '^(https?:|#|mailto:|ftp:)' -or $Target -match '^<') {
        return @{ Target = $Target; Changed = $false; Reason = "skip-external" }
    }
    if ($Target -match '\.(png|jpg|jpeg|gif|svg|json|csv|html|css|js|ts|tsx|py|mmd|mermaid|cjs)$') {
        return @{ Target = $Target; Changed = $false; Reason = "skip-nonmd" }
    }
    if ($Target -notmatch '\.md(\)?|$)') {
        return @{ Target = $Target; Changed = $false; Reason = "skip-nonmd-2" }
    }
    $cleanTarget = $Target -replace '[#?].*$', ''
    if ([string]::IsNullOrWhiteSpace($cleanTarget)) {
        return @{ Target = $Target; Changed = $false; Reason = "empty" }
    }
    $absPath = Resolve-RelativePath -BaseDir $DocDir -RelPath $cleanTarget
    if ($absPath -and (Test-Path $absPath)) {
        return @{ Target = $Target; Changed = $false; Reason = "valid" }
    }
    $fileName = Split-Path $cleanTarget -Leaf
    if (-not $fileName) {
        return @{ Target = $Target; Changed = $false; Reason = "no-filename" }
    }
    [string[]]$foundFiles = @(Find-FileInDocs -FileName $fileName)
    if ($foundFiles.Length -eq 1) {
        $resolvedPath = $foundFiles[0]
        if ($resolvedPath.Length -lt 5) {
            return @{ Target = "<已归档>"; Changed = $true; Reason = "archived:short-path-error" }
        }
        $newRel = Make-RelativePath -BaseDir $DocDir -TargetPath $resolvedPath
        if ($newRel.Length -lt 3 -or $newRel -match '^[A-Z]$') {
            return @{ Target = "<已归档>"; Changed = $true; Reason = "archived:relpath-error:$fileName" }
        }
        $newRel = $newRel -replace '\\', '/'
        $suffix = $Target.Substring($cleanTarget.Length)
        $newTarget = "$newRel$suffix"
        return @{ Target = $newTarget; Changed = $true; Reason = "found:$fileName -> $newRel" }
    }
    if ($foundFiles.Length -gt 1) {
        $prefixParts = $cleanTarget -split '[\\/]'
        $bestMatch = $null
        $bestScore = -1
        foreach ($m in $foundFiles) {
            $rel = Make-RelativePath -BaseDir $DocDir -TargetPath $m
            if ($rel -match '^[A-Z]$') { continue }
            $mParts = $rel -split '[\\/]'
            $score = 0
            for ($i = 0; $i -lt [Math]::Min($prefixParts.Length, $mParts.Length); $i++) {
                if ($prefixParts[$prefixParts.Length - 1 - $i] -eq $mParts[$mParts.Length - 1 - $i]) { $score++ }
            }
            if ($score -gt $bestScore) { $bestScore = $score; $bestMatch = $m }
        }
        if ($bestMatch) {
            $newRel = Make-RelativePath -BaseDir $DocDir -TargetPath $bestMatch
            if ($newRel.Length -lt 3 -or $newRel -match '^[A-Z]$') {
                return @{ Target = "<已归档>"; Changed = $true; Reason = "archived:relpath-error-best:$fileName" }
            }
            $newRel = $newRel -replace '\\', '/'
            $suffix = $Target.Substring($cleanTarget.Length)
            $newTarget = "$newRel$suffix"
            return @{ Target = $newTarget; Changed = $true; Reason = "best-match($bestScore):$fileName -> $newRel" }
        }
    }
    return @{ Target = "<已归档>"; Changed = $true; Reason = "archived:$fileName" }
}

$mdLinkPattern = '\[([^\]]*)\]\(([^)]+)\)'
$content = [regex]::Replace($content, $mdLinkPattern, {
    param($m)
    $text = $m.Groups[1].Value
    $target = $m.Groups[2].Value
    if ($target -eq '<已归档>') { return $m.Value }
    $result = Repair-Target -Target $target
    if ($result.Changed) {
        $script:changes += "LINK: [$text]($target) => [$text]($($result.Target)) [$($result.Reason)]"
    }
    return "[$text]($($result.Target))"
})

$btPattern = '`([^`\r\n]*?\.\.?/[^`\r\n]*?\.md[^`\r\n]*?)`'
$content = [regex]::Replace($content, $btPattern, {
    param($m)
    $inner = $m.Groups[1].Value
    if ($inner -match '^(https?:|<已归档>)') { return $m.Value }
    $result = Repair-Target -Target $inner
    if ($result.Changed) {
        $script:changes += "BT: ``$inner`` => ``$($result.Target)`` [$($result.Reason)]"
    }
    return "``$($result.Target)``"
})

$changedCount = $changes.Count
if ($changedCount -gt 0 -and -not $DryRun) {
    Set-Content -Path $DocPath -Value $content -Encoding UTF8 -NoNewline
}

Write-Host ""
Write-Host "=== 处理报告: $DocPath ==="
Write-Host "修复/标记数: $changedCount"
foreach ($c in $changes) { Write-Host "  - $c" }
Write-Host "内容变更: $($content -ne $originalContent)"
return @{ Path = $DocPath; FixedCount = $changedCount; Changes = $changes }
