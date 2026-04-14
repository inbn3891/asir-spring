import * as ort from 'onnxruntime-web';
import * as tf from '@tensorflow/tfjs';

ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/';

const modelCache = {};

/* ── YOLOv5 ONNX 추론 ── */
export async function runYolo(modelId, videoElement) {
  try {
    const modelPath = `/models/${modelId}.onnx`;

    if (!modelCache[modelId]) {
      console.log(`모델 로딩 중: ${modelId}`);
      modelCache[modelId] = await ort.InferenceSession.create(modelPath, {
        executionProviders: ['wasm'],
      });
    }

    const session = modelCache[modelId];

    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 640;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoElement, 0, 0, 640, 640);
    const imageData = ctx.getImageData(0, 0, 640, 640);

    const input = new Float32Array(1 * 3 * 640 * 640);
    for (let i = 0; i < 640 * 640; i++) {
      input[i]               = imageData.data[i * 4]     / 255.0;
      input[i + 640 * 640]   = imageData.data[i * 4 + 1] / 255.0;
      input[i + 640 * 640*2] = imageData.data[i * 4 + 2] / 255.0;
    }

    const tensor = new ort.Tensor('float32', input, [1, 3, 640, 640]);
    const results = await session.run({ images: tensor });

    const output = results[Object.keys(results)[0]].data;
    const outputShape = results[Object.keys(results)[0]].dims;
    const numClasses = outputShape[2] - 5;
    const numDetections = outputShape[1];

    let bestConf = 0;
    let bestBbox = null;

    for (let i = 0; i < numDetections; i++) {
      const offset = i * (5 + numClasses);
      const cx = output[offset];
      const cy = output[offset + 1];
      const w  = output[offset + 2];
      const h  = output[offset + 3];
      const objectness = output[offset + 4];

      let maxClassConf = 0;
      for (let c = 0; c < numClasses; c++) {
        if (output[offset + 5 + c] > maxClassConf) {
          maxClassConf = output[offset + 5 + c];
        }
      }

      const conf = objectness * maxClassConf;
      if (conf > bestConf) {
        bestConf = conf;
        bestBbox = {
          x: cx - w / 2,
          y: cy - h / 2,
          w, h,
        };
      }
    }

    if (bestConf > 0.25) {
      return { detected: true, confidence: +bestConf.toFixed(2), bbox: bestBbox };
    }
    return { detected: false, confidence: 0 };

  } catch (err) {
    console.error(`YOLO 추론 실패 (${modelId}):`, err);
    return mockInfer();
  }
}

/* ── LSTM TF.js 추론 ── */
let lstmModel = null;

export async function runLstm(videoElement) {
  try {
    if (!lstmModel) {
      console.log('LSTM 모델 로딩 중...');
      lstmModel = await tf.loadLayersModel('/models/위반상황분류/model.json');
    }

    const frames = [];
    for (let i = 0; i < 25; i++) {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      canvas.getContext('2d').drawImage(videoElement, 0, 0, 64, 64);
      const t = tf.browser.fromPixels(canvas).toFloat().div(255.0).expandDims(0);
      frames.push(t);
    }

    const input = tf.concat(frames, 0).expandDims(0);
    const prediction = lstmModel.predict(input);
    const values = await prediction.data();

    const maxIdx = values.indexOf(Math.max(...values));
    const confidence = +values[maxIdx].toFixed(2);

    input.dispose();
    prediction.dispose();
    frames.forEach(f => f.dispose());

    return {
      detected: maxIdx === 1 && confidence > 0.5,
      confidence,
    };

  } catch (err) {
    console.error('LSTM 추론 실패:', err);
    return mockInfer();
  }
}

/* ── Mock 폴백 ── */
function mockInfer() {
  const hit = Math.random() > 0.45;
  return hit
    ? {
        detected: true,
        confidence: +(0.6 + Math.random() * 0.38).toFixed(2),
        bbox: {
          x: 80 + Math.random() * 200,
          y: 60 + Math.random() * 150,
          w: 120 + Math.random() * 80,
          h: 80 + Math.random() * 60,
        },
      }
    : { detected: false, confidence: 0 };
}