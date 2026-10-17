"""
Rice AI — AI Inference Service (FastAPI)
=========================================
Handoff section 21 architecture decision: this service is the LOCKED
"source of truth" for inference (Option A — server-side). TFLite on-device
inference remains a documented future deployment option (see
docs/ASSUMPTIONS_AND_TODOS.md) but is not implemented here.

MODEL STATUS
------------
This version has real-model inference wired up (see `predict_with_real_model`
below), matching the training pipeline in `rice_ai_train_model_colab.ipynb`.
It automatically switches between two modes:

  1) TRAINED MODEL MODE — if `model/rice_disease_model.h5` (and its sibling
     `model/class_indices.json`) exist, they're loaded at startup and used
     for every prediction.
  2) PLACEHOLDER MODE — if no model file is found (e.g. you haven't trained
     one yet, or haven't copied the exported files here), the service falls
     back to a clearly-labeled deterministic-per-image pseudo-random
     classifier, so the rest of the product (backend, web, mobile) still
     works end-to-end for development/demo purposes.

Every response includes `model_status` and `source` so callers (and the
Node backend's `aiClient.js`) always know which mode produced a result —
nothing here is silently presented as more reliable than it is.

To go from placeholder → trained model:
  1. Run `rice_ai_train_model_colab.ipynb` in Google Colab (see the main
     project's docs) and download the exported `rice_disease_model.h5` +
     `class_indices.json`.
  2. Copy both files into `ai-service/model/`.
  3. Uncomment `tensorflow`, `pillow`, and `numpy` in `requirements.txt`
     and reinstall: `pip install -r requirements.txt`.
  4. Restart this service. `/health` should report
     `model_status: trained_model_loaded`.
"""
import io
import json
import os
import random
import time
from typing import Optional, Tuple

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

MODEL_DIR = os.environ.get("MODEL_DIR", os.path.join(os.path.dirname(__file__), "model"))
CLASS_INDEX_PATH = os.environ.get(
    "CLASS_INDEX_PATH", os.path.join(MODEL_DIR, "class_indices.json")
)


def _resolve_model_path() -> str:
    """
    Auto-detect the model file. Prefers the native Keras 3 `.keras` format
    over legacy `.h5` — in practice, `.h5` saves of a model with a
    functional-API preprocessing layer baked in (like
    `keras.applications.efficientnet.preprocess_input` used in the training
    notebook) can silently save incompletely (a suspiciously tiny file,
    sometimes just a few KB), while `.keras` saves the full model reliably.
    If `MODEL_PATH` is set explicitly, that always wins.
    """
    explicit = os.environ.get("MODEL_PATH")
    if explicit:
        return explicit
    keras_path = os.path.join(MODEL_DIR, "rice_disease_model.keras")
    h5_path = os.path.join(MODEL_DIR, "rice_disease_model.h5")
    if os.path.exists(keras_path):
        return keras_path
    return h5_path  # fall back to .h5 path even if it doesn't exist yet, for a clear "not found" message


MODEL_PATH = _resolve_model_path()

# Must match, in order, the CANONICAL_CLASSES used to train the model in
# rice_ai_train_model_colab.ipynb (Section 4). If a trained model + its
# class_indices.json are found, CLASS_INDEX_MAP (loaded below) is the
# actual source of truth for index -> code; this list is only the fallback
# used in placeholder mode.
CLASSES = [
    {"code": "BLAST", "name_th": "โรคไหม้ (Rice Blast)"},
    {"code": "BLB", "name_th": "โรคขอบใบแห้ง (Bacterial Leaf Blight)"},
    {"code": "TUNGRO", "name_th": "โรคใบสีส้ม (Rice Tungro Virus)"},
    {"code": "HEALTHY", "name_th": "ใบข้าวปกติ (Healthy Rice Leaf)"},
]

IMG_SIZE = (224, 224)  # must match IMG_SIZE in the training notebook

# From model v3 the classifier has a fifth output, OTHER: rice-leaf problems the system does not
# cover yet (e.g. brown spot, hispa). It is never returned as a diagnosis; the user is told the
# photo looks like something outside the four supported classes instead.
OUT_OF_SCOPE_CODE = "OTHER"
OUT_OF_SCOPE_MESSAGE = (
    "ภาพนี้อาจเป็นโรคหรืออาการอื่นที่ระบบยังไม่รองรับ ระบบวิเคราะห์ได้เฉพาะโรคไหม้ โรคขอบใบแห้ง "
    "โรคใบสีส้ม และใบปกติ กรุณาปรึกษาเจ้าหน้าที่ส่งเสริมการเกษตร"
)

