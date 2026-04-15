import cv2
import base64
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS
import torch
from detectron2.config import get_cfg
from detectron2.engine import DefaultPredictor
from detectron2 import model_zoo

app = Flask(__name__)
CORS(app)

MODEL_BASE = "/workspaces/flask-ai/models"

MODELS = {
    "교통영역탐지": "model_교통영역탐지.pth",
    "신호위반":     "model_차선탐지_신호위반.pth",
    "중앙선침범":   "model_차선탐지_중앙선침범.pth",
    "진로변경":     "model_차선탐지_진로변경.pth",
}

predictors = {}

def get_predictor(model_id):
    if model_id not in predictors:
        cfg = get_cfg()
        cfg.merge_from_file(model_zoo.get_config_file(
            "COCO-InstanceSegmentation/mask_rcnn_R_50_FPN_3x.yaml"
        ))
        cfg.MODEL.WEIGHTS = f"{MODEL_BASE}/{MODELS[model_id]}"
        cfg.MODEL.ROI_HEADS.SCORE_THRESH_TEST = 0.3
        cfg.MODEL.ROI_HEADS.NUM_CLASSES = 1
        cfg.MODEL.DEVICE = "cpu"
        predictors[model_id] = DefaultPredictor(cfg)
    return predictors[model_id]

def decode_image(b64_str):
    img_bytes = base64.b64decode(b64_str)
    nparr = np.frombuffer(img_bytes, np.uint8)
    return cv2.imdecode(nparr, cv2.IMREAD_COLOR)

def mask_to_polygons(mask, img_w, img_h):
    """바이너리 마스크 → 정규화된 폴리곤 좌표 리스트"""
    mask_uint8 = mask.astype(np.uint8) * 255
    contours, _ = cv2.findContours(mask_uint8, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    polygons = []
    for contour in contours:
        if cv2.contourArea(contour) < 50:
            continue
        epsilon = 0.005 * cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, epsilon, True)
        poly = approx.reshape(-1, 2).tolist()
        if len(poly) >= 3:
            # 정규화 (0~1)
            normalized = [[round(x / img_w, 4), round(y / img_h, 4)] for x, y in poly]
            polygons.append(normalized)
    
    return polygons

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})

@app.route("/detect/<model_id>", methods=["POST"])
def detect(model_id):
    if model_id not in MODELS:
        return jsonify({"error": "Unknown model"}), 400
    try:
        data = request.json
        img = decode_image(data["image"])
        h, w = img.shape[:2]
        
        predictor = get_predictor(model_id)
        outputs = predictor(img)
        instances = outputs["instances"].to("cpu")
        
        boxes = instances.pred_boxes.tensor.tolist()
        scores = instances.scores.tolist()
        has_masks = instances.has("pred_masks")
        masks = instances.pred_masks.numpy() if has_masks else None
        
        detections = []
        for i, (box, score) in enumerate(zip(boxes, scores)):
            detection = {
                "bbox": box,
                "score": round(score, 3),
            }
            
            if masks is not None:
                mask = masks[i]
                polygons = mask_to_polygons(mask, w, h)
                detection["polygons"] = polygons
                detection["mask_area"] = round(float(mask.sum()) / (h * w), 6)
            
            detections.append(detection)
        
        return jsonify({
            "detected": len(detections) > 0,
            "detections": detections,
            "count": len(detections),
            "has_masks": has_masks,
        })
    except Exception as e:
        return jsonify({"error": str(e), "detected": False}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)
