import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AdminCustomer = {
  id: string;
  email: string | null;
  fullName: string | null;
  createdAt: string;
  plan: string;
  subscriptionStatus: string;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
};

export type AdminPayment = {
  id: string;
  userId: string;
  email: string | null;
  orderId: string;
  amountInr: number;
  plan: string;
  status: string;
  provider: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminSubscription = {
  userId: string;
  email: string | null;
  plan: string;
  status: string;
  priceInr: number;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  updatedAt: string;
};

export type AdminWebhook = {
  id: string;
  provider: string;
  eventType: string | null;
  orderId: string | null;
  status: string | null;
  signatureValid: boolean;
  httpStatus: number | null;
  message: string | null;
  createdAt: string;
};

export type AdminDashboardData = {
  customers: AdminCustomer[];
  payments: AdminPayment[];
  subscriptions: AdminSubscription[];
  webhooks: AdminWebhook[];
};

export const getAdminDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminDashboardData> => {
    const { data: allowed, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleError || !allowed) throw new Error("Admin access required");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [profilesResult, paymentsResult, subscriptionsResult, webhooksResult] = await Promise.all(
      [
        supabaseAdmin
          .from("profiles")
          .select("id,email,full_name,created_at")
          .order("created_at", { ascending: false })
          .limit(250),
        supabaseAdmin
          .from("payments")
          .select("id,user_id,order_id,amount_inr,plan,status,provider,created_at,updated_at")
          .order("created_at", { ascending: false })
          .limit(250),
        supabaseAdmin
          .from("subscriptions")
          .select("user_id,plan,status,price_inr,trial_ends_at,current_period_end,updated_at")
          .order("updated_at", { ascending: false })
          .limit(250),
        supabaseAdmin
          .from("webhook_logs")
          .select(
            "id,provider,event_type,order_id,status,signature_valid,http_status,message,created_at",
          )
          .order("created_at", { ascending: false })
          .limit(250),
      ],
    );

    const firstError =
      profilesResult.error ||
      paymentsResult.error ||
      subscriptionsResult.error ||
      webhooksResult.error;
    if (firstError) throw new Error(firstError.message);

    const profiles = profilesResult.data ?? [];
    const subscriptions = subscriptionsResult.data ?? [];
    const emailByUser = new Map(profiles.map((profile) => [profile.id, profile.email]));
    const subscriptionByUser = new Map(
      subscriptions.map((subscription) => [subscription.user_id, subscription]),
    );

    return {
      customers: profiles.map((profile) => {
        const subscription = subscriptionByUser.get(profile.id);
        return {
          id: profile.id,
          email: profile.email,
          fullName: profile.full_name,
          createdAt: profile.created_at,
          plan: subscription?.plan ?? "free",
          subscriptionStatus: subscription?.status ?? "inactive",
          trialEndsAt: subscription?.trial_ends_at ?? null,
          currentPeriodEnd: subscription?.current_period_end ?? null,
        };
      }),
      payments: (paymentsResult.data ?? []).map((payment) => ({
        id: payment.id,
        userId: payment.user_id,
        email: emailByUser.get(payment.user_id) ?? null,
        orderId: payment.order_id,
        amountInr: Number(payment.amount_inr),
        plan: payment.plan,
        status: payment.status,
        provider: payment.provider,
        createdAt: payment.created_at,
        updatedAt: payment.updated_at,
      })),
      subscriptions: subscriptions.map((subscription) => ({
        userId: subscription.user_id,
        email: emailByUser.get(subscription.user_id) ?? null,
        plan: subscription.plan,
        status: subscription.status,
        priceInr: subscription.price_inr,
        trialEndsAt: subscription.trial_ends_at,
        currentPeriodEnd: subscription.current_period_end,
        updatedAt: subscription.updated_at,
      })),
      webhooks: (webhooksResult.data ?? []).map((webhook) => ({
        id: webhook.id,
        provider: webhook.provider,
        eventType: webhook.event_type,
        orderId: webhook.order_id,
        status: webhook.status,
        signatureValid: webhook.signature_valid,
        httpStatus: webhook.http_status,
        message: webhook.message,
        createdAt: webhook.created_at,
      })),
    };
  });

export const unlockCustomerPro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { userId: string; plan: "pro" | "lifetime" }) => {
    if (!/^[0-9a-f-]{36}$/i.test(data.userId)) throw new Error("Invalid customer");
    if (data.plan !== "pro" && data.plan !== "lifetime") throw new Error("Invalid plan");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { data: allowed, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleError || !allowed) throw new Error("Admin access required");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: customer, error: customerError } = await supabaseAdmin
      .from("profiles")
      .select("id,email")
      .eq("id", data.userId)
      .maybeSingle();
    if (customerError || !customer) throw new Error("Customer not found");

    const subscription =
      data.plan === "lifetime"
        ? {
            user_id: data.userId,
            plan: "lifetime",
            status: "active",
            price_inr: 0,
            current_period_end: null,
            trial_ends_at: null,
            updated_at: new Date().toISOString(),
          }
        : {
            user_id: data.userId,
            plan: "pro",
            status: "active",
            price_inr: 0,
            current_period_end: new Date(Date.now() + 30 * 86400000).toISOString(),
            trial_ends_at: null,
            updated_at: new Date().toISOString(),
          };

    const { error } = await supabaseAdmin.from("subscriptions").upsert(subscription, {
      onConflict: "user_id",
    });
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("webhook_logs").insert({
      provider: "admin",
      event_type: "manual_pro_unlock",
      order_id: null,
      status: "active",
      signature_valid: true,
      http_status: 200,
      message:
        `Admin ${context.userId} unlocked ${data.plan} for ${customer.email ?? data.userId}`.slice(
          0,
          500,
        ),
    });

    return { ok: true, plan: data.plan, email: customer.email };
  });
