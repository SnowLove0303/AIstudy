# Code And Memory Growth Controls

## Goals

Prevent two failure modes from the beginning:

- codebase growth into a tangled editor/application/database monolith
- memory growth from loading whole files, whole histories, or all editor surfaces at once

## Code Growth Rules

Use project boundaries as hard ownership boundaries:

```text
AIStudy.App -> Application -> Core
AIStudy.Infrastructure -> Application/Core
AIStudy.EditorBridge -> Application/Core contracts
web/editors/* -> web/shared protocol types only
```

Forbidden dependencies:

- Core depending on Infrastructure.
- Web editor code opening files or connecting to MySQL.
- WinUI pages directly manipulating database tables.
- Import/export adapters directly changing UI state.

Feature modules must expose narrow use cases instead of leaking helpers everywhere.

## Editor Growth Rules

Each editor is its own package:

```text
web/editors/word
web/editors/mindmap
web/shared
```

Do not create one giant web app that contains every editor forever in memory.

Load editors on demand:

- open word editor bundle only when a document editor tab is active
- open mind-map bundle only when a mind-map tab is active
- dispose inactive WebView2 instances after a configurable idle period

Shared code must stay genuinely shared:

- protocol types
- theme tokens
- asset client
- logging client

No dumping ground utilities.

## Storage Growth Rules

- Use SHA-256 content addressing for blobs.
- Store original imports once.
- Store generated exports as expiring cache unless explicitly archived.
- Store compressed snapshots periodically, not per edit.
- Store incremental changes between snapshots.
- Compact old change events after a snapshot is trusted.
- Keep search indexes rebuildable from source data.

Suggested defaults:

- autosave debounce: 2 seconds after last edit
- snapshot interval: every 50 change events or 5 minutes
- export cache expiry: 7 days
- undo history limit per editor: 200 user-visible steps
- maximum open heavy editors: 2 by default

## Memory Growth Rules

Native host:

- Stream DOCX/XMind import/export when possible.
- Keep binary assets out of managed object graphs; use blob references.
- Avoid loading all project documents at startup.
- Use paged search results.
- Cache thumbnails with an explicit size limit.

Word editor:

- Keep one active ProseMirror editor per visible document pane.
- Do not keep full historical snapshots in the browser.
- Keep images blob-backed; avoid base64 image payloads in editor JSON except for tiny placeholders.
- Normalize pasted HTML early and discard unsupported structure.

Mind-map editor:

- Render visible/interacting nodes first.
- Keep large assets outside node state.
- Store layout hints separately from semantic node data.
- Throttle drag updates crossing the native bridge.
- Persist final drag positions after interaction settles.

Bridge:

- Do not send full document JSON on every change.
- Batch high-frequency events such as selection, drag, scroll, and viewport changes.
- Use request/response snapshots only for save, export, or recovery points.

## Performance Budgets

Initial local budgets:

| Area | Budget |
| --- | --- |
| Cold start to shell | under 3 seconds on developer machine |
| Opening editor surface | under 1.5 seconds after shell loaded |
| Autosave blocking UI | 0 milliseconds; all IO off UI thread |
| Editor input latency | under 50 ms for normal typing |
| Mind-map drag latency | target 60 FPS for small/medium maps |
| Main process memory after shell | under 250 MB before opening editors |
| Each active WebView editor | target under 300 MB for medium files |

Budgets are guardrails, not promises. If a feature breaks a budget, the feature needs lazy loading, batching, virtualization, or a smaller v1 scope.

## Review Checklist

Before adding a feature, answer:

- Which layer owns it?
- Can it be loaded lazily?
- Does it require whole-file state?
- Does it duplicate an existing abstraction?
- Does it introduce a new dependency?
- What is the disposal path?
- What is the smallest test or benchmark proving it does not regress memory/performance?

