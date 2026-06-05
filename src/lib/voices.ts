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
