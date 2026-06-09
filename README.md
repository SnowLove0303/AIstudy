# AIstudy

AIstudy is a Windows desktop learning system built with Electron, React, TypeScript, and Vite.

## Version

Current source version: `1.0.16`

## Features

- Modern desktop shell with sidebar navigation.
- Dashboard with zero-state learning data.
- Course center with local course creation.
- Course workspace with fixed outline, knowledge points, and mind map modes.
- Mind map editing powered by `mind-elixir`.
- Mind map layout, node, element, view, text style, and annotation tools.
- Infinite-style mind map canvas with drag, pan controls, and arrow-key shortcuts.
- Settings page with shortcut settings.
- Update manager with versioned release notes.

## Project Layout

```text
electron/          Electron main process
src/               React renderer source
src/main.tsx       Main UI and feature implementation
src/styles.css     App styling
src/updateLog.ts   In-app update log
assets/            App icon and source assets
public/            Renderer public assets
release/           Local packaging output, ignored by Git
```

## Local Storage

- Courses: `aistudy:courses:v1`
- Settings: `aistudy:settings:v1`

## Commands

```bash
npm install
npm run dev
npm run lint
npm run build
npm run pack
npm run dist
```

## Output

After packaging, the local unpacked executable is:

```text
release/win-unpacked/AIstudy.exe
```

The desktop shortcut currently points to:

```text
C:\Users\52882\Desktop\AIstudy.lnk
```
