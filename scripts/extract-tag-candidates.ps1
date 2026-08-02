param(
    [string]$DocsPath = (Join-Path (Split-Path $PSScriptRoot -Parent) 'docs'),
    [int]$MinFreq = 5
)

$ErrorActionPreference = "Stop"

$stopWords = @(
    'the','and','for','with','from','into','that','this','v9','v6','md',
    'doc','docs','document','documentation','report','plan','guide','readme',
    'index','summary','final','new','old','batch','merge','deprecated'
)

$docs = Get-ChildItem -Path $DocsPath -Recurse -Include "*.md" -File |
    Where-Object { $_.FullName -notmatch "\\archive\\" -and $_.FullName -notmatch "\\ai-index\\" }

$wordCount = @{}
$pathWords = @{}

foreach ($doc in $docs) {
    $relPath = $doc.FullName.Substring($DocsPath.Length + 1).Replace("\", "/")

    # filename tokens
    $base = [System.IO.Path]::GetFileNameWithoutExtension($doc.Name).ToLower()
    $tokens = $base -split '[-_\s]+' | Where-Object {
        $_.Length -ge 3 -and $stopWords -notcontains $_ -and $_ -match '^[a-z0-9]+$'
    }
    # path directory tokens (meaningful module names)
    $dirs = ($relPath -split '/')[0..($relPath.Split('/').Count - 2)] | ForEach-Object { $_.ToLower() }

    $seen = @{}
    foreach ($t in $tokens) {
        if (-not $seen.ContainsKey($t)) {
            $wordCount[$t] = ($wordCount[$t] + 1)
            $seen[$t] = $true
        }
    }
    foreach ($d in $dirs) {
        if ($d -match '^[a-z0-9-]+$' -and $stopWords -notcontains $d -and $d.Length -ge 3) {
            $pathWords[$d] = ($pathWords[$d] + 1)
        }
    }
}

Write-Host "===== High-frequency filename tokens (>= $MinFreq docs) =====" -ForegroundColor Yellow
$wordCount.GetEnumerator() | Where-Object { $_.Value -ge $MinFreq } |
    Sort-Object Value -Descending | Select-Object -First 60 |
    ForEach-Object { "{0,-25} {1}" -f $_.Key, $_.Value }

Write-Host ""
Write-Host "===== Directory tokens =====" -ForegroundColor Yellow
$pathWords.GetEnumerator() | Sort-Object Value -Descending |
    ForEach-Object { "{0,-25} {1}" -f $_.Key, $_.Value }

