# Rice AI — Inference Service (FastAPI)

The AI classification microservice for the Rice AI system. Called by the
Node.js backend (`backend/src/services/aiClient.js`) — not meant to be
called directly by mobile/web clients.

Classifies a rice leaf image into one of 4 classes:
`BLAST` (Rice Blast), `BLB` (Bacterial Leaf Blight), `TUNGRO` (Rice Tungro
Virus), `HEALTHY` (Healthy Rice Leaf).

## Status

Runs in one of two modes automatically, based on whether a trained model
is present:

| Mode | When | What you get |
|---|---|---|
| **Placeholder** | No `model/rice_disease_model.h5` found | Deterministic-per-image pseudo-random classifier — lets the rest of the product (backend/web/mobile) be built and demoed without a trained model. Every response is labeled `"source": "placeholder_no_trained_model"`. |
| **Trained model** | `model/rice_disease_model.h5` + `model/class_indices.json` both present | Real inference through the loaded Keras model. Every response is labeled `"source": "trained_model"`. |

No trained model ships with this service — see `model/README.md` for how
to train one (a ready-to-run Google Colab notebook is provided in the
main project) and drop it in here.

## Setup

```bash
pip install -r requirements.txt
python main.py
# -> http://localhost:8000
```

To use a real trained model, first uncomment `tensorflow`, `pillow`, and
`numpy` in `requirements.txt`, `pip install -r requirements.txt` again,
then follow `model/README.md`.

### Verify it's working

```bash
curl http://localhost:8000/health
python test_service.py
```

## Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Service status, current `model_status`, and the active class-index mapping |
| POST | `/predict` | Body = raw image bytes. Returns `{ class_code, confidence, model_status, source, elapsed_ms }` |

## Configuration (environment variables)

| Variable | Default | Purpose |
|---|---|---|
| `MODEL_DIR` | `./model` | Folder containing the model files |
| `MODEL_PATH` | `<MODEL_DIR>/rice_disease_model.h5` | Path to the trained Keras model |
| `CLASS_INDEX_PATH` | `<MODEL_DIR>/class_indices.json` | Path to the output-index → class-code mapping |
| `PORT` | `8000` | Port to listen on |

## Files

```
main.py             — FastAPI app: /health, /predict, model loading, both inference modes
requirements.txt    — core deps always; tensorflow/pillow/numpy commented until needed
model/               — put rice_disease_model.h5 + class_indices.json here
  README.md          — how to get/train a model
test_service.py      — smoke test: health check + a dummy prediction
```

## Design notes / why it's built this way

- **Deferred imports** — `tensorflow`, `pillow`, and `numpy` are only
  imported inside `load_model()` / `predict_with_real_model()`, not at
  module load time. This means the service still starts (in placeholder
  mode) even in an environment where those heavier packages aren't
  installed yet — useful for backend/frontend developers who don't need
  to touch the model.
- **No silent guessing on class order** — if `class_indices.json` is
  missing when a model file *is* present, the service logs a loud warning
  and falls back to a default order rather than silently assuming it's
  correct. Wrong class order means every prediction is mislabeled with no
  visible error, which is worse than a service that fails to start.
- **Inference failures are surfaced, not masked** — if the trained model
  throws during prediction, `/predict` returns HTTP 500 with the real
  error. It does not fall back to the placeholder classifier for that
  request, because a placeholder result and a real broken result must
  never look the same to the caller.
