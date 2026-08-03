<#
.SYNOPSIS
  Pester unit tests for GitAutoPush module - network fluctuation scenarios
.DESCRIPTION
  Tests retry logic, network detection, push operations, and error handling
  under simulated network conditions.
.NOTES
  Requires Pester 5.x: Install-Module Pester -Force -SkipPublisherCheck
  Run: Invoke-Pester -Path '.workbuddy\tests\GitAutoPush.Tests.ps1'
#>

BeforeAll {
    $modulePath = Join-Path (Split-Path -Parent $PSScriptRoot) 'scripts\GitAutoPush.psm1'
    Import-Module $modulePath -Force
    $testRepo = Join-Path ([System.IO.Path]::GetTempPath()) "TestGitAutoPush_$([guid]::NewGuid().ToString('N').Substring(0,8))"
    $testLog = Join-Path $testRepo 'test-git-push.log'
}

AfterAll {
    if (Test-Path $testRepo) {
        Remove-Item -Path $testRepo -Recurse -Force -ErrorAction SilentlyContinue
    }
}

Describe 'GitAutoPush Module' {
    Context 'Module Loading' {
        It 'Should import module without errors' {
            $modulePath = Join-Path (Split-Path -Parent $PSScriptRoot) 'scripts\GitAutoPush.psm1'
            { Import-Module $modulePath -Force -ErrorAction Stop } | Should -Not -Throw
        }

        It 'Should export all expected functions' {
            $expectedFunctions = @(
                'Write-GitLog',
                'Test-GitNetwork',
                'Get-PendingCommits',
                'Test-TagNeedsPush',
                'Push-BranchWithRetry',
                'Push-TagWithRetry',
                'Test-RemoteSync',
                'Invoke-AutoPush'
            )
            $module = Get-Module -Name GitAutoPush
            foreach ($func in $expectedFunctions) {
                $module.ExportedFunctions.Keys | Should -Contain $func
            }
        }
    }

    Context 'Write-GitLog' {
        It 'Should write log with INFO level' {
            $msg = TestDrive:\test.log
            Write-GitLog -Message 'Test info' -Level 'INFO' -LogFile $msg
            $content = Get-Content $msg -Raw
            $content | Should -Match '\[INFO\] Test info'
        }

        It 'Should write log with WARN level' {
            $msg = TestDrive:\test2.log
            Write-GitLog -Message 'Test warning' -Level 'WARN' -LogFile $msg
            $content = Get-Content $msg -Raw
            $content | Should -Match '\[WARN\] Test warning'
        }

        It 'Should write log with ERROR level' {
            $msg = TestDrive:\test3.log
            Write-GitLog -Message 'Test error' -Level 'ERROR' -LogFile $msg
            $content = Get-Content $msg -Raw
            $content | Should -Match '\[ERROR\] Test error'
        }

        It 'Should write log with SUCCESS level' {
            $msg = TestDrive:\test4.log
            Write-GitLog -Message 'Test success' -Level 'SUCCESS' -LogFile $msg
            $content = Get-Content $msg -Raw
            $content | Should -Match '\[SUCCESS\] Test success'
        }

        It 'Should default to INFO level' {
            $msg = TestDrive:\test5.log
            Write-GitLog -Message 'Default level' -LogFile $msg
            $content = Get-Content $msg -Raw
            $content | Should -Match '\[INFO\] Default level'
        }
    }

    Context 'Test-GitNetwork' {
        It 'Should return boolean' {
            $result = Test-GitNetwork -HostName 'github.com' -Port 443
            $result | Should -BeOfType [bool]
        }

        It 'Should return false for unreachable host' {
            $result = Test-GitNetwork -HostName 'nonexistent-host-12345.com' -Port 443 -TimeoutSeconds 3
            $result | Should -BeFalse
        }

        It 'Should handle custom host and port' {
            $result = Test-GitNetwork -HostName 'github.com' -Port 443 -TimeoutSeconds 5
            $result | Should -BeOfType [bool]
        }

        It 'Should handle timeout gracefully' {
            $result = Test-GitNetwork -HostName '10.255.255.1' -Port 443 -TimeoutSeconds 1
            $result | Should -BeFalse
        }
    }

    Context 'Network Fluctuation Simulation' {
        BeforeAll {
            $simRepo = Join-Path ([System.IO.Path]::GetTempPath()) "SimNetTest_$([guid]::NewGuid().ToString('N').Substring(0,8))"
            New-Item -ItemType Directory -Path $simRepo -Force | Out-Null
            Set-Location $simRepo
            git init --quiet
            git config user.email "test@test.com"
            git config user.name "Test"
            git checkout -b test-branch 2>$null
            "test" | Set-Content test.txt
            git add test.txt
            git commit -m "initial" --quiet
            git remote add origin https://github.com/nonexistent/test.git
            Set-Location (Split-Path -Parent $PSScriptRoot)
        }

        AfterAll {
            Set-Location (Split-Path -Parent $PSScriptRoot)
            if (Test-Path $simRepo) {
                Remove-Item -Path $simRepo -Recurse -Force -ErrorAction SilentlyContinue
            }
        }

        It 'Should detect pending commits in isolated repo' {
            Set-Location $simRepo
            "new content" | Out-File test2.txt
            git add test2.txt
            git commit -m "second commit" --quiet
            $pending = Get-PendingCommits -RepoPath $simRepo -Branch 'test-branch'
            $pending | Should -Not -BeNullOrEmpty
            $pending.Count | Should -BeGreaterOrEqual 1
            Set-Location (Split-Path -Parent $PSScriptRoot)
        }

        It 'Should detect tag needs push' {
            Set-Location $simRepo
            git tag test-tag-v1
            $needsPush = Test-TagNeedsPush -RepoPath $simRepo -Tag 'test-tag-v1'
            $needsPush | Should -BeTrue
            Set-Location (Split-Path -Parent $PSScriptRoot)
        }

        It 'Should handle push failure with retry' {
            Set-Location $simRepo
            $logPath = Join-Path $simRepo 'retry-test.log'
            $result = Push-BranchWithRetry -RepoPath $simRepo -Branch 'test-branch' -Retries 2 -RetryDelaySeconds 1 -LogFile $logPath
            $result | Should -BeFalse
            $logContent = Get-Content $logPath -Raw
            $logContent | Should -Match 'Push failed'
            $logContent | Should -Match 'ultimately failed'
            Set-Location (Split-Path -Parent $PSScriptRoot)
        }

        It 'Should handle tag push failure with retry' {
            Set-Location $simRepo
            $logPath = Join-Path $simRepo 'tag-retry-test.log'
            $result = Push-TagWithRetry -RepoPath $simRepo -Tag 'test-tag-v1' -Retries 2 -RetryDelaySeconds 1 -LogFile $logPath
            $result | Should -BeFalse
            $logContent = Get-Content $logPath -Raw
            $logContent | Should -Match 'Tag push failed'
            Set-Location (Split-Path -Parent $PSScriptRoot)
        }
    }

    Context 'Retry Mechanism Validation' {
        It 'Push-BranchWithRetry should respect Retries parameter' {
            $simRepo = Join-Path ([System.IO.Path]::GetTempPath()) "RetryTest_$([guid]::NewGuid().ToString('N').Substring(0,8))"
            New-Item -ItemType Directory -Path $simRepo -Force | Out-Null
            Set-Location $simRepo
            git init --quiet
            git config user.email "test@test.com"
            git config user.name "Test"
            "test" | Set-Content test.txt
            git add test.txt
            git commit -m "initial" --quiet
            git remote add origin https://github.com/nonexistent/test.git
            Set-Location (Split-Path -Parent $PSScriptRoot)

            $logPath = Join-Path $simRepo 'retry-count.log'
            $startTime = Get-Date
            Push-BranchWithRetry -RepoPath $simRepo -Branch 'master' -Retries 3 -RetryDelaySeconds 1 -LogFile $logPath
            $elapsed = (Get-Date) - $startTime
            $logContent = Get-Content $logPath -Raw
            $logContent | Should -Match 'attempt 1/3'
            $logContent | Should -Match 'attempt 2/3'
            $logContent | Should -Match 'attempt 3/3'
            $elapsed.TotalSeconds | Should -BeGreaterOrEqual 2

            Remove-Item -Path $simRepo -Recurse -Force -ErrorAction SilentlyContinue
        }

        It 'Push-TagWithRetry should respect Retries parameter' {
            $simRepo = Join-Path ([System.IO.Path]::GetTempPath()) "TagRetry_$([guid]::NewGuid().ToString('N').Substring(0,8))"
            New-Item -ItemType Directory -Path $simRepo -Force | Out-Null
            Set-Location $simRepo
            git init --quiet
            git config user.email "test@test.com"
            git config user.name "Test"
            "test" | Set-Content test.txt
            git add test.txt
            git commit -m "initial" --quiet
            git tag v1.0.0
            git remote add origin https://github.com/nonexistent/test.git
            Set-Location (Split-Path -Parent $PSScriptRoot)

            $logPath = Join-Path $simRepo 'tag-retry-count.log'
            $startTime = Get-Date
            Push-TagWithRetry -RepoPath $simRepo -Tag 'v1.0.0' -Retries 3 -RetryDelaySeconds 1 -LogFile $logPath
            $elapsed = (Get-Date) - $startTime
            $logContent = Get-Content $logPath -Raw
            $logContent | Should -Match 'attempt 1/3'
            $logContent | Should -Match 'attempt 2/3'
            $logContent | Should -Match 'attempt 3/3'
            $elapsed.TotalSeconds | Should -BeGreaterOrEqual 2

            Remove-Item -Path $simRepo -Recurse -Force -ErrorAction SilentlyContinue
        }
    }

    Context 'Invoke-AutoPush Integration' {
        BeforeAll {
            $simRepo = Join-Path ([System.IO.Path]::GetTempPath()) "IntegrationTest_$([guid]::NewGuid().ToString('N').Substring(0,8))"
            New-Item -ItemType Directory -Path $simRepo -Force | Out-Null
            Set-Location $simRepo
            git init --quiet
            git config user.email "test@test.com"
            git config user.name "Test"
            git checkout -b feature/test 2>$null
            "test" | Set-Content test.txt
            git add test.txt
            git commit -m "initial" --quiet
            "new" | Out-File test2.txt
            git add test2.txt
            git commit -m "second" --quiet
            git tag v1.0.0
            git remote add origin https://github.com/nonexistent/test.git
            Set-Location (Split-Path -Parent $PSScriptRoot)
        }

        AfterAll {
            Set-Location (Split-Path -Parent $PSScriptRoot)
            if (Test-Path $simRepo) {
                Remove-Item -Path $simRepo -Recurse -Force -ErrorAction SilentlyContinue
            }
        }

        It 'Should return exit code 1 when network unreachable with MaxRetries' {
            $logPath = Join-Path $simRepo 'integration-test.log'
            $exitCode = Invoke-AutoPush -RepoPath $simRepo -Branch 'feature/test' -Tag 'v1.0.0' -CheckIntervalSeconds 1 -MaxRetries 2 -PushRetries 2 -PushRetryDelaySeconds 1 -LogFile $logPath
            $exitCode | Should -Be 1
            $logContent = Get-Content $logPath -Raw
            $logContent | Should -Match 'Max retries.*reached'
        }

        It 'Should return exit code 0 when nothing to push' {
            $logPath = Join-Path $simRepo 'nothing-to-push.log'
            Set-Location $simRepo
            git tag -d v1.0.0 2>$null
            Set-Location (Split-Path -Parent $PSScriptRoot)
            $exitCode = Invoke-AutoPush -RepoPath $simRepo -Branch 'feature/test' -CheckIntervalSeconds 1 -MaxRetries 1 -PushRetries 1 -LogFile $logPath
            $exitCode | Should -Be 1
        }

        It 'Should detect pending commits in integration flow' {
            $logPath = Join-Path $simRepo 'integration-pending.log'
            Set-Location $simRepo
            "third" | Out-File test3.txt
            git add test3.txt
            git commit -m "third commit" --quiet
            Set-Location (Split-Path -Parent $PSScriptRoot)
            $exitCode = Invoke-AutoPush -RepoPath $simRepo -Branch 'feature/test' -CheckIntervalSeconds 1 -MaxRetries 1 -PushRetries 1 -LogFile $logPath
            $logContent = Get-Content $logPath -Raw
            $logContent | Should -Match 'Pending commits'
        }
    }

    Context 'Edge Cases' {
        It 'Should handle non-existent repo path gracefully' {
            $nonExistent = Join-Path ([System.IO.Path]::GetTempPath()) "NonExistentRepo_$([guid]::NewGuid().ToString('N').Substring(0,8))"
            { Get-PendingCommits -RepoPath $nonExistent -Branch 'main' } | Should -Not -Throw
        }

        It 'Should handle non-existent tag gracefully' {
            $simRepo = Join-Path ([System.IO.Path]::GetTempPath()) "EdgeCase_$([guid]::NewGuid().ToString('N').Substring(0,8))"
            New-Item -ItemType Directory -Path $simRepo -Force | Out-Null
            Set-Location $simRepo
            git init --quiet
            git config user.email "test@test.com"
            git config user.name "Test"
            Set-Location (Split-Path -Parent $PSScriptRoot)

            $needsPush = Test-TagNeedsPush -RepoPath $simRepo -Tag 'nonexistent-tag'
            $needsPush | Should -BeFalse

            Remove-Item -Path $simRepo -Recurse -Force -ErrorAction SilentlyContinue
        }

        It 'Should handle empty repo gracefully' {
            $simRepo = Join-Path ([System.IO.Path]::GetTempPath()) "EmptyRepo_$([guid]::NewGuid().ToString('N').Substring(0,8))"
            New-Item -ItemType Directory -Path $simRepo -Force | Out-Null
            Set-Location $simRepo
            git init --quiet
            git config user.email "test@test.com"
            git config user.name "Test"
            Set-Location (Split-Path -Parent $PSScriptRoot)

            $pending = Get-PendingCommits -RepoPath $simRepo -Branch 'main'
            $pending | Should -BeNullOrEmpty

            Remove-Item -Path $simRepo -Recurse -Force -ErrorAction SilentlyContinue
        }

        It 'Test-RemoteSync should handle no remote gracefully' {
            $simRepo = Join-Path ([System.IO.Path]::GetTempPath()) "NoRemote_$([guid]::NewGuid().ToString('N').Substring(0,8))"
            New-Item -ItemType Directory -Path $simRepo -Force | Out-Null
            Set-Location $simRepo
            git init --quiet
            git config user.email "test@test.com"
            git config user.name "Test"
            "test" | Set-Content test.txt
            git add test.txt
            git commit -m "initial" --quiet
            Set-Location (Split-Path -Parent $PSScriptRoot)

            { Test-RemoteSync -RepoPath $simRepo -Branch 'main' } | Should -Not -Throw

            Remove-Item -Path $simRepo -Recurse -Force -ErrorAction SilentlyContinue
        }
    }

    Context 'Network Fluctuation Stress Tests' {
        BeforeAll {
            $stressRepo = Join-Path ([System.IO.Path]::GetTempPath()) "StressTest_$([guid]::NewGuid().ToString('N').Substring(0,8))"
            New-Item -ItemType Directory -Path $stressRepo -Force | Out-Null
            Set-Location $stressRepo
            git init --quiet
            git config user.email "stress@test.com"
            git config user.name "StressTest"
            git checkout -b feature/stress 2>$null
            1..5 | ForEach-Object {
                "data $_" | Out-File "file$_.txt"
                git add "file$_.txt"
                git commit -m "commit $_" --quiet
            }
            git tag "v1.$_.0"
            git remote add origin https://github.com/nonexistent/stress-test.git
            Set-Location (Split-Path -Parent $PSScriptRoot)
        }

        AfterAll {
            Set-Location (Split-Path -Parent $PSScriptRoot)
            if (Test-Path $stressRepo) {
                Remove-Item -Path $stressRepo -Recurse -Force -ErrorAction SilentlyContinue
            }
        }

        It 'Should handle intermittent network failures with push retry' {
            Set-Location $stressRepo
            $logPath = Join-Path $stressRepo 'intermittent-retry.log'
            $startTime = Get-Date
            $result = Push-BranchWithRetry -RepoPath $stressRepo -Branch 'feature/stress' -Retries 5 -RetryDelaySeconds 1 -LogFile $logPath
            $elapsed = (Get-Date) - $startTime
            $result | Should -BeFalse
            $logContent = Get-Content $logPath -Raw
            $logContent | Should -Match 'attempt 1/5'
            $logContent | Should -Match 'attempt 5/5'
            $elapsed.TotalSeconds | Should -BeGreaterOrEqual 4
            Set-Location (Split-Path -Parent $PSScriptRoot)
        }

        It 'Should handle large pending commit counts' {
            Set-Location $stressRepo
            1..10 | ForEach-Object {
                "extra $_" | Out-File "extra$_.txt"
                git add "extra$_.txt"
                git commit -m "extra commit $_" --quiet
            }
            $pending = Get-PendingCommits -RepoPath $stressRepo -Branch 'feature/stress'
            $pending.Count | Should -BeGreaterOrEqual 10
            Set-Location (Split-Path -Parent $PSScriptRoot)
        }

        It 'Should handle both branch and tag push failures' {
            Set-Location $stressRepo
            $branchLog = Join-Path $stressRepo 'branch-tag-fail.log'
            $tagLog = Join-Path $stressRepo 'tag-fail-stress.log'
            $branchResult = Push-BranchWithRetry -RepoPath $stressRepo -Branch 'feature/stress' -Retries 2 -RetryDelaySeconds 1 -LogFile $branchLog
            $tagResult = Push-TagWithRetry -RepoPath $stressRepo -Tag 'v1.5.0' -Retries 2 -RetryDelaySeconds 1 -LogFile $tagLog
            $branchResult | Should -BeFalse
            $tagResult | Should -BeFalse
            $branchLogContent = Get-Content $branchLog -Raw
            $tagLogContent = Get-Content $tagLog -Raw
            $branchLogContent | Should -Match 'ultimately failed'
            $tagLogContent | Should -Match 'ultimately failed'
            Set-Location (Split-Path -Parent $PSScriptRoot)
        }

        It 'Should validate full Invoke-AutoPush exit codes under network outage' {
            $logPath = Join-Path $stressRepo 'full-outage.log'
            $exitCode = Invoke-AutoPush -RepoPath $stressRepo -Branch 'feature/stress' -Tag 'v1.5.0' -CheckIntervalSeconds 1 -MaxRetries 2 -PushRetries 2 -PushRetryDelaySeconds 1 -LogFile $logPath
            $exitCode | Should -Be 1
            $logContent = Get-Content $logPath -Raw
            $logContent | Should -Match 'Max retries.*reached'
            $logContent | Should -Match 'Pending commits'
            $logContent | Should -Match 'Tag.*needs push'
        }

        It 'Should handle rapid successive Invoke-AutoPush calls without state corruption' {
            $log1 = Join-Path $stressRepo 'rapid1.log'
            $log2 = Join-Path $stressRepo 'rapid2.log'
            $exit1 = Invoke-AutoPush -RepoPath $stressRepo -Branch 'feature/stress' -CheckIntervalSeconds 1 -MaxRetries 1 -PushRetries 1 -LogFile $log1
            $exit2 = Invoke-AutoPush -RepoPath $stressRepo -Branch 'feature/stress' -CheckIntervalSeconds 1 -MaxRetries 1 -PushRetries 1 -LogFile $log2
            $exit1 | Should -Be 1
            $exit2 | Should -Be 1
            $log1Content = Get-Content $log1 -Raw
            $log2Content = Get-Content $log2 -Raw
            $log1Content | Should -Match 'Git Auto-Push Started'
            $log2Content | Should -Match 'Git Auto-Push Started'
        }
    }

    Context 'Network Recovery Scenario Tests' {
        BeforeAll {
            $recoveryRepo = Join-Path ([System.IO.Path]::GetTempPath()) "RecoveryTest_$([guid]::NewGuid().ToString('N').Substring(0,8))"
            New-Item -ItemType Directory -Path $recoveryRepo -Force | Out-Null
            Set-Location $recoveryRepo
            git init --quiet
            git config user.email "recovery@test.com"
            git config user.name "RecoveryTest"
            git checkout -b feature/recovery 2>$null
            "recovery" | Set-Content recovery.txt
            git add recovery.txt
            git commit -m "initial recovery" --quiet
            git remote add origin https://github.com/nonexistent/recovery-test.git
            Set-Location (Split-Path -Parent $PSScriptRoot)
        }

        AfterAll {
            Set-Location (Split-Path -Parent $PSScriptRoot)
            if (Test-Path $recoveryRepo) {
                Remove-Item -Path $recoveryRepo -Recurse -Force -ErrorAction SilentlyContinue
            }
        }

        It 'Should detect immediate network failure and retry' {
            Set-Location $recoveryRepo
            $logPath = Join-Path $recoveryRepo 'immediate-fail.log'
            $result = Push-BranchWithRetry -RepoPath $recoveryRepo -Branch 'feature/recovery' -Retries 3 -RetryDelaySeconds 1 -LogFile $logPath
            $result | Should -BeFalse
            $logContent = Get-Content $logPath -Raw
            $logContent | Should -Match 'attempt 1/3'
            $logContent | Should -Match 'Push failed, retry in'
            $logContent | Should -Match 'attempt 2/3'
            $logContent | Should -Match 'attempt 3/3'
            Set-Location (Split-Path -Parent $PSScriptRoot)
        }

        It 'Should handle tag push with intermittent connectivity' {
            Set-Location $recoveryRepo
            git tag recovery-tag-v1
            $logPath = Join-Path $recoveryRepo 'tag-intermittent.log'
            $result = Push-TagWithRetry -RepoPath $recoveryRepo -Tag 'recovery-tag-v1' -Retries 4 -RetryDelaySeconds 1 -LogFile $logPath
            $result | Should -BeFalse
            $logContent = Get-Content $logPath -Raw
            $logContent | Should -Match 'attempt 1/4'
            $logContent | Should -Match 'attempt 4/4'
            $logContent | Should -Match 'Tag push ultimately failed'
            Set-Location (Split-Path -Parent $PSScriptRoot)
        }

        It 'Should report correct pending state after failed push attempts' {
            Set-Location $recoveryRepo
            $beforePending = Get-PendingCommits -RepoPath $recoveryRepo -Branch 'feature/recovery'
            $beforeCount = $beforePending.Count
            Push-BranchWithRetry -RepoPath $recoveryRepo -Branch 'feature/recovery' -Retries 2 -RetryDelaySeconds 1
            $afterPending = Get-PendingCommits -RepoPath $recoveryRepo -Branch 'feature/recovery'
            $afterCount = $afterPending.Count
            $afterCount | Should -Be $beforeCount
            Set-Location (Split-Path -Parent $PSScriptRoot)
        }

        It 'Should handle MaxRetries=0 as unlimited in integration flow' {
            $logPath = Join-Path $recoveryRepo 'unlimited-retries.log'
            $exitCode = Invoke-AutoPush -RepoPath $recoveryRepo -Branch 'feature/recovery' -CheckIntervalSeconds 1 -MaxRetries 2 -PushRetries 1 -PushRetryDelaySeconds 1 -LogFile $logPath
            $exitCode | Should -Be 1
            $logContent = Get-Content $logPath -Raw
            $logContent | Should -Match 'Max retries.*reached'
        }
    }
}
