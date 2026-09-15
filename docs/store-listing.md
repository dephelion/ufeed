# Chrome Web Store listing

Copy to paste into the developer dashboard, plus the answers the review form
asks for. Kept in the repo so the listing and the code change together.

## Identity

| Field          | Value                                                    |
| :------------- | :------------------------------------------------------- |
| Name           | Lensing: Local AI Feed Cleaner for Social Media          |
| Version        | 0.3.1 — pre-1.0 while it is in friends' hands            |
| Category       | Productivity                                             |
| Language       | English                                                  |
| Support email  | contact@dephelion.com                                    |
| Support URL    | https://dephelion.com/lensing-browser-extension/contact/ |
| Privacy policy | https://dephelion.com/lensing-browser-extension/privacy/ |
| Visibility     | Unlisted — installable by link, not in search or browse  |

**Unlisted is a real store publication.** Same review, same package, same
install: friends click the link, install normally, get automatic updates, and
see none of the developer-mode warnings an unpacked zip triggers. It is hidden
only from search and category browsing. Switching to Public later is a setting
on this page, not a resubmission.

A Chrome Web Store developer account requires a one-time 5 USD registration fee
before anything can be published, unlisted included.

## Short description (132 char max)

> Local AI blurs distracting posts on X, LinkedIn, and Reddit — nothing leaves your device. You choose the topics.

## Detailed description

> Your feed decides what you see. Lensing lets you decide instead.
>
> Write a few topics — what you actually opened the app for. Lensing reads each
> post as you scroll and blurs the ones that are not about them. Nothing is
> deleted and nothing is hidden: a blurred post is always one click away, so you
> never lose the choice, you just stop making it by accident.
>
> Works on X, LinkedIn and Reddit.
>
> **It runs on your device.** A small language model is downloaded once, then
> everything happens inside your browser. No account, no server, no analytics.
> The text of your feed is never uploaded, never stored, and never logged — we
> could not see it if we wanted to.
>
> **You set how strict it is.** A 0–10 slider, where every step is a measured
> threshold rather than a guess. The popup tells you roughly how much of a
> typical feed each setting keeps, including how much of what survives will
> still be off-topic. It is not going to be perfect and it does not pretend to
> be.
>
> **It learns from you, if you ask it to.** Turn on thumbs and rate a post; the
> ratings stay on your device and shift what that topic means to Lensing. It is
> off by default.
>
> **What it cannot do.** It reads words, not pictures, so a photo with no
> caption cannot be judged on content. It understands English. It matches
> subjects, not quality: a great post and a poor one about the same thing both
> stay.
>
> Bugs, ideas, or a feed it does not work on: contact@dephelion.com

## Single purpose

> Lensing has one purpose: to blur posts in a user's social feed that do not
> match topics the user has chosen. Every permission and every code path serves
> that. It does nothing else.

## Permission justifications

**Host access to x.com, twitter.com, linkedin.com, reddit.com**

> Lensing must read the text of posts in the page to compare them against the
> user's topics, and must modify the page to apply the blur. Both require
> running a content script on those sites. These four are the only sites it
> supports, and the only ones requested; it requests no wildcard host access.

**`storage`**

> Stores the user's topics, strictness and toggles, plus optional thumb ratings,
> in local extension storage. Nothing is synced or transmitted.

**Remote code — none**

> Lensing executes no remote code. The ONNX Runtime WebAssembly binary is
> bundled in the package and loaded from an extension-relative path. The only
> network request is a one-time download of the model **weights** (a data file,
> not code) from Hugging Face (`huggingface.co`, redirecting to its `hf.co`
> CDN), which the browser then caches.

## Data usage disclosure

Answer **"No"** to every collection category. For the certifications:

- Not being sold to third parties — **true**.
- Not being used or transferred for purposes unrelated to the single purpose — **true**.
- Not being used or transferred to determine creditworthiness or for lending — **true**.

Personally identifiable information, health, financial, authentication,
location, web history, user activity, and website content are all **not
collected**: post text is read in memory and discarded, and nothing is
transmitted anywhere.

> Note on "website content": Lensing reads post text in the page. It is not
> _collected_ — it is never stored and never transmitted — so the answer is no.
> If a reviewer queries it, the explanation is that scoring happens entirely in
> the content script and a Web Worker, and the result is a number applied to the
> page.

## Assets still needed

- [ ] Screenshots, 1280×800 or 640×400, at least one and up to five.
      Suggested: a feed mid-blur, the popup with topics set, a blurred post
      revealed by clicking, the strictness slider with its hint, the no-topics
      card.
- [ ] Small promo tile, 440×280. Optional, but listings without one look unfinished.
- [ ] Privacy policy live at https://dephelion.com/lensing-browser-extension/privacy/ (ship the dephelion.com PR first).

## Before each submission

See the checklist in [`wiki-llm/privacy.md`](../wiki-llm/privacy.md).
