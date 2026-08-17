#!/usr/bin/env pwsh
<#
.SYNOPSIS
  V9 归档目录重组与清单生成脚本
.DESCRIPTION
  1. 创建标准 A/B/C 三级归档目录结构
  2. 将现有 historical-* 批次迁移到标准结构
  3. 合并 archive/docs/ 到 docs/archive/
  4. 生成完整归档清单 (CSV + Markdown)
.PARAMETER DryRun
  仅预览不执行
.EXAMPLE
  .\scripts\audit\archive-reorganize.ps1
  .\scripts\audit\archive-reorganize.ps1 -DryRun
#>

param(
  [switch]$DryRun = $false
)

$ErrorActionPreference = "Continue"
$RepoRoot = (Get-Item (Split-Path $PSScriptRoot -Parent) -Force).Parent.FullName
Set-Location $RepoRoot

$ReportDate = Get-Date -Format "yyyy-MM-dd"
$ArchiveRoot = "docs/archive"
$InventoryFile = "docs/archive/archive-inventory.csv"
$InventoryMdFile = "docs/archive/archive-inventory.md"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host " V9 Archive Reorganization" -ForegroundColor Cyan
Write-Host " Date: $ReportDate" -ForegroundColor Cyan
Write-Host " Mode: $(if ($DryRun) { 'DRY RUN' } else { 'EXECUTE' })" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

# ── Step 1: Create standard directory structure ──
Write-Host "`n[1/5] Creating standard archive structure..." -ForegroundColor Yellow

$dirs = @(
  "$ArchiveRoot/important/architecture",
  "$ArchiveRoot/important/reference",
  "$ArchiveRoot/important/explanation",
  "$ArchiveRoot/important/specs",
  "$ArchiveRoot/normal/explanation",
  "$ArchiveRoot/normal/reference",
  "$ArchiveRoot/normal/reports",
  "$ArchiveRoot/normal/guides",
  "$ArchiveRoot/normal/release-notes",
  "$ArchiveRoot/normal/lessons",
  "$ArchiveRoot/normal/meta",
  "$ArchiveRoot/drafts/temp",
  "$ArchiveRoot/drafts/date-prefix",
  "$ArchiveRoot/drafts/deprecated"
)

