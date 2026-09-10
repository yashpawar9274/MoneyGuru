export const APP_VERSION = "1.1.0";

export const RELEASE_NOTES = [
  "Admin dashboard with live customers, payments, debts and webhook feeds.",
  "Receipt totals now use the complete ledger, with PDF download and WhatsApp sharing.",
  "Profile cards show the saved photo and transaction edit/delete actions are available.",
  "Installable PWA support with a service worker for mobile browser installation.",
  "PayU checkout with live UPI, card and netbanking payments.",
];

export const MOBILE_DOWNLOAD_URL = "https://moneyguruai.dev";

export function isNewReleaseSeen(storage: Storage | null) {
  return storage?.getItem("moneyfyi_seen_release") === APP_VERSION;
}

export function markReleaseSeen(storage: Storage | null) {
  storage?.setItem("moneyfyi_seen_release", APP_VERSION);
}