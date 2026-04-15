import { useState } from "react";
import { styles } from "../styles/VideoAnalyzerStyles";
import { MODELS } from "../features/ai/modelList";

export default function AIResultCard({
  aiResults,
  aiRunning,
  overallProgress,
  pipelinePhase,
  detectronProgress,
  yoloProgress,
  lstmProgress,
  phaseTiming,
  evidenceImages,
  onRun,
}) {
  const [expandedEvidence, setExpandedEvidence] = useState(null);

  // 모델별 현재 진행률
  function getModelProgress(modelId) {
    const yoloKeys = ['signal', 'helmet', 'center', 'lane'];
    if (modelId === 'classify') {
      if (pipelinePhase === 'lstm') return { status: '분석중', progress: lstmProgress };
      if (['done', 'evidence'].includes(pipelinePhase)) return { status: '완료', progress: 100 };
      return { status: '대기', progress: 0 };
    }
    if (yoloKeys.includes(modelId)) {
      if (pipelinePhase === 'detectron2') return { status: '대기', progress: 0 };
      if (pipelinePhase === 'yolo') return yoloProgress?.[modelId] || { status: '대기', progress: 0 };
      if (['iou', 'lstm', 'evidence', 'done'].includes(pipelinePhase)) return { status: '완료', progress: 100 };
      return { status: '대기', progress: 0 };
    }
    return null;
  }

  function getProgressColor(status) {
    if (status === '완료') return '#00e5a0';
    if (status === '분석중') return '#f0c040';
    return 'rgba(255,255,255,0.15)';
  }

  function getStatusLabel(modelId, progress) {
    if (!progress) return '대기';
    if (progress.status === '완료') {
      const r = aiResults[modelId];
      if (!r) return '완료';
      if (modelId === 'classify') {
        if (r.detected) return r.violationClass === 2 ? '심각위반' : '위반';
        return '정상';
      }
      if (r.detected) return `위반감지 (${r.overlapFrames}프레임)`;
      return '이상없음';
    }
    if (progress.status === '분석중') return `분석중 ${progress.progress}%`;
    return '대기';
  }

  function getStatusColor(modelId, progress) {
    if (!progress || progress.status === '대기') return '#555';
    if (progress.status === '분석중') return '#f0c040';
    const r = aiResults[modelId];
    if (r?.detected) return '#ff4d6d';
    return '#00e5a0';
  }

  // 단계별 phase 라벨
  function getPhaseLabel() {
    switch (pipelinePhase) {
      case 'detectron2': return '1/5 차선 분석 (Detectron2)';
      case 'yolo':       return '2/5 객체 탐지 (YOLOv5)';
      case 'iou':        return '3/5 IoU 비교';
      case 'lstm':       return '4/5 위반 분류 (LSTM)';
      case 'evidence':   return '5/5 증거 이미지 생성';
      case 'done':       return '분석 완료';
      default:           return '';
    }
  }

  return (
    <div style={styles.card}>
      <h3 style={styles.cardTitle}>🤖 AI 위반 탐지</h3>
      <p style={styles.cardSub}>Detectron2 + YOLOv5 연동 (IoU 기반)</p>

      {/* ── Detectron2 차선 분석 ── */}
      {(aiRunning || pipelinePhase === 'done') && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: "#888" }}>🛣️ Detectron2 차선 분석</span>
            {phaseTiming?.detectron2 != null && (
              <span style={{ fontSize: 11, color: '#00e5a0' }}>
                ⏱ {formatTime(phaseTiming.detectron2)}
              </span>
            )}
          </div>
          {[
            { id: "traffic", label: "교통영역탐지" },
            { id: "signal",  label: "신호위반 차선" },
            { id: "center",  label: "중앙선" },
            { id: "lane",    label: "진로변경 차선" },
          ].map(({ id, label }) => {
            const d = detectronProgress?.[id];
            const isDone = d?.status === '완료';
            return (
              <div key={id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: "#aaa", width: 100 }}>{label}</span>
                <div style={{ flex: 1, height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 2 }}>
                  <div style={{
                    height: "100%",
                    width: d ? `${d.progress}%` : "0%",
                    background: isDone ? "#00e5a0" : "#f0c040",
                    borderRadius: 2,
                    transition: "width 0.3s",
                  }} />
                </div>
                <span style={{ fontSize: 11, color: isDone ? "#00e5a0" : "#888", width: 60, textAlign: 'right' }}>
                  {isDone ? '완료' : d?.status === '분석중' ? `${d.progress}%` : '대기'}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* ── YOLO + LSTM 모델 카드 목록 ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: "#888" }}>🎯 객체 탐지 + 위반 분류</span>
        {phaseTiming?.yolo != null && (
          <span style={{ fontSize: 11, color: '#00e5a0' }}>
            ⏱ YOLO {formatTime(phaseTiming.yolo)} / LSTM {formatTime(phaseTiming.lstm)}
          </span>
        )}
      </div>

      <div style={styles.modelList}>
        {MODELS.filter(m => m.visible).map((m) => {
          const r = aiResults[m.id];
          const prog = aiRunning ? getModelProgress(m.id) : null;
          const isDone = !aiRunning && r;
          const hasEvidence = evidenceImages?.[m.id];

          return (
            <div key={m.id} style={{ ...styles.modelItem, flexDirection: 'column', alignItems: 'stretch' }}>
              {/* 모델 헤더 */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 18, width: 24 }}>{m.emoji}</span>
                <span style={{ flex: 1, fontSize: 14 }}>{m.label}</span>
                <span style={{ fontSize: 12, fontWeight: 600 }}>
                  {aiRunning && prog ? (
                    <span style={{ color: getStatusColor(m.id, prog) }}>
                      {getStatusLabel(m.id, prog)}
                    </span>
                  ) : isDone ? (
                    r.detected
                      ? <span style={{ color: "#ff4d6d" }}>
                          {m.id === "classify" && r.violationClass != null
                            ? r.violationClass === 2 ? "심각위반" : "위반"
                            : "위반감지"
                          } {Math.round(r.confidence * 100)}%
                        </span>
                      : <span style={{ color: "#00e5a0" }}>이상없음</span>
                  ) : (
                    <span style={{ color: "#555" }}>대기</span>
                  )}
                </span>
              </div>

              {/* 진행 바 (실행 중) */}
              {aiRunning && prog && (
                <div style={{ marginLeft: 32, marginTop: 6 }}>
                  <div style={{ height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 2 }}>
                    <div style={{
                      height: "100%",
                      width: `${prog.progress}%`,
                      background: getProgressColor(prog.status),
                      borderRadius: 2,
                      transition: "width 0.3s",
                    }} />
                  </div>
                </div>
              )}

              {/* 위반 상세 정보 (완료 후, 위반 감지된 경우) */}
              {isDone && r.detected && m.id !== 'classify' && (
                <div style={{
                  marginLeft: 32,
                  marginTop: 8,
                  padding: '8px 10px',
                  background: 'rgba(255, 77, 109, 0.08)',
                  borderRadius: 6,
                  borderLeft: '3px solid #ff4d6d',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#ccc', marginBottom: 4 }}>
                    <span>위반 프레임: {r.overlapFrames}/{r.totalFrames}</span>
                    <span>마스크 겹침: {r.bestFrame ? ((r.bestFrame.overlapRatio || r.bestFrame.iou || 0) * 100).toFixed(1) : 0}%</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#999', marginBottom: 6 }}>
                    최대 겹침 시점: {r.bestFrame ? `${r.bestFrame.time.toFixed(2)}초` : '-'}
                  </div>

                  {/* 증거 이미지 토글 버튼 */}
                  {hasEvidence && (
                    <button
                      onClick={() => setExpandedEvidence(expandedEvidence === m.id ? null : m.id)}
                      style={{
                        background: 'rgba(255, 77, 109, 0.15)',
                        border: '1px solid rgba(255, 77, 109, 0.3)',
                        color: '#ff4d6d',
                        padding: '4px 10px',
                        borderRadius: 4,
                        cursor: 'pointer',
                        fontSize: 11,
                        width: '100%',
                      }}
                    >
                      {expandedEvidence === m.id ? '▲ 증거 이미지 닫기' : '▼ 증거 이미지 보기'}
                    </button>
                  )}

                  {/* 증거 이미지 */}
                  {expandedEvidence === m.id && hasEvidence && (
                    <div style={{ marginTop: 8 }}>
                      <img
                        src={evidenceImages[m.id]}
                        alt={`${m.label} 위반 증거`}
                        style={{
                          width: '100%',
                          borderRadius: 6,
                          border: '1px solid rgba(255,255,255,0.1)',
                        }}
                      />
                      <div style={{
                        display: 'flex',
                        gap: 8,
                        marginTop: 6,
                        fontSize: 10,
                        color: '#888',
                      }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ width: 8, height: 8, background: '#0096ff', borderRadius: 2, display: 'inline-block' }} />
                          차선/영역
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ width: 8, height: 8, background: '#ff4d6d', borderRadius: 2, display: 'inline-block' }} />
                          위반 객체
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ width: 8, height: 8, background: 'rgba(255,77,109,0.4)', borderRadius: 2, display: 'inline-block' }} />
                          겹침 영역
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── 전체 진행 바 + 타이밍 ── */}
      {aiRunning && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: "#888" }}>{getPhaseLabel()}</span>
            <span style={{ fontSize: 11, color: "#888" }}>{overallProgress}%</span>
          </div>
          <div style={styles.progressWrap}>
            <div style={{ ...styles.progressBar, width: `${overallProgress}%` }} />
          </div>
        </div>
      )}

      {/* ── 완료 후 타이밍 요약 ── */}
      {!aiRunning && phaseTiming?.total != null && (
        <div style={{
          marginTop: 12,
          padding: '8px 12px',
          background: 'rgba(0, 229, 160, 0.06)',
          borderRadius: 6,
          border: '1px solid rgba(0, 229, 160, 0.15)',
        }}>
          <div style={{ fontSize: 12, color: '#00e5a0', fontWeight: 600, marginBottom: 6 }}>
            ⏱ 총 분석 시간: {formatTime(phaseTiming.total)}
          </div>
          <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#888', flexWrap: 'wrap' }}>
            <span>Detectron2: {formatTime(phaseTiming.detectron2)}</span>
            <span>YOLOv5: {formatTime(phaseTiming.yolo)}</span>
            <span>IoU: {formatTime(phaseTiming.iou)}</span>
            <span>LSTM: {formatTime(phaseTiming.lstm)}</span>
          </div>
        </div>
      )}

      {/* ── 버튼 ── */}
      {!aiRunning && Object.keys(aiResults).length === 0 && (
        <button style={styles.btnAI} onClick={onRun}>⚡ AI 탐지 시작</button>
      )}
      {!aiRunning && Object.keys(aiResults).length > 0 && (
        <button style={{ ...styles.btnSecondary, width: "100%", marginTop: 12 }} onClick={onRun}>
          🔄 재탐지
        </button>
      )}
    </div>
  );
}

function formatTime(seconds) {
  if (seconds == null) return '-';
  if (seconds < 1) return `${(seconds * 1000).toFixed(0)}ms`;
  if (seconds < 60) return `${seconds}초`;
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(0);
  return `${m}분 ${s}초`;
}
