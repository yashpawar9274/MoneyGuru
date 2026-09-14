import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";

let db: PGlite;
const uid = "00000000-0000-0000-0000-000000000001";
const other = "00000000-0000-0000-0000-000000000002";
type Result = { allowed: boolean; reason: string; retry_after: number; remaining_today: number };
const call = async (kind = "chat") =>
  (await db.query<Result>("SELECT * FROM public.consume_guru_quota($1)", [kind])).rows[0];
const setPlan = (plan: string, status = "active", end: string | null = "2099-01-01T00:00:00Z") =>
  db.query(
    "UPDATE public.subscriptions SET plan=$1,status=$2,current_period_end=$3 WHERE user_id=$4",
    [plan, status, end, uid],
  );

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth; CREATE TABLE auth.users (id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    GRANT USAGE ON SCHEMA public, auth TO anon, authenticated;
    GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;
    CREATE TABLE public.subscriptions(user_id uuid PRIMARY KEY, plan text, status text, current_period_end timestamptz);
    INSERT INTO auth.users VALUES ('${uid}'), ('${other}');
    INSERT INTO public.subscriptions VALUES ('${uid}', 'pro', 'active', '2099-01-01'), ('${other}', 'pro', 'active', '2099-01-01');`);
  const migration = await readFile(
    new URL("../../supabase/migrations/20260913143000_guru_voice_quota.sql", import.meta.url),
    "utf8",
  );
  await db.exec(migration);
  await db.exec(migration); // Safe re-run, no record deletion.
});
beforeEach(async () => {
  await db.exec("RESET ROLE; TRUNCATE public.guru_request_quota;");
  await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [uid]);
  await setPlan("pro");
});
afterAll(async () => {
  await db?.close();
});

describe("persistent SQL quota and privileges", () => {
  it.each(["weekly", "pro", "lifetime"])("allows active %s", async (plan) => {
    await setPlan(plan, "active", plan === "lifetime" ? null : "2099-01-01");
    expect(await call()).toMatchObject({ allowed: true, remaining_today: 59 });
  });
  it.each(["canceled", "past_due"])("blocks %s", async (status) => {
    await setPlan("lifetime", status, null);
    expect((await call()).reason).toBe("premium_required");
  });
  it("rejects free, expired, null-expiry and infinite-expiry plans", async () => {
    for (const [plan, date] of [
      ["free", "2099-01-01"],
      ["weekly", "2020-01-01"],
      ["pro", null],
      ["pro", "infinity"],
    ]) {
      await setPlan(plan!, "active", date);
      expect((await call()).allowed).toBe(false);
    }
  });
  it("enforces minute quota across overlapping calls and independent speech quota", async () => {
    const results = await Promise.all(Array.from({ length: 20 }, () => call()));
    expect(results.filter((r) => r.allowed)).toHaveLength(8);
    expect((await call()).reason).toBe("minute_limit");
    expect((await call("speech")).allowed).toBe(true);
  });
  it("enforces daily quota after minute reset, then rolls over on next UTC day", async () => {
    await call();
    await db.exec(
      "UPDATE public.guru_request_quota SET day_count=60, minute_start=now()-interval '2 minutes';",
    );
    expect(await call()).toMatchObject({ allowed: false, reason: "daily_limit" });
    await db.exec("UPDATE public.guru_request_quota SET day_start=current_date-1;");
    expect(await call()).toMatchObject({ allowed: true, remaining_today: 59 });
  });
  it("isolates users, rejects quota writes and enforces owner-only reads", async () => {
    await call();
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [other]);
    await db.exec("SET ROLE authenticated;");
    expect((await db.query("SELECT * FROM public.guru_request_quota")).rows).toHaveLength(0);
    expect(await call()).toMatchObject({ allowed: true, remaining_today: 59 });
    expect((await db.query("SELECT * FROM public.guru_request_quota")).rows).toHaveLength(1);
    await expect(db.exec("UPDATE public.guru_request_quota SET day_count=0")).rejects.toThrow(
      /permission denied/,
    );
  });
  it("rejects signed-out/anonymous and invalid kinds", async () => {
    await expect(call("unlimited")).rejects.toThrow(/invalid quota kind/);
    await db.query("SELECT set_config('request.jwt.claim.sub', '', false)");
    await expect(call()).rejects.toThrow(/authentication required/);
    await db.exec("SET ROLE anon;");
    await expect(call()).rejects.toThrow(/permission denied/);
  });
});
