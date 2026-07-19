param(
    [string]$DocsPath = "g:\FinSightV9\docs",
    [switch]$Apply = $false
)

$ErrorActionPreference = "Stop"

# Layer 2: module tag -> keywords
$moduleTags = @{
    "data-definition" = @('data-definition','data-dictionary','dictionary')
    "dataflow"        = @('dataflow','data-flow','data-lineage')
    "databridge"      = @('databridge','data-bridge')
    "contract"        = @('contract')
    "store"           = @('store','zustand')
    "collection"      = @('collection','collector','fetcher')
    "registry"        = @('registry','index')
    "screening"       = @('screening','screener')
    "trading"         = @('trading','trade')
    "strategy"        = @('strategy')
    "cockpit"         = @('cockpit')
    "widget"          = @('widget')
    "component"       = @('component')
    "token"           = @('token','design-token')
    "news"            = @('news')
    "input-cabin"     = @('input-cabin','cabin')
    "mcp"             = @('mcp')
    "agent"           = @('agent')
    "integration"     = @('integration')
    "adr"             = @('adr-','adr_')
    "dual-strategy"   = @('dual-strategy')
    "migration"       = @('migration','migrate')
    "refactor"        = @('refactor')
    "complexity"      = @('complexity')
    "changelog"       = @('changelog','change-log','update-log')
    "scoring"         = @('scoring','score','scoredoc')
    "factor"          = @('factor','multi-factor','seven-dim','7-dim')
    "stocks"          = @('stock-pool','stockpool','asset-pool','portfolio')
    "position"        = @('position','holding','positioncomputer')
    "routing"         = @('routing','route','navigation')
    "validation"      = @('validation','verification','verification')
}

# Layer 3: feature tag -> keywords
$featureTags = @{
    "audit"         = @('audit')
    "quality"       = @('quality')
    "test"          = @('test','e2e','regression')
    "checklist"     = @('checklist')
    "governance"    = @('governance')
    "optimization"  = @('optimization','optimize')
    "fix"           = @('fix','bugfix')
    "remediation"   = @('remediation')
    "cleanup"       = @('cleanup')
    "gap-analysis"  = @('gap-analysis','gap_analysis')
    "completeness"  = @('completeness')
    "workflow"      = @('workflow','sop')
    "jsdoc"         = @('jsdoc')
    "security"      = @('security','vulnerability','penetration')
    "performance"   = @('performance')
    "a11y"          = @('a11y','accessibility','contrast')
    "i18n"          = @('i18n')
    "report"        = @('report','review-report','assessment','体检')
    "guide"         = @('guide','how-to','handbook','tutorial')
    "deprecated"    = @('deprecated','deprecation','obsolete','old-version')
    "plan"          = @('plan','planning','roadmap','action-plan','action-list')
    "spec"          = @('spec','specification','standards','constitution')
    "template"      = @('template','scaffold')
    "research"      = @('research','study','analysis','analytical')
    "batch"         = @('batch','batchA','batchB','batchC','batchD','batchE')
}

$docs = Get-ChildItem -Path $DocsPath -Recurse -Include "*.md" -File |
    Where-Object { $_.FullName -notmatch "\\archive\\" -and $_.FullName -notmatch "\\ai-index\\" }

$tagged = 0
$skipped = 0
$applied = 0
$samples = @()

foreach ($doc in $docs) {
    $content = Get-Content $doc.FullName -Raw -Encoding UTF8
    if (-not $content) { continue }
    if ($content -notmatch '(?s)^---\s*\r?\n(.*?)\r?\n---') { continue }
    $fm = $matches[1]
    if ($fm -match '(?m)^tags\s*:') { continue }

    $domain = "project"
    $title = ""
    if ($fm -match '(?m)^domain\s*:\s*(.+)$') { $domain = $matches[1].Trim() }
    if ($fm -match '(?m)^title\s*:\s*(.+)$') { $title = $matches[1].Trim() }

    $base = [System.IO.Path]::GetFileNameWithoutExtension($doc.Name).ToLower()
    $relPath = $doc.FullName.Substring($DocsPath.Length + 1).Replace("\", "/").ToLower()
    $text = "$base $($title.ToLower()) $relPath"

    $tags = @($domain)

    foreach ($t in $moduleTags.Keys) {
        foreach ($kw in $moduleTags[$t]) {
            if ($text.Contains($kw)) { if ($tags -notcontains $t) { $tags += $t }; break }
        }
    }
    foreach ($t in $featureTags.Keys) {
        foreach ($kw in $featureTags[$t]) {
            if ($text.Contains($kw)) { if ($tags -notcontains $t) { $tags += $t }; break }
        }
    }

    # enforce 2-5 tags; skip if only domain
    if ($tags.Count -lt 2) { $skipped++; continue }
    if ($tags.Count -gt 5) { $tags = $tags[0..4] }

    $tagged++
    $rel = $doc.FullName.Substring($DocsPath.Length + 1).Replace("\", "/")
    if ($samples.Count -lt 20) { $samples += [PSCustomObject]@{ Path = $rel; Tags = ($tags -join ", ") } }

    if ($Apply) {
        $tagStr = "[" + ($tags -join ", ") + "]"
        $newFm = $fm
        if ($fm -match '(?m)^summary\s*:.*$') {
            $newFm = $fm -replace '(?m)^(summary\s*:.*)$', ('$1' + "`n" + "tags: $tagStr")
        } elseif ($fm -match '(?m)^maintainer\s*:.*$') {
            $newFm = $fm -replace '(?m)^(maintainer\s*:.*)$', ('$1' + "`n" + "tags: $tagStr")
        } else {
            $newFm = $fm.TrimEnd() + "`ntags: $tagStr"
        }
        $newContent = $content -replace '(?s)^(---\s*\r?\n).*?(\r?\n---)', ('$1' + $newFm + '$2')
        Set-Content -Path $doc.FullName -Value $newContent -Encoding UTF8 -NoNewline
        $applied++
    }
}

Write-Host "===== Tag Suggestion =====" -ForegroundColor Yellow
Write-Host "Tagged: $tagged"
Write-Host "Skipped (no module/feature keyword): $skipped"
if ($Apply) { Write-Host "Applied: $applied" -ForegroundColor Green }
Write-Host ""
Write-Host "=== Samples ===" -ForegroundColor Yellow
$samples | ForEach-Object { Write-Host "  $($_.Path)"; Write-Host "     -> $($_.Tags)" }
