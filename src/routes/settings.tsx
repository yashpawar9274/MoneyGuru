import { createFileRoute } from "@tanstack/react-router";
import { LANGS, useI18n, type Lang } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { Check, Trash2, Volume2, KeyRound, Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { VOICES, getVoiceId, setVoiceId, getElevenKey, setElevenKey } from "@/lib/voices";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — MONEY.FYI" },
      { name: "description", content: "Language, voice, and data settings." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { lang, setLang, t } = useI18n();
  const { clearAll, transactions } = useStore();
  const [voice, setVoice] = useState<string>(VOICES[0].id);
  const [keyStatus, setKeyStatus] = useState<"unknown" | "ok" | "missing">("unknown");
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    setVoice(getVoiceId());
    // probe server for key presence
    fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "ok", voiceId: getVoiceId(), probe: true }),
    }).then((r) => setKeyStatus(r.status === 503 ? "missing" : "ok")).catch(() => setKeyStatus("missing"));
  }, []);

  const pickVoice = (id: string) => {
    setVoice(id);
    setVoiceId(id);
    toast.success("Voice updated");
  };

  const previewVoice = async (id: string) => {
    setTesting(true);
    try {
      const r = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Hey! This is your money coach. Let's stack some savings.", voiceId: id }),
      });
      if (r.status === 503) {
        const u = new SpeechSynthesisUtterance("Add your ElevenLabs key in settings for premium voice.");
        speechSynthesis.speak(u);
        toast.error("ElevenLabs key not set");
        return;
      }
      if (!r.ok) throw new Error(await r.text());
      const audio = new Audio(URL.createObjectURL(await r.blob()));
      await audio.play();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="px-5 pt-6">
      <header className="mb-6">
        <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">{t("settings")}</p>
        <h1 className="text-2xl font-display font-bold mt-1">Make it yours</h1>
      </header>

      <section className="bg-card rounded-2xl p-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/40 mb-3">{t("language")}</p>
        <div className="space-y-1">
          {LANGS.map((l) => (
            <button
              key={l.id}
              onClick={() => setLang(l.id as Lang)}
              className="w-full flex items-center justify-between py-3 px-3 rounded-xl hover:bg-secondary/50"
            >
              <span className="text-sm">{l.native} <span className="text-foreground/40 ml-2">{l.label}</span></span>
              {lang === l.id && <Check className="size-4 text-neon" />}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-4 bg-card rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">ElevenLabs API Key</p>
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              keyStatus === "ok"
                ? "bg-neon/20 text-neon"
                : keyStatus === "missing"
                ? "bg-danger/20 text-danger"
                : "bg-secondary text-foreground/50"
            }`}
          >
            {keyStatus === "ok" ? "CONNECTED" : keyStatus === "missing" ? "NOT SET" : "CHECKING…"}
          </span>
        </div>
        <p className="text-xs text-foreground/60 leading-relaxed mb-3">
          Add your ElevenLabs API key to unlock premium AI coach voices. Without it, the app uses your device's built-in voice.
        </p>
        <a
          href="https://elevenlabs.io/app/settings/api-keys"
          target="_blank"
          rel="noreferrer"
          className="text-xs flex items-center gap-2 text-neon font-bold mb-2"
        >
          <KeyRound className="size-3.5" /> Get your API key →
        </a>
        <p className="text-[10px] text-foreground/40 leading-relaxed">
          Then ask the AI in chat: <span className="text-foreground/70">"Add my ElevenLabs API key"</span> — Lovable will securely save it as <span className="font-mono">ELEVENLABS_API_KEY</span>.
        </p>
      </section>

      <section className="mt-4 bg-card rounded-2xl p-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/40 mb-3">Premium Voice</p>
        <div className="space-y-1">
          {VOICES.map((v) => (
            <div key={v.id} className="flex items-center gap-2">
              <button
                onClick={() => pickVoice(v.id)}
                className="flex-1 flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-secondary/50"
              >
                <span className="text-sm">
                  {v.name} <span className="text-foreground/40 ml-2 text-xs">{v.desc}</span>
                </span>
                {voice === v.id && <Check className="size-4 text-neon" />}
              </button>
              <button
                onClick={() => previewVoice(v.id)}
                disabled={testing}
                className="size-9 shrink-0 rounded-xl bg-secondary flex items-center justify-center disabled:opacity-50"
                aria-label={`Preview ${v.name}`}
              >
                {testing ? <Loader2 className="size-4 animate-spin" /> : <Volume2 className="size-4 text-neon" />}
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-4 bg-card rounded-2xl p-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/40 mb-2">Data</p>
        <p className="text-xs text-foreground/60 mb-3">{transactions.length} transactions stored locally on this device.</p>
        <button
          onClick={() => {
            if (confirm("Clear all transactions?")) {
              clearAll();
              toast.success("Cleared");
            }
          }}
          className="text-xs flex items-center gap-2 text-danger font-bold"
        >
          <Trash2 className="size-4" /> Clear all data
        </button>
      </section>

      <p className="text-center text-[10px] text-foreground/30 mt-8 uppercase tracking-widest font-bold">
        MONEY.FYI · v1.0
      </p>
    </div>
  );
}
