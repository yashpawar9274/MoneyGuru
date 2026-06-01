import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/tts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { text, voiceId } = (await request.json()) as { text?: string; voiceId?: string };
          if (!text || text.length === 0 || text.length > 2000) {
            return new Response("Invalid text", { status: 400 });
          }
          const apiKey = process.env.ELEVENLABS_API_KEY;
          if (!apiKey) {
            return Response.json({ error: "ELEVENLABS_API_KEY not configured" }, { status: 503 });
          }
          const voice = voiceId || "EXAVITQu4vr4xnSDxMaL"; // Sarah
          const r = await fetch(
            `https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`,
            {
              method: "POST",
              headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
              body: JSON.stringify({
                text,
                model_id: "eleven_turbo_v2_5",
                voice_settings: { stability: 0.5, similarity_boost: 0.75 },
              }),
            },
          );
          if (!r.ok) {
            const err = await r.text();
            return new Response(err || "TTS failed", { status: r.status });
          }
          const buf = await r.arrayBuffer();
          return new Response(buf, {
            headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
          });
        } catch (e) {
          return new Response(e instanceof Error ? e.message : "TTS error", { status: 500 });
        }
      },
    },
  },
});
