param(
    [string]$DocsPath = "g:\FinSightV9\docs",
    [int]$TopN = 50
)

$ErrorActionPreference = "Stop"

$existingKeywords = @(
    'data-definition','data-dictionary','dictionary','dataflow','data-flow','data-lineage',
    'databridge','data-bridge','contract','store','zustand','collection','collector',
    'fetcher','registry','index','screening','screener','trading','trade','strategy',
    'cockpit','widget','component','token','design-token','news','input-cabin','cabin',
    'mcp','agent','integration','adr-','adr_','dual-strategy','migration','migrate',
    'refactor','complexity','audit','quality','test','e2e','regression','checklist',
    'governance','optimization','optimize','fix','bugfix','remediation','cleanup',
    'gap-analysis','gap_analysis','completeness','workflow','sop','jsdoc','security',
    'vulnerability','penetration','performance','a11y','accessibility','contrast','i18n'
)

$docs = Get-ChildItem -Path $DocsPath -Recurse -Include "*.md" -File |
    Where-Object { $_.FullName -notmatch "\\archive\\" -and $_.FullName -notmatch "\\ai-index\\" }

$untagged = @()
foreach ($doc in $docs) {
    $content = Get-Content $doc.FullName -Raw -Encoding UTF8
    if (-not $content) { continue }
    if ($content -notmatch '(?s)^---\s*\r?\n(.*?)\r?\n---') { continue }
    $fm = $matches[1]
    if ($fm -match '(?m)^tags\s*:') { continue }

    $base = [System.IO.Path]::GetFileNameWithoutExtension($doc.Name).ToLower()
    $title = ""
    if ($fm -match '(?m)^title\s*:\s*(.+)$') { $title = $matches[1].Trim().ToLower() }
    $untagged += @{ Path = $doc.FullName.Substring($DocsPath.Length + 1).Replace("\", "/"); Base = $base; Title = $title }
}

Write-Host "Untagged docs: $($untagged.Count)"

# tokenize filenames (split by non-alpha) and count frequency, excluding existing keywords
$tokenFreq = @{}
foreach ($u in $untagged) {
    $tokens = ($u.Base -split '[^a-z0-9]+') | Where-Object { $_.Length -ge 3 }
    foreach ($t in $tokens) {
        if ($existingKeywords -contains $t) { continue }
        if ($t -match '^\d+$') { continue }
        $tokenFreq[$t] = ($tokenFreq[$t] + 1)
    }
}

Write-Host ""
Write-Host "=== Top $TopN filename tokens (untagged) ===" -ForegroundColor Yellow
$tokenFreq.GetEnumerator() | Sort-Object Value -Descending | Select-Object -First $TopN | ForEach-Object {
    "{0,-25} {1}" -f $_.Key, $_.Value
}

# by directory
Write-Host ""
Write-Host "=== Untagged by top directory ===" -ForegroundColor Yellow
$untagged | ForEach-Object { ($_.Path -split '/')[0] } | Group-Object | Sort-Object Count -Descending | ForEach-Object {
    "{0,-25} {1}" -f $_.Name, $_.Count
}
