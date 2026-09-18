const ATTRS = ['lxScore', 'lxNeeds', 'lxChars', 'lxPass', 'lxTopic', 'lxRated'] as const;

export interface Badge {
  score: number | undefined;
  needs: number;
  chars: number;
  /** The line's 1-based position, never its text: the host page can read this. */
  topic: number | undefined;
  /** A near-identical rated post decided it: true marked on topic, false off. */
  rating: boolean | undefined;
}

export function stampScore(container: HTMLElement, badge: Badge): void {
  const { score, needs, chars, topic, rating } = badge;
  const data = container.dataset;
  data.lxScore = score === undefined ? 'none' : score.toFixed(3);
  data.lxNeeds = needs.toFixed(3);
  data.lxChars = String(chars);
  data.lxPass = String(rating ?? (score !== undefined && score >= needs));
  if (topic === undefined) delete data.lxTopic;
  else data.lxTopic = String(topic);
  if (rating === undefined) delete data.lxRated;
  else data.lxRated = rating ? 'on' : 'off';
}

export function clearScore(container: HTMLElement): void {
  for (const attr of ATTRS) delete container.dataset[attr];
}

export function clearAllScores(root: ParentNode = document): void {
  for (const el of root.querySelectorAll<HTMLElement>('[data-lx-score]')) clearScore(el);
}
