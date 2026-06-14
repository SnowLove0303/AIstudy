param(
    [string]$Remote = 'origin',
    [string]$Branch = '',
    [switch]$IncludeTags,
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path

Push-Location $RepoRoot
try {
    $remoteUrl = git remote get-url $Remote 2>$null
    if (-not $remoteUrl) {
        throw "Remote '$Remote' is not configured."
    }

    if (-not $Branch) {
        $Branch = git branch --show-current
    }

    if (-not $Branch) {
        throw 'Current branch could not be determined.'
    }

    git fetch $Remote $Branch --quiet
    $remoteRef = "$Remote/$Branch"
    $remoteExists = git rev-parse --verify --quiet $remoteRef
    if ($remoteExists) {
        git merge-base --is-ancestor $remoteRef HEAD
        if ($LASTEXITCODE -ne 0) {
            throw "Local '$Branch' is behind or diverged from '$remoteRef'. Run scripts/git/sync.ps1 before pushing."
        }
    }

    $args = @('push')
    if ($DryRun) {
        $args += '--dry-run'
    }
    $args += @('-u', $Remote, $Branch)
    git @args

    if ($IncludeTags) {
        $tagArgs = @('push')
        if ($DryRun) {
            $tagArgs += '--dry-run'
        }
        $tagArgs += @($Remote, '--tags')
        git @tagArgs
    }
}
finally {
    Pop-Location
}
