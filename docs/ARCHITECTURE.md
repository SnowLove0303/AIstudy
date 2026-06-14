# AI-Study Architecture

## Decision

AI-Study is a local-first personal Windows desktop application.

Use:

- C# / .NET 10 LTS for the native host, domain layer, persistence, file IO, and system integration.
- WinUI 3 for the Windows shell.
- WebView2 for embedded editor surfaces.
- TypeScript + React for the two heavy editors.
- MySQL for structured metadata, search indexes, versions, and relational queries.
- A local content-addressed blob store for large files and binary payloads.

Do not build the Word-like editor or mind-map canvas directly with native WinUI controls. Their editing complexity belongs in a browser-grade editing runtime hosted inside WebView2.

## Reference Patterns

Observed open-source patterns:

- CardMirror keeps a ProseMirror schema, importer, exporter, commands, plugins, and editor as one tightly coordinated core for Word-compatible document editing.
- draw.io Desktop wraps a mature web editor in a desktop shell and aggressively isolates network access.
- SimpleMindMap provides a complete browser mind-map canvas with XMind-style editing and import/export support.
- React Flow mind-map examples remain useful references for custom graph interactions, but not the v1 XMind-style editor foundation.
- AFFiNE and tldraw show the value of block/canvas engines with explicit stores and extensibility points.

AI-Study follows the same broad pattern: native system host, web editor runtimes, shared domain contracts, narrow bridges.

## High-Level Shape

```text
AIStudy.App                 WinUI 3 EXE shell
AIStudy.Core                domain models and invariants
AIStudy.Application         use cases and orchestration
AIStudy.Infrastructure      MySQL, blob store, OpenXML, XMind IO
AIStudy.EditorBridge        typed WebView2 message protocol

web/editors/word            Tiptap / ProseMirror document editor
web/editors/mindmap         SimpleMindMap mind-map canvas
web/shared                  editor protocol types and shared UI primitives
scripts                     build, migration, and maintenance scripts
docs                        architecture decisions and budgets
```

## Runtime Boundaries

The native host owns:

- project lifecycle
- file open/save/export
- MySQL access
- blob storage
- trust boundaries and permissions
- autosave scheduling
- crash recovery
- long-running import/export jobs

The embedded web editors own:

- cursor, selection, keyboard behavior
- drag/drop interactions
- local undo/redo inside the active editor
- rendering of document/canvas state
- command surface state such as toolbar enabled/disabled flags

The bridge owns:

- typed commands from native to editor
- typed events from editor to native
- request/response correlation IDs
- throttling and batching
- schema version checks

The database never becomes the editor runtime. It stores durable normalized state, snapshots, indexes, and references.

## Main Data Model

Use stable IDs everywhere. Never rely on display text or array position as identity.

Core entities:

- Workspace
- Project
- Document
- MindMap
- EditorSnapshot
- ChangeEvent
- Asset
- BlobRef
- SearchIndexEntry

Document editor native format:

- ProseMirror-compatible JSON envelope.
- Compressed snapshots.
- Incremental change events between snapshots.
- DOCX import/export adapters around the native format.

Mind-map native format:

- Graph/tree envelope with nodes, edges, layout hints, collapsed state, and metadata.
- Compressed snapshots.
- Incremental change events between snapshots.
- XMind import/export adapters around the native format.

## Storage Policy

MySQL stores:

- entity metadata
- current snapshot pointers
- version metadata
- search text and lightweight indexes
- node/block relational projections used by the app
- blob references by hash

Blob store stores:

- original DOCX/XMind files
- imported images and attachments
- generated preview thumbnails
- compressed snapshot payloads when too large for relational rows
- export artifacts with cache expiry

Blob keys use SHA-256 content addressing:

```text
data/blobs/sha256/ab/cd/<full-hash>
```

This prevents repeated imports, repeated images, and repeated export artifacts from inflating storage.

## Packaging

Start as an unpackaged WinUI 3 desktop app for fast local build/run loops and direct EXE launch.

Keep the design compatible with future packaged deployment by isolating:

- app data paths
- runtime prerequisites
- file associations
- update logic

## Architecture Rules

- Keep editor-specific complexity out of the native shell.
- Keep database code out of editor WebView code.
- Keep DOCX/XMind compatibility code behind import/export adapters.
- Keep all cross-boundary messages typed and versioned.
- Keep native and web state synchronized through explicit commands/events, not shared mutable objects.
- Treat the browser editor as untrusted relative to the filesystem; file access goes through the native host.
