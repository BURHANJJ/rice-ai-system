"""เลือก วัดผล และติดตั้งโมเดลรุ่นที่ 3 (V3) ให้ AI service และแอปมือถือ

V3 = EfficientNet-B0 5 คลาส [BLAST, BLB, TUNGRO, HEALTHY, OTHER] เทรนด้วย train_v3.py
OTHER คือโรค/อาการอื่นของใบข้าวที่ระบบยังไม่รองรับ ระบบจะไม่ตอบเป็นผลวินิจฉัย แต่บอกผู้ใช้ว่าอยู่นอกขอบเขต

ขั้นตอน (ตัดสินใจด้วยชุด validation เท่านั้น ชุดทดสอบใช้วัดผลครั้งสุดท้าย)
1. เลือก seed ที่ validation accuracy สูงสุด เท่ากันให้ดู validation loss ต่ำสุด
2. เลือกเกณฑ์ความมั่นใจด้วยชุด validation: ให้คะแนน +1 ต่อภาพที่ตอบถูก และ -2 ต่อผลวินิจฉัยผิด
   (ภาพ 4 คลาสที่ตอบผิดโรค หรือภาพโรคอื่นที่ได้ผลวินิจฉัย) เลือกเกณฑ์ที่คะแนนรวมสูงสุด
   เกณฑ์นี้เขียนลง metrics.json และ model_config.json ให้ service และแอปใช้ค่าเดียวกัน
3. วัดผลบนชุดทดสอบ:
   - 4 คลาสเดิม 761 ภาพ (ชุดเดียวกับ V2): ภาพที่ถูกส่งไป OTHER นับว่าผิด เพราะผู้ใช้ไม่ได้คำตอบ
   - ภาพโรคอื่น 801 ภาพ: ควรถูกปฏิเสธ (ทาย OTHER หรือความมั่นใจต่ำกว่า 75%)
   เทียบกับ V2 ด้วยกติกาที่ผู้ใช้เจอจริง (ทาย + เกณฑ์ 75% ของ V2)
4. temperature scaling: ทดลองแล้วไม่ใช้ (ดู training/README.md) จึงไม่มีในรุ่นนี้
5. แปลงเป็น TFLite Float16 ตรวจว่าทายตรงกับ Keras ทุกภาพ
6. ติดตั้ง ai-service/model/{rice_disease_model.keras, class_indices.json, metrics.json}
   และ mobile/assets/model/{rice_disease_model.tflite, class_indices.json, model_config.json}
   รุ่นเก่าเก็บไว้เป็น rice_disease_model.v2.keras และ metrics.v2.json

รัน:  python build_v3.py [--dry-run]     (Python ที่มี TensorFlow)
"""
import json, math, os, shutil, subprocess, sys, time

os.environ.setdefault('KERAS_BACKEND', 'tensorflow')
import numpy as np
import tensorflow as tf
import keras
from sklearn.metrics import accuracy_score, confusion_matrix, precision_recall_fscore_support, roc_auc_score

HERE = os.path.dirname(os.path.abspath(__file__))
AI = os.path.dirname(HERE)
ROOT = os.environ.get('RICE_EVAL_DIR', 'D:/rice-eval')
RUNS = os.path.join(ROOT, 'v3')
SEEDS = (42, 7, 2026)
CLASSES5 = ['BLAST', 'BLB', 'TUNGRO', 'HEALTHY', 'OTHER']
MODEL_DIR = os.path.join(AI, 'model')
MOBILE_DIR = os.path.join(AI, '..', 'mobile', 'assets', 'model')
V2_THRESHOLD = 0.75  # เกณฑ์ที่ V2 ใช้จริง
WRONG_COST = 2.0      # ตอนเลือกเกณฑ์: ผลวินิจฉัยผิด 1 ครั้ง แย่เท่ากับให้ผู้ใช้ถ่ายใหม่ 2 ครั้ง
DRY = '--dry-run' in sys.argv

d = np.load(os.path.join(RUNS, 'data5.npz'))
Xt, Yt, St = d['x_test'].astype('float32'), d['y_test'], d['sub_test']
inn, oth = Yt < 4, Yt == 4
sources = [str(s) for s in d['other_sources']]

