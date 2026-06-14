# Mind-Map Canvas Library Research

## Decision

Use `simple-mind-map` as the first embedded mind-map canvas.

Use it inside the existing WebView2 editor strategy:

```text
WinUI shell -> WebView2 -> bundled Vite mindmap editor -> simple-mind-map
```

The editor bundle must stay local. Do not load scripts from a CDN or remote application at runtime.

## Why

`simple-mind-map` is the closest match for an XMind-style embedded editor:

- MIT licensed.
- Browser-based JavaScript library, framework-agnostic.
- Supports topic drag, canvas pan/zoom, shortcuts, undo/redo, relationship lines, mini map, search, and themes.
- Supports export to `json`, `png`, `svg`, `pdf`, `markdown`, `xmind`, and `txt`.
- Supports import from `json`, `xmind`, and `markdown`.
- Plugin architecture allows v1 to import only the features AI-Study needs instead of bundling the whole demo application.

The upstream README says the open-source library and web code are in low-maintenance mode, so AI-Study should keep a thin integration layer and avoid depending on upstream UI internals.

## Candidate Notes

| Candidate | Fit | Notes |
| --- | --- | --- |
| `wanglin2/mind-map` / `simple-mind-map` | Strong | Best match for complete XMind-like local canvas and `.xmind` support. Use the library, not the full Vue demo app. |
| `xyflow/react-flow-mindmap-app` | Medium | Very small Vite/React example with drag-create and editable nodes, but not a full XMind editor and no `.xmind` support. Good fallback/reference for custom graph interactions. |
| `jinzcdev/markxmind` | Medium | Browser-only, MIT, imports/exports `.xmind`, but its primary editing model is text/markup plus preview rather than direct drag canvas. Useful as a format/import reference. |
| `wisemapping/wisemapping-open-source` | Low for embed | Feature-rich and imports XMind, but it is a larger self-hosted app stack rather than a small local editor component. |
| `plait-board/drawnix` | Low for v1 | Modern whiteboard with mind maps, MIT, active, but broader than AI-Study needs and carries more dependency surface. Consider later if AI-Study needs a full whiteboard. |
| `markmap/markmap` | Low for v1 | Excellent Markdown-to-mindmap renderer, MIT, but not an XMind-style drag editor. |
| `xmindltd/xmind-sdk-js` | Format helper | Official MIT SDK for XMind file generation. Keep as a possible adapter dependency if SimpleMindMap export is not enough. |
| `xmindltd/xmind-generator` | Format helper | Official MIT generator for creating XMind files. Consider for export tests or native adapter comparison. |

## Initial Integration Shape

Create a dedicated web editor package:

```text
web/editors/mindmap
  src/main.ts
  src/MindMapHost.ts
  src/bridge/protocol.ts
  src/adapters/aiStudyMindMap.ts
  src/adapters/xmind.ts
```

Import only required plugins at v1:

- `Drag`
- `Select`
- `KeyboardNavigation`
- `Export`
- `ExportXMind`
- `AssociativeLine`
- `Search`
- `MiniMap` only if memory remains acceptable

Avoid importing the upstream Vue web application.

## Native Boundary

The WebView editor owns interaction state. The WinUI host owns files, persistence, and database access.

Native to editor:

- `LoadMindMap`
- `ApplyMindMapCommand`
- `SetTheme`
- `SetReadonly`
- `RequestMindMapSnapshot`

Editor to native:

- `MindMapReady`
- `MindMapChanged`
- `MindMapSelectionChanged`
- `MindMapCommandStateChanged`
- `PersistMindMapSnapshot`
- `ReportMindMapError`

Throttle high-frequency drag and viewport messages. Do not send the whole map during every drag frame.

## Storage Controls

Store AI-Study's own mind-map envelope as the live format. Treat `.xmind` as import/export.

Keep large payloads out of node state:

- images become blob references
- original `.xmind` files are content-addressed blobs
- snapshots are compressed periodically
- change events are compacted after trusted snapshots

## License Note

`simple-mind-map` is MIT, and its README asks downstream products to preserve copyright attribution and source notice. Add it to the app's open-source notices before any packaged release.

