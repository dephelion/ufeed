# Manifest & Permissions

> **Maintenance Invariant:** Manifest keys, permissions, CSP, per-browser differences. Update in the SAME commit as any `wxt.config.ts` or entrypoint change. Token-optimized: imperative, no prose, no redundancy.
> **Answers:** What is requested and why. What differs per browser. What must never be dropped.

WXT generates one manifest per browser from `wxt.config.ts` plus the entrypoints. `manifestVersion: 3` is set explicitly — **WXT defaults Firefox to MV2**.

## Keys

| Key                          | Value                                            | Why                                                     |
| :--------------------------- | :----------------------------------------------- | :------------------------------------------------------ |
| `permissions`                | `storage`                                        | Settings only.                                          |
| `host_permissions`           | `*://x.com/*`, `*://twitter.com/*`               | Minimal at install.                                     |
| `optional_host_permissions`  | `*://reddit.com/*`, `*://*.reddit.com/*`         | Granted on request. Both patterns: `*.reddit.com` misses the bare domain. |
| `web_accessible_resources`   | `engine.html`                                    | The iframe the content script injects.                  |
| `content_security_policy`    | `script-src 'self' 'wasm-unsafe-eval'`           | **Mandatory** or ONNX Runtime will not instantiate.     |
| `browser_specific_settings`  | `gecko.id`, `strict_min_version: 115.0`          | Required to install on Firefox.                         |
| `content_scripts[].css`      | `blur.css`                                       | Declared CSS applies before first paint; injected does not. |
| `content_scripts[].run_at`   | `document_start`                                 | Same reason.                                            |

## Per-browser

| | Chrome / Edge | Firefox |
| :-- | :-- | :-- |
| Background | `service_worker`, `type: module` | `scripts` (non-persistent event page) |
| Output | `.output/chrome-mv3` | `.output/firefox-mv3` |

Both reach `requestDevice()` from a Worker inside the injected iframe (measured, macOS). `allow="webgpu"` is **not** needed: Chrome logs "Unrecognized feature" and ignores it.

## ONNX Runtime

`public/ort/` holds `ort-wasm-simd-threaded.jsep.{wasm,mjs}`, synced from `node_modules` by `scripts/sync-ort.mjs` on `postinstall`. `env.backends.onnx.wasm.wasmPaths = '/ort/'`.

**Bundled, never CDN-fetched.** Remote WASM is reviewed as remote code execution. jsep only — it serves both WebGPU and the CPU fallback, and threads are unusable anyway.

Package size ~22.5MB, almost entirely that binary.

## No WASM threads

An iframe injected into a host page cannot be cross-origin isolated: the host does not send COEP. `crossOriginIsolated` is false on both browsers, so `SharedArrayBuffer` is unusable and ORT runs single-threaded. Chrome exposes the `SharedArrayBuffer` constructor anyway — existence is not usability.
