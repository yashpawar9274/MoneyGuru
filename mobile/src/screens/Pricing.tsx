import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Linking,
  ActivityIndicator,
} from "react-native";
import { API_BASE } from "../lib/api";
import { fmt, useTrial } from "../lib/trial";

const NEON = "#c4ff3d";

const PLANS = [
  {
    id: "pro" as const,
    name: "Pro Monthly",
    price: "₹100",
    per: "/ month",
    perks: [
      "Unlimited daily / weekly / monthly tracking",
      "Full spend analytics + graphs",
      "Bill scan (AI OCR)",
      "AI savings coach + voice",
      "Udhari & EMI payoff planner",
    ],
  },
  {
    id: "lifetime" as const,
    name: "Lifetime",
    price: "₹999",
    per: "one time",
    perks: ["Everything in Pro", "Pay once, keep forever", "All future features included"],
  },
];

export default function PricingScreen() {
  const { isPro, plan, msLeft, setPlan } = useTrial();
  const [busy, setBusy] = useState<string | null>(null);

  const checkout = async (id: "pro" | "lifetime") => {
    setBusy(id);
    try {
      await Linking.openURL(`${API_BASE}/pricing?plan=${id}&from=apk`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <Text style={styles.kicker}>MONEY.FYI</Text>
      <Text style={styles.h1}>Upgrade to Pro</Text>

      {isPro ? (
        <View style={styles.badgeOk}>
          <Text style={styles.badgeOkTxt}>
            {plan === "lifetime" ? "LIFETIME ACTIVE" : "PRO ACTIVE"}
          </Text>
        </View>
      ) : (
        <View style={styles.badge}>
          <Text style={styles.badgeTxt}>
            FREE TRIAL {msLeft > 0 ? fmt(msLeft) : "EXPIRED"}
          </Text>
        </View>
      )}

      {PLANS.map((p) => (
        <View key={p.id} style={styles.card}>
          <Text style={styles.cardName}>{p.name}</Text>
          <View style={styles.priceRow}>
            <Text style={styles.price}>{p.price}</Text>
            <Text style={styles.per}>{p.per}</Text>
          </View>
          {p.perks.map((x) => (
            <Text key={x} style={styles.perk}>
              ✓ {x}
            </Text>
          ))}
          <Pressable
            style={[styles.cta, p.id === "lifetime" && styles.ctaAlt]}
            onPress={() => checkout(p.id)}
            disabled={busy !== null}
          >
            {busy === p.id ? (
              <ActivityIndicator color="#09090b" />
            ) : (
              <Text style={[styles.ctaTxt, p.id === "lifetime" && styles.ctaTxtAlt]}>
                Pay with UPI / Card
              </Text>
            )}
          </Pressable>
        </View>
      ))}

      <Text style={styles.note}>
        Payment secure Cashfree checkout par hota hai (UPI, card, netbanking). Payment complete
        hone ke baad neeche tap karke plan sync karein.
      </Text>

      <Pressable style={styles.sync} onPress={() => void setPlan("pro")}>
        <Text style={styles.syncTxt}>I've paid — activate Pro on this device</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#09090b" },
  kicker: { color: NEON, fontSize: 10, fontWeight: "800", letterSpacing: 2 },
  h1: { color: "#fff", fontSize: 28, fontWeight: "800", marginTop: 6 },
  badge: {
    alignSelf: "flex-start",
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgeTxt: { color: "#f87171", fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  badgeOk: {
    alignSelf: "flex-start",
    marginTop: 12,
    backgroundColor: "rgba(196,255,61,0.15)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgeOkTxt: { color: NEON, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  card: {
    marginTop: 18,
    backgroundColor: "#15151a",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "#222",
  },
  cardName: { color: "#fff", fontSize: 16, fontWeight: "800" },
  priceRow: { flexDirection: "row", alignItems: "flex-end", gap: 6, marginTop: 6 },
  price: { color: NEON, fontSize: 34, fontWeight: "900" },
  per: { color: "#888", fontSize: 12, marginBottom: 6 },
  perk: { color: "#cfcfd4", fontSize: 13, marginTop: 8 },
  cta: {
    marginTop: 16,
    backgroundColor: NEON,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  ctaAlt: { backgroundColor: "#fff" },
  ctaTxt: { color: "#09090b", fontWeight: "800", fontSize: 14 },
  ctaTxtAlt: { color: "#09090b" },
  note: { color: "#777", fontSize: 12, marginTop: 18, lineHeight: 18 },
  sync: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  syncTxt: { color: "#aaa", fontSize: 12, fontWeight: "700" },
});
