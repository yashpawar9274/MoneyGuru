import { getVoiceId, getElevenKey, bcp47 } from "@/lib/voices";

export type SpeakLang = "en" | "hi" | "es" | "fr";

const CURRENCY_WORD: Record<SpeakLang, string> = {
  en: "rupees",
  hi: "rupaye",
  es: "rupias",
  fr: "roupies",
};

/**
 * Makes AI text actually speakable: strips emoji/markdown, expands ₹ amounts
 * into words and normalises punctuation so the voice does not stumble.
 */
export function toSpeakable(text: string, lang: SpeakLang): string {
  const money = CURRENCY_WORD[lang] ?? CURRENCY_WORD.en;
  return text
    // emoji & pictographs
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, " ")
    // markdown / stray symbols
    .replace(/[*_`#~>|\[\]()"]/g, " ")
    // ₹1,234.50 / Rs. 1234 -> "1234 rupaye"
    .replace(/(?:₹|\bRs\.?|\bINR)\s?([\d,]+(?:\.\d+)?)/gi, (_m, n: string) =>
      ` ${n.replace(/,/g, "").replace(/\.00$/, "")} ${money} `,
    )
    .replace(/₹/g, ` ${money} `)
    .replace(/(\d),(\d)/g, "$1$2")
    .replace(/\s*\/\s*/g, " ")
    .replace(/\s*-\s*/g, ", ")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.!?])/g, "$1")
    .trim();
}

/** Speaks text with ElevenLabs (multilingual) and falls back to device voice. */
export async function speakLine(text: string, lang: SpeakLang): Promise<void> {
  const clean = toSpeakable(text, lang);
  if (!clean) return;
  try {
    const r = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: clean, voiceId: getVoiceId(), userKey: getElevenKey(), lang }),
    });
    if (!r.ok) throw new Error("tts");
    const audio = new Audio(URL.createObjectURL(await r.blob()));
    audio.volume = 1;
    await audio.play();
  } catch {
    try {
      const u = new SpeechSynthesisUtterance(clean);
      u.lang = bcp47(lang);
      u.rate = 0.95;
      u.pitch = 1;
      u.volume = 1;
      const v = speechSynthesis.getVoices().find((x) => x.lang === u.lang);
      if (v) u.voice = v;
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    } catch {
      /* voice unavailable */
    }
  }
}
