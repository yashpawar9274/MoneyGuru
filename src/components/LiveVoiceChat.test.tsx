// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { LiveVoiceChat } from "./LiveVoiceChat";

const api = vi.hoisted(() => ({ access: vi.fn(), talk: vi.fn(), speech: vi.fn(), play: vi.fn() }));
const account = vi.hoisted(() => ({
  user: { id: "fixture-owner" } as { id: string } | null,
  subscription: { plan: "pro", status: "active", current_period_end: "2099-01-01T00:00:00Z" },
}));
vi.mock("@/lib/auth", () => ({ useAuth: () => account }));
vi.mock("@/lib/i18n", () => ({ useI18n: () => ({ lang: "en" }) }));
vi.mock("@/lib/voices", () => ({ getVoiceLang: () => "auto" }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: <T,>(fn: T) => fn }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("@/lib/guru-chat.functions", () => ({ getGuruAccess: api.access, guruTalk: api.talk }));
vi.mock("@/lib/guru-speech.functions", () => ({ guruSpeak: api.speech }));
vi.mock("@/lib/guru-audio", () => ({ playGuruAudio: api.play, speakGuruOnDevice: api.play }));

beforeEach(() => {
  vi.clearAllMocks();
  account.user = { id: "fixture-owner" };
  account.subscription = {
    plan: "pro",
    status: "active",
    current_period_end: "2099-01-01T00:00:00Z",
  };
  api.access.mockResolvedValue({ ok: true, value: { expiresAt: null, speechAvailable: true } });
  api.talk.mockResolvedValue({
    ok: true,
    value: {
      reply: "Your recorded expense is 100 rupees.",
      language: "en",
      expiresAt: null,
      remainingToday: 59,
    },
  });
  api.speech.mockResolvedValue({
    ok: true,
    value: { audioBase64: "YQ==", contentType: "audio/mpeg", expiresAt: null },
  });
  api.play.mockResolvedValue(undefined);
  Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
  Element.prototype.scrollTo = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Guru premium panel", () => {
  it.each(["free", "expired", "canceled", "past_due", "signed-out"])(
    "shows an upgrade preview for %s with no AI call",
    (kind) => {
      if (kind === "free") account.subscription.plan = "free";
      if (kind === "expired") account.subscription.current_period_end = "2000-01-01T00:00:00Z";
      if (kind === "canceled" || kind === "past_due") account.subscription.status = kind;
      if (kind === "signed-out") account.user = null;
      render(<LiveVoiceChat />);
      expect(screen.getByRole("link", { name: "Unlock Premium" }).getAttribute("href")).toBe(
        "/pricing",
      );
      expect(screen.queryByRole("button", { name: "Start Conversation" })).toBeNull();
      expect(api.access).not.toHaveBeenCalled();
      expect(api.talk).not.toHaveBeenCalled();
    },
  );
  it.each(["weekly", "pro", "lifetime"])(
    "allows %s without starting the microphone on mount",
    (plan) => {
      account.subscription.plan = plan;
      render(<LiveVoiceChat />);
      expect(screen.getByRole("button", { name: "Start Conversation" })).toBeTruthy();
      expect(api.access).not.toHaveBeenCalled();
    },
  );
  it.each(["en", "hi", "hinglish"])(
    "submits typed %s questions, renders real response text, and clears the session",
    async (lang) => {
      render(<LiveVoiceChat />);
      fireEvent.change(screen.getByLabelText("Conversation language"), { target: { value: lang } });
      fireEvent.change(screen.getByLabelText("Ask Guru a question"), {
        target: { value: "How much did I spend?" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Send question" }));
      await waitFor(() =>
        expect(screen.getByText("Your recorded expense is 100 rupees.")).toBeTruthy(),
      );
      await waitFor(() => expect(api.play).toHaveBeenCalledOnce());
      const input = api.talk.mock.calls[0][0].data;
      expect(input).toEqual({
        messages: [{ role: "user", content: "How much did I spend?" }],
        lang,
      });
      expect(api.access).not.toHaveBeenCalled(); // Typed flow never starts speech recognition.
      fireEvent.click(screen.getByRole("button", { name: "Clear conversation" }));
      expect(screen.queryByText("Your recorded expense is 100 rupees.")).toBeNull();
    },
  );
  it("has a typed fallback when this browser has no recognition", async () => {
    render(<LiveVoiceChat />);
    fireEvent.click(screen.getByRole("button", { name: "Start Conversation" }));
    await waitFor(() => expect(screen.getByText(/Speech recognition is unavailable/)).toBeTruthy());
    expect(screen.getByLabelText("Ask Guru a question")).toBeTruthy();
  });
  it("unmount aborts in-flight response/audio and cannot play a late answer", async () => {
    let resolve!: (value: unknown) => void;
    api.talk.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const view = render(<LiveVoiceChat />);
    fireEvent.change(screen.getByLabelText("Ask Guru a question"), { target: { value: "Hi" } });
    fireEvent.click(screen.getByRole("button", { name: "Send question" }));
    const signal = api.talk.mock.calls[0][0].signal as AbortSignal;
    view.unmount();
    expect(signal.aborted).toBe(true);
    await act(async () =>
      resolve({ ok: true, value: { reply: "Late reply", language: "en", expiresAt: null } }),
    );
    expect(api.speech).not.toHaveBeenCalled();
  });
});
