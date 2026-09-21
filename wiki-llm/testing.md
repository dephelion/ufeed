# Testing

> **Maintenance Invariant:** Tiers, what each covers, what nothing covers. Update in the SAME commit as any new tier or runner change. Token-optimized: imperative, no prose, no redundancy.
> **Answers:** What is tested and how. What no test catches. Commands.

## Tiers

| Tier      | Command              | Runtime | Covers                                                                   |
| :-------- | :------------------- | :------ | :----------------------------------------------------------------------- |
| Unit      | `npm test`           | <1s     | Pure logic, protocol guards, cache, settings, blur DOM, locale catalogs. |
| Adapter   | `npm test`           | <1s     | Selectors against captured fixture HTML, happy-dom.                      |
| Model     | `npm run test:model` | ~6s     | Both real models on real feed text. Separate config, node env.           |
| Typecheck | `npm run compile`    | ~2s     | `tsc --noEmit`.                                                          |

`npm test` excludes `*.model.test.ts` — it loads weights. Both suites are offline once the models are cached.

**The model suite covers both models and is the only place the second embedder path is exercised.** EmbeddingGemma is a different graph with different prefixes and its own pooled output (`sentence_embedding`, not mean pooling), so it is verified through the shipped `Embedder`, not a spike: its own probe passes, its vectors are 768 wide, a Spanish topic claims a Spanish post above the calibrated threshold, a Spanish topic outranks across languages, English separation survives, and scores land in its band rather than e5's. Determinism is asserted for it too — alone vs in a batch to six digits.

**First run downloads ~197MB** for Gemma on top of e5's 33MB. CI runs `npm run check` only, so it never pays that; a contributor running `test:model` does, once.

**What no test covers: the browser.** Both models run on node CPU here. WASM throughput, memory per tab, and whether a future ORT computes Gemma's q4 correctly on WebGPU (today it does not) are unmeasured by any suite — the worker logs `device` and `msPerPost` for exactly that reason, and the answer comes from a debug build in a real browser.

## What to assert

Track the decision, not the wording. **Worth asserting:** a post was blurred or revealed · a score crossed the threshold · a message round-tripped · a fail-open path fired · post text never reaches a log. **Not worth asserting:** blur radius, opacity, transition timing, CSS order, vendor DOM shape.

**Test in proportion, and only once.** Weight coverage by what a failure costs: a privacy leak, a permanently blurred feed, a broken host page — thoroughly. Glue, pass-throughs and loud immediate breakage — usually not. Never assert the same behaviour at two levels: `policy.test.ts` owns the tiers, `filter.test.ts` only the orchestration around them.

Adapters test against **captured fixture HTML, never a live fetch**. A vendor DOM change must fail red, not silently match nothing.

Model tests assert **gaps and orderings, never absolute scores** — absolutes are model-specific, and two assertions had to be rewritten when the model changed for exactly that reason.

## What no test covers

How a translation fits. Every locale is checked for keys, placeholders and length, never for wrapping or width; open the popup and a feed in each new language ([i18n.md](i18n.md)).

Model loading and real scoring in a browser. Those need a build loaded in Chrome or Firefox and the popup status watched. A green suite is not a working extension.

The backend self-check ([model.md](model.md)) is the runtime substitute: it catches a miscomputing backend on the user's hardware, which no CI can.

## Full check

`npm run check`: format, typecheck, tests, both builds. CI runs the same script.
