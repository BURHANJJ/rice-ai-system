"""วาดกราฟสำหรับรายงานจาก results/summary.json (รันหลัง evaluate.py)

ได้ไฟล์ใน results/figures/:
    accuracy_vs_size.png    ความแม่นยำเทียบกับขนาดไฟล์ TFLite (แกน x แบบ log)
    macro_f1.png            Macro F1 เฉลี่ย 3 seed พร้อมแถบส่วนเบี่ยงเบนมาตรฐาน
    per_class_f1.png        F1 รายโรคของทุกโมเดล
    confusion_matrices.png  confusion matrix ของทุกโมเดล (seed 42)
    training_curves.png     ความแม่นยำบนชุดตรวจสอบทุกรอบ (seed 42)
"""
import json, os

import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib import font_manager

from common import RESULTS_DIR

FIG = os.path.join(RESULTS_DIR, 'figures')
os.makedirs(FIG, exist_ok=True)
_fd = os.path.expandvars(r'%LOCALAPPDATA%\Microsoft\Windows\Fonts')
for f in ('THSarabunNew.ttf', 'THSarabunNew Bold.ttf'):
    if os.path.exists(os.path.join(_fd, f)):
        font_manager.fontManager.addfont(os.path.join(_fd, f))
plt.rcParams.update({'font.family': 'TH Sarabun New', 'font.size': 18, 'axes.spines.top': False, 'axes.spines.right': False})

S = json.load(open(os.path.join(RESULTS_DIR, 'summary.json')))
M = S['models']
TH = {'BLAST': 'โรคไหม้', 'BLB': 'ขอบใบแห้ง', 'TUNGRO': 'ใบสีส้ม', 'HEALTHY': 'ใบปกติ'}
MAIN, OTHER, INK, MUTED = '#1f4d3a', '#9aa9a0', '#1c2620', '#6b7c74'
color = lambda m: MAIN if m['role'] == 'main' else OTHER  # noqa: E731

# 1) ความแม่นยำ vs ขนาด
fig, a = plt.subplots(figsize=(10, 5.6))
for m in M:
    x, y = m['hardware']['tflite_mb'], m['accuracy']['mean'] * 100
    a.errorbar(x, y, yerr=m['accuracy']['sd'] * 100, fmt='o', ms=11, color=color(m), ecolor=color(m), capsize=4, mec='white', mew=2)
    a.annotate(m['name'], (x, y), textcoords='offset points', xytext=(10, -4), fontsize=17, color=INK,
               fontweight='bold' if m['role'] == 'main' else 'normal')
a.set_xscale('log'); a.set_xticks([5, 10, 20, 50], ['5', '10', '20', '50']); a.minorticks_off(); a.set_xlabel('ขนาดไฟล์บนมือถือ TFLite Float16 (MB, สเกล log)'); a.set_ylabel('Accuracy ชุดทดสอบ (%)')
a.set_title('ความแม่นยำเทียบกับขนาดโมเดล (เฉลี่ย 3 seed ± SD)'); a.grid(alpha=.25, which='both')
plt.tight_layout(); plt.savefig(os.path.join(FIG, 'accuracy_vs_size.png'), dpi=200); plt.close()

# 2) Macro F1
fig, a = plt.subplots(figsize=(10, 4.8))
x = np.arange(len(M))
v = [m['macro_f1']['mean'] * 100 for m in M]
b = a.bar(x, v, 0.6, yerr=[m['macro_f1']['sd'] * 100 for m in M], color=[color(m) for m in M], capsize=4, error_kw={'ecolor': MUTED})
for r, val in zip(b, v):
    a.text(r.get_x() + r.get_width() / 2, val + 0.6, f'{val:.2f}', ha='center', fontsize=16, color=INK)
lo = max(0, min(v) - 6)
a.set_ylim(lo, 101); a.set_xticks(x, [m['name'] for m in M], fontsize=16); a.set_ylabel('Macro F1 (%)')
a.set_title('Macro F1 บนชุดทดสอบ 761 ภาพ (เฉลี่ย 3 seed ± SD)'); a.grid(axis='y', alpha=.25)
plt.tight_layout(); plt.savefig(os.path.join(FIG, 'macro_f1.png'), dpi=200); plt.close()

# 3) F1 รายโรค (heatmap)
cls = S['classes']
grid = np.array([[m['per_class_f1'][c]['mean'] * 100 for c in cls] for m in M])
fig, a = plt.subplots(figsize=(9, 0.7 * len(M) + 1.8))
a.imshow(grid, cmap='Greens', vmin=grid.min() - 5, vmax=100, aspect='auto')
a.set_xticks(range(4), [f'{TH[c]}\n{c}' for c in cls], fontsize=16); a.set_yticks(range(len(M)), [m['name'] for m in M], fontsize=16)
for i in range(len(M)):
    for j in range(4):
        a.text(j, i, f'{grid[i, j]:.1f}', ha='center', va='center', fontsize=17, color='white' if grid[i, j] > grid.max() - 3 else INK)
a.set_title('F1 รายโรค (%) เฉลี่ย 3 seed'); a.spines[:].set_visible(False)
plt.tight_layout(); plt.savefig(os.path.join(FIG, 'per_class_f1.png'), dpi=200); plt.close()

# 4) confusion matrices
cols = 3
rows = int(np.ceil(len(M) / cols))
fig, ax = plt.subplots(rows, cols, figsize=(5.2 * cols, 4.8 * rows))
for a, m in zip(ax.flat, M):
    cm = np.array(m['runs'][0]['confusion_matrix'])
    a.imshow(cm, cmap='Greens')
    a.set_xticks(range(4), cls, fontsize=14); a.set_yticks(range(4), cls, fontsize=14)
    for i in range(4):
        for j in range(4):
            a.text(j, i, cm[i, j], ha='center', va='center', fontsize=17, color='white' if cm[i, j] > cm.max() * .55 else INK)
    a.set_title(f"{m['name']} · {m['runs'][0]['accuracy'] * 100:.2f}%", fontsize=18)
    a.set_xlabel('ทำนาย', fontsize=15); a.set_ylabel('จริง', fontsize=15)
for a in list(ax.flat)[len(M):]:
    a.axis('off')
plt.tight_layout(); plt.savefig(os.path.join(FIG, 'confusion_matrices.png'), dpi=200); plt.close()

# 5) เส้นการเทรน
fig, a = plt.subplots(figsize=(11, 5))
for m in M:
    h = m['history_seed42']['val_accuracy']
    a.plot(np.arange(1, len(h) + 1), np.array(h) * 100, lw=2.6 if m['role'] == 'main' else 1.6,
           color=MAIN if m['role'] == 'main' else None, label=m['name'])
a.axvline(RECIPE_HEAD := S['recipe']['head']['epochs'] + 0.5, color=MUTED, ls='--', lw=1.2)
a.text(RECIPE_HEAD + 0.3, a.get_ylim()[0] + 2, 'เริ่ม Fine-tuning (โดยประมาณ)', color=MUTED, fontsize=15)
a.set_xlabel('รอบการฝึกสอน (Epoch)'); a.set_ylabel('Validation accuracy (%)'); a.grid(alpha=.25)
a.legend(frameon=False, fontsize=15, ncol=2); a.set_title('ความแม่นยำบนชุดตรวจสอบระหว่างเทรน (seed 42)')
plt.tight_layout(); plt.savefig(os.path.join(FIG, 'training_curves.png'), dpi=200); plt.close()
print('figures in', FIG)
