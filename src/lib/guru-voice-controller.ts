import type { GuruLanguage, GuruResult, GuruTurn, SpokenLanguage } from "./guru-contract";
import type { GuruAccess, GuruReply } from "./guru-chat.functions";
import type { GuruAudio } from "./guru-speech.functions";

export type GuruState =
  | "off"
  | "connecting"
  | "listening"
  | "thinking"
  | "speaking"
  | "connected"
  | "microphone_denied"
  | "offline";
export type RecognitionResult = {
  resultIndex: number;
  results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
};
export type GuruRecognizer = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  abort(): void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onresult: ((event: RecognitionResult) => void) | null;
};
export type VoiceSnapshot = {
  state: GuruState;
  live: boolean;
  turns: GuruTurn[];
  partial: string;
  message: string;
  remaining: number | null;
  premiumDenied: boolean;
};
export const EMPTY_VOICE: VoiceSnapshot = {
  state: "off",
  live: false,
  turns: [],
  partial: "",
  message: "",
  remaining: null,
  premiumDenied: false,
};

export type VoicePorts = {
  access(signal: AbortSignal): Promise<GuruResult<GuruAccess>>;
  talk(
    messages: GuruTurn[],
    lang: GuruLanguage,
    signal: AbortSignal,
  ): Promise<GuruResult<GuruReply>>;
  speech(text: string, lang: SpokenLanguage, signal: AbortSignal): Promise<GuruResult<GuruAudio>>;
  play(audio: GuruAudio, signal: AbortSignal): Promise<void>;
  deviceSpeak(text: string, lang: SpokenLanguage, signal: AbortSignal): Promise<void>;
  recognizer(): GuruRecognizer | null;
  online(): boolean;
  secure(): boolean;
  changed(snapshot: VoiceSnapshot): void;
};

/** Explicit lifecycle, no stale React closures. All asynchronous work is invalidated on stop. */
export class GuruVoiceController {
  snapshot: VoiceSnapshot = { ...EMPTY_VOICE, turns: [] };
  private controller = new AbortController();
  private rec: GuruRecognizer | null = null;
  private restartTimer?: ReturnType<typeof setTimeout>;
  private expiryTimer?: ReturnType<typeof setTimeout>;
  private requestTimer?: ReturnType<typeof setTimeout>;
  private emptyResults = 0;
  private disposed = false;
  private busy = false;
  private lang: GuruLanguage;

