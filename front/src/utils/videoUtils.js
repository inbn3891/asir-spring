export const fmt = (s) => {
  if (isNaN(s)) return "00:00.0";
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const sec = Math.floor(s % 60).toString().padStart(2, "0");
  const ms = Math.floor((s % 1) * 10);
  return `${m}:${sec}.${ms}`;
};

export async function computeHash(file) {
  // HTTPS 환경
  if (window.crypto?.subtle) {
    const buf = await file.arrayBuffer();
    const hashBuf = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(hashBuf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  // HTTP 환경 폴백
  const raw = `${file.name}-${file.size}-${Date.now()}`;
  return raw.substring(0, 64);
}