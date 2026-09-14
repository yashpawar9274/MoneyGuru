import { useSyncExternalStore, type ReactNode } from "react";
import type { GuruRecognizer } from "../../src/lib/guru-voice-controller";
import type { GuruLanguage } from "../../src/lib/guru-contract";

export const fixture = {
  plan: "pro",
  mic: "denied",
  starts: 0,
  aborts: 0,
  playback: 0,
  requests: [] as { kind: string; lang?: string }[],
  rec: null as GuruRecognizer | null,
};
export function setPlan(plan: string) {
  fixture.plan = plan;
  window.dispatchEvent(new Event("guru-test-plan"));
}
export function useAuth() {
  const plan = useSyncExternalStore(
    (cb) => {
      window.addEventListener("guru-test-plan", cb);
      return () => window.removeEventListener("guru-test-plan", cb);
    },
    () => fixture.plan,
  );
  return {
    user: plan === "signed-out" ? null : { id: "synthetic-user" },
    subscription: {
      plan: plan === "expired" || plan === "canceled" ? "pro" : plan,
      status: plan === "canceled" ? "canceled" : "active",
      current_period_end:
        plan === "lifetime"
          ? null
          : new Date(Date.now() + (plan === "expired" ? -60000 : 3600000)).toISOString(),
    },
  };
}
export const useI18n = () => ({ lang: "en" });
export const useServerFn = <T,>(fn: T): T => fn;
export function Link({
  to,
  children,
  ...props
}: {
  to: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <a href={to} {...props}>
      {children}
    </a>
  );
}
function premium() {
  return ["weekly", "pro", "lifetime"].includes(fixture.plan);
}
export async function getGuruAccess() {
  fixture.requests.push({ kind: "access" });
  return premium()
    ? { ok: true, value: { expiresAt: null, speechAvailable: true } }
    : { ok: false, code: "PREMIUM_REQUIRED", message: "Synthetic expired plan" };
}
export async function guruTalk({ data }: { data: { lang: GuruLanguage } }) {
  fixture.requests.push({ kind: "chat", lang: data.lang });
  if (!premium()) return { ok: false, code: "PREMIUM_REQUIRED", message: "Synthetic expired plan" };
  await new Promise((resolve) => setTimeout(resolve, 300));
  const replies = {
    en: "Your recorded spending this month is 2,450 rupees. Food is your largest category at 1,200 rupees.",
    hi: "इस महीने आपके रिकॉर्ड में 2,450 रुपये खर्च हैं। खाने पर सबसे ज़्यादा 1,200 रुपये खर्च हुए।",
    hinglish:
      "इस month आपका recorded spending 2,450 रुपये है। Food पर सबसे ज़्यादा 1,200 रुपये spend हुए।",
    auto: "Your recorded spending this month is 2,450 rupees.",
  };
  return {
    ok: true,
    value: {
      reply: replies[data.lang],
      language: data.lang === "auto" ? "en" : data.lang,
      expiresAt: null,
      remainingToday: 59,
    },
  };
}
export async function guruSpeak() {
  fixture.requests.push({ kind: "speech" });
  return {
    ok: true,
    value: { audioBase64: "fixture", contentType: "audio/mpeg", expiresAt: null },
  };
}
export async function playGuruAudio(_audio: unknown, signal: AbortSignal) {
  fixture.playback++;
  try {
    await new Promise<void>((resolve) => {
      const finish = () => {
        clearTimeout(timer);
        signal.removeEventListener("abort", finish);
        resolve();
      };
      const timer = setTimeout(finish, 500);
      signal.addEventListener("abort", finish, { once: true });
      if (signal.aborted) finish();
    });
  } finally {
    fixture.playback--;
  }
}
export const speakGuruOnDevice = playGuruAudio;

class TestRecognition implements GuruRecognizer {
  lang = "";
  continuous = false;
  interimResults = false;
  onstart: GuruRecognizer["onstart"] = null;
  onend: GuruRecognizer["onend"] = null;
  onerror: GuruRecognizer["onerror"] = null;
  onresult: GuruRecognizer["onresult"] = null;
  start() {
    fixture.starts++;
    fixture.rec = this;
    if (fixture.mic === "denied") queueMicrotask(() => this.onerror?.({ error: "not-allowed" }));
    else this.onstart?.();
  }
  abort() {
    fixture.aborts++;
    if (fixture.rec === this) fixture.rec = null;
  }
}
Object.assign(window, { SpeechRecognition: TestRecognition, guruFixture: fixture });
