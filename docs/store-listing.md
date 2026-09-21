# Chrome Web Store listing

Copy to paste into the developer dashboard, plus the answers the review form
asks for. Kept in the repo so the listing and the code change together.

## Identity

| Field          | Value                                                                     |
| :------------- | :------------------------------------------------------------------------ |
| Name           | uFeed: Feed Cleaner for Social Networks                                   |
| Version        | 0.9.1 — pre-1.0 while it is finding its first users                       |
| Category       | Productivity                                                              |
| Language       | English                                                                   |
| Support email  | contact@dephelion.com                                                     |
| Support URL    | https://dephelion.com/ufeed-browser-extension/contact/                    |
| Privacy policy | https://dephelion.com/ufeed-browser-extension/privacy/                    |
| Visibility     | Public — listed in search and category browsing                           |
| Store URL      | https://chromewebstore.google.com/detail/ahlojbckjlffcfdhmkjepaglnhhpmdck |

A Chrome Web Store developer account requires a one-time 5 USD registration fee
before anything can be published.

## Short description (132 char max)

Name the topics you want; uFeed blurs the rest on X, LinkedIn and Reddit. Private, on-device, open source, no account.

## Detailed description

Social networks are deciding what you see. uFeed lets you decide instead.

🔒 Private and fast. Everything runs on your device. No account, no cloud, no analytics. Your feed is safe.

📖 Open source. Read the code, build it, fork it:
https://github.com/dephelion/ufeed

📝 Write your topics, one per line. Posts that don't match get blurred and collapsed, never
deleted. One click shows them.

🌍 Reads English by default. For any other language, switch to the optional
multilingual model (197 MB) in the popup.

👍 Optional thumbs let you correct it. Off by default, kept only on your device.

💾 Backup and import your settings anywhere.

It reads words, not images, and matches subject, not quality. It can miss sarcasm, and it won't be perfect.

❓Bugs or ideas: https://github.com/dephelion/ufeed/issues or the email below.

## Single purpose

uFeed has one purpose: to blur posts in a user's social feed that do not
match topics the user has chosen. Every permission and every code path serves
that. It does nothing else.

## Permission justifications

**Host access to x.com, twitter.com, linkedin.com, reddit.com**

uFeed must read the text of posts in the page to compare them against the
user's topics, and must modify the page to apply the blur. Both require
running a content script on those sites. These four are the only sites it
supports, and the only ones requested; it requests no wildcard host access.

**`storage`**

Stores the user's topics, strictness and toggles, plus optional thumb ratings,
in local extension storage. Nothing is synced or transmitted.

**Remote code — none**

uFeed executes no remote code. The ONNX Runtime WebAssembly binary is
bundled in the package and loaded from an extension-relative path. The only
network request is a one-time download of the model **weights** (a data file,
not code) from Hugging Face (`huggingface.co`, redirecting to its `hf.co`
CDN), which the browser then caches. Only the model the user has chosen is
requested: about 33 MB for the default, about 197 MB for the optional multilingual
one.

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

## Assets still needed

- [ ] Screenshots, 1280×800 or 640×400, at least one and up to five.
      Suggested: a feed mid-blur, the popup with topics set, a blurred post
      revealed by clicking, the strictness slider with its hint, the model picker,
      the no-topics card.
- [ ] Small promo tile, 440×280. Optional, but listings without one look unfinished.
- [ ] Privacy policy live at https://dephelion.com/ufeed-browser-extension/privacy/ (ship the dephelion.com PR first).

## Before each submission

See the checklist in [`wiki-llm/privacy.md`](../wiki-llm/privacy.md).
