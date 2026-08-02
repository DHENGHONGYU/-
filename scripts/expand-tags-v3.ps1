param(
    [string]$DocsPath = (Join-Path (Split-Path $PSScriptRoot -Parent) 'docs'),
    [switch]$Apply = $false
)

$ErrorActionPreference = "Stop"

$moduleTags = @{
    "data-definition" = @('data-definition','data-dictionary','dictionary','数据字典','数据定义')
    "dataflow"        = @('dataflow','data-flow','data-lineage','数据流','血缘')
    "databridge"      = @('databridge','data-bridge','数据桥')
    "contract"        = @('contract','契约')
    "store"           = @('store','zustand')
    "collection"      = @('collection','collector','fetcher','采集')
    "registry"        = @('registry','index','索引','注册')
    "screening"       = @('screening','screener','选股','筛选')
    "trading"         = @('trading','trade','交易')
    "strategy"        = @('strategy','策略')
    "cockpit"         = @('cockpit','驾驶舱')
    "widget"          = @('widget')
    "component"       = @('component','组件')
    "token"           = @('token','design-token','令牌')
    "news"            = @('news','资讯')
    "input-cabin"     = @('input-cabin','cabin')
    "mcp"             = @('mcp')
    "agent"           = @('agent')
    "integration"     = @('integration','集成')
    "adr"             = @('adr-','adr_')
    "dual-strategy"   = @('dual-strategy','双策略')
    "migration"       = @('migration','migrate','迁移')
    "refactor"        = @('refactor','重构')
    "complexity"      = @('complexity','复杂度')
    "changelog"       = @('changelog','change-log','update-log','变更日志')
    "scoring"         = @('scoring','score','scoredoc','评分')
    "factor"          = @('factor','multi-factor','seven-dim','7-dim','因子','七维')
    "stocks"          = @('stock-pool','stockpool','asset-pool','portfolio','股票池','资产池')
    "position"        = @('position','holding','positioncomputer','持仓')
    "routing"         = @('routing','route','navigation','路由')
    "validation"      = @('validation','verification','校验','验证')
    "architecture"    = @('architecture','架构')
    "testing"         = @('test','testing','e2e','regression','测试')
}

$featureTags = @{
    "audit"         = @('audit','审计','核查')
    "quality"       = @('quality','质量')
    "checklist"     = @('checklist','清单')
    "governance"    = @('governance','治理')
    "optimization"  = @('optimization','optimize','优化')
    "fix"           = @('fix','bugfix','修复')
    "remediation"   = @('remediation','整改')
    "cleanup"       = @('cleanup','清理')
    "gap-analysis"  = @('gap-analysis','gap_analysis','差距分析')
    "completeness"  = @('completeness','完整性')
    "workflow"      = @('workflow','sop','工作流')
    "jsdoc"         = @('jsdoc')
    "security"      = @('security','vulnerability','penetration','安全')
    "performance"   = @('performance','性能')
    "a11y"          = @('a11y','accessibility','contrast','无障碍')
    "i18n"          = @('i18n','国际化')
    "report"        = @('report','review-report','assessment','体检','报告','盘点','评估')
    "guide"         = @('guide','how-to','handbook','tutorial','指南','手册')
    "deprecated"    = @('deprecated','deprecation','obsolete','old-version','废弃','旧版')
    "plan"          = @('plan','planning','roadmap','action-plan','action-list','计划','规划','路线图')
    "spec"          = @('spec','specification','standards','constitution','规范','标准')
    "template"      = @('template','scaffold','模板')
    "research"      = @('research','study','analysis','analytical','研究','分析')
    "batch"         = @('batch','batchA','batchB','batchC','batchD','batchE')
    "management"    = @('management','管理')
    "kanban"        = @('kanban','看板')
    "log"           = @('log','日志','记录')
    "health"        = @('health','健康')
    "frontend"      = @('frontend','前端','ui-','-ui')
    "backend"       = @('backend','后端')
    "data"          = @('data','数据')
    "product"       = @('product','prd','产品')
    "qa"            = @('qa','quality','测试')
    "documentation" = @('documentation','文档')
    "release"       = @('release','发布')
    "review"        = @('review','复盘','回顾')
    "design"        = @('design','设计')
    "system"        = @('system','系统')
    "implementation" = @('implementation','implement','实施')
    "definition"    = @('definition','定义')
    "profile"       = @('profile','画像')
    "drift"         = @('drift','mismatch','偏差','不一致')
}

$docs = Get-ChildItem -Path $DocsPath -Recurse -Include "*.md" -File |
    Where-Object { $_.FullName -notmatch "\\archive\\" -and $_.FullName -notmatch "\\ai-index\\" }

