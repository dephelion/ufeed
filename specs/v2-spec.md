# Lensing v2 — Graded Blur & Relevance Feedback

> **Status: DELIVERED, superseded.** Verified on live X, LinkedIn and Reddit
> feeds on 2026-09-12: the thumbs bar, the peek tier and relative strictness all
> exercised against real timelines. Kept for provenance.
>
> **Do not consult this document for current behaviour.** The threshold band it
> describes was overturned: strictness is a 0-10 scale of measured thresholds,
> and `bandMin`/`bandMax` no longer exist. See [model.md](../wiki-llm/model.md).
>
> The source of truth is [`wiki-llm/`](../wiki-llm/index.md).
>
> Every number below was measured against the 205 labelled posts in
> `.local/spikes/topic-viability/`. The harnesses are named per finding.

---

## 1. The problem v2 solves

v1 assumes the user can phrase a good topic. Measurement says they cannot, and
that no amount of documentation fixes it.

**A single unknown word halves recall.** `omarchy` in an otherwise good line took
recall from 96% to 46% (AUC 0.880 → 0.825). The model has never seen the word, so
it contributes a generic vector that drags the whole line down uniformly.

**A vague line is a coin flip that overrides every good line.** `games, gaming`
scored AUC 0.587 and dragged 11 off-topic posts over the threshold — Spanish
motorsport, a broadband ad, political violence. Because `scoreAgainstTopics` takes
the **max** across lines, one weak line silently defeats four good words, and the
user has no way to tell which line did it.

**Two label-free quality checks were tried and both failed** (`quality-probe.mjs`):

| Check                            | Result                                                             |
| :------------------------------- | :----------------------------------------------------------------- |
| Topic scored against a noise set | Flat 0.70–0.72 regardless of quality. Best line and coin flip tie. |
| Tokenizer fragmentation          | Backwards. `kubernetes` splits into 4 pieces, `omarchy` into 2.    |

Both measure the topic in isolation. Quality is a property of how a topic ranks
**this user's feed**, which needs ground truth the user does not have.

**The blur hides the evidence.** Judging a blur requires clicking it, which
destroys it. So the one signal we already collect — reveal clicks — is
uninterpretable: a click means "I want this" or "let me check you were right",
and nothing distinguishes them.

**Uncertainty straddles the threshold, and is worse above it**
(`calib-probe.mjs`, 205 posts × 3 phrasings = 615 observations):

| Score       | Posts | Genuinely wanted | Verdict                |
| :---------- | ----: | ---------------: | :--------------------- |
| 0.760–0.775 |   125 |           **0%** | settled, blur outright |
| 0.775–0.784 |    71 |               7% | uncertain, below cut   |
| 0.784–0.790 |    46 |               2% | shown today            |
| 0.790–0.810 |   116 |           26–40% | **uncertain, shown**   |
| 0.830+      |     8 |              88% | settled, keep          |

The tiers below fix the half under the line. The feedback loop fixes the half
above it, which holds the larger error mass.

---

## 2. Changes

### 2.1 Three-tier blur

Replaces the binary blur/reveal with a confidence-graded one.

| Tier     | Condition                               | Treatment                              |
| :------- | :-------------------------------------- | :------------------------------------- |
| Show     | `score >= threshold`                    | Untouched, as today.                   |
| **Peek** | `threshold - 0.01 <= score < threshold` | First ~50 chars legible, rest blurred. |
| Blur     | `score < threshold - 0.01`              | Everything blurred, as today.          |

**The band is 0.01 in score space, not a fraction of the slider.** Below 0.775
nothing was wanted across 125 observations; from 0.775 to the cut, 7% was.
Uncertainty width is a property of the model; the threshold moves with strictness.
Tying the band to the slider would make it correct only at the default.

Owning page: [ui.md](../wiki-llm/ui.md), plus [model.md](../wiki-llm/model.md) for
the band measurement.

### 2.2 The peek, without touching host DOM

Un-blurring the first words in place means splitting the host's text node —
forbidden by Hard Invariant 3, and destroyed by the next React re-render.

The adapter already extracts the post text. Put its first ~50 characters in
`data-lx-peek` on the container and render them in our own overlay via
`content: attr(data-lx-peek)`. An attribute toggle is explicitly permitted, the
host DOM is untouched, and the peek is our element, so it survives vendor
re-renders.

**Invariant 3 is unchanged.** Stated here because the obvious implementation
would have broken it.

