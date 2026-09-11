/* Lensing — spike 12.2 scorer
 * Answers: does cosine similarity against a free-text topic string separate
 * on-topic from off-topic posts in a real timeline?
 *
 *   npm install && node score.mjs [labels.json] [--dtype q8|fp32]
 */
import { pipeline } from '@huggingface/transformers';
import { readFileSync } from 'node:fs';

const args  = process.argv.slice(2);
const file  = args.find(a => !a.startsWith('--')) ?? 'labels.json';
const dtype = (args.find(a => a.startsWith('--dtype='))?.split('=')[1]) ?? 'q8';

const { topic, labels } = JSON.parse(readFileSync(file, 'utf8'));
const pos = labels.filter(l => l.keep).length;
if (!labels.length) { console.error('no labels in ' + file); process.exit(1); }

console.log(`\ntopic   "${topic}"`);
console.log(`posts   ${labels.length}  (${pos} on topic, ${labels.length - pos} off)`);
console.log(`model   Xenova/all-MiniLM-L6-v2  [${dtype}]\n`);

const embed = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { dtype });
const vec = async t => (await embed(t, { pooling: 'mean', normalize: true })).tolist();

const t0 = Date.now();
const [topicVec] = await vec(topic);
const postVecs   = await vec(labels.map(l => l.text));
const ms = Date.now() - t0;

const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
const scored = labels.map((l, i) => ({ ...l, score: dot(topicVec, postVecs[i]) }));

/* --- headline: AUC (rank-based). 0.5 = coin flip, 0.8 = usable, 0.9 = strong --- */
const ranked = [...scored].sort((a, b) => a.score - b.score);
let rankSum = 0;
ranked.forEach((r, i) => { if (r.keep) rankSum += i + 1; });
const neg = labels.length - pos;
const auc = (rankSum - pos * (pos + 1) / 2) / (pos * neg);

const mean = xs => xs.reduce((a, b) => a + b, 0) / xs.length;
const on  = scored.filter(s => s.keep).map(s => s.score);
const off = scored.filter(s => !s.keep).map(s => s.score);

console.log(`AUC ${auc.toFixed(3)}   ${auc < .65 ? '← PREMISE FAILS: barely better than chance'
  : auc < .80 ? '← weak; needs better topic phrasing or a stronger model'
  : auc < .90 ? '← usable' : '← strong'}`);
console.log(`mean score  on-topic ${mean(on).toFixed(3)}   off-topic ${mean(off).toFixed(3)}`
  + `   gap ${(mean(on) - mean(off)).toFixed(3)}`);
console.log(`embedding   ${(ms / labels.length).toFixed(1)} ms/post  (${ms} ms total, node cpu)\n`);

/* --- threshold sweep --- */
console.log('thresh   prec   recall     F1   kept%');
let best = { f1: -1 };
for (let t = 0; t <= 0.6001; t += 0.02) {
  const kept = scored.filter(s => s.score >= t);
  const tp   = kept.filter(s => s.keep).length;
  const prec = kept.length ? tp / kept.length : 1;
  const rec  = tp / pos;
  const f1   = prec + rec ? 2 * prec * rec / (prec + rec) : 0;
  if (f1 > best.f1) best = { f1, t, prec, rec };
  console.log(`  ${t.toFixed(2)}  ${prec.toFixed(3)}  ${rec.toFixed(3)}  ${f1.toFixed(3)}`
    + `   ${(kept.length / labels.length * 100).toFixed(0)}%`);
}
console.log(`\nbest F1 ${best.f1.toFixed(3)} at threshold ${best.t.toFixed(2)}`
  + `  (precision ${best.prec.toFixed(3)}, recall ${best.rec.toFixed(3)})`);
console.log('→ this threshold is the §12.3 default strictness candidate.\n');

/* --- worst errors: where the model disagrees with you most --- */
const show = (title, rows) => {
  console.log(title);
  rows.forEach(r => console.log(`  ${r.score.toFixed(3)}  ${r.text.slice(0, 88).replace(/\n/g, ' ')}`));
  console.log();
};
show('off-topic posts the model scored HIGHEST (false positives):',
  scored.filter(s => !s.keep).sort((a, b) => b.score - a.score).slice(0, 5));
show('on-topic posts the model scored LOWEST (false negatives):',
  scored.filter(s => s.keep).sort((a, b) => a.score - b.score).slice(0, 5));
