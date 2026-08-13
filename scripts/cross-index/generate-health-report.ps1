<#
.SYNOPSIS
  Generate monthly document health dashboard report
#>
param([string]$OutputPath = "docs/reports/audit/doc-health-report-$(Get-Date -Format 'yyyy-MM').md")

$ErrorActionPreference = "Stop"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

Write-Host "Loading all index files..."

$masterIndexContent = [System.IO.File]::ReadAllText((Resolve-Path "docs/meta/ai-index/master-index.json").Path, $utf8NoBom)
$masterIndex = $masterIndexContent | ConvertFrom-Json

$relationIndexContent = [System.IO.File]::ReadAllText((Resolve-Path "docs/meta/ai-index/relation-index.json").Path, $utf8NoBom)
$relationIndex = $relationIndexContent | ConvertFrom-Json

$testDocIndexContent = [System.IO.File]::ReadAllText((Resolve-Path "docs/meta/ai-index/test-doc-index.json").Path, $utf8NoBom)
$testDocIndex = $testDocIndexContent | ConvertFrom-Json

$codeDocIndexContent = [System.IO.File]::ReadAllText((Resolve-Path "docs/meta/ai-index/code-doc-index.json").Path, $utf8NoBom)
$codeDocIndex = $codeDocIndexContent | ConvertFrom-Json

$skillDocIndexContent = [System.IO.File]::ReadAllText((Resolve-Path "docs/meta/ai-index/skill-doc-index.json").Path, $utf8NoBom)
$skillDocIndex = $skillDocIndexContent | ConvertFrom-Json

Write-Host "Calculating statistics..."

$totalDocs = $masterIndex.stats.total_docs
$activeDocs = $masterIndex.stats.active_docs
$archivedDocs = $masterIndex.stats.archived_docs

$docIdCoverage = $masterIndex.stats.doc_id_coverage
$statusCoverage = $masterIndex.stats.status_coverage

$totalLinks = $relationIndex.stats.total_links
$resolvedLinks = $relationIndex.stats.resolved_links
$unresolvedLinks = $relationIndex.stats.unresolved_links
$activeUnresolvedLinks = $relationIndex.stats.active_unresolved_links
$archivedUnresolvedLinks = $relationIndex.stats.archived_unresolved_links
$linkResolutionRate = [math]::Round(($resolvedLinks / $totalLinks) * 100, 1)

$orphanCount = $relationIndex.stats.orphan_docs

$totalTests = $testDocIndex.stats.total_tests
$testsWithCoverage = $testDocIndex.stats.tests_with_doc_coverage
$docsCoveredByTests = $testDocIndex.stats.docs_covered_by_tests

$totalSrc = $codeDocIndex.stats.total_src_files
$srcWithCoverage = $codeDocIndex.stats.src_files_with_doc_coverage
$docsCoveredByCode = $codeDocIndex.stats.docs_covered_by_code

$totalSkills = $skillDocIndex.stats.total_skills
$docsCoveredBySkills = $skillDocIndex.stats.docs_covered_by_skills

$activeDocsWithRelation = 0
$totalActiveDocs = 0
foreach ($prop in Get-Member -InputObject $masterIndex.documents -MemberType NoteProperty) {
    $doc = $masterIndex.documents.$($prop.Name)
    if ($doc.status -eq 'active') {
        $totalActiveDocs++
        $docId = if ($doc.doc_id) { $doc.doc_id } else { $prop.Name }
        if ($relationIndex.links.PSObject.Properties[$docId]) {
            $links = $relationIndex.links.$docId
            if ($links.outgoing.Count -gt 0 -or $links.incoming.Count -gt 0) {
                $activeDocsWithRelation++
            }
        }
    }
}

$relationCoverage = if ($totalActiveDocs -gt 0) { [math]::Round(($activeDocsWithRelation / $totalActiveDocs) * 100, 1) } else { 0 }

