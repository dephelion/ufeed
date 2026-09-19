# The E5 paper, in plain language

FeedLens uses **e5-small-v2**, from the paper _Text Embeddings by Weakly-Supervised
Contrastive Pre-training_ ([PDF](2212.03533v2.pdf)). This page summarizes what the
paper does and how FeedLens leans on it. [`how-it-works.md`](how-it-works.md) covers
the code side.

## The problem

Computers need numbers, not words. An **embedding** turns a piece of text into a
list of numbers (a vector) so that texts with similar meaning get similar vectors.
Compare two vectors and you know how close two texts are, with no keyword matching
and no hand-written rules.

That is exactly the question FeedLens asks of a post: how close is it to the topics
you wrote? The catch, before E5, was that a good general-purpose embedding model
needed a huge set of human-labeled pairs ("these two sentences mean the same
thing", "these two don't"), which is expensive to make.

## How E5 solves it

The authors skipped the labels. They collected about 270 million text pairs that
already belong together on the web: a Reddit post and its comment, a question and
its answer, a title and its article. This is the "weakly-supervised" part: cheap,
a little noisy, and no one had to label anything.

They trained the model with **contrastive learning**. It is shown which pairs
belong together, and it treats the other pairs in the same batch as the ones that
don't. It adjusts until related texts land close together and unrelated ones far
apart. A second, smaller pass on a few labeled datasets then sharpens it.

Under the hood it is a standard BERT-style transformer. It reads the text and
averages its output into one fixed-size vector. The paper releases three sizes:
small (33M parameters), base (110M) and large (330M). Bigger is more accurate and
heavier, which is why FeedLens uses the small one: it has to run inside a browser.

## Results

Without any labeled training data for the task (zero-shot), E5 was the first
embedding model to beat BM25, the decades-old keyword-search standard, on a
well-known retrieval benchmark. After fine-tuning, it also outperformed embedding
models about 40 times its size. Strong quality for its cost is why it suits an
extension.

## How FeedLens uses it

- Each topic line is embedded as `query: <topic>`, and each post as
  `passage: <text>`. E5 was trained with those two tags, and its scores get worse
  without them.
- A post's score is its highest cosine similarity against any topic line.
- Everything after that — the strictness thresholds, the peek strip, thumbs — is
  FeedLens, not the paper.

The paper also explains what the model cannot do: it trails keyword search when a
match depends on exact wording, it was trained on English, and it reads words
only. Those limits show up as FeedLens's limits. See
[What the model does](how-it-works.md#what-the-model-does).
