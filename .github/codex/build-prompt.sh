#!/usr/bin/env bash
set -euo pipefail

# Earlier Codex threads on this PR, so a finding the author already resolved or
# declined is not raised again. Replies count only from people with write access:
# anyone can comment on a public PR.
threads() {
  gh api graphql \
    -F owner="${GITHUB_REPOSITORY%/*}" -F name="${GITHUB_REPOSITORY#*/}" -F number="$PR_NUMBER" \
    -f query='query($owner: String!, $name: String!, $number: Int!) {
      repository(owner: $owner, name: $name) { pullRequest(number: $number) {
        reviewThreads(first: 100) { nodes { isResolved path
          comments(first: 20) { nodes { author { login } authorAssociation body } } } } } } }' \
    --jq '.data.repository.pullRequest.reviewThreads.nodes[]
      | select(.comments.nodes[0].author.login == "github-actions")
      | "### `\(.path)` (\(if .isResolved then "resolved" else "open" end))\n\n"
        + ([.comments.nodes[]
            | select(.author.login == "github-actions"
                or (.authorAssociation | IN("OWNER", "MEMBER", "COLLABORATOR")))
            | "- **\(.author.login)**: \(.body | gsub("\n+"; " "))"] | join("\n"))
        + "\n"'
}

{
  cat .github/codex/review.md
  printf '\n## Pull request #%s\n\n' "$PR_NUMBER"
  printf 'Diff: `git diff %s...%s`\n\n' "$BASE_SHA" "$HEAD_SHA"
  printf 'Title: %s\n\nBody:\n\n%s\n' "$PR_TITLE" "$PR_BODY"
  printf '\n## Earlier review threads\n\n'
  # A failed lookup must not block the review; it only loses the memory.
  threads || printf 'Unavailable.\n'
} > "$RUNNER_TEMP/codex-prompt.md"
