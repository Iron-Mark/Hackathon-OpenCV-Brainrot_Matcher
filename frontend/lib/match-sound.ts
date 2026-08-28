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

/** Call from a user click so autoplay policy allows the later sting. */
export async function unlockMatchAudio(): Promise<void> {
  const ac = audio();
  if (ac?.state === "suspended") {
    await ac.resume();
  }
  window.speechSynthesis?.getVoices();
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

function pickVoice(lang: string): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis?.getVoices() ?? [];
  const prefix = lang.slice(0, 2).toLowerCase();
  return (
    voices.find((voice) => voice.lang.toLowerCase().startsWith(prefix)) ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith("it")) ??
    voices.find((voice) => /italian/i.test(voice.name))
  );
}

export function announceCharacter(character: BrainrotCharacter) {
  if (!soundEnabled() || typeof window === "undefined" || !window.speechSynthesis) {
    return;
  }
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(character.theme.chant);
  utter.lang = character.theme.lang;
  utter.rate = character.theme.rate;
  utter.pitch = character.theme.pitch;
  const voice = pickVoice(character.theme.lang);
  if (voice) {
    utter.voice = voice;
  }
  const delay = Math.round((character.theme.freqs.length * character.theme.gap + 0.12) * 1000);
  window.setTimeout(() => {
    if (soundEnabled()) {
      window.speechSynthesis.speak(utter);
    }
  }, delay);
}

export function playMatchComplete(character: BrainrotCharacter): boolean {
  stopMatchAudio();
  const played = playCharacterSting(character);
  announceCharacter(character);
  return played;
}
