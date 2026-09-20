# Model & Scoring

> **Maintenance Invariant:** Model choice, score semantics, thresholds, measured findings. Numbers live here, never in code comments. Update in the SAME commit as any model, band, or threshold change. Token-optimized: imperative, no prose, no redundancy.
> **Answers:** Which model and why. What a score means. How the threshold is set. Why a backend gets rejected. What was measured and rejected.

## Model

Two, and the reader picks. Both are downloaded once and cached by the browser (Cache API, evictable).

| Key        | Model                                     | dtype | Size   | Reads          | Default |
| :--------- | :---------------------------------------- | :---- | :----- | :------------- | :------ |
| `e5-small` | `Xenova/e5-small-v2`                      | q8    | ~33MB  | English only   | **yes** |
| `gemma`    | `onnx-community/embeddinggemma-300m-ONNX` | q4    | ~197MB | Every language | no      |

**Retrieval models, not similarity models.** The task is a short topic against a longer post — asymmetric. Prefixes are mandatory, asymmetric, and **per model**:

```
e5-small  topic → "query: software, programming"        post → "passage: <text>"
gemma     topic → "task: search result | query: ..."    post → "title: none | text: <text>"
```

`src/core/models.ts` is the single source: `MODELS` holds one `ModelSpec` per key, carrying the id, dtype, prefixes, vector width, strictness scale, probe bounds, `ratingNear`, peek band, batch size, and whether WebGPU may be tried. Nothing model-dependent is a bare constant anywhere else — `scoring.ts`, `language.ts`, `policy.ts` and the worker all take a spec.

**A registry was rejected while there was one model**, and that held for as long as the product read one language. The second model is not a runtime branch for its own sake: it is the only way to filter a feed that is not in English, which the gate below can otherwise only blur wholesale.

**`google/embeddinggemma-300m` is gated** (HTTP 401 unauthenticated). The `onnx-community` mirror is not, and is what ships. If it is ever gated the model fails to load, the engine reports `error`, and the feed fails open. EmbeddingGemma is under the **Gemma Terms of Use**, not an OSI licence; the weights are fetched by the browser and never redistributed here.

**The step means the same thing on both scales.** Every model's strictness table has 11 steps spending the same share of feed, so a stored step survives a switch. Enforced by `scoring.test.ts`.

## Why this model

Measured on 205 labelled posts from a real timeline, 26 on topic (13% base rate). Topic `tech, software, ai`.

**Method, to reproduce:** scrape a feed's visible post text, label each post keep/skip by hand against one topic, then embed both and rank. Report AUC (ranking), d-prime (separation against noise), and the share of the feed surviving the threshold that keeps 80% of the labelled keeps. Harness and data are gitignored under `.local/`; the data is personal.

| Model             | AUC       | d-prime  | Feed shown at 80% recall |
| :---------------- | :-------- | :------- | :----------------------- |
| **e5-small-v2**   | **0.881** | **1.61** | **20%**                  |
| all-MiniLM-L6-v2  | 0.826     | 1.29     | 33%                      |
| bge-small-en-v1.5 | 0.817     | 1.25     | 34%                      |

MiniLM is trained sentence-to-sentence; it compressed every score toward zero and failed both real cases:

| Post                                          | MiniLM | e5    |
| :-------------------------------------------- | :----- | :---- |
| Multi-computer copy/paste (tech)              | 0.005  | 0.826 |
| "Almeida destrozando a TelePedro." (politics) | 0.133  | 0.742 |

## Why a second model

Measured 2026-09-20 on **both feeds pooled, 415 posts** (the 205 above plus 210 from a second X timeline), against five topics — `politica`, `inmigracion`, `tecnologia`, `deportes`, `videojuegos` — each in four phrasings (unaccented Spanish, accented, a longer Spanish line, and English). A topic is a subject, not a language: an English post about politics is on topic for `politica`.

Every row of a block is averaged; none were picked. 95% CI from a paired bootstrap over posts, 1000 resamples. Harness: `.local/spikes/multilingual/` (`eval.mjs`, `compare.mjs`), findings: `.local/embeddinggemma-2026-09-20.md`.

