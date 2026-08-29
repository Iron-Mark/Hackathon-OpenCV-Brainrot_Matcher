export type FaceSlot = { cx: number; cy: number; rx: number; ry: number };

const DEFAULT_SLOT: FaceSlot = { cx: 0.5, cy: 0.26, rx: 0.17, ry: 0.2 };

export const FACE_SLOTS: Record<string, FaceSlot> = {
  "tralalero-tralala": { cx: 0.52, cy: 0.32, rx: 0.2, ry: 0.18 },
  "tung-tung-tung-sahur": { cx: 0.5, cy: 0.22, rx: 0.16, ry: 0.2 },
  "bombardiro-crocodilo": { cx: 0.48, cy: 0.3, rx: 0.22, ry: 0.16 },
  "bombombini-gusini": { cx: 0.5, cy: 0.24, rx: 0.18, ry: 0.16 },
  "brr-brr-patapim": { cx: 0.5, cy: 0.2, rx: 0.16, ry: 0.18 },
  "lirili-larila": { cx: 0.5, cy: 0.16, rx: 0.14, ry: 0.16 },
  "cappuccino-assassino": { cx: 0.5, cy: 0.22, rx: 0.16, ry: 0.18 },
  "ballerina-cappuccina": { cx: 0.5, cy: 0.2, rx: 0.15, ry: 0.18 },
  "chimpanzini-bananini": { cx: 0.5, cy: 0.28, rx: 0.18, ry: 0.18 },
  "boneca-ambalabu": { cx: 0.5, cy: 0.34, rx: 0.2, ry: 0.18 },
  "trippi-troppi": { cx: 0.5, cy: 0.3, rx: 0.2, ry: 0.18 },
  "frigo-camelo": { cx: 0.5, cy: 0.18, rx: 0.14, ry: 0.16 },
  "giraffa-celeste": { cx: 0.5, cy: 0.14, rx: 0.12, ry: 0.16 },
  "udin-din-din-dun": { cx: 0.5, cy: 0.36, rx: 0.22, ry: 0.2 },
  "ecco-cavallo-virtuoso": { cx: 0.5, cy: 0.2, rx: 0.16, ry: 0.16 },
  "frulli-frulla": { cx: 0.5, cy: 0.24, rx: 0.16, ry: 0.18 },
  "merluzzini-marraquetini": { cx: 0.5, cy: 0.28, rx: 0.18, ry: 0.16 },
};

export function faceSlot(id: string): FaceSlot {
  return FACE_SLOTS[id] ?? DEFAULT_SLOT;
}

export const CLIP_PROMPTS: Record<string, string> = {
  "tralalero-tralala": "a cartoon electric blue shark wearing Nike sneakers",
  "tung-tung-tung-sahur": "a brown wooden drumstick creature holding a bat at night",
  "bombardiro-crocodilo": "a green crocodile bomber airplane hybrid",
  "bombombini-gusini": "a white gray goose with jet airplane wings",
  "brr-brr-patapim": "a brown green forest elder tree creature",
  "lirili-larila": "a tall green cactus creature wearing sandals",
  "cappuccino-assassino": "a brown coffee cup ninja with black blades",
  "ballerina-cappuccina": "a pink cream ballerina coffee cup mascot",
  "chimpanzini-bananini": "a yellow banana chimpanzee cartoon mascot",
  "boneca-ambalabu": "a round green frog with a black tire",
  "trippi-troppi": "an orange pink shrimp sea gremlin",
  "frigo-camelo": "a white refrigerator camel hybrid",
  "giraffa-celeste": "a sky blue giraffe with yellow spots",
  "udin-din-din-dun": "a round yellow bouncy nursery mascot",
  "ecco-cavallo-virtuoso": "a brown opera horse virtuoso",
  "frulli-frulla": "a soft pink yellow fluffy pastel mascot",
  "merluzzini-marraquetini": "a silver green fish holding a tennis racket",
};
