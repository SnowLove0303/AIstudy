# Git Management

## Branches

- `main`: stable local development branch and remote default target.
- Feature work should use short-lived branches named `feature/<topic>`.
- Recovery branches are created as `rollback-safety/<timestamp>` before rollback operations.

## Local Check

Run before committing, publishing, or pushing:

```powershell
scripts/git/preflight.ps1
```

Require a clean tree for release preparation:

```powershell
scripts/git/preflight.ps1 -RequireClean
```

## Commit

Use the project commit helper so messages follow the Lore protocol:

```powershell
scripts/git/commit.ps1 -StageAll -Intent "Stabilize course knowledge base persistence" -Tested "dotnet build -p:Platform=x64"
```

The helper stages all changes only when `-StageAll` is supplied. Otherwise it commits the current staged set.

## Rollback

Create a safety branch without changing files:

```powershell
scripts/git/rollback.ps1 -Mode safety-branch
```

Revert a bad commit without rewriting history:

```powershell
scripts/git/rollback.ps1 -Mode revert-commit -Commit <sha>
```

Restore one path from an older commit:

```powershell
scripts/git/rollback.ps1 -Mode restore-path -Commit <sha> -Path src/AIStudy.App/MainWindow.xaml
```

Do not use `git reset --hard` as the normal rollback path.

## Publish

Create a release build under `artifacts/releases/<version>/win-x64` and tag it locally:

```powershell
scripts/git/publish.ps1 -Version v0.1.0-alpha.1
```

Skip tagging when preparing a disposable build:

```powershell
scripts/git/publish.ps1 -Version local-preview -SkipTag
```

## Push

If the remote has newer work, sync first:

```powershell
scripts/git/sync.ps1
```

Preview a push:

```powershell
scripts/git/push.ps1 -DryRun
```

Push the current branch:

```powershell
scripts/git/push.ps1
```

Push branch and tags:

```powershell
scripts/git/push.ps1 -IncludeTags
```

External push is intentionally separate from commit and publish steps.
The push helper fetches first and refuses to push if local history is behind or diverged.
