# How it works

```mermaid
flowchart TB
  subgraph host["Host page — https://x.com"]
    dom["feed DOM"]
    cs["content script<br/>finds posts, applies the blur"]
    dom -- "post text" --> cs
    cs -- ".lx-blur" --> dom
  end

  subgraph ext["Extension origin — chrome-extension://"]
    frame["hidden iframe<br/>routes messages"]
    subgraph thr["worker thread"]
      wk["e5-small-v2<br/>topic = query, post = passage<br/>embed, then cosine<br/>stack detailed below"]
    end
    frame -- "texts" --> wk
    wk -- "scores" --> frame
  end

  cs == "texts" ==> frame
  frame == "scores" ==> cs
```

Three layers, each for one reason. The **content script** lives inside the page,
so it is the only part that can read the feed or blur anything. The **iframe**
exists because a content script cannot spawn an extension-origin worker, but a
document already on that origin can. The **worker** is a separate thread, so
scoring never blocks scrolling.

The iframe never sees the page: strings go in, scores come out. That boundary is
what keeps post text on your device, and it is why the model layer knows nothing
about X.

## What the model does

Lensing does not train a classifier on your topics. It uses **e5-small-v2**, a
text _embedding_ model from Microsoft ([E5 paper](2212.03533v2.pdf); v2 is
a later release by the same authors, using the same method). An embedding
turns text into a vector, a fixed list of 384 numbers, so that texts about the
same thing end up close together.

Scoring a post takes three steps:

1. The topic line becomes `query: tech, software, ai`, and the post becomes
   `passage: <text>`.
2. The same model turns both into vectors.
3. The score is the cosine between the two vectors: how closely they point the
   same way. With several topic lines, a post keeps its best score.

**Why no training is needed.** E5 learned from a very large set of text pairs
that naturally belong together on the web: a Reddit post and its comment, a
StackExchange question and its answer, a title and its article. Training pulled
each pair's vectors together and pushed apart the other pairs in the same batch.
A short topic against a longer post has the same shape as a question against its
answer, so the model can already match them. The paper handles zero-shot
classification the same way: it embeds the label and the input, then picks the
closest.

**Why the prefixes matter.** One model encodes both sides. `query:` and
`passage:` tell it which side of the pair a text is on, because a three-word
topic and a paragraph of post are different kinds of text. The model was trained
with these tags, and its scores get worse without them.

**Why scores sit in a narrow band.** Cosine can run from −1 to 1, but that is not
how e5 uses the range. During training, every similarity was divided by a
temperature of 0.01. The model was rewarded for ranking the right passage first,
not for spreading scores out. As a result, almost any English text scores well
above zero against almost any topic, and on-topic and off-topic posts are only a
few hundredths apart. That is why strictness is a step on a measured scale rather
than a raw cosine, and why this model's scores mean nothing to a different model.

**What it cannot do.**

- **Read other languages.** It was trained and evaluated on English. Text in
  another language still gets a score, but that score is noise. Lensing checks a
  post's language before trusting its score.
- **Match exact strings reliably.** The paper notes that embedding models still
  trail keyword search when a match depends on exact wording or a niche domain. A
  topic that is only a product name or a ticker matches less reliably than plain
  words that describe the subject.
- **See images.** It reads words only.

## Inside the worker

"Embed" is four pieces of machinery, and the console lines on a cold start come
from three different ones — so it is worth knowing which is which. The thick
edges are the same `texts` / `scores` pair the first diagram draws, seen from the
other side of the worker boundary.

```mermaid
flowchart TB
  frame["engine.ts — the iframe document<br/>relays, holds no state<br/>MessagePort to the content script"]

  subgraph wkr["worker thread — engine.worker.ts"]
    tj["transformers.js<br/>tokenize · mean-pool · normalize"]
    ort["ONNX Runtime (ORT)<br/>executes the graph, node by node"]
    wasm["wasm execution provider<br/>SIMD, single thread"]
    cpu["CPU<br/>shape ops, on purpose"]
    out["vectors → cosine vs topic vectors<br/>= the score"]
    tj --> ort
    ort --> wasm
    ort -. "some nodes" .-> cpu
    wasm --> out
    cpu --> out
  end

  frame == "SCORE texts<br/>worker.postMessage" ==> tj
  out == "SCORES, STATUS<br/>self.postMessage" ==> frame

  gpu["webgpu execution provider<br/>rejected every load:<br/>miscomputes q8"]
  ort -. "tried first" .-> gpu

  weights[("hub CDN<br/>e5-small-v2 q8 weights<br/>fetched once, then cached")] -. "model" .-> tj
  runtime[("bundled /ort/*.wasm<br/>never fetched at runtime")] -. "engine" .-> ort
```

