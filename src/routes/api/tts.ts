import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/tts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { text, voiceId, probe, userKey } = (await request.json()) as { text?: string; voiceId?: string; probe?: boolean; userKey?: string; lang?: string };
          const apiKey = (userKey && userKey.trim()) || process.env.ELEVENLABS_API_KEY;
          if (probe) {
            return apiKey
              ? Response.json({ ok: true, source: userKey ? "user" : "server" })
              : Response.json({ error: "No ElevenLabs key set" }, { status: 503 });
          }
          if (!text || text.length === 0 || text.length > 2000) {
            return new Response("Invalid text", { status: 400 });
          }
          if (!apiKey) {
            return Response.json({ error: "No ElevenLabs key set" }, { status: 503 });
          }
          const voice = voiceId || "EXAVITQu4vr4xnSDxMaL"; // Sarah
          const r = await fetch(
            `https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`,
            {
              method: "POST",
              headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
              body: JSON.stringify({
                text,
                // Multilingual model pronounces Hinglish / Hindi / Spanish / French far better.
                model_id: "eleven_multilingual_v2",
                voice_settings: {
                  stability: 0.4,
                  similarity_boost: 0.85,
                  style: 0.25,
                  use_speaker_boost: true,
                },
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
