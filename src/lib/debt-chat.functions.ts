import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const Msg = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(2000),
});

const DebtCtx = z.object({
  title: z.string(),
  kind: z.enum(["udhari_given", "udhari_taken", "emi"]),
  remaining: z.number(),
  monthly: z.number().optional(),
  planAmount: z.number().optional(),
  planFreq: z.enum(["daily", "weekly", "monthly"]).optional(),
  dueInDays: z.number().nullable().optional(),
});

const Input = z.object({
  messages: z.array(Msg).min(1).max(30),
  debts: z.array(DebtCtx).max(50).default([]),
  monthlyIncome: z.number().optional(),
  monthlyExpense: z.number().optional(),
  lang: z.enum(["en", "hi", "es", "fr"]).default("en"),
});

const LANG_LINE: Record<"en" | "hi" | "es" | "fr", string> = {
  en: "Reply in friendly, punchy English. Use bullet points and bold for numbers.",
  hi: "Reply in casual Hinglish (Devanagari mixed with English), Gen-Z tone. Use bullets and bold for amounts.",
  es: "Responde en español amigable y directo (tono Gen-Z). Usa viñetas y negritas para los números.",
  fr: "Réponds en français amical et direct (ton Gen-Z). Utilise des puces et du gras pour les montants.",
};

export const chatDebtCoach = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => Input.parse(i))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY not configured");
    const gateway = createLovableAiGatewayProvider(key);

    const totalOwe = data.debts.reduce((s, d) => s + (d.kind !== "udhari_given" ? d.remaining : 0), 0);
    const debtLines = data.debts
      .filter((d) => d.kind !== "udhari_given" && d.remaining > 0)
      .map(
        (d) =>
          `- ${d.title} (${d.kind}): ₹${d.remaining.toFixed(0)} left${d.monthly ? `, EMI ₹${d.monthly}/mo` : ""}${d.planAmount ? `, plan ₹${d.planAmount}/${d.planFreq}` : ""}${d.dueInDays != null ? `, due in ${d.dueInDays}d` : ""}`,
      )
      .join("\n");

    const cashflow =
      data.monthlyIncome != null
        ? `Monthly income ≈ ₹${data.monthlyIncome.toFixed(0)}${data.monthlyExpense != null ? `, expenses ≈ ₹${data.monthlyExpense.toFixed(0)}, surplus ≈ ₹${(data.monthlyIncome - data.monthlyExpense).toFixed(0)}` : ""}`
        : "Cashflow unknown — ask the user about income & expenses if needed.";

    const system = `You are MONEY.FYI's AI Debt Coach for an Indian user clearing udhari and EMI.
${LANG_LINE[data.lang]}
Keep replies under 120 words.

When the user shares income or asks for a plan, give CONCRETE numbers for:
- **Daily** pay (₹/day to save towards debts)
- **Weekly** pay
- **Monthly** pay
- Estimated days/months to be debt-free.

Then suggest WHERE to park the daily savings (Jupiter pots, Fi jars, Jar app, RD, liquid fund, UPI auto-pay) — pick what fits their pace.

USER DEBT SNAPSHOT (₹ INR):
Total owed: ₹${totalOwe.toFixed(0)}
${debtLines || "(no active debts)"}

${cashflow}

Never invent debts not listed. Ask short follow-up questions if needed.`;

    const { text } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      system,
      messages: data.messages.map((m) => ({ role: m.role, content: m.content })),
    });

    return { reply: text.trim() };
  });
