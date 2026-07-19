$expectedOrder = @(
    'title', 'type', 'domain', 'phase', 'tier', 'status',
    'maintainer', 'summary', 'tags', 'version', 'last_updated',
    'code_version', 'doc_id', 'change_log', 'related_docs'
)

$docs = Get-ChildItem -Path docs -Recurse -Filter *.md
$updated = 0

foreach ($doc in $docs) {
    $content = Get-Content $doc.FullName -Raw
    if ($content -notmatch '(?s)^---\s*\r?\n(.*?)\r?\n---') { continue }
    $fm = $matches[1]
    $body = $content.Substring($matches[0].Length)

    if ($doc.FullName -match '\\archive\\') { continue }

    $lines = $fm -split '\r?\n'
    $fields = @{}
    $multilineFields = @{}
    $currentField = $null
    $currentValue = @()

    foreach ($line in $lines) {
        if ($line -match '^\s*(\w[\w\-]*)\s*:\s*(.*)') {
            if ($currentField -ne $null) {
                $multilineFields[$currentField] = $currentValue
            }
            $fieldName = $matches[1]
            $fieldValue = $matches[2].Trim()
            $fields[$fieldName] = $fieldValue
            $currentField = $null
            $currentValue = @()
            
            if ($fieldValue -eq '' -and $line.EndsWith(':')) {
                $currentField = $fieldName
            }
        } elseif ($line -match '^\s+') {
            if ($currentField -ne $null) {
                $currentValue += $line.Trim()
            }
        }
    }

    if ($currentField -ne $null) {
        $multilineFields[$currentField] = $currentValue
    }

    $orderedFm = @()
    foreach ($field in $expectedOrder) {
        if ($fields.ContainsKey($field)) {
            if ($multilineFields.ContainsKey($field)) {
                $orderedFm += "${field}:"
                foreach ($val in $multilineFields[$field]) {
                    $orderedFm += "  $val"
                }
            } else {
                $orderedFm += "${field}: $($fields[$field])"
            }
        }
    }

    $otherFields = $fields.Keys | Where-Object { $expectedOrder -notcontains $_ }
    foreach ($field in $otherFields) {
        if ($multilineFields.ContainsKey($field)) {
            $orderedFm += "${field}:"
            foreach ($val in $multilineFields[$field]) {
                $orderedFm += "  $val"
            }
        } else {
            $orderedFm += "${field}: $($fields[$field])"
        }
    }

    $newFm = $orderedFm -join "`n"
    
    if ($newFm -eq $fm) { continue }

    $newContent = "---`n" + $newFm + "`n---" + $body
    Set-Content -Path $doc.FullName -Value $newContent -NoNewline
    $updated++
}

Write-Host "Updated: $updated"
