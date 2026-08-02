param(
    [string]$DocsPath = (Join-Path (Split-Path $PSScriptRoot -Parent) 'docs'),
    [switch]$Apply = $false
)

$ErrorActionPreference = "Stop"

function Infer-Phase2($relPath, $fileName) {
    $p = "$relPath/$fileName".ToLower()
    # meta governance/planning
    if ($p -match '00-meta.*(governance|plan|schedule|standard|classification|system|framework|checklist)') { return "planning" }
    if ($p -match '00-meta.*(report|assessment|review|summary)') { return "retrospective" }
    # reference design
    if ($p -match 'reference.*(data-|data_|dictionary|schema|protocol|governance|architecture|strategy|model|timeline)') { return "design" }
    if ($p -match 'reference.*(ui|cockpit|widget|design|token|spacing|layout|color|visual)') { return "design" }
    if ($p -match 'reference.*(quality-gate|gate|operation|security|vulnerability)') { return "design" }
    # development
    if ($p -match 'reference.*(remediation|tracker|action-list|workflow|sop|convention|pitfall|guide|handbook|error-handling|collection-task)') { return "development" }
    if ($p -match 'reference.*(deprecated|deprecation)') { return "retrospective" }
    if ($p -match 'drafts/|modules/|prompts/|ai/') { return "development" }
    if ($p -match 'assets/') { return "development" }
    if ($p -match 'standards/') { return "design" }
    return $null
}

$docs = Get-ChildItem -Path $DocsPath -Recurse -Include "*.md" -File |
    Where-Object { $_.FullName -notmatch "\\archive\\" -and $_.FullName -notmatch "\\ai-index\\" }

$infer=0; $manual=0; $applied=0; $manualList=@()

foreach ($doc in $docs) {
    $relPath = $doc.FullName.Substring($DocsPath.Length + 1).Replace("\", "/")
    $content = Get-Content $doc.FullName -Raw -Encoding UTF8
    if (-not $content) { continue }
    if ($content -notmatch '(?s)^---\s*\r?\n(.*?)\r?\n---') { continue }
    $fm = $matches[1]
    if ($fm -match '(?m)^phase\s*:') { continue }

    $phase = Infer-Phase2 $relPath $doc.Name
    if ($phase) {
        $infer++
        if ($Apply) {
            $newFm = $fm
            if ($fm -match '(?m)^status\s*:.*$') {
                $newFm = $fm -replace '(?m)^(status\s*:.*)$', ('$1' + "`n" + "phase: $phase")
            } elseif ($fm -match '(?m)^domain\s*:.*$') {
                $newFm = $fm -replace '(?m)^(domain\s*:.*)$', ('$1' + "`n" + "phase: $phase")
            } else {
                $newFm = $fm.TrimEnd() + "`nphase: $phase"
            }
            $newContent = $content -replace '(?s)^(---\s*\r?\n).*?(\r?\n---)', ('$1' + $newFm + '$2')
            Set-Content -Path $doc.FullName -Value $newContent -Encoding UTF8 -NoNewline
            $applied++
        }
    } else {
        $manual++
        $manualList += $relPath
    }
}

Write-Host "===== Phase Batch 2 Summary =====" -ForegroundColor Yellow
Write-Host "Can infer: $infer"
Write-Host "Cannot infer: $manual"
if ($Apply) { Write-Host "Applied: $applied" -ForegroundColor Green }
if ($manualList.Count -le 60) {
    Write-Host ""
    Write-Host "Remaining manual:" -ForegroundColor Yellow
    $manualList | ForEach-Object { Write-Host "  $_" }
}

