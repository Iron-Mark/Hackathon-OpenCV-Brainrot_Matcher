import { createRequire } from "node:module";

// Lightweight sanity check of costume color families without a browser.
const families = {
  "tralalero-tralala": ["blue"],
  "giraffa-celeste": ["blue", "yellow"],
  "chimpanzini-bananini": ["yellow", "brown"],
  "udin-din-din-dun": ["yellow", "white"],
  "ballerina-cappuccina": ["pink", "white"],
  "frulli-frulla": ["pink", "yellow"],
  "bombardiro-crocodilo": ["green", "gray"],
  "brr-brr-patapim": ["brown", "green"],
  "cappuccino-assassino": ["brown", "black"],
  "ecco-cavallo-virtuoso": ["brown", "black"],
};

const neighbors = {
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
  let best = 0;
  query.forEach((family, qIndex) => {
    const qWeight = qIndex === 0 ? 1 : 0.62;
    const tIndex = target.indexOf(family);
    if (tIndex === 0) best = Math.max(best, qWeight);
    else if (tIndex > 0) best = Math.max(best, 0.6 * qWeight);
    else if (target.some((item) => neighbors[family]?.includes(item))) best = Math.max(best, 0.36 * qWeight);
  });
  return best;
}

function winner(query) {
  return Object.entries(families)
    .map(([id, target]) => ({ id, score: overlap(query, target) }))
    .sort((a, b) => b.score - a.score)[0];
}

const cases = [
  { query: ["blue"], expect: ["tralalero-tralala", "giraffa-celeste"] },
  { query: ["yellow"], expect: ["chimpanzini-bananini", "udin-din-din-dun"] },
  { query: ["pink"], expect: ["ballerina-cappuccina", "frulli-frulla"] },
  { query: ["green"], expect: ["bombardiro-crocodilo"] },
];

let failed = 0;
for (const test of cases) {
  const hit = winner(test.query);
  const ok = test.expect.includes(hit.id);
  console.log(`${ok ? "ok" : "FAIL"} ${test.query} -> ${hit.id} (${hit.score})`);
  if (!ok) failed += 1;
}

const brownOnBlue = overlap(["blue"], families["cappuccino-assassino"]);
const blueOnBlue = overlap(["blue"], families["tralalero-tralala"]);
console.log(`brown vs blue hoodie: ${brownOnBlue} (must be < blue ${blueOnBlue})`);
if (brownOnBlue >= blueOnBlue) failed += 1;

if (failed) {
  process.exit(1);
}
createRequire(import.meta.url);
console.log("look family tests passed");
