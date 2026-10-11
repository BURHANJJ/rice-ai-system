# Model directory

Place the files exported by `rice_ai_train_model_colab.ipynb` here:

- `rice_disease_model.keras` — the trained Keras model, **native Keras 3
  format (preferred)**. `main.py` looks for this file first.
- `rice_disease_model.h5` — same model, legacy HDF5 format. Only used if
  no `.keras` file is present.
- `class_indices.json` — the exact output-index → class-code mapping used
  during training (e.g. `{"0": "BLAST", "1": "BLB", "2": "TUNGRO", "3": "HEALTHY"}`)

`class_indices.json` is required together with whichever model file you
use. `main.py` reads it at startup so it never has to guess the model's
output order — if it's missing, the service logs a loud warning and falls
back to the default order (`BLAST, BLB, TUNGRO, HEALTHY`), which is only
correct if you trained with that exact order.

## ⚠️ `.h5` vs `.keras` — use `.keras` if you have both

If Colab exported both a `.h5` and a `.keras` file for the same model and
the `.h5` file is only a few **KB** (not several **MB**), the `.h5` save
was incomplete/broken — this can happen when the model has a
preprocessing layer baked into it (like
`keras.applications.efficientnet.preprocess_input`, used in the training
notebook) and the legacy HDF5 format doesn't serialize it correctly.
**Only copy the `.keras` file in that case** — `main.py` already prefers
`.keras` automatically when both are present, and refuses to load a model
file smaller than 1 MB (treating it as broken rather than silently using
garbage weights).

## No trained model is included in this repo

The source project (`RICE_AI_CLAUDE_HANDOFF.md`) targets 97.4% accuracy on
4 classes — Rice Blast, Bacterial Leaf Blight, Rice Tungro Virus, Healthy
Rice Leaf — but no labeled training dataset or trained weights were part
of that handoff, so they can't be reconstructed here.

## How to get a real model in here

1. Open `rice_ai_train_model_colab.ipynb` in Google Colab
   (`Runtime → Change runtime type → GPU`).
2. Run all cells. It downloads a public Kaggle dataset (Paddy Disease
   Classification), filters it to our 4 classes, trains an EfficientNetB0
   transfer-learning model, fine-tunes it, evaluates it, and exports
   `rice_disease_model.h5` + `class_indices.json` as a downloadable zip.
3. Copy both files into this folder.
4. In `ai-service/`, uncomment `tensorflow`, `pillow`, and `numpy` in
   `requirements.txt` and run `pip install -r requirements.txt`.
5. Restart the service (`python main.py`). Check `GET /health` — it should
   report `"model_status": "trained_model_loaded"`.

## If you train a different model architecture

`main.py`'s `predict_with_real_model()` assumes:
- Input: a single RGB image, resized to `IMG_SIZE = (224, 224)`, as a
  raw 0–255 float array (no manual normalization — see the comment in
  `main.py` for why: preprocessing is baked into the exported model graph
  in the reference training notebook).
- Output: a single softmax vector over `len(class_indices.json)` classes.

If your model expects different preprocessing or a different output
shape, edit `predict_with_real_model()` in `main.py` to match — don't
just drop in a differently-shaped model and hope.