# ---------- 1. เลือกรุ่น ----------
cands = []
for s in SEEDS:
    p = os.path.join(RUNS, f'seed-{s}')
    if not os.path.exists(os.path.join(p, 'train_info.json')):
        continue
    h = json.load(open(os.path.join(p, 'history.json')))
    i = int(np.argmax(h['val_accuracy']))
    cands.append({'seed': s, 'val_accuracy': h['val_accuracy'][i], 'val_loss': h['val_loss'][i],
                  'train_seconds': json.load(open(os.path.join(p, 'train_info.json')))['train_seconds']})
cands.sort(key=lambda c: (-c['val_accuracy'], c['val_loss']))
pick = cands[0]
print('candidates', cands, '\npick', pick, flush=True)
src = os.path.join(RUNS, f"seed-{pick['seed']}", 'model.keras')
model = keras.models.load_model(src, compile=False)


# ---------- 2. วัดผล ----------
def user_outcome(prob, thr):
    """สิ่งที่ผู้ใช้เห็นจริง: ชื่อโรค (0-3) หรือ 'ปฏิเสธ' (-1) เมื่อทาย OTHER หรือความมั่นใจต่ำกว่าเกณฑ์"""
    pred = prob.argmax(1)
    shown = np.where((prob.max(1) < thr) | (pred == 4), -1, pred)
    return pred, shown


# ---------- เลือกเกณฑ์ด้วย validation ----------
Xv, Yv = d['x_val'].astype('float32'), d['y_val']
pv = model.predict(Xv, batch_size=32, verbose=0)


def score(thr):
    _, shown = user_outcome(pv, thr)
    good = int(((shown >= 0) & (shown == Yv)).sum())
    wrong = int(((shown >= 0) & (shown != Yv)).sum())  # รวมภาพ OTHER ที่ได้ผลวินิจฉัย
    return good - WRONG_COST * wrong, good, wrong


grid = [round(t, 2) for t in np.arange(0.40, 0.91, 0.05)]
table = [{'threshold': t, 'score': score(t)[0], 'correct_answers': score(t)[1], 'wrong_answers': score(t)[2]} for t in grid]
THRESHOLD = max(table, key=lambda r: (r['score'], r['threshold']))['threshold']
print('threshold on validation:', THRESHOLD, table, flush=True)


def in_scope_report(prob, thr):
    y = Yt[inn]
    pred, shown = user_outcome(prob[inn], thr)
    p4 = np.where(pred == 4, -1, pred)  # OTHER บนภาพ 4 คลาสเดิม = ผิด
    pr, rc, f1, sup = precision_recall_fscore_support(y, p4, labels=range(4), zero_division=0)
    mp, mr, mf, _ = precision_recall_fscore_support(y, p4, labels=range(4), average='macro', zero_division=0)
    wp, wr, wf, _ = precision_recall_fscore_support(y, p4, labels=range(4), average='weighted', zero_division=0)
    pin = prob[inn][:, :4] / prob[inn][:, :4].sum(1, keepdims=True)
    return {
        'size': int(len(y)), 'accuracy': float((p4 == y).mean()), 'correct': int((p4 == y).sum()),
        'sent_to_other': int((pred == 4).sum()),
        'macro': {'precision': mp, 'recall': mr, 'f1': mf}, 'weighted': {'precision': wp, 'recall': wr, 'f1': wf},
        'auc_macro_ovr': float(roc_auc_score(np.eye(4)[y], pin, average='macro', multi_class='ovr')),
        'per_class': {CLASSES5[i]: {'precision': float(pr[i]), 'recall': float(rc[i]), 'f1': float(f1[i]), 'support': int(sup[i])} for i in range(4)},
        'confusion_matrix': confusion_matrix(y, np.where(pred == 4, 4, pred), labels=range(5)).tolist(),
        'user_view': {'answered': float((shown >= 0).mean()), 'answered_correct': float((shown[shown >= 0] == y[shown >= 0]).mean()),
                      'wrong_answers': int(((shown >= 0) & (shown != y)).sum()), 'rejected': int((shown < 0).sum())},
    }


