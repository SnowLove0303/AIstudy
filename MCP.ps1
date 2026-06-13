[CmdletBinding()]
param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]] $RemainingArgs
)

$ErrorActionPreference = "Stop"
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $scriptRoot
$mcpPython = Join-Path $scriptRoot "MCP.py"

[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding
$env:PYTHONUTF8 = "1"

$pythonLauncher = Get-Command py -ErrorAction SilentlyContinue
if ($pythonLauncher) {
  & py -3 $mcpPython @RemainingArgs
  exit $LASTEXITCODE
}

$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) {
  Write-Error "Python was not found. Install Python or add python/py to PATH."
  exit 1
}

& python $mcpPython @RemainingArgs
exit $LASTEXITCODE