foreach ($dir in $dirs) {
  if (-not (Test-Path $dir)) {
    if (-not $DryRun) {
      New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
    Write-Host "  Created: $dir" -ForegroundColor Gray
  } else {
    Write-Host "  Exists: $dir" -ForegroundColor DarkGray
  }
}

# ── Step 2: Categorize existing archive files ──
Write-Host "`n[2/5] Categorizing existing archive files..." -ForegroundColor Yellow

# Collect all files in current archive
$existingArchive = @(Get-ChildItem "$ArchiveRoot/" -Recurse -Filter "*.md" -ErrorAction SilentlyContinue |
  Where-Object { $_.FullName -notmatch '\\important\\' -and $_.FullName -notmatch '\\normal\\' -and $_.FullName -notmatch '\\drafts\\temp\\' -and $_.FullName -notmatch '\\drafts\\date-prefix\\' -and $_.FullName -notmatch '\\drafts\\deprecated\\' })

# Also collect from archive/docs/
$externalArchive = @(Get-ChildItem "archive/docs/" -Recurse -Filter "*.md" -ErrorAction SilentlyContinue)

$allArchiveFiles = $existingArchive + $externalArchive

# Classify each file
$classifications = @()
$inventoryItems = [System.Collections.ArrayList]::new()

$levelMap = @{
  'ADR' = 'A'
  'architecture' = 'A'
  'spec' = 'A'
  'decision' = 'A'
  'important' = 'A'
}

foreach ($file in $allArchiveFiles) {
  $relPath = $file.FullName.Replace($RepoRoot + '\', '').Replace('\', '/')
  $name = $file.Name
  $size = $file.Length

  # Determine level
  $level = 'B'  # default
  $category = 'normal'

  if ($name -match '^DEPRECATED_' -or $relPath -match '/deprecated/') {
    $level = 'C'
    $category = 'drafts/deprecated'
  } elseif ($name -match '^\d{4}-\d{2}-\d{2}-') {
    $level = 'C'
    $category = 'drafts/date-prefix'
  } elseif ($name -match 'adr|architecture|spec|decision|contract') {
    $level = 'A'
    $category = 'important'
  } elseif ($name -match 'report|summary|changelog|checklist|todo|cleanup') {
    $level = 'B'
    $category = 'normal/reports'
  } elseif ($relPath -match '/reports/') {
    $level = 'B'
    $category = 'normal/reports'
  } elseif ($relPath -match '/explanation/') {
    $level = 'B'
    $category = 'normal/explanation'
  } elseif ($relPath -match '/reference/') {
    $level = 'B'
    $category = 'normal/reference'
  } elseif ($relPath -match '/guides/') {
    $level = 'B'
    $category = 'normal/guides'
  } elseif ($relPath -match '/release-notes/|/releases/') {
    $level = 'B'
    $category = 'normal/release-notes'
  } elseif ($relPath -match '/lessons/') {
    $level = 'B'
    $category = 'normal/lessons'
  } elseif ($relPath -match '/meta/') {
    $level = 'B'
    $category = 'normal/meta'
  }

  # Sub-category path
  $subPath = ''
  if ($relPath -match '/architecture/') { $subPath = 'architecture/' }
  elseif ($relPath -match '/reference/') { $subPath = 'reference/' }
  elseif ($relPath -match '/explanation/') { $subPath = 'explanation/' }
  elseif ($relPath -match '/specs/') { $subPath = 'specs/' }

  $targetPath = if ($level -eq 'A') {
    "$ArchiveRoot/important/$subPath$name"
  } elseif ($level -eq 'C') {
    "$ArchiveRoot/$category/$name"
  } else {
    "$ArchiveRoot/$category/$name"
  }

  $classifications += [PSCustomObject]@{
    SourcePath = $relPath
    TargetPath = $targetPath
    Level = $level
    Category = $category
    Name = $name
    Size = $size
  }

  # Add to inventory
  $null = $inventoryItems.Add([PSCustomObject]@{
    ArchiveID = ''
    Title = [System.IO.Path]::GetFileNameWithoutExtension($name)
    OriginalPath = $relPath
    ArchivePath = $targetPath
    ArchiveLevel = $level
    ArchiveDate = $ReportDate
    ArchiveReason = if ($level -eq 'A') { 'Important historical document' }
      elseif ($level -eq 'C') { 'Draft/temp/deprecated document' }
      else { 'Normal historical document' }
    SupersededBy = ''
    Domain = if ($relPath -match '/architecture/') { 'architecture' }
      elseif ($relPath -match '/reference/') { 'reference' }
      elseif ($relPath -match '/explanation/') { 'explanation' }
      elseif ($relPath -match '/reports/') { 'reports' }
      elseif ($relPath -match '/guides/') { 'guides' }
      else { 'general' }
    FinalVersion = 'N/A'
    FileSize = $size
  })
}

# ── Step 3: Execute moves ──
Write-Host "`n[3/5] Moving files to standard structure..." -ForegroundColor Yellow
$movedCount = 0
$skipCount = 0

foreach ($item in $classifications) {
  $srcPath = Join-Path $RepoRoot $item.SourcePath
  $dstPath = Join-Path $RepoRoot $item.TargetPath

  if (-not (Test-Path $srcPath)) {
    Write-Host "  SKIP (not found): $($item.SourcePath)" -ForegroundColor DarkGray
    $skipCount++
    continue
  }

  if ($srcPath -eq $dstPath) {
    $skipCount++
    continue
  }

  # Ensure target directory exists
  $dstDir = Split-Path $dstPath -Parent
  if (-not (Test-Path $dstDir)) {
    if (-not $DryRun) {
      New-Item -ItemType Directory -Path $dstDir -Force | Out-Null
    }
  }

  if (-not $DryRun) {
    # Handle duplicate filenames in target
    if (Test-Path $dstPath) {
      $baseName = [System.IO.Path]::GetFileNameWithoutExtension($item.Name)
      $ext = [System.IO.Path]::GetExtension($item.Name)
      $counter = 1
      while (Test-Path $dstPath) {
        $newName = "$baseName-dup$counter$ext"
        $dstPath = Join-Path $dstDir $newName
        $counter++
      }
    }
    Move-Item -Path $srcPath -Destination $dstPath -Force
    Write-Host "  MOVED: $($item.SourcePath) -> $($item.TargetPath)" -ForegroundColor Green
  } else {
    Write-Host "  [DRY RUN] Would move: $($item.SourcePath) -> $($item.TargetPath)" -ForegroundColor DarkYellow
  }
  $movedCount++
}

# ── Step 4: Clean up empty directories ──
Write-Host "`n[4/5] Cleaning up empty directories..." -ForegroundColor Yellow
if (-not $DryRun) {
  # Remove empty historical-* directories
  Get-ChildItem "$ArchiveRoot/historical-*" -Directory -ErrorAction SilentlyContinue |
    Where-Object { (Get-ChildItem $_.FullName -Recurse -File -ErrorAction SilentlyContinue).Count -eq 0 } |
    ForEach-Object {
      Remove-Item $_.FullName -Recurse -Force
      Write-Host "  Removed empty: $($_.Name)" -ForegroundColor Gray
    }

  # Remove empty batch* directories
  Get-ChildItem "$ArchiveRoot/*/batch*" -Directory -Recurse -ErrorAction SilentlyContinue |
    Where-Object { (Get-ChildItem $_.FullName -Recurse -File -ErrorAction SilentlyContinue).Count -eq 0 } |
    ForEach-Object {
      Remove-Item $_.FullName -Recurse -Force
      $cleanPath = $_.FullName.Replace($RepoRoot + '\', '')
      Write-Host "  Removed empty: $cleanPath" -ForegroundColor Gray
    }
}

# ── Step 5: Generate inventory ──
Write-Host "`n[5/5] Generating archive inventory..." -ForegroundColor Yellow

# Assign IDs
$idCounter = 1
$sortedInventory = $inventoryItems | Sort-Object ArchiveLevel, ArchivePath
foreach ($item in $sortedInventory) {
  $item.ArchiveID = "V9-ARCH-{0:D4}" -f $idCounter
  $idCounter++
}

# Write CSV
$sortedInventory | Select-Object ArchiveID, Title, OriginalPath, ArchivePath, ArchiveLevel,
  ArchiveDate, ArchiveReason, SupersededBy, Domain, FinalVersion, FileSize |
  Export-Csv -Path $InventoryFile -NoTypeInformation -Encoding utf8

# Write Markdown
$levelA = ($sortedInventory | Where-Object { $_.ArchiveLevel -eq 'A' }).Count
$levelB = ($sortedInventory | Where-Object { $_.ArchiveLevel -eq 'B' }).Count
$levelC = ($sortedInventory | Where-Object { $_.ArchiveLevel -eq 'C' }).Count
$totalArchived = $sortedInventory.Count

$inventoryRows = if ($totalArchived -gt 0) {
  ($sortedInventory | ForEach-Object {
    "| $($_.ArchiveID) | $($_.Title) | $($_.ArchiveLevel) | $($_.ArchiveReason) | $($_.ArchiveDate) | $($_.ArchivePath) |"
  }) -join "`n"
} else {
  "| - | - | - | - | - | - |"
}

$invLines = @()
$invLines += '# V9 Archive Inventory'
$invLines += ''
$invLines += "> Generated: $ReportDate"
$invLines += "> Total Archived: $totalArchived documents"
$invLines += ''
$invLines += '## Summary'
$invLines += ''
$invLines += '| Level | Count | Description |'
$invLines += '|-------|-------|-------------|'
$invLines += "| A | $levelA | Important historical documents (permanent) |"
$invLines += "| B | $levelB | Normal historical documents (2 years) |"
$invLines += "| C | $levelC | Drafts/temp/deprecated (6 months) |"
$invLines += ''
$invLines += '## Full Inventory'
$invLines += ''
$invLines += '| Archive ID | Title | Level | Reason | Date | Path |'
$invLines += '|------------|-------|-------|--------|------|------|'
$invLines += $inventoryRows
$invLines += ''
$invLines += '---'
$invLines += ''
$invLines += '> Generated by: scripts/audit/archive-reorganize.ps1'

$invLines -join "`n" | Out-File -FilePath $InventoryMdFile -Encoding utf8

# ── Update archive README ──
$readmeLines = @()
$readmeLines += '# V9 Archive'
$readmeLines += ''
$readmeLines += "> Last updated: $ReportDate"
$readmeLines += "> Total archived: $totalArchived documents"
$readmeLines += ''
$readmeLines += '## Structure'
$readmeLines += ''
$readmeLines += '```'
$readmeLines += 'docs/archive/'
$readmeLines += '├── important/       # A Level: Important historical (permanent)'
$readmeLines += '│   ├── architecture/'
$readmeLines += '│   ├── reference/'
$readmeLines += '│   ├── explanation/'
$readmeLines += '│   └── specs/'
$readmeLines += '├── normal/          # B Level: Normal historical (2 years)'
$readmeLines += '│   ├── explanation/'
$readmeLines += '│   ├── reference/'
$readmeLines += '│   ├── reports/'
$readmeLines += '│   ├── guides/'
$readmeLines += '│   ├── release-notes/'
$readmeLines += '│   ├── lessons/'
$readmeLines += '│   └── meta/'
$readmeLines += '└── drafts/          # C Level: Drafts/temp (6 months)'
$readmeLines += '    ├── temp/'
$readmeLines += '    ├── date-prefix/'
$readmeLines += '    └── deprecated/'
$readmeLines += '```'
$readmeLines += ''
$readmeLines += '## How to Find'
$readmeLines += ''
$readmeLines += '- Search by Archive ID: `V9-ARCH-XXXX`'
$readmeLines += '- Browse by category in the directory tree'
$readmeLines += '- Full inventory: [archive-inventory.md](archive-inventory.md)'
$readmeLines += '- CSV export: [archive-inventory.csv](archive-inventory.csv)'
$readmeLines += ''
$readmeLines += '## How to Restore'
$readmeLines += ''
$readmeLines += '1. Find the document in the inventory'
$readmeLines += '2. Copy back to original location'
$readmeLines += '3. Update status in frontmatter'
$readmeLines += '4. Run cross-reference audit'

$readmeLines -join "`n" | Out-File -FilePath "$ArchiveRoot/README.md" -Encoding utf8

Write-Host "`n============================================" -ForegroundColor Green
Write-Host " Reorganization Complete" -ForegroundColor Green
Write-Host " Files moved: $movedCount" -ForegroundColor Green
Write-Host " Skipped: $skipCount" -ForegroundColor Green
Write-Host " Total archived: $totalArchived" -ForegroundColor Green
Write-Host "   Level A: $levelA | Level B: $levelB | Level C: $levelC" -ForegroundColor Green
Write-Host " Inventory: $InventoryMdFile" -ForegroundColor Green
Write-Host " Inventory CSV: $InventoryFile" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green