# Product & Positioning

> **Maintenance Invariant:** Decisions about what uFeed is and is not. Update in the SAME commit as any change to user-facing copy, the store listing, or scope. Token-optimized: imperative, no prose, no redundancy.
> **Answers:** What is uFeed for, what will it never do, which words may user-facing copy claim.

## Position

- Two independent filters. Topics keep posts about chosen subjects and blur the rest. A keyword blacklist blurs posts containing listed words or phrases; it works alone or alongside topics. With blacklist-only filtering, nonmatching posts stay visible.
- Private by construction. Inference on-device only. No account, no server, no analytics.
- Predictable over clever. Embedding model: same post, same score. Every control is inspectable (strictness, scores, peek strip, thumbs).
- Blur, never delete. One click reveals.
- Open source, GPL-3.0-or-later. Forks stay open. The name uFeed is not licensed with the code.

## Non-goals

- No cloud or LLM inference, hosted or bring-your-own-key. Violates the Privacy invariant in `AGENTS.md`.
- No competing on model accuracy with cloud LLMs. Compete on privacy, predictable on-device filtering, and a model fast enough for a good first-run experience. The larger Gemma model is the default because it handles every language; the smaller English-only model remains available.
- Platform count is not a goal. X, LinkedIn, Reddit ship. Add no adapter without an explicit decision.
- No accounts or backend in the core filter.

## Copy rules

- Lead the English site and social card with "Take back your feeds." Keep the headline tied to controlling one's own feeds, not judging post quality.
- Claim only what is true today. "Nothing leaves the device" carries one exception: the one-time model weights download.
- State limits plainly: words not images, subjects not quality, not perfect. Say which model a limit belongs to — the optional e5-small model reads English only, while the default Gemma model reads every language.
- Lead store copy with privacy and open source before features. Link the repo. Never name the license in store copy.
- Name no competitor in user-facing text.
- One short description, three places, identical: `public/_locales/en/messages.json` (`extDescription`, which the manifest reads), `package.json`, `docs/store-listing.md`. Store limit 132 chars. A change means every other locale's `extDescription` changes with it.
- Every claim above holds in every language. A translation states the same limits and adds none.

## Where copy lives

| File                    | Holds                                                       |
| :---------------------- | :---------------------------------------------------------- |
| `README.md`             | Pitch, install, build, architecture, pointers. No runbooks. |
| `docs/how-it-works.md`  | Design choices and their costs, then the machinery.         |
| `docs/store-listing.md` | Store copy and review answers.                              |
| `docs/development.md`   | Run, debug, test, add a language.                           |
| `public/_locales/*`     | Every string the extension shows. `en` is the source.       |
