param(
    [string]$Version = "v0.1.0-alpha.$(Get-Date -Format 'yyyyMMddHHmm')",
    [switch]$SkipTag,
    [switch]$Push
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$ProjectPath = Join-Path $RepoRoot 'src\AIStudy.App\AIStudy.App.csproj'
$OutputPath = Join-Path $RepoRoot "artifacts\releases\$Version\win-x64"
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
    & (Join-Path $RepoRoot 'scripts\git\preflight.ps1') -RequireClean
    & $Dotnet publish $ProjectPath -c Release -p:Platform=x64 -r win-x64 --self-contained true -o $OutputPath

    if (-not $SkipTag) {
        git tag -a $Version -m "Release $Version"
    }

    if ($Push) {
        & (Join-Path $RepoRoot 'scripts\git\push.ps1') -IncludeTags
    }

    Write-Host "Published: $OutputPath"
}
finally {
    Pop-Location
}

