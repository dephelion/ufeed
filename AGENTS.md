# AGENTS.md — Lensing (Token-Optimized v1.0)

> **Operational Core:** Rules for all repository agents (Claude, GPT, & Grok native). Overridden only by explicit user command.
> **Maintenance Invariant:** Updates to this file MUST preserve its token-optimized design and prompt-cache alignment.
> Use strict imperative syntax. Prohibit conversational prose, redundancy, and multi-line markup examples.

## Global Cost, Persona & Delegation

- **Tone & Style (Claude Persona):** Adopt Claude's calm, analytical, and deeply thoughtful demeanor. Communicate with quiet precision, careful reasoning, and extreme attention to detail. Avoid performative enthusiasm or robotic chatter.
- **Emoji Use:** Use emojis sparingly to improve agent-response and chat readability without clutter.
- **Explain Plainly (write for a human):** This repo is AI-first, but a human reads every explanation, summary, PR body, and review. State the point first, in plain language. Short sentences. Define a term the first time it appears. Prefer a short list or a small example over a dense paragraph. Cut throat-clearing, hedging, and restatement. If an explanation runs long, it is not done — split it or trim it. Rigor lives in the reasoning, not in the word count.
- **Confirm Before Deciding:** Propose changes to the source of truth (`wiki-llm/`); wait for approval before writing. Answering a question about a wiki page is not permission to edit it. Applies to design decisions with a cost the user has not weighed — model size, dependency weight, added permissions.
- **Architectural Depth & Rigor:** Prioritize long-term maintainability, structural clarity, and root-cause resolution over local micro-hacks or lazy type casts (`as any`).
- **Pre-Execution Integration Audit:** Before emitting edits, silently audit cross-module dependencies, import contracts, and downstream call sites. Never modify local files in isolation without verifying workspace-wide integration.
- **Prompt Cache & Prefix Invariant:** Maintain static instructions (`AGENTS.md`, source-of-truth pages, tool definitions) at the absolute top of the context window to maximize prompt cache hits. Append dynamic session context (git diffs, CLI outputs, volatile logs) strictly at the bottom wrapped in structured XML tags (e.g., `<diff>`, `<logs>`). Never mutate static prefixes mid-session.
- **Scoped Mechanical Edit Delegation:** Execute directly in-thread if the active model is already strong enough for the task at hand. Never spawn a subagent if the active model can perform the task in-thread. Do not delegate trivial edits or edits requiring repository-wide context or specification interpretation.
- **Cheap Validation First:** When a choice has a cheap version and a materially more expensive one, prove the cheap version before proposing the upgrade. Quantify the cost of the expensive path; never fold it in pre-emptively.
- **Test What Was Decided, Not How It Reads:** The line is not code-vs-UI, it is _signal vs prose_. **Worth asserting:** a post was blurred or revealed · a score crossed the threshold · a message round-tripped the engine port · a fail-open path fired · an invariant that must hold (post text never leaves the device, engine never blocks the main thread). **Not worth asserting:** exact blur radius, opacity values, transition timings, CSS property order, DOM structure of a vendor feed. Before writing one, ask: _does this track a decision the code made, or only the words chosen to express it?_
- **Test in Proportion, and Only Once:** Weight by what a failure costs: a privacy leak, a permanently blurred feed, a broken host page — cover thoroughly. Glue, pass-throughs, and loud immediate breakage — usually not. **Never assert the same behaviour at two levels.** Site adapters are inherently brittle against vendor DOM churn: assert against captured fixture HTML, never a live network fetch.
- **Silent Operations:** Prohibit status chatter, echoing dispatches, or progress updates. Output only standard completion status or errors.
- **Code Comments (default: none):** Assume the reader reads code. Write a comment ONLY for a true edge case — a WHY the code cannot express: a browser bug workaround, a vendor DOM quirk, deliberately counterintuitive logic. Prohibit comments that narrate an edit, mark a fix/correction/change, restate the code, or describe what a name already says. Route architectural and protocol explanation to `wiki-llm/`, never inline. When editing a line, delete adjacent obsolete or now-obvious comments.
- **Comment Hard Cap (2 lines):** No comment exceeds 2 lines. A WHY needing more than 2 lines is a `wiki-llm/` page; cite it (`see adapters.md §X`) and stop.
- **Memory Protocol (`MEMORY.md`):**
  - **Lazy Read:** Prohibit auto-loading `MEMORY.md` at session start. Query/grep on-demand ONLY during cross-task failure recovery or explicit user invocation.
  - **Explicit Write Triggers:** Write or update ONLY upon discovering unscripted tooling quirks, non-obvious workspace failures, or explicit user command.
  - **Strict Scope Separation:** Store ONLY non-obvious workspace quirks, browser/extension API oddities, or recurring tool failures. Prohibit logging task status, implementation plans, or code summaries.
  - **Cache & Token Invariant:** Single-line imperative syntax. Max 100 lines; prune resolved entries in the same edit turn.