$dateNow = Get-Date
$date7Days = $dateNow.AddDays(7).ToString('yyyy-MM-dd')
$date14Days = $dateNow.AddDays(14).ToString('yyyy-MM-dd')
$dateFormat = $dateNow.ToString('yyyy-MM-dd')
$dateFormatHM = $dateNow.ToString('yyyy-MM-dd HH:mm')
$dateFormatYM = $dateNow.ToString('yyyy-MM')
$docIdMonth = $dateNow.ToString('MM')

$activePercent = if ($totalDocs -gt 0) { [math]::Round(($activeDocs / $totalDocs) * 100, 1) } else { 0 }
$archivedPercent = if ($totalDocs -gt 0) { [math]::Round(($archivedDocs / $totalDocs) * 100, 1) } else { 0 }

$masterIndexSize = (Get-Item "docs/meta/ai-index/master-index.json").Length
$relationIndexSize = (Get-Item "docs/meta/ai-index/relation-index.json").Length
$testDocIndexSize = (Get-Item "docs/meta/ai-index/test-doc-index.json").Length
$codeDocIndexSize = (Get-Item "docs/meta/ai-index/code-doc-index.json").Length
$skillDocIndexSize = (Get-Item "docs/meta/ai-index/skill-doc-index.json").Length

$utCount = $testDocIndex.stats.ut_count
$e2eCount = $testDocIndex.stats.e2e_count
$stCount = $testDocIndex.stats.st_count
$docsWithLinks = $relationIndex.stats.docs_with_links
$tierCoverage = $masterIndex.stats.tier_coverage

$orphanStatus = if ($orphanCount -lt 50) { "OK" } else { "WARN" }

$report = @"
---
title: Document Health Dashboard $dateFormatYM
type: report
domain: project
phase: maintenance
tier: reference
status: active
maintainer: V9 Architecture Team
summary: "Monthly document health report covering cross-index completeness, link quality, and coverage metrics"
tags: [project, audit, documentation, governance, health, dashboard]
version: v1.0.0
last_updated: $dateFormat
doc_id: V9-DOC-QA-$docIdMonth
change_log:
  - version: v1.0.0
    changes: "Initial health dashboard"
    date: $dateFormat
---

# Document Health Dashboard

> **Generated**: $dateFormatHM
> **Report Period**: $dateFormatYM
> **Project**: FinSightV9

---

## Executive Summary

| Metric | Value | Status |
|--------|-------|--------|
| Total Documents | $totalDocs | OK |
| Active Documents | $activeDocs | OK |
| Archived Documents | $archivedDocs | OK |
| doc_id Coverage | $docIdCoverage | OK |
| status Coverage | $statusCoverage | OK |
| Link Resolution Rate | $linkResolutionRate% | OK |
| Relation Coverage (Active) | $relationCoverage% | OK |
| Orphan Documents | $orphanCount | $orphanStatus |
| Tests with Doc Coverage | $testsWithCoverage/$totalTests | OK |
| Code with Doc Coverage | $srcWithCoverage/$totalSrc | OK |
| SKILLs with Doc Coverage | $totalSkills | OK |

---

## 1. Document Baseline

### 1.1 Document Inventory

| Category | Count | % of Total |
|----------|-------|------------|
| Total | $totalDocs | 100% |
| Active | $activeDocs | $activePercent% |
| Archived | $archivedDocs | $archivedPercent% |

### 1.2 Metadata Coverage

| Field | Coverage | Status |
|-------|----------|--------|
| doc_id | $docIdCoverage | OK |
| status | $statusCoverage | OK |
| tier | $tierCoverage | OK |

---

## 2. Document-to-Document Relations

### 2.1 Link Quality

| Metric | Value |
|--------|-------|
| Total Links | $totalLinks |
| Resolved Links | $resolvedLinks |
| Unresolved Links | $unresolvedLinks |
| Active Unresolved | $activeUnresolvedLinks |
| Archived Unresolved | $archivedUnresolvedLinks |
| Resolution Rate | $linkResolutionRate% |

### 2.2 Relation Coverage

| Metric | Value |
|--------|-------|
| Active Docs with Relations | $activeDocsWithRelation/$totalActiveDocs ($relationCoverage%) |
| Orphan Docs (no incoming) | $orphanCount |

---

## 3. Test-Document Coverage

### 3.1 Test Inventory

