import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  GuruSpeechInput,
  cleanGuruSpeech,
  resolveGuruLanguage,
  type GuruResult,
} from "./guru-contract";

export type GuruAudio = {
  audioBase64: string;
  contentType: "audio/mpeg";
  expiresAt: string | null;
};

export const guruSpeak = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => GuruSpeechInput.parse(input))
  .handler(async ({ data, context }): Promise<GuruResult<GuruAudio>> => {
    const { requireGuruPremium, consumeGuruQuota, guruFailure, GuruError } =
      await import("./guru.server");
    try {
      await requireGuruPremium(context);
      const key = process.env["ELEVENLABS_API_KEY"]?.trim();
      if (!key)
        throw new GuruError(
          "NOT_CONFIGURED",
          "Premium speech is not configured. Using device voice when available.",
        );
      await consumeGuruQuota(context, "speech");
      const { data: profile, error } = await context.supabase
        .from("profiles")
        .select("language")
        .eq("id", context.userId)
        .maybeSingle();
      if (error) throw new GuruError("UNAVAILABLE", "Could not read your language preference.");
      const lang = resolveGuruLanguage(data.lang, profile?.language);
      const text = cleanGuruSpeech(data.text, lang);
      if (!text) throw new GuruError("UNAVAILABLE", "No speakable text was returned.");
      const voice = process.env["GURU_ELEVENLABS_VOICE_ID"]?.trim() || "EXAVITQu4vr4xnSDxMaL";
      if (!/^[a-zA-Z0-9]{10,80}$/.test(voice))
        throw new GuruError("NOT_CONFIGURED", "The owner's Guru voice ID is invalid.");
      const { getRequest } = await import("@tanstack/react-start/server");
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`,
        {
          method: "POST",
          headers: { "xi-api-key": key, "Content-Type": "application/json" },
          body: JSON.stringify({
            text,
            model_id: "eleven_flash_v2_5",
            language_code: lang === "en" ? "en" : "hi",
            voice_settings: { stability: 0.45, similarity_boost: 0.75 },
          }),
          signal: AbortSignal.any([getRequest().signal, AbortSignal.timeout(20000)]),
        },
      );
      if (!response.ok) return guruFailure({ statusCode: response.status });
      if (!response.headers.get("content-type")?.includes("audio/"))
        throw new GuruError("UNAVAILABLE", "Speech provider returned invalid audio.");
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (!bytes.length || bytes.length > 2000000)
        throw new GuruError("UNAVAILABLE", "Speech audio was empty or too large.");
      const { Buffer } = await import("node:buffer");
      const access = await requireGuruPremium(context);
      return {
        ok: true,
        value: {
          audioBase64: Buffer.from(bytes).toString("base64"),
          contentType: "audio/mpeg",
          ...access,
        },
      };
    } catch (error) {
      return guruFailure(error);
    }
  });
