# Spike §12.2 — results

Run 2026-09-11. 205 posts from a real X timeline, 26 on topic (13%).
Model `Xenova/all-MiniLM-L6-v2` q8, ~4ms/post on node CPU.

## Verdict: premise holds

**AUC 0.826** — the model reliably ranks on-topic posts above off-topic ones.
At threshold 0.18: scroll 27 posts instead of 205, still catch 14 of 26.
Signal density 13% → 52%.

Useful score range is **0.02–0.30**, not 0–0.6. Nothing survives above 0.42.
The strictness slider must map into that narrow band, not 0–1 linearly.

## Topic phrasing does not matter (tested, negative result)

Six phrasings scored against the same labels:

| AUC | phrasing |
| :-- | :-- |
| **0.826** | `tech, software, ai` — short noun list |
| 0.799 | `software engineering, programming languages, systems, and hands-on technical work` |
| 0.787 | `software engineering, programming, systems` |
| 0.773 | 3 anchors, averaged: `how a system works under the hood`… |
| 0.708 | `technical writing about software, code, infrastructure and how systems work` |
| 0.695 | 3 anchors, averaged: `software engineering`… |

**Short noun lists beat descriptive sentences.** Verbose phrasing lost 12 points.
Multi-anchor averaging did not help. Rephrasing is not a lever — 0.826 is roughly
the ceiling for this model on this feed.

## → Tooltip copy for topic entry

What to tell the user when they pick topics:

* **Name the subject in a few words.** `tech, software, ai` works better than a
  sentence describing what you want.
* **Don't write a description.** "Technical writing about software and how systems
  work" scores measurably worse than "software, systems".
* **Topics match subject, not quality.** A shallow take and a deep technical post
  about the same subject both match. Lensing cannot filter slop from substance.

That last point is the one users will be surprised by, and it is a hard limit of
the approach — not a tuning problem.

## Known misses

Systems content the model scored near zero despite being on topic:
`"Can a small ZIP file crash my server?"` (-0.019),
`"JavaScript natively supports shared-memory multithreading"` (0.059).
Dominant false positives are AI *opinion* posts, which match `ai` correctly.