| Block                                    | e5-small-v2 | multilingual-e5-small | EmbeddingGemma q4 |
| :--------------------------------------- | ----------: | --------------------: | ----------------: |
| Owner's English tech labels, 3 phrasings |       0.826 |                 0.842 |         **0.875** |
| Same labels, `tecnologia` phrasings      |       0.746 |                 0.761 |         **0.846** |
| Both feeds pooled, 12 rows               |       0.712 |                 0.740 |         **0.883** |
| Spanish posts only                       |       0.721 |                 0.718 |         **0.941** |
| English posts only                       |       0.680 |                 0.784 |         **0.882** |

Gemma wins 11 of 12 rows in the pooled block; e5-small-v2 takes one (`politics`), multilingual-e5-small none. Gemma − multilingual on the pooled block is **+0.143 [+0.114, +0.175]**.

**It is also far less sensitive to phrasing**, which is what the popup's topic guidance exists to work around: across the owner's three phrasings e5-small-v2 ranges 0.706 – 0.881, Gemma 0.896 – 0.946. A one-word topic works with Gemma.

**Its English edge over the default is real but modest** (+0.050 [+0.001, +0.098]) — not on its own a reason to pay 6× the download and ~9× the compute. Reading every language is.

**Topic language matters more than the model's reach.** An English topic scores Spanish posts lower: `politics` pooled reads 0.759 against 0.930 within Spanish and 0.867 within English. Topics typed in the posts' language work best, and a post matching any line stays visible, so a bilingual reader adds both.

**What this did not measure.** One person's two timelines, skewed to Spanish politics and immigration. Spanish-language tech has only 5 wanted posts. Every label but the tech ones is one pass by an agent; changing what the unsure posts count as moves absolute AUC by ≤0.03 and never the order. Native ORT throughout, never browser WASM. (q8 was since compared on both speed and quality — see §Making WASM faster.)

## Score semantics

**Scores are model-relative.** Unrelated text sits near **0.74** with e5 and near **0.00** with a symmetric model. Never persist a score; persist the slider position and derive.

Measured distribution, topic `tech, software, ai`: on-topic mean **0.806**, off-topic mean **0.771**. The whole decision lives in a **0.035-wide strip**. Near-misses are structural, not a bug.

**Length does not shift e5.** On-topic mean by post length: 0.804 / 0.800 / 0.814 / 0.810 across 0-80 / 80-150 / 150-250 / 250+ chars. MiniLM ran 0.096 → 0.233 over the same buckets and needed a length penalty; e5 does not. The penalty was deleted.

## Determinism

**A post's score depends on the post alone.** q8 quantizes activations per batch, so the same post scored beside different neighbours moved: **0.7961 – 0.8025** across 24 random batches (spread 0.006); over 210 feed posts, batched-by-16 vs alone gave median **0.002**, p90 **0.005**, max **0.012**. The strip is 0.035 wide and `PEEK_BAND` is 0.01. `ScoreCache` froze whichever batch came first.

`Embedder.embed` runs one text per model call, so a score is a function of the post. Cost **4.0 vs 3.5 ms/post** (281 posts, node CPU; WASM in a browser not measured). The thumb and the scoring path now produce the same vector.

Guard: `embedder.model.test.ts` compares a post alone against the same post in a batch to six digits. Harness: `.local/spikes/topic-viability/batch-probe.mjs`.

**Batching EmbeddingGemma was measured and closed** (2026-09-20, `.local/spikes/multilingual/throughput.mjs`). Two independent reasons: it is **no faster** — 16 texts in one call ran at 0.93× of one call each, because padding to the longest text wastes what the batch was meant to win — and cosine(alone, in batch) is **0.99966**, which the six-digit guard rejects. One text per call is not a cost paid for determinism here; it is simply better.

## Language

**e5-small-v2 reads English only.** Text in another language still gets a score, and that score is noise — drawn from across the usable band with no relation to the topic. No threshold fixes it.

