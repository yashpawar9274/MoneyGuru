import { useEffect, useRef, useState } from "react";
import { Check, Mic, PhoneOff, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { CATEGORIES, type Category, type TxType } from "@/lib/types";
import { supabase } from "@/integrations/supabase/client";
import { getGeminiKey } from "@/lib/voices";

type PendingAction = { type: TxType; amount: number; category: Category; note: string };
type LiveMessage = { serverContent?: { inputTranscription?: { text?: string }; outputTranscription?: { text?: string }; modelTurn?: { parts?: Array<{ inlineData?: { data?: string } }> } } };

function decodeBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function encodeBase64(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

function toPcm16(input: Float32Array) {
  const pcm = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) pcm[i] = Math.max(-1, Math.min(1, input[i]!)) * 32767;
  return new Uint8Array(pcm.buffer);
}

function parseExpense(text: string): PendingAction | null {
  const amount = text.match(/(?:₹|rs\.?|rupees?)\s*([\d,]+)|\b([\d,]+)\s*(?:rupees?|rs\.?)/i);
  if (!amount) return null;
  const value = Number((amount[1] || amount[2]).replace(/,/g, ""));
  if (!Number.isFinite(value) || value <= 0) return null;
  const lower = text.toLowerCase();
  const type: TxType = /income|salary|received|kamaya|mila|aaya/.test(lower) ? "income" : "expense";
  const category = (CATEGORIES.find((item) => lower.includes(item.id.replace("_", " ")) && item.kind === type)?.id ?? (type === "income" ? "other" : "other")) as Category;
  return { type, amount: value, category, note: text.trim() };
}

export function GeminiLiveAssistant() {
  const { isPro } = useAuth();
  const { addTransaction } = useStore();
  const [open, setOpen] = useState(false);
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState("Tap start to talk");
  const [transcript, setTranscript] = useState("");
  const [pending, setPending] = useState<PendingAction | null>(null);
  const socket = useRef<WebSocket | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const inputStream = useRef<MediaStream | null>(null);
  const processor = useRef<ScriptProcessorNode | null>(null);
  const nextPlayback = useRef(0);

  useEffect(() => () => stop(), []);
  const playPcm = (data: string) => {
    const context = audioContext.current;
    if (!context) return;
    const bytes = decodeBase64(data);
    const pcm = new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 2));
    const buffer = context.createBuffer(1, pcm.length, 24000);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) channel[i] = pcm[i]! / 32768;
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    const start = Math.max(context.currentTime, nextPlayback.current);
    source.start(start);
    nextPlayback.current = start + buffer.duration;
  };

  const start = async () => {
    try {
      setStatus("Connecting to Gemini Live...");
      const { data: sessionData } = await supabase.auth.getSession();
      const tokenResponse = await fetch("/api/gemini-live-token", { method: "POST", headers: { "Content-Type": "application/json", ...(sessionData.session ? { Authorization: `Bearer ${sessionData.session.access_token}` } : {}) }, body: JSON.stringify({ apiKey: getGeminiKey() }) });
      if (!tokenResponse.ok) throw new Error(await tokenResponse.text());
      const { token } = await tokenResponse.json() as { token?: string };
      if (!token) throw new Error("Gemini token unavailable");
      const context = new AudioContext({ sampleRate: 16000 });
      audioContext.current = context;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true } });
      inputStream.current = stream;
      const live = new WebSocket(`wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?access_token=${encodeURIComponent(token)}`);
      socket.current = live;
      live.onopen = () => {
        setConnected(true); setStatus("Listening...");
        live.send(JSON.stringify({ setup: {
          model: "models/gemini-2.0-flash-live-001",
          generationConfig: { responseModalities: ["AUDIO"] },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction: { parts: [{ text: "You are MoneyFYI Live, a concise Hindi-English money assistant. Help users understand spending. Never claim an action happened unless the app confirms it. For adding income or expense, ask for amount and category clearly." }] },
        } }));
        const source = context.createMediaStreamSource(stream);
        const node = context.createScriptProcessor(4096, 1, 1);
        node.onaudioprocess = (event) => {
          if (live.readyState !== WebSocket.OPEN) return;
          live.send(JSON.stringify({ realtimeInput: { mediaChunks: [{ mimeType: "audio/pcm;rate=16000", data: encodeBase64(toPcm16(event.inputBuffer.getChannelData(0))) }] } }));
        };
        source.connect(node); node.connect(context.destination); processor.current = node;
      };
      live.onmessage = (event) => {
        const message = JSON.parse(event.data) as LiveMessage;
        const content = message.serverContent;
        const input = content?.inputTranscription?.text;
        const output = content?.outputTranscription?.text;
        if (input) { setTranscript((value) => `${value} ${input}`.trim()); const action = parseExpense(input); if (action) setPending(action); }
        if (output) setTranscript((value) => `${value}\nAI: ${output}`.trim());
        for (const part of content?.modelTurn?.parts ?? []) if (part.inlineData?.data) playPcm(part.inlineData.data);
      };
      live.onerror = () => setStatus("Connection error");
      live.onclose = () => { setConnected(false); setStatus("Session ended"); };
    } catch (error) { setStatus(error instanceof Error ? error.message : "Could not start live assistant"); stop(); }
  };

  function stop() {
    processor.current?.disconnect(); processor.current = null;
    inputStream.current?.getTracks().forEach((track) => track.stop()); inputStream.current = null;
    socket.current?.close(); socket.current = null;
    void audioContext.current?.close(); audioContext.current = null;
    setConnected(false);
  }

  const confirm = async () => {
    if (!pending) return;
    await addTransaction({ ...pending, date: new Date().toISOString(), source: "manual" });
    toast.success(`${pending.type === "income" ? "Income" : "Expense"} added`);
    setPending(null);
  };

  return <>
    <button
      onClick={() => { if (isPro) setOpen(true); else window.location.href = "/pricing"; }}
      className="fixed bottom-24 right-4 z-40 grid size-14 place-items-center rounded-full bg-neon text-neon-foreground shadow-neon"
      aria-label={isPro ? "Open Gemini Live assistant" : "Unlock Gemini Live assistant"}
      title={isPro ? "Gemini Live" : "Unlock Gemini Live with Pro"}
    >
      <Sparkles className="size-6" />
    </button>
    {open && <div className="fixed inset-0 z-[110] bg-black/80 p-5 backdrop-blur-sm"><section className="mx-auto mt-16 max-w-[440px] rounded-3xl border border-neon/30 bg-card p-5"><div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-widest text-neon">Pro · Gemini Live</p><h2 className="mt-1 text-xl font-display font-bold">Talk to your money assistant</h2></div><button onClick={() => { stop(); setOpen(false); }} aria-label="Close assistant" className="grid size-9 place-items-center rounded-full bg-secondary"><X className="size-4" /></button></div><p className="mt-2 text-xs text-foreground/60">Speak naturally in Hindi or English. Actions appear for confirmation before saving.</p><div className="mt-5 min-h-32 rounded-2xl bg-secondary p-3 text-sm whitespace-pre-wrap">{transcript || status}</div>{pending && <div className="mt-3 rounded-2xl border border-neon/30 bg-neon/10 p-3 text-sm"><p className="font-bold">Save this {pending.type}?</p><p className="mt-1">₹{pending.amount.toLocaleString("en-IN")} · {pending.category}</p><div className="mt-3 flex gap-2"><button onClick={() => void confirm()} className="flex-1 rounded-xl bg-neon py-2 text-xs font-bold text-neon-foreground"><Check className="mr-1 inline size-3" /> Confirm</button><button onClick={() => setPending(null)} className="flex-1 rounded-xl bg-secondary py-2 text-xs font-bold">Cancel</button></div></div>}<button onClick={() => connected ? stop() : void start()} className={`mt-4 w-full rounded-2xl py-4 text-sm font-bold ${connected ? "bg-danger text-white" : "bg-neon text-neon-foreground"}`}>{connected ? <><PhoneOff className="mr-2 inline size-4" /> Stop listening</> : <><Mic className="mr-2 inline size-4" /> Start live talk</>}</button></section></div>}
  </>;
}