import { createFileRoute } from "@tanstack/react-router";
import { LANGS, useI18n, type Lang } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { Check, Trash2, Volume2, KeyRound, Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { VOICES, getVoiceId, setVoiceId, getElevenKey, setElevenKey, getAutoSpeak, setAutoSpeak, VOICE_LANGS, getVoiceLang, setVoiceLang, type VoiceLang } from "@/lib/voices";

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
  const [keySource, setKeySource] = useState<"user" | "server" | null>(null);
  const [testing, setTesting] = useState(false);
  const [userKey, setUserKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [autoSpeak, setAutoSpeakState] = useState(true);

  useEffect(() => { setAutoSpeakState(getAutoSpeak()); }, []);

  const probe = (key?: string) =>
    fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "ok", voiceId: getVoiceId(), probe: true, userKey: key }),
    })
      .then(async (r) => {
        if (r.status === 503) { setKeyStatus("missing"); setKeySource(null); return; }
        const d = await r.json().catch(() => ({}));
        setKeyStatus("ok");
        setKeySource(d.source ?? "server");
      })
      .catch(() => setKeyStatus("missing"));

  useEffect(() => {
    setVoice(getVoiceId());
    const k = getElevenKey();
    setUserKey(k);
    probe(k);
  }, []);

  const saveKey = async () => {
    setElevenKey(userKey.trim());
    await probe(userKey.trim());
    toast.success(userKey.trim() ? "Key saved & verified" : "Key cleared");
  };

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
        body: JSON.stringify({ text: "Hey! This is your money coach. Let's stack some savings.", voiceId: id, userKey: getElevenKey() }),
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
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">Auto Voice Coach</p>
            <p className="text-xs text-foreground/60 mt-1 leading-relaxed">
              Har kharche aur income pe AI khud Hinglish me bol dega — button dabane ki zarurat nahi.
            </p>
          </div>
          <button
            onClick={() => { const n = !autoSpeak; setAutoSpeakState(n); setAutoSpeak(n); }}
            className={`shrink-0 w-12 h-7 rounded-full relative transition-colors ${autoSpeak ? "bg-neon" : "bg-secondary"}`}
            aria-label="Toggle auto voice"
          >
            <span className={`absolute top-1 size-5 rounded-full bg-background transition-all ${autoSpeak ? "left-6" : "left-1"}`} />
          </button>
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
            {keyStatus === "ok"
              ? keySource === "user" ? "YOUR KEY" : "CONNECTED"
              : keyStatus === "missing" ? "NOT SET" : "CHECKING…"}
          </span>
        </div>
        <p className="text-xs text-foreground/60 leading-relaxed mb-3">
          Paste your own ElevenLabs API key to use premium voices. Stored only on this device.
        </p>
        <div className="flex gap-2 mb-2">
          <div className="flex-1 relative">
            <input
              type={showKey ? "text" : "password"}
              value={userKey}
              onChange={(e) => setUserKey(e.target.value)}
              placeholder="sk_..."
              className="w-full bg-secondary/60 rounded-xl px-3 py-2.5 text-xs font-mono pr-9 focus:outline-none focus:ring-1 focus:ring-neon"
            />
            <button
              type="button"
              onClick={() => setShowKey((s) => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-foreground/40"
              aria-label={showKey ? "Hide" : "Show"}
            >
              {showKey ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            </button>
          </div>
          <button
            onClick={saveKey}
            className="px-4 py-2.5 rounded-xl bg-neon text-neon-foreground text-[10px] font-bold uppercase tracking-widest"
          >
            Save
          </button>
        </div>
        <a
          href="https://elevenlabs.io/app/settings/api-keys"
          target="_blank"
          rel="noreferrer"
          className="text-xs flex items-center gap-2 text-neon font-bold"
        >
          <KeyRound className="size-3.5" /> Get your API key →
        </a>
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
