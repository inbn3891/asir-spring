import { styles } from "../styles/VideoAnalyzerStyles";

export default function Header({ step }) {
  return (
    <header style={styles.header}>
      <div style={styles.logo}>
        <span style={styles.logoA}>A</span>
        <span style={styles.logoSIR}>-SIR</span>
      </div>
      <p style={styles.headerSub}>교통법규 위반 AI 탐지 & 제보 시스템</p>
      <div style={styles.steps}>
        {["업로드", "편집", "AI 탐지", "제보"].map((label, i) => (
          <div key={i} style={styles.stepItem}>
            <div style={{
              ...styles.stepDot,
              background: step > i + 1 ? "#00e5a0" : step === i + 1 ? "#ff4d6d" : "rgba(255,255,255,0.15)",
              boxShadow: step === i + 1 ? "0 0 12px #ff4d6d" : "none",
            }}>
              {step > i + 1 ? "✓" : i + 1}
            </div>
            <span style={{ ...styles.stepLabel, opacity: step >= i + 1 ? 1 : 0.35 }}>{label}</span>
            {i < 3 && <div style={styles.stepLine} />}
          </div>
        ))}
      </div>
    </header>
  );
}