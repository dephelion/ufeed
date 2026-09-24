# Store listing

Copy to paste into the Chrome Web Store and Firefox Add-ons dashboards, plus the answers the review form
asks for. Kept in the repo so the listing and the code change together.

## Identity

| Field          | Value                                                                     |
| :------------- | :------------------------------------------------------------------------ |
| Name           | uFeed: Feed Cleaner for Social Networks                                   |
| Version        | 0.9.1 — pre-1.0 while it is finding its first users                       |
| Category       | Productivity                                                              |
| Language       | English                                                                   |
| Support email  | contact@dephelion.com                                                     |
| Support URL    | https://github.com/dephelion/ufeed/issues/new/choose                      |
| Privacy policy | https://ufeed.es/privacy/                                                 |
| Visibility     | Public — listed in search and category browsing                           |
| Store URL      | https://chromewebstore.google.com/detail/ahlojbckjlffcfdhmkjepaglnhhpmdck |

A Chrome Web Store developer account requires a one-time 5 USD registration fee
before anything can be published.

## Short description (132 char max)

Name the topics you want; uFeed blurs the rest on X, LinkedIn and Reddit. Private, on-device, open source, no account.

## Detailed description

Social networks are deciding what you see. uFeed lets you decide instead.

🔒 Private and fast. Everything runs on your device. No account, no cloud, no analytics. Your feed is never uploaded, stored or logged.

📝 Write your topics, one per line. Posts that don't match get blurred and collapsed, never
deleted. One click shows them.

🚫 Block words or phrases with the blacklist. Matching posts blur even when they are on topic.

🌍 Reads English by default. For any other language, switch to the optional
multilingual model (197 MB) in the popup.

👍 Optional thumbs let you correct it. Off by default, kept only on your device.

💾 Backup and import your settings anywhere.

📖 Open source. Read the code, build it, fork it.

It reads words, not images, and matches subject, not quality. It can miss sarcasm, and it won't be perfect.

## Single purpose

uFeed has one purpose: help people focus their social feed by blurring posts
outside topics they choose. The first-install welcome page explains how to get
started. Every permission and code path supports that purpose.

## Permission justifications

**Host access to x.com, twitter.com, linkedin.com, reddit.com**

uFeed must read the text of posts in the page to compare them against the
user's topics, and must modify the page to apply the blur. Both require
running a content script on those sites. These four are the only sites it
supports, and the only ones requested; it requests no wildcard host access.

**`storage`**

Stores the user's topics, blocked keywords, strictness and toggles, plus optional thumb ratings,
in local extension storage. Nothing is synced or transmitted.

**Remote code — none**

uFeed executes no remote code. The ONNX Runtime WebAssembly binary is
bundled in the package and loaded from an extension-relative path. On a first installation in Chrome or Firefox, the extension opens its welcome page at ufeed.es. This normal
page request reveals the visitor's IP address, standard browser request details
and language path to the site host. When first needed, the browser downloads
the selected model **weights** (data files, not code) from Hugging Face
(`huggingface.co`, redirecting to its `hf.co` CDN), which reveals the IP
address and requested model to Hugging Face. Neither request includes feed
content or extension settings. The browser then caches model weights; the
default model is about 33 MB and the optional multilingual model is about 197 MB.

## Data usage disclosure

Answer **"No"** to every collection category. For the certifications:

- Not being sold to third parties — **true**.
- Not being used or transferred for purposes unrelated to the single purpose — **true**.
- Not being used or transferred to determine creditworthiness or for lending — **true**.

Personally identifiable information, health, financial, authentication,
location, web history, user activity, and website content are all **not
collected**: post text is read in memory and discarded, and nothing is
transmitted anywhere.

Note on "website content": uFeed reads post text in the page. It is not
_collected_ — it is never stored and never transmitted — so the answer is no.
If a reviewer queries it, the explanation is that scoring happens entirely in
the content script and a Web Worker, and the result is a number applied to the
page.

## Firefox Add-ons: notes to reviewer

Paste into the "Notes to Reviewer" field. Upload `ufeed-<version>-sources.zip`
when AMO asks for source code.

```text
uFeed blurs posts on X, LinkedIn and Reddit that do not match topics the user writes. It scores posts with a small embedding model that runs entirely on the device. Open source (GPL-3.0): https://github.com/dephelion/ufeed

BUILD FROM THE ATTACHED SOURCES ZIP
- Node 22.12 or later (tested with Node 24.19.0 and npm 11.17.0 on macOS).
- npm ci
- npm run build:firefox
- Output: .output/firefox-mv3/, identical file for file to the uploaded package.
The production build is minified by Vite (WXT). The source under src/ is unminified TypeScript.

THIRD-PARTY BINARIES
public/ort/ort-wasm-simd-threaded.jsep.wasm and .mjs are the unmodified ONNX Runtime Web files from the onnxruntime-web package pinned in package-lock.json (1.22.0-dev.20250409-89f8206ba4). scripts/sync-ort.mjs copies them from node_modules/onnxruntime-web/dist/ on npm install, so they can be compared byte for byte. They are bundled and loaded from the extension; nothing is fetched from a CDN.

CONTENT SECURITY POLICY
'wasm-unsafe-eval' on extension pages is needed only to compile that bundled ONNX Runtime WebAssembly. No remote code is executed and nothing uses eval.

NETWORK
On a first installation in Chrome or Firefox, uFeed opens its welcome page at ufeed.es. This normal page request reveals the IP address, standard browser request details and language path to the site host. When a model is first needed, the browser downloads its weights from huggingface.co, which reveals the IP address and requested model to that service. Neither request includes feed content or extension settings. The default model is Xenova/e5-small-v2 (about 33 MB). The optional multilingual model, onnx-community/embeddinggemma-300m-ONNX (about 197 MB), is fetched only if the user picks it. No analytics or accounts; the extension does not collect feed content or settings (data_collection_permissions: none).

WHY THE HIDDEN IFRAME
The content script keeps access to feed text and the page DOM. Chrome's multilingual model uses a shared offscreen extension page and worker across feed tabs; Chrome's default English model and Firefox use a per-tab hidden engine.html iframe and worker. Both transports send text to the extension worker and return scores. The engine never reads the host page.

HOW TO TEST
1. Install in Chrome; the welcome page opens in a new tab. Then open https://www.reddit.com/r/programming/ (no login needed). X and LinkedIn work the same when logged in.
2. Click the toolbar icon, type a topic such as "cooking, recipes, food", and click Save lists.
3. The first run downloads the model; the popup shows progress, then Ready.
4. Posts that are not about the topic blur. Click one to reveal it.
```

## Assets still needed

- [ ] Screenshots, 1280×800 or 640×400, at least one and up to five.
      Suggested: a feed mid-blur, the popup with topics set, a blurred post
      revealed by clicking, the strictness slider with its hint, the model picker,
      the no-topics card.
- [ ] Small promo tile, 440×280. Optional, but listings without one look unfinished.
- [ ] Privacy policy live at https://ufeed.es/privacy/.

## Before each submission

See the checklist in [`wiki-llm/privacy.md`](../wiki-llm/privacy.md).
