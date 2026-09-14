# Model & Scoring

> **Maintenance Invariant:** Model choice, score semantics, thresholds, measured findings. Numbers live here, never in code comments. Update in the SAME commit as any model, band, or threshold change. Token-optimized: imperative, no prose, no redundancy.
> **Answers:** Which model and why. What a score means. How the threshold is set. Why a backend gets rejected. What was measured and rejected.

## Model

`Xenova/e5-small-v2`, q8, ~33MB, downloaded once and cached by the browser (Cache API, evictable).

**Retrieval model, not a similarity model.** The task is a short topic against a longer post — asymmetric. Prefixes are mandatory and asymmetric too:

```
topic → "query: software, programming"
post  → "passage: <text>"
```

`src/ml/models.ts` is the single source for the id, the prefixes, the strictness scale and the probe bounds. One constant, no registry, no runtime branching.

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

## Score semantics

**Scores are model-relative.** Unrelated text sits near **0.74** with e5 and near **0.00** with a symmetric model. Never persist a score; persist the slider position and derive.

Measured distribution, topic `tech, software, ai`: on-topic mean **0.806**, off-topic mean **0.771**. The whole decision lives in a **0.035-wide strip**. Near-misses are structural, not a bug.

**Length does not shift e5.** On-topic mean by post length: 0.804 / 0.800 / 0.814 / 0.810 across 0-80 / 80-150 / 150-250 / 250+ chars. MiniLM ran 0.096 → 0.233 over the same buckets and needed a length penalty; e5 does not. The penalty was deleted.

## Language

**e5-small-v2 reads English only.** Text in another language still gets a score, and that score is noise — drawn from across the usable band with no relation to the topic. No threshold fixes it.

Measured on the same 205 posts, topic `tech, software, ai`: **68 of them are Spanish, and every one is labelled off topic.** Their scores run **0.727 – 0.825**, mean **0.769** — the scale spans 0.69 – 0.82, so the model places Spanish posts on both sides of every threshold the slider can reach. **18 of the 54 posts above the default threshold are Spanish**: a third of all leaks, none of them judged.

Reproduce with the harness in `.local/`: classify each post's language, then compare the score distribution against the English posts'.

`MODEL.language` is the single source. The gate compares against it, never a literal `en`, so a model swap moves it.

**Detection is `browser.i18n.detectLanguage()`** — Chrome's CLD, shipped in Chrome 47+ and Firefox 47+, no permission, available to content scripts. Nothing to bundle, nothing to keep trained. Rejected: `languagedetect` (npm, unmaintained, bundled trigram tables) and a hand-rolled English function-word rate — measured at **67 of 68 Spanish posts flagged with 0 false positives**, good enough to ship and still worse than CLD for free.

**Reliable but split does not count as placed.** CLD returns a share per language; below `MIN_SHARE = 60` for the top one the post is mixed, the model reads at most half of it, and the verdict is `unclear`.

**`unclear` is not `other`.** CLD read the text and could not place it — that is a statement about how much text there is, not about which language. It feeds the thin-media rule, which already owns that claim. Only a reliable foreign placement blurs as a language.

**On by default**, behind `blurOtherLanguages`. A post the model cannot read against English topics is a post Lensing cannot judge, so the default blurs it rather than showing it unfiltered; a monolingual English feed pays nothing for the check either way.

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

**Uncertainty straddles the threshold and is worse above it.** Posts at 0.790-0.810 are 26-40% wanted and are shown today with nothing marking them as doubtful. The tiers fix the half below the line; relevance feedback is aimed at the half above it.

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

**Recall alone is not a reason to pick a step, and picking on it once shipped a bad default.** Step 5 reads well — 96% of what was wanted survives — and hides that **73% of what survives is junk**, 27.6 unwanted posts per 10 wanted. Recall is nearly free at a loose threshold, because a loose threshold shows everything: step 0 keeps 100% by showing 100%. Only precision says whether the filter did anything.

**The asymmetry runs toward strictness, not away from it.** The earlier default argued that a false blur costs a click and a false pass costs a scroll, so be forgiving. That undercounts twice. A false blur is **labelled and recoverable** — it announces itself, the peek tier shows the opening words, one click undoes it. A false pass is **invisible**: nothing marks it, there is nothing to recover, the reader simply reads it. And at step 5 false passes outnumber hits 27 to 10. The cheap error is the one the reader can see.

Step 5 to 7 costs 9 points of recall and takes junk from 27.6 to 15.0 per 10 wanted — about half the noise for about a tenth of the signal.

**Step 10 is noisy.** At 4% of a feed it rests on ~25 observations, which is why its junk share reads above step 9's. Treat the last step as "as strict as this goes", not as a measurement.

**Recall falls off a cliff after step 7.** Steps 8-10 keep 67%, 42% and 15%. The scale stays even in feed volume there on purpose — the reader asked for less feed, and that is what less feed costs. Precision still climbs to step 9, so a reader whose topic phrasing is sharper than the calibration topic can sit at 8 or 9 and keep what they want.

`feedShownAt()` and `junkShownAt()` read the table for the popup hint, which names both — a hint quoting only the good half would be lying at every step. One sample, one feed — a guide, not a promise.

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

`q' = normalize(q + 0.6 * mean(liked) - 0.4 * mean(disliked))` — Rocchio, applied to every topic vector in the worker. No training: vector arithmetic over embeddings already computed.

Measured on the 205 posts with feedback items **held out** of evaluation, at equal feed volume, 40 trials per row:

| Corrections | Recall | Leaks | AUC       |
| ----------: | -----: | ----: | :-------- |
|           0 |    92% |  54.0 | 0.881     |
|           4 |    96% |  52.3 | 0.896     |
|           8 |    96% |  50.3 | 0.902     |
|          16 |    96% |  47.5 | 0.908     |
|          32 |    97% |  42.0 | **0.936** |

**Corrections are per topic line, not per topic set.** Scoring takes the max across lines, so a rating attaches to the line that came closest to claiming the post — the worker returns that index with the embedding. Editing one line discards only that line's corrections; the rest survive, including a reorder.

**One rating per post, keyed by `hashText`.** Re-clicking the same thumb un-rates; the other thumb flips it in place. A duplicate would weight one post's vector twice in the centroid.

**Off by default**, behind `tuneFromFeedback` ("Learn from my thumbs" in the popup). An uncorrected query needs no relative threshold and is better calibrated, so the mechanism stays inert until asked for.

**A new model deletes every correction, on every install.** Vectors are stamped with the model that made them and dropped when it changes ([architecture.md](architecture.md)); the post text was discarded at rating time, so nothing can be re-embedded. The table above is what a reader loses and has to rebuild by hand: 32 corrections is +0.055 AUC. Weigh that against the AUC a candidate model gains before shipping it, and tell the reader in the popup why their counts went to zero.

## Relative strictness

**A corrected query moves the whole score scale.** Left at a fixed 0.784, recall **collapsed to 11%**. Once corrections exist the threshold becomes the quantile of the last 300 scores that keeps the same share of feed the absolute threshold would have.

**Absolute until the first correction.** It is better calibrated, and it never blurs a feed that is entirely on topic. Below `MIN_SAMPLE = 30` scores the quantile is noise, so the absolute threshold stands.

## Backend self-check

A backend can load, report ready, run fast, and return confident nonsense. ORT's **WebGPU backend miscomputes the q8 model**: a Spanish political post scored 0.32 against `tech` where CPU gives 0.001. Nothing errors.

After load, `Embedder.selfCheck()` embeds a fixed probe pair and rejects the backend unless both hold:

- `near >= probeMinNear`
- `near - far >= probeMinGap`

Bounds are per-model and live in `models.ts`. The **gap** is the robust signal; absolute scores are not comparable across models. Rejection falls through to the next device; if none pass, the thrown error names every failure.

**WebGPU therefore fails on every load** (`near=0.901 far=0.898`, against a required gap of 0.06), which makes it an expected event, not a warning. It logs at `info` while another device remains; only a rejection with no fallback left logs at `warn`.

## Console noise from the runtime

Two third-party messages used to appear on every load and neither meant anything:

- **`VerifyEachNodeIsAssignedToAnEp`** (twice, in red — ORT pipes its stderr through `console.error`). ORT assigning shape ops to CPU on purpose. Silenced by `env.backends.onnx.logLevel = 'error'` plus `session_options.logSeverityLevel: 3` — the global env does not reach the session logger, so both are needed.
- **`Unable to determine content-length…`** from transformers.js, once per hub file served gzipped without the header. Means only that the progress bar cannot show a percentage for that file; no off switch. Caught by the worker's console capture with every other library message; see conventions.md §Logging.

## Rejected

- **Zero-shot NLI classification.** One forward pass per label per text, scales with topic count, scores normalized over the candidate set.
- **Length-scaled threshold.** Needed by MiniLM, unnecessary with e5. Also multiplicative scaling overshoots any band that starts above zero.
- **A slider linear in cosine.** The original design, a 0.76-0.83 band. Half its travel did nothing and its floor could not reach the feed floor, so "loosest" still blurred a third of a feed. Replaced by the step table above, which is linear in feed shown.
- **A slider linear in feed shown via a live quantile** (blur the bottom N% of recent scores). Guarantees the scale is even, and blurs a fixed share even when the whole feed is on topic — the same reason relative strictness is not the default. The step table buys the even scale while the threshold stays an absolute score.
- **Relative "blur the bottom N%" as the default.** Immune to phrasing, but blurs a fixed fraction even when the whole feed is on topic. **Revived conditionally in v2**, never as the default: relative only once relevance feedback has moved the query and an absolute cosine has stopped meaning anything.
- **Multi-anchor topic averaging.** Lost to a plain short list on AUC.
- **`multilingual-e5-small` to fix the language problem.** Scores other languages correctly, and that is the wrong outcome twice: ~33MB q8 becomes ~120MB (250k vocab), and every measured number on this page — band, `PEEK_BAND`, the `estimateFeedShown` curve, the probe bounds — is calibrated to e5-small-v2 and would have to be re-measured. It would also correctly surface on-topic posts in languages the reader does not want, which is the opposite of what the gate is for.
- **A model registry.** One model, chosen by measurement. The comparison is the reason for the choice, not a runtime branch.
