import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const DebtItem = z.object({
  title: z.string(),
  kind: z.enum(["udhari_given", "udhari_taken", "emi"]),
  remaining: z.number(),
  monthly: z.number().optional(),
  planAmount: z.number().optional(),
  planFreq: z.enum(["daily", "weekly", "monthly"]).optional(),
  dueInDays: z.number().nullable().optional(),
});

const AdviceInput = z.object({
  debts: z.array(DebtItem).max(50),
  monthlyIncome: z.number().optional(),
  monthlyExpense: z.number().optional(),
  lang: z.enum(["en", "hi", "es", "fr"]).default("en"),
});

const LANG_INSTRUCTION: Record<"en" | "hi" | "es" | "fr", string> = {
  en: "Write priority, saveWhere and summary in friendly, punchy English.",
  hi: "Write priority, saveWhere and summary in casual Hinglish (Devanagari mixed with English), Gen-Z friendly tone.",
  es: "Escribe priority, saveWhere y summary en español amigable y directo (tono Gen-Z). Usa ejemplos prácticos para India igual (UPI, RD, etc.).",
  fr: "Rédige priority, saveWhere et summary en français amical et direct (ton Gen-Z). Garde les exemples pratiques pour l'Inde (UPI, RD, etc.).",
};

const AdviceSchema = z.object({
  dailyPay: z.number(),
  weeklyPay: z.number(),
  monthlyPay: z.number(),
  clearInDays: z.number(),
  priority: z.string(),
  saveWhere: z.string(),
  summary: z.string(),
});

function extractJson(text: string): unknown {
  let cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const start = cleaned.search(/[{[]/);
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON in AI response");
  cleaned = cleaned.substring(start, end + 1);
  try {
    return JSON.parse(cleaned);
  } catch {
    cleaned = cleaned.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]").replace(/[\x00-\x1F\x7F]/g, "");
    return JSON.parse(cleaned);
  }
}

export const getDebtAdvice = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => AdviceInput.parse(i))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY not configured");
    const gateway = createLovableAiGatewayProvider(key);

    const myDebts = data.debts.filter((d) => d.kind !== "udhari_given" && d.remaining > 0);
    const NO_DEBT: Record<"en" | "hi" | "es" | "fr", { priority: string; saveWhere: string; summary: string }> = {
      en: { priority: "No debts. You're free!", saveWhere: "Park surplus in a liquid fund or RD for emergencies.", summary: "All clear — keep stacking savings." },
      hi: { priority: "कोई debt नहीं है. Tum free ho!", saveWhere: "Surplus ko liquid fund ya RD me park karo for emergencies.", summary: "All clear — keep stacking savings." },
      es: { priority: "Sin deudas. ¡Eres libre!", saveWhere: "Guarda el excedente en un fondo líquido o RD para emergencias.", summary: "Todo limpio — sigue ahorrando." },
      fr: { priority: "Aucune dette. Tu es libre !", saveWhere: "Place le surplus dans un fonds liquide ou RD pour les imprévus.", summary: "Tout clair — continue d'épargner." },
    };
    if (myDebts.length === 0) {
      return { dailyPay: 0, weeklyPay: 0, monthlyPay: 0, clearInDays: 0, ...NO_DEBT[data.lang] };
    }
    const totalOwe = myDebts.reduce((s, d) => s + d.remaining, 0);
    const lines = myDebts.map(
      (d) =>
        `- ${d.title} (${d.kind}): ₹${d.remaining.toFixed(0)} left${
          d.monthly ? `, EMI ₹${d.monthly}/mo` : ""
        }${d.planAmount ? `, plan ₹${d.planAmount}/${d.planFreq}` : ""}${
          d.dueInDays != null ? `, due in ${d.dueInDays}d` : ""
        }`,
    );

    const cashflow =
      data.monthlyIncome != null && data.monthlyExpense != null
        ? `Monthly income ≈ ₹${data.monthlyIncome.toFixed(0)}, expenses ≈ ₹${data.monthlyExpense.toFixed(0)}, surplus ≈ ₹${(data.monthlyIncome - data.monthlyExpense).toFixed(0)}`
        : `Cashflow unknown — assume modest surplus.`;

    const langLine = LANG_INSTRUCTION[data.lang];

    const prompt = `You are a personal-finance coach for an Indian user clearing debts (udhari & EMI) fast.
${langLine}

USER DEBTS (₹ INR):
Total owed: ₹${totalOwe.toFixed(0)}
${lines.join("\n")}

${cashflow}

Return ONLY a single JSON object (no markdown, no prose before/after) with EXACTLY these keys:
{
  "dailyPay": number,     // realistic ₹/day to set aside to clear ALL debts fast, rounded to nearest 10
  "weeklyPay": number,    // dailyPay * 7, rounded
  "monthlyPay": number,   // dailyPay * 30, rounded
  "clearInDays": number,  // estimated days to be debt-free at that pace
  "priority": string,     // 1 sentence: which debt to attack first and why
  "saveWhere": string,    // 1-2 sentences: WHERE to park the daily savings (UPI jar, RD, liquid fund, Jupiter/Fi pots, savings a/c) — be specific & practical for India
  "summary": string       // 1-2 sentence punchy motivational summary
}
Be concrete with numbers. No fluff.`;

    const { text } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      prompt,
    });

    let parsed: unknown;
    try {
      parsed = extractJson(text);
    } catch (e) {
      throw new Error("AI response was not valid JSON: " + (e instanceof Error ? e.message : ""));
    }

    const result = AdviceSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error("AI response missing required fields");
    }
    return result.data;
  });
