# Chrome Web Store listing

Copy to paste into the developer dashboard, plus the answers the review form
asks for. Kept in the repo so the listing and the code change together.

## Identity

| Field          | Value                                                                             |
| :------------- | :-------------------------------------------------------------------------------- |
| Name           | FeedLens: Feed Cleaner for Social Networks                                        |
| Version        | 0.5.4 — pre-1.0 while it is in friends' hands                                     |
| Category       | Productivity                                                                      |
| Language       | English                                                                           |
| Support email  | contact@dephelion.com                                                             |
| Support URL    | https://dephelion.com/lensing-browser-extension/contact/                          |
| Privacy policy | https://dephelion.com/lensing-browser-extension/privacy/                          |
| Visibility     | Public — listed in search and category browsing                                   |
| Store URL      | https://chromewebstore.google.com/detail/lensing/ahlojbckjlffcfdhmkjepaglnhhpmdck |

A Chrome Web Store developer account requires a one-time 5 USD registration fee
before anything can be published.

## Short description (132 char max)

FeedLens uses on-device AI to clean distracting posts on X, LinkedIn, and Reddit while you control the topics you want to focus on.

## Detailed description

Social networks are deciding what you see. FeedLens lets you decide instead.

📝 Write the topics you want. FeedLens AI reads each post locally as you scroll
and hides the ones that are not about them. Nothing is deleted: a blurred
post is always one click away, so you never lose the choice, you just stop
making it by accident.

🧹 Works on X, LinkedIn and Reddit.

It runs on your device. A small language model is downloaded once, then
everything happens inside your browser. No account, no server, no analytics.
The text of your feed is never uploaded, never stored, and never logged — we
could not see it if we wanted to.

🧑🏽‍💻 You set how strict it is. A 0–10 slider, where every step is a measured
threshold rather than a guess. Stricter hides more, including some posts you'd
want, so pick what suits your feed. It is not going to be perfect and it does
not pretend to be.

It takes corrections, if you ask it to. Turn on thumbs and mark a post on or off
topic; the next time a near-copy of it shows up, such as a repost or a quote, it
follows your call. Your topics never change. Ratings stay on your device, and
this is off by default.

What it cannot do. It reads words, not pictures, so a photo with no caption
cannot be judged on content. It understands English. It matches subjects, not
quality: a great post and a poor one about the same thing both stay.

❓Bugs, ideas, or a feed it does not work on: contact us with the email below.

## Single purpose

FeedLens has one purpose: to blur posts in a user's social feed that do not
match topics the user has chosen. Every permission and every code path serves
that. It does nothing else.

## Permission justifications

**Host access to x.com, twitter.com, linkedin.com, reddit.com**

FeedLens must read the text of posts in the page to compare them against the
user's topics, and must modify the page to apply the blur. Both require
running a content script on those sites. These four are the only sites it
supports, and the only ones requested; it requests no wildcard host access.

**`storage`**

Stores the user's topics, strictness and toggles, plus optional thumb ratings,
in local extension storage. Nothing is synced or transmitted.

**Remote code — none**

FeedLens executes no remote code. The ONNX Runtime WebAssembly binary is
bundled in the package and loaded from an extension-relative path. The only
network request is a one-time download of the model **weights** (a data file,
not code) from Hugging Face (`huggingface.co`, redirecting to its `hf.co`
CDN), which the browser then caches.

## Data usage disclosure

Answer **"No"** to every collection category. For the certifications:

- Not being sold to third parties — **true**.
- Not being used or transferred for purposes unrelated to the single purpose — **true**.
- Not being used or transferred to determine creditworthiness or for lending — **true**.

Personally identifiable information, health, financial, authentication,
location, web history, user activity, and website content are all **not
collected**: post text is read in memory and discarded, and nothing is
transmitted anywhere.

Note on "website content": FeedLens reads post text in the page. It is not
_collected_ — it is never stored and never transmitted — so the answer is no.
If a reviewer queries it, the explanation is that scoring happens entirely in
the content script and a Web Worker, and the result is a number applied to the
page.

## Assets still needed

- [ ] Screenshots, 1280×800 or 640×400, at least one and up to five.
      Suggested: a feed mid-blur, the popup with topics set, a blurred post
      revealed by clicking, the strictness slider with its hint, the no-topics
      card.
- [ ] Small promo tile, 440×280. Optional, but listings without one look unfinished.
- [ ] Privacy policy live at https://dephelion.com/lensing-browser-extension/privacy/ (ship the dephelion.com PR first).

## Before each submission

See the checklist in [`wiki-llm/privacy.md`](../wiki-llm/privacy.md).