Measured on the same 205 posts, topic `tech, software, ai`: **68 of them are Spanish, and every one is labelled off topic.** Their scores run **0.727 – 0.825**, mean **0.769** — the scale spans 0.69 – 0.82, so the model places Spanish posts on both sides of every threshold the slider can reach. **18 of the 54 posts above the default threshold are Spanish**: a third of all leaks, none of them judged.

Reproduce with the harness in `.local/`: classify each post's language, then compare the score distribution against the English posts'.

`spec.language` is the single source. The gate compares against it, never a literal `en`, so a model swap moves it. **A spec with no `language` gates nothing**: `gatesLanguage()` returns false, detection never runs, and the popup shows the checkbox off and disabled and says why rather than leaving it looking live. The reader's setting is kept for a switch back.

**The multilingual model therefore costs more inference than its per-post figure says.** The gate currently settles foreign posts before they reach the engine — 79 of the 205 labelled posts are Spanish — so turning it off takes the share of a feed needing inference from ~62% to 100%: about 38% more posts scored, on top of the per-post cost.

**Detection is `browser.i18n.detectLanguage()`** — Chrome's CLD, shipped in Chrome 47+ and Firefox 47+, no permission, available to content scripts. Nothing to bundle, nothing to keep trained. Rejected: `languagedetect` (npm, unmaintained, bundled trigram tables) and a hand-rolled English function-word rate — measured at **67 of 68 Spanish posts flagged with 0 false positives**, good enough to ship and still worse than CLD for free.

**Reliable but split does not count as placed.** CLD returns a share per language; below `MIN_SHARE = 60` for the top one the post is mixed, the model reads at most half of it, and the verdict is `unclear`.

**`unclear` is not `other`.** CLD read the text and could not place it — that is a statement about how much text there is, not about which language. It feeds the thin-media rule, which already owns that claim. Only a reliable foreign placement blurs as a language.

**On by default**, behind `blurOtherLanguages`. A post the model cannot read against English topics is a post FeedLens cannot judge, so the default blurs it rather than showing it unfiltered; a monolingual English feed pays nothing for the check either way.

## The uncertain strip

Calibration over 615 observations (205 labelled posts x 3 topic phrasings): what share of each score band was genuinely wanted.

| Score       | Posts | Genuinely wanted | Verdict                |
| :---------- | ----: | ---------------: | :--------------------- |
| 0.760-0.775 |   125 |               0% | settled, blur outright |
| 0.775-0.784 |    71 |               7% | uncertain              |
| 0.784-0.790 |    46 |               2% | shown                  |
| 0.790-0.810 |   116 |           26-40% | uncertain, shown       |
| 0.830+      |     8 |              88% | settled, keep          |

**`PEEK_BAND = 0.01`** is the strip below the threshold that earns a peek instead of a full blur. Below 0.775 nothing was wanted across 125 observations; inside the strip, 7% was.

**In score space, never a fraction of the scale.** The strip is a property of the model; the threshold moves with strictness. Tying one to the other makes it correct only at the default.

**Uncertainty straddles the threshold and is worse above it.** Posts at 0.790-0.810 are 26-40% wanted and are shown today with nothing marking them as doubtful. The tiers fix the half below the line; nothing yet targets the half above it — a disliked near-duplicate is the only override.

## Threshold

**Strictness is a 0-10 scale, and each step is a measured threshold.** Settings store the step, never the score.

Measured over 615 observations (205 labelled posts x 3 topic phrasings), topic family `software / tech / ai`:

|  Step | Threshold | Feed shown |  Recall | Precision | Junk per 10 wanted |
| ----: | --------: | ---------: | ------: | --------: | -----------------: |
|     0 |     0.690 |       100% |    100% |       13% |               68.7 |
|     1 |     0.740 |        90% |     97% |       14% |               62.8 |
|     2 |     0.750 |        82% |     96% |       15% |               57.3 |
|     3 |     0.760 |        68% |     96% |       18% |               46.0 |
|     4 |     0.765 |        61% |     96% |       20% |               40.1 |
|     5 |     0.775 |        46% |     96% |       27% |               27.6 |
|     6 |     0.780 |        39% |     91% |       29% |               23.9 |
| **7** | **0.790** |    **28%** | **87%** |   **40%** |           **15.0** |
|     8 |     0.800 |        18% |     67% |       46% |               11.7 |
|     9 |     0.810 |        11% |     42% |       51% |                9.7 |
|    10 |     0.820 |         4% |     15% |       48% |               10.8 |

