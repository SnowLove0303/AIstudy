param(
    [Parameter(Mandatory = $true)]
    [string]$Intent,

    [string]$Body = '',
    [string]$Constraint = 'Local-first WinUI app with MySQL-backed course data.',
    [string]$Rejected = 'Direct remote mutation | commits stay local until push is explicitly requested.',
    [ValidateSet('low', 'medium', 'high')]
    [string]$Confidence = 'medium',
    [ValidateSet('narrow', 'moderate', 'broad')]
    [string]$ScopeRisk = 'moderate',
    [string]$Directive = 'Keep changes small, reversible, and validated before release.',
    [string]$Tested = 'Run scripts/git/preflight.ps1 before publishing.',
    [string]$NotTested = 'External push and downstream release verification unless explicitly run.',
    [switch]$StageAll
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$TempDir = Join-Path $RepoRoot '.tmp\git'
New-Item -ItemType Directory -Path $TempDir -Force | Out-Null

Push-Location $RepoRoot
try {
    if ($StageAll) {
        git add -A
    }

    $staged = git diff --cached --name-only
    if (-not $staged) {
        throw 'No staged changes to commit. Use -StageAll or stage files first.'
    }

    $messagePath = Join-Path $TempDir 'COMMIT_EDITMSG'
    $lines = @($Intent.Trim(), '')
    if ($Body.Trim().Length -gt 0) {
        $lines += $Body.Trim()
        $lines += ''
    }

    $lines += @(
        "Constraint: $Constraint",
        "Rejected: $Rejected",
        "Confidence: $Confidence",
        "Scope-risk: $ScopeRisk",
        "Directive: $Directive",
        "Tested: $Tested",
        "Not-tested: $NotTested"
    )

    Set-Content -Path $messagePath -Value $lines -Encoding UTF8
    git commit -F $messagePath
}
finally {
    Pop-Location
}