def other_report(prob, thr):
    pred, shown = user_outcome(prob[oth], thr)
    sub = St[oth]
    return {
        'size': int(oth.sum()), 'rejected': float((shown < 0).mean()), 'given_wrong_diagnosis': int((shown >= 0).sum()),
        'predicted_other': float((pred == 4).mean()) if prob.shape[1] == 5 else None,
        'per_source_rejected': {sources[i]: float((shown[sub == i] < 0).mean()) for i in range(len(sources))},
    }


p3 = model.predict(Xt, batch_size=32, verbose=0)
v2_path = os.path.join(MODEL_DIR, 'rice_disease_model.v2.keras')
v2 = keras.models.load_model(v2_path if os.path.exists(v2_path) else os.path.join(MODEL_DIR, 'rice_disease_model.keras'), compile=False)
assert v2.output_shape[-1] == 4, 'ไฟล์เปรียบเทียบต้องเป็น V2 (4 คลาส)'
p2 = v2.predict(Xt, batch_size=32, verbose=0)
r3, r2 = in_scope_report(p3, THRESHOLD), in_scope_report(p2, V2_THRESHOLD)
o3, o2 = other_report(p3, THRESHOLD), other_report(p2, V2_THRESHOLD)
r3_75, o3_75 = in_scope_report(p3, 0.75), other_report(p3, 0.75)
a = p2[inn].argmax(1) == Yt[inn]
c = np.where(p3[inn].argmax(1) == 4, -1, p3[inn].argmax(1)) == Yt[inn]
n01, n10 = int((a & ~c).sum()), int((~a & c).sum())
mcn = min(1.0, 2 * sum(math.comb(n01 + n10, i) for i in range(min(n01, n10) + 1)) / 2 ** (n01 + n10)) if n01 + n10 else 1.0
for name, r, o in (('V2', r2, o2), ('V3', r3, o3)):
    print(f"{name} in-scope acc {r['accuracy']:.4f} ({r['correct']}/761) f1 {r['macro']['f1']:.4f} answered {r['user_view']['answered']:.3f} "
          f"wrong answers {r['user_view']['wrong_answers']} | other-disease photos rejected {o['rejected']:.3f} (wrong diagnosis {o['given_wrong_diagnosis']}/{o['size']})")
print(f'McNemar on 761 in-scope images: V2 only-right {n01} / V3 only-right {n10}  p={mcn:.3f}', flush=True)

# ---------- 4. TFLite ----------
tmp = os.path.join(RUNS, 'v3_candidate.tflite')
conv = tf.lite.TFLiteConverter.from_keras_model(model)
conv.optimizations = [tf.lite.Optimize.DEFAULT]
conv.target_spec.supported_types = [tf.float16]
open(tmp, 'wb').write(conv.convert())
it = tf.lite.Interpreter(model_path=tmp, num_threads=4)
it.allocate_tensors()
ii, oo = it.get_input_details()[0]['index'], it.get_output_details()[0]['index']
pt = []
for x in Xt:
    it.set_tensor(ii, x[None]); it.invoke(); pt.append(it.get_tensor(oo)[0].copy())
pt = np.array(pt)
agree = float((pt.argmax(1) == p3.argmax(1)).mean())
same_user_view = float((user_outcome(pt, THRESHOLD)[1] == user_outcome(p3, THRESHOLD)[1]).mean())
it.set_tensor(ii, Xt[:1])
lat = []
for _ in range(110):
    t0 = time.perf_counter(); it.invoke(); lat.append((time.perf_counter() - t0) * 1000)
print(f'tflite {os.path.getsize(tmp) / 1e6:.2f} MB argmax agreement {agree:.4f} same user outcome {same_user_view:.4f} '
      f'median {np.median(lat[10:]):.1f} ms', flush=True)
assert agree >= 0.999, 'TFLite ทายไม่ตรงกับ Keras'

