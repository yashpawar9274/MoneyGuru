import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { StoreProvider } from "@/lib/store";
import { AutoVoiceAgent } from "@/components/AutoVoiceAgent";
import { TrialLock } from "@/components/TrialLock";

import { DebtsProvider } from "@/lib/debts";
import { AuthProvider, useAuth } from "@/lib/auth";
import { AuthScreen } from "@/components/AuthScreen";
import { I18nProvider } from "@/lib/i18n";
import { SplashScreen } from "@/components/SplashScreen";
import { BottomNav } from "@/components/BottomNav";
import { AddTransactionSheet } from "@/components/AddTransactionSheet";
import { QuickAddSheet } from "@/components/QuickAddSheet";
import { CalculatorPopup } from "@/components/CalculatorPopup";
import { Toaster } from "sonner";
import { UpdateNotice } from "@/components/UpdateNotice";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-display font-bold text-neon">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-foreground/60">This screen doesn't exist.</p>
        <Link to="/" className="mt-6 inline-flex rounded-full bg-neon px-5 py-2.5 text-sm font-bold text-neon-foreground">
          Go home
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => { reportLovableError(error, { boundary: "tanstack_root_error_component" }); }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-foreground/60">Try refreshing.</p>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="mt-6 inline-flex rounded-full bg-neon px-5 py-2.5 text-sm font-bold text-neon-foreground"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no, viewport-fit=cover" },
      { name: "theme-color", content: "#09090b" },
      { title: "MoneyGuruAI — Personal Money OS" },
      { name: "description", content: "Personal money OS for tracking income, expenses, Udhari and AI-powered money insights." },
      { property: "og:title", content: "MoneyGuruAI — Personal Money OS" },
      { property: "og:description", content: "Personal money OS for tracking income, expenses, Udhari and AI-powered money insights." },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "MoneyGuruAI — Personal Money OS" },
      { name: "twitter:description", content: "Personal money OS for tracking income, expenses, Udhari and AI-powered money insights." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/59916948-a948-44ab-9d50-be9ae5e24723" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/59916948-a948-44ab-9d50-be9ae5e24723" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", href: "/icon-512.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/icon-512.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

const PUBLIC_PATHS = new Set(["/privacy-policy", "/terms-and-conditions", "/refund-cancellation-policy", "/shipping-policy", "/about-us", "/contact-us", "/pricing"]);

function AuthGate({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { user, loading } = useAuth();
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  if (PUBLIC_PATHS.has(path)) return <>{children}</>;

  if (!hydrated || loading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="size-8 rounded-full border-2 border-neon border-t-transparent animate-spin" />
      </div>
    );
  }
  if (!user) return <AuthScreen />;
  return <>{children}</>;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const isPublicPage = PUBLIC_PATHS.has(path);
  const [quickOpen, setQuickOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addType, setAddType] = useState<"income" | "expense">("expense");
  const [calculatorOpen, setCalculatorOpen] = useState(false);

  useEffect(() => {
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js");
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <AuthProvider>
          <AuthGate>
            <StoreProvider>
              <DebtsProvider>
                <SplashScreen />
                <UpdateNotice />
                <AutoVoiceAgent />
                <TrialLock />

                <div className={`min-h-screen mx-auto w-full ${isPublicPage ? "max-w-[900px]" : "max-w-[440px] pb-28"} relative`}>
                  <Outlet />
                </div>
                {!isPublicPage && <BottomNav onAdd={() => setQuickOpen(true)} />}
                {!isPublicPage && <QuickAddSheet open={quickOpen} onClose={() => setQuickOpen(false)} onAddExpense={() => { setAddType("expense"); setAddOpen(true); }} onAddIncome={() => { setAddType("income"); setAddOpen(true); }} onCalculator={() => setCalculatorOpen(true)} />}
                <AddTransactionSheet open={addOpen} onClose={() => setAddOpen(false)} initialType={addType} />
                <CalculatorPopup open={calculatorOpen} onClose={() => setCalculatorOpen(false)} />
              </DebtsProvider>
            </StoreProvider>
          </AuthGate>
        </AuthProvider>
        <Toaster
          theme="dark" position="top-center"
          toastOptions={{ style: { background: "hsl(240 5% 12%)", color: "white", border: "1px solid hsl(240 5% 20%)" } }}
        />
        <SpeedInsights />
      </I18nProvider>
    </QueryClientProvider>
  );
}

