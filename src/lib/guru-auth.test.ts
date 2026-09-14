import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getGuruAccess, guruTalk } from "./guru-chat.functions";
import { guruSpeak } from "./guru-speech.functions";
import { requireSupabaseAuth } from "../integrations/supabase/auth-middleware";

type Next = (options: { context: unknown }) => Promise<unknown>;
type Middleware = (options: { next: Next }) => Promise<unknown>;
type Wiring = { middleware: Middleware[] };
const state = vi.hoisted(() => ({ header: "", claims: vi.fn(), client: vi.fn() }));
// Capture server-function wiring without a running HTTP server; the real session middleware executes below.
vi.mock("@tanstack/react-start", () => ({
  createMiddleware: () => ({ server: (fn: Middleware) => fn }),
  createServerFn: () => {
    let middleware: Middleware[] = [];
    return {
      middleware(items: Middleware[]) {
        middleware = items;
        return this;
      },
      validator() {
        return this;
      },
      handler() {
        return { middleware };
      },
    };
  },
}));
vi.mock("@tanstack/react-start/server", () => ({
  getRequest: () =>
    new Request("https://fixture.invalid/guru", {
      headers: state.header ? { authorization: state.header } : {},
    }),
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => {
    state.client(...args);
    return { auth: { getClaims: state.claims } };
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("SUPABASE_URL", "https://fixture.supabase.co");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_fixture");
  state.header = "";
  state.claims.mockResolvedValue({ data: { claims: { sub: "verified-owner" } }, error: null });
});
afterEach(() => vi.unstubAllEnvs());

describe("Guru authenticated function boundary", () => {
  it.each([getGuruAccess, guruTalk, guruSpeak])(
    "attaches the existing verified-session middleware",
    (fn) => {
      expect((fn as unknown as Wiring).middleware).toContain(requireSupabaseAuth);
    },
  );
  it.each(["", "Basic bad", "Bearer", "Bearer bad-token"])(
    "rejects absent or malformed authentication (%s) before handler",
    async (header) => {
      state.header = header;
      const next = vi.fn();
      await expect((requireSupabaseAuth as unknown as Middleware)({ next })).rejects.toThrow(
        /Unauthorized/,
      );
      expect(next).not.toHaveBeenCalled();
      expect(state.client).not.toHaveBeenCalled();
    },
  );
  it("rejects failed token verification", async () => {
    state.header = "Bearer fixture.invalid.jwt";
    state.claims.mockResolvedValue({ data: null, error: new Error("Invalid") });
    const next = vi.fn();
    await expect((requireSupabaseAuth as unknown as Middleware)({ next })).rejects.toThrow(
      /Unauthorized/,
    );
    expect(next).not.toHaveBeenCalled();
  });
  it("gets identity from verified claims and passes only the user's JWT to Supabase", async () => {
    state.header = "Bearer fixture.verified.jwt";
    const next = vi.fn(async () => undefined);
    await (requireSupabaseAuth as unknown as Middleware)({ next });
    expect(next).toHaveBeenCalledWith({
      context: expect.objectContaining({ userId: "verified-owner" }),
    });
    expect(state.claims).toHaveBeenCalledWith("fixture.verified.jwt");
    expect(state.client).toHaveBeenCalledWith(
      "https://fixture.supabase.co",
      "sb_publishable_fixture",
      expect.objectContaining({
        global: expect.objectContaining({
          headers: { Authorization: "Bearer fixture.verified.jwt" },
        }),
        auth: expect.objectContaining({ persistSession: false }),
      }),
    );
  });
});