The model produces one vector for each token, where a token is a word or part of
a word. transformers.js averages those vectors into one vector for the whole
text; this is the **mean pool**. E5 was trained with that averaging, so a
different pooling method would produce vectors the model never learned. The
result is then scaled to length 1, which makes the cosine a plain dot product.

**ONNX** is the model's file format — graph plus weights, framework-independent.
**ORT** is Microsoft's engine that executes it, and an **execution provider** is a
backend ORT can hand an operation to. Assignment is per operation, not per model:
ORT deliberately keeps shape ops on CPU because moving them costs more than they
save. That is all its `VerifyEachNodeIsAssignedToAnEp` line means, which is why
the runtime is configured to log errors only.

The two supply lines are deliberately different. **Weights** come from the hub CDN
on first load and live in the browser cache after that. The **runtime WASM** is
bundled in the extension and never fetched — remote WASM is reviewed as remote
code execution, and that is not a review this extension needs to pass.

WebGPU is tried first on every load and rejected on every load: ORT's WebGPU
backend misreads the q8 weights and returns confident nonsense rather than
failing, so the self-check probe is the only thing standing between that and a
feed blurred at random. `wasm` is the steady state.

## Tuning it yourself

The model itself never changes. You do not retrain it, and no weights move.
Every control changes one of two things:

- **The query vector:** what "on topic" means.
- **The threshold:** how close a post has to be to count.

**Topic words change the query.** Each topic line is embedded as one `query:`.
It is the only text you write, so it has the largest effect. E5 learned to match
a question to its answer, so it does best with words a matching post would
actually use:

- Use two to five concrete words, not a category name or a sentence. Filler such
  as "posts about" gets matched too.
- Put separate interests on separate lines. A post keeps its best score across
  lines, so it only has to match one of them.

**Strictness changes the threshold.** A post is shown when its score reaches the
threshold. e5 packs all scores into a narrow band (see above), so a slider that
moved the cosine evenly would do nothing for half its travel. Each of the 11
steps is a threshold measured to hide about another tenth of a typical feed.
Higher steps hide more noise, and also more of what you wanted.

**The peek strip marks the close calls.** Just below the threshold is a thin
strip where a post could still be wanted. Posts there stay blurred, but their
first few words remain readable, so you can judge them without revealing them.
The strip's width is fixed in score units, so it moves with the threshold.

**Thumbs change the query using examples.** This is off until you turn on _Learn
from my thumbs_. It uses **Rocchio relevance feedback**, a classic
search-engine technique that is older than E5:

```
new query = normalize(query + β·mean(kept) − γ·mean(blurred))
```

Here `β` and `γ` are fixed weights, and the pull toward kept posts is stronger
than the push away from blurred ones. The method works because of how E5 was
trained. In its vector space, direction stands for meaning. The average of the
posts you kept points at what they have in common, and moving the query toward
that point is like adding words you did not think to type. A correction is just
arithmetic on one 384-number vector stored in your browser. Each rated post is
embedded once. Its text is then discarded, and only its vector is kept.

**A corrected topic line gets its own relative threshold.** Moving a line's
query shifts every score that line gives, so a fixed cosine no longer means what
it did before. From its first correction on, that line's threshold is set from
that line's own recent scores, so each strictness step still shows the same
share of the posts it matches. Each line is judged separately: correcting one
line cannot push another line's posts out of view. Lines you have not corrected
keep the fixed threshold. Until a corrected line has seen enough scores of its
own, it borrows a threshold from all your lines' recent scores together.

**Vectors only make sense to the model that made them.** A model update
therefore deletes every correction. The post text is already gone, so nothing
can be embedded again.

To see all of this at work, turn on _Show each post's score_ in the popup. Each
post then shows the score it got and the score it needed.

## What a thumb changes

A thumb corrects **one topic line: the one that came closest to claiming the
post**, which is the same line that gave it its score. The comparison runs
against the line as it currently stands, corrections included, so ratings
compound on the line they have already shaped. Rate the same post again and it
un-rates; rate it the other way and it flips, still on the line it was filed
under.

**No individual word is picked out.** The post's text goes to the worker as one
string and comes back as one vector; the topic vector then moves toward the
average of what you kept and away from the average of what you blurred. There is
no keyword extraction to inspect, and nothing that could point at the word that
did it.

Two things follow. Rating a post whose meaning lives in its image teaches the
topic from a caption that was never the point — the model reads words only. And
a correction belongs to one line: rewrite that line and its corrections go with
it, while the other lines keep theirs.

Full reasoning in [`wiki-llm/architecture.md`](../wiki-llm/architecture.md), model
detail in [`wiki-llm/model.md`](../wiki-llm/model.md), terms in
[`wiki-llm/glossary.md`](../wiki-llm/glossary.md), and the model's origin in the
[E5 paper](2212.03533v2.pdf).
