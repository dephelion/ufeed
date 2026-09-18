const ATTRS = [
  'lxScore',
  'lxNeeds',
  'lxChars',
  'lxPass',
  'lxTopics',
  'lxLines',
  'lxRated',
] as const;

export interface Badge {
  score: number | undefined;
  needs: number;
  chars: number;
  /** Similarity to every line, by 1-based position, never text: the host page can read this. */
  lines: readonly number[] | undefined;
  /** A near-identical rated post decided it: true marked on topic, false off. */
  rating: boolean | undefined;
}

export function stampScore(container: HTMLElement, badge: Badge): void {
  const { score, needs, chars, lines, rating } = badge;
  const data = container.dataset;
  data.lxScore = score === undefined ? 'none' : score.toFixed(3);
  data.lxNeeds = needs.toFixed(3);
  data.lxChars = String(chars);
  data.lxPass = String(rating ?? (score !== undefined && score >= needs));
  if (lines === undefined || lines.length === 0) {
    delete data.lxTopics;
    delete data.lxLines;
  } else {
    data.lxTopics = lines.length === 1 ? '1 topic' : `${lines.length} topics`;
    data.lxLines = lines.map((s, i) => `#${i + 1} ${s.toFixed(3)}`).join(' · ');
  }
  if (rating === undefined) delete data.lxRated;
  else data.lxRated = rating ? 'on' : 'off';
}

export function clearScore(container: HTMLElement): void {
  for (const attr of ATTRS) delete container.dataset[attr];
}

export function clearAllScores(root: ParentNode = document): void {
  for (const el of root.querySelectorAll<HTMLElement>('[data-lx-score]')) clearScore(el);
}
