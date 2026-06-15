$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Resolve-Path (Join-Path $scriptDir "..\..")
$releaseRoot = Join-Path $projectRoot "release"
$releasePrefix = (Join-Path $projectRoot "release-").ToLowerInvariant()

function Remove-BuildArtifact {
  param([string] $Path)

  $fullPath = [System.IO.Path]::GetFullPath($Path)
  $releaseFullPath = [System.IO.Path]::GetFullPath($releaseRoot)
  if (-not $fullPath.StartsWith($releaseFullPath, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to remove path outside release: $fullPath"
  }

  if (-not (Test-Path -LiteralPath $fullPath)) {
    return
  }

  for ($attempt = 1; $attempt -le 3; $attempt++) {
    try {
      Remove-Item -LiteralPath $fullPath -Recurse -Force -ErrorAction Stop
      return
    } catch {
      if ($attempt -eq 3) {
        throw
      }
      Start-Sleep -Milliseconds 700
    }
  }
}

function Test-IsProjectBuildProcess {
  param([System.Diagnostics.Process] $Process)

  $path = $null
  try {
    $path = $Process.Path
  } catch {
    return $false
  }

  if ([string]::IsNullOrWhiteSpace($path)) {
    return $false
  }

  $normalized = $path.ToLowerInvariant()
  return $normalized.StartsWith((Join-Path $releaseRoot "win-unpacked\AIstudy.exe").ToLowerInvariant()) -or
    $normalized.StartsWith($releasePrefix)
}

Set-Location $projectRoot

Write-Host "[AIstudy] Closing old packaged app instances..."
$oldProcesses = Get-Process -Name "AIstudy" -ErrorAction SilentlyContinue | Where-Object { Test-IsProjectBuildProcess $_ }

if ($oldProcesses) {
  foreach ($process in $oldProcesses) {
    Write-Host ("[AIstudy] Stop PID {0}: {1}" -f $process.Id, $process.Path)
    try {
      Stop-Process -Id $process.Id -Force -ErrorAction Stop
    } catch [Microsoft.PowerShell.Commands.ProcessCommandException] {
      Write-Host ("[AIstudy] PID {0} already exited." -f $process.Id)
    }
  }
  Start-Sleep -Milliseconds 800
} else {
  Write-Host "[AIstudy] No old packaged app instance found."
}

Write-Host "[AIstudy] Cleaning stale packaging artifacts..."
Remove-BuildArtifact (Join-Path $releaseRoot "win-unpacked")
Remove-BuildArtifact (Join-Path $releaseRoot "aistudy-0.1.0-x64.nsis.7z")

if ([string]::IsNullOrWhiteSpace($env:AISTUDY_UPDATE_SUMMARY)) {
  $env:AISTUDY_UPDATE_SUMMARY = "一键打包生成安装包"
}

Write-Host "[AIstudy] Recording update index..."
& npm.cmd run update:record
if ($LASTEXITCODE -ne 0) {
  Write-Host "[AIstudy] Update index failed with exit code $LASTEXITCODE."
  exit $LASTEXITCODE
}

Write-Host "[AIstudy] Building installer..."
& npm.cmd run dist
$exitCode = $LASTEXITCODE

if ($exitCode -ne 0) {
  $prepackagedDir = Join-Path $releaseRoot "win-unpacked"
  $prepackagedExe = Join-Path $prepackagedDir "AIstudy.exe"

  if (Test-Path -LiteralPath $prepackagedExe) {
    Write-Host "[AIstudy] Standard packaging failed after win-unpacked was created."
    Write-Host "[AIstudy] Retrying installer build from prepackaged app..."
    & npx.cmd electron-builder --win nsis --prepackaged $prepackagedDir
    $exitCode = $LASTEXITCODE
  }

  if ($exitCode -ne 0) {
    Write-Host "[AIstudy] Packaging failed with exit code $exitCode."
    exit $exitCode
  }
}

Write-Host "[AIstudy] Done: release\AIstudy-Setup-0.1.0.exe"
