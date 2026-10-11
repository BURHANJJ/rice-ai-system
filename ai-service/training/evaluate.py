"""แบ่งภาพแบบเดียวกับใน Colab (seed 42, ตรวจสอบ 15%) แล้ววัดผลโมเดลรุ่นแรก ใช้ยืนยันว่ารุ่นแรกแม่นยำ 70.26% จริง

รันครั้งแรกจะย้ายภาพ 4 โฟลเดอร์จาก raw/train_images ไปไว้ที่ rice4/ ให้ด้วย
"""
import json, os, shutil, time
import numpy as np
import tensorflow as tf
import keras

ROOT = os.environ.get('RICE_EVAL_DIR', 'D:/rice-eval')  # ที่เก็บภาพ (rice4/) และผลการเทรน (run/)
RAW = os.path.join(ROOT, 'raw', 'train_images')
CLEAN = os.path.join(ROOT, 'rice4')
MODEL = os.path.join(os.path.dirname(__file__), '..', 'model', 'rice_disease_model.v1.keras')  # โมเดลรุ่นแรกที่สำรองไว้
# ชื่อโฟลเดอร์ใน Kaggle -> ชื่อคลาสในระบบ
CLASS_MAP = {'blast': 'BLAST', 'bacterial_leaf_blight': 'BLB', 'tungro': 'TUNGRO', 'normal': 'HEALTHY'}
CLASSES = ['BLAST', 'BLB', 'TUNGRO', 'HEALTHY']
SEED, VAL_SPLIT, IMG, BATCH = 42, 0.15, (224, 224), 32

# ย้ายภาพ 4 คลาสที่ใช้มาไว้ที่ rice4/ (ทำครั้งเดียว)
if not os.path.isdir(CLEAN):
    os.makedirs(CLEAN)
    for src, dst in CLASS_MAP.items():
        shutil.move(os.path.join(RAW, src), os.path.join(CLEAN, dst))

counts = {c: len(os.listdir(os.path.join(CLEAN, c))) for c in CLASSES}
print('counts', counts, flush=True)

# ใช้คำสั่งแบ่งภาพตัวเดียวกับใน Colab จะได้ชุดตรวจสอบเป็นภาพชุดเดิม
common = dict(validation_split=VAL_SPLIT, seed=SEED, image_size=IMG, batch_size=BATCH, class_names=CLASSES, label_mode='categorical', shuffle=True)
train_ds = keras.utils.image_dataset_from_directory(CLEAN, subset='training', **common)
val_ds = keras.utils.image_dataset_from_directory(CLEAN, subset='validation', **common)

model = keras.models.load_model(MODEL, compile=False)
print('model loaded', model.name, model.count_params(), flush=True)

y_true, y_prob = [], []
t0 = time.perf_counter()
for x, y in val_ds:
    y_prob.append(model.predict_on_batch(x))
    y_true.append(np.argmax(y.numpy(), axis=1))
elapsed = time.perf_counter() - t0
y_true = np.concatenate(y_true)
y_prob = np.concatenate(y_prob)
y_pred = np.argmax(y_prob, axis=1)

from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, precision_recall_fscore_support, roc_auc_score
acc = accuracy_score(y_true, y_pred)
cm = confusion_matrix(y_true, y_pred, labels=range(4))
p, r, f, s = precision_recall_fscore_support(y_true, y_pred, labels=range(4), zero_division=0)
mp, mr, mf, _ = precision_recall_fscore_support(y_true, y_pred, average='macro', zero_division=0)
wp, wr, wf, _ = precision_recall_fscore_support(y_true, y_pred, average='weighted', zero_division=0)
try:
    auc = roc_auc_score(np.eye(4)[y_true], y_prob, average='macro', multi_class='ovr')
except Exception:
    auc = None
print(classification_report(y_true, y_pred, target_names=CLASSES, digits=4))
print('accuracy', acc, 'macroF1', mf, 'auc', auc)

# เวลาที่ใช้ทายภาพเดียว (เท่ากับเวลาสแกน 1 ครั้งบนเซิร์ฟเวอร์) ไม่นับรอบแรก
sample = next(iter(val_ds))[0][:1]
model.predict_on_batch(sample)
lat = []
for _ in range(50):
    t = time.perf_counter(); model.predict_on_batch(sample); lat.append((time.perf_counter() - t) * 1000)

out = {
    'dataset': 'Paddy Doctor / Kaggle paddy-disease-classification (train_images)',
    'class_counts': counts,
    'val_size': int(len(y_true)),
    'val_counts': {CLASSES[i]: int((y_true == i).sum()) for i in range(4)},
    'accuracy': acc,
    'macro': {'precision': mp, 'recall': mr, 'f1': mf},
    'weighted': {'precision': wp, 'recall': wr, 'f1': wf},
    'auc_macro_ovr': auc,
    'per_class': {CLASSES[i]: {'precision': float(p[i]), 'recall': float(r[i]), 'f1': float(f[i]), 'support': int(s[i])} for i in range(4)},
    'confusion_matrix': cm.tolist(),
    'batch_eval_seconds': elapsed,
    'latency_ms': {'mean': float(np.mean(lat)), 'p50': float(np.median(lat)), 'p95': float(np.percentile(lat, 95)), 'min': float(np.min(lat)), 'max': float(np.max(lat))},
    'tensorflow': tf.__version__, 'keras': keras.__version__,
    'params': int(model.count_params()),
}
# นับจำนวนภาพในชุดเทรน
n_train = 0
for _, y in train_ds:
    n_train += y.shape[0]
out['train_size'] = n_train
json.dump(out, open(os.path.join(ROOT, 'metrics.json'), 'w'), indent=2)
np.save(os.path.join(ROOT, 'y_prob.npy'), y_prob)
np.save(os.path.join(ROOT, 'y_true.npy'), y_true)
print(json.dumps(out, indent=2))
