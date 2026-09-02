import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Lock, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { getTrialVoiceLine } from "@/lib/trial-voice.functions";
import { getVoiceId, getElevenKey, getVoiceLang, bcp47 } from "@/lib/voices";

function fmt(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

async function speak(text: string, lang: string) {
  try {
    const r = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voiceId: getVoiceId(), userKey: getElevenKey() }),
    });
    if (!r.ok) throw new Error("tts");
    const audio = new Audio(URL.createObjectURL(await r.blob()));
    await audio.play();
  } catch {
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = bcp47(lang as "en" | "hi" | "es" | "fr");
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    } catch {
      /* voice unavailable */
    }
  }
}

/** 24h free-trial countdown pill + hard paywall lock with live AI voice announcement. */
export function TrialLock() {
  const { isPro, subscription, profile, activatePro } = useAuth();
  const { lang } = useI18n();
  const getLine = useServerFn(getTrialVoiceLine);
  const [now, setNow] = useState(() => Date.now());
  const [line, setLine] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const announced = useRef(false);
  const warned = useRef(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const endsAt = subscription?.trial_ends_at ? +new Date(subscription.trial_ends_at) : null;
  const left = endsAt ? endsAt - now : null;
  const locked = !isPro && left !== null && left <= 0;
  const spokenLang = getVoiceLang() === "auto" ? lang : (getVoiceLang() as "en" | "hi" | "es" | "fr");

  // Live announcement: fires the moment the trial flips to expired (or on load when locked).
  useEffect(() => {
    if (!locked || announced.current) return;
    announced.current = true;
    (async () => {
      const name = profile?.full_name?.trim() || "";
      try {
        const { line: l } = await getLine({ data: { name, lang: spokenLang, kind: "expired", minutesLeft: 0 } });
        setLine(l);
        await speak(l, spokenLang);
      } catch {
        const fb = `${name || "Sir ya Madam"}, aapka free trial khatam ho gaya hai. ₹100 ka 1 month subscription le lijiye.`;
        setLine(fb);
        await speak(fb, spokenLang);
      }
    })();
  }, [locked, getLine, profile?.full_name, spokenLang]);

  // Friendly heads-up in the last 10 minutes of the trial.
  useEffect(() => {
    if (locked || warned.current || left === null || left > 10 * 60_000 || left <= 0) return;
    warned.current = true;
    (async () => {
      try {
        const { line: l } = await getLine({
          data: {
            name: profile?.full_name?.trim() || "",
            lang: spokenLang,
            kind: "warning",
            minutesLeft: left / 60_000,
          },
        });
        toast(l, { icon: "⏳" });
        await speak(l, spokenLang);
      } catch {
        /* ignore */
      }
    })();
  }, [locked, left, getLine, profile?.full_name, spokenLang]);

  const upgrade = async () => {
    setBusy(true);
    try {
      await activatePro();
      toast.success("Pro activated — ₹100/month");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upgrade failed");
    } finally {
      setBusy(false);
    }
  };

  if (isPro || left === null) return null;

  if (!locked) {
    return (
      <div className="fixed top-2 left-1/2 -translate-x-1/2 z-40 rounded-full bg-card/90 backdrop-blur border border-border px-3 py-1.5 text-[11px] font-bold tracking-wide">
        <span className="text-foreground/50">FREE TRIAL</span>{" "}
        <span className={left < 60 * 60_000 ? "text-danger" : "text-neon"}>{fmt(left)}</span>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-md grid place-items-center px-6">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto size-16 rounded-2xl bg-danger/15 grid place-items-center">
          <Lock className="size-7 text-danger" />
        </div>
        <h1 className="mt-5 text-2xl font-display font-bold">Free trial khatam</h1>
        <p className="mt-2 text-sm text-foreground/60 leading-relaxed">
          Your 24-hour free access has ended. Unlock all features — tracking, analytics, bill scan, AI
          coach and udhari/EMI — for ₹100 per month.
        </p>

        {line && (
          <div className="mt-4 rounded-2xl bg-card p-4 text-left">
            <p className="text-[10px] font-bold uppercase tracking-widest text-neon flex items-center gap-1.5">
              <Volume2 className="size-3" /> AI Assistant
            </p>
            <p className="mt-1.5 text-sm text-foreground/85 leading-relaxed">{line}</p>
          </div>
        )}

        <button
          onClick={upgrade}
          disabled={busy}
          className="mt-5 w-full rounded-xl bg-neon py-3.5 text-sm font-bold text-neon-foreground active:scale-[0.98] transition-transform disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {busy && <Loader2 className="size-4 animate-spin" />}
          Subscribe — ₹100 / month
        </button>
        <button
          onClick={() => line && void speak(line, spokenLang)}
          className="mt-2 w-full rounded-xl border border-border py-2.5 text-sm font-semibold text-foreground/70"
        >
          Replay voice message
        </button>
      </div>
    </div>
  );
}
