"""ผลรายคลาสและกราฟของโมเดลรุ่นที่ 3 (รันหลัง build_v3.py)

- คำนวณ confusion matrix 5x5 และ Precision/Recall/F1 ของทั้ง 5 คลาสบนชุดทดสอบ 1,562 ภาพ (761 + 801)
  แล้วเขียนเพิ่มใน ai-service/model/metrics.json ที่ช่อง test_5class
- วาดกราฟสำหรับหน้า /research-study และรายงาน แบบเดียวกับกราฟของ V1/V2 (test_eval.py):
  web/public/research-study/confusion-matrix-v3.png, training-curves-v3.png
"""
import json, os

os.environ.setdefault('KERAS_BACKEND', 'tensorflow')
import numpy as np
import keras
from sklearn.metrics import confusion_matrix, precision_recall_fscore_support
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib import font_manager

HERE = os.path.dirname(os.path.abspath(__file__))
AI = os.path.dirname(HERE)
ROOT = os.environ.get('RICE_EVAL_DIR', 'D:/rice-eval')
FIG = os.path.join(AI, '..', 'web', 'public', 'research-study')
CLASSES5 = ['BLAST', 'BLB', 'TUNGRO', 'HEALTHY', 'OTHER']
TH = {'BLAST': 'โรคไหม้', 'BLB': 'ขอบใบแห้ง', 'TUNGRO': 'ใบสีส้ม', 'HEALTHY': 'ใบปกติ', 'OTHER': 'โรคอื่น'}
_fd = os.path.expandvars(r'%LOCALAPPDATA%\Microsoft\Windows\Fonts')
for f in ('THSarabunNew.ttf', 'THSarabunNew Bold.ttf'):
    font_manager.fontManager.addfont(os.path.join(_fd, f))
plt.rcParams['font.family'] = 'TH Sarabun New'
plt.rcParams['font.size'] = 18

mpath = os.path.join(AI, 'model', 'metrics.json')
M = json.load(open(mpath))
seed = M['selection']['picked_seed']
d = np.load(os.path.join(ROOT, 'v3', 'data5.npz'))
X, Y = d['x_test'].astype('float32'), d['y_test']
model = keras.models.load_model(os.path.join(AI, 'model', 'rice_disease_model.keras'), compile=False)
pred = model.predict(X, batch_size=32, verbose=0).argmax(1)

cm = confusion_matrix(Y, pred, labels=range(5))
p, r, f, s = precision_recall_fscore_support(Y, pred, labels=range(5), zero_division=0)
mp, mr, mf, _ = precision_recall_fscore_support(Y, pred, labels=range(5), average='macro', zero_division=0)
M['test_5class'] = {
    'size': int(len(Y)), 'accuracy': float((pred == Y).mean()), 'correct': int((pred == Y).sum()),
    'macro': {'precision': mp, 'recall': mr, 'f1': mf},
    'per_class': {CLASSES5[i]: {'precision': float(p[i]), 'recall': float(r[i]), 'f1': float(f[i]), 'support': int(s[i])} for i in range(5)},
    'confusion_matrix': cm.tolist(),
    'note': 'argmax only, before the confidence cut-off; OTHER = 6 diseases the app does not diagnose',
}
json.dump(M, open(mpath, 'w'), indent=2)
print('5-class acc', M['test_5class']['accuracy'], cm.tolist())

# confusion matrix
fig, a = plt.subplots(figsize=(7.6, 6.4))
a.imshow(np.log1p(cm), cmap='Greens')
names = [f'{TH[c]}\n{c}' for c in CLASSES5]
a.set_xticks(range(5), names, fontsize=15); a.set_yticks(range(5), names, fontsize=15)
for i in range(5):
    for j in range(5):
        a.text(j, i, cm[i, j], ha='center', va='center', fontsize=20, fontweight='bold',
               color='white' if np.log1p(cm[i, j]) > np.log1p(cm.max()) * .6 else '#1c2620')
a.set_xlabel('คลาสที่โมเดลทำนาย'); a.set_ylabel('คลาสจริง')
a.set_title(f"โมเดลรุ่นที่ 3 (V3) · 5 คลาส · ถูก {M['test_5class']['correct']:,} จาก {len(Y):,} ภาพ")
plt.tight_layout(); plt.savefig(os.path.join(FIG, 'confusion-matrix-v3.png'), dpi=200); plt.close()

# training curves
h = json.load(open(os.path.join(ROOT, 'v3', f'seed-{seed}', 'history.json')))
n_head = h['phase'].count('head')
ep = np.arange(1, len(h['accuracy']) + 1)
fig, ax = plt.subplots(1, 2, figsize=(13, 4.6))
for a, k, t in ((ax[0], 'accuracy', 'ความแม่นยำ (Accuracy)'), (ax[1], 'loss', 'ค่าความสูญเสีย (Loss)')):
    a.plot(ep, h[k], color='#1f4d3a', lw=2.2, label='ชุดฝึกสอน (Train)')
    a.plot(ep, h['val_' + k], color='#c89b3c', lw=2.2, label='ชุดตรวจสอบ (Validation)')
    a.axvline(n_head + 0.5, color='#95a49b', ls='--', lw=1.4)
    a.text(n_head + 0.8, a.get_ylim()[0] + (a.get_ylim()[1] - a.get_ylim()[0]) * 0.06, 'เริ่ม Fine-tuning', color='#6b7c74', fontsize=16)
    a.set_title(t); a.set_xlabel('รอบการฝึกสอน (Epoch)'); a.grid(alpha=.25); a.legend(frameon=False, fontsize=16)
    a.spines[['top', 'right']].set_visible(False)
plt.tight_layout(); plt.savefig(os.path.join(FIG, 'training-curves-v3.png'), dpi=200); plt.close()
print('figures saved')
