param(
    [string]$DocsPath = (Join-Path (Split-Path $PSScriptRoot -Parent) 'docs'),
    [switch]$Apply = $false
)

$ErrorActionPreference = "Stop"

# targeted rules for remaining 31 zero-tag docs
$rules = @(
    @{ Pattern = 'readme\.md$'; Tags = @('index', 'documentation') }
    @{ Pattern = 'user-personas'; Tags = @('product') }
    @{ Pattern = 'adr/README'; Tags = @('adr') }
    @{ Pattern = 'data-interaction-protocols'; Tags = @('contract') }
    @{ Pattern = 'file-naming-conventions'; Tags = @('spec', 'standards') }
    @{ Pattern = 'doc-trigger-action-map'; Tags = @('workflow') }
    @{ Pattern = 'prompt-merge-dedup'; Tags = @('cleanup') }
    @{ Pattern = 'data-layer-overview'; Tags = @('data') }
    @{ Pattern = 'deployment'; Tags = @('release') }
    @{ Pattern = 'publish-ready'; Tags = @('release', 'checklist') }
    @{ Pattern = '01-vision-and-goals'; Tags = @('product') }
    @{ Pattern = '10-glossary'; Tags = @('data-definition') }
    @{ Pattern = 'ai-memory-layer'; Tags = @('ai') }
    @{ Pattern = 'data_link_sequence'; Tags = @('dataflow') }
    @{ Pattern = 'v9-data-timeline'; Tags = @('data') }
    @{ Pattern = '(ifind|imf|scholar|sec_edgar|tianyancha|yahoo_finance|world_bank_open_data|yuandian_law)'; Tags = @('integration') }
)

$docs = Get-ChildItem -Path $DocsPath -Recurse -Include "*.md" -File |
    Where-Object { $_.FullName -notmatch "\\archive\\" -and $_.FullName -notmatch "\\ai-index\\" }

$fixed = 0
foreach ($doc in $docs) {
    $content = Get-Content $doc.FullName -Raw -Encoding UTF8
    if (-not $content) { continue }
    if ($content -notmatch '(?s)^---\s*\r?\n(.*?)\r?\n---') { continue }
    $fm = $matches[1]
    if ($fm -match '(?m)^tags\s*:') { continue }

    $rel = $doc.FullName.Substring($DocsPath.Length + 1).Replace("\", "/").ToLower()
    $domain = "project"
    if ($fm -match '(?m)^domain\s*:\s*(.+)$') { $domain = $matches[1].Trim() }

    $newTags = @($domain)
    foreach ($rule in $rules) {
        if ($rel -match $rule.Pattern) {
            foreach ($t in $rule.Tags) { if ($newTags -notcontains $t) { $newTags += $t } }
        }
    }
    if ($newTags.Count -lt 2) { continue }
    if ($newTags.Count -gt 5) { $newTags = $newTags[0..4] }

    $tagStr = "[" + ($newTags -join ", ") + "]"
    $newFm = $fm
    if ($fm -match '(?m)^maintainer\s*:.*$') {
        $newFm = $fm -replace '(?m)^(maintainer\s*:.*)$', "`$1`ntags: $tagStr"
    } else {
        $newFm = $fm.TrimEnd() + "`ntags: $tagStr"
    }
    $newContent = $content -replace '(?s)^(---\s*\r?\n).*?(\r?\n---)', ('$1' + $newFm + '$2')

    if ($Apply) {
        [System.IO.File]::WriteAllText($doc.FullName, $newContent, (New-Object System.Text.UTF8Encoding $false))
    }
    $fixed++
    Write-Host "  $($doc.FullName.Substring($DocsPath.Length+1)) -> $tagStr"
}

Write-Host ""
Write-Host "Fixed: $fixed"

