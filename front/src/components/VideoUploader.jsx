import { useRef } from "react";

export default function VideoUploader({ onFile }) {
  const fileInputRef = useRef(null);

  const handleDrop = (e) => {
    e.preventDefault();
    onFile(e.dataTransfer.files[0]);
  };

  return (
    <div
      style={styles.dropzone}
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      onClick={() => fileInputRef.current?.click()}
    >
      <div style={styles.icon}>🎥</div>
      <p style={styles.title}>영상을 드래그하거나 클릭해서 업로드</p>
      <p style={styles.sub}>MP4, MOV, AVI 지원</p>
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        style={{ display: "none" }}
        onChange={(e) => onFile(e.target.files[0])}
      />
    </div>
  );
}

const styles = {
  dropzone: {
    border: "2px dashed rgba(255,77,109,0.4)",
    borderRadius: 20,
    padding: "80px 40px",
    textAlign: "center",
    cursor: "pointer",
    background: "rgba(255,77,109,0.03)",
  },
  icon:  { fontSize: 64, marginBottom: 16 },
  title: { fontSize: 20, fontWeight: 700, margin: "0 0 8px", color: "#e8eaf0" },
  sub:   { color: "#666", margin: 0, fontSize: 14 },
};