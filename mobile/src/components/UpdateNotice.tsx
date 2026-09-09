import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Linking from "expo-linking";
import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { APP_VERSION, MOBILE_DOWNLOAD_URL, RELEASE_NOTES } from "../lib/release";

const SEEN_KEY = "moneyfyi_seen_release";

export default function UpdateNotice() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem(SEEN_KEY).then((seen) => setOpen(seen !== APP_VERSION)).catch(() => setOpen(true));
  }, []);
  const close = () => { void AsyncStorage.setItem(SEEN_KEY, APP_VERSION); setOpen(false); };
  return <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
    <View style={styles.backdrop}><View style={styles.card}>
      <View style={styles.header}><View><Text style={styles.eyebrow}>NEW UPDATE</Text><Text style={styles.title}>MONEY.FYI v{APP_VERSION}</Text></View><Pressable onPress={close} style={styles.close}><Text style={styles.closeText}>×</Text></Pressable></View>
      <Text style={styles.subtitle}>New features and fixes are ready. Download the latest app version.</Text>
      <ScrollView style={styles.notes}>{RELEASE_NOTES.map((note) => <View key={note} style={styles.note}><Text style={styles.dot}>•</Text><Text style={styles.noteText}>{note}</Text></View>)}</ScrollView>
      <View style={styles.actions}><Pressable onPress={close} style={styles.later}><Text style={styles.laterText}>LATER</Text></Pressable><Pressable onPress={() => void Linking.openURL(MOBILE_DOWNLOAD_URL)} style={styles.download}><Text style={styles.downloadText}>DOWNLOAD UPDATE</Text></Pressable></View>
    </View></View>
  </Modal>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.78)", justifyContent: "center", padding: 20 },
  card: { backgroundColor: "#15151a", borderRadius: 24, borderWidth: 1, borderColor: "#3b5320", padding: 20 },
  header: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  eyebrow: { color: "#c4ff3d", fontSize: 10, fontWeight: "800", letterSpacing: 1.5 },
  title: { color: "#fff", fontSize: 24, fontWeight: "800", marginTop: 7 },
  close: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#24242b", alignItems: "center", justifyContent: "center" },
  closeText: { color: "#fff", fontSize: 24, lineHeight: 25 },
  subtitle: { color: "#a1a1aa", fontSize: 13, lineHeight: 20, marginTop: 12 },
  notes: { maxHeight: 190, marginTop: 18 },
  note: { flexDirection: "row", gap: 8, marginBottom: 12 },
  dot: { color: "#c4ff3d", fontSize: 18, lineHeight: 18 },
  noteText: { color: "#f4f4f5", flex: 1, fontSize: 13, lineHeight: 19 },
  actions: { flexDirection: "row", gap: 8, marginTop: 8 },
  later: { flex: 1, backgroundColor: "#24242b", borderRadius: 14, alignItems: "center", paddingVertical: 13 },
  laterText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  download: { flex: 1.5, backgroundColor: "#c4ff3d", borderRadius: 14, alignItems: "center", paddingVertical: 13 },
  downloadText: { color: "#111", fontSize: 12, fontWeight: "800" },
});