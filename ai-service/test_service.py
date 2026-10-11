"""
Quick smoke test for the Rice AI inference service.

Usage:
    python main.py &          # start the service (in another terminal, or backgrounded)
    python test_service.py [leaf.jpg]   # run this (optionally with a real leaf photo)

Checks:
  1. GET /health responds and reports a model_status
  2. POST /predict on a generated dummy image returns a valid class_code
     and a confidence between 0-100
"""
import io
import sys
import urllib.request
import json

BASE_URL = "http://127.0.0.1:8000"
VALID_CODES = {"BLAST", "BLB", "TUNGRO", "HEALTHY"}


def make_dummy_jpeg() -> bytes:
    try:
        from PIL import Image
    except ImportError:
        print("Pillow not installed; install with `pip install pillow` to run this test.")
        sys.exit(1)
    img = Image.new("RGB", (256, 256), color=(60, 130, 70))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


def check_health():
    with urllib.request.urlopen(f"{BASE_URL}/health", timeout=5) as res:
        data = json.loads(res.read())
    print("GET /health ->", data)
    assert data.get("status") == "ok", "Health check did not return status: ok"
    assert "model_status" in data, "Health response missing model_status"
    return data


def _post(image_bytes):
    req = urllib.request.Request(
        f"{BASE_URL}/predict",
        data=image_bytes,
        headers={"Content-Type": "application/octet-stream"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as res:
            return res.status, json.loads(res.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())


def check_predict(leaf_path=None):
    """A blank green square is not a leaf: a trained model must refuse it (400 low_confidence);
    the placeholder model answers anyway. With a real leaf photo the answer must be a valid class."""
    status, data = _post(make_dummy_jpeg())
    print("POST /predict (blank image) ->", status, data)
    if data.get("model_status") == "trained_model_loaded" or status == 400:
        assert status == 400 and data.get("error") == "low_confidence", "Blank image should be rejected"
    else:
        assert data.get("class_code") in VALID_CODES, f"Unexpected class_code: {data.get('class_code')}"

    if leaf_path:
        with open(leaf_path, "rb") as f:
            status, data = _post(f.read())
        print("POST /predict (leaf photo) ->", status, data)
        assert status == 200, f"Leaf photo rejected: {data}"
        assert data.get("class_code") in VALID_CODES, f"Unexpected class_code: {data.get('class_code')}"
        confidence = data.get("confidence")
        assert isinstance(confidence, (int, float)) and 0 <= confidence <= 100, f"Invalid confidence: {confidence}"
    return data


if __name__ == "__main__":
    print(f"Testing ai-service at {BASE_URL} ...\n")
    health = check_health()
    predict = check_predict(sys.argv[1] if len(sys.argv) > 1 else None)

    print("\nAll checks passed.")
    if health["model_status"] != "trained_model_loaded":
        print(
            "\nNOTE: service is running in PLACEHOLDER mode "
            f"(model_status={health['model_status']!r}). "
            "See model/README.md to load a real trained model."
        )
