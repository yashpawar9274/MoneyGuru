import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GuruVoiceController, type GuruRecognizer, type VoicePorts } from "./guru-voice-controller";
import type { GuruReply } from "./guru-chat.functions";
import type { GuruResult } from "./guru-contract";

function setup() {
  const recognizers: GuruRecognizer[] = [];
  const ports: VoicePorts = {
    access: vi.fn<VoicePorts["access"]>(async () => ({
      ok: true,
      value: { expiresAt: null, speechAvailable: true },
    })),
    talk: vi.fn<VoicePorts["talk"]>(async () => ({
      ok: true,
      value: {
        reply: "You spent 100 rupees.",
        language: "en",
        expiresAt: null,
        remainingToday: 59,
      },
    })),
    speech: vi.fn<VoicePorts["speech"]>(async () => ({
      ok: true,
      value: { audioBase64: "YQ==", contentType: "audio/mpeg", expiresAt: null },
    })),
    play: vi.fn(async () => {}),
    deviceSpeak: vi.fn(async () => {}),
    recognizer: vi.fn(() => {
      const rec: GuruRecognizer = {
        lang: "",
        continuous: false,
        interimResults: true,
        onstart: null,
        onresult: null,
        onerror: null,
        onend: null,
        start: vi.fn(() => rec.onstart?.()),
        abort: vi.fn(),
      };
      recognizers.push(rec);
      return rec;
    }),
    online: () => true,
    secure: () => true,
    changed: vi.fn(),
  };
  const voice = new GuruVoiceController(ports, "en");
  return { voice, ports, recognizers };
}
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe("voice lifecycle", () => {
  it("never starts microphone until explicit Start", async () => {
    const { voice, ports } = setup();
    expect(ports.recognizer).not.toHaveBeenCalled();
    await voice.start();
    expect(voice.snapshot.state).toBe("listening");
    voice.dispose();
  });
  it("waits until audio ENDS before recognition restarts", async () => {
    const { voice, ports, recognizers } = setup();
    let finish!: () => void;
    ports.play = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    await voice.start();
    recognizers[0].onresult?.({
      resultIndex: 0,
      results: [{ 0: { transcript: "Spending?" }, isFinal: true }],
    });
    recognizers[0].onend?.();
    await flush();
    expect(voice.snapshot.state).toBe("speaking");
    expect(recognizers[0].abort).toHaveBeenCalled();
    expect(recognizers).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(recognizers).toHaveLength(1);
    finish();
    await flush();
    await vi.advanceTimersByTimeAsync(400);
    expect(recognizers).toHaveLength(2);
    expect(voice.snapshot.state).toBe("listening");
    voice.dispose();
  });
  it("End cancels pending requests and prevents late audio/mic restart", async () => {
    const { voice, ports, recognizers } = setup();
    let reply!: (r: GuruResult<GuruReply>) => void;
    let requestSignal!: AbortSignal;
    ports.talk = vi.fn<VoicePorts["talk"]>((_messages, _language, signal) => {
      requestSignal = signal;
      return new Promise((resolve) => {
        reply = resolve;
      });
    });
    await voice.start();
    const pending = voice.send("Hi");
    voice.stop();
    expect(requestSignal.aborted).toBe(true);
    reply({
      ok: true,
      value: { reply: "Late", language: "en", expiresAt: null, remainingToday: 59 },
    });
    await pending;
    await vi.advanceTimersByTimeAsync(1000);
    expect(ports.speech).not.toHaveBeenCalled();
    expect(recognizers).toHaveLength(1);
    expect(voice.snapshot.state).toBe("off");
    voice.dispose();
  });
  it("permission denial does not cause an automatic retry loop", async () => {
    const { voice, recognizers } = setup();
    await voice.start();
    const end = recognizers[0].onend;
    recognizers[0].onerror?.({ error: "not-allowed" });
    end?.();
    await vi.advanceTimersByTimeAsync(35000);
    expect(voice.snapshot.state).toBe("microphone_denied");
    expect(recognizers).toHaveLength(1);
    voice.dispose();
  });
  it("typed fallback works without recognition and doesn't request the mic", async () => {
    const { voice, ports } = setup();
    ports.recognizer = vi.fn(() => null);
    await voice.send("How much do I owe?");
    expect(ports.recognizer).not.toHaveBeenCalled();
    expect(voice.snapshot.turns).toHaveLength(2);
    expect(ports.play).toHaveBeenCalledOnce();
    voice.dispose();
  });
  it.each(["en", "hi", "hinglish"] as const)(
    "uses %s for requests and recognition",
    async (lang) => {
      const { voice, ports, recognizers } = setup();
      voice.setLanguage(lang);
      await voice.start();
      expect(recognizers[0].lang).toBe(lang === "en" ? "en-IN" : "hi-IN");
      await voice.send("Question");
      expect(ports.talk).toHaveBeenCalledWith(expect.any(Array), lang, expect.any(AbortSignal));
      voice.dispose();
    },
  );
  it("expires access while idle/listening and cancels microphone", async () => {
    const { voice, ports, recognizers } = setup();
    ports.access = vi.fn<VoicePorts["access"]>(async () => ({
      ok: true,
      value: { expiresAt: new Date(Date.now() + 1000).toISOString(), speechAvailable: true },
    }));
    await voice.start();
    await vi.advanceTimersByTimeAsync(1001);
    expect(voice.snapshot.premiumDenied).toBe(true);
    expect(recognizers[0].abort).toHaveBeenCalled();
    voice.dispose();
  });
  it("does not fallback to device voice on a premium or rate-limit denial", async () => {
    const { voice, ports } = setup();
    ports.speech = vi.fn<VoicePorts["speech"]>(async () => ({
      ok: false,
      code: "PREMIUM_REQUIRED",
      message: "Expired",
    }));
    await voice.send("Hi");
    expect(ports.deviceSpeak).not.toHaveBeenCalled();
    expect(voice.snapshot.premiumDenied).toBe(true);
    voice.dispose();
  });
  it("uses device voice for unavailable premium TTS, blocks duplicate sends", async () => {
    const { voice, ports } = setup();
    ports.speech = vi.fn<VoicePorts["speech"]>(async () => ({
      ok: false,
      code: "NOT_CONFIGURED",
      message: "No TTS",
    }));
    const first = voice.send("Hi");
    await voice.send("Duplicate");
    await first;
    expect(ports.talk).toHaveBeenCalledOnce();
    expect(ports.deviceSpeak).toHaveBeenCalledOnce();
    voice.dispose();
  });
  it("goes offline safely, resumes only on explicit user action", async () => {
    const { voice, recognizers } = setup();
    await voice.start();
    voice.setOffline();
    voice.setOnline();
    expect(voice.snapshot.state).toBe("off");
    expect(voice.snapshot.live).toBe(false);
    expect(recognizers).toHaveLength(1);
    voice.dispose();
  });
});
