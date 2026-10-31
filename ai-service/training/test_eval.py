"""วัดผลโมเดลรุ่นแรก (Colab) กับรุ่นที่ 2 ด้วยภาพชุดทดสอบ แปลงรุ่นที่ 2 เป็น TFLite แล้ววัดผลซ้ำ และวาดกราฟลงรายงาน"""
import json, os, time
import numpy as np
import tensorflow as tf
import keras
from sklearn.metrics import accuracy_score, confusion_matrix, precision_recall_fscore_support, roc_auc_score
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib import font_manager

ROOT = os.environ.get('RICE_EVAL_DIR', 'D:/rice-eval')  # ที่เก็บภาพ (rice4/) และผลการเทรน (run/)
RUN = os.path.join(ROOT, 'run')
FIG = os.path.join(ROOT, 'report', 'fig')
os.makedirs(FIG, exist_ok=True)
CLASSES = ['BLAST', 'BLB', 'TUNGRO', 'HEALTHY']
TH = {'BLAST': 'โรคไหม้', 'BLB': 'ขอบใบแห้ง', 'TUNGRO': 'ใบสีส้ม', 'HEALTHY': 'ใบปกติ'}
_fd = os.path.expandvars(r'%LOCALAPPDATA%\Microsoft\Windows\Fonts')
for f in (os.path.join(_fd, 'THSarabunNew.ttf'), os.path.join(_fd, 'THSarabunNew Bold.ttf')):
    font_manager.fontManager.addfont(f)
plt.rcParams['font.family'] = 'TH Sarabun New'  # ฟอนต์ไทยในกราฟ
plt.rcParams['font.size'] = 18

split = json.load(open(os.path.join(RUN, 'split.json')))
files = [os.path.join(ROOT, 'rice4', f) for f in split['test_files']]
labels = np.array([CLASSES.index(os.path.normpath(f).split(os.sep)[0]) for f in split['test_files']])


def load(p):
    img = tf.io.decode_jpeg(tf.io.read_file(p), channels=3)
    return tf.image.resize(img, (224, 224))


# โหลดภาพชุดทดสอบทั้งหมดเข้าหน่วยความจำครั้งเดียว
X = np.stack([load(p).numpy() for p in files]).astype('float32')
print('test', X.shape, np.bincount(labels), flush=True)


def metrics(y, prob):
    """คำนวณ accuracy, precision, recall, F1, AUC และ confusion matrix"""
    pred = prob.argmax(1)
    p, r, f, s = precision_recall_fscore_support(y, pred, labels=range(4), zero_division=0)
    mp, mr, mf, _ = precision_recall_fscore_support(y, pred, average='macro', zero_division=0)
    wp, wr, wf, _ = precision_recall_fscore_support(y, pred, average='weighted', zero_division=0)
    return {
        'size': int(len(y)), 'accuracy': float(accuracy_score(y, pred)),
        'macro': {'precision': mp, 'recall': mr, 'f1': mf}, 'weighted': {'precision': wp, 'recall': wr, 'f1': wf},
        'auc_macro_ovr': float(roc_auc_score(np.eye(4)[y], prob, average='macro', multi_class='ovr')),
        'per_class': {CLASSES[i]: {'precision': float(p[i]), 'recall': float(r[i]), 'f1': float(f[i]), 'support': int(s[i])} for i in range(4)},
        'confusion_matrix': confusion_matrix(y, pred, labels=range(4)).tolist(),
    }


out = {}
models = {
    # the first model is not shipped in the repository; put your copy at this path to include it in the comparison
    'v1': os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'model', 'rice_disease_model.v1.keras'),
    'v2': os.path.join(RUN, 'rice_disease_model.keras'),
}
loaded = {}
for name, path in models.items():
    m = keras.models.load_model(path, compile=False)
    loaded[name] = m
    prob = m.predict(X, batch_size=32, verbose=0)
    out[name] = metrics(labels, prob)
    # จับเวลาทายทีละภาพ 50 ครั้ง (รอบแรกไม่นับ เพราะโมเดลยังโหลดไม่เสร็จ)
    one = X[:1]
    m.predict_on_batch(one)
    lat = []
    for _ in range(50):
        t = time.perf_counter(); m.predict_on_batch(one); lat.append((time.perf_counter() - t) * 1000)
    out[name]['latency_ms'] = {'mean': float(np.mean(lat)), 'p95': float(np.percentile(lat, 95))}
    print(name, out[name]['accuracy'], out[name]['macro']['f1'], flush=True)

# ---- แปลงเป็น TFLite (float16) สำหรับแอปมือถือ แล้ววัดผลซ้ำว่าแม่นเท่าเดิมไหม ----
m2 = loaded['v2']
conv = tf.lite.TFLiteConverter.from_keras_model(m2)
conv.optimizations = [tf.lite.Optimize.DEFAULT]
conv.target_spec.supported_types = [tf.float16]
tfl = conv.convert()
tfl_path = os.path.join(RUN, 'rice_disease_model.tflite')
open(tfl_path, 'wb').write(tfl)
it = tf.lite.Interpreter(model_path=tfl_path, num_threads=4)
it.allocate_tensors()
inp, outp = it.get_input_details()[0], it.get_output_details()[0]
probs, lat = [], []
for x in X:
    it.set_tensor(inp['index'], x[None])
    t = time.perf_counter(); it.invoke(); lat.append((time.perf_counter() - t) * 1000)
    probs.append(it.get_tensor(outp['index'])[0])
