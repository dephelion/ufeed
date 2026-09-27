const levels = { high: '🟢 High', medium: '🟡 Medium', low: '🔴 Low' };
const icons = { critical: '🔴', major: '🟠', minor: '🟡' };

const comment = (finding) =>
  `${icons[finding.severity]} **${finding.title}**\n\n${finding.body}`;

const summary = ({ findings, confidence, justification }, inline) => {
  const lines = ['## Codex review', ''];
  if (findings.length === 0) lines.push('No findings.', '');
  else if (!inline) {
    lines.push(
      ...findings.map(
        (finding) =>
          `- \`${finding.path}:${finding.line}\` ${comment(finding).replace(/\n\n/g, ' — ')}`,
      ),
      '',
    );
  }
  lines.push('### Confidence', '', levels[confidence], '', justification);
  return lines.join('\n');
};

export default async function postReview({ github, context, core }) {
  const result = JSON.parse(process.env.REVIEW);
  const review = {
    ...context.repo,
    pull_number: context.payload.pull_request.number,
    commit_id: context.payload.pull_request.head.sha,
    event: 'COMMENT',
  };
  try {
    await github.rest.pulls.createReview({
      ...review,
      body: summary(result, true),
      comments: result.findings.map((finding) => ({
        path: finding.path,
        line: finding.line,
        side: 'RIGHT',
        body: comment(finding),
      })),
    });
  } catch (error) {
    // A line outside the diff rejects the whole review; keep the findings in the summary.
    core.warning(`Inline review failed: ${error.message}`);
    await github.rest.pulls.createReview({ ...review, body: summary(result, false) });
  }
}