Base rate 13%: that is the precision a filter has to beat to be worth anything.

**The scale is even in what the reader sees, not in cosine.** Each step spends about a tenth of the feed. Cosine is not evenly spaced — 0.76 to 0.795 costs 45% of a feed and 0.795 to 0.83 costs 22% — so a slider linear in score has a dead half. This one does not.

**Step 0 is the feed floor, not a band edge.** The lowest score a real feed post reached is **0.696**; 1st percentile 0.702, 5th 0.730. At 0 nothing is blurred, which is what the loosest setting must mean.

**This replaced a 0.76 - 0.83 linear band**, whose floor blurred **30% of a feed at slider 0%** and whose documented rationale — "the range where moving it changes something" — did not survive measurement: 0.72 to 0.76 moves 28% of a feed and the band could not reach it.

Default **step 7**: best F1 (0.55) on the labelled set.

### EmbeddingGemma's scale — PROVISIONAL

Derived 2026-09-20 by the same method (`.local/spikes/multilingual/calibrate.mjs`), over the same 615 observations, so a switched feed looks sane. **Not measured the way e5-small-v2's was, and not to be quoted as if it were.**

**Its band is somewhere else entirely:** −0.046 … 0.407, median 0.141, against e5-small-v2's 0.679 … 0.871. Applying either table to the other model blurs everything or nothing — which is why the step, never the score, is what settings store.

| Step | e5-small-v2 |  gemma | Feed shown |
| ---: | ----------: | -----: | ---------: |
|    0 |       0.690 | −0.047 |       100% |
|    3 |       0.760 |  0.100 |        70% |
|    5 |       0.775 |  0.141 |        50% |
|    7 |       0.790 |  0.188 |        30% |
|    9 |       0.810 |  0.253 |        10% |
|   10 |       0.820 |  0.299 |         5% |

Best F1 on the pooled set: Gemma **0.55 at step 8**, e5-small-v2 0.43 at step 8 under the same recomputation.

**The method here does not exactly reproduce the shipped e5 table** (it gives 0.678 – 0.812 where the shipped one is 0.690 – 0.820), so the shape is validated and the digits are not. `peekBand` 0.02 and `ratingNear` 0.66 are likewise provisional: 0.66 matches the share of post-to-post pairs that e5's 0.90 sits above (top 0.111%; Gemma pairs run median 0.215, p99 0.458). **`near-probe.mjs` must be re-run against Gemma before any of this is treated as measured.**

**The table is calibrated to one topic phrasing, and broader lines run looser.** Measured 2026-09-19 on two feeds pooled, English only (281 posts: the 205 above plus 210 from a second X timeline labelled by eye, 23 ambiguous dropped), scored alone, topic lines `programming, code, developers, software, hardware` / `linux, open source` / `AI, agents`:

| Step | Threshold | Feed shown | Junk share | Recall |
| ---: | --------: | ---------: | ---------: | -----: |
|    7 |     0.790 |        53% |        34% |    93% |
|    8 |     0.800 |        43% |        22% |    88% |
|    9 |     0.810 |        29% |        12% |    66% |

Junk share is the share of unwanted posts that clear the cut. Step 7 shows 53% of that feed, not 30%: the first line's five broad words lift the whole scale, and each extra line is another draw at the max (line 1 alone: 48% shown, 28% junk, 90% recall). The second feed is tech-heavy (43% wanted against 13-20%), which also raises the share shown.

Two off-topic political posts cleared step 7 at **0.797** and **0.796** alone (the extension showed 0.808 for the first, from batching). Both sit inside the uncertain strip: **no phrasing tried that keeps recall moves them below 0.79** — single lines and sets, broad and narrow; only narrow ones (`AI agents`, 46% recall) do. Step 8 peeks them, step 9 blurs them.

