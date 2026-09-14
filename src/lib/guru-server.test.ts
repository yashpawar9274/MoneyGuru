import { describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../integrations/supabase/types";
import {
  requireGuruPremium,
  loadGuruContext,
  loadGuruPages,
  consumeGuruQuota,
  guruFailure,
} from "./guru.server";

function client(fetcher: typeof fetch) {
  return {
    userId: "current-user",
    supabase: createClient<Database>("https://test.supabase.co", "test-key", {
      global: { fetch: fetcher },
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  };
}

describe("server boundaries", () => {
  it("loads only authenticated owner's columns and filters, including for an admin session", async () => {
    const urls: URL[] = [];
    const session = client(async (input) => {
      const url = new URL(String(input));
      urls.push(url);
      const profile = url.pathname.endsWith("profiles");
      const settings = url.pathname.endsWith("user_settings");
      return new Response(
        JSON.stringify(
          profile ? [{ full_name: "Yash", currency: "INR", language: "hi" }] : settings ? [] : [],
        ),
        { headers: { "content-type": "application/json" } },
      );
    });
    const snapshot = await loadGuruContext(session);
    expect(snapshot.finance.name).toBe("Yash");
    expect(urls).toHaveLength(6);
    for (const url of urls) {
      expect(url.searchParams.get(url.pathname.endsWith("profiles") ? "id" : "user_id")).toBe(
        "eq.current-user",
      );
      expect(url.searchParams.get("select")).not.toMatch(/email|proof|contact_phone|avatar/);
    }
  });
  it("denies database errors instead of treating missing rows as premium", async () => {
    const session = client(
      async () =>
        new Response('{"message":"unavailable"}', {
          status: 500,
          headers: { "content-type": "application/json" },
        }),
    );
    await expect(requireGuruPremium(session)).rejects.toMatchObject({ code: "UNAVAILABLE" });
  });
  it("denies free and doesn't call providers", async () => {
    const session = client(
      async () =>
        new Response(
          JSON.stringify([{ plan: "free", status: "active", current_period_end: null }]),
          { headers: { "content-type": "application/json" } },
        ),
    );
    await expect(requireGuruPremium(session)).rejects.toMatchObject({ code: "PREMIUM_REQUIRED" });
  });
  it("quota requests never send a user ID or client-controlled limits", async () => {
    let body: unknown;
    const session = client(async (_input, init) => {
      body = JSON.parse(String(init?.body));
      return new Response(
        JSON.stringify([{ allowed: true, reason: "ok", remaining_today: 59, retry_after: 0 }]),
        { headers: { "content-type": "application/json" } },
      );
    });
    expect(await consumeGuruQuota(session, "chat")).toBe(59);
    expect(body).toEqual({ p_kind: "chat" });
  });
  it("paginates past Supabase limits; partial/error reads fail closed", async () => {
    const page = vi.fn(async (from: number) => ({
      data: Array.from({ length: from < 1000 ? 500 : 1 }, (_, i) => i + from),
      error: null,
    }));
    expect(await loadGuruPages(page)).toHaveLength(1001);
    expect(page).toHaveBeenCalledTimes(3);
    await expect(
      loadGuruPages(async () => ({ data: null, error: "failed" })),
    ).rejects.toMatchObject({ code: "CONTEXT_UNAVAILABLE" });
  });
  it("sanitizes gateway errors without exposing provider payloads or secrets", () => {
    const result = guruFailure({ statusCode: 402, responseBody: "private user context" });
    expect(result).toMatchObject({ ok: false, code: "CREDITS_EXHAUSTED" });
    expect(JSON.stringify(result)).not.toContain("private");
  });
});
