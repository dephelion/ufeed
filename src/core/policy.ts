import type { Settings } from './settings';
import { modelFor } from './models';
import { verdictAt } from './scoring';
import { blursAsOtherLanguage, type Language } from './language';
import { blursAsThinMedia } from './media';

/** What to do with a post. No DOM: applying it is the caller's job. */
export type Action =
  'reveal' | 'blur' | 'blur-media' | 'blur-language' | 'blur-blacklist' | 'peek';

/** Everything the tiers that need no score can read. */
export interface Grounds {
  settings: Settings;
  text: string;
  hasMedia: boolean;
  /** Undefined means undetected — not run, not available, or not yet back. */
  language: Language | undefined;
}

export interface Judgement extends Grounds {
  /** Undefined means unscored — pending, failed, or nothing to score. */
  score: number | undefined;
  threshold: number;
  /** A near-identical rated post: true liked, false disliked. Overrides the score. */
  rating?: boolean | undefined;
  /** Highest similarity to a blacklist line; -1 or undefined when there is none. */
  block?: number | undefined;
}

/** Closer to a blacklist line than to any topic. Overrides the score and any rating. */
export function isBlacklisted({ score, block }: Judgement): boolean {
  return score !== undefined && block !== undefined && block > score;
}

/**
 * The tiers that settle a post without the engine. Split out so the caller can
 * ask before it spends an inference, and so a post it claims is never revealed
 * first and blurred a moment later.
 */
export function decideWithoutScore(grounds: Grounds): Action | undefined {
  const { settings, text, hasMedia, language } = grounds;
  if (blursAsThinMedia(settings, text, hasMedia, language)) return 'blur-media';
  if (blursAsOtherLanguage(settings, language)) return 'blur-language';
  return undefined;
}

/**
 * The whole blur/reveal decision, in one pure function. Fail-open lives here:
 * an unknown score reveals rather than holding the blur, whatever went wrong
 * upstream.
 */
export function decide(judgement: Judgement): Action {
  const settled = decideWithoutScore(judgement);
  if (settled !== undefined) return settled;
  const { score, threshold, rating } = judgement;
  if (isBlacklisted(judgement)) return 'blur-blacklist';
  if (rating !== undefined) return rating ? 'reveal' : 'blur';
  if (score === undefined) return 'reveal';
  const verdict = verdictAt(score, threshold, modelFor(judgement.settings.model));
  if (verdict === 'show') return 'reveal';
  return verdict === 'peek' ? 'peek' : 'blur';
}
