# Security

FeedLens reads every post on the X, LinkedIn and Reddit pages you open, and its
promise is that none of it leaves your device. A bug that breaks that promise is
a security bug, even when nothing crashes.

## Reporting

Report privately, not in a public issue:

- **GitHub:** the repository's **Security** tab, then **Report a vulnerability**.
- **Email:** contact@dephelion.com

Include the browser, the FeedLens version and the steps to reproduce.

## In scope

- Post text, your topics or your ratings reaching the network, a log, or any
  storage beyond the two documented `storage.local` keys
  ([`wiki-llm/privacy.md`](wiki-llm/privacy.md)).
- A web page reading from, or steering, the engine: the hidden iframe, its
  worker and the message port between them.
- FeedLens breaking the page it runs on, or leaving the feed blurred after an
  error.
- The supply chain: the bundled ONNX runtime and the model download.

## Out of scope

A post blurred or shown wrongly is a normal bug. Please use the bug report
template for it.
