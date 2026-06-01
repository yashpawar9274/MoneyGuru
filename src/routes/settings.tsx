import { createFileRoute } from "@tanstack/react-router";
import { LANGS, useI18n, type Lang } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { Check, Trash2 } from "lucide-react";
import { toast } from "sonner";

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
        <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/40 mb-2">Voice</p>
        <p className="text-xs text-foreground/60 leading-relaxed">
          AI coach uses ElevenLabs voice when an API key is configured, otherwise falls back to your device's built-in voice.
        </p>
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
