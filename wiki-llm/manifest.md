# Manifest & Permissions

> **Maintenance Invariant:** Manifest keys, permissions, CSP, per-browser differences. Update in the SAME commit as any `wxt.config.ts` or entrypoint change. Token-optimized: imperative, no prose, no redundancy.
> **Answers:** What is requested and why. What differs per browser. What must never be dropped.

WXT generates one manifest per browser from `wxt.config.ts` plus the entrypoints. `manifestVersion: 3` is set explicitly — **WXT defaults Firefox to MV2**.

## Keys

| Key                         | Value                                                                                                                      | Why                                                                                                                                                |
| :-------------------------- | :------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------- |
| `default_locale`            | `en`                                                                                                                       | Required once `public/_locales/` exists. `i18n` needs no permission ([i18n.md](i18n.md)).                                                          |
| `description`               | `__MSG_extDescription__`                                                                                                   | Resolved per locale. `name` stays literal.                                                                                                         |
| `permissions`               | `storage`                                                                                                                  | Settings only.                                                                                                                                     |
| `host_permissions`          | `*://x.com/*`, `*://twitter.com/*`, `*://linkedin.com/*`, `*://*.linkedin.com/*`, `*://reddit.com/*`, `*://*.reddit.com/*` | Default, not optional — installing uFeed implies wanting it on the sites you use. Both patterns per site: `*.reddit.com` misses the bare domain.   |
| `web_accessible_resources`  | `engine.html`, `icon-gray/48.png`, `icon/32.png`, `_locales/*/messages.json`                                               | The iframe, the icons the card and badge show (an `<img>` cannot load an unlisted file), the catalogs a picked language reads.                     |
| `content_security_policy`   | `script-src 'self' 'wasm-unsafe-eval'`                                                                                     | **Mandatory** or ONNX Runtime will not instantiate.                                                                                                |
| `browser_specific_settings` | `gecko.id`, `strict_min_version: 115.0`, `data_collection_permissions: { required: ['none'] }`                             | Required to install on Firefox. AMO rejects a new upload without `data_collection_permissions`; Firefox < 140 ignores it (lint warning, harmless). |
| `content_scripts[].css`     | `blur.css`                                                                                                                 | Declared CSS applies before first paint; injected does not.                                                                                        |
| `content_scripts[].run_at`  | `document_start`                                                                                                           | Same reason.                                                                                                                                       |
| `icons`                     | 16→512                                                                                                                     | **Never written by hand** — WXT discovers `public/icon/<size>.png`.                                                                                |

## Per-browser

|            | Chrome / Edge                    | Firefox                               |
| :--------- | :------------------------------- | :------------------------------------ |
| Background | `service_worker`, `type: module` | `scripts` (non-persistent event page) |
| Output     | `.output/chrome-mv3`             | `.output/firefox-mv3`                 |

Both reach WebGPU `requestDevice()` from a Worker inside the injected iframe (measured, macOS), and `allow="webgpu"` is not needed. Neither model uses it: WebGPU miscomputes e5's q8 weights and EmbeddingGemma's q4 weights, and the probe rejects both ([model.md](model.md) §Backend self-check).

## Icons

Source art: `assets/logo.svg`, 512x512, outside `srcDir` so it never ships.

`public/icon/<size>.png` at 16/32/48/96/128/256/512 — WXT matches `icons?/<size>.png` and writes the `icons` key itself. Renaming the directory silently drops the icon from the manifest.

**256 and 512 exist for HiDPI**, not for any slot a browser names: every slot doubles on a 2x display, and the store listing renders 128 CSS px. Never drop them to save bytes.

**PNG, not SVG.** Firefox accepts an SVG icon; Chrome does not.

PNG compression is lossless (deflate): level 0 and level 9 are bit-identical pixel for pixel, 66KB vs 9.5KB at 128px. Never trade it for quality — there is none to gain.

Rasterizer fidelity is not a variable either: librsvg (what `sharp` uses) and Chrome's own renderer agree to a mean channel difference of 0.23/255 on this file.

Regenerate after editing the SVG (`sharp` is present transitively, not a declared dependency):

```
node -e "const s=require('sharp'),f=require('fs').readFileSync('assets/logo.svg');[16,32,48,96,128,256,512].forEach(n=>s(f,{density:1200,limitInputPixels:false}).resize(n,n,{kernel:'lanczos3'}).png().toFile(\`public/icon/\${n}.png\`))"
```

`density` sets the supersample before downscaling: 1200 rasterizes at 8533px. The source SVG has no intrinsic size (`width="100%"`), so without a density it rasterizes at 512 and any larger icon is an upscale.

**Toolbar icon starts gray** (`action.default_icon` → `public/icon-gray/`). `background.ts` colors a tab on the content script's feed message, and again on `tabs.onUpdated` `complete` for a feed host; grays on `loading` for any other host.

**Per-tab icons do not survive a commit.** Chrome clears them, and a prerendered or back/forward-cached page commits without re-running the content script. The content message alone left those tabs gray.

## ONNX Runtime

`public/ort/` holds `ort-wasm-simd-threaded.jsep.{wasm,mjs}`, synced from `node_modules` by `scripts/sync-ort.mjs` on `postinstall`. `env.backends.onnx.wasm.wasmPaths = '/ort/'`.

**Bundled, never CDN-fetched.** Remote WASM is reviewed as remote code execution. jsep only, because the default `onnxruntime-web` entry that transformers.js imports asks for the jsep files by name. Threads are unusable anyway.

Package size ~22.5MB, almost entirely that binary.

## No WASM threads

An iframe injected into a host page cannot be cross-origin isolated: the host does not send COEP. `crossOriginIsolated` is false on both browsers, so `SharedArrayBuffer` is unusable and ORT runs single-threaded. Chrome exposes the `SharedArrayBuffer` constructor anyway — existence is not usability.

**`optional_host_permissions` is gone.** Reddit was its only entry and is now a default host, so the concept left with it — see [adapters.md](adapters.md). An optional host is not a config flag: it needs a request button in the popup, `permissions.request()` from a user gesture, runtime content-script registration, and a second path through `isActive()`.
