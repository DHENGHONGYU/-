param(
    [string]$DocsPath = (Join-Path (Split-Path $PSScriptRoot -Parent) 'docs'),
    [switch]$Apply = $false
)

$ErrorActionPreference = "Stop"

# phase inference rules (path + filename + title, lowercase)
function Infer-Phase($relPath, $fileName, $title) {
    $p = "$relPath/$fileName".ToLower()
    $t = if ($title) { $title.ToLower() } else { "" }
    $all = "$p $t"

    if ($all -match 'retro|lesson|post-dev|postmortem|completion|acceptance') { return "retrospective" }
    if ($all -match 'changelog|update-log|change-log') { return "retrospective" }
    if ($all -match 'roadmap|vision|goal|planning') { return "planning" }
    if ($all -match 'requirement|prd|persona|scenario|user-story') { return "requirements" }
    if ($all -match 'test|qa/|audit|checklist|verification|regression|security-test') { return "testing" }
    if ($all -match 'deploy|release|ops/|runbook') { return "deployment" }
    if ($all -match 'design|architecture|blueprint|adr-|spec|token|schema|contract|dictionary|data-definition|protocol|glossary|constitution') { return "design" }
    if ($all -match 'convention|sop|workflow|tracker|action-list|implementation|integration|catalog|migration|remediation|refactor|template|naming') { return "development" }
    if ($all -match 'ifind|imf|scholar|sec_edgar|tianyancha|world_bank|yahoo|yuandian') { return "development" }
    if ($all -match 'review|summary|report') { return "retrospective" }
    if ($all -match 'plan|todo|kanban') { return "planning" }
    if ($all -match 'how-to|guide|getting-started|handbook') { return "development" }
    return $null
}

$docs = Get-ChildItem -Path $DocsPath -Recurse -Include "*.md" -File |
    Where-Object { $_.FullName -notmatch "\\archive\\" -and $_.FullName -notmatch "\\ai-index\\" }

$missing = 0
$canInfer = 0
$noInfer = 0
$applied = 0
$noInferList = @()

foreach ($doc in $docs) {
    $relPath = $doc.FullName.Substring($DocsPath.Length + 1).Replace("\", "/")
    $content = Get-Content $doc.FullName -Raw -Encoding UTF8
    if (-not $content) { continue }
    if ($content -notmatch '(?s)^---\s*\r?\n(.*?)\r?\n---') { continue }

    $fmBlock = $matches[1]
    if ($fmBlock -match '(?m)^phase\s*:') { continue }

    $missing++
    $title = $null
    if ($fmBlock -match '(?m)^title\s*:\s*(.+)$') { $title = $matches[1].Trim() }

    $phase = Infer-Phase $relPath $doc.Name $title
    if ($phase) {
        $canInfer++
        if ($Apply) {
            $newFm = $fmBlock
            if ($fmBlock -match '(?m)^status\s*:.*$') {
                $newFm = $fmBlock -replace '(?m)^(status\s*:.*)$', ('$1' + "`n" + "phase: $phase")
            } elseif ($fmBlock -match '(?m)^domain\s*:.*$') {
                $newFm = $fmBlock -replace '(?m)^(domain\s*:.*)$', ('$1' + "`n" + "phase: $phase")
            } else {
                $newFm = $fmBlock.TrimEnd() + "`nphase: $phase"
            }
            $newContent = $content -replace '(?s)^(---\s*\r?\n).*?(\r?\n---)', ('$1' + $newFm + '$2')
            Set-Content -Path $doc.FullName -Value $newContent -Encoding UTF8 -NoNewline
            $applied++
        }
    } else {
        $noInfer++
        $noInferList += $relPath
    }
}

Write-Host ""
Write-Host "===== Phase Completion Summary =====" -ForegroundColor Yellow
Write-Host "Documents missing phase: $missing"
Write-Host "Can infer: $canInfer"
Write-Host "Cannot infer (need manual): $noInfer"
if ($Apply) { Write-Host "Applied: $applied" -ForegroundColor Green }
if ($noInferList.Count -gt 0 -and $noInferList.Count -le 50) {
    Write-Host ""
    Write-Host "Need manual phase assignment:" -ForegroundColor Yellow
    $noInferList | ForEach-Object { Write-Host "  $_" }
}

