import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText } from "ai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { buildGuruFinanceContext, type GuruDebtRow } from "./guru-context";
import type { Category, Transaction } from "./types";

const Message = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(1200),
});

const TalkInput = z.object({
  messages: z.array(Message).min(1).max(16),
  lang: z.enum(["en", "hi"]),
});

const SpeechInput = z.object({
  text: z.string().trim().min(1).max(1200),
  lang: z.enum(["en", "hi"]),
});

type AuthContext = {
  supabase: Parameters<typeof buildGuruFinanceContext>[0] extends never ? never : any;
  userId: string;
};

type DebtQueryRow = {
  id: string;
  kind: string;
  title: string;
  principal: number | string;
  monthly: number | string | null;
  due_date: string | null;
};

type TransactionQueryRow = {
  id: string;
  type: string;
  amount: number | string;
  category: string;
  note: string | null;
  date: string;
  method: string;
  source: string;
};

async function requirePremium(context: AuthContext) {
  const { data, error } = await context.supabase
    .from("subscriptions")
    .select("plan,status,current_period_end")
    .eq("user_id", context.userId)
    .maybeSingle();
  if (error) throw new Error("Premium access could not be verified.");
  const activePlan = data?.plan === "weekly" || data?.plan === "pro" || data?.plan === "lifetime";
  const activeStatus = data?.status === "active";
  const notExpired = data?.plan === "lifetime" ||
    (!!data?.current_period_end && new Date(data.current_period_end).getTime() > Date.now());
  if (!activePlan || !activeStatus || !notExpired) {
    throw new Error("Guru Voice AI is available with Weekly, Pro, or Lifetime.");
  }
}

async function consumeQuota(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("consume_guru_voice_quota", {
    _user_id: userId,
    _limit: 30,
    _window: "01:00:00",
  });
  if (error) throw new Error("Guru usage limit could not be checked.");
  if (!data) throw new Error("Guru's hourly voice limit is reached. Please try again later.");
}

async function loadFinance(context: AuthContext) {
  const [txResult, debtResult, entryResult, paymentResult, settingsResult] = await Promise.all([
    context.supabase.from("transactions").select("id,type,amount,category,note,date,method,source").order("date", { ascending: false }).limit(300),
    context.supabase.from("debts").select("id,kind,title,principal,monthly,due_date"),
    context.supabase.from("debt_entries").select("debt_id,amount"),
    context.supabase.from("debt_payments").select("debt_id,amount"),
    context.supabase.from("user_settings").select("monthly_income,monthly_budget,savings_target,fixed_expenses").eq("user_id", context.userId).maybeSingle(),
  ]);
  const firstError = [txResult.error, debtResult.error, entryResult.error, paymentResult.error, settingsResult.error].find(Boolean);
  if (firstError) throw new Error("Your latest money data could not be loaded.");

  const entries = new Map<string, number[]>();
  for (const row of entryResult.data ?? []) entries.set(row.debt_id, [...(entries.get(row.debt_id) ?? []), Number(row.amount)]);
  const payments = new Map<string, number[]>();
  for (const row of paymentResult.data ?? []) payments.set(row.debt_id, [...(payments.get(row.debt_id) ?? []), Number(row.amount)]);
  const debts: GuruDebtRow[] = (debtResult.data ?? []).map((row: DebtQueryRow) => ({
    id: row.id,
    kind: row.kind,
    title: row.title,
    principal: Number(row.principal),
    monthly: row.monthly === null ? null : Number(row.monthly),
    dueDate: row.due_date,
    entries: entries.get(row.id) ?? [],
    payments: payments.get(row.id) ?? [],
  }));
  const transactions: Transaction[] = (txResult.data ?? []).map((row: TransactionQueryRow) => ({
    id: row.id,
    type: row.type === "income" ? "income" : "expense",
    amount: Number(row.amount),
    category: row.category as Category,
    note: row.note ?? "",
    date: row.date,
    method: row.method as Transaction["method"],
    source: row.source as Transaction["source"],
  }));
  const settings = settingsResult.data;
  return buildGuruFinanceContext(transactions, debts, {
    monthlyIncome: settings?.monthly_income ?? null,
    monthlyBudget: settings?.monthly_budget ?? null,
    savingsTarget: settings?.savings_target ?? null,
    fixedExpenses: settings?.fixed_expenses ?? null,
  });
}

export const getGuruAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requirePremium(context as AuthContext);
    return { allowed: true as const };
  });

export const guruTalk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => TalkInput.parse(input))
  .handler(async ({ data, context }) => {
    await requirePremium(context as AuthContext);
    await consumeQuota(context.userId);
    const finance = await loadFinance(context as AuthContext);
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("Guru AI is not configured.");
    const gateway = createLovableAiGatewayProvider(key);
    const language = data.lang === "hi"
      ? "Speak in natural Hindi/Hinglish, matching the user's wording."
      : "Speak in natural Indian English, with simple wording.";
    const system = `You are Guru, MoneyGuruAI's warm personal finance voice coach for an Indian user.
${language}
Answer in 1-3 short spoken sentences without markdown, bullets, or emoji. Use Indian rupees naturally.
Use ONLY the FINANCE DATA below. Never invent a transaction, balance, due date, income, debt, or EMI. If data is absent, say that clearly and ask one short question.
Do not give guaranteed returns, tax/legal claims, or instructions to borrow recklessly. Explain that major financial decisions need a qualified adviser.
FINANCE DATA:\n${JSON.stringify(finance)}`;

    try {
      const result = await generateText({
        model: gateway("google/gemini-3.8-flash"),
        system,
        messages: data.messages,
        maxRetries: 0,
        providerOptions: { lovable: { service_tier: "priority" } },
      });
      const reply = result.text.replace(/[*_`#]/g, "").trim();
      if (!reply) throw new Error("Guru returned an empty reply.");
      return { reply };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : "Guru could not reply.");
    }
  });

export const guruSpeech = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SpeechInput.parse(input))
  .handler(async ({ data, context }) => {
    await requirePremium(context as AuthContext);
    const apiKey = process.env["ELEVENLABS_API_KEY"];
    if (!apiKey) return { audioBase64: null, fallback: true as const };
    const response = await fetch("https://api.elevenlabs.io/v1/text-to-speech/EXAVITQu4vr4xnSDxMaL?output_format=mp3_44100_128", {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        text: data.text,
        model_id: "eleven_multilingual_v2",
        language_code: data.lang === "hi" ? "hi" : "en",
        voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.2, use_speaker_boost: true },
      }),
    });
    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || `Voice service failed (${response.status}).`);
    }
    return { audioBase64: Buffer.from(await response.arrayBuffer()).toString("base64"), fallback: false as const };
  });