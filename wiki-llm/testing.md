# Testing

> **Maintenance Invariant:** Tiers, what each covers, what nothing covers. Update in the SAME commit as any new tier or runner change. Token-optimized: imperative, no prose, no redundancy.
> **Answers:** What is tested and how. What no test catches. Commands.

## Tiers

| Tier      | Command              | Runtime | Covers                                                       |
| :-------- | :------------------- | :------ | :----------------------------------------------------------- |
| Unit      | `npm test`           | <1s     | Pure logic, protocol guards, cache, settings, blur DOM.      |
| Adapter   | `npm test`           | <1s     | Selectors against captured fixture HTML, happy-dom.          |
| Model     | `npm run test:model` | ~3s     | The real model on real feed text. Separate config, node env. |
| Typecheck | `npm run compile`    | ~2s     | `tsc --noEmit`.                                              |

`npm test` excludes `*.model.test.ts` — it loads weights. Both suites are offline once the model is cached.

## What to assert

Track the decision, not the wording. **Worth asserting:** a post was blurred or revealed · a score crossed the threshold · a message round-tripped · a fail-open path fired · post text never reaches a log. **Not worth asserting:** blur radius, opacity, transition timing, CSS order, vendor DOM shape.

Adapters test against **captured fixture HTML, never a live fetch**. A vendor DOM change must fail red, not silently match nothing.

Model tests assert **gaps and orderings, never absolute scores** — absolutes are model-specific, and two assertions had to be rewritten when the model changed for exactly that reason.

## What no test covers

Model loading, WebGPU initialisation, and real scoring in a browser. Those need a build loaded in Chrome or Firefox and the popup status watched. A green suite is not a working extension.

The backend self-check ([model.md](model.md)) is the runtime substitute: it catches a miscomputing backend on the user's hardware, which no CI can.

## Full check

```
npm run compile && npm test && npm run build && npm run build:firefox
```
