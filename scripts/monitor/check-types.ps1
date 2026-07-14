# Type-check script: only checks non-test file TypeScript errors
# Usage: powershell -File scripts/check-types.ps1
# Exit: 0 = no non-test errors, 1 = non-test errors found

$ErrorActionPreference = "Continue"
$output = npx tsc --noEmit 2>&1
$nonTestErrors = $output | Select-String -Pattern "error TS" | Where-Object { $_ -notmatch "\.test\." -and $_ -notmatch "__tests__" }

if ($nonTestErrors.Count -eq 0) {
  Write-Host "PASS: 0 non-test type errors"
  exit 0
} else {
  $count = $nonTestErrors.Count
  Write-Host "FAIL: $count non-test type errors:"
  $nonTestErrors | ForEach-Object { Write-Host $_ }
  exit 1
}