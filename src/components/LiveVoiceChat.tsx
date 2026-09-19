import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Crown, Loader2, Mic, Send, Square, Volume2, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getGuruAccess, guruSpeech, guruTalk } from "@/lib/guru-chat.functions";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { toSpeakable } from "@/lib/speech";

type Turn = { role: "user" | "assistant"; content: string };
type VoiceState = "off" | "connecting" | "connected" | "listening" | "thinking" | "speaking" | "denied" | "offline";
type Recognizer = { start(): void; abort(): void; lang: string; continuous: boolean; interimResults: boolean; onresult: ((event: any) => void) | null; onerror: ((event: any) => void) | null; onend: (() => void) | null };

function recognizerFor(lang: "en" | "hi"): Recognizer | null {
  const browser = window as typeof window & { SpeechRecognition?: new () => Recognizer; webkitSpeechRecognition?: new () => Recognizer };
  const Constructor = browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
  if (!Constructor) return null;
  const recognizer = new Constructor();
  recognizer.lang = lang === "hi" ? "hi-IN" : "en-IN";
  recognizer.continuous = false;
  recognizer.interimResults = true;
  return recognizer;
}

export function LiveVoiceChat() {
  const { isPro } = useAuth();
  const { lang } = useI18n();
  const language: "en" | "hi" = lang === "hi" ? "hi" : "en";
  const talk = useServerFn(guruTalk);
  const makeSpeech = useServerFn(guruSpeech);
  const checkAccess = useServerFn(getGuruAccess);
  const [state, setState] = useState<VoiceState>(navigator.onLine ? "off" : "offline");
  const [partial, setPartial] = useState("");
  const [draft, setDraft] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const liveRef = useRef(false);
  const turnsRef = useRef<Turn[]>([]);
  const recognizerRef = useRef<Recognizer | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);

  useEffect(() => { turnsRef.current = turns; }, [turns]);
  useEffect(() => { transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: "smooth" }); }, [turns, partial, state]);
  useEffect(() => {
    const online = () => setState(liveRef.current ? "connected" : "off");
    const offline = () => { stopConversation(); setState("offline"); };
    window.addEventListener("online", online); window.addEventListener("offline", offline);
    return () => { window.removeEventListener("online", online); window.removeEventListener("offline", offline); stopConversation(); };
  }, []);

  function stopAudio() {
    audioRef.current?.pause(); audioRef.current = null;
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = null;
    window.speechSynthesis?.cancel();
  }

  function stopConversation() {
    liveRef.current = false;
    try { recognizerRef.current?.abort(); } catch { /* already stopped */ }
    recognizerRef.current = null; stopAudio(); setPartial("");
    if (navigator.onLine) setState("off");
  }

  async function playReply(text: string) {
    setState("speaking");
    stopAudio();
    try {
      const result = await makeSpeech({ data: { text: toSpeakable(text, language), lang: language } });
      if (result.audioBase64) {
        const bytes = Uint8Array.from(atob(result.audioBase64), (character) => character.charCodeAt(0));
        const url = URL.createObjectURL(new Blob([bytes], { type: "audio/mpeg" }));
        audioUrlRef.current = url;
        const audio = new Audio(url); audioRef.current = audio;
        await new Promise<void>((resolve, reject) => { audio.onended = () => resolve(); audio.onerror = () => reject(new Error("audio")); void audio.play().catch(reject); });
        stopAudio(); return;
      }
    } catch { /* use device voice */ }
    await new Promise<void>((resolve) => {
      if (!("speechSynthesis" in window)) return resolve();
      const utterance = new SpeechSynthesisUtterance(toSpeakable(text, language));
      utterance.lang = language === "hi" ? "hi-IN" : "en-IN"; utterance.rate = 0.95;
      utterance.onend = () => resolve(); utterance.onerror = () => resolve();
      window.speechSynthesis.speak(utterance);
    });
  }

  async function send(text: string) {
    const clean = text.trim();
    if (!clean || state === "thinking" || state === "speaking") return;
    const next: Turn[] = [...turnsRef.current, { role: "user", content: clean }];
    setTurns(next); turnsRef.current = next; setDraft(""); setPartial(""); setState("thinking");
    try {
      const { reply } = await talk({ data: { messages: next.slice(-12), lang: language } });
      const completed: Turn[] = [...next, { role: "assistant", content: reply }];
      setTurns(completed); turnsRef.current = completed;
      if (liveRef.current) await playReply(reply);
      if (liveRef.current) startListening(); else setState("off");
    } catch (error) {
      setState(liveRef.current ? "connected" : "off");
      toast.error(error instanceof Error ? error.message : "Guru could not reply");
    }
  }

  function startListening() {
    if (!liveRef.current || recognizerRef.current) return;
    const recognizer = recognizerFor(language);
    if (!recognizer) { liveRef.current = false; setState("denied"); toast.error("Voice recognition is unavailable. You can still type."); return; }
    recognizerRef.current = recognizer;
    let finalText = "";
    recognizer.onresult = (event: any) => {
      let interimText = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const text = String(event.results[index][0].transcript);
        if (event.results[index].isFinal) finalText += text; else interimText += text;
      }
      setPartial(finalText + interimText);
    };
    recognizer.onerror = (event: any) => {
      recognizerRef.current = null;
      if (event.error === "not-allowed" || event.error === "service-not-allowed") { liveRef.current = false; setState("denied"); }
      else if (liveRef.current) setState("connected");
    };
    recognizer.onend = () => {
      recognizerRef.current = null; setPartial("");
      if (finalText.trim()) void send(finalText); else if (liveRef.current) setTimeout(startListening, 250);
    };
    try { recognizer.start(); setState("listening"); } catch { recognizerRef.current = null; setState("connected"); }
  }

  async function startConversation() {
    if (!navigator.onLine) return setState("offline");
    setState("connecting");
    try {
      await checkAccess();
      const stream = await navigator.mediaDevices?.getUserMedia({ audio: true });
      stream?.getTracks().forEach((track) => track.stop());
      liveRef.current = true; setState("connected"); startListening();
    } catch (error) {
      const denied = error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "SecurityError");
      setState(denied ? "denied" : "off");
      toast.error(denied ? "Microphone permission was denied." : error instanceof Error ? error.message : "Guru could not connect");
    }
  }

  if (!isPro) return <section className="overflow-hidden rounded-2xl border border-neon/25 bg-card p-5">
    <div className="flex items-center gap-2 text-neon"><Crown className="size-4"/><p className="text-[10px] font-bold uppercase tracking-widest">Guru Voice AI · Premium</p></div>
    <h2 className="mt-3 text-xl font-display font-bold">Talk through your money decisions</h2>
    <p className="mt-2 text-sm leading-relaxed text-foreground/60">Ask in Hindi, Hinglish, or English. Guru answers from your real spending, Udhari, and EMI data.</p>
    <Button asChild className="mt-4 w-full"><Link to="/pricing">Unlock Premium</Link></Button>
  </section>;

  const active = liveRef.current;
  return <section className="rounded-2xl border border-neon/25 bg-card p-4">
    <div className="flex items-center justify-between"><p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-neon"><Crown className="size-3.5"/> Guru Voice AI · Premium</p><span className="text-[10px] font-bold uppercase tracking-wider text-foreground/45">{state}</span></div>
    <div className="my-5 flex flex-col items-center">
      <div className={`relative grid size-24 place-items-center rounded-full border ${state === "listening" ? "border-neon bg-neon/10 neon-glow" : state === "speaking" ? "border-accent bg-accent/15" : "border-border bg-secondary"}`}>
        {(state === "listening" || state === "speaking") && <div className="absolute inset-0 animate-ping rounded-full border border-neon/40 motion-reduce:animate-none"/>}
        {state === "connecting" || state === "thinking" ? <Loader2 className="size-8 animate-spin text-neon"/> : state === "speaking" ? <Volume2 className="size-8 text-accent"/> : state === "offline" ? <WifiOff className="size-8 text-danger"/> : <Mic className="size-8 text-neon"/>}
      </div>
      <p className="mt-3 text-sm font-semibold">{state === "off" ? "Ready when you are" : state === "denied" ? "Microphone denied — type below" : state === "thinking" ? "Guru is thinking" : state === "speaking" ? "Guru is speaking" : state === "listening" ? "Listening…" : state === "connecting" ? "Connecting…" : state === "offline" ? "You are offline" : "Connected"}</p>
    </div>
    <div ref={transcriptRef} className="max-h-56 space-y-2 overflow-y-auto pr-1">
      {turns.length === 0 && !partial && <p className="text-center text-xs leading-relaxed text-foreground/45">Ask about spending, savings, Udhari, EMI, or what is safe to spend.</p>}
      {turns.map((turn, index) => <p key={`${turn.role}-${index}`} className={`max-w-[88%] rounded-xl px-3 py-2 text-sm ${turn.role === "user" ? "ml-auto bg-secondary" : "bg-neon/10 text-foreground/90"}`}>{turn.content}</p>)}
      {partial && <p className="ml-auto max-w-[88%] rounded-xl bg-secondary/60 px-3 py-2 text-sm italic text-foreground/65">{partial}</p>}
    </div>
    <div className="mt-4 flex items-center gap-2">
      <Button size="icon" variant={active ? "destructive" : "default"} onClick={() => active ? stopConversation() : void startConversation()} aria-label={active ? "End conversation" : "Start conversation"}>{active ? <Square/> : <Mic/>}</Button>
      <input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void send(draft); }} placeholder="Type your money question" className="min-w-0 flex-1 rounded-xl bg-secondary px-4 py-2.5 text-sm outline-none"/>
      <Button size="icon" variant="secondary" disabled={!draft.trim() || state === "thinking" || state === "speaking"} onClick={() => void send(draft)} aria-label="Send question"><Send/></Button>
    </div>
  </section>;
}