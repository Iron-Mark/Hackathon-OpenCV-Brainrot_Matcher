import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const expectedPath = join(root, "fixtures", "expected.json");

const FAMILIES = {
  "tralalero-tralala": ["blue"],
  "tung-tung-tung-sahur": ["brown", "black"],
  "bombardiro-crocodilo": ["green", "gray"],
  "bombombini-gusini": ["white", "gray"],
  "brr-brr-patapim": ["brown", "green"],
  "lirili-larila": ["green", "brown"],
  "cappuccino-assassino": ["brown", "black"],
  "ballerina-cappuccina": ["pink", "white"],
  "chimpanzini-bananini": ["yellow", "brown"],
  "boneca-ambalabu": ["green", "black"],
  "trippi-troppi": ["orange", "pink"],
  "frigo-camelo": ["white", "brown"],
  "giraffa-celeste": ["blue", "yellow"],
  "udin-din-din-dun": ["yellow", "white"],
  "ecco-cavallo-virtuoso": ["brown", "black"],
  "frulli-frulla": ["pink", "yellow"],
  "merluzzini-marraquetini": ["green", "gray"],
};

const SAT = {
  "tralalero-tralala": 0.72,
  "tung-tung-tung-sahur": 0.38,
  "bombardiro-crocodilo": 0.45,
  "bombombini-gusini": 0.35,
  "brr-brr-patapim": 0.42,
  "lirili-larila": 0.48,
  "cappuccino-assassino": 0.4,
  "ballerina-cappuccina": 0.38,
  "chimpanzini-bananini": 0.7,
  "boneca-ambalabu": 0.42,
  "trippi-troppi": 0.62,
  "frigo-camelo": 0.22,
  "giraffa-celeste": 0.55,
  "udin-din-din-dun": 0.5,
  "ecco-cavallo-virtuoso": 0.35,
  "frulli-frulla": 0.4,
  "merluzzini-marraquetini": 0.48,
};

const NEIGHBORS = {
  blue: ["gray", "white"],
  green: ["yellow", "gray"],
  yellow: ["orange", "white"],
  pink: ["red", "orange", "white"],
  orange: ["yellow", "red", "pink"],
  brown: ["orange", "black", "yellow"],
  white: ["gray", "yellow", "pink"],
  black: ["gray", "brown"],
  gray: ["white", "black", "blue"],
  red: ["pink", "orange"],
};

function overlap(query, target) {
  if (!query.length || !target.length) return 0.2;
  let best = 0;
  query.forEach((family, qIndex) => {
    const qWeight = qIndex === 0 ? 1 : 0.62;
    const tIndex = target.indexOf(family);
    if (tIndex === 0) best = Math.max(best, qWeight);
    else if (tIndex > 0) best = Math.max(best, 0.6 * qWeight);
    else if (target.some((item) => NEIGHBORS[family]?.includes(item))) best = Math.max(best, 0.36 * qWeight);
  });
  return best;
}

function softmax(values, temperature = 0.16) {
  const max = Math.max(...values);
  const exps = values.map((v) => Math.exp((v - max) / Math.max(0.04, temperature)));
  const sum = exps.reduce((a, b) => a + b, 0) || 1;
  return exps.map((v) => v / sum);
}

function toPercent(prob, raw, best, second, isWinner) {
  const abs = Math.max(0, Math.min(1, (raw - 0.16) / 0.82));
  const gap = best - second;
  let pct = 100 * (0.42 * abs + 0.58 * prob);
  if (isWinner) pct = Math.min(94, pct + 5 * Math.min(1, gap / 0.12) * abs);
  return Math.max(0, Math.min(94, Math.round(pct)));
}

function scorePerson(query, energy = 0.45) {
  const rows = Object.entries(FAMILIES).map(([id, families]) => {
    const clothes = overlap(query, families);
    const energyHit = 1 - Math.min(1, Math.abs(energy - (SAT[id] ?? 0.4)));
    const dominant = query[0];
    const mismatch =
      dominant && !families.includes(dominant) && !["brown", "gray", "black"].includes(dominant) ? 0.22 : 0;
    const raw = Math.max(0.04, Math.min(0.98, 0.7 * clothes + 0.15 * clothes + 0.1 * energyHit + 0.05 * 0.2 - mismatch));
    return { id, raw };
  });
  rows.sort((a, b) => b.raw - a.raw);
  const probs = softmax(rows.map((row) => row.raw));
  const best = rows[0].raw;
  const second = rows[1].raw;
  return rows.map((row, i) => ({
    ...row,
    percent: toPercent(probs[i], row.raw, best, second, i === 0),
    gap: i === 0 ? best - second : 0,
  }));
}

