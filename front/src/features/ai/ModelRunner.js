import * as ort from 'onnxruntime-web';
import * as tf from '@tensorflow/tfjs';

ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/';

const modelCache = {};

const DETECTRON2_MODELS = {
  traffic: '교통영역탐지',
  signal:  '신호위반',
  center:  '중앙선침범',
  lane:    '진로변경',
};

const YOLO_MODELS = {
  signal: 'model_객체탐지_신호위반',
  helmet: 'model_객체탐지_안전모',
  center: 'model_객체탐지_중앙선침범',
  lane:   'model_객체탐지_진로변경',
};

const VIOLATION_PAIRS = [
  { terrainKey: 'signal', objectKey: 'signal', label: '신호위반',   color: '#ff4d6d' },
  { terrainKey: 'center', objectKey: 'center', label: '중앙선침범', color: '#ffa500' },
  { terrainKey: 'lane',   objectKey: 'lane',   label: '진로변경',   color: '#00bfff' },
];

const OVERLAP_THRESHOLD = 0.02;
const DET_SIZE = 640;
const YOLO_SIZE = 640;
const MASK_CALC_SIZE = 128;

/* ── 유틸리티 ── */

function captureFrame(videoElement, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(videoElement, 0, 0, width, height);
  return canvas;
}

async function seekAndWait(videoElement, time) {
  videoElement.currentTime = time;
  await new Promise(r => setTimeout(r, 150));
}

function rasterizePolygons(polygons, w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  for (const poly of polygons) {
    if (poly.length < 3) continue;
    ctx.beginPath();
    ctx.moveTo(poly[0][0] * w, poly[0][1] * h);
    for (let i = 1; i < poly.length; i++) {
      ctx.lineTo(poly[i][0] * w, poly[i][1] * h);
    }
    ctx.closePath();
    ctx.fill();
  }
  const imageData = ctx.getImageData(0, 0, w, h);
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    mask[i] = imageData.data[i * 4] > 128 ? 1 : 0;
  }
  return mask;
}

function rasterizeBbox(bbox, w, h) {
  const mask = new Uint8Array(w * h);
  const x1 = Math.max(0, Math.floor(bbox.x * w));
  const y1 = Math.max(0, Math.floor(bbox.y * h));
  const x2 = Math.min(w, Math.ceil((bbox.x + bbox.w) * w));
  const y2 = Math.min(h, Math.ceil((bbox.y + bbox.h) * h));
  for (let y = y1; y < y2; y++) {
    for (let x = x1; x < x2; x++) {
      mask[y * w + x] = 1;
    }
  }
  return mask;
}

function calcMaskOverlap(maskA, maskB, size) {
  let overlapPixels = 0, maskPixels = 0, bboxPixels = 0;
  for (let i = 0; i < size; i++) {
    if (maskA[i]) maskPixels++;
    if (maskB[i]) bboxPixels++;
    if (maskA[i] && maskB[i]) overlapPixels++;
  }
  return {
    overlapPixels,
    maskPixels,
    bboxPixels,
    overlapRatio: maskPixels > 0 ? +(overlapPixels / maskPixels).toFixed(4) : 0,
    bboxOverlapRatio: bboxPixels > 0 ? +(overlapPixels / bboxPixels).toFixed(4) : 0,
  };
}

/* ══════════════════════════════════════════════════════════════
   1단계: Detectron2 — 세그멘테이션 마스크(폴리곤) 수집
   ══════════════════════════════════════════════════════════════ */