app = FastAPI(title="Rice AI Inference Service", version="1.1.0")

_model = None
_model_status = "not_loaded"
_class_index_map: Optional[dict] = None  # {0: "BLAST", 1: "BLB", ...}


def _load_class_index_map() -> Optional[dict]:
    if not os.path.exists(CLASS_INDEX_PATH):
        return None
    try:
        with open(CLASS_INDEX_PATH, "r", encoding="utf-8") as f:
            raw = json.load(f)
        return {int(k): v for k, v in raw.items()}
    except Exception as exc:  # pragma: no cover - defensive
        print(f"[ai-service] Failed to read {CLASS_INDEX_PATH}: {exc}")
        return None


def load_model():
    """Attempt to load a real trained Keras model. Returns None if unavailable."""
    global _model_status, _class_index_map

    if not os.path.exists(MODEL_PATH):
        _model_status = "placeholder_no_trained_model_found"
        return None

    # Sanity check: a properly saved EfficientNetB0-based model is tens of
    # MB. A file of only a few KB is almost certainly an incomplete/broken
    # save (this has been observed with `.h5` saves of models that embed a
    # preprocessing layer) rather than a real usable model. Fail loudly
    # here instead of letting a broken file load "successfully" with
    # garbage weights.
    MIN_PLAUSIBLE_MODEL_BYTES = 1_000_000  # 1 MB
    file_size = os.path.getsize(MODEL_PATH)
    if file_size < MIN_PLAUSIBLE_MODEL_BYTES:
        _model_status = (
            f"suspected_broken_model_file ({file_size} bytes at {MODEL_PATH} "
            f"— expected several MB; if you saved both .h5 and .keras, try "
            f"the .keras file, or re-export from the training notebook)"
        )
        print(f"[ai-service] {_model_status}")
        return None

    try:
        # Deferred import: tensorflow is heavy and only needed once a real
        # model file is actually present, so this service still boots (in
        # placeholder mode) in environments without tensorflow installed.
        import tensorflow as tf  # type: ignore

        model = tf.keras.models.load_model(MODEL_PATH)

        _class_index_map = _load_class_index_map()
        if _class_index_map is None:
            # We can still run inference, but without class_indices.json we
            # don't actually know the model's output-index -> class mapping
            # for certain, so fall back to the documented CLASSES order and
            # warn loudly rather than guessing silently.
            print(
                f"[ai-service] WARNING: {CLASS_INDEX_PATH} not found. "
                "Assuming the default class order from CLASSES "
                "(BLAST, BLB, TUNGRO, HEALTHY). If the model was trained "
                "with a different order, predictions will be mislabeled."
            )
            _class_index_map = {i: c["code"] for i, c in enumerate(CLASSES)}

        _model_status = "trained_model_loaded"
        return model
    except Exception as exc:  # pragma: no cover - defensive
        _model_status = f"load_failed: {exc}"
        print(f"[ai-service] Failed to load model: {exc}")
        return None


@app.on_event("startup")
def on_startup():
    global _model
    _model = load_model()
    print(f"[ai-service] Startup complete. model_status={_model_status}")


