const ATTRS = ['lxScore', 'lxNeeds', 'lxChars', 'lxPass', 'lxTopic'] as const;

/** `topic` is the line's 1-based position, never its text: the host page can read this. */
export function stampScore(
  container: HTMLElement,
  score: number | undefined,
  needs: number,
  chars: number,
  topic: number | undefined,
): void {
  container.dataset.lxScore = score === undefined ? 'none' : score.toFixed(3);
  container.dataset.lxNeeds = needs.toFixed(3);
  container.dataset.lxChars = String(chars);
  container.dataset.lxPass = String(score !== undefined && score >= needs);
  if (topic === undefined) delete container.dataset.lxTopic;
  else container.dataset.lxTopic = String(topic);
}

export function clearScore(container: HTMLElement): void {
  for (const attr of ATTRS) delete container.dataset[attr];
}

export function clearAllScores(root: ParentNode = document): void {
  for (const el of root.querySelectorAll<HTMLElement>('[data-lx-score]')) clearScore(el);
}