async function runDetectron2Single(modelId, canvas) {
  try {
    const base64 = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
    const res = await fetch(`http://localhost:5001/detect/${modelId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64 }),
    });
    const data = await res.json();
    const cw = canvas.width;
    const ch = canvas.height;

    if (data.detected && data.detections && data.detections.length > 0) {
      const regions = data.detections.map(d => ({
        bbox: {
          x: d.bbox[0] / cw,
          y: d.bbox[1] / ch,
          w: (d.bbox[2] - d.bbox[0]) / cw,
          h: (d.bbox[3] - d.bbox[1]) / ch,
        },
        polygons: d.polygons || [],
        hasMask: d.has_mask || false,
        maskArea: d.mask_area || 0,
        score: d.score,
        label: d.label || modelId,
      }));
      return { found: true, regions };
    }
    return { found: false, regions: [] };
  } catch (err) {
    console.error(`Detectron2 검출 실패 (${modelId}):`, err);
    return { found: false, regions: [] };
  }
}

export async function runAllDetectron2(videoElement, trimStart, trimEnd, sampleCount, onProgress) {
  const duration = trimEnd - trimStart;
  const terrainCache = {};
  const modelKeys = Object.keys(DETECTRON2_MODELS);
  const totalSteps = sampleCount * modelKeys.length;
  let completedSteps = 0;

  for (let s = 0; s < sampleCount; s++) {
    const t = trimStart + (duration / sampleCount) * s;
    await seekAndWait(videoElement, t);
    const canvas = captureFrame(videoElement, DET_SIZE, DET_SIZE);
    terrainCache[s] = { time: t };

    for (const key of modelKeys) {
      const result = await runDetectron2Single(DETECTRON2_MODELS[key], canvas);
      terrainCache[s][key] = result;
      completedSteps++;
      if (onProgress) {
        onProgress({ phase: 'detectron2', modelId: key, frameIndex: s, sampleCount, totalProgress: Math.round((completedSteps / totalSteps) * 100) });
      }
    }
  }
  return terrainCache;
}

/* ══════════════════════════════════════════════════════════════
   2단계: YOLOv5 — 객체 탐지
   ══════════════════════════════════════════════════════════════ */

async function runYoloSingle(modelFileId, canvas) {
  try {
    const modelPath = `/models/${modelFileId}.onnx`;
    if (!modelCache[modelFileId]) {
      console.log(`YOLO 모델 로딩: ${modelFileId}`);
      modelCache[modelFileId] = await ort.InferenceSession.create(modelPath, { executionProviders: ['wasm'] });
    }
    const session = modelCache[modelFileId];
    const imageData = canvas.getContext('2d').getImageData(0, 0, 640, 640);
    const input = new Float32Array(1 * 3 * 640 * 640);
    for (let i = 0; i < 640 * 640; i++) {
      input[i]                 = imageData.data[i * 4]     / 255.0;
      input[i + 640 * 640]     = imageData.data[i * 4 + 1] / 255.0;
      input[i + 640 * 640 * 2] = imageData.data[i * 4 + 2] / 255.0;
    }
    const tensor = new ort.Tensor('float32', input, [1, 3, 640, 640]);
    const results = await session.run({ images: tensor });
    const outputKey = Object.keys(results)[0];
    const output = results[outputKey].data;
    const outputShape = results[outputKey].dims;
    const numClasses = outputShape[2] - 5;
    const numDetections = outputShape[1];
    let bestConf = 0, bestBbox = null;
    for (let i = 0; i < numDetections; i++) {
      const offset = i * (5 + numClasses);
      const cx = output[offset], cy = output[offset + 1], w = output[offset + 2], h = output[offset + 3];
      const objectness = output[offset + 4];
      let maxClassConf = 0;
      for (let c = 0; c < numClasses; c++) {
        if (output[offset + 5 + c] > maxClassConf) maxClassConf = output[offset + 5 + c];
      }
      const conf = objectness * maxClassConf;
      if (conf > bestConf) {
        bestConf = conf;
        bestBbox = { x: (cx - w / 2) / 640, y: (cy - h / 2) / 640, w: w / 640, h: h / 640 };
      }
    }
    if (bestConf > 0.25) return { detected: true, confidence: +bestConf.toFixed(2), bbox: bestBbox };
    return { detected: false, confidence: 0, bbox: null };
  } catch (err) {
    console.error(`YOLO 추론 실패 (${modelFileId}):`, err);
    return { detected: false, confidence: 0, bbox: null };
  }
}

export async function runAllYolo(videoElement, trimStart, trimEnd, sampleCount, onProgress) {
  const duration = trimEnd - trimStart;
  const objectCache = {};
  const modelKeys = Object.keys(YOLO_MODELS);
  const totalSteps = sampleCount * modelKeys.length;
  let completedSteps = 0;

  for (let s = 0; s < sampleCount; s++) {
    const t = trimStart + (duration / sampleCount) * s;
    await seekAndWait(videoElement, t);
    const canvas = captureFrame(videoElement, YOLO_SIZE, YOLO_SIZE);
    objectCache[s] = { time: t };
    for (const key of modelKeys) {
      const result = await runYoloSingle(YOLO_MODELS[key], canvas);
      objectCache[s][key] = result;
      completedSteps++;
      if (onProgress) {
        onProgress({ phase: 'yolo', modelId: key, frameIndex: s, sampleCount, totalProgress: Math.round((completedSteps / totalSteps) * 100) });
      }
    }
  }
  return objectCache;
}

/* ══════════════════════════════════════════════════════════════
   3단계: 마스크 폴리곤 vs YOLO bbox 픽셀 겹침 판정
   ══════════════════════════════════════════════════════════════ */

export function computeAllViolations(terrainCache, objectCache, sampleCount) {
  const results = { mask: {}, helmet: {} };
  const W = MASK_CALC_SIZE, H = MASK_CALC_SIZE;

  for (let s = 0; s < sampleCount; s++) {
    const time = terrainCache[s].time;
    results.mask[s] = { time };

    for (const pair of VIOLATION_PAIRS) {
      const terrain = terrainCache[s][pair.terrainKey];
      const object = objectCache[s][pair.objectKey];

      if (!terrain?.found || !object?.detected || !object.bbox) {
        results.mask[s][pair.terrainKey] = {
          overlaps: false, overlapRatio: 0,
          terrainFound: terrain?.found || false,
          objectDetected: object?.detected || false,
          hasMask: false,
        };
        continue;
      }

      const allPolygons = [];
      for (const region of terrain.regions) {
        if (region.polygons && region.polygons.length > 0) allPolygons.push(...region.polygons);
      }

      if (allPolygons.length === 0) {
        results.mask[s][pair.terrainKey] = {
          overlaps: false, overlapRatio: 0,
          terrainFound: true, objectDetected: true,
          hasMask: false, note: 'no_polygon',
        };
        continue;
      }

      const terrainMask = rasterizePolygons(allPolygons, W, H);
      const objectMask = rasterizeBbox(object.bbox, W, H);
      const overlap = calcMaskOverlap(terrainMask, objectMask, W * H);
      const bestRegion = terrain.regions.reduce((a, b) => (a.maskArea || 0) > (b.maskArea || 0) ? a : b);

      results.mask[s][pair.terrainKey] = {
        overlaps: overlap.overlapRatio > OVERLAP_THRESHOLD,
        overlapRatio: overlap.overlapRatio,
        bboxOverlapRatio: overlap.bboxOverlapRatio,
        overlapPixels: overlap.overlapPixels,
        maskPixels: overlap.maskPixels,
        terrainBbox: bestRegion.bbox,
        terrainPolygons: allPolygons,
        objectBbox: object.bbox,
        objectConfidence: object.confidence,
        terrainFound: true,
        objectDetected: true,
        hasMask: true,
      };
    }

    const helmetResult = objectCache[s].helmet;
    results.helmet[s] = {
      time,
      detected: helmetResult?.detected || false,
      confidence: helmetResult?.confidence || 0,
      bbox: helmetResult?.bbox || null,
    };
  }
  return results;
}

/* ══════════════════════════════════════════════════════════════
   4단계: LSTM
   ══════════════════════════════════════════════════════════════ */

let lstmModel = null;

export async function runLstm(videoElement, trimStart, trimEnd, onProgress) {
  try {
    if (!lstmModel) {
      console.log('LSTM 모델 로딩 중...');
      await tf.setBackend('cpu');
      await tf.ready();
      lstmModel = await tf.loadLayersModel('/models/위반상황분류/model.json');
    }
    const frameCount = 25;
    const duration = trimEnd - trimStart;
    const frames = [];
    for (let i = 0; i < frameCount; i++) {
      const t = trimStart + (duration / frameCount) * i;
      await seekAndWait(videoElement, t);
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(videoElement, 0, 0, 64, 64);
      const imageData = ctx.getImageData(0, 0, 64, 64);
      const rgbData = new Float32Array(64 * 64 * 3);
      for (let p = 0; p < 64 * 64; p++) {
        rgbData[p * 3]     = imageData.data[p * 4]     / 255.0;
        rgbData[p * 3 + 1] = imageData.data[p * 4 + 1] / 255.0;
        rgbData[p * 3 + 2] = imageData.data[p * 4 + 2] / 255.0;
      }
      const tensor = tf.tensor3d(rgbData, [64, 64, 3]).expandDims(0);
      frames.push(tensor);
      if (onProgress) {
        onProgress({ phase: 'lstm', frameIndex: i, totalProgress: Math.round(((i + 1) / frameCount) * 100) });
      }
    }
    const input = tf.concat(frames, 0).expandDims(0);
    const prediction = lstmModel.predict(input);
    const values = await prediction.data();
    const maxIdx = values.indexOf(Math.max(...values));
    const confidence = +values[maxIdx].toFixed(2);
    input.dispose();
    prediction.dispose();
    frames.forEach(f => f.dispose());
    return { violationClass: maxIdx, confidence, isViolation: (maxIdx === 1 || maxIdx === 2) && confidence > 0.5 };
  } catch (err) {
    console.error('LSTM 추론 실패:', err);
    return { violationClass: 0, confidence: 0, isViolation: false };
  }
}

/* ══════════════════════════════════════════════════════════════
   증거 이미지 — 세그멘테이션 마스크 시각화
   ══════════════════════════════════════════════════════════════ */

export async function captureEvidenceImage(videoElement, violationData) {
  const { time, terrainPolygons, terrainBbox, objectBbox, overlapRatio, label, color, type } = violationData;
  await seekAndWait(videoElement, time);

  const W = 640, H = 640;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // 원본 프레임
  ctx.drawImage(videoElement, 0, 0, W, H);

  // 세그멘테이션 마스크 폴리곤 (파란색 반투명 + 윤곽선)
  if (terrainPolygons && terrainPolygons.length > 0) {
    ctx.fillStyle = 'rgba(0, 150, 255, 0.25)';
    for (const poly of terrainPolygons) {
      if (poly.length < 3) continue;
      ctx.beginPath();
      ctx.moveTo(poly[0][0] * W, poly[0][1] * H);
      for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i][0] * W, poly[i][1] * H);
      ctx.closePath();
      ctx.fill();
    }
    ctx.strokeStyle = '#0096ff';
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    for (const poly of terrainPolygons) {
      if (poly.length < 3) continue;
      ctx.beginPath();
      ctx.moveTo(poly[0][0] * W, poly[0][1] * H);
      for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i][0] * W, poly[i][1] * H);
      ctx.closePath();
      ctx.stroke();
    }
    if (terrainBbox) {
      ctx.fillStyle = '#0096ff';
      ctx.font = 'bold 12px sans-serif';
      const tl = '차선 마스크';
      const tlm = ctx.measureText(tl);
      ctx.fillRect(terrainBbox.x * W, terrainBbox.y * H - 18, tlm.width + 8, 18);
      ctx.fillStyle = '#fff';
      ctx.fillText(tl, terrainBbox.x * W + 4, terrainBbox.y * H - 5);
    }
  }

  // YOLO bbox (빨간 실선)
  if (objectBbox) {
    ctx.setLineDash([]);
    ctx.strokeStyle = color || '#ff4d6d';
    ctx.lineWidth = 3;
    ctx.strokeRect(objectBbox.x * W, objectBbox.y * H, objectBbox.w * W, objectBbox.h * H);
    ctx.fillStyle = color || '#ff4d6d';
    ctx.font = 'bold 12px sans-serif';
    const ol = type === 'helmet' ? '미착용 감지' : '위반 차량';
    const olm = ctx.measureText(ol);
    ctx.fillRect(objectBbox.x * W, objectBbox.y * H - 18, olm.width + 8, 18);
    ctx.fillStyle = '#fff';
    ctx.fillText(ol, objectBbox.x * W + 4, objectBbox.y * H - 5);
  }

  // 겹침 영역 (마스크 ∩ bbox → 빨간 반투명)
  if (terrainPolygons && terrainPolygons.length > 0 && objectBbox) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(objectBbox.x * W, objectBbox.y * H, objectBbox.w * W, objectBbox.h * H);
    ctx.clip();
    ctx.fillStyle = 'rgba(255, 77, 109, 0.4)';
    for (const poly of terrainPolygons) {
      if (poly.length < 3) continue;
      ctx.beginPath();
      ctx.moveTo(poly[0][0] * W, poly[0][1] * H);
      for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i][0] * W, poly[i][1] * H);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // 정보 패널 (하단)
  const panelH = 50;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
  ctx.fillRect(0, H - panelH, W, panelH);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText(`⚠ ${label}`, 10, H - panelH + 20);
  ctx.font = '12px sans-serif';
  ctx.fillStyle = '#ccc';
  const metric = type === 'mask'
    ? `마스크 겹침: ${((overlapRatio || 0) * 100).toFixed(1)}%`
    : `신뢰도: ${objectBbox ? 100 : 0}%`;
  ctx.fillText(`프레임: ${time.toFixed(2)}초  |  ${metric}`, 10, H - panelH + 40);

  // 범례
  if (type !== 'helmet') {
    ctx.fillStyle = '#0096ff';
    ctx.fillRect(W - 220, H - panelH + 6, 12, 12);
    ctx.fillStyle = '#ccc';
    ctx.font = '11px sans-serif';
    ctx.fillText('차선 마스크 (Detectron2)', W - 204, H - panelH + 16);
    ctx.fillStyle = 'rgba(255, 77, 109, 0.6)';
    ctx.fillRect(W - 220, H - panelH + 22, 12, 12);
    ctx.fillStyle = '#ccc';
    ctx.fillText('겹침 영역', W - 204, H - panelH + 32);
  }
  ctx.fillStyle = color || '#ff4d6d';
  ctx.fillRect(W - 220, H - panelH + 38, 12, 12);
  ctx.fillStyle = '#ccc';
  ctx.font = '11px sans-serif';
  ctx.fillText(type === 'helmet' ? '미착용 (YOLOv5)' : '위반 차량 (YOLOv5)', W - 204, H - panelH + 48);

  return canvas.toDataURL('image/png');
}

/* ══════════════════════════════════════════════════════════════
   최종 결과 집계
   ══════════════════════════════════════════════════════════════ */

export function aggregateResults(violationResults, lstmResult, sampleCount) {
  const finalResults = {};
  const lstmConfirmed = lstmResult.isViolation;

  // 마스크 기반: 신호위반, 중앙선침범, 진로변경
  for (const pair of VIOLATION_PAIRS) {
    let bestFrame = null, maxOverlap = 0, overlapCount = 0;
    for (let s = 0; s < sampleCount; s++) {
      const fr = violationResults.mask[s][pair.terrainKey];
      if (fr.overlaps) {
        overlapCount++;
        if (fr.overlapRatio > maxOverlap) {
          maxOverlap = fr.overlapRatio;
          bestFrame = { frameIndex: s, time: violationResults.mask[s].time, ...fr };
        }
      }
    }
    const maskDetected = overlapCount > 0;
    finalResults[pair.terrainKey] = {
      detected: maskDetected && lstmConfirmed,
      maskDetected,
      lstmConfirmed,
      confidence: maskDetected ? +Math.max(maxOverlap, lstmResult.confidence).toFixed(2) : 0,
      overlapFrames: overlapCount,
      totalFrames: sampleCount,
      bestFrame,
      evidenceData: bestFrame ? {
        time: bestFrame.time,
        terrainBbox: bestFrame.terrainBbox,
        terrainPolygons: bestFrame.terrainPolygons,
        objectBbox: bestFrame.objectBbox,
        overlapRatio: bestFrame.overlapRatio,
        label: pair.label,
        color: pair.color,
        type: 'mask',
      } : null,
    };
  }

  // 안전모: YOLO 단독
  {
    let bestFrame = null, maxConf = 0, detectCount = 0;
    for (let s = 0; s < sampleCount; s++) {
      const fr = violationResults.helmet[s];
      if (fr.detected) {
        detectCount++;
        if (fr.confidence > maxConf) {
          maxConf = fr.confidence;
          bestFrame = { frameIndex: s, ...fr };
        }
      }
    }
    finalResults['helmet'] = {
      detected: detectCount > 0,
      confidence: maxConf,
      overlapFrames: detectCount,
      totalFrames: sampleCount,
      bestFrame,
      evidenceData: bestFrame ? {
        time: bestFrame.time,
        terrainBbox: null,
        terrainPolygons: null,
        objectBbox: bestFrame.bbox,
        overlapRatio: 0,
        label: '안전모 미착용',
        color: '#a855f7',
        type: 'helmet',
      } : null,
    };
  }

  // LSTM 결과
  finalResults['classify'] = {
    detected: lstmResult.isViolation,
    confidence: lstmResult.confidence,
    violationClass: lstmResult.violationClass,
  };

  return finalResults;
}
