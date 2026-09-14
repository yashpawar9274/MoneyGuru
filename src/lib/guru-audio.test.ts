import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { playGuruAudio, speakGuruOnDevice } from "./guru-audio";

class FakeAudio {
  static last: FakeAudio;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public src: string) {
    FakeAudio.last = this;
  }
  play = vi.fn(async () => {});
  pause = vi.fn();
  removeAttribute = vi.fn();
  load = vi.fn();
}
const payload = { audioBase64: "YQ==", contentType: "audio/mpeg" as const, expiresAt: null };
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("Audio", FakeAudio);
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("audio lifecycle", () => {
  it("doesn't complete when play resolves; cleans the URL on ended", async () => {
    const done = vi.fn();
    const playing = playGuruAudio(payload, new AbortController().signal).then(done);
    await Promise.resolve();
    expect(done).not.toHaveBeenCalled();
    FakeAudio.last.onended?.();
    await playing;
    expect(FakeAudio.last.pause).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test");
  });
  it("abort stops audio and releases temporary URLs exactly once", async () => {
    const controller = new AbortController();
    const playing = playGuruAudio(payload, controller.signal);
    const rejection = expect(playing).rejects.toMatchObject({ name: "AbortError" });
    controller.abort();
    await rejection;
    expect(FakeAudio.last.pause).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).toHaveBeenCalledOnce();
    expect(FakeAudio.last.onended).toBeNull();
  });
  it("pre-aborted requests never create an audio URL", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(playGuruAudio(payload, controller.signal)).rejects.toMatchObject({
      name: "AbortError",
    });
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
  it("device fallback waits for completion and abort cancels speech", async () => {
    const cancel = vi.fn();
    let utterance: { onend?: () => void; onerror?: () => void } = {};
    vi.stubGlobal(
      "SpeechSynthesisUtterance",
      class {
        constructor(public text: string) {}
      },
    );
    vi.stubGlobal("window", {
      speechSynthesis: {
        cancel,
        getVoices: () => [],
        speak: (value: typeof utterance) => {
          utterance = value;
        },
      },
    });
    const controller = new AbortController();
    const done = vi.fn();
    const speaking = speakGuruOnDevice("Hi", "hi", controller.signal).then(done);
    await Promise.resolve();
    expect(done).not.toHaveBeenCalled();
    const rejection = expect(speaking).rejects.toMatchObject({ name: "AbortError" });
    controller.abort();
    await rejection;
    expect(cancel).toHaveBeenCalledTimes(2);
  });
});
