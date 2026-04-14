import { useState, useRef, useEffect, useCallback } from "react";
import VideoUploader from "../components/VideoUploader";
import VideoPlayer from "../components/VideoPlayer";
import Timeline from "../components/Timeline";
import ReportForm from "../components/ReportForm";
import { MODELS } from "../features/ai/modelList";
import { runYolo, runLstm } from "../features/ai/ModelRunner";
import { computeHash } from "../utils/videoUtils";

const MODEL_FILE_MAP = {
  signal:   "model_객체탐지_신호위반",
  helmet:   "model_객체탐지_안전모",
  center:   "model_객체탐지_중앙선침범",
  lane:     "model_객체탐지_진로변경",
};

export default function VideoAnalyzerPage() {
  const [video, setVideo]             = useState(null);
  const [trimStart, setTrimStart]     = useState(0);
  const [trimEnd, setTrimEnd]         = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying]     = useState(false);
  const [aiResults, setAiResults]     = useState({});
  const [aiRunning, setAiRunning]     = useState(false);
  const [aiProgress, setAiProgress]   = useState(0);
  const [step, setStep]               = useState(1);

  const videoRef = useRef(null);

  /* ── 파일 로드 ── */
  const handleFile = useCallback(async (file) => {
    if (!file || !file.type.startsWith("video/")) return;
    const url  = URL.createObjectURL(file);
    const hash = await computeHash(file);
    setVideo({ file, url, hash, duration: 0 });
    setAiResults({});
    setStep(2);
  }, []);

  /* ── 영상 메타 ── */
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !video) return;
    const onLoaded = () => {
      setVideo((v) => ({ ...v, duration: el.duration }));
      setTrimStart(0);
      setTrimEnd(el.duration);
    };
    el.addEventListener("loadedmetadata", onLoaded);
    return () => el.removeEventListener("loadedmetadata", onLoaded);
  }, [video?.url, video]);

  /* ── 시간 업데이트 ── */
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const onTime = () => {
      setCurrentTime(el.currentTime);
      if (el.currentTime >= trimEnd) {
        el.pause(); el.currentTime = trimStart; setIsPlaying(false);
      }
    };
    el.addEventListener("timeupdate", onTime);
    return () => el.removeEventListener("timeupdate", onTime);
  }, [trimEnd, trimStart]);

  /* ── 재생/정지 ── */
  const togglePlay = () => {
    const el = videoRef.current;
    if (!el) return;
    if (isPlaying) { el.pause(); setIsPlaying(false); }
    else {
      if (el.currentTime >= trimEnd || el.currentTime < trimStart)
        el.currentTime = trimStart;
      el.play(); setIsPlaying(true);
    }
  };

  const handleSeek = (t) => {
    if (videoRef.current) videoRef.current.currentTime = t;
  };

  const handleTrimStart = (t) => {
    setTrimStart(t);
    if (videoRef.current) videoRef.current.currentTime = t;
  };

  /* ── AI 탐지 ── */
  const runAI = async () => {
    setAiRunning(true);
    setAiResults({});
    setAiProgress(0);

    const el = videoRef.current;
    const results = {};

    for (let i = 0; i < MODELS.length; i++) {
      const m = MODELS[i];
      let result;
      if (m.type === "yolo") {
        result = await runYolo(MODEL_FILE_MAP[m.id], el);
      } else {
        result = await runLstm(el);
      }
      results[m.id] = result;
      setAiProgress(Math.round(((i + 1) / MODELS.length) * 100));
      setAiResults({ ...results });
    }

    setAiRunning(false);
    setStep(4);
  };

  const detections = MODELS.filter((m) => aiResults[m.id]?.detected);

  return (
    <div style={styles.root}>
      <div style={styles.bgGrid} />

      {/* 헤더 */}
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

      <main style={styles.main}>
        {/* STEP 1 */}
        {step === 1 && <VideoUploader onFile={handleFile} />}

        {/* STEP 2~4 */}
        {video && step >= 2 && (
          <div style={styles.workspace}>
            <div style={styles.leftPanel}>
              <VideoPlayer
                ref={videoRef}
                src={video.url}
                isPlaying={isPlaying}
                onToggle={togglePlay}
                aiResults={aiResults}
                MODELS={MODELS}
              />
              <Timeline
                duration={video.duration}
                trimStart={trimStart}
                trimEnd={trimEnd}
                currentTime={currentTime}
                isPlaying={isPlaying}
                onToggle={togglePlay}
                onTrimStartChange={handleTrimStart}
                onTrimEndChange={setTrimEnd}
                onSeek={handleSeek}
                onNext={() => setStep(3)}
              />
            </div>

            <div style={styles.rightPanel}>
              {/* AI 탐지 카드 */}
              {step >= 3 && (
                <div style={styles.card}>
                  <h3 style={styles.cardTitle}>🤖 AI 위반 탐지</h3>
                  <p style={styles.cardSub}>브라우저에서 직접 추론 (엣지 AI)</p>

                  <div style={styles.modelList}>
                    {MODELS.map((m) => {
                      const r = aiResults[m.id];
                      return (
                        <div key={m.id} style={styles.modelItem}>
                          <span style={{ fontSize: 18, width: 24 }}>{m.emoji}</span>
                          <span style={{ flex: 1, fontSize: 14 }}>{m.label}</span>
                          <span style={{ fontSize: 12, fontWeight: 600 }}>
                            {aiRunning && !r ? (
                              <span style={{ color: "#f0c040" }}>분석중…</span>
                            ) : r ? (
                              r.detected
                                ? <span style={{ color: "#ff4d6d" }}>탐지 {Math.round(r.confidence * 100)}%</span>
                                : <span style={{ color: "#00e5a0" }}>이상없음</span>
                            ) : (
                              <span style={{ color: "#555" }}>대기</span>
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {aiRunning && (
                    <div style={styles.progressWrap}>
                      <div style={{ ...styles.progressBar, width: `${aiProgress}%` }} />
                    </div>
                  )}

                  {!aiRunning && Object.keys(aiResults).length === 0 && (
                    <button style={styles.btnAI} onClick={runAI}>⚡ AI 탐지 시작</button>
                  )}
                  {!aiRunning && Object.keys(aiResults).length > 0 && (
                    <button style={{ ...styles.btnSecondary, width: "100%", marginTop: 12 }} onClick={runAI}>
                      🔄 재탐지
                    </button>
                  )}
                </div>
              )}

              {/* 제보 폼 */}
              {step === 4 && (
                <ReportForm video={video} detections={detections} MODELS={MODELS} aiResults={aiResults} />
              )}

              {/* 다른 영상 */}
              {step === 4 && (
                <button
                  style={{ ...styles.btnSecondary, width: "100%", marginTop: 8 }}
                  onClick={() => { setVideo(null); setStep(1); setAiResults({}); }}
                >
                  + 다른 영상 제보하기
                </button>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

const styles = {
  root: { minHeight: "100vh", background: "#0a0c10", color: "#e8eaf0", fontFamily: "'Pretendard', 'Noto Sans KR', sans-serif", position: "relative", overflow: "hidden" },
  bgGrid: { position: "fixed", inset: 0, backgroundImage: "linear-gradient(rgba(255,77,109,0.04) 1px, transparent 1px),linear-gradient(90deg, rgba(255,77,109,0.04) 1px, transparent 1px)", backgroundSize: "40px 40px", pointerEvents: "none", zIndex: 0 },
  header: { position: "relative", zIndex: 1, padding: "28px 40px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)" },
  logo: { display: "flex", alignItems: "baseline", gap: 2, marginBottom: 4 },
  logoA: { fontSize: 36, fontWeight: 900, color: "#ff4d6d", letterSpacing: -2 },
  logoSIR: { fontSize: 28, fontWeight: 700, color: "#e8eaf0" },
  headerSub: { margin: "0 0 20px", color: "#888", fontSize: 13 },
  steps: { display: "flex", alignItems: "center" },
  stepItem: { display: "flex", alignItems: "center", gap: 8 },
  stepDot: { width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff", transition: "all 0.3s" },
  stepLabel: { fontSize: 13, color: "#ccc", whiteSpace: "nowrap" },
  stepLine: { width: 32, height: 1, background: "rgba(255,255,255,0.12)", margin: "0 4px" },
  main: { position: "relative", zIndex: 1, padding: "32px 40px", maxWidth: 1400, margin: "0 auto" },
  workspace: { display: "grid", gridTemplateColumns: "1fr 360px", gap: 24, alignItems: "start" },
  leftPanel: { display: "flex", flexDirection: "column", gap: 16 },
  rightPanel: { display: "flex", flexDirection: "column", gap: 16 },
  card: { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 },
  cardTitle: { margin: "0 0 4px", fontSize: 16, fontWeight: 700 },
  cardSub: { margin: "0 0 16px", fontSize: 12, color: "#666" },
  modelList: { display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 },
  modelItem: { display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "rgba(255,255,255,0.03)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)" },
  progressWrap: { height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 3, overflow: "hidden", marginBottom: 8 },
  progressBar: { height: "100%", background: "linear-gradient(90deg, #ff4d6d, #ff8c42)", borderRadius: 3, transition: "width 0.3s" },
  btnAI: { width: "100%", background: "linear-gradient(135deg, #ff4d6d, #c23b8a)", border: "none", borderRadius: 12, padding: "14px", color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer" },
  btnSecondary: { background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, padding: "10px 20px", color: "#ccc", fontWeight: 600, fontSize: 14, cursor: "pointer" },
};