**Recall alone is not a reason to pick a step, and picking on it once shipped a bad default.** Step 5 reads well — 96% of what was wanted survives — and hides that **73% of what survives is junk**, 27.6 unwanted posts per 10 wanted. Recall is nearly free at a loose threshold, because a loose threshold shows everything: step 0 keeps 100% by showing 100%. Only precision says whether the filter did anything.

**The asymmetry runs toward strictness, not away from it.** The earlier default argued that a false blur costs a click and a false pass costs a scroll, so be forgiving. That undercounts twice. A false blur is **labelled and recoverable** — it announces itself, the peek tier shows the opening words, one click undoes it. A false pass is **invisible**: nothing marks it, there is nothing to recover, the reader simply reads it. And at step 5 false passes outnumber hits 27 to 10. The cheap error is the one the reader can see.

Step 5 to 7 costs 9 points of recall and takes junk from 27.6 to 15.0 per 10 wanted — about half the noise for about a tenth of the signal.

**Step 10 is noisy.** At 4% of a feed it rests on ~25 observations, which is why its junk share reads above step 9's. Treat the last step as "as strict as this goes", not as a measurement.

**Recall falls off a cliff after step 7.** Steps 8-10 keep 67%, 42% and 15%. The scale stays even in feed volume there on purpose — the reader asked for less feed, and that is what less feed costs. Precision still climbs to step 9, so a reader whose topic phrasing is sharper than the calibration topic can sit at 8 or 9 and keep what they want.

**Not quoted to readers.** The popup hint states the trade-off without numbers ([ui.md](ui.md)): one sample, one feed — a guide for picking thresholds, not a promise. `feedShownAt()` only tells the hint that step 0 blurs nothing.

**`strictness` is validated on read-back, not merged.** It outlived a scale change: a stored `0.35` from the old 0..1 slider is step 0 here, which would silently unblur a whole feed. `withDefaults()` takes only an integer and clamps it; anything else falls back to the default.

## Topic phrasing

Measured, same 205 posts:

| AUC   | Topic                                                        |
| :---- | :----------------------------------------------------------- |
| 0.848 | `software`                                                   |
| 0.876 | `software, programming`                                      |
| 0.869 | `software programming engineering` (no commas)               |
| 0.850 | `software, programming, engineering`                         |
| 0.882 | `software, programming, engineering, AI, hardware`           |
| 0.853 | 8 words                                                      |
| 0.834 | `software and programming and engineering`                   |
| 0.815 | `posts about software engineering, programming languages...` |

Rules that hold: two to five words beats one; sentences and `and` cost 0.05-0.07 because filler is matched too; commas make no measurable difference. Differences under ~0.03 are noise on this sample — **which** words matter more than how many.

Concrete beats abstract: posts write about code, not about categories. `tech` scored 0.005 on a Linux/macOS post; `software` scored 0.097.

## Relevance feedback

**The topic score is the source of truth; a thumb never moves a topic vector.** A rating overrides the verdict only for a near-identical post: `ratingNear()` in `scoring.ts`, cosine against the rated post's vector `>= MODEL.ratingNear = 0.90`. Closest rating wins; liked shows, disliked blurs. Everything else is judged by the fixed strictness threshold alone, so "shown means above this score" holds with or without ratings.

**Why no query update.** Rocchio (`q + 0.6·mean(liked) − 0.4·mean(disliked)`) shipped through v0.4.1 and moved every score on the corrected line, junk included: a like added a typical-post direction and lifted the baseline, a dislike subtracted it. That forced a relative (quantile) threshold, which went stale after each correction, and a shared window let one line's correction hide another line's posts. Measured, it bought nothing (below).

**Near-identical override, measured.** 205 labelled posts, topic `tech, software, ai`, 32 of the base score's mistakes rated, held out, 40 trials, fixed cutoff 0.784. Harness: `.local/spikes/topic-viability/near-probe.mjs`.

