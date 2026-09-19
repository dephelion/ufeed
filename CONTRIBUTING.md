# Contributing to FeedLens

Thanks for looking. FeedLens is small on purpose, and a good bug report is often
worth more than a patch: the bug template asks for the few things that make one
reproducible.

## Before you write code

- **Open an issue first** for anything bigger than a bug fix. The scope is narrow
  by design: no cloud or LLM inference, no accounts, and no new sites without a
  decision. [`wiki-llm/product.md`](wiki-llm/product.md) lists what FeedLens will
  not do.
- **Read [`wiki-llm/architecture.md`](wiki-llm/architecture.md).** It is the
  design doc: the three layers (content script, engine iframe, worker), the
  messages between them, and why each exists. `wiki-llm/` is written tersely,
  for AI coding agents first, but it is the source of truth for people too.
- **Know the five rules every change keeps**, in
  [`wiki-llm/conventions.md`](wiki-llm/conventions.md): post text never leaves
  the device; anything that breaks shows the feed instead of blurring it; the
  host page is never broken; Chrome and Firefox both work; no model work on the
  page's main thread.

## Working on it

```bash
npm install
npm run watch            # debug build on every change; not `npm run dev`
npm run check            # format, typecheck, tests, both builds
```

[`docs/development.md`](docs/development.md) covers loading the build, reading
the logs, and why `npm run dev` cannot run the engine.

- Branch from `main` and open a pull request. CI runs `npm run check`.
- If the change moves architecture, permissions, the model, thresholds,
  selectors or visible behaviour, update the owning `wiki-llm/` page in the same
  pull request.
- Try it in Chrome **and** Firefox if it touches the manifest, messaging or the
  engine.

## Security and privacy issues

Report them privately, not in an issue. [`SECURITY.md`](SECURITY.md) says how.

## License

Contributions are licensed under [GPL-3.0-or-later](LICENSE), the same as the
rest of the project.