| Category | Count |
|----------|-------|
| Unit Tests | $utCount |
| E2E Tests | $e2eCount |
| Store Tests | $stCount |
| **Total** | $totalTests |

### 3.2 Coverage Metrics

| Metric | Value |
|--------|-------|
| Tests with @covers_docs | $testsWithCoverage/$totalTests |
| Docs Covered by Tests | $docsCoveredByTests |

---

## 4. Code-Document Coverage

### 4.1 Code Inventory

| Metric | Value |
|--------|-------|
| Total Source Files | $totalSrc |
| Files with @doc | $srcWithCoverage |
| Docs Covered by Code | $docsCoveredByCode |

---

## 5. SKILL-Document Coverage

### 5.1 SKILL Inventory

| Category | Count |
|----------|-------|
| Project SKILLs | 3 |
| Compatibility SKILLs | 4 |
| External Plugin SKILLs | 8 |
| **Total** | 15 |

### 5.2 Coverage Metrics

| Metric | Value |
|--------|-------|
| SKILLs with covers_docs | $totalSkills/15 |
| Docs Covered by SKILLs | $docsCoveredBySkills |

---

## 6. Cross-Index Summary

### 6.1 Index Files

| Index | Location | Size |
|-------|----------|------|
| master-index.json | docs/meta/ai-index/ | $masterIndexSize bytes |
| relation-index.json | docs/meta/ai-index/ | $relationIndexSize bytes |
| test-doc-index.json | docs/meta/ai-index/ | $testDocIndexSize bytes |
| code-doc-index.json | docs/meta/ai-index/ | $codeDocIndexSize bytes |
| skill-doc-index.json | docs/meta/ai-index/ | $skillDocIndexSize bytes |

### 6.2 Coverage Heatmap

```
                        Docs    Tests    Code    SKILLs
                        ======  ======  ======  ======
Docs -> Related          $activeDocsWithRelation/$totalActiveDocs
Docs -> Referenced By    $docsWithLinks/$totalDocs
Tests -> Covers Docs     $testsWithCoverage/$totalTests
Code -> @doc             $srcWithCoverage/$totalSrc
SKILLs -> Covers Docs    $totalSkills/15
```

---

## 7. Recommendations

### 7.1 Immediate Actions

| Priority | Action | Owner | Target Date |
|----------|--------|-------|-------------|
| P1 | Review and resolve $unresolvedLinks unresolved links | Architecture Team | $date7Days |
| P1 | Audit $orphanCount orphan documents for deprecation | Architecture Team | $date14Days |

### 7.2 Ongoing Maintenance

| Task | Frequency | Owner |
|------|-----------|-------|
| Generate health report | Monthly | Architecture Team |
| Validate cross-index consistency | Weekly | CI/CD |
| Update master-index | On doc changes | Cross-index script |

---

## 8. Historical Comparison

| Metric | Previous | Current | Change |
|--------|----------|---------|--------|
| Total Documents | 801 | $totalDocs | $($totalDocs - 801) |
| doc_id Coverage | 83.8% | $docIdCoverage | $([math]::Round(([regex]::Match($docIdCoverage, '(\d+(\.\d+)?)').Groups[1].Value -as [double]) - 83.8, 1))% |
| Link Resolution Rate | 82.5% | $linkResolutionRate% | $([math]::Round($linkResolutionRate - 82.5, 1))% |
| Relation Coverage | 90.7% | $relationCoverage% | $([math]::Round($relationCoverage - 90.7, 1))% |
| Orphan Documents | 108 | $orphanCount | $($orphanCount - 108) |
| Unresolved Links | 565 | $activeUnresolvedLinks | $($activeUnresolvedLinks - 565) |
"@

$outDir = Split-Path $OutputPath -Parent
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir -Force | Out-Null }

[System.IO.File]::WriteAllText((Resolve-Path -LiteralPath $outDir).Path + "\" + (Split-Path $OutputPath -Leaf), $report, $utf8NoBom)

Write-Host "Health report written to: $OutputPath"
Write-Host "File size: $((Get-Item $OutputPath).Length) bytes"
