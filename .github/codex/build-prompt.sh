#!/usr/bin/env bash
set -euo pipefail

{
  cat .github/codex/review.md
  printf '\n## Pull request #%s\n\n' "$PR_NUMBER"
  printf 'Diff: `git diff %s...%s`\n\n' "$BASE_SHA" "$HEAD_SHA"
  printf 'Title: %s\n\nBody:\n\n%s\n' "$PR_TITLE" "$PR_BODY"
} > "$RUNNER_TEMP/codex-prompt.md"
