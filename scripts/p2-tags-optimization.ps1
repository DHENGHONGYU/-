param(
    [string]$DocsPath = (Join-Path (Split-Path $PSScriptRoot -Parent) 'docs')
)
$ErrorActionPreference = "Stop"

function Get-Frontmatter($path) {
    $content = Get-Content $path -Raw -Encoding UTF8
    if ($content -match '(?s)^---\s*\r?\n(.*?)\r?\n---') {
        $fmText = $matches[1]
        $result = @{}
        foreach ($line in ($fmText -split "`r?`n")) {
            if ($line -match '^([a-z_]+)\s*:\s*(.*)$') {
                $key = $matches[1].Trim()
                $val = $matches[2].Trim()
                if ($val -match '^\[(.*)\]$') {
                    $arr = ($matches[1] -split ',' | ForEach-Object { $_.Trim() }) | Where-Object { $_ }
                    $result[$key] = $arr
                } else {
                    $result[$key] = $val -replace '^"', '' -replace '"$', ''
                }
            }
        }
        return $result
    }
    return $null
}

function Set-FrontmatterTags($path, $tags) {
    $content = Get-Content $path -Raw -Encoding UTF8
    if ($content -match '(?s)^---\s*\r?\n(.*?)\r?\n---') {
        $fmText = $matches[1]
        $fmLines = $fmText -split "`r?`n"
        $newFmLines = @()
        $tagsFound = $false
        foreach ($line in $fmLines) {
            if ($line -match '^tags\s*:') {
                $tagsStr = $tags -join ', '
                $newFmLines += "tags: [$tagsStr]"
                $tagsFound = $true
            } else {
                $newFmLines += $line
            }
        }
        if (-not $tagsFound) {
            $tagsStr = $tags -join ', '
            $newFmLines += "tags: [$tagsStr]"
        }
        $newFm = $newFmLines -join "`n"
        $newContent = $content -replace '(?s)^---\s*\r?\n.*?\r?\n---', "---`n$newFm`n---"
        Set-Content -Path $path -Value $newContent -Encoding UTF8 -NoNewline
        return $true
    }
    return $false
}

function Infer-Tags($relPath, $fm, $fileContent) {
    $tags = @()
    $lowerPath = $relPath.ToLower()
    $lowerName = [System.IO.Path]::GetFileNameWithoutExtension($relPath).ToLower()
    $lowerContent = if ($fileContent) { $fileContent.ToLower() } else { "" }

    $tagRules = @(
        @{ Pattern = '00-meta'; Tags = @('meta', 'documentation') },
        @{ Pattern = '01-product'; Tags = @('product') },
        @{ Pattern = '01-requirements'; Tags = @('requirements') },
        @{ Pattern = '04-testing'; Tags = @('testing', 'qa') },
        @{ Pattern = '06-project-management'; Tags = @('project-management') },
        @{ Pattern = '/reference/'; Tags = @('reference') },
        @{ Pattern = '/explanation/'; Tags = @('explanation') },
        @{ Pattern = '/how-to/'; Tags = @('how-to') },
        @{ Pattern = '/tutorials/'; Tags = @('tutorial') },
        @{ Pattern = '/reports/'; Tags = @('report') },
        @{ Pattern = '/architecture/'; Tags = @('architecture') },
        @{ Pattern = '/design/'; Tags = @('design') },
        @{ Pattern = '/modules/'; Tags = @('module') },
        @{ Pattern = '/ai/'; Tags = @('ai') },
        @{ Pattern = '/frontend/'; Tags = @('frontend') },
        @{ Pattern = '/backend/'; Tags = @('backend') },
        @{ Pattern = '/data/'; Tags = @('data') },
        @{ Pattern = '/ops/'; Tags = @('devops', 'deployment') },
        @{ Pattern = '/prompts/'; Tags = @('prompt') },
        @{ Pattern = '/standards/'; Tags = @('standards') },
        @{ Pattern = '/guides/'; Tags = @('guide') },
        @{ Pattern = '/assets/'; Tags = @('assets') },
        @{ Pattern = '/drafts/'; Tags = @('draft') },
        @{ Pattern = '/adr/'; Tags = @('adr') },
        @{ Pattern = 'readme\.md$'; Tags = @('index', 'documentation') },
        @{ Pattern = 'registry-index\.md$'; Tags = @('index', 'registry') },
        @{ Pattern = 'user-personas'; Tags = @('product', 'ux') },
        @{ Pattern = 'competitive-analysis'; Tags = @('product', 'market') },
        @{ Pattern = 'data-security'; Tags = @('security', 'data') },
        @{ Pattern = 'data-interaction-protocols'; Tags = @('contract', 'api') },
        @{ Pattern = 'file-naming-conventions'; Tags = @('spec', 'standards') },
        @{ Pattern = 'data-layer-overview'; Tags = @('data', 'architecture') },
        @{ Pattern = 'deployment'; Tags = @('devops', 'deployment') },
        @{ Pattern = 'vision-and-goals'; Tags = @('product', 'vision') },
        @{ Pattern = 'glossary'; Tags = @('reference', 'glossary') },
        @{ Pattern = 'ai-memory-layer'; Tags = @('ai', 'memory') },
        @{ Pattern = 'v9-data-timeline'; Tags = @('data', 'timeline') },
        @{ Pattern = 'yahoo_finance'; Tags = @('data-source', 'finance') },
        @{ Pattern = 'world_bank'; Tags = @('data-source', 'macro') },
        @{ Pattern = 'sec_edgar'; Tags = @('data-source', 'securities') },
        @{ Pattern = 'tianyancha'; Tags = @('data-source', 'company') },
        @{ Pattern = 'ifind'; Tags = @('data-source', 'finance') },
        @{ Pattern = 'imf'; Tags = @('data-source', 'macro') },
        @{ Pattern = 'scholar'; Tags = @('data-source', 'research') },
        @{ Pattern = 'yuandian_law'; Tags = @('data-source', 'legal') },
        @{ Pattern = 'data_link_sequence'; Tags = @('data', 'sequence-diagram') },
        @{ Pattern = 'prompt-merge-dedup'; Tags = @('prompt', 'optimization') },
        @{ Pattern = 'doc-trigger-action-map'; Tags = @('automation', 'workflow') },
        @{ Pattern = 'publish-ready'; Tags = @('article', 'publication') },
        @{ Pattern = 'e2e-test'; Tags = @('testing', 'e2e') },
        @{ Pattern = 'hardcode-cleanup'; Tags = @('refactoring', 'cleanup') },
        @{ Pattern = 'performance-baseline'; Tags = @('performance', 'testing') },
        @{ Pattern = 'pre-testing-checklist'; Tags = @('testing', 'checklist') },
        @{ Pattern = 'security-test-plan'; Tags = @('security', 'testing') },
        @{ Pattern = 'unit-test-repair'; Tags = @('testing', 'unit-test') },
        @{ Pattern = 'lessons-architecture-review'; Tags = @('architecture', 'review', 'lessons-learned') },
        @{ Pattern = 'phase2-manual-task-list'; Tags = @('project-management', 'checklist') },
        @{ Pattern = 'cleanup-schedule'; Tags = @('cleanup', 'schedule') },
        @{ Pattern = 'development-log'; Tags = @('log', 'project-management') },
        @{ Pattern = 'directory-structure-guide'; Tags = @('guide', 'structure') },
        @{ Pattern = 'doc-auto-update-kanban'; Tags = @('kanban', 'automation') },
        @{ Pattern = 'doc-id-registry'; Tags = @('registry', 'documentation') },
        @{ Pattern = 'doc-system-check'; Tags = @('audit', 'documentation') },
        @{ Pattern = 'core-docs-functional-match'; Tags = @('report', 'audit') },
        @{ Pattern = 'core-docs-v2-final-report'; Tags = @('report', 'audit') },
        @{ Pattern = 'service-integration-guide'; Tags = @('guide', 'integration') },
        @{ Pattern = 'security'; Tags = @('security') },
        @{ Pattern = 'api'; Tags = @('api') },
        @{ Pattern = 'database'; Tags = @('database') },
        @{ Pattern = 'react'; Tags = @('frontend', 'react') },
        @{ Pattern = 'typescript'; Tags = @('frontend', 'typescript') }
    )

    foreach ($rule in $tagRules) {
        if ($lowerPath -match $rule.Pattern -or $lowerName -match $rule.Pattern) {
            foreach ($tag in $rule.Tags) {
                if ($tags -notcontains $tag) { $tags += $tag }
            }
        }
    }

    if ($fm.type -and $tags -notcontains $fm.type) { $tags += $fm.type }
    if ($fm.domain -and $tags -notcontains $fm.domain) { $tags += $fm.domain }

    return ($tags | Select-Object -Unique)
}

