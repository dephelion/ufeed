/* Sweep topic phrasings against existing labels. No re-labeling. */
import { pipeline } from '@huggingface/transformers';
import { readFileSync } from 'node:fs';

const { topic: original, labels } = JSON.parse(readFileSync('labels.json','utf8'));
const pos = labels.filter(l=>l.keep).length, neg = labels.length-pos;

const CANDIDATES = [
  original,
  'software engineering, programming, systems',
  'software engineering, programming languages, systems, and hands-on technical work',
  'technical writing about software, code, infrastructure and how systems work',
  ['software engineering','programming languages and code','systems, infrastructure, performance'],
  ['how a system works under the hood','a technical explanation with code or architecture','engineering tradeoffs and implementation detail'],
];

const embed = await pipeline('feature-extraction','Xenova/all-MiniLM-L6-v2',{dtype:'q8'});
const vec = async t => (await embed(t,{pooling:'mean',normalize:true})).tolist();
const dot = (a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const norm = v => { const m=Math.hypot(...v); return v.map(x=>x/m); };

const postVecs = await vec(labels.map(l=>l.text));

const auc = scored => {
  const r=[...scored].sort((a,b)=>a.s-b.s); let sum=0;
  r.forEach((x,i)=>{ if(x.keep) sum+=i+1; });
  return (sum - pos*(pos+1)/2)/(pos*neg);
};

console.log(`\n${labels.length} posts, ${pos} on topic (${(pos/labels.length*100).toFixed(0)}%)\n`);
console.log('  AUC   bestF1  @thr   recall@50%prec   phrasing');

for (const c of CANDIDATES) {
  const vs = await vec(Array.isArray(c) ? c : [c]);
  const tv = Array.isArray(c)
    ? norm(vs[0].map((_,i)=>vs.reduce((s,v)=>s+v[i],0)/vs.length))   // mean of anchors
    : vs[0];
  const scored = labels.map((l,i)=>({keep:l.keep, s:dot(tv,postVecs[i])}));

  let bF1=-1,bT=0,rAt50=0;
  for (let t=-0.05;t<=0.6;t+=0.005){
    const kept=scored.filter(x=>x.s>=t), tp=kept.filter(x=>x.keep).length;
    if(!kept.length) continue;
    const p=tp/kept.length, r=tp/pos, f=p+r?2*p*r/(p+r):0;
    if(f>bF1){bF1=f;bT=t;}
    if(p>=0.5) rAt50=Math.max(rAt50,r);
  }
  const tag = Array.isArray(c) ? `[${c.length} anchors] ${c[0]}…` : c;
  console.log(`  ${auc(scored).toFixed(3)}  ${bF1.toFixed(3)}  ${bT.toFixed(2)}   ${rAt50.toFixed(3)}`
    + `            ${tag.slice(0,60)}`);
}
console.log();
