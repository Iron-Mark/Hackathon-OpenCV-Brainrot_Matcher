import { BRAINROT_CHARACTERS } from "./characters";

export type CharacterLook = {
  hues: number[];
  sat: number;
  tags: string[];
  vibe: string;
};

/** Costume colors and vibe used when the query is a person, not a character still. */
export const CHARACTER_LOOKS: Record<string, CharacterLook> = {
  "tralalero-tralala": {
    hues: [210, 48],
    sat: 0.72,
    tags: ["blue", "sporty", "chaotic", "loud"],
    vibe: "electric blue, sneakers, loud sporty energy",
  },
  "tung-tung-tung-sahur": {
    hues: [28, 20],
    sat: 0.38,
    tags: ["brown", "wooden", "dark", "serious"],
    vibe: "wood brown, night patrol, heavy and serious",
  },
  "bombardiro-crocodilo": {
    hues: [118, 85],
    sat: 0.45,
    tags: ["green", "aerial", "chaotic", "dark"],
    vibe: "olive green, aircraft gray, aerial chaos",
  },
  "bombombini-gusini": {
    hues: [200, 50],
    sat: 0.35,
    tags: ["white", "aerial", "loud"],
    vibe: "white-gray goose, jet wings, noisy cousin energy",
  },
  "brr-brr-patapim": {
    hues: [32, 115],
    sat: 0.42,
    tags: ["brown", "green", "forest", "soft"],
    vibe: "forest brown-green, elder, earthy and poetic",
  },
  "lirili-larila": {
    hues: [112, 42],
    sat: 0.48,
    tags: ["green", "tall", "desert"],
    vibe: "cactus green, tan sandals, tall desert walker",
  },
  "cappuccino-assassino": {
    hues: [24, 8],
    sat: 0.4,
    tags: ["brown", "black", "food", "dramatic"],
    vibe: "coffee brown, black blades, cafe ninja",
  },
  "ballerina-cappuccina": {
    hues: [328, 28],
    sat: 0.38,
    tags: ["pink", "beige", "cute", "soft"],
    vibe: "ballet pink, cream tutu, soft and pretty",
  },
  "chimpanzini-bananini": {
    hues: [50, 30],
    sat: 0.7,
    tags: ["yellow", "brown", "chaotic", "loud"],
    vibe: "banana yellow, chimp brown, indestructible chaos",
  },
  "boneca-ambalabu": {
    hues: [128, 0],
    sat: 0.42,
    tags: ["green", "black", "round"],
    vibe: "frog green, tire black, beach underdog",
  },
  "trippi-troppi": {
    hues: [18, 348],
    sat: 0.62,
    tags: ["orange", "pink", "chaotic", "cute"],
    vibe: "shrimp orange-pink, sea gremlin, twitchy cute",
  },
  "frigo-camelo": {
    hues: [38, 205],
    sat: 0.22,
    tags: ["white", "tan", "tall", "soft"],
    vibe: "fridge white, camel tan, cold and calm",
  },
  "giraffa-celeste": {
    hues: [198, 48],
    sat: 0.55,
    tags: ["blue", "yellow", "tall", "soft"],
    vibe: "sky blue, yellow spots, tall pastel paladin",
  },
  "udin-din-din-dun": {
    hues: [44, 200],
    sat: 0.5,
    tags: ["yellow", "round", "chaotic"],
    vibe: "round, nursery-rhyme, warm and bouncy",
  },
  "ecco-cavallo-virtuoso": {
    hues: [30, 275],
    sat: 0.35,
    tags: ["brown", "dramatic", "tall"],
    vibe: "horse brown, opera drama, virtuoso pose",
  },
  "frulli-frulla": {
    hues: [322, 52],
    sat: 0.4,
    tags: ["pink", "yellow", "soft", "cute"],
    vibe: "soft pastels, fluffy, gentle mid-wave mascot",
  },
  "merluzzini-marraquetini": {
    hues: [175, 78],
    sat: 0.48,
    tags: ["green", "yellow", "sporty"],
    vibe: "silver-green fish, racket sport, athletic chaos",
  },
};

export function rosterForVision(): string {
  return BRAINROT_CHARACTERS.map((character) => {
    const look = CHARACTER_LOOKS[character.id];
    return `${character.id} | ${character.name} | ${look?.vibe ?? character.blurb}`;
  }).join("\n");
}
