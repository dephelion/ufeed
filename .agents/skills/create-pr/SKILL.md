---
name: create-pr
description: Use when asked to create, open, or update a pull request (PR) for a web project; inspects diff, runs risk-proportional verification, executes Contrarian review, and submits via GitHub CLI.
---

# Create PR

Apply this workflow when creating or updating a Pull Request. Inspect changed files, project setup (`package.json`, build configuration), and architectural boundaries before executing verification and submitting the PR. Never claim checks, type-checks, or browser verifications that were not physically executed.

## 1. Execution Workflow

1. **Branch & Git Push**:
   - Ensure changes are on a descriptive feature branch (never push directly from `main`/`master`).
   - Push local commits to remote (`git push origin HEAD` or `git push -u origin <branch-name>`).
2. **Automated Verification**:
   - Inspect project scripts in `package.json`.
   - Run baseline checks: Type checking (`tsc --noEmit`), Linting (`npm run lint`), and Unit/Integration Tests (`npm test`).
   - For 🟡 **Medium** and 🔴 **High** risk changes, or altered bundle configurations, execute the production build (`npm run build`).
3. **Contrarian Review**:
   - Inspect the git diff (`git diff main...HEAD`).
   - Probe web application edge cases: unhandled async/network failures, missing loading/error UI states, breaking API payload contracts, memory/event listener leaks, and RBAC/auth checks.
   - **For 🔴 High risk changes only**: Execute real-browser E2E verification. Check project dependencies for existing browser runners. Prefer [Patchright](https://github.com/Kaliiiiiiiiii-Vinyzu/patchright); fall back to Playwright when Patchright is unavailable or incompatible. Patchright supports Chromium only; use Playwright for Firefox or WebKit coverage. Start the app using its documented local command and exercise changed workflows in a real browser. Record the tool, browser, scenario, outcome, and artifacts in Proof of Work. Do not describe code inspection or unit tests as real-browser E2E.
   - Contrarian review is best-effort at levels proportionate to risk: code inspection, edge-case analysis, integration checks, and real-browser E2E where required or useful. Record levels performed, issues fixed, and unresolved findings in Proof of Work.
   - **Circuit Breakers**: Max 3 fix attempts per finding. If a fix increases total change scope by >25% relative to the original prompt, stop and ask the user before proceeding.
4. **PR Submission**:
   - Check existing PR status: `gh pr view --json url,state`.
   - If confidence is <7/10 or critical findings remain unresolved, append `--draft` when creating the PR.
   - If PR exists: Update title and body via `gh pr edit --title "<title>" --body "<description>"`.
   - If PR does not exist: Open PR via `gh pr create --title "<title>" --body "<description>"`.

---

## 2. Risk Classification

Select the highest matching level based on blast radius, reversibility, and architectural depth:

- 🟢 **Low:** Localized, fully reversible changes with no cross-layer dependencies (e.g., UI tweaks, docs, isolated utility functions).
- 🟡 **Medium:** Behavior changes contained within a single layer or feature module; moderate blast radius, fully testable.
- 🔴 **High:** Cross-layer changes, breaking API/schema modifications, core business logic (auth, payments, global state), or changes risking application availability.

---

## 3. PR Description Template

Inspect the repository's pull request template before drafting the PR body. Adapt the PR body to that template: preserve its existing sections, order, prompts, and checklists; include risk, Proof of Work, Contrarian review, and confidence in matching sections or add those sections to the PR body where needed. Keep every project-specific check. Never edit the repository template as part of creating or updating a PR unless the user explicitly requests a template change.

If the repository has no pull request template, use this fallback format:

```markdown
## Summary of Changes

- <Concise summary of WHAT and WHY, including a bulleted list of changes>

## Risk

🟢 Low / 🟡 Medium / 🔴 High — <Concise justification based on blast radius, layer, and reversibility>

## Proof of Work

- [ ] Formatting, including documentation — `<command>`: <outcome or reason>
- [ ] Unit and/or integration tests — `<command>`: <outcome or reason>
- [ ] Production build — `<command>`: <outcome or reason>
- [ ] DOM snapshots for presentational changes — `<command>`: <outcome or reason>
- [ ] Contrarian review — <levels performed and outcome: code, edge cases, integration, real-browser/E2E>
- [ ] Real-browser E2E — `<tool/command>`: <scenario and outcome or reason; required for cross-layer/breaking changes lacking other verification>
- [ ] Manual E2E Gate — <outcome or reason; required for cross-layer/breaking changes lacking automated verification>
- Fixed during Contrarian review — <one concise line per issue, or None>
- Unresolved findings — <finding and impact, or None>

## Confidence Score

<0–10>/10 — <Brief justification grounded in test coverage and remaining uncertainty>
```

---

## 4. Operational Rules

- **Honesty First**: Keep unperformed or failing checks as `[ ]` and state the exact reason or technical limitation.
- **Conciseness**: Keep descriptions direct, technical, and actionable for human code reviewers.
- **Scope Protection**: Document unresolved findings in the body rather than entering infinite bug-fix loops.
