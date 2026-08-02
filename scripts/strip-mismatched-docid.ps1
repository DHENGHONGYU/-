param(
    [string]$DocsPath = (Join-Path (Split-Path $PSScriptRoot -Parent) 'docs')
)

$ErrorActionPreference = "Stop"

$abbr = @{ architecture="ARCH"; frontend="FRONT"; backend="BACK"; data="DATA"; ai="AI"; qa="QA"; project="PROJ"; product="PROD"; meta="META" }

$docs = Get-ChildItem -Path $DocsPath -Recurse -Include "*.md" -File |
    Where-Object { $_.FullName -notmatch "\\archive\\" -and $_.FullName -notmatch "\\ai-index\\" }

$stripped = 0
foreach ($doc in $docs) {
    $content = Get-Content $doc.FullName -Raw -Encoding UTF8
    if (-not $content) { continue }
    if ($content -notmatch '(?s)^---\s*\r?\n(.*?)\r?\n---') { continue }
    $fm = $matches[1]
    $d = ""; $id = ""
    if ($fm -match '(?m)^domain\s*:\s*(.+)$') { $d = $matches[1].Trim() }
    if ($fm -match '(?m)^doc_id\s*:\s*(.+)$') { $id = $matches[1].Trim() }
    if (-not $id -or -not $d -or -not $abbr[$d]) { continue }
    if ($id -match "-$($abbr[$d])-") { continue }

    # remove the doc_id line
    $newFm = ($fm -split "`n" | Where-Object { $_ -notmatch '^doc_id\s*:' }) -join "`n"
    $newContent = $content -replace '(?s)^(---\s*\r?\n).*?(\r?\n---)', ('$1' + $newFm + '$2')
    Set-Content -Path $doc.FullName -Value $newContent -Encoding UTF8 -NoNewline
    $stripped++
}

Write-Host "Stripped mismatched doc_id: $stripped"
