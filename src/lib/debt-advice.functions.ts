import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText, Output } from "ai";
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
  lang: z.enum(["en", "hi"]).default("hi"),
});

export const getDebtAdvice = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => AdviceInput.parse(i))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY not configured");
    const gateway = createLovableAiGatewayProvider(key);

    const myDebts = data.debts.filter((d) => d.kind !== "udhari_given" && d.remaining > 0);
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
        : `Cashflow unknown.`;

    const langLine =
      data.lang === "hi"
        ? "Reply in casual Hinglish (Devanagari mixed with English words), Gen-Z friendly tone."
        : "Reply in friendly English.";

    const prompt = `You are a sharp personal-finance coach helping the user clear debts (udhari & EMI) fast.
${langLine}

USER DEBTS (₹ INR):
Total owed: ₹${totalOwe.toFixed(0)}
${lines.join("\n") || "(none)"}

${cashflow}

Recommend:
1) dailyPay — a realistic ₹/day amount the user should set aside to clear ALL debts fast (round to nearest 10).
2) weeklyPay & monthlyPay — equivalents.
3) clearInDays — estimated days to be debt-free at that pace.
4) priority — which debt to attack first and why (1 sentence).
5) saveWhere — 1-2 sentence suggestion on WHERE to park the daily savings until paid out (e.g. separate UPI jar, RD, liquid fund, savings account, Jupiter/Fi pots). Be specific and practical for an Indian user.
6) summary — 1-2 sentence punchy motivational summary.

Be concrete with numbers. No fluff.`;

    const { output } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      output: Output.object({
        schema: z.object({
          dailyPay: z.number(),
          weeklyPay: z.number(),
          monthlyPay: z.number(),
          clearInDays: z.number(),
          priority: z.string(),
          saveWhere: z.string(),
          summary: z.string(),
        }),
      }),
      prompt,
    });

    return output;
  });