## 0. Source of Truth: `wiki-llm/`

`wiki-llm/` is the authoritative model of how Lensing works and the map an agent reads before touching code. Consult it first; keep it synced as code changes.

- **Wiki First:** To answer any architectural, model, selector, UI, permission, privacy or testing question — or to orient in an unfamiliar subsystem before reading its source — read `wiki-llm/index.md`, then open ONLY the page it names. Do this BEFORE open-ended grep or spending thinking budget on file reads. Drop to source only when no page covers the question or the page is demonstrably stale (then fix the page).
- **Update-On-Change:** Update the affected `wiki-llm/` page in the SAME commit as any change to architecture, message contract, selectors, model, thresholds, permissions, budgets, or build commands. New page -> add its `index.md` row. Prohibit orphan pages.
- **Authoring Standard (write inline):** Author every `wiki-llm/` edit directly to the token-optimized standard — telegraphic, imperative, one fact per line, no narrative prose, no rule repeated across sections, no multi-line mock examples. Preserve each page's `Maintenance Invariant` header and `> **Answers:**` routing line; never alter meaning, invariants, IDs, or commands.
- **Measurements Live in `wiki-llm/`:** AUC, precision/recall, latency, thresholds, dated findings and negative results NEVER go inline. A constant in code cites its page and nothing more.
- **`specs/` is provenance, not authority.** `specs/v1-spec.md` records how v1 was reasoned about before it was built. Several of its decisions were overturned by measurement. Never cite it as current behaviour.
- **README Scope:** `README.md` carries ONLY what the project is, quickstart, repo layout, and the wiki pointer. Prohibit runbooks, design prose, or measured numbers in `README.md`.
- **Spikes:** measurement harnesses and captured personal data live in gitignored `.local/`. Conclusions graduate to `wiki-llm/` with the method written beside the number. Never commit captured feed data, and never cite `.local/` as authority.

---

## 1. Hard Invariants (Lensing-specific)

1. **Privacy:** Post text never leaves the device, never reaches a log, never persists beyond the session cache. Zero analytics. The only permitted network request is model weights from the CDN.
2. **Fail-Open:** Every error, timeout, and unready state reveals content. No code path may leave a post blurred because something broke. Assert this directly. A backend that loads but miscomputes must be rejected, not trusted (`wiki-llm/model.md`).
3. **Host Page Integrity:** Never break the page. All injected CSS namespaced `.lx-*`. No layout side effects beyond the documented `position: relative` (see `wiki-llm/ui.md`). Never mutate host DOM beyond class and `aria-hidden` toggles.
4. **Cross-Browser Floor:** Every API used must work on Chrome MV3 AND Firefox MV3. Promise-style `webextension-polyfill` only — never callback-style, never an aliased `browser ?? chrome`. Chrome-only paths (`chrome.offscreen`) are optimizations behind a fallback, never the default.
5. **Main Thread:** No inference, embedding, or tokenization on the page's main thread. Ever.

## 2. Atomic Task Execution & Verification

1. **Decomposition & Integration Check:** Before editing, run the Pre-Execution Integration Audit. Decompose multi-file or >10 LOC changes into single-file micro-steps in memory.
2. **No-Re-Read Constraint:** Do not re-read files after editing unless tests/lint fail.
3. **Commit Boundary:** Commit only on logical unit completion or user request. Return silent output (`SUCCESS: <task> micro-step N`). Pre-v1: work directly on `main`. Revisit branch/PR discipline when the extension ships.
4. **Definition of Done:**
   - [ ] Passed Pre-Execution Integration Audit (zero broken cross-module imports/types).
   - [ ] Hard Invariants §1 hold; privacy and fail-open paths covered by assertions.
   - [ ] Automated tests pass cleanly (zero network I/O; adapters tested against captured fixture HTML).
   - [ ] No new test asserts blur radius, timing, color, or vendor DOM shape where the decision behind it would do.
   - [ ] Verified on Chrome AND Firefox when the change touches manifest, messaging, or the engine host.
   - [ ] Full verification command runs clean (`npm run format:check && npm run compile && npm test`).
   - [ ] Zero raw `console.*`; never log post text under any condition.
   - [ ] No new comment except a true edge-case WHY; none over 2 lines; zero measurements or dated findings inline.
   - [ ] Owning `wiki-llm/` page updated in the same commit if architecture, contract, model, thresholds, selectors, permissions, or budgets moved.
   - [ ] Formatter run before commit (`npm run format`).
