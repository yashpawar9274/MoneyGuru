let guruActive = false;
export const VOICE_FOCUS_EVENT = "money-fyi:guru-voice-focus";
export const isGuruVoiceActive = () => guruActive;
export function setGuruVoiceFocus(active: boolean) {
  if (guruActive === active) return;
  guruActive = active;
  if (typeof window !== "undefined")
    window.dispatchEvent(new CustomEvent(VOICE_FOCUS_EVENT, { detail: active }));
}
