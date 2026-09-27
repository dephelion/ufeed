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

const BOT = 'github-actions[bot]';

// A stale approval would outlive a later push that lowered confidence.
const dismissApprovals = async (github, pull) => {
  const reviews = await github.paginate(github.rest.pulls.listReviews, pull);
  for (const review of reviews) {
    if (review.user?.login !== BOT || review.state !== 'APPROVED') continue;
    await github.rest.pulls.dismissReview({
      ...pull,
      review_id: review.id,
      message: 'Codex confidence dropped below High.',
    });
  }
};

export default async function postReview({ github, context, core }) {
  const result = JSON.parse(process.env.REVIEW);
  const pull = { ...context.repo, pull_number: context.payload.pull_request.number };
  const event = result.confidence === 'high' ? 'APPROVE' : 'COMMENT';
  if (event === 'COMMENT') await dismissApprovals(github, pull);

  const inline = result.findings.map((finding) => ({
    path: finding.path,
    line: finding.line,
    side: 'RIGHT',
    body: comment(finding),
  }));
  // A line outside the diff rejects inline comments; a repo that bars Actions from approving rejects APPROVE.
  const events = event === 'APPROVE' ? ['APPROVE', 'COMMENT'] : ['COMMENT'];
  const attempts = events.flatMap((each) => [
    { event: each, body: summary(result, true), comments: inline },
    { event: each, body: summary(result, false) },
  ]);

  for (const [index, attempt] of attempts.entries()) {
    try {
      await github.rest.pulls.createReview({
        ...pull,
        commit_id: context.payload.pull_request.head.sha,
        ...attempt,
      });
      return;
    } catch (error) {
      if (index === attempts.length - 1) throw error;
      core.warning(`Review attempt ${index + 1} failed: ${error.message}`);
    }
  }
}
