/* Which embedding model best separates on-topic from off-topic in a real feed?
   Retrieval models take prefixes; asymmetric matching is the task we have. */
import { pipeline } from '@huggingface/transformers';
import { readFileSync } from 'node:fs';

const { labels } = JSON.parse(readFileSync('labels.json', 'utf8'));
const pos = labels.filter((l) => l.keep).length;
const neg = labels.length - pos;

const MODELS = [
  { id: 'Xenova/all-MiniLM-L6-v2', query: (t) => t, doc: (t) => t },
  { id: 'Xenova/bge-small-en-v1.5',
    query: (t) => `Represent this sentence for searching relevant passages: ${t}`,
    doc: (t) => t },
  { id: 'Xenova/e5-small-v2', query: (t) => `query: ${t}`, doc: (t) => `passage: ${t}` },
];

const TOPICS = ['tech', 'software', 'tech, software, ai'];

const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
const auc = (rows) => {
  const sorted = [...rows].sort((a, b) => a.s - b.s);
  let sum = 0;
  sorted.forEach((r, i) => { if (r.keep) sum += i + 1; });
  return (sum - pos * (pos + 1) / 2) / (pos * neg);
};

console.log(`\n${labels.length} posts, ${pos} on topic\n`);
console.log('model                        topic                 AUC   d-prime   thr@80%recall  kept%');

for (const m of MODELS) {
  let embed;
  try {
    embed = await pipeline('feature-extraction', m.id, { dtype: 'q8' });
  } catch (e) {
    console.log(`${m.id.padEnd(28)} UNAVAILABLE: ${String(e.message).slice(0, 40)}`);
    continue;
  }
  const v = async (t) => (await embed(t, { pooling: 'mean', normalize: true })).tolist();
  const docVecs = await v(labels.map((l) => m.doc(l.text)));

  for (const topic of TOPICS) {
    const [tv] = await v([m.query(topic)]);
    const rows = labels.map((l, i) => ({ keep: l.keep, s: dot(tv, docVecs[i]) }));
    const on = rows.filter((r) => r.keep).map((r) => r.s);
    const off = rows.filter((r) => !r.keep).map((r) => r.s);
    const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const varr = (xs) => { const m2 = mean(xs); return mean(xs.map((x) => (x - m2) ** 2)); };
    // d-prime: separation in units of noise. Threshold usability, not ranking.
    const d = (mean(on) - mean(off)) / Math.sqrt((varr(on) + varr(off)) / 2);
    // Where must the threshold sit to keep 80% of on-topic posts, and how much
    // of the feed survives there?
    const thr = [...on].sort((a, b) => b - a)[Math.floor(on.length * 0.8) - 1];
    const kept = rows.filter((r) => r.s >= thr).length / rows.length;
    console.log(
      m.id.replace('Xenova/', '').padEnd(28),
      topic.padEnd(20),
      auc(rows).toFixed(3).padStart(5),
      d.toFixed(2).padStart(8),
      thr.toFixed(3).padStart(14),
      (kept * 100).toFixed(0).padStart(6) + '%',
    );
  }
}
console.log();
