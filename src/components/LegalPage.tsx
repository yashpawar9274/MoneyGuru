import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export function LegalPage({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return <main className="mx-auto min-h-screen w-full max-w-[760px] px-5 py-8 text-foreground">
    <Link to="/" className="text-xs font-bold text-neon">← MoneyGuruAI</Link>
    <h1 className="mt-5 text-3xl font-display font-bold">{title}</h1>
    <p className="mt-3 text-sm leading-6 text-foreground/65">{intro}</p>
    <div className="legal-copy mt-7 space-y-6 text-sm leading-6 text-foreground/75">{children}</div>
    <footer className="mt-12 border-t border-border pt-6 text-xs text-foreground/50">
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        <Link to="/about-us">About Us</Link><Link to="/contact-us">Contact Us</Link><Link to="/privacy-policy">Privacy Policy</Link><Link to="/terms-and-conditions">Terms</Link><Link to="/refund-cancellation-policy">Refund & Cancellation</Link><Link to="/shipping-policy">Shipping</Link><Link to="/pricing">Pricing</Link>
      </div>
      <p className="mt-4">© 2026 MoneyGuruAI. Digital money-management service.</p>
    </footer>
  </main>;
}
export const H = ({children}:{children:ReactNode}) => <h2 className="text-lg font-bold text-foreground">{children}</h2>;