| Override at | Fixed | Broken |
| ----------: | ----: | -----: |
|        0.88 |   8.6 |    3.3 |
|    **0.90** |   3.2 |    1.0 |
|        0.92 |   1.6 |    0.0 |
|        0.94 |   0.0 |    0.0 |

No opposite-label pair on the sample reaches 0.92 (max 0.916); 13 same-label pairs do. **Close to a no-op on this sample**: 32 ratings fix 1.6 verdicts, because most rated posts have no near-duplicate in a feed. **The margin is thin and fitted on the same 205 posts it is judged on** — 0.004 above the closest opposite-label pair — so "0 broken" is optimistic; re-measure on a second feed before lowering it. The sample was deduplicated at collection, so an exact repost of a rated post (cosine ~1) is not in it and always overrides.

**Lowered to 0.90 in 0.7.0, the owner's call:** 0.92 was too timid to clear disliked content. On the sample it doubles the fixes (1.6 → 3.2) at the cost of one broken verdict per 32 ratings. The cut is shared, so near-copies of liked posts are matched more broadly too.

**Rocchio's measured gain was a holdout artifact.** The table it shipped with (AUC 0.881 → 0.936 at 32 corrections) scored the held-out set, which excludes the rated posts — the base score's hardest mistakes. The **uncorrected** score on the same held-out sets reaches **0.943** at 32 (Rocchio 0.936; at 8 Rocchio led, 0.902 vs 0.896). At equal feed volume, 32 corrections fixed 7.5 verdicts and broke 8.2. Any future feedback measurement must compare against the base score on the same held-out set.

**Ratings are filed per line, checked across all lines.** A rating is stored under the line whose topic vector is closest (`bestMatch()`), so editing a line discards only that line's ratings; a re-click reuses the stored line. The near-identical check pools every line's ratings (`pooled()`). **Per-line checking failed in use**: an off-topic post scores near-equal on every line (measured 0.7985 vs 0.7990 on two lines), and embedding it alone (thumb) vs in a batch (scoring) moved scores by up to 0.003 (cosine 0.9976 between the two vectors; batching was the cause, see §Determinism), so a near-copy often landed on a different line than its rating and was never overridden. Pooling cannot shift a topic: no topic vector or score changes, only near-copies of a rated post are decided.

**The whole post is one vector; no word is attributable.** The adapter's extracted text goes over as one string, tagged `passage:`. **Scored and thumbed text are the same text.** Both pass through `forEngine()` in `queue.ts`, capped at `MAX_CHARS = 1200`. **The rating key stays the whole post** (`hashText`).

**One rating per post, keyed by `hashText`.** Re-clicking the same thumb un-rates; the other thumb flips it in place.

**Off by default**, behind `tuneFromFeedback` ("Learn from my thumbs" in the popup).

**Ratings are kept per model, not deleted on a switch.** Vectors are stamped with the model that made them and stored under its id ([architecture.md](architecture.md)); a model reads only its own, and a switch back restores them untouched. The post text was discarded at rating time, so nothing can be re-embedded across models — but nothing needs to be. `ratingNear` is model-specific and must be re-measured with any new model.

## Backend self-check

A backend can load, report ready, run fast, and return confident nonsense. ORT's **WebGPU backend miscomputes the q8 model**: a Spanish political post scored 0.32 against `tech` where CPU gives 0.001. Nothing errors.

**WASM is the only backend, for both models.** e5's q8 failed the probe on WebGPU on every load (`near=0.901 far=0.898`, against a required gap of 0.06), and so did Gemma's q4 (`near=0.353 far=0.375`, against `0.597` and `0.138` on WASM) — see `tryWebGPU` below. Every feed tab that tried paid for a WebGPU session it then threw away.

**WASM threads are out for good**, whatever the model: an injected iframe cannot be cross-origin isolated, so `SharedArrayBuffer` is unusable and ORT runs single-threaded ([manifest.md](manifest.md) §No WASM threads). **Separate workers do parallelise** — measured 1.81× at 2, 3.07× at 4, 4.19× at 6 — but each holds its own copy of the weights, and at ~197MB per session that is a memory problem per feed tab before any pool is built. Not implemented; see `.local/embeddinggemma-2026-09-20.md`.