def _model_metrics() -> dict:
    """Held-out test results written next to the model by the training script (model/metrics.json)."""
    try:
        with open(os.path.join(os.path.dirname(MODEL_PATH), "metrics.json"), encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def _min_confidence() -> float:
    """Answer only when the top class reaches this % (model/metrics.json "threshold", picked on the
    validation set for each model release). Below it the photo is treated as unclear / not a rice leaf."""
    t = _model_metrics().get("threshold")
    return float(t) * 100 if isinstance(t, (int, float)) and 0 < t < 1 else 75.0


@app.get("/health")
def health():
    m = _model_metrics()
    return {
        "status": "ok",
        "model_status": _model_status,
        "model_path": MODEL_PATH,
        "class_index_map": _class_index_map,
        "model_version": m.get("model_version"),
        "test_accuracy": m.get("test", {}).get("accuracy"),
        "test_size": m.get("test", {}).get("size"),
        "min_confidence": _min_confidence(),
    }


def preprocess_and_predict_placeholder(image_bytes: bytes) -> Tuple[str, float]:
    """
    Deterministic-ish placeholder so repeated calls with the same image are
    stable within a run, while still varying across different images —
    useful for demoing the UI without a trained model. NOT a real classifier.
    """
    seed = sum(image_bytes[:2048]) if image_bytes else random.randint(0, 10_000)
    rng = random.Random(seed)
    pick = rng.choice(CLASSES)
    confidence = round(rng.uniform(70.0, 99.0), 2)
    return pick["code"], confidence


def predict_with_real_model(image_bytes: bytes) -> Tuple[str, float]:
    """
    Real inference path, used once a trained model + class_indices.json are
    present (see MODEL STATUS above).

    NOTE on preprocessing: no manual normalization/rescaling happens here.
    In the training notebook, EfficientNet's `preprocess_input` (and the
    augmentation layers, which are inactive at inference time) are baked
    into the exported model graph itself — so this function only needs to
    resize + batch the raw 0-255 RGB array before calling `model.predict`.
    If you swap in a differently-trained model that expects manual
    preprocessing, update this function to match.
    """
    from PIL import Image
    import numpy as np

    img = Image.open(io.BytesIO(image_bytes)).convert("RGB").resize(IMG_SIZE)
    arr = np.expand_dims(np.array(img), axis=0).astype("float32")

    preds = _model.predict(arr, verbose=0)[0]
    idx = int(np.argmax(preds))
    confidence = round(float(preds[idx]) * 100, 2)

    class_code = _class_index_map.get(idx)
    if class_code is None:
        # Defensive: never let an out-of-range index pass through silently
        # as if it were a valid class.
        raise ValueError(f"Model predicted index {idx}, which has no entry in class_index_map")

    return class_code, confidence


@app.post("/predict")
async def predict(request: Request):
    started = time.time()
    image_bytes = await request.body()
    if not image_bytes:
        return JSONResponse(status_code=400, content={"error": "no_image_bytes"})

    if _model is not None:
        try:
            class_code, confidence = predict_with_real_model(image_bytes)
            source = "trained_model"

            # Looks like a rice-leaf problem outside the four supported classes
            if class_code == OUT_OF_SCOPE_CODE:
                elapsed_ms = int((time.time() - started) * 1000)
                return JSONResponse(
                    status_code=400,
                    content={
                        "error": "out_of_scope",
                        "message": OUT_OF_SCOPE_MESSAGE,
                        "confidence": confidence,
                        "model_status": _model_status,
                        "elapsed_ms": elapsed_ms,
                    },
                )

            # Reject predictions with low confidence (likely not a rice leaf or unclear)
            if confidence < _min_confidence():
                elapsed_ms = int((time.time() - started) * 1000)
                return JSONResponse(
                    status_code=400,
                    content={
                        "error": "low_confidence",
                        "message": "ภาพไม่ชัดเจน หรือไม่ใช่ใบข้าว กรุณาถ่ายภาพใบข้าวให้ชัดเจนอีกครั้ง",
                        "model_status": _model_status,
                        "elapsed_ms": elapsed_ms,
                    },
                )
        except Exception as exc:
            # A broken real-model inference should be visible, not silently
            # swallowed into a placeholder result that looks the same as a
            # healthy response.
            elapsed_ms = int((time.time() - started) * 1000)
            return JSONResponse(
                status_code=500,
                content={
                    "error": "inference_failed",
                    "message": str(exc),
                    "model_status": _model_status,
                    "elapsed_ms": elapsed_ms,
                },
            )
    else:
        # Strictly model only, no mock data fallback.
        elapsed_ms = int((time.time() - started) * 1000)
        return JSONResponse(
            status_code=503,
            content={
                "error": "model_not_loaded",
                "message": "ระบบ AI ยังไม่พร้อมใช้งาน (ไม่พบไฟล์โมเดล)",
                "model_status": _model_status,
                "elapsed_ms": elapsed_ms,
            },
        )

    elapsed_ms = int((time.time() - started) * 1000)
    return {
        "class_code": class_code,
        "confidence": confidence,
        "model_status": _model_status,
        "source": source,
        "elapsed_ms": elapsed_ms,
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=int(os.environ.get("PORT", 8000)), reload=False)
