param(
    [switch]$RequireClean,
    [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$ProjectPath = Join-Path $RepoRoot 'src\AIStudy.App\AIStudy.App.csproj'
$DefaultDotnet = 'F:\AIAPP\Codex\.dotnet\sdk9\dotnet.exe'
$Dotnet = if ($env:AISTUDY_DOTNET -and (Test-Path $env:AISTUDY_DOTNET)) {
    $env:AISTUDY_DOTNET
} elseif (Test-Path $DefaultDotnet) {
    $DefaultDotnet
} else {
    'dotnet'
}

Push-Location $RepoRoot
try {
    git status --short --branch

    if ($RequireClean) {
        $dirty = git status --porcelain
        if ($dirty) {
            throw 'Working tree must be clean.'
        }
    }

    if (-not $SkipBuild) {
        & $Dotnet build $ProjectPath -p:Platform=x64
    }
}
finally {
    Pop-Location
}