## Making WASM faster: what was measured and rejected

WASM is the only backend either model gets, so its cost is the product's cost. Measured 2026-09-20, native ORT single-threaded (the order is the finding, not the absolute ms). Harnesses in `.local/spikes/multilingual/`.

**Cost is mostly fixed, not per-character.** Fitting the length sweep gives **`cost ≈ 31ms + 0.366ms × chars`**. A third of the cost of a median post is overhead that no amount of trimming touches.

| Lever            | Real gain                    | Cost                                 | Verdict                                    |
| :--------------- | :--------------------------- | :----------------------------------- | :----------------------------------------- |
| q8 instead of q4 | **−70%** (168 vs 98 ms/post) | +112MB, +0.006 AUC                   | Rejected. q4 is both faster and smaller.   |
| Cap text at 240  | 3.7%                         | −0.005 AUC                           | Rejected: not worth a code path.           |
| Cap text at 160  | 17.5%                        | −0.022 AUC                           | Rejected: real accuracy for a modest gain. |
| Cap text at 80   | 38%                          | −0.070 AUC                           | Rejected outright.                         |
| Batching         | none (0.93×)                 | breaks determinism                   | Closed, see §Determinism.                  |
| WASM threads     | —                            | impossible                           | Closed, no cross-origin isolation.         |
| Smaller batch    | 0% throughput                | none                                 | **Adopted**, `spec.batchSize`.             |
| 2 workers        | 45%                          | a second copy of the weights per tab | Open. Needs the engine singleton first.    |

**Truncation looked far better than it is.** The per-post figures (80 chars runs at 0.40× the cost of 320) are for the _longest_ posts. Across the real length distribution — mean 174 chars, median 182, max 325 — a cap at 240 touches 125 of 415 posts and saves under 4%. Short posts cannot be made shorter, and `MAX_CHARS = 1200` never binds on a feed at all.