$zeroTagged = 0
$twoUpgraded = 0
$samples = @()

foreach ($doc in $docs) {
    $content = Get-Content $doc.FullName -Raw -Encoding UTF8
    if (-not $content) { continue }
    if ($content -notmatch '(?s)^---\s*\r?\n(.*?)\r?\n---') { continue }
    $fm = $matches[1]

    $domain = "project"
    $title = ""
    $type = ""
    if ($fm -match '(?m)^domain\s*:\s*(.+)$') { $domain = $matches[1].Trim() }
    if ($fm -match '(?m)^title\s*:\s*(.+)$') { $title = $matches[1].Trim() }
    if ($fm -match '(?m)^type\s*:\s*(.+)$') { $type = $matches[1].Trim() }

    $base = [System.IO.Path]::GetFileNameWithoutExtension($doc.Name).ToLower()
    $relPath = $doc.FullName.Substring($DocsPath.Length + 1).Replace("\", "/").ToLower()
    $text = "$base $($title.ToLower()) $relPath $type"

    $hasTags = $false
    $existingTags = @()
    if ($fm -match '(?m)^tags\s*:\s*\[(.*)\]') {
        $hasTags = $true
        $existingTags = ($matches[1] -split ',' | ForEach-Object { $_.Trim() }) | Where-Object { $_ }
    }

    # Only target zero-tag and exactly-2-tag docs
    if ($hasTags -and $existingTags.Count -ne 2) { continue }

    $newTags = @($existingTags)
    if (-not $hasTags) { $newTags = @($domain) }

    foreach ($t in $moduleTags.Keys) {
        if ($newTags -contains $t) { continue }
        foreach ($kw in $moduleTags[$t]) {
            if ($text.Contains($kw.ToLower())) {
                if ($newTags -notcontains $t) { $newTags += $t }
                break
            }
        }
        if ($newTags.Count -ge 5) { break }
    }
    if ($newTags.Count -lt 5) {
        foreach ($t in $featureTags.Keys) {
            if ($newTags -contains $t) { continue }
            foreach ($kw in $featureTags[$t]) {
                if ($text.Contains($kw.ToLower())) {
                    if ($newTags -notcontains $t) { $newTags += $t }
                    break
                }
            }
            if ($newTags.Count -ge 5) { break }
        }
    }

    if ($newTags.Count -lt 2) { continue }
    if ($hasTags -and $newTags.Count -le 2) { continue }
    if ($newTags.Count -gt 5) { $newTags = $newTags[0..4] }

    $rel = $doc.FullName.Substring($DocsPath.Length + 1).Replace("\", "/")
    if ($samples.Count -lt 12) {
        $old = if ($hasTags) { ($existingTags -join ", ") } else { "(none)" }
        $samples += [PSCustomObject]@{ Path = $rel; Old = $old; New = ($newTags -join ", ") }
    }

    if ($Apply) {
        $newTagStr = "[" + ($newTags -join ", ") + "]"
        if ($hasTags) {
            $newFm = $fm -replace '(?m)^tags\s*:.*$', "tags: $newTagStr"
        } else {
            if ($fm -match '(?m)^summary\s*:.*$') {
                $newFm = $fm -replace '(?m)^(summary\s*:.*)$', "`$1`ntags: $newTagStr"
            } elseif ($fm -match '(?m)^maintainer\s*:.*$') {
                $newFm = $fm -replace '(?m)^(maintainer\s*:.*)$', "`$1`ntags: $newTagStr"
            } else {
                $newFm = $fm.TrimEnd() + "`ntags: $newTagStr"
            }
        }
        $newContent = $content -replace '(?s)^(---\s*\r?\n).*?(\r?\n---)', ('$1' + $newFm + '$2')
        [System.IO.File]::WriteAllText($doc.FullName, $newContent, (New-Object System.Text.UTF8Encoding $false))
    }

    if (-not $hasTags) { $zeroTagged++ } else { $twoUpgraded++ }
}

Write-Host "===== Tag Expansion V3 =====" -ForegroundColor Yellow
Write-Host "Newly tagged (0 -> 2+): $zeroTagged"
Write-Host "Upgraded (2 -> 3+): $twoUpgraded"
if ($Apply) { Write-Host "Applied" -ForegroundColor Green }
Write-Host ""
Write-Host "=== Samples ===" -ForegroundColor Yellow
$samples | ForEach-Object {
    Write-Host "  $($_.Path)"
    Write-Host "     OLD: $($_.Old)"
    Write-Host "     NEW: $($_.New)"
}

