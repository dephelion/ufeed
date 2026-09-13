# Glossary

> **Maintenance Invariant:** Term definitions only, ML/scoring vocabulary as used in this repo. No numbers — those live in [model.md](model.md) and stay there. Update in the SAME commit as any new term introduced elsewhere in the wiki. Token-optimized: imperative, no prose, no redundancy.
> **Answers:** What does this term mean, in plain language, as this project uses it.

## Embedding

A list of numbers (a vector) that represents a piece of text's meaning. Similar meanings produce similar vectors. The model's whole job is text → vector.

## Embedding model

The neural net that does the text → vector conversion. `Xenova/e5-small-v2` here, see [model.md](model.md).

## Retrieval model vs. similarity model

Two different things a text embedding model can be trained for.

- **Similarity model** (e.g. MiniLM): trained so two _sentences_ about the same thing land close together. Symmetric — swapping the two inputs doesn't matter.
- **Retrieval model** (e.g. e5): trained so a short _query_ finds a longer _passage_ that answers it — like a search engine. Asymmetric — query and passage are different roles and get different input prefixes (`query: …` / `passage: …`).

Lensing's task — a short topic against a longer post — is asymmetric, which is why a retrieval model wins. Using one without its prefixes, or a symmetric model with prefixes, gives meaningless scores.

## Quantization (q8)

Shrinking a model's numbers from 32-bit floats down to 8-bit integers. Smaller download and faster math, small accuracy cost. `q8` in the model id means the 8-bit version.

## Cosine similarity / score

The number a comparison produces: how aligned two embedding vectors are, from -1 to 1 in theory, but in practice landing in a narrow model-specific range. This is the **score** everywhere in the wiki. It is not a probability and not comparable across different models — see "Scores are model-relative" in [model.md](model.md).

## AUC (Area Under the ROC Curve)

A single number, 0.5 to 1.0, for "how well does this score rank on-topic posts above off-topic ones, across every possible threshold." 0.5 = coin flip, 1.0 = perfect ranking. It says nothing about what threshold to actually use — that's a separate decision (see **Threshold**). Used here to compare models and topic phrasings without committing to a cutoff yet.

## d-prime (d′)

A signal-detection number for how _separated_ the two score distributions are (on-topic vs. off-topic), in units of standard deviation. Higher means the two clusters overlap less, so a threshold placed between them makes fewer mistakes. Where AUC asks "does it rank correctly," d-prime asks "how much daylight is between the two groups."

## Recall

Of everything that _should_ have been kept (labelled on-topic), the fraction the threshold actually lets through. High recall = few false blurs of things the user wanted; says nothing about how much junk also gets through (that's the "feed shown" number alongside it).

## Threshold / strictness

**Threshold**: the score cutoff — above it, a post is shown; below it, blurred. **Strictness**: a 0–10 scale where each step is a measured threshold, spaced so a step spends about a tenth of the feed. Step 0 sits at the feed floor and blurs nothing. The scale is even in what the reader sees, not in cosine — see [model.md](model.md).

## Zero-shot classification

An alternative approach (rejected here, see [model.md](model.md)) where the model is asked to directly classify text against label names it was never specifically trained on, one forward pass per label. Rejected because cost scales with topic count and scores are normalized across labels rather than being independently comparable.

## Self-check probe / gap

Not a standard ML term — this project's own load-time sanity check. Two fixed texts (one expected close, one expected far) are embedded right after the model loads; if the "close" score isn't high enough, or the gap between close and far isn't big enough, the backend (see below) is rejected as broken rather than trusted. Catches a backend that loads fine but silently computes garbage.

## Backend (inference backend)

The underlying engine actually running the model's math — CPU (WASM) or WebGPU here. Same model, same weights; different backend can silently give different (even wrong) numbers, which is what the self-check above guards against.

## ONNX

An open file format for a trained neural net: the graph of operations plus the weights, independent of the framework that trained it. What `Xenova/e5-small-v2` ships as, and what makes running it in a browser possible at all.

## ONNX Runtime (ORT)

Microsoft's engine that executes an ONNX graph. `onnxruntime-web` here, sitting under transformers.js and above the backend; its compiled WASM is the `/ort/` payload the extension bundles rather than fetches. Log lines naming a `.cc` file come from it — that is its C++ source compiled to WASM, not a JavaScript error.

## Execution provider (EP)

ORT's name for a backend it can hand an operation to — `wasm`, `webgpu`, `cpu`. Assignment is per-operation, not per-model: ORT routes some ops elsewhere than the requested EP on purpose, which is what its `VerifyEachNodeIsAssignedToAnEp` message reports. See [model.md](model.md) for why that message is not a fault.