**q4 beats q8 on speed by more than it loses on accuracy**, which was not the expectation: 4-bit weights usually cost dequantization work. Both land in the same band (cosine between a post's q4 and q8 vectors: mean 0.965), so the calibrated table holds either way. The model card forbids fp16 and its derivatives — EmbeddingGemma's activations do not support them — so `q4f16` is not an option however tempting its 175MB is.

**`batchSize` buys latency, not throughput.** Since batching is measured to be no faster, a large batch only delays the first verdict and eats head-room under the engine's 8s timeout — and a timeout fails the whole batch open. Both models take **5** (`spec.batchSize` stays per model): e5-small was 16 and Gemma 6, and the owner lowered both so the first verdict lands sooner. On Gemma that is a few hundred ms to the first unblur, several times clear of the timeout.

After load, `Embedder.selfCheck()` embeds a fixed probe pair and rejects the model unless both hold:

- `near >= probeMinNear`
- `near - far >= probeMinGap`

Bounds are per-model and live in `models.ts`. The **gap** is the robust signal; absolute scores are not comparable across models.

**The probe now picks the backend, rather than only vetoing one.** `Embedder.load()` walks the backends a spec allows, keeps the first whose probe passes, and logs the rest as rejected. Only the last failure throws; then the engine reports `error` and the feed fails open.

**`tryWebGPU` is a per-model switch, and it is off for both.** It was made per model because the 0.7.0 rejection was of _e5's q8_ alone, so Gemma's q4 was allowed to try and fall back to WASM in the same load. **Measured on Chrome, Apple M2 Pro: it fails.** Gemma's q4 on WebGPU scores `near=0.353 far=0.375` — the unrelated post above the related one — where WASM gives `near=0.597 far=0.138`. Nothing errors; the probe is the only thing that sees it. The wrong numbers were identical to three decimals under two runtimes, the bundled `onnxruntime-web` 1.22.0-dev and 1.30.0, and with `graphOptimizationLevel: 'disabled'` on the session, which rules out both a stale runtime and an optimizer fusion. That leaves a kernel in ORT's WebGPU backend. No other dtype is a way out: q8 already fails there, fp16 is unsafe for this model's activations, and fp32 is about 1.2 GB.

**Reopen it only with a new ORT and a new probe run.** The worker logs `device` on `ready` and on every `scored` line, and the probe result is logged on every load; set `tryWebGPU: true` on one spec and read that log. Gemma on WASM costs about 610-720 ms per post, single-threaded, which is the reason to look again.

## Console noise from the runtime

Two third-party messages used to appear on every load and neither meant anything:

- **`VerifyEachNodeIsAssignedToAnEp`** (twice, in red — ORT pipes its stderr through `console.error`). ORT assigning shape ops to CPU on purpose. Silenced by `env.backends.onnx.logLevel = 'error'` plus `session_options.logSeverityLevel: 3` — the global env does not reach the session logger, so both are needed.
- **`Unable to determine content-length…`** from transformers.js, once per hub file served gzipped without the header. Means only that the progress bar cannot show a percentage for that file; no off switch. Caught by the worker's console capture with every other library message; see conventions.md §Logging.

## Rejected

- **Zero-shot NLI classification.** One forward pass per label per text, scales with topic count, scores normalized over the candidate set.
- **Length-scaled threshold.** Needed by MiniLM, unnecessary with e5. Also multiplicative scaling overshoots any band that starts above zero.
- **A slider linear in cosine.** The original design, a 0.76-0.83 band. Half its travel did nothing and its floor could not reach the feed floor, so "loosest" still blurred a third of a feed. Replaced by the step table above, which is linear in feed shown.
- **A slider linear in feed shown via a live quantile** (blur the bottom N% of recent scores). Guarantees the scale is even, and blurs a fixed share even when the whole feed is on topic — the reason a quantile threshold was dropped (§Rejected). The step table buys the even scale while the threshold stays an absolute score.
- **Relative "blur the bottom N%".** Immune to phrasing, but blurs a fixed fraction even when the whole feed is on topic. Revived in v2 for Rocchio-corrected queries, removed with Rocchio: the window went stale after every correction.
- **Rocchio relevance feedback.** Moved the whole score scale and measured no gain once compared against the base score on the same held-out set. See §Relevance feedback.
- **Multi-anchor topic averaging.** Lost to a plain short list on AUC.
- **Centering by a feed mean.** Mean taken from the other feed: AUC 0.861 → 0.814 on the 205-post feed, 0.894 → 0.904 on the second. The in-sample gain was the mean seeing its own posts.
- **Per-line offset or z-score from a second feed.** AUC 0.838 / 0.831 against 0.861 on the first feed; 0.895 / 0.892 against 0.894 on the second.
- **Shifting the cut by the topic's score on a neutral background** (62 generic posts). The background mean moves only 0.722 – 0.739 across phrasings; the spread in junk share at 0.790 (5% – 36%) comes from how broad the words are, and the shift narrows it only to 4% – 24%.
- **Subtracting the closest neutral text's similarity** (`score - β·max`). AUC +0.013 / +0.017 at β = 0.25, worse from 0.5. The two leaked political posts sit at 0.821 / 0.832 from their closest neutral text against a skip median of 0.817: no signal. A hidden penalty is also a blocklist, which [product.md](product.md) rules out.
- **`multilingual-e5-small` to fix the language problem.** Measured 2026-09-20 against both feeds and rejected on its numbers, not its size. It buys nothing over e5-small-v2 on the owner's English labels (AUC 0.842 vs 0.826, 95% CI of the difference [−0.019, +0.048]) or on Spanish posts (0.718 vs 0.721), and scores _below_ it on `tecnologia` (0.634 vs 0.661). It gains only where topic and post are in different languages (English-post block 0.784 vs 0.680). 118MB for that is not a trade worth offering. EmbeddingGemma beats it in every block.
- **A model registry, while there was one model.** Superseded: see §Model. The comparison is still the reason for each choice; what changed is that one model cannot serve a feed that is not in English.
