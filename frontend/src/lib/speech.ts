import { useEffect, useState } from "react";
import type { Lang } from "../i18n";

/**
 * Read-aloud through the browser's own speech engine (Web Speech API). Nothing
 * leaves the device. Falls back to the closest available voice: Marathi →
 * Hindi → Indian English → any English, so a phone without a Marathi voice
 * still reads the text rather than staying silent.
 */

const PREFERENCE: Record<Lang, string[]> = {
  mr: ["mr-IN", "mr", "hi-IN", "hi"],
  hi: ["hi-IN", "hi"],
  en: ["en-IN", "en-GB", "en-US", "en"],
};

export function speechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
}

function pickVoice(lang: Lang): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  for (const tag of PREFERENCE[lang]) {
    const v = voices.find((voice) => voice.lang.toLowerCase().startsWith(tag.toLowerCase()));
    if (v) return v;
  }
  return null;
}

export function speak(text: string, lang: Lang, onEnd?: () => void): void {
  if (!speechSupported()) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const voice = pickVoice(lang);
  u.lang = voice?.lang ?? PREFERENCE[lang][0];
  if (voice) u.voice = voice;
  u.rate = 0.92;
  u.onend = () => onEnd?.();
  u.onerror = () => onEnd?.();
  window.speechSynthesis.speak(u);
}

export function stopSpeaking(): void {
  if (speechSupported()) window.speechSynthesis.cancel();
}

/** State for a single Listen / Stop toggle; stops speaking on unmount. */
export function useSpeech() {
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => () => stopSpeaking(), []);
  return {
    supported: speechSupported(),
    speaking,
    toggle(text: string, lang: Lang) {
      if (speaking) {
        stopSpeaking();
        setSpeaking(false);
      } else {
        setSpeaking(true);
        speak(text, lang, () => setSpeaking(false));
      }
    },
  };
}
