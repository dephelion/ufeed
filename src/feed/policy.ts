import { overrideFor, type Settings } from '../core/settings';
import { verdictAt } from '../ml/scoring';
import { blursAsThinMedia } from './media';

/** What to do with a post. No DOM: applying it is the caller's job. */
export type Action = 'reveal' | 'blur' | 'blur-media' | 'peek';

export interface Judgement {
  settings: Settings;
  text: string;
  /** Undefined means unscored — pending, failed, or nothing to score. */
  score: number | undefined;
  threshold: number;
  hasMedia: boolean;
}

/**
 * The whole blur/reveal decision, in one pure function. Fail-open lives here:
 * an unknown score reveals rather than holding the blur, whatever went wrong
 * upstream.
 */
export function decide({
  settings,
  text,
  score,
  threshold,
  hasMedia,
}: Judgement): Action {
  const override = overrideFor(settings, text);
  if (override === 'keep') return 'reveal';
  if (override === 'blur') return 'blur';
  if (blursAsThinMedia(settings, text, hasMedia)) return 'blur-media';
  if (score === undefined) return 'reveal';
  const verdict = verdictAt(score, threshold);
  if (verdict === 'show') return 'reveal';
  return verdict === 'peek' ? 'peek' : 'blur';
}
