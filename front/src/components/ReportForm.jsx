import { useState } from "react";

export default function ReportForm({ video, aiResults, MODELS }) {
  const [plate, setPlate]           = useState("");
  const [plateError, setPlateError] = useState("");
  const [uploadUrl, setUploadUrl]   = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult]         = useState(null);

  const validatePlate = (v) => {
    const ok = /^\d{2,3}[가-힣]\d{4}$/.test(v);
    setPlateError(ok || v === "" ? "" : "형식 오류 (예: 12가3456)");
    return ok;
  };

  const handleSubmit = async () => {
    if (!validatePlate(plate)) return;
    setSubmitting(true);
    setResult(null);
    try {
      const mockUrl = uploadUrl || `https://cdn.asir.kr/videos/${video.hash}.mp4`;
      const res = await fetch("/api/v1/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          licensePlate: plate,
          videoUrl: mockUrl,
          videoHash: video.hash,
        }),
      });
      if (res.ok) {
        const id = await res.json();
        setResult({ ok: true, message: "제보가 성공적으로 접수됐어요!", id });
      } else {
        const msg = await res.text();
        setResult({ ok: false, message: msg || "제보 실패" });
      }
    } catch {
      setResult({ ok: false, message: "서버 연결 실패. 잠시 후 다시 시도해주세요." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.card}>
      <h3 style={styles.title}>📋 제보 정보 입력</h3>

        {Object.keys(aiResults).length > 0 && (
        <div style={styles.detectionSummary}>
            <h4 style={{ margin: "0 0 10px", color: "#ff4d6d" }}>
            ⚠️ {MODELS.filter(m => aiResults[m.id]?.detected).length}건 위반 감지
            </h4>
            {MODELS.filter(m => aiResults[m.id]?.detected).map((m) => (
            <div key={m.id} style={styles.detectionItem}>
                <span>{m.emoji} {m.label}</span>
                <span style={styles.confBadge}>
                {Math.round(aiResults[m.id]?.confidence * 100)}%
                </span>
            </div>
            ))}
        </div>
        )}

      <label style={styles.label}>차량 번호판</label>
      <input
        style={{ ...styles.input, borderColor: plateError ? "#ff4d6d" : "rgba(255,255,255,0.15)" }}
        value={plate}
        onChange={(e) => { setPlate(e.target.value); if (e.target.value) validatePlate(e.target.value); }}
        placeholder="12가3456"
        maxLength={8}
      />
      {plateError && <p style={styles.error}>{plateError}</p>}

      <label style={styles.label}>영상 URL</label>
      <input
        style={styles.input}
        value={uploadUrl}
        onChange={(e) => setUploadUrl(e.target.value)}
        placeholder="https://cdn.asir.kr/videos/..."
      />

      <div style={styles.hashInfo}>
        <span>영상 해시</span>
        <code style={styles.hash}>{video?.hash?.slice(0, 16)}…</code>
      </div>

      <button
        style={{
          ...styles.btnSubmit,
          opacity: submitting || !plate || plateError ? 0.5 : 1,
          cursor:  submitting || !plate || plateError ? "not-allowed" : "pointer",
        }}
        onClick={handleSubmit}
        disabled={submitting || !plate || !!plateError}
      >
        {submitting ? "⏳ 제보 전송 중…" : "🚨 제보 전송"}
      </button>

      {result && (
        <div style={{
          ...styles.resultBox,
          borderColor: result.ok ? "#00e5a0" : "#ff4d6d",
          background:  result.ok ? "rgba(0,229,160,0.08)" : "rgba(255,77,109,0.08)",
        }}>
          <p style={{ margin: 0, color: result.ok ? "#00e5a0" : "#ff4d6d" }}>
            {result.ok ? "✅" : "❌"} {result.message}
          </p>
          {result.ok && (
            <p style={{ margin: "6px 0 0", color: "#aaa", fontSize: 13 }}>
              접수 번호: #{result.id}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

const styles = {
    label: { display: "block", fontSize: 12, color: "#888", marginBottom: 6, marginTop: 14 },
  card: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 16, padding: 24,
  },
  title: { margin: "0 0 16px", fontSize: 16, fontWeight: 700, color: "#e8eaf0" },
  detectionSummary: {
    background: "rgba(255,77,109,0.06)",
    border: "1px solid rgba(255,77,109,0.3)",
    borderRadius: 12, padding: 16, marginBottom: 16,
  },
confBadge: {
  background: "rgba(255,77,109,0.2)",
  color: "#ff4d6d", fontSize: 12, fontWeight: 700,
  padding: "2px 8px", borderRadius: 20,
},


detectionItem: { 
  display: "flex", alignItems: "center", 
  justifyContent: "space-between",
  padding: "6px 0", fontSize: 14, color: "#e8eaf0",
  borderBottom: "1px solid rgba(255,77,109,0.1)",
},

  error: { margin: "4px 0 0", fontSize: 12, color: "#ff4d6d" },
  hashInfo: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    marginTop: 12, padding: "8px 12px",
    background: "rgba(255,255,255,0.03)", borderRadius: 8,
    fontSize: 12, color: "#666",
  },
  hash: {
    fontFamily: "monospace", fontSize: 11, color: "#888",
    background: "rgba(255,255,255,0.06)", padding: "2px 8px", borderRadius: 4,
  },
  btnSubmit: {
    marginTop: 20, width: "100%",
    background: "linear-gradient(135deg, #ff4d6d, #ff8c42)",
    border: "none", borderRadius: 12, padding: "14px",
    color: "#fff", fontWeight: 800, fontSize: 15,
    boxShadow: "0 4px 20px rgba(255,77,109,0.35)",
    transition: "opacity 0.2s",
  },
  resultBox: { marginTop: 16, padding: 16, borderRadius: 12, border: "1px solid" },
};