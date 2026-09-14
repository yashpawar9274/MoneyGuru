<<<<<<< HEAD
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Crown, LockKeyhole, Mic, Send, Square, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { getGuruAccess, guruTalk } from "@/lib/guru-chat.functions";
import { guruSpeak } from "@/lib/guru-speech.functions";
import { hasActivePremium } from "@/lib/premium";
import { getVoiceLang } from "@/lib/voices";
import { playGuruAudio, speakGuruOnDevice } from "@/lib/guru-audio";
import {
  GuruVoiceController,
  EMPTY_VOICE,
  type GuruRecognizer,
  type GuruState,
} from "@/lib/guru-voice-controller";
import type { GuruLanguage } from "@/lib/guru-contract";
import { setGuruVoiceFocus } from "@/lib/voice-focus";

const LABELS: Record<GuruState, string> = {
  off: "Ready to talk",
  connecting: "Connecting",
  listening: "Listening",
  thinking: "Thinking",
  speaking: "Speaking",
  connected: "Connected",
  microphone_denied: "Microphone denied",
  offline: "Offline",
};

export function LiveVoiceChat() {
  const { user, subscription } = useAuth();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  if (!user || !hasActivePremium(subscription, now)) return <GuruPremiumPreview />;
  return <VoiceConversation key={user.id} />;
}

export function GuruPremiumPreview() {
  return (
    <section
      aria-label="Guru Voice AI Premium"
      className="rounded-3xl border border-neon/25 bg-gradient-to-br from-neon/10 to-accent/10 p-6 text-center"
    >
      <div className="mx-auto grid size-16 place-items-center rounded-full bg-neon/15 text-neon">
        <Mic className="size-7" />
      </div>
      <p className="mt-4 text-[10px] font-bold uppercase tracking-widest text-neon">
        New · Premium
      </p>
      <h2 className="mt-1 text-xl font-display font-bold">Guru Voice AI</h2>
      <p className="mt-2 text-sm leading-relaxed text-foreground/70">
        Your money. Your questions. A voice that helps you make sense of both.
      </p>
      <p className="mt-3 text-xs text-foreground/60">
        Hindi · Hinglish · English
        <br />
        For active Weekly, Pro and Lifetime plans.
      </p>
      <Link
        to="/pricing"
        className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-neon px-5 py-3 text-sm font-bold text-neon-foreground"
      >
        <LockKeyhole className="size-4" />
        Unlock Premium
      </Link>
    </section>
  );
}

