# AIstudy Agent Instructions

- Every user-visible update is a version.
- Before final delivery, add a new entry to `src/updateLog.ts` for the current update.
- Keep entries newest first, and include `功能更新`, `修复说明`, and `优化说明` for every version.
- Version notes must describe user-facing functionality only, in concise wording.
- Do not rely on memory or judgment to decide whether to write update notes; treat this file as the standing rule.