  constructor(
    private ports: VoicePorts,
    lang: GuruLanguage,
  ) {
    this.lang = lang;
  }
  private emit(patch: Partial<VoiceSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    if (!this.disposed) this.ports.changed(this.snapshot);
  }
  private stopRecognition() {
    clearTimeout(this.restartTimer);
    clearTimeout(this.requestTimer);
    const rec = this.rec;
    this.rec = null;
    if (rec) {
      rec.onstart = null;
      rec.onend = null;
      rec.onerror = null;
      rec.onresult = null;
      try {
        rec.abort();
      } catch {
        /* inactive */
      }
    }
  }
  stop(message = "", state: GuruState = "off") {
    this.controller.abort();
    this.controller = new AbortController();
    clearTimeout(this.expiryTimer);
    this.stopRecognition();
    this.busy = false;
    this.emit({ live: false, state, partial: "", message });
  }
  dispose() {
    this.disposed = true;
    this.stop();
  }
  clear() {
    this.stop();
    this.emit({ turns: [], remaining: null });
  }
  setLanguage(lang: GuruLanguage) {
    if (this.lang !== lang) {
      this.stop("Language changed. Start a new conversation.");
      this.lang = lang;
    }
  }
  setOffline() {
    this.stop("You are offline. Reconnect, then tap Start or type a question.", "offline");
  }
  setOnline() {
    if (this.snapshot.state === "offline")
      this.emit({ state: "off", message: "Back online. Tap Start or type a question." });
  }
  revokeAccess() {
    this.stop("Your premium access ended. Please renew your plan.");
    this.emit({ premiumDenied: true });
  }
  private watchExpiry(expiresAt: string | null) {
    clearTimeout(this.expiryTimer);
    if (!expiresAt) return true;
    const ms = Date.parse(expiresAt) - Date.now();
    if (!Number.isFinite(ms) || ms <= 0) {
      this.revokeAccess();
      return false;
    }
    this.expiryTimer = setTimeout(() => this.watchExpiry(expiresAt), Math.min(ms, 2147483647));
    return true;
  }
  private fail(result: Extract<GuruResult<never>, { ok: false }>) {
    const suffix = result.retryAfter
      ? ` Retry in ${Math.ceil(result.retryAfter / 60)} minute(s).`
      : "";
    this.stop(result.message + suffix, this.ports.online() ? "connected" : "offline");
    if (result.code === "PREMIUM_REQUIRED") this.emit({ premiumDenied: true });
  }
  async start() {
    this.stop();
    this.emptyResults = 0;
    if (!this.ports.online()) return this.setOffline();
    if (!this.ports.secure()) {
      this.emit({ message: "Microphone needs HTTPS or localhost. You can still type." });
      return;
    }
    const signal = this.controller.signal;
    this.busy = true;
    this.emit({ state: "connecting", live: true, premiumDenied: false });
    try {
      const result = await this.ports.access(signal);
      if (signal.aborted) return;
      this.busy = false;
      if (!result.ok) return this.fail(result);
      if (!this.watchExpiry(result.value.expiresAt)) return;
      if (!result.value.speechAvailable)
        this.emit({
          message: "Premium speech is not configured; device voice will be used if available.",
        });
      this.listen();
    } catch {
      if (!signal.aborted)
        this.stop(
          "Could not connect. Check your connection and sign-in, then retry.",
          this.ports.online() ? "connected" : "offline",
        );
    }
  }
  private listen() {
    if (!this.snapshot.live || this.disposed || this.busy || this.rec) return;
    if (!this.ports.online()) return this.setOffline();
    const rec = this.ports.recognizer();
    if (!rec) {
      this.stop(
        "Speech recognition is unavailable in this browser. Type below; Guru can still speak replies.",
        "connected",
      );
      return;
    }
    this.rec = rec;
    rec.lang = this.lang === "en" ? "en-IN" : "hi-IN";
    rec.continuous = false;
    rec.interimResults = true;
    let final = "";
    this.emit({ state: "connecting", partial: "" });
    rec.onstart = () => {
      if (this.rec === rec) this.emit({ state: "listening" });
    };
    rec.onresult = (event) => {
      if (this.rec !== rec) return;
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const row = event.results[i];
        if (row.isFinal) final += row[0].transcript + " ";
        else interim += row[0].transcript;
      }
      this.emit({ partial: (final + interim).slice(0, 1000) });
    };
    rec.onerror = (event) => {
      if (this.rec !== rec) return;
      if (event.error === "no-speech") return; // onend handles bounded retry.
      const denied = ["not-allowed", "service-not-allowed"].includes(event.error);
      this.stop(
        denied
          ? "Microphone permission denied. Enable it in browser settings or type below."
          : "Microphone stopped. Try Start again or type below.",
        denied ? "microphone_denied" : "connected",
      );
    };
    rec.onend = () => {
      if (this.rec !== rec) return;
      this.stopRecognition();
      this.emit({ partial: "", state: "connected" });
      const said = final.trim().slice(0, 1000);
      if (said) {
        this.emptyResults = 0;
        void this.send(said);
      } else if (++this.emptyResults < 3 && this.snapshot.live)
        this.restartTimer = setTimeout(() => this.listen(), 600);
      else this.stop("No speech heard. Tap Start when ready, or type below.", "connected");
    };
    // A recognition service can hang without firing onend.
    this.requestTimer = setTimeout(() => {
      if (this.rec !== rec) return;
      this.stopRecognition();
      if (final.trim()) void this.send(final.trim().slice(0, 1000));
      else this.stop("Microphone timed out. Tap Start to retry.", "connected");
    }, 30000);
    try {
      rec.start();
    } catch {
      this.stop("Microphone could not start. Use a supported browser or type below.", "connected");
    }
  }
  async send(input: string) {
    const text = input.trim().slice(0, 1000);
    if (!text || this.busy || this.disposed) return;
    if (!this.ports.online()) return this.setOffline();
    this.stopRecognition();
    this.busy = true;
    const signal = this.controller.signal;
    const next: GuruTurn[] = [
      ...this.snapshot.turns,
      { role: "user" as const, content: text },
    ].slice(-40);
    this.emit({ turns: next, state: "thinking", partial: "", message: "" });
    try {
      const result = await this.ports.talk(next.slice(-8), this.lang, signal);
      if (signal.aborted) return;
      if (!result.ok) return this.fail(result);
      const reply = result.value;
      if (!this.watchExpiry(reply.expiresAt)) return;
      this.emit({
        turns: [...next, { role: "assistant" as const, content: reply.reply }].slice(-40),
        remaining: reply.remainingToday,
        state: "speaking",
      });
      const audio = await this.ports.speech(reply.reply, reply.language, signal);
      if (signal.aborted) return;
      if (!audio.ok && (audio.code === "PREMIUM_REQUIRED" || audio.code === "RATE_LIMITED"))
        return this.fail(audio);
      if (audio.ok) {
        if (!this.watchExpiry(audio.value.expiresAt)) return;
        try {
          await this.ports.play(audio.value, signal);
        } catch (error) {
          if (signal.aborted) return;
          await this.deviceReply(reply, signal);
        }
      } else await this.deviceReply(reply, signal);
      if (signal.aborted) return;
      this.busy = false;
      this.emit({ state: "connected" });
      if (this.snapshot.live) this.restartTimer = setTimeout(() => this.listen(), 350);
    } catch {
      if (!signal.aborted)
        this.stop(
          "Connection or playback failed. Your transcript remains here; retry Start or type a question.",
          this.ports.online() ? "connected" : "offline",
        );
    } finally {
      if (!signal.aborted) this.busy = false;
    }
  }
  private async deviceReply(reply: GuruReply, signal: AbortSignal) {
    this.emit({
      message: "Using device voice. Voice quality and language support depend on this device.",
    });
    await this.ports.deviceSpeak(reply.reply, reply.language, signal);
  }
}
