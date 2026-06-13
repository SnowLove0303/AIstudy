param(
  [ValidateSet("lock", "unlock", "status")]
  [string]$Action = "status"
)

$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")

$protectedDirectories = @(
  "assets",
  "dist",
  "dist-electron",
  "docs",
  "electron",
  "mcp",
  "public",
  "scripts",
  "src",
  "tools"
)

$protectedFiles = @(
  ".gitattributes",
  ".gitignore",
  "AGENTS.md",
  "MCP.ps1",
  "MCP.py",
  "package.json",
  "package-lock.json",
  "PROJECT_INDEX.md",
  "README.md",
  "release/win-unpacked/AIstudy.exe",
  "release/win-unpacked/resources/app.asar",
  "release-local-electron/win-unpacked/AIstudy.exe",
  "release-local-electron/win-unpacked/resources/app.asar",
  "tsconfig.electron.json",
  "tsconfig.json",
  "vite.config.ts"
)

function Get-ProtectedCodeFiles {
  $files = New-Object System.Collections.Generic.List[System.IO.FileInfo]

  foreach ($relativeDirectory in $protectedDirectories) {
    $directory = Join-Path $projectRoot $relativeDirectory
    if (Test-Path -LiteralPath $directory) {
      Get-ChildItem -LiteralPath $directory -Recurse -File -Force |
        Where-Object { $_.FullName -notmatch "\\node_modules\\" -and $_.FullName -notmatch "\\.tmp\\" } |
        ForEach-Object { $files.Add($_) }
    }
  }

  foreach ($relativeFile in $protectedFiles) {
    $filePath = Join-Path $projectRoot $relativeFile
    if (Test-Path -LiteralPath $filePath) {
      $files.Add((Get-Item -LiteralPath $filePath))
    }
  }

  return $files | Sort-Object FullName -Unique
}

$targets = @(Get-ProtectedCodeFiles)

switch ($Action) {
  "lock" {
    foreach ($file in $targets) {
      $file.IsReadOnly = $true
    }
    Write-Output "Code lock enabled. Protected files: $($targets.Count)"
  }
  "unlock" {
    foreach ($file in $targets) {
      $file.IsReadOnly = $false
    }
    Write-Output "Code lock disabled. Unlocked files: $($targets.Count)"
  }
  "status" {
    $lockedCount = @($targets | Where-Object { $_.IsReadOnly }).Count
    $unlockedCount = $targets.Count - $lockedCount
    Write-Output "Protected files: $($targets.Count)"
    Write-Output "Locked files: $lockedCount"
    Write-Output "Unlocked files: $unlockedCount"
  }
}
