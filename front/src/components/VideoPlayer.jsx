import { forwardRef } from "react";

const VideoPlayer = forwardRef(function VideoPlayer(
  { src, isPlaying, onToggle, aiResults, MODELS },
  ref
) {
  return (
    <div style={styles.wrap}>
      <video
        ref={ref}
        src={src}
        style={styles.video}
        onClick={onToggle}
      />

      {!isPlaying && (
        <div style={styles.overlay} onClick={onToggle}>
          <div style={styles.playBtn}>▶</div>
        </div>
      )}

      {Object.entries(aiResults).map(([id, r]) => {
        if (!r.detected || !r.bbox) return null;
        const m = MODELS.find((x) => x.id === id);
        return (
          <div
            key={id}
            style={{
              ...styles.bbox,
              left:   `${(r.bbox.x / 640) * 100}%`,
              top:    `${(r.bbox.y / 360) * 100}%`,
              width:  `${(r.bbox.w / 640) * 100}%`,
              height: `${(r.bbox.h / 360) * 100}%`,
            }}
          >
            <span style={styles.bboxLabel}>
              {m?.emoji} {m?.label} {Math.round(r.confidence * 100)}%
            </span>
          </div>
        );
      })}
    </div>
  );
});

export default VideoPlayer;

const styles = {
  wrap: {
    position: "relative", borderRadius: 16,
    overflow: "hidden", background: "#000",
    aspectRatio: "16/9", cursor: "pointer",
  },
  video:   { width: "100%", height: "100%", objectFit: "contain", display: "block" },
  overlay: {
    position: "absolute", inset: 0,
    display: "flex", alignItems: "center", justifyContent: "center",
    background: "rgba(0,0,0,0.3)",
  },
  playBtn: {
    width: 64, height: 64, borderRadius: "50%",
    background: "rgba(255,77,109,0.9)",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 24, color: "#fff",
  },
  bbox: {
    position: "absolute",
    border: "2px solid #ff4d6d",
    borderRadius: 4,
    boxShadow: "0 0 8px rgba(255,77,109,0.6)",
    pointerEvents: "none",
  },
  bboxLabel: {
    position: "absolute", top: -24, left: 0,
    background: "#ff4d6d", color: "#fff",
    fontSize: 11, fontWeight: 700,
    padding: "2px 6px", borderRadius: 4,
    whiteSpace: "nowrap",
  },
};