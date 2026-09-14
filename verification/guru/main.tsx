import { createRoot } from "react-dom/client";
import { LiveVoiceChat } from "../../src/components/LiveVoiceChat";
import { fixture, setPlan } from "./fixtures";
import "../../src/styles.css";

createRoot(document.getElementById("root")!).render(
  <main style={{ maxWidth: 560, margin: "0 auto", padding: "20px 16px 60px" }}>
    <aside style={{ fontSize: 12, marginBottom: 20 }}>
      <p>UI verification · synthetic records · no external AI calls</p>
      <label>
        Test plan{" "}
        <select aria-label="Test plan" defaultValue="pro" onChange={(e) => setPlan(e.target.value)}>
          {["signed-out", "free", "weekly", "pro", "lifetime", "expired", "canceled"].map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </label>{" "}
      <label>
        Test mic{" "}
        <select
          aria-label="Test mic"
          defaultValue="denied"
          onChange={(e) => {
            fixture.mic = e.target.value;
          }}
        >
          <option value="denied">Denied</option>
          <option value="allowed">Allowed</option>
        </select>
      </label>
    </aside>
    <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 20 }}>Your money brain</h1>
    <LiveVoiceChat />
  </main>,
);
