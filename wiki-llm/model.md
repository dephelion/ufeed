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

`src/ml/models.ts` is the single source for the id, the prefixes, the band and the probe bounds. One constant, no registry, no runtime branching.

## Why this model

Measured on 205 labelled posts from a real timeline, 26 on topic (13% base rate). Topic `tech, software, ai`.

**Method, to reproduce:** scrape a feed's visible post text, label each post keep/skip by hand against one topic, then embed both and rank. Report AUC (ranking), d-prime (separation against noise), and the share of the feed surviving the threshold that keeps 80% of the labelled keeps. Harness and data are gitignored under `.local/`; the data is personal.

| Model                  | AUC       | d-prime  | Feed shown at 80% recall |
| :--------------------- | :-------- | :------- | :----------------------- |
| **e5-small-v2**        | **0.881** | **1.61** | **20%**                  |
| all-MiniLM-L6-v2       | 0.826     | 1.29     | 33%                      |
| bge-small-en-v1.5      | 0.817     | 1.25     | 34%                      |

MiniLM is trained sentence-to-sentence; it compressed every score toward zero and failed both real cases:

| Post                                        | MiniLM | e5    |
| :------------------------------------------ | :----- | :---- |
| Multi-computer copy/paste (tech)            | 0.005  | 0.826 |
| "Almeida destrozando a TelePedro." (politics)| 0.133  | 0.742 |

## Score semantics

**Scores are model-relative.** Unrelated text sits near **0.74** with e5 and near **0.00** with a symmetric model. Never persist a score; persist the slider position and derive.

Measured distribution, topic `tech, software, ai`: on-topic mean **0.806**, off-topic mean **0.771**. The whole decision lives in a **0.035-wide strip**. Near-misses are structural, not a bug.

**Length does not shift e5.** On-topic mean by post length: 0.804 / 0.800 / 0.814 / 0.810 across 0-80 / 80-150 / 150-250 / 250+ chars. MiniLM ran 0.096 → 0.233 over the same buckets and needed a length penalty; e5 does not. The penalty was deleted.

## Threshold

Slider position `0..1` maps onto a band; the band is a user setting, defaulting to the model's.

| Slider | Threshold | Recall | Feed shown |
| -----: | --------: | -----: | ---------: |
| 0%     | 0.760     | ~97%   | ~65%       |
| 25%    | 0.777     | 92%    | 40%        |
| **35%**| **0.784** | **~90%**| **~35%**  |
| 50%    | 0.795     | 88%    | 25%        |
| 75%    | 0.813     | ~45%   | 12%        |
| 100%   | 0.830     | ~10%   | 3%         |

Default **0.35**, deliberately forgiving: a false blur costs a click on something wanted; a false pass costs one scroll past something unwanted. Not symmetric.

Band default `0.76 – 0.83`. Outside it the slider does nothing useful in either direction. `usableBand()` rights an inverted or collapsed band from the advanced inputs.

`estimateFeedShown()` interpolates the table above for the popup hint. One sample, one topic — a guide, not a promise.

## Topic phrasing

Measured, same 205 posts:

| AUC   | Topic                                                        |
| :---- | :----------------------------------------------------------- |
| 0.848 | `software`                                                    |
| 0.876 | `software, programming`                                       |
| 0.869 | `software programming engineering` (no commas)                |
| 0.850 | `software, programming, engineering`                          |
| 0.882 | `software, programming, engineering, AI, hardware`            |
| 0.853 | 8 words                                                       |
| 0.834 | `software and programming and engineering`                    |
| 0.815 | `posts about software engineering, programming languages...`  |

Rules that hold: two to five words beats one; sentences and `and` cost 0.05-0.07 because filler is matched too; commas make no measurable difference. Differences under ~0.03 are noise on this sample — **which** words matter more than how many.

Concrete beats abstract: posts write about code, not about categories. `tech` scored 0.005 on a Linux/macOS post; `software` scored 0.097.

## Backend self-check

A backend can load, report ready, run fast, and return confident nonsense. ORT's **WebGPU backend miscomputes the q8 model**: a Spanish political post scored 0.32 against `tech` where CPU gives 0.001. Nothing errors.

After load, `Embedder.selfCheck()` embeds a fixed probe pair and rejects the backend unless both hold:

- `near >= probeMinNear`
- `near - far >= probeMinGap`

Bounds are per-model and live in `models.ts`. The **gap** is the robust signal; absolute scores are not comparable across models. Rejection falls through to the next device; if none pass, the thrown error names every failure.

## Rejected

- **Zero-shot NLI classification.** One forward pass per label per text, scales with topic count, scores normalized over the candidate set.
- **Length-scaled threshold.** Needed by MiniLM, unnecessary with e5. Also multiplicative scaling overshoots any band that starts above zero.
- **Relative "blur the bottom N%".** Immune to phrasing, but blurs a fixed fraction even when the whole feed is on topic.
- **Multi-anchor topic averaging.** Lost to a plain short list on AUC.
- **A model registry.** One model, chosen by measurement. The comparison is the reason for the choice, not a runtime branch.