**Tension to hold:** a sharp snippet reintroduces some of the distraction the
blur removes. Keep it small and muted; revisit if it reads as noise.

### 2.3 Thumbs up / down

Explicit feedback on a scored post, rendered beside the score badge.

Reveal clicks are **not** a substitute and must not be used as an implicit label —
they conflate "I want this" with "let me verify you were right".

Inert until 2.4 exists. Ship it second so the storage format is exercised before
anything consumes it.

### 2.4 Rocchio relevance feedback

`q' = normalize(q + 0.6 · mean(liked) − 0.4 · mean(disliked))`

No training, no backprop — vector arithmetic over embeddings we already compute.
Measured with feedback items held out of evaluation, at equal feed volume
(`feedback-probe2.mjs`, 40 trials per row):

| Thumbs | Recall | Leaks | AUC       |
| -----: | -----: | ----: | :-------- |
|      0 |    92% |  54.0 | 0.881     |
|      4 |    96% |  52.3 | 0.896     |
|      8 |    96% |  50.3 | 0.902     |
|     16 |    96% |  47.5 | 0.908     |
|     32 |    97% |  42.0 | **0.936** |

Monotonic in both directions. 0.936 is "strong" on the scale in
`.local/spikes/topic-viability/README.md`; v1 shipped at "usable".

Feedback is scoped to **the topic line** that produced it, not the topic set.
Scoring takes the max across lines, so a rating attaches to the line that came
closest to claiming the post; the worker returns that index with the embedding.
Editing one line discards only its own corrections.

Behind `tuneFromFeedback` in Advanced, **off by default**, with a "Clear tuning"
button beside it. Off means the thumbs are hidden and scoring is untouched, so a
rating never has an invisible effect.

### 2.5 Relative strictness

**Load-bearing for 2.4, not optional.** Rocchio moves the query vector, which
changes the absolute cosine scale. With the threshold left at a fixed 0.784,
recall **collapsed to 11%** (`feedback-probe.mjs`). Strictness must become a
percentile of recently-seen scores.

[model.md](../wiki-llm/model.md) lists "relative — blur the bottom N%" under
**Rejected**, because it blurs a fixed fraction even when the whole feed is on
topic. This is a **conditional revival**: relative only to keep a user-adapted
vector calibrated. The Rejected entry gets amended with the condition, never
silently reversed.

### 2.6 Persistence of feedback vectors

Liked/disliked embeddings persist on device across sessions.

**Amends Hard Invariant 1**, which today reads "never persists beyond the session
cache". Post text still never persists, never transmits, never logs — but an
embedding is a derivative of post content and is partially invertible. Calling it
"not post text" would be a technicality, so the invariant is edited openly.

Authorised for the testing phase (no real users). Revisit before any public
release: what is stored, how it is cleared, and whether Reset removes it.

Owning pages: [privacy.md](../wiki-llm/privacy.md),
[conventions.md](../wiki-llm/conventions.md).

---

## 3. Task order

Each lands with its wiki page updated and tests green.

1. ~~**Peek tier** — 2.1 + 2.2.~~ Landed. `verdictAt`, `peek()`, `data-lx-peek`.
2. ~~**Thumbs UI + feedback store** — 2.3 + 2.6.~~ Landed. `.lx-fb`,
   `core/feedback.ts`, `FEEDBACK`/`VECTOR` messages. Invariant 1 amended.
3. ~~**Rocchio + relative strictness** — 2.4 + 2.5.~~ Landed together, as required.
   `applyFeedback()`, `thresholdForFraction()`.

---

## 4. Known, not scheduled

Surfaced by measurement during v1, still open. Not v2 scope; listed so they are
not rediscovered.

- **Batch padding shifts scores by ±0.004.** The same post and topic scored 0.7990
  alone and 0.8028 beside a 2-char post; a topic vector's self-similarity across
  batches is 0.998, not 1.0. On a 0.035-wide decision strip that is ~11% of the
  range, and the content script batches 16 at a time.
- **The adapter discards quoted-tweet text**, which is the only signal a
  caption-less quote-post carries.
- **`alwaysKeep` / `alwaysBlur` have no popup input**, though both work.
- **Non-English separation is roughly half of English.** Spanish gap +0.022 vs
  +0.045; German and Japanese ~+0.012. Scores drift high enough that the English
  threshold sits in the wrong place. `wiki-llm/index.md` lists multilingual as not
  built; this quantifies the cost.
