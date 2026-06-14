# Editor Architecture

## Decision

AI-Study has two embedded editor runtimes:

- Word editor: Tiptap / ProseMirror in WebView2.
- Mind-map editor: SimpleMindMap in WebView2.

Both editors are built with TypeScript and bundled with Vite. The native WinUI app loads the built local assets, never remote editor JavaScript.

## Why WebView2

Rich document editing and drag-based canvas editing require mature browser capabilities:

- DOM selection and composition events
- clipboard and paste normalization
- IME behavior
- drag/drop and pointer events
- CSS layout
- canvas/SVG/HTML hybrid rendering
- mature editor ecosystems

WinUI remains the application shell. WebView2 is only the embedded editor surface.

## Word Editor

Use ProseMirror concepts as the foundation:

- schema
- document tree
- transactions
- commands
- plugin state
- NodeViews
- history

Use Tiptap for practical extension ergonomics, but keep project-specific schema and serialization under our control.

Internal format:

```text
AiStudyDocumentEnvelope
  format: "ai-study-doc"
  formatVersion
  documentId
  schemaVersion
  pmDoc
  assets
  metadata
```

DOCX is an interchange format, not the live editing format.

Import path:

```text
DOCX -> OpenXML reader -> AiStudy document model -> ProseMirror JSON -> editor
```

Export path:

```text
editor -> ProseMirror JSON -> AiStudy document model -> OpenXML writer -> DOCX
```

Initial scope:

- paragraphs
- headings
- bold/italic/underline
- lists
- tables
- images as blob-backed assets
- page break markers
- basic comments or annotations later

Explicit non-goal for v1:

- perfect Microsoft Word layout equivalence
- byte-equivalent DOCX round trips
- full track-changes fidelity

The contract is semantic preservation and useful visual editing.

## Mind-Map Editor

Use SimpleMindMap for the v1 mind-map canvas because it already provides the XMind-like interaction surface AI-Study needs:

- draggable topic nodes
- canvas pan and zoom
- selection and multi-select plugins
- keyboard navigation and undo/redo plugins
- collapse and expand
- relationship lines
- XMind import/export plugins
- theme and layout configuration

Use React Flow only as a fallback for custom graph-style features that do not belong in a tree-first XMind workflow.

Internal format:

```text
AiStudyMindMapEnvelope
  format: "ai-study-mindmap"
  formatVersion
  mindMapId
  schemaVersion
  rootNodeId
  nodes
  edges
  layout
  collapsed
  assets
  metadata
```

XMind is an interchange format, not the live editing format.

Import path:

```text
XMind .xmind -> SimpleMindMap import adapter -> AiStudy mind-map model -> SimpleMindMap data
```

Export path:

```text
SimpleMindMap data -> AiStudy mind-map model -> SimpleMindMap/XMind export adapter -> .xmind
```

Initial scope:

- central topic
- child topics
- sibling topics
- drag reorder
- edit text
- collapse/expand
- simple relationship edges
- basic theme data

## Native Bridge

Use message passing rather than broad host-object access.

Native to editor:

```text
LoadDocument
LoadMindMap
ApplyCommand
SetTheme
SetReadonly
RequestDirtyState
RequestSnapshot
```

Editor to native:

```text
EditorReady
ContentChanged
SelectionChanged
CommandStateChanged
RequestAsset
PersistSnapshot
ReportError
```

Every message includes:

- protocolVersion
- messageId
- editorId
- payload

Large payloads are passed by blob reference when practical. Avoid repeatedly sending whole documents across the bridge during editing.

## Autosave

Autosave is native-host coordinated:

1. Editor emits small change notifications.
2. Native starts or resets a debounce timer.
3. Native requests a compact snapshot only at save points.
4. Native writes a change event and, periodically, a compressed snapshot.

Do not write full snapshots on every keystroke.

## Editor Isolation

- Load only bundled local editor assets.
- Disable or block unexpected external navigation.
- Keep file access in native code.
- Keep database credentials out of JavaScript.
- Route assets through a native asset service with explicit IDs.