$docs = Get-ChildItem -Path $DocsPath -Recurse -Include "*.md" -File |
    Where-Object { $_.FullName -notmatch "\\archive\\" -and $_.FullName -notmatch "\\ai-index\\" }

$fixedMissing = 0
$fixedTooFew = 0
$skipped = 0

foreach ($doc in $docs) {
    $fm = Get-Frontmatter $doc.FullName
    if (-not $fm) { continue }
    
    $relPath = $doc.FullName.Substring($DocsPath.Length + 1).Replace("\", "/")
    $fileContent = Get-Content $doc.FullName -Raw -Encoding UTF8
    
    $currentTags = if ($fm.tags -is [array]) { $fm.tags } elseif ($fm.tags) { @($fm.tags) } else { @() }
    
    if ($currentTags.Count -eq 0) {
        $inferredTags = Infer-Tags $relPath $fm $fileContent
        if ($inferredTags.Count -ge 2) {
            if ($inferredTags.Count -gt 8) { $inferredTags = $inferredTags[0..7] }
            Set-FrontmatterTags $doc.FullName $inferredTags
            Write-Host "[MISSING] $relPath -> [$($inferredTags -join ', ')]" -ForegroundColor Green
            $fixedMissing++
        } else {
            Write-Host "[SKIP MISSING] $relPath (only $($inferredTags.Count) tags inferred)" -ForegroundColor Yellow
            $skipped++
        }
    } elseif ($currentTags.Count -eq 2) {
        $inferredTags = Infer-Tags $relPath $fm $fileContent
        $newTags = $currentTags
        foreach ($tag in $inferredTags) {
            if ($newTags -notcontains $tag) {
                $newTags += $tag
                if ($newTags.Count -ge 3) { break }
            }
        }
        if ($newTags.Count -ge 3) {
            if ($newTags.Count -gt 8) { $newTags = $newTags[0..7] }
            Set-FrontmatterTags $doc.FullName $newTags
            Write-Host "[TOO FEW] $relPath -> [$($newTags -join ', ')]" -ForegroundColor Cyan
            $fixedTooFew++
        } else {
            Write-Host "[SKIP FEW] $relPath (still $($newTags.Count) tags)" -ForegroundColor Yellow
            $skipped++
        }
    }
}

Write-Host ""
Write-Host "===== Summary =====" -ForegroundColor Yellow
Write-Host "Fixed missing tags: $fixedMissing"
Write-Host "Fixed too few tags: $fixedTooFew"
Write-Host "Skipped: $skipped"