export function VoiceConversation() {
  const { lang: appLanguage } = useI18n();
  const access = useServerFn(getGuruAccess);
  const talk = useServerFn(guruTalk);
  const speech = useServerFn(guruSpeak);
  const [language, setLanguage] = useState<GuruLanguage>("auto");
  const [state, setState] = useState(EMPTY_VOICE);
  const [draft, setDraft] = useState("");
  const controller = useRef<GuruVoiceController | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const actualLanguage = language === "auto" ? (appLanguage === "hi" ? "hi" : "en") : language;

  useEffect(() => {
    const preference = getVoiceLang();
    if (preference === "hi" || preference === "en") setLanguage(preference);
  }, []);
  useEffect(() => {
    let heartbeatRequest: AbortController | null = null;
    const voice = new GuruVoiceController(
      {
        access: (signal) => access({ signal }),
        talk: (messages, lang, signal) => talk({ data: { messages, lang }, signal }),
        speech: (text, lang, signal) => speech({ data: { text, lang }, signal }),
        play: playGuruAudio,
        deviceSpeak: speakGuruOnDevice,
        recognizer: () => {
          const w = window as unknown as {
            SpeechRecognition?: new () => GuruRecognizer;
            webkitSpeechRecognition?: new () => GuruRecognizer;
          };
          const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
          return Ctor ? new Ctor() : null;
        },
        online: () => navigator.onLine,
        secure: () => window.isSecureContext,
        changed: (snapshot) => {
          if (!snapshot.live) heartbeatRequest?.abort();
          setState(snapshot);
          setGuruVoiceFocus(
            snapshot.live || ["connecting", "thinking", "speaking"].includes(snapshot.state),
          );
        },
      },
      "en",
    );
    controller.current = voice;
    const offline = () => voice.setOffline();
    const online = () => voice.setOnline();
    const hidden = () => {
      if (document.hidden) voice.stop("Conversation paused while the app is in the background.");
    };
    const pagehide = () => voice.stop();
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    window.addEventListener("pagehide", pagehide);
    document.addEventListener("visibilitychange", hidden);
    const heartbeat = setInterval(() => {
      if (!voice.snapshot.live || heartbeatRequest) return;
      const request = new AbortController();
      heartbeatRequest = request;
      void access({ signal: request.signal })
        .then((result) => {
          if (request.signal.aborted || !voice.snapshot.live) return;
          if (!result.ok && result.code === "PREMIUM_REQUIRED") voice.revokeAccess();
        })
        .catch(() => {
          if (!request.signal.aborted && voice.snapshot.live)
            voice.stop("Could not recheck access. Please reconnect.");
        })
        .finally(() => {
          if (heartbeatRequest === request) heartbeatRequest = null;
        });
    }, 30000);
    return () => {
      clearInterval(heartbeat);
      heartbeatRequest?.abort();
      voice.dispose();
      controller.current = null;
      setGuruVoiceFocus(false);
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
      window.removeEventListener("pagehide", pagehide);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [access, talk, speech]);
  useEffect(() => {
    controller.current?.setLanguage(actualLanguage);
  }, [actualLanguage, access, talk, speech]);
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [state.turns, state.partial]);

  if (state.premiumDenied) return <GuruPremiumPreview />;
  const busy = ["connecting", "thinking", "speaking"].includes(state.state);
  const animated = state.state === "listening" || state.state === "speaking";
  const send = () => {
    if (draft.trim() && !busy) {
      void controller.current?.send(draft);
      setDraft("");
    }
  };

  return (
    <section
      aria-label="Guru Voice AI Premium"
      className="overflow-hidden rounded-3xl border border-neon/30 bg-card"
    >
      <div className="bg-gradient-to-br from-neon/10 via-card to-accent/10 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-bold">Guru Voice AI</h2>
          <span className="flex items-center gap-1 rounded-full bg-neon/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-neon">
            <Crown className="size-3" />
            Premium
          </span>
        </div>
        <p className="mt-1 text-xs text-foreground/60">Your personal AI money conversation</p>
        <div className="my-6 flex flex-col items-center gap-3">
          <div
            aria-hidden="true"
            className={`grid size-24 place-items-center rounded-full border border-neon/40 bg-neon/10 text-neon ${animated ? "motion-safe:animate-pulse" : ""}`}
          >
            <div className="flex h-10 items-center gap-1.5">
              {[12, 25, 38, 25, 12].map((height, i) => (
                <span
                  key={i}
                  style={{ height, animationDelay: `${i * 110}ms` }}
                  className={`w-1.5 rounded-full bg-neon ${animated ? "motion-safe:animate-pulse" : ""}`}
                />
              ))}
            </div>
          </div>
          <p role="status" aria-live="polite" className="text-sm font-semibold text-neon">
            {LABELS[state.state]}
          </p>
        </div>
        <label className="flex items-center justify-between gap-3 text-xs text-foreground/70">
          Conversation language
          <select
            aria-label="Conversation language"
            value={language}
            onChange={(e) => setLanguage(e.target.value as GuruLanguage)}
            className="min-h-11 rounded-xl border border-border bg-secondary px-3 text-sm text-foreground"
          >
            <option value="auto">App language</option>
            <option value="hi">हिंदी</option>
            <option value="hinglish">Hinglish</option>
            <option value="en">English</option>
          </select>
        </label>
        <button
          type="button"
          onClick={() =>
            state.live || busy ? controller.current?.stop() : void controller.current?.start()
          }
          className={`mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-bold ${state.live || busy ? "bg-secondary text-foreground" : "bg-neon text-neon-foreground"}`}
        >
          {state.live || busy ? (
            <>
              <Square className="size-4" />
              End Conversation
            </>
          ) : (
            <>
              <Mic className="size-4" />
              Start Conversation
            </>
          )}
        </button>
        <p className="mt-3 text-center text-[11px] leading-relaxed text-foreground/55">
          Microphone starts only when you tap Start. Speech recognition may use your browser's voice
          service. Questions and limited finance context are processed by AI providers.
        </p>
      </div>
      <div className="border-t border-border p-4">
        {state.message && (
          <p
            role="status"
            className="mb-3 rounded-xl bg-secondary p-3 text-xs leading-relaxed text-foreground/80"
          >
            {state.message}
          </p>
        )}
        <div
          ref={scroller}
          role="log"
          aria-label="Conversation transcript"
          aria-live="polite"
          className="max-h-72 space-y-3 overflow-y-auto"
        >
          {!state.turns.length && (
            <p className="px-1 py-3 text-sm text-foreground/60">
              “Is month kitna kharch hua?”
              <br />
              “Mujhe kitni udhari deni baaki hai?”
            </p>
          )}
          {state.turns.map((turn, index) => (
            <div
              key={index}
              className={`max-w-[92%] break-words rounded-2xl px-3 py-2.5 text-sm leading-relaxed ${turn.role === "user" ? "ml-auto bg-secondary" : "bg-neon/10"}`}
            >
              <p className="mb-1 text-[10px] font-bold uppercase text-foreground/50">
                {turn.role === "user" ? "You" : "Guru · AI"}
              </p>
              {turn.content}
            </div>
          ))}
          {state.partial && (
            <p className="ml-auto max-w-[92%] break-words rounded-2xl bg-secondary/50 px-3 py-2 text-sm italic text-foreground/65">
              {state.partial}
            </p>
          )}
        </div>
        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <input
            aria-label="Ask Guru a question"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={1000}
            placeholder="Or type your question…"
            className="min-w-0 flex-1 rounded-full border border-border bg-secondary px-4 py-3 text-sm outline-none focus:border-neon"
          />
          <button
            type="submit"
            aria-label="Send question"
            disabled={busy || !draft.trim() || state.state === "offline"}
            className="grid size-12 shrink-0 place-items-center rounded-full bg-neon text-neon-foreground disabled:opacity-40"
          >
            <Send className="size-4" />
          </button>
        </form>
        <div className="mt-3 flex items-center justify-between gap-2 text-[10px] text-foreground/55">
          <span>
            {state.remaining === null
              ? "Up to 60 turns/day · fair use"
              : `${state.remaining} turns left today`}
          </span>
          <button
            type="button"
            onClick={() => controller.current?.clear()}
            className="flex min-h-11 items-center gap-1 px-2"
            aria-label="Clear conversation"
          >
            <Trash2 className="size-3" />
            Clear
          </button>
        </div>
        <p className="text-[10px] leading-relaxed text-foreground/45">
          Session-only transcript. No recordings or transcripts saved by this app. Provider
          retention policies apply. AI can be wrong; check important figures.
        </p>
      </div>
    </section>
=======
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
>>>>>>> 19a84892e6f43cd67650f8aa890fa56bd5a38256
  );
}
