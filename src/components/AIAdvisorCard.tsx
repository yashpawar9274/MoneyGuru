import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { Bot, Volume2, Loader2, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { getAiAdvice } from "@/lib/ai.functions";
import { useStore } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { getVoiceId } from "@/lib/voices";

export function AIAdvisorCard() {
  const { transactions } = useStore();
  const { lang, t } = useI18n();
  const fetchAdvice = useServerFn(getAiAdvice);
  const [playing, setPlaying] = useState(false);

  const advice = useMutation({
    mutationFn: () =>
      fetchAdvice({
        data: {
          transactions: transactions.slice(0, 80).map((tx) => ({
            type: tx.type, amount: tx.amount, category: tx.category, note: tx.note, date: tx.date,
          })),
          lang,
        },
      }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "AI error"),
  });

  const speak = async (text: string) => {
    setPlaying(true);
    try {
      const r = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voiceId: getVoiceId() }),
      });
      if (r.status === 503) {
        // fallback browser TTS
        const u = new SpeechSynthesisUtterance(text);
        u.lang = lang === "hi" ? "hi-IN" : lang;
        speechSynthesis.speak(u);
        u.onend = () => setPlaying(false);
        return;
      }
      if (!r.ok) throw new Error(await r.text());
      const blob = await r.blob();
      const audio = new Audio(URL.createObjectURL(blob));
      audio.onended = () => setPlaying(false);
      await audio.play();
    } catch (e) {
      setPlaying(false);
      toast.error(e instanceof Error ? e.message : "Playback failed");
    }
  };

  const result = advice.data;
  const level = result?.alertLevel ?? "good";
  const accent = level === "danger" ? "border-destructive/40" : level === "watch" ? "border-accent/40" : "border-neon/30";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className={`bg-card border ${accent} p-4 rounded-2xl relative overflow-hidden`}
    >
      <div className="absolute -top-10 -right-10 size-24 bg-neon/20 blur-3xl rounded-full" />
      <div className="flex items-start gap-3 relative">
        <div className="mt-0.5 size-9 bg-neon/10 rounded-xl flex items-center justify-center shrink-0">
          <Bot className="size-5 text-neon" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold text-neon uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
            <Sparkles className="size-3" /> {t("aiCoach")}
          </p>
          {result ? (
            <p className="text-sm text-foreground/90 leading-relaxed">{result.message}</p>
          ) : advice.isPending ? (
            <p className="text-xs text-foreground/60 italic">{t("thinking")}</p>
          ) : (
            <p className="text-xs text-foreground/70 leading-relaxed">
              Tap to get personalized savings tips based on your spending.
            </p>
          )}
          <div className="mt-3 flex gap-2 flex-wrap">
            <button
              onClick={() => advice.mutate()}
              disabled={advice.isPending}
              className="text-[10px] bg-neon text-neon-foreground px-3 py-1.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1 disabled:opacity-50"
            >
              {advice.isPending && <Loader2 className="size-3 animate-spin" />}
              {t("askAI")}
            </button>
            {result?.message && (
              <button
                onClick={() => speak(result.message)}
                disabled={playing}
                className="text-[10px] bg-secondary px-3 py-1.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1.5 disabled:opacity-50"
              >
                <Volume2 className="size-3" /> {t("listen")}
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
