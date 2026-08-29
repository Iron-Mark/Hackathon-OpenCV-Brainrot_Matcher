import { BRAINROT_CHARACTERS, type BrainrotCharacter } from "./characters";

const STORAGE_KEY = "opencv-cloud-sound";
const SILENT_WAV =
  "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";

let ctx: AudioContext | null = null;
let chantEl: HTMLAudioElement | null = null;
let chantsPrefetched = false;

export function soundEnabled(): boolean {
  if (typeof window === "undefined") {
    return true;
  }
  return window.localStorage.getItem(STORAGE_KEY) !== "off";
}

export function setSoundEnabled(on: boolean) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, on ? "on" : "off");
  if (!on) {
    stopMatchAudio();
  }
}

function audio(): AudioContext | null {
  if (typeof window === "undefined") {
    return null;
  }
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) {
    return null;
  }
  if (!ctx) {
    ctx = new AC();
  }
  return ctx;
}

function getChantEl(): HTMLAudioElement {
  if (!chantEl) {
    chantEl = new Audio();
    chantEl.preload = "auto";
  }
  return chantEl;
}

export function stopMatchAudio() {
  window.speechSynthesis?.cancel();
  if (chantEl) {
    chantEl.pause();
    chantEl.currentTime = 0;
  }
}

function timeout(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function prefetchChants() {
  if (chantsPrefetched) {
    return;
  }
  chantsPrefetched = true;
  for (const character of BRAINROT_CHARACTERS) {
    const link = document.createElement("link");
    link.rel = "prefetch";
    link.as = "audio";
    link.href = `/models/chant/${character.id}`;
    document.head.appendChild(link);
  }
}

/** Call from a user tap so iOS lets the later Italian chant play. */
export async function unlockMatchAudio(): Promise<void> {
  try {
    const ac = audio();
    if (ac?.state === "suspended") {
      await Promise.race([ac.resume(), timeout(250)]);
    }
    const el = getChantEl();
    if (!el.src) {
      el.src = SILENT_WAV;
    }
    await Promise.race([el.play().then(() => undefined).catch(() => undefined), timeout(250)]);
    el.pause();
    el.currentTime = 0;
    prefetchChants();
    window.speechSynthesis?.getVoices();
  } catch {
    /* Audio is optional — a hung resume must not freeze Analyze. */
  }
}

function listVoices(): SpeechSynthesisVoice[] {
  return window.speechSynthesis?.getVoices() ?? [];
}

function pickItalianVoice(): SpeechSynthesisVoice | undefined {
  const ranked = listVoices()
    .map((voice) => {
      const lang = voice.lang.toLowerCase().replace("_", "-");
      const name = voice.name.toLowerCase();
      let score = 0;
      if (lang === "it-it") {
        score += 80;
      } else if (lang.startsWith("it")) {
        score += 60;
      } else if (/italian|italiano/.test(name)) {
        score += 50;
      }
      if (/luca|diego|giorgio|cosimo|guido|male|uomo/.test(name)) {
        score += 20;
      }
      return { voice, score };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);
  return ranked[0]?.voice;
}

function announceItalianFallback(character: BrainrotCharacter) {
  if (!window.speechSynthesis) {
    return;
  }
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(character.theme.chant);
  utter.lang = "it-IT";
  utter.rate = 0.92;
  utter.pitch = 0.82;
  const voice = pickItalianVoice();
  if (voice) {
    utter.voice = voice;
  }
  window.speechSynthesis.speak(utter);
}

async function playItalianChant(character: BrainrotCharacter): Promise<boolean> {
  const el = getChantEl();
  el.src = `/models/chant/${character.id}`;
  try {
    await el.play();
    return true;
  } catch {
    announceItalianFallback(character);
    return false;
  }
}

export function playMatchComplete(character: BrainrotCharacter): boolean {
  if (!soundEnabled()) {
    return false;
  }
  stopMatchAudio();
  void playItalianChant(character);
  return true;
}
