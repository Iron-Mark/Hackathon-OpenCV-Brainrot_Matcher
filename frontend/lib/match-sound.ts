import type { BrainrotCharacter } from "./characters";

const STORAGE_KEY = "opencv-cloud-sound";

let ctx: AudioContext | null = null;

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

export function stopMatchAudio() {
  window.speechSynthesis?.cancel();
}

/** Call from a user click so autoplay policy allows the later sting. Never block Analyze. */
export async function unlockMatchAudio(): Promise<void> {
  try {
    const ac = audio();
    if (ac?.state === "suspended") {
      await Promise.race([
        ac.resume(),
        new Promise<void>((resolve) => {
          window.setTimeout(resolve, 250);
        }),
      ]);
    }
    window.speechSynthesis?.getVoices();
  } catch {
    /* Audio is optional — a hung or blocked resume must not freeze Analyze. */
  }
}

function tone(
  ac: AudioContext,
  freq: number,
  start: number,
  dur: number,
  type: OscillatorType,
  gain: number,
) {
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(gain, start + 0.016);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(g);
  g.connect(ac.destination);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

export function playCharacterSting(character: BrainrotCharacter): boolean {
  if (!soundEnabled()) {
    return false;
  }
  const ac = audio();
  if (!ac) {
    return false;
  }
  const { freqs, gap, dur, wave, gain } = character.theme;
  const t0 = ac.currentTime + 0.02;
  freqs.forEach((freq, index) => {
    tone(ac, freq, t0 + index * gap, dur, wave, gain);
  });
  return true;
}

function listVoices(): SpeechSynthesisVoice[] {
  return window.speechSynthesis?.getVoices() ?? [];
}

function voiceScore(voice: SpeechSynthesisVoice, lang: string): number {
  const want = lang.toLowerCase();
  const prefix = want.slice(0, 2);
  const vlang = voice.lang.toLowerCase();
  const name = voice.name.toLowerCase();
  if (vlang === want || vlang.replace("_", "-") === want) {
    return 100;
  }
  if (vlang.startsWith(prefix)) {
    return 80;
  }
  if (prefix === "it" && /italian|italiano/.test(name)) {
    return 70;
  }
  if (prefix === "id" && /indonesia/.test(name)) {
    return 70;
  }
  return 0;
}

function pickVoice(lang: string): SpeechSynthesisVoice | undefined {
  return listVoices()
    .map((voice) => ({ voice, score: voiceScore(voice, lang) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)[0]?.voice;
}

function waitForVoices(): Promise<SpeechSynthesisVoice[]> {
  const ready = listVoices();
  if (ready.length > 0) {
    return Promise.resolve(ready);
  }
  return new Promise((resolve) => {
    const finish = () => resolve(listVoices());
    window.speechSynthesis?.addEventListener("voiceschanged", finish, { once: true });
    window.setTimeout(finish, 400);
  });
}

export function announceCharacter(character: BrainrotCharacter) {
  if (!soundEnabled() || typeof window === "undefined" || !window.speechSynthesis) {
    return;
  }
  window.speechSynthesis.cancel();
  const delay = Math.round((character.theme.freqs.length * character.theme.gap + 0.12) * 1000);
  window.setTimeout(() => {
    void (async () => {
      if (!soundEnabled()) {
        return;
      }
      await waitForVoices();
      const voice = pickVoice(character.theme.lang);
      if (!voice) {
        return;
      }
      const utter = new SpeechSynthesisUtterance(character.theme.chant);
      utter.lang = voice.lang || character.theme.lang;
      utter.rate = character.theme.rate;
      utter.pitch = character.theme.pitch;
      utter.voice = voice;
      window.speechSynthesis.speak(utter);
    })();
  }, delay);
}

export function playMatchComplete(character: BrainrotCharacter): boolean {
  stopMatchAudio();
  const played = playCharacterSting(character);
  announceCharacter(character);
  return played;
}
