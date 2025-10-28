from fastapi import FastAPI, File, UploadFile
from fastapi.responses import JSONResponse
from PIL import Image, ImageOps
from ultralytics import YOLO
import numpy as np
import io
import os
import easyocr
import shutil
from pydantic import BaseModel

# ------------------------
# Configuration
# ------------------------
MODEL_PATH = r"C:\Users\ADMIN\Downloads\best (1).pt"
CROPS_DIR = r"C:\Users\ADMIN\Downloads\storage\crops_lines_vertical"
os.makedirs(CROPS_DIR, exist_ok=True)

model = YOLO(MODEL_PATH)
reader = easyocr.Reader(['en'], gpu=False)

# ------------------------
# Utilities
# ------------------------
def clamp_box(box, img_w, img_h):
    x1, y1, x2, y2 = box
    x1, y1 = max(0, int(x1)), max(0, int(y1))
    x2, y2 = min(int(img_w), int(x2)), min(int(img_h), int(y2))
    return [x1, y1, x2, y2]

def median_nonzero(lst):
    arr = np.array([x for x in lst if x > 0])
    return float(np.median(arr)) if arr.size else 0.0

def merge_boxes_into_lines(boxes, y_threshold=0.6):
    if not boxes:
        return []
    boxes = sorted(boxes, key=lambda b: b[1])
    heights = [b[3]-b[1] for b in boxes]
    avg_h = median_nonzero(heights) or 1.0
    line_thresh = max(1.0, avg_h * y_threshold)

    merged_lines = []
    current_line = [boxes[0]]
    for b in boxes[1:]:
        _, y1, _, y2 = b
        prev_y1 = np.mean([bb[1] for bb in current_line])
        prev_y2 = np.mean([bb[3] for bb in current_line])
        if (y1 < prev_y2 + line_thresh) and (y2 > prev_y1 - line_thresh):
            current_line.append(b)
        else:
            merged_lines.append(current_line)
            current_line = [b]
    merged_lines.append(current_line)

    final_boxes = []
    for line in merged_lines:
        x1 = min(b[0] for b in line)
        y1 = min(b[1] for b in line)
        x2 = max(b[2] for b in line)
        y2 = max(b[3] for b in line)
        final_boxes.append([x1, y1, x2, y2])
    final_boxes.sort(key=lambda b: b[1])
    return final_boxes

def detect_and_merge_verticals(candidates, img_w, img_h, x_cluster_thresh=None):
    if not candidates:
        return []
    centers_x = [((b[0]+b[2])/2.0) for b in candidates]
    widths = [b[2]-b[0] for b in candidates]
    median_w = median_nonzero(widths) or 1.0
    if x_cluster_thresh is None:
        x_cluster_thresh = max(10, median_w * 1.5)

    items = list(zip(candidates, centers_x))
    items.sort(key=lambda it: it[1])

    clusters = []
    current_cluster = [items[0][0]]
    current_center = items[0][1]

    for box, cx in items[1:]:
        if abs(cx - current_center) <= x_cluster_thresh:
            current_cluster.append(box)
            current_center = np.mean([((b[0]+b[2])/2.0) for b in current_cluster])
        else:
            clusters.append(current_cluster)
            current_cluster = [box]
            current_center = cx
    clusters.append(current_cluster)

    merged = []
    for cluster in clusters:
        x1 = min(b[0] for b in cluster)
        y1 = min(b[1] for b in cluster)
        x2 = max(b[2] for b in cluster)
        y2 = max(b[3] for b in cluster)
        x1, y1, x2, y2 = clamp_box([x1, y1, x2, y2], img_w, img_h)
        if x2 > x1 and y2 > y1:
            merged.append([x1, y1, x2, y2])
    return merged

def merge_horizontal_and_vertical(raw_boxes, img_w, img_h,
                                  vertical_aspect_ratio=1.5,
                                  vertical_height_factor=0.9):
    if not raw_boxes:
        return []
    widths = [b[2]-b[0] for b in raw_boxes]
    heights = [b[3]-b[1] for b in raw_boxes]
    median_h = median_nonzero(heights) or 1.0

    vertical_candidates, horizontal_candidates = [], []
    for b in raw_boxes:
        w, h = b[2]-b[0], b[3]-b[1]
        ar = (h/float(w)) if w>0 else 9999
        if ar >= vertical_aspect_ratio or h >= median_h*(1.0+(vertical_height_factor/2.0)):
            vertical_candidates.append(b)
        else:
            horizontal_candidates.append(b)

    merged_verticals = detect_and_merge_verticals(vertical_candidates, img_w, img_h)
    merged_horizontals = merge_boxes_into_lines(horizontal_candidates)
    final_boxes = merged_horizontals + merged_verticals
    final_boxes.sort(key=lambda b: (b[1], b[0]))
    return final_boxes

