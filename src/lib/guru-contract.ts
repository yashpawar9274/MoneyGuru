import { z } from "zod";

export const GuruLanguage = z.enum(["auto", "en", "hi", "hinglish"]);
export type GuruLanguage = z.infer<typeof GuruLanguage>;
export type SpokenLanguage = Exclude<GuruLanguage, "auto">;
export type GuruTurn = { role: "user" | "assistant"; content: string };

export const GuruChatInput = z
  .object({
    messages: z
      .array(
        z
          .object({
            role: z.enum(["user", "assistant"]),
            content: z.string().trim().min(1).max(1000),
          })
          .strict(),
      )
      .min(1)
      .max(12),
    lang: GuruLanguage.default("auto"),
  })
  .strict()
  .superRefine(({ messages }, ctx) => {
    if (messages.at(-1)?.role !== "user")
      ctx.addIssue({ code: "custom", message: "End with a user question." });
    if (messages.reduce((n, m) => n + m.content.length, 0) > 8000)
      ctx.addIssue({ code: "custom", message: "Conversation is too long." });
  });

export const GuruSpeechInput = z
  .object({
    text: z.string().trim().min(1).max(1000),
    lang: GuruLanguage.default("auto"),
  })
  .strict();

export type GuruErrorCode =
  | "PREMIUM_REQUIRED"
  | "RATE_LIMITED"
  | "NOT_CONFIGURED"
  | "CREDITS_EXHAUSTED"
  | "UNAVAILABLE"
  | "CONTEXT_UNAVAILABLE";
export type GuruResult<T> =
  | { ok: true; value: T }
  | {
      ok: false;
      code: GuruErrorCode;
      message: string;
      retryAfter?: number;
    };

export function resolveGuruLanguage(
  requested: GuruLanguage,
  profileLanguage?: string | null,
): SpokenLanguage {
  if (requested !== "auto") return requested;
  return profileLanguage === "hi" ? "hi" : profileLanguage === "hinglish" ? "hinglish" : "en";
}

export function cleanGuruSpeech(text: string, lang: SpokenLanguage) {
  const currency = lang === "en" ? "rupees" : "रुपये";
  return text
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]|\uFE0F|\u200D/gu, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[*_`#~>|"<>]|\[|\]/g, " ")
    .replace(
      /(?:₹|\bRs\.?|\bINR)\s*([\d,]+(?:\.\d+)?)/gi,
      (_, n: string) => `${n.replace(/,/g, "")} ${currency}`,
    )
    .replace(/₹/g, currency)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1000);
}
