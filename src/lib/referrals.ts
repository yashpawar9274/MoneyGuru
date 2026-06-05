// Saving / investing apps. Replace the `url` with your own referral link
// for each app to earn referral rewards. Until then they link to the homepage.
export interface ReferralApp {
  id: string;
  name: string;
  tagline: string;
  emoji: string;
  url: string;        // your personal referral / homepage
  reward?: string;    // short blurb shown on the card
}

export const REFERRALS: ReferralApp[] = [
  {
    id: "jar",
    name: "Jar",
    tagline: "Auto-save daily in digital gold",
    emoji: "🏺",
    url: "https://myjar.app",
    reward: "₹50 on first save",
  },
  {
    id: "fi",
    name: "Fi Money",
    tagline: "Smart savings + UPI jars",
    emoji: "💰",
    url: "https://fi.money",
    reward: "₹100 sign-up bonus",
  },
  {
    id: "slice",
    name: "Slice",
    tagline: "Spend, split, get rewards",
    emoji: "🍕",
    url: "https://sliceit.com",
    reward: "Mystery scratch card",
  },
  {
    id: "jupiter",
    name: "Jupiter",
    tagline: "Pots that auto-grow",
    emoji: "🪐",
    url: "https://jupiter.money",
    reward: "₹50 jewels",
  },
];
