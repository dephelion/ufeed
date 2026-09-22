const ATTRS = [
  'lxScore',
  'lxNeeds',
  'lxChars',
  'lxPass',
  'lxLines',
  'lxRated',
  'lxBlock',
] as const;

export interface Badge {
  score: number | undefined;
  needs: number;
  chars: number;
  /** Similarity to every line, by 1-based position, never text: the host page can read this. */
  lines: readonly number[] | undefined;
  /** Highest similarity to a blacklist line; -1 or undefined when there is none. */
  block?: number | undefined;
  /** A near-identical rated post decided it: true marked on topic, false off. */
  rating: boolean | undefined;
}

export function stampScore(container: HTMLElement, badge: Badge): void {
  const { score, needs, chars, lines, block, rating } = badge;
  const data = container.dataset;
  data.lxScore = score === undefined ? 'none' : score.toFixed(3);
  data.lxNeeds = needs.toFixed(3);
  data.lxChars = String(chars);
  const blocked = score !== undefined && block !== undefined && block > score;
  data.lxPass = String(!blocked && (rating ?? (score !== undefined && score >= needs)));
  if (lines === undefined || lines.length === 0) delete data.lxLines;
  else data.lxLines = lines.map((s, i) => `#${i + 1} ${s.toFixed(3)}`).join(' · ');
  if (block === undefined || block < 0) delete data.lxBlock;
  else data.lxBlock = block.toFixed(3);
  if (rating === undefined) delete data.lxRated;
  else data.lxRated = rating ? 'on' : 'off';
}

export function clearScore(container: HTMLElement): void {
  for (const attr of ATTRS) delete container.dataset[attr];
}

export function clearAllScores(root: ParentNode = document): void {
  for (const el of root.querySelectorAll<HTMLElement>('[data-lx-score]')) clearScore(el);
}
