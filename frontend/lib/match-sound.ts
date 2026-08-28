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
    window.speechSynthesis?.cancel();
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

/** Call from the Analyze click so autoplay policy allows the later sting. */
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
  type: OscillatorType = "square",
  gain = 0.09,
) {
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(gain, start + 0.018);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(g);
  g.connect(ac.destination);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

export function playRevealSting(): boolean {
  if (!soundEnabled()) {
    return false;
  }
  const ac = audio();
  if (!ac) {
    return false;
  }
  const t = ac.currentTime + 0.02;
  tone(ac, 392, t, 0.11);
  tone(ac, 523.25, t + 0.1, 0.11);
  tone(ac, 659.25, t + 0.2, 0.13);
  tone(ac, 784, t + 0.33, 0.32, "square", 0.11);
  return true;
}

function pickItalianVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis?.getVoices() ?? [];
  return (
    voices.find((voice) => voice.lang.toLowerCase().startsWith("it")) ??
    voices.find((voice) => /italian/i.test(voice.name))
  );
}

export function announceMatch(name: string, percent: number) {
  if (!soundEnabled() || typeof window === "undefined" || !window.speechSynthesis) {
    return;
  }
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(`${name}. ${percent} percent.`);
  utter.lang = "it-IT";
  utter.rate = 1.04;
  utter.pitch = 1.12;
  const voice = pickItalianVoice();
  if (voice) {
    utter.voice = voice;
  }
  window.setTimeout(() => {
    if (soundEnabled()) {
      window.speechSynthesis.speak(utter);
    }
  }, 420);
}

export function playMatchComplete(name: string, percent: number): boolean {
  const played = playRevealSting();
  announceMatch(name, percent);
  return played;
}
