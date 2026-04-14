import { useRef, useEffect, useState } from "react";
import { fmt } from "../utils/videoUtils";

export default function Timeline({
  duration, trimStart, trimEnd, currentTime,
  isPlaying, onToggle,
  onTrimStartChange, onTrimEndChange,
  onSeek, onNext,
}) {
  const timelineRef = useRef(null);
  const [isDragging, setIsDragging] = useState(null);

  const timelineClick = (e) => {
    if (!duration) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeek(ratio * duration);
  };

  const startDrag = (e, handle) => {
    e.stopPropagation();
    setIsDragging(handle);
  };

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e) => {
      const rect = timelineRef.current?.getBoundingClientRect();
      if (!rect) return;
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const t = ratio * duration;
      if (isDragging === "start") onTrimStartChange(Math.min(t, trimEnd - 0.5));
      else onTrimEndChange(Math.max(t, trimStart + 0.5));
    };
    const onUp = () => setIsDragging(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
}, [isDragging, duration, trimStart, trimEnd, onTrimStartChange, onTrimEndChange]);

  return (
    <div style={styles.wrap}>
      <div style={styles.timeCodes}>
        <span>{fmt(trimStart)}</span>
        <span style={{ color: "#ff4d6d" }}>{fmt(currentTime)}</span>
        <span>{fmt(trimEnd)}</span>
      </div>

      <div ref={timelineRef} style={styles.timeline} onClick={timelineClick}>
        <div style={styles.trackBg} />
        <div style={{
          ...styles.trackSelected,
          left:  `${(trimStart / (duration || 1)) * 100}%`,
          width: `${((trimEnd - trimStart) / (duration || 1)) * 100}%`,
        }} />
        <div style={{
          ...styles.playhead,
          left: `${(currentTime / (duration || 1)) * 100}%`,
        }} />
        <div
          style={{ ...styles.handle, left: `${(trimStart / (duration || 1)) * 100}%`, background: "#00e5a0" }}
          onMouseDown={(e) => startDrag(e, "start")}
        ><span style={styles.handleLabel}>IN</span></div>
        <div
          style={{ ...styles.handle, left: `${(trimEnd / (duration || 1)) * 100}%`, background: "#ff4d6d" }}
          onMouseDown={(e) => startDrag(e, "end")}
        ><span style={styles.handleLabel}>OUT</span></div>
      </div>

      <div style={styles.controls}>
        <button style={styles.btnSecondary} onClick={onToggle}>
          {isPlaying ? "⏸ 일시정지" : "▶ 재생"}
        </button>
        <div style={styles.trimInfo}>
          절삭 구간: <b>{fmt(trimStart)}</b> → <b>{fmt(trimEnd)}</b>
          <span style={{ color: "#aaa", marginLeft: 8 }}>({fmt(trimEnd - trimStart)} 구간)</span>
        </div>
        <button style={styles.btnPrimary} onClick={onNext}>
          다음: AI 탐지 →
        </button>
      </div>
    </div>
  );
}

const styles = {
  wrap: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 16, padding: "20px 24px",
  },
  timeCodes: {
    display: "flex", justifyContent: "space-between",
    fontSize: 12, color: "#888", marginBottom: 12, fontFamily: "monospace",
  },
  timeline: { position: "relative", height: 48, cursor: "crosshair", userSelect: "none" },
  trackBg: {
    position: "absolute", top: "50%", left: 0, right: 0,
    height: 6, marginTop: -3,
    background: "rgba(255,255,255,0.1)", borderRadius: 3,
  },
  trackSelected: {
    position: "absolute", top: "50%", height: 6, marginTop: -3,
    background: "linear-gradient(90deg, #00e5a0, #ff4d6d)",
    borderRadius: 3,
  },
  playhead: {
    position: "absolute", top: 0, bottom: 0,
    width: 2, background: "#fff",
    transform: "translateX(-50%)",
    boxShadow: "0 0 6px #fff", pointerEvents: "none",
  },
  handle: {
    position: "absolute", top: "50%",
    width: 16, height: 32, marginTop: -16, marginLeft: -8,
    borderRadius: 6, cursor: "ew-resize",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 2, boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
  },
  handleLabel: { fontSize: 9, fontWeight: 800, color: "#000" },
  controls: { display: "flex", alignItems: "center", gap: 12, marginTop: 16, flexWrap: "wrap" },
  trimInfo: { flex: 1, fontSize: 13, color: "#aaa" },
  btnPrimary: {
    background: "linear-gradient(135deg, #ff4d6d, #ff8c42)",
    border: "none", borderRadius: 10, padding: "10px 20px",
    color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer",
  },
  btnSecondary: {
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: 10, padding: "10px 20px",
    color: "#ccc", fontWeight: 600, fontSize: 14, cursor: "pointer",
  },
};