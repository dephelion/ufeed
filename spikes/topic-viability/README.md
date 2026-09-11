# Spike §12.2 — topic viability

Answers one question: **does cosine similarity against a free-text topic string
actually separate on-topic from off-topic posts in a real timeline?**

Everything downstream in `spec.md` assumes it does. Nothing else gets built until
this comes back.

## 1. Collect  (you, ~5 min)

1. Open `https://x.com/home` in Chrome.
2. Devtools → Console. If it blocks the paste, type `allow pasting` first.
3. Paste all of `collect.js`, hit enter. A badge appears bottom-right.
4. Scroll your feed at normal reading pace. It dedupes, so re-scrolling is safe.
5. At 200 the badge turns green. Run `__lensing.save()`.
6. Move the downloaded `posts.json` into this folder.

## 2. Label  (you, ~15 min)

Open `label.html` in a browser. Load `posts.json`, type your topic, then
`J` = on topic, `K` = off topic, `U` = undo. Download `labels.json` at the end.

Phrase the topic exactly as you would type it into the extension — that string
becomes the topic vector, so the phrasing is part of what's being tested.

Aim for at least ~15 posts on each side. Very lopsided labels make the numbers
meaningless.

## 3. Score

```
npm install          # ~1 min, pulls transformers.js + onnxruntime
node score.mjs       # add --dtype=fp32 to compare against the unquantized ceiling
```

## Reading the result

**AUC is the headline.** It asks: take one on-topic and one off-topic post at
random — how often does the model score the on-topic one higher?

| AUC | Meaning |
| :-- | :-- |
| ~0.50 | Coin flip. The premise fails; the architecture needs rethinking. |
| 0.65–0.80 | Weak. Try better topic phrasing before blaming the model. |
| 0.80–0.90 | Usable. Proceed, tune the threshold. |
| > 0.90 | Strong. |

The threshold sweep gives the §12.3 default strictness — pick from the
precision/recall tradeoff, not automatically the best F1. For this product,
**precision matters less than recall**: a false positive is one off-topic post
that slipped through, a false negative is something you wanted, hidden.

The two error lists at the bottom are the diagnostic. If the false positives are
all one adjacent subject, the topic string needs narrowing. If the false
negatives are slang, hashtags and thread fragments, that's the out-of-distribution
problem in §4.1 and no threshold fixes it.