function colorFamily(h, s, v) {
  if (v < 0.08) return "black";
  if (s < 0.11) {
    if (v > 0.8) return "white";
    if (v < 0.26) return "black";
    return "gray";
  }
  const deg = h * 360;
  if (deg >= 185 && deg <= 255) return "blue";
  if (deg >= 70 && deg <= 170) return "green";
  if (deg >= 42 && deg <= 68) return "yellow";
  if (deg >= 300 && deg <= 345) return "pink";
  if (deg > 255 && deg < 300) return "pink";
  if (deg >= 12 && deg < 42 && s >= 0.58 && v > 0.48) return "orange";
  if (deg <= 40 || deg >= 345) return v < 0.82 && (s < 0.62 || v < 0.5) ? "brown" : "red";
  return null;
}

function rgbToHsv(r, g, b) {
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const d = max - min;
  let h = 0;
  if (d) {
    if (max === rr) h = ((gg - bb) / d) % 6;
    else if (max === gg) h = (bb - rr) / d + 2;
    else h = (rr - gg) / d + 4;
    h /= 6;
    if (h < 0) h += 1;
  }
  return [h, max === 0 ? 0 : d / max, max];
}

function familiesFromRgb(swatches) {
  const counts = {};
  for (const [r, g, b, w = 1] of swatches) {
    const [h, s, v] = rgbToHsv(r, g, b);
    const family = colorFamily(h, s, v);
    if (family) counts[family] = (counts[family] ?? 0) + w;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([family]) => family);
}

const SYNTHETIC = [
  { name: "yellow-shirt", swatches: [[240, 210, 40, 3], [70, 48, 30, 1]], expect: ["chimpanzini-bananini", "udin-din-din-dun"] },
  { name: "blue-hoodie", swatches: [[40, 110, 220, 3], [180, 190, 200, 1]], expect: ["tralalero-tralala", "giraffa-celeste"] },
  { name: "pink-tutu", swatches: [[240, 150, 190, 3], [250, 240, 230, 1]], expect: ["ballerina-cappuccina", "frulli-frulla"] },
  { name: "olive-jacket", swatches: [[90, 120, 70, 3], [90, 95, 90, 1]], expect: ["bombardiro-crocodilo", "boneca-ambalabu", "lirili-larila"] },
  { name: "coffee-brown", swatches: [[82, 56, 38, 3], [28, 22, 18, 1]], energy: 0.4, expect: ["cappuccino-assassino", "ecco-cavallo-virtuoso", "tung-tung-tung-sahur", "brr-brr-patapim"] },
  { name: "street-gray", swatches: [[120, 122, 125, 3], [90, 92, 94, 1]], expectWeak: true },
];

const extra = existsSync(expectedPath) ? JSON.parse(readFileSync(expectedPath, "utf8")) : { cases: [] };

let failed = 0;
let peopleHits = 0;
let peopleN = 0;
let mrr = 0;
const baseline = [];

console.log("== person color-family fixtures ==");
for (const test of [...SYNTHETIC, ...(extra.cases ?? [])]) {
  const query = test.query ?? familiesFromRgb(test.swatches);
  const ranked = scorePerson(query, test.energy ?? 0.5);
  const top = ranked[0];
  const rank = test.expect ? ranked.findIndex((row) => test.expect.includes(row.id)) + 1 : 0;
  if (test.expectWeak) {
    const ok = top.percent <= 55;
    console.log(`${ok ? "ok" : "FAIL"} ${test.name} weak-calibrate ${top.id} ${top.percent}% (need <=55)`);
    if (!ok) failed += 1;
    continue;
  }
  peopleN += 1;
  const ok = test.expect.includes(top.id);
  if (ok) peopleHits += 1;
  if (rank > 0) mrr += 1 / rank;
  console.log(`${ok ? "ok" : "FAIL"} ${test.name} ${query.join("/")} -> ${top.id} ${top.percent}% gap=${top.gap.toFixed(3)}`);
  if (!ok) failed += 1;
  baseline.push({ name: test.name, top: top.id, percent: top.percent, gap: Number(top.gap.toFixed(3)) });
}

const top1 = peopleN ? peopleHits / peopleN : 0;
const meanR = peopleN ? mrr / peopleN : 0;
console.log(`people top-1 ${peopleHits}/${peopleN} (${(top1 * 100).toFixed(0)}%)  MRR ${meanR.toFixed(3)}`);

if (failed) {
  console.error(`eval-match failed: ${failed}`);
  process.exit(1);
}

console.log("eval-match passed");
console.log("baseline", JSON.stringify(baseline));