out['v2_tflite'] = metrics(labels, np.array(probs))
out['v2_tflite']['size_mb'] = os.path.getsize(tfl_path) / 1e6
out['v2_tflite']['latency_ms'] = {'mean': float(np.mean(lat)), 'p95': float(np.percentile(lat, 95))}
print('tflite', out['v2_tflite']['accuracy'], out['v2_tflite']['size_mb'], flush=True)

out['split'] = split['split']
out['params'] = int(m2.count_params())
out['tensorflow'] = tf.__version__
json.dump(out, open(os.path.join(RUN, 'test_metrics.json'), 'w'), indent=2)

# ---- วาดกราฟ: เส้นการเทรน, confusion matrix ของทั้งสองรุ่น, F1 รายโรค ----
hist = json.load(open(os.path.join(RUN, 'history.json')))
n_head = hist['phase'].count('head')
ep = np.arange(1, len(hist['accuracy']) + 1)
fig, ax = plt.subplots(1, 2, figsize=(13, 4.6))
for a, k, t in ((ax[0], 'accuracy', 'ความแม่นยำ (Accuracy)'), (ax[1], 'loss', 'ค่าความสูญเสีย (Loss)')):
    a.plot(ep, hist[k], color='#1f4d3a', lw=2.2, label='ชุดฝึกสอน (Train)')
    a.plot(ep, hist['val_' + k], color='#c89b3c', lw=2.2, label='ชุดตรวจสอบ (Validation)')
    a.axvline(n_head + 0.5, color='#95a49b', ls='--', lw=1.4)
    a.text(n_head + 0.8, a.get_ylim()[0] + (a.get_ylim()[1] - a.get_ylim()[0]) * 0.06, 'เริ่ม Fine-tuning', color='#6b7c74', fontsize=16)
    a.set_title(t); a.set_xlabel('รอบการฝึกสอน (Epoch)'); a.grid(alpha=.25); a.legend(frameon=False, fontsize=16)
    a.spines[['top', 'right']].set_visible(False)
plt.tight_layout(); plt.savefig(os.path.join(FIG, 'training_curves_v2.png'), dpi=200); plt.close()

for name, title in (('v1', 'โมเดลเดิม (v1)'), ('v2', 'โมเดลใหม่ (v2)')):
    cm = np.array(out[name]['confusion_matrix'])
    fig, a = plt.subplots(figsize=(6.4, 5.4))
    a.imshow(cm, cmap='Greens')
    names = [f'{TH[c]}\n{c}' for c in CLASSES]
    a.set_xticks(range(4), names, fontsize=15); a.set_yticks(range(4), names, fontsize=15)
    for i in range(4):
        for j in range(4):
            a.text(j, i, cm[i, j], ha='center', va='center', fontsize=20, fontweight='bold', color='white' if cm[i, j] > cm.max() * .55 else '#1c2620')
    a.set_xlabel('คลาสที่โมเดลทำนาย'); a.set_ylabel('คลาสจริง')
    a.set_title(f'{title} · Accuracy {out[name]["accuracy"] * 100:.2f}%')
    plt.tight_layout(); plt.savefig(os.path.join(FIG, f'confusion_{name}.png'), dpi=200); plt.close()

fig, a = plt.subplots(figsize=(10, 4.4))
x = np.arange(4); w = .38
f1v1 = [out['v1']['per_class'][c]['f1'] for c in CLASSES]
f1v2 = [out['v2']['per_class'][c]['f1'] for c in CLASSES]
b1 = a.bar(x - w / 2, f1v1, w, color='#c9d4cd', label='โมเดลเดิม (v1)')
b2 = a.bar(x + w / 2, f1v2, w, color='#1f4d3a', label='โมเดลใหม่ (v2)')
for bars in (b1, b2):
    for b in bars:
        a.text(b.get_x() + b.get_width() / 2, b.get_height() + .01, f'{b.get_height():.2f}', ha='center', fontsize=15)
a.set_xticks(x, [f'{TH[c]} ({c})' for c in CLASSES]); a.set_ylim(0, 1.22); a.set_ylabel('F1-score')
a.legend(frameon=False, loc='upper center', ncol=2); a.spines[['top', 'right']].set_visible(False); a.grid(axis='y', alpha=.25)
plt.tight_layout(); plt.savefig(os.path.join(FIG, 'f1_compare.png'), dpi=200); plt.close()
print(json.dumps({k: (v['accuracy'] if isinstance(v, dict) and 'accuracy' in v else None) for k, v in out.items()}))