def detect_and_crop_lines(image: Image.Image, padding=10):
    img = np.array(ImageOps.exif_transpose(image).convert("RGB"))
    img_h, img_w = img.shape[0], img.shape[1]

    results = model(img)[0]
    raw_boxes = []
    for box in results.boxes:
        xyxy = box.xyxy[0].cpu().numpy().astype(int)
        x1, y1, x2, y2 = clamp_box(xyxy, img_w, img_h)
        raw_boxes.append([x1, y1, x2, y2])

    if not raw_boxes:
        full_path = os.path.join(CROPS_DIR, "region_0.jpg")
        image.convert("RGB").save(full_path)
        return [full_path], [{"line_index":0,"box":[0,0,img_w,img_h],"path":full_path}]

    final_boxes = merge_horizontal_and_vertical(raw_boxes, img_w, img_h)

    cropped_images = []
    box_info = []
    os.makedirs(CROPS_DIR, exist_ok=True)

    for idx, (x1, y1, x2, y2) in enumerate(final_boxes):
        x1_pad, y1_pad = max(0, x1-padding), max(0, y1-padding)
        x2_pad, y2_pad = min(img_w, x2+padding), min(img_h, y2+padding)
        crop = img[y1_pad:y2_pad, x1_pad:x2_pad]
        if crop.size == 0:
            continue
        crop_pil = Image.fromarray(crop).convert("RGB")
        crop_path = os.path.join(CROPS_DIR, f"region_{idx}.jpg")
        crop_pil.save(crop_path)
        cropped_images.append(crop_path)
        box_info.append({"line_index": idx, "box": [x1_pad, y1_pad, x2_pad, y2_pad], "path": crop_path})

    return cropped_images, box_info

def recognize_text(crop_paths):
    results = []
    for path in crop_paths:
        try:
            img = Image.open(path).convert("RGB")
            w, h = img.size
            if h > 1.5*w:
                img = img.rotate(90, expand=True).convert("RGB")
            img_np = np.array(img)
            ocr_res = reader.readtext(img_np, detail=0)
            recognized_text = " ".join(ocr_res).strip()
            results.append({"path": path, "text": recognized_text})
        except Exception as e:
            results.append({"path": path, "text": "", "error": str(e)})
    return results

# ------------------------ FASTAPI APP --------------------------
app = FastAPI()

@app.post("/upload/")
async def upload_image(file: UploadFile = File(...)):
    try:
        # 🔹 Delete old crops before processing new image
        if os.path.exists(CROPS_DIR):
            shutil.rmtree(CROPS_DIR)
        os.makedirs(CROPS_DIR, exist_ok=True)

        # Process new image
        image_bytes = await file.read()
        image = Image.open(io.BytesIO(image_bytes))

        crops, boxes = detect_and_crop_lines(image)
        ocr_results = recognize_text(crops)

        # Map text to boxes
        for idx, b in enumerate(boxes):
            text_info = ocr_results[idx] if idx < len(ocr_results) else {"text": ""}
            b["recognized_text"] = text_info.get("text", "")

        # ✅ Do NOT delete crops here — keep them until next upload
        return JSONResponse({
            "num_crops": len(crops),
            "recognized_texts": [b["recognized_text"] for b in boxes],
            "boxes": boxes
        })
    except Exception as e:
        return JSONResponse({"error": str(e)})


# ------------------------ GEMINI INTEGRATION --------------------------
from google import genai
client = genai.Client(api_key="AIzaSyBRR5Vs4rmR95tHgvictGdUc_Q0mOi-bTw")

class ItemRequest(BaseModel):
    item_name: str

import base64

@app.get("/get_crops")
async def get_crops():
    """
    Returns all cropped images currently stored in CROPS_DIR as base64 strings.
    This can be fetched from frontend after upload is done.
    """
    try:
        if not os.path.exists(CROPS_DIR):
            return JSONResponse({"crops": []})

        crop_files = sorted(
            [f for f in os.listdir(CROPS_DIR) if f.lower().endswith((".jpg", ".jpeg", ".png"))]
        )

        crops_data = []
        for filename in crop_files:
            file_path = os.path.join(CROPS_DIR, filename)
            with open(file_path, "rb") as f:
                img_bytes = f.read()
                img_base64 = base64.b64encode(img_bytes).decode("utf-8")
                crops_data.append({
                    "filename": filename,
                    "image_base64": img_base64
                })

        return JSONResponse({"num_crops": len(crops_data), "crops": crops_data})

    except Exception as e:
        return JSONResponse({"error": str(e)})

@app.post("/get_info")
async def get_info(request: ItemRequest):
    item_name = request.item_name.strip()
    if not item_name:
        return {"error": "No item_name provided"}
    
    prompt = f"Provide 3 lines of information about '{item_name}' in  'SJCE Mysore' Do not provide me the introduction include '*' just provide the history and info by having space between paragraph ."

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash-lite",
            contents=prompt
        )
        return {"info": response.text}
    except Exception as e:
        return {"error": str(e)}
