param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('safety-branch', 'revert-commit', 'restore-path')]
    [string]$Mode,

    [string]$Commit,
    [string]$Path,
    [string]$BranchPrefix = 'rollback-safety'
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')

Push-Location $RepoRoot
try {
    $dirty = git status --porcelain
    if ($dirty -and $Mode -ne 'safety-branch') {
        throw 'Working tree is dirty. Commit, stash, or run safety-branch first.'
    }

    $timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $safetyBranch = "$BranchPrefix/$timestamp"
    git branch $safetyBranch
    Write-Host "Safety branch created: $safetyBranch"

    switch ($Mode) {
        'safety-branch' {
            return
        }
        'revert-commit' {
            if (-not $Commit) {
                throw 'Commit is required for revert-commit.'
            }

            git revert --no-edit $Commit
        }
        'restore-path' {
            if (-not $Commit -or -not $Path) {
                throw 'Commit and Path are required for restore-path.'
            }

            git restore --source $Commit -- $Path
            git status --short
        }
    }
}
finally {
    Pop-Location
}

