import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Mic, MicOff, Loader2, Radio, Send, Square } from "lucide-react";
import { toast } from "sonner";
import { guruTalk } from "@/lib/guru-chat.functions";
import { useStore, inRange, totals } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import { speakLine, type SpeakLang } from "@/lib/speech";

type Turn = { role: "user" | "assistant"; content: string };

type Recognizer = {
  start: () => void;
  stop: () => void;
  abort: () => void;
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
};

function createRecognizer(lang: string): Recognizer | null {
  const w = window as any;
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!Ctor) return null;
  const r: Recognizer = new Ctor();
  r.lang = lang;
  r.continuous = false;
  r.interimResults = true;
  return r;
}

const BCP47: Record<SpeakLang, string> = { en: "en-IN", hi: "hi-IN", es: "es-ES", fr: "fr-FR" };

export function LiveVoiceChat() {
  const { transactions } = useStore();
  const { lang } = useI18n();
  const talk = useServerFn(guruTalk);
  const speakLang = (["en", "hi", "es", "fr"].includes(lang) ? lang : "en") as SpeakLang;

  const [live, setLive] = useState(false);
  const [listening, setListening] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [partial, setPartial] = useState("");
  const [draft, setDraft] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const recRef = useRef<Recognizer | null>(null);
  const liveRef = useRef(false);
  const scroller = useRef<HTMLDivElement>(null);

  const snapshot = useMemo(() => {
    const month = inRange(transactions, 30);
    const t = totals(month);
    const byCat: Record<string, number> = {};
    for (const tx of month) {
      if (tx.type === "expense") byCat[tx.category] = (byCat[tx.category] ?? 0) + tx.amount;
    }
    return {
      income30: t.income,
      expense30: t.expense,
      topCategories: Object.entries(byCat)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([category, amount]) => ({ category, amount })),
    };
  }, [transactions]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [turns, thinking]);

  useEffect(() => () => stopAll(), []);

  function stopAll() {
    liveRef.current = false;
    setLive(false);
    setListening(false);
    setPartial("");
    try {
      recRef.current?.abort();
    } catch {
      /* already stopped */
    }
    recRef.current = null;
    try {
      speechSynthesis.cancel();
    } catch {
      /* not supported */
    }
  }

  async function send(text: string) {
    const clean = text.trim();
    if (!clean || thinking) return;
    const next: Turn[] = [...turns, { role: "user", content: clean }];
    setTurns(next);
    setDraft("");
    setThinking(true);
    try {
      const { reply } = await talk({
        data: { messages: next.slice(-12), lang: speakLang, ...snapshot },
      });
      setTurns([...next, { role: "assistant", content: reply }]);
      setThinking(false);
      await speakLine(reply, speakLang);
      if (liveRef.current) startListening();
    } catch (e) {
      setThinking(false);
      toast.error(e instanceof Error ? e.message : "Guru could not reply");
    }
  }

  function startListening() {
    if (recRef.current) return;
    const rec = createRecognizer(BCP47[speakLang]);
    if (!rec) {
      toast.error("Live voice needs Chrome or the Android app. Type instead.");
      liveRef.current = false;
      setLive(false);
      return;
    }
    recRef.current = rec;
    let final = "";
    rec.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const chunk = e.results[i][0].transcript as string;
        if (e.results[i].isFinal) final += chunk;
        else interim += chunk;
      }
      setPartial(final + interim);
    };
    rec.onerror = () => {
      setListening(false);
      recRef.current = null;
    };
    rec.onend = () => {
      setListening(false);
      recRef.current = null;
      const said = (final || partial).trim();
      setPartial("");
      if (said) void send(said);
      else if (liveRef.current) startListening();
    };
    try {
      rec.start();
      setListening(true);
    } catch {
      recRef.current = null;
    }
  }

  function toggleLive() {
    if (live) return stopAll();
    liveRef.current = true;
    setLive(true);
    startListening();
  }

  return (
    <div className="bg-card border border-neon/25 rounded-2xl p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-bold text-neon uppercase tracking-widest flex items-center gap-1.5">
          <Radio className={`size-3 ${live ? "animate-pulse" : ""}`} /> Live voice chat
        </p>
        <span className="text-[10px] uppercase tracking-wider text-foreground/50">
          {thinking ? "Guru thinking" : listening ? "Listening" : live ? "Connected" : "Off"}
        </span>
      </div>

      <div ref={scroller} className="mt-3 max-h-64 overflow-y-auto space-y-2 pr-1">
        {turns.length === 0 && !partial && (
          <p className="text-xs text-foreground/60 leading-relaxed">
            Start the mic and just talk — ask about your spending, savings or udhari. Guru replies
            out loud and keeps listening.
          </p>
        )}
        {turns.map((turn, i) => (
          <div
            key={i}
            className={`text-sm rounded-2xl px-3 py-2 max-w-[85%] ${
              turn.role === "user"
                ? "ml-auto bg-secondary text-foreground"
                : "bg-neon/10 text-foreground/90"
            }`}
          >
            {turn.content}
          </div>
        ))}
        {partial && (
          <div className="ml-auto max-w-[85%] text-sm rounded-2xl px-3 py-2 bg-secondary/60 text-foreground/70 italic">
            {partial}
          </div>
        )}
        {thinking && <Loader2 className="size-4 animate-spin text-neon" />}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={toggleLive}
          className={`size-11 rounded-full flex items-center justify-center shrink-0 ${
            live ? "bg-destructive text-destructive-foreground" : "bg-neon text-neon-foreground"
          }`}
          aria-label={live ? "Stop live voice" : "Start live voice"}
        >
          {live ? <MicOff className="size-5" /> : <Mic className="size-5" />}
        </button>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void send(draft)}
          placeholder="Or type your question"
          className="flex-1 bg-secondary rounded-full px-4 py-2.5 text-sm outline-none"
        />
        <button
          onClick={() => void send(draft)}
          disabled={!draft.trim() || thinking}
          className="size-11 rounded-full bg-secondary flex items-center justify-center shrink-0 disabled:opacity-40"
          aria-label="Send"
        >
          <Send className="size-4" />
        </button>
      </div>
      {live && (
        <button
          onClick={stopAll}
          className="mt-2 text-[10px] uppercase tracking-widest text-foreground/50 flex items-center gap-1"
        >
          <Square className="size-3" /> End conversation
        </button>
      )}
    </div>
  );
}
