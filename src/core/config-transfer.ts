import { MODEL } from './models';
import {
  capped,
  forTopics,
  normalizeFeedback,
  type Feedback,
  type Rating,
} from './feedback';
import { withDefaults, type Settings } from './settings';

/**
 * A backup file: settings as plain JSON a reader can audit, correction vectors
 * as base64. Pure — the file handling lives in the popup.
 */
export const SCHEMA = 1;

export interface Backup {
  schema: number;
  app: string;
  exportedAt: string;
  model: { id: string; dim: number };
  settings: Settings;
  feedback: Record<string, { key: string; liked: boolean; vector: string }[]>;
}

export type ImportResult =
  { ok: true; settings: Settings; feedback: Feedback } | { ok: false; reason: string };

export function exportConfig(
  settings: Settings,
  feedback: Feedback,
  app: string,
  now = new Date(),
): string {
  const byTopic: Backup['feedback'] = {};
  for (const [topic, ratings] of Object.entries(feedback.byTopic)) {
    byTopic[topic] = ratings.map((r) => ({
      key: r.key,
      liked: r.liked,
      vector: encodeVector(r.vector),
    }));
  }
  const backup: Backup = {
    schema: SCHEMA,
    app,
    exportedAt: now.toISOString(),
    model: { id: MODEL.id, dim: MODEL.dim },
    settings,
    feedback: byTopic,
  };
  return JSON.stringify(backup, null, 2);
}

export function importConfig(text: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'not a FeedLens backup' };
  }
  if (!isRecord(parsed) || !isRecord(parsed['settings'])) {
    return { ok: false, reason: 'not a FeedLens backup' };
  }
  const schema = parsed['schema'];
  if (typeof schema !== 'number' || !Number.isInteger(schema) || schema < 1) {
    return { ok: false, reason: 'not a FeedLens backup' };
  }
  if (schema > SCHEMA) return { ok: false, reason: 'made by a newer version' };

  const model = parsed['model'];
  const id = isRecord(model) ? model['id'] : undefined;
  const dim = isRecord(model) ? model['dim'] : undefined;
  if (id !== MODEL.id || dim !== MODEL.dim) {
    return { ok: false, reason: 'made with a different model' };
  }

  const settings = withDefaults(parsed['settings'] as Partial<Settings>);
  const byTopic: Record<string, Rating[]> = {};
  const stored = parsed['feedback'];
  if (isRecord(stored)) {
    for (const [topic, list] of Object.entries(stored)) {
      if (!Array.isArray(list)) continue;
      const ratings = list.flatMap(decodeRating);
      if (ratings.length > 0) byTopic[topic] = capped(ratings);
    }
  }
  const feedback = normalizeFeedback({ model: MODEL.id, dim: MODEL.dim, byTopic });
  return { ok: true, settings, feedback: forTopics(feedback, settings.topics) };
}

/** Little-endian, written by hand: a Float32Array view inherits host byte order. */
function encodeVector(vector: readonly number[]): string {
  const bytes = new Uint8Array(vector.length * 4);
  const view = new DataView(bytes.buffer);
  vector.forEach((value, i) => view.setFloat32(i * 4, value, true));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decodeVector(encoded: string): number[] | undefined {
  let binary: string;
  try {
    binary = atob(encoded);
  } catch {
    return undefined;
  }
  if (binary.length !== MODEL.dim * 4) return undefined;
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  const view = new DataView(bytes.buffer);
  return Array.from({ length: MODEL.dim }, (_, i) => view.getFloat32(i * 4, true));
}

function decodeRating(value: unknown): Rating[] {
  if (!isRecord(value)) return [];
  const { key, liked, vector } = value;
  if (typeof key !== 'string' || typeof liked !== 'boolean') return [];
  if (typeof vector !== 'string') return [];
  const decoded = decodeVector(vector);
  return decoded ? [{ key, liked, vector: decoded }] : [];
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}
