export const VOICES = [
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", desc: "Warm female, default" },
  { id: "FGY2WhTYpPnrIDTdsKH5", name: "Laura", desc: "Bright female" },
  { id: "XrExE9yKIg1WjnnlVkGX", name: "Matilda", desc: "Friendly female" },
  { id: "cgSgspJ2msm6clMCkdW9", name: "Jessica", desc: "Confident female" },
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George", desc: "Deep male" },
  { id: "TX3LPaxmHKxFdv7VOQHJ", name: "Liam", desc: "Young male" },
  { id: "nPczCjzI2devNBz1zQrb", name: "Brian", desc: "Narrator male" },
  { id: "iP95p4xoKVk53GoZ742B", name: "Chris", desc: "Casual male" },
] as const;

export const DEFAULT_VOICE_ID = "EXAVITQu4vr4xnSDxMaL";
const KEY = "money_fyi_voice";
const ELEVEN_KEY = "money_fyi_eleven_key";

export function getVoiceId(): string {
  if (typeof window === "undefined") return DEFAULT_VOICE_ID;
  return localStorage.getItem(KEY) || DEFAULT_VOICE_ID;
}
export function setVoiceId(id: string) {
  localStorage.setItem(KEY, id);
}
export function getElevenKey(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(ELEVEN_KEY) || "";
}
export function setElevenKey(k: string) {
  if (k) localStorage.setItem(ELEVEN_KEY, k);
  else localStorage.removeItem(ELEVEN_KEY);
}

const AUTO_KEY = "money_fyi_autospeak";

export function getAutoSpeak(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(AUTO_KEY) !== "0";
}
export function setAutoSpeak(on: boolean) {
  localStorage.setItem(AUTO_KEY, on ? "1" : "0");
}

/** Language the AI voice speaks in. "auto" follows the app language. */
export type VoiceLang = "auto" | "en" | "hi" | "es" | "fr";
const VOICE_LANG_KEY = "money_fyi_voice_lang";

export const VOICE_LANGS: { id: VoiceLang; label: string; native: string }[] = [
  { id: "auto", label: "Follow app language", native: "Auto" },
  { id: "en", label: "English", native: "English" },
  { id: "hi", label: "Hinglish / Hindi", native: "हिंदी" },
  { id: "es", label: "Spanish", native: "Español" },
  { id: "fr", label: "French", native: "Français" },
];

export function getVoiceLang(): VoiceLang {
  if (typeof window === "undefined") return "auto";
  return (localStorage.getItem(VOICE_LANG_KEY) as VoiceLang) || "auto";
}
export function setVoiceLang(l: VoiceLang) {
  localStorage.setItem(VOICE_LANG_KEY, l);
}
export function bcp47(l: "en" | "hi" | "es" | "fr") {
  return l === "hi" ? "hi-IN" : l === "es" ? "es-ES" : l === "fr" ? "fr-FR" : "en-IN";
}
