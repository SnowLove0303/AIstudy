$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$sandboxRoot = Join-Path $projectRoot ".claude-content-sandbox"
$contextRoot = Join-Path $sandboxRoot "context"
$inboxRoot = Join-Path $sandboxRoot "inbox"
$outboxRoot = Join-Path $sandboxRoot "outbox"

New-Item -ItemType Directory -Path $contextRoot, $inboxRoot, $outboxRoot -Force | Out-Null

$contextFiles = @(
  @{ Source = "README.md"; Target = "PROJECT_README.md" },
  @{ Source = "PROJECT_INDEX.md"; Target = "PROJECT_INDEX.md" },
  @{ Source = "docs/mcp-notion-knowledge-import.md"; Target = "MCP_NOTION_KNOWLEDGE_IMPORT.md" },
  @{ Source = "mcp/aistudy-notion-knowledge-import.contract.json"; Target = "MCP_CONTRACT.json" }
)

foreach ($item in $contextFiles) {
  $sourcePath = Join-Path $projectRoot $item.Source
  if (Test-Path -LiteralPath $sourcePath) {
    Copy-Item -LiteralPath $sourcePath -Destination (Join-Path $contextRoot $item.Target) -Force
  }
}

$runtimeContext = @"
# AIstudy Runtime Paths

Generated: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

Project root:
$projectRoot

Claude content sandbox:
$sandboxRoot

Runtime data directory:
C:\Users\52882\AppData\Roaming\aistudy\data

Writable draft output:
$outboxRoot

Rule:
Claude Code should write drafts into outbox only. AIstudy or the operator applies drafts to runtime data.
"@

Set-Content -LiteralPath (Join-Path $contextRoot "RUNTIME_PATHS.md") -Value $runtimeContext -Encoding UTF8

Write-Output "Claude content sandbox prepared:"
Write-Output $sandboxRoot
