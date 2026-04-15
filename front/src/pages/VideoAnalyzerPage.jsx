import { useState, useRef, useEffect, useCallback } from "react";
import VideoUploader from "../components/VideoUploader";
import VideoPlayer from "../components/VideoPlayer";
import Timeline from "../components/Timeline";
import ReportForm from "../components/ReportForm";
import Header from "../components/Header";
import AIResultCard from "../components/AIResultCard";
import { MODELS } from "../features/ai/modelList";
import {
  runAllDetectron2,
  runAllYolo,
  computeAllViolations,
  runLstm,
  aggregateResults,
  captureEvidenceImage,
} from "../features/ai/ModelRunner";
import { computeHash } from "../utils/videoUtils";
import { styles } from "../styles/VideoAnalyzerStyles";

const ANALYSIS_FPS = 3;

export default function VideoAnalyzerPage() {
  const [video, setVideo]           = useState(null);
  const [trimStart, setTrimStart]   = useState(0);
  const [trimEnd, setTrimEnd]       = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying]   = useState(false);
  const [aiResults, setAiResults]   = useState({});
  const [aiRunning, setAiRunning]   = useState(false);
  const [step, setStep]             = useState(1);

  const [pipelinePhase, setPipelinePhase] = useState('');
  const [detectronProgress, setDetectronProgress] = useState({});
  const [yoloProgress, setYoloProgress] = useState({});
  const [lstmProgress, setLstmProgress] = useState(0);
  const [overallProgress, setOverallProgress] = useState(0);
  const [phaseTiming, setPhaseTiming] = useState({});
  const [evidenceImages, setEvidenceImages] = useState({});

  const videoRef = useRef(null);

  const handleFile = useCallback(async (file) => {
    if (!file || !file.type.startsWith("video/")) return;
    const url  = URL.createObjectURL(file);
    const hash = await computeHash(file);
    setVideo({ file, url, hash, duration: 0 });
    setAiResults({});
    setEvidenceImages({});
    setStep(2);
  }, []);

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

  const handleSeek = (t) => { if (videoRef.current) videoRef.current.currentTime = t; };
  const handleTrimStart = (t) => { setTrimStart(t); if (videoRef.current) videoRef.current.currentTime = t; };

  const runAI = async () => {
    const el = videoRef.current;
    if (!el) return;

    const duration = trimEnd - trimStart;
    const sampleCount = Math.max(1, Math.round(duration * ANALYSIS_FPS));
    console.log(`분석 구간: ${duration.toFixed(1)}초, 프레임 수: ${sampleCount} (${ANALYSIS_FPS}fps)`);

    setAiRunning(true);
    setAiResults({});
    setEvidenceImages({});
    setPipelinePhase('detectron2');
    setDetectronProgress({});
    setYoloProgress({});
    setLstmProgress(0);
    setOverallProgress(0);
    setPhaseTiming({});

    const timing = {};

    try {
      /* ── 1단계: Detectron2 ── */
      const t1 = performance.now();
      const terrainCache = await runAllDetectron2(
        el, trimStart, trimEnd, sampleCount,
        ({ modelId, frameIndex, sampleCount: sc, totalProgress }) => {
          setDetectronProgress(prev => ({
            ...prev,
            [modelId]: {
              status: '분석중',
              currentFrame: frameIndex + 1,
              totalFrames: sc,
              progress: Math.round(((frameIndex + 1) / sc) * 100),
            },
          }));
          setOverallProgress(Math.round(totalProgress * 0.35));
        }
      );
      timing.detectron2 = +((performance.now() - t1) / 1000).toFixed(1);

      setDetectronProgress(prev => {
        const updated = { ...prev };
        for (const key of Object.keys(updated)) {
          updated[key] = { ...updated[key], status: '완료', progress: 100 };
        }
        return updated;
      });
      setPhaseTiming(prev => ({ ...prev, detectron2: timing.detectron2 }));

      /* ── 2단계: YOLOv5 ── */
      setPipelinePhase('yolo');
      const t2 = performance.now();
      const objectCache = await runAllYolo(
        el, trimStart, trimEnd, sampleCount,
        ({ modelId, frameIndex, sampleCount: sc, totalProgress }) => {
          setYoloProgress(prev => ({
            ...prev,
            [modelId]: {
              status: '분석중',
              currentFrame: frameIndex + 1,
              totalFrames: sc,
              progress: Math.round(((frameIndex + 1) / sc) * 100),
            },
          }));
          setOverallProgress(35 + Math.round(totalProgress * 0.35));
        }
      );
      timing.yolo = +((performance.now() - t2) / 1000).toFixed(1);

      setYoloProgress(prev => {
        const updated = { ...prev };
        for (const key of Object.keys(updated)) {
          updated[key] = { ...updated[key], status: '완료', progress: 100 };
        }
        return updated;
      });
      setPhaseTiming(prev => ({ ...prev, yolo: timing.yolo }));

      /* ── 3단계: 위반 판정 (유형별) ── */
      setPipelinePhase('iou');
      setOverallProgress(75);
      const t3 = performance.now();
      const violationResults = computeAllViolations(terrainCache, objectCache, sampleCount);
      timing.iou = +((performance.now() - t3) / 1000).toFixed(2);
      setPhaseTiming(prev => ({ ...prev, iou: timing.iou }));

      // ===== 디버그 =====
      console.group('🛣️ Detectron2 결과 요약');
      for (let s = 0; s < sampleCount; s++) {
        const frame = terrainCache[s];
        const found = ['traffic', 'signal', 'center', 'lane']
          .filter(k => frame[k]?.found)
          .map(k => `${k}(${frame[k].regions.length}개)`);
        if (found.length > 0) console.log(`프레임 ${s} (${frame.time.toFixed(2)}초): ${found.join(', ')}`);
      }
      console.groupEnd();

      console.group('🎯 YOLO 결과 요약');
      for (let s = 0; s < sampleCount; s++) {
        const frame = objectCache[s];
        const detected = ['signal', 'helmet', 'center', 'lane']
          .filter(k => frame[k]?.detected)
          .map(k => `${k}(${(frame[k].confidence * 100).toFixed(0)}%)`);
        if (detected.length > 0) console.log(`프레임 ${s} (${frame.time.toFixed(2)}초): ${detected.join(', ')}`);
      }
      console.groupEnd();

      console.group('📐 위반 판정 결과 (세그멘테이션 마스크 기반)');
      for (let s = 0; s < sampleCount; s++) {
        for (const key of ['signal', 'center', 'lane']) {
          const r = violationResults.mask[s][key];
          if (r.violated) {
            console.log(`✅ 프레임 ${s} (${violationResults.mask[s].time.toFixed(2)}초) - ${key}: 겹침=${(r.overlapRatio * 100).toFixed(1)}% 하단침범=${r.bottomInMask}`);
          } else if (r.terrainFound && r.objectDetected) {
            console.log(`❌ 프레임 ${s} - ${key}: 겹침=${(r.overlapRatio * 100).toFixed(1)}% (미달)`);
          }
        }
      }
      for (let s = 0; s < sampleCount; s++) {
        const r = violationResults.helmet[s];
        if (r.detected) console.log(`⛑️ 안전모미착용 프레임 ${s} (${r.time.toFixed(2)}초): 신뢰도=${(r.confidence * 100).toFixed(0)}%`);
      }
      console.groupEnd();

      /* ── 4단계: LSTM ── */
      setPipelinePhase('lstm');
      const t4 = performance.now();
      const lstmResult = await runLstm(
        el, trimStart, trimEnd,
        ({ totalProgress }) => {
          setLstmProgress(totalProgress);
          setOverallProgress(75 + Math.round(totalProgress * 0.2));
        }
      );
      timing.lstm = +((performance.now() - t4) / 1000).toFixed(1);

      console.group('📊 LSTM 결과');
      console.log('violationClass:', lstmResult.violationClass, '(0=정상, 1=위반, 2=심각)');
      console.log('confidence:', lstmResult.confidence);
      console.log('isViolation:', lstmResult.isViolation);
      console.groupEnd();
      setPhaseTiming(prev => ({ ...prev, lstm: timing.lstm }));

      /* ── 5단계: 결과 집계 ── */
      setPipelinePhase('evidence');
      setOverallProgress(95);
      const finalResults = aggregateResults(violationResults, lstmResult, sampleCount);

      const evidence = {};
      for (const [modelId, result] of Object.entries(finalResults)) {
        if (result.detected && result.evidenceData) {
          try {
            const imgDataUrl = await captureEvidenceImage(el, result.evidenceData);
            evidence[modelId] = imgDataUrl;
          } catch (err) {
            console.error(`증거 이미지 생성 실패 (${modelId}):`, err);
          }
        }
      }

      setPipelinePhase('done');
      setOverallProgress(100);
      timing.total = +((timing.detectron2 || 0) + (timing.yolo || 0) + (timing.iou || 0) + (timing.lstm || 0)).toFixed(1);
      setPhaseTiming(prev => ({ ...prev, total: timing.total }));

      setAiResults(finalResults);
      setEvidenceImages(evidence);

    } catch (err) {
      console.error('AI 파이프라인 오류:', err);
    } finally {
      setAiRunning(false);
      setStep(4);
    }
  };

  const detections = MODELS.filter(m => m.visible && aiResults[m.id]?.detected);

  return (
    <div style={styles.root}>
      <div style={styles.bgGrid} />
      <Header step={step} />
      <main style={styles.main}>
        {step === 1 && <VideoUploader onFile={handleFile} />}
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
              {step >= 3 && (
                <AIResultCard
                  aiResults={aiResults}
                  aiRunning={aiRunning}
                  overallProgress={overallProgress}
                  pipelinePhase={pipelinePhase}
                  detectronProgress={detectronProgress}
                  yoloProgress={yoloProgress}
                  lstmProgress={lstmProgress}
                  phaseTiming={phaseTiming}
                  evidenceImages={evidenceImages}
                  onRun={runAI}
                />
              )}
              {step === 4 && (
                <ReportForm video={video} detections={detections} MODELS={MODELS} aiResults={aiResults} />
              )}
              {step === 4 && (
                <button
                  style={{ ...styles.btnSecondary, width: "100%", marginTop: 8 }}
                  onClick={() => { setVideo(null); setStep(1); setAiResults({}); setEvidenceImages({}); }}
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
