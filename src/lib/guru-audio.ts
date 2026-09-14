import { cleanGuruSpeech, type SpokenLanguage } from "./guru-contract";
import type { GuruAudio } from "./guru-speech.functions";

const aborted = () => new DOMException("Conversation ended", "AbortError");

/** Resolves on ENDED, not play(). Handles abort and revokes each temporary URL. */
export function playGuruAudio(payload: GuruAudio, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.reject(aborted());
  const bytes = Uint8Array.from(atob(payload.audioBase64), (c) => c.charCodeAt(0));
  return playGuruBlob(new Blob([bytes], { type: payload.contentType }), signal);
}

export function playGuruBlob(blob: Blob, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.reject(aborted());
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  return new Promise((resolve, reject) => {
    let done = false;
    const finish = (error?: Error) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      URL.revokeObjectURL(url);
      if (error) reject(error);
      else resolve();
    };
    const onAbort = () => finish(aborted());
    const timer = setTimeout(() => finish(new Error("Audio playback timed out.")), 90000);
    signal.addEventListener("abort", onAbort, { once: true });
    audio.onended = () => finish();
    audio.onerror = () => finish(new Error("Audio playback failed."));
    void audio
      .play()
      .catch((error) =>
        finish(error instanceof Error ? error : new Error("Tap Start to allow audio.")),
      );
  });
}

export function speakGuruOnDevice(
  text: string,
  lang: SpokenLanguage,
  signal: AbortSignal,
): Promise<void> {
  if (signal.aborted) return Promise.reject(aborted());
  if (!("speechSynthesis" in window))
    return Promise.reject(new Error("Voice playback is unavailable. Your reply is shown below."));
  return new Promise((resolve, reject) => {
    const speech = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(cleanGuruSpeech(text, lang));
    utterance.lang = lang === "en" ? "en-IN" : "hi-IN";
    const voice =
      speech.getVoices().find((v) => v.lang === utterance.lang) ??
      speech.getVoices().find((v) => v.lang.startsWith(lang === "en" ? "en" : "hi"));
    if (voice) utterance.voice = voice;
    utterance.rate = 0.95;
    let done = false;
    const finish = (error?: Error) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      utterance.onend = null;
      utterance.onerror = null;
      speech.cancel();
      if (error) reject(error);
      else resolve();
    };
    const onAbort = () => finish(aborted());
    const timer = setTimeout(
      () => finish(new Error("Device voice timed out. Read the reply below.")),
      90000,
    );
    signal.addEventListener("abort", onAbort, { once: true });
    utterance.onend = () => finish();
    utterance.onerror = () =>
      finish(new Error("Device voice is unavailable. Read the reply below."));
    speech.cancel();
    speech.speak(utterance);
  });
}
