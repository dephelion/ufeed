# Lensing

Pick your topics. Everything else in your feed gets blurred — still there, one
click away. The model runs entirely on your device; no post text ever leaves it.

## Quickstart

```bash
npm install
npm run dev              # Chrome, live reload
npm run dev:firefox      # Firefox
npm run compile && npm test
```

Load an unpacked build from `.output/chrome-mv3` or `.output/firefox-mv3`.

## Layout

```
src/
  ml/          scoring (pure) and the embedder — the only transformers.js import
  core/        message protocol, score cache, settings
  adapters/    per-site DOM knowledge; X today
  content/     host-page logic: blur controller, engine client
  entrypoints/ content script, engine iframe + worker, background, popup
  ui/          blur stylesheet
public/ort/    ONNX runtime, synced from node_modules by scripts/sync-ort.mjs
spikes/        throwaway harnesses and captured data
```

## Source of truth

[`spec.md`](spec.md) is authoritative until v1, then migrates to `wiki-llm/`.
Agent rules are in [`AGENTS.md`](AGENTS.md).
