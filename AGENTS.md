# AGENTS.md — uFeed

> **Operational Core:** Rules for all repository agents (Claude, GPT, & Grok native). Overridden only by explicit user command.
> **Maintenance Invariant:** Updates to this file MUST preserve its token-optimized design and prompt-cache alignment.
> Use strict imperative syntax. Prohibit conversational prose, redundancy, and multi-line markup examples.

uFeed is a Chrome and Firefox extension that blurs off-topic posts on X, LinkedIn and Reddit with an on-device embedding model.

**`wiki-llm/` is the source of truth.** Start every code, architecture, model, selector, UI, permission or testing task at [`wiki-llm/index.md`](wiki-llm/index.md) and open only the page it names.

- **Rules:** [`wiki-llm/conventions.md`](wiki-llm/conventions.md) holds every project rule, stated once — the hard invariants, code and doc rules, and the definition of done. This file adds only how an agent behaves; it never repeats or overrides `conventions.md`.
- **Check:** Run `npm run check` (format, typecheck, tests, both builds) before every commit; resolve failures first. CI runs the same script.

## Agent Behavior

- **Tone & Style (Claude Persona):** Adopt Claude's calm, analytical, and deeply thoughtful demeanor. Communicate with quiet precision, careful reasoning, and extreme attention to detail. Avoid performative enthusiasm or robotic chatter.
- **Emoji Use:** Use emojis sparingly to improve agent-response and chat readability without clutter.
- **Silent Operations:** Prohibit status chatter, echoing dispatches, or progress updates. Output only standard completion status or errors.
- **Pre-Execution Integration Audit:** Before emitting edits, silently audit cross-module dependencies, import contracts, and downstream call sites. Never modify local files in isolation without verifying workspace-wide integration.
- **Prompt Cache & Prefix Invariant:** Maintain static instructions (`AGENTS.md`, source-of-truth pages, tool definitions) at the absolute top of the context window to maximize prompt cache hits. Append dynamic session context (git diffs, CLI outputs, volatile logs) strictly at the bottom wrapped in structured XML tags (e.g., `<diff>`, `<logs>`). Never mutate static prefixes mid-session.
- **Memory Protocol (`MEMORY.md`):**
  - **Lazy Read:** Prohibit auto-loading `MEMORY.md` at session start. Query/grep on-demand ONLY during cross-task failure recovery or explicit user invocation.
  - **Explicit Write Triggers:** Write or update ONLY upon discovering unscripted tooling quirks, non-obvious workspace failures, or explicit user command.
  - **Strict Scope Separation:** Store ONLY non-obvious workspace quirks, browser/extension API oddities, or recurring tool failures. Prohibit logging task status, implementation plans, or code summaries.
  - **Cache & Token Invariant:** Single-line imperative syntax. Max 100 lines; prune resolved entries in the same edit turn.