v2_metrics_path = os.path.join(MODEL_DIR, 'metrics.v2.json' if os.path.exists(os.path.join(MODEL_DIR, 'metrics.v2.json')) else 'metrics.json')
v2_metrics = json.load(open(v2_metrics_path))
commit = subprocess.run(['git', 'rev-parse', '--short', 'HEAD'], capture_output=True, text=True, cwd=AI).stdout.strip()
metrics = {
    'model_version': f"v3 ({time.strftime('%Y-%m-%d')})",
    'architecture': 'EfficientNetB0 transfer learning, full fine-tune (BatchNorm frozen), 5 outputs',
    'classes': CLASSES5,
    'out_of_scope_class': 'OTHER',
    'dataset': 'Paddy Doctor (Kaggle paddy-disease-classification): 4 supported classes (5,069 images) + OTHER from 6 further classes (5,338 images)',
    'other_sources': sources,
    'selection': {'rule': 'highest validation accuracy, ties broken by lowest validation loss', 'candidates': cands, 'picked_seed': pick['seed']},
    'training': {'script': 'ai-service/training/train_v3.py', 'device': 'NVIDIA RTX 4070 Laptop GPU', 'framework': 'Keras 3.15 + PyTorch 2.11 (CUDA 12.8)',
                 'recipe': 'same as v2: 6 epochs head lr 1e-3, 18 epochs fine-tune lr 1e-4, label smoothing 0.1, dropout 0.3, class weights, augmentation 0.15, batch 32',
                 'code_commit': commit},
    'split': {'in_scope': v2_metrics['split'], 'other': {k: int((d[f'y_{k}'] == 4).sum()) for k in ('train', 'val', 'test')}},
    'threshold': THRESHOLD,
    'threshold_selection': {'set': 'validation', 'rule': f'maximise correct answers - {WRONG_COST:g} x wrong diagnoses', 'grid': table},
    'test_at_75': {'in_scope_user_view': r3_75['user_view'], 'other_rejected': o3_75['rejected']},
    'test': r3,
    'test_other': o3,
    'tflite': {'type': 'float16', 'size_mb': os.path.getsize(tmp) / 1e6, 'argmax_agreement_with_keras': agree,
               'same_user_outcome': same_user_view, 'cpu_ms_median_4_threads': float(np.median(lat[10:]))},
    'previous': {'model_version': v2_metrics.get('model_version'), 'test': {k: r2[k] for k in ('accuracy', 'correct', 'macro', 'auc_macro_ovr', 'user_view')},
                 'test_other': o2, 'mcnemar_vs_v3_in_scope': {'v2_only_right': n01, 'v3_only_right': n10, 'p': mcn}},
    'older': {'model_version': 'v1 (Colab, 2026-08-15)', 'test_accuracy': 0.7542706964520368},
    'tensorflow': tf.__version__,
}

if DRY:
    print('dry run: nothing installed')
    sys.exit(0)

# ---------- 5. ติดตั้ง ----------
if not os.path.exists(v2_path):
    shutil.copy2(os.path.join(MODEL_DIR, 'rice_disease_model.keras'), v2_path)
    shutil.copy2(os.path.join(MODEL_DIR, 'metrics.json'), os.path.join(MODEL_DIR, 'metrics.v2.json'))
model.save(os.path.join(MODEL_DIR, 'rice_disease_model.keras'))
json.dump(metrics, open(os.path.join(MODEL_DIR, 'metrics.json'), 'w'), indent=2)
labels = {str(i): c for i, c in enumerate(CLASSES5)}
for folder in (MODEL_DIR, MOBILE_DIR):
    json.dump(labels, open(os.path.join(folder, 'class_indices.json'), 'w'), indent=2)
json.dump({'model_version': metrics['model_version'], 'min_confidence': round(THRESHOLD * 100, 2), 'out_of_scope_class': 'OTHER'},
          open(os.path.join(MOBILE_DIR, 'model_config.json'), 'w'), indent=2)
shutil.copy2(tmp, os.path.join(MOBILE_DIR, 'rice_disease_model.tflite'))
os.remove(tmp)
print('installed v3 (seed', pick['seed'], ')')
