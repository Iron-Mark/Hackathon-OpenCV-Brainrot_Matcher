import { BRAINROT_CHARACTERS } from "./characters";

export type ColorFamily =
  | "blue"
  | "green"
  | "yellow"
  | "pink"
  | "orange"
  | "brown"
  | "white"
  | "black"
  | "gray"
  | "red";

export type CharacterLook = {
  hues: number[];
  families: ColorFamily[];
  hair: ColorFamily[];
  sat: number;
  tags: string[];
  vibe: string;
};

/** Costume colors and vibe used when the query is a person, not a character still. */
export const CHARACTER_LOOKS: Record<string, CharacterLook> = {
  "tralalero-tralala": {
    hues: [210, 48],
    families: ["blue"],
    hair: ["gray", "blue"],
    sat: 0.72,
    tags: ["blue", "sporty", "chaotic", "loud"],
    vibe: "electric blue shark, sneakers, loud sporty energy",
  },
  "tung-tung-tung-sahur": {
    hues: [28, 20],
    families: ["brown", "black"],
    hair: ["brown"],
    sat: 0.38,
    tags: ["brown", "wooden", "dark", "serious"],
    vibe: "wood brown bat, night patrol, heavy and serious",
  },
  "bombardiro-crocodilo": {
    hues: [118, 85],
    families: ["green", "gray"],
    hair: ["green"],
    sat: 0.45,
    tags: ["green", "aerial", "chaotic", "dark"],
    vibe: "olive green crocodile, aircraft gray, aerial chaos",
  },
  "bombombini-gusini": {
    hues: [200, 50],
    families: ["white", "gray"],
    hair: ["white"],
    sat: 0.35,
    tags: ["white", "aerial", "loud"],
    vibe: "white-gray goose, jet wings, noisy cousin energy",
  },
  "brr-brr-patapim": {
    hues: [32, 115],
    families: ["brown", "green"],
    hair: ["brown"],
    sat: 0.42,
    tags: ["brown", "green", "forest", "soft"],
    vibe: "forest brown-green elder, earthy and poetic",
  },
  "lirili-larila": {
    hues: [112, 42],
    families: ["green", "brown"],
    hair: ["green"],
    sat: 0.48,
    tags: ["green", "tall", "desert"],
    vibe: "cactus green, tan sandals, tall desert walker",
  },
  "cappuccino-assassino": {
    hues: [24, 8],
    families: ["brown", "black"],
    hair: ["brown"],
    sat: 0.4,
    tags: ["brown", "black", "food", "dramatic"],
    vibe: "coffee brown, black blades, cafe ninja",
  },
  "ballerina-cappuccina": {
    hues: [328, 28],
    families: ["pink", "white"],
    hair: ["brown", "pink"],
    sat: 0.38,
    tags: ["pink", "beige", "cute", "soft"],
    vibe: "ballet pink, cream tutu, soft and pretty",
  },
  "chimpanzini-bananini": {
    hues: [50, 30],
    families: ["yellow", "brown"],
    hair: ["brown"],
    sat: 0.7,
    tags: ["yellow", "brown", "chaotic", "loud"],
    vibe: "banana yellow, chimp brown, indestructible chaos",
  },
  "boneca-ambalabu": {
    hues: [128, 0],
    families: ["green", "black"],
    hair: ["green"],
    sat: 0.42,
    tags: ["green", "black", "round"],
    vibe: "frog green, tire black, beach underdog",
  },
  "trippi-troppi": {
    hues: [18, 348],
    families: ["orange", "pink"],
    hair: ["orange"],
    sat: 0.62,
    tags: ["orange", "pink", "chaotic", "cute"],
    vibe: "shrimp orange-pink, sea gremlin, twitchy cute",
  },
  "frigo-camelo": {
    hues: [38, 205],
    families: ["white", "brown"],
    hair: ["brown", "white"],
    sat: 0.22,
    tags: ["white", "tan", "tall", "soft"],
    vibe: "fridge white, camel tan, cold and calm",
  },
  "giraffa-celeste": {
    hues: [198, 48],
    families: ["blue", "yellow"],
    hair: ["blue"],
    sat: 0.55,
    tags: ["blue", "yellow", "tall", "soft"],
    vibe: "sky blue giraffe, yellow spots, tall pastel paladin",
  },
  "udin-din-din-dun": {
    hues: [44, 200],
    families: ["yellow", "white"],
    hair: ["yellow"],
    sat: 0.5,
    tags: ["yellow", "round", "chaotic"],
    vibe: "round yellow mascot, nursery-rhyme, warm and bouncy",
  },
  "ecco-cavallo-virtuoso": {
    hues: [30, 275],
    families: ["brown", "black"],
    hair: ["brown"],
    sat: 0.35,
    tags: ["brown", "dramatic", "tall"],
    vibe: "horse brown, opera drama, virtuoso pose",
  },
  "frulli-frulla": {
    hues: [322, 52],
    families: ["pink", "yellow"],
    hair: ["pink"],
    sat: 0.4,
    tags: ["pink", "yellow", "soft", "cute"],
    vibe: "soft pastels, fluffy, gentle mid-wave mascot",
  },
  "merluzzini-marraquetini": {
    hues: [175, 78],
    families: ["green", "gray"],
    hair: ["gray", "green"],
    sat: 0.48,
    tags: ["green", "yellow", "sporty"],
    vibe: "silver-green fish, racket sport, athletic chaos",
  },
};

const NEIGHBORS: Record<ColorFamily, ColorFamily[]> = {
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

/** Map a pixel HSV to a costume color family. Hue is 0–1. */
export function colorFamily(h: number, s: number, v: number): ColorFamily | null {
  if (v < 0.08) {
    return "black";
  }
  if (s < 0.11) {
    if (v > 0.8) {
      return "white";
    }
    if (v < 0.26) {
      return "black";
    }
    return "gray";
  }
  const deg = h * 360;
  if (deg >= 185 && deg <= 255) {
    return "blue";
  }
  if (deg >= 70 && deg <= 170) {
    return "green";
  }
  if (deg >= 42 && deg <= 68) {
    return "yellow";
  }
  if (deg >= 300 && deg <= 345) {
    return "pink";
  }
  if (deg > 255 && deg < 300) {
    return "pink";
  }
  if (deg >= 12 && deg < 42 && s >= 0.48 && v > 0.35) {
    return "orange";
  }
  if (deg <= 40 || deg >= 345) {
    if (s < 0.52 && v < 0.78) {
      return "brown";
    }
    return "red";
  }
  return null;
}

export function familyOverlap(query: ColorFamily[], target: ColorFamily[]): number {
  if (query.length === 0 || target.length === 0) {
    return 0.2;
  }
  let best = 0;
  query.forEach((family, qIndex) => {
    const qWeight = qIndex === 0 ? 1 : 0.62;
    const tIndex = target.indexOf(family);
    if (tIndex === 0) {
      best = Math.max(best, qWeight);
      return;
    }
    if (tIndex > 0) {
      best = Math.max(best, 0.6 * qWeight);
      return;
    }
    if (target.some((item) => NEIGHBORS[family]?.includes(item))) {
      best = Math.max(best, 0.36 * qWeight);
    }
  });
  return best;
}

export function rosterForVision(): string {
  return BRAINROT_CHARACTERS.map((character) => {
    const look = CHARACTER_LOOKS[character.id];
    return `${character.id} | ${character.name} | colors:${look?.families.join("/") ?? "?"} | ${look?.vibe ?? character.blurb}`;
  }).join("\n");
}

export const ROSTER_IDS = BRAINROT_CHARACTERS.map((character) => character.id);
