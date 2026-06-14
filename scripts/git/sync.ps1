param(
    [string]$Remote = 'origin',
    [string]$Branch = ''
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

    $dirty = git status --porcelain
    if ($dirty) {
        throw 'Working tree is not clean. Commit or stash changes before syncing.'
    }

    git fetch $Remote $Branch
    $remoteRef = "$Remote/$Branch"
    $remoteExists = git rev-parse --verify --quiet $remoteRef
    if (-not $remoteExists) {
        Write-Output "Remote branch '$remoteRef' does not exist. Nothing to sync."
        exit 0
    }

    git rebase $remoteRef
}
finally {
    Pop-Location
}
