"""เขียน README.md ของแต่ละโฟลเดอร์โมเดลใน models/ จาก results/summary.json (รันหลัง evaluate.py)"""
import json, os

from common import MODELS, MODELS_DIR, RECIPE, RESULTS_DIR, SEEDS

ABOUT = {
    'efficientnet_b0': (
        'โมเดลหลักของ Rice AI ขยายความกว้าง ความลึก และขนาดภาพของเครือข่ายพร้อมกันอย่างสมดุล (compound scaling) '
        'ใช้บล็อก MBConv กับ Squeeze-and-Excitation จึงได้ความแม่นสูงโดยใช้พารามิเตอร์น้อย',
        'เป็นสถาปัตยกรรมเดียวกับโมเดลที่ระบบใช้งานจริง (V2) เทรนซ้ำที่นี่ด้วยสภาพแวดล้อมเดียวกับโมเดลอื่น เพื่อให้เทียบกันได้ตรง ๆ'),
    'mobilenet_v3_large': (
        'ออกแบบมาเพื่อมือถือโดยเฉพาะ ใช้ depthwise separable convolution, Squeeze-and-Excitation และ hard-swish '
        'โครงสร้างหาด้วย Neural Architecture Search ให้เร็วบน CPU ของมือถือ',
        'เป็นคู่แข่งโดยตรงของงานที่ต้องรันบนเครื่องผู้ใช้ ใช้ตอบว่าถ้าอยากได้โมเดลที่เล็กและเร็วกว่านี้ ต้องเสียความแม่นเท่าไร'),
    'densenet121': (
        'ทุกชั้นในบล็อกรับข้อมูลจากทุกชั้นก่อนหน้า (dense connection) ทำให้ใช้ลักษณะเด่นซ้ำได้มากและพารามิเตอร์ไม่สูง',
        'นิยมใช้ในงานจำแนกโรคพืชและภาพทางการแพทย์ เป็นตัวแทนของ CNN ขนาดกลาง'),
    'vgg16': (
        'CNN รุ่นแรก ๆ ที่ซ้อน convolution 3x3 ลึก 16 ชั้น ไม่มี BatchNorm และไม่มี residual',
        'เป็น baseline แบบดั้งเดิมที่งานวิจัยส่วนใหญ่ใช้อ้างอิง แสดงว่าสถาปัตยกรรมใหม่ดีกว่าแบบเก่าแค่ไหน'),
    'resnet50': (
        'ใช้ residual connection (ทางลัดข้ามชั้น) ทำให้เทรนเครือข่ายลึก 50 ชั้นได้โดยไม่เสื่อม',
        'เป็น baseline มาตรฐานที่สุดของงานจำแนกภาพ เกือบทุกงานวิจัยใช้เทียบ'),
    'convnext_tiny': (
        'CNN ที่ออกแบบใหม่โดยยืมแนวคิดจาก Vision Transformer เช่น kernel 7x7, LayerNorm และ GELU '
        'ให้ผลใกล้เคียง Transformer แต่ยังเป็น convolution',
        'เป็นตัวแทนของโมเดลสมัยใหม่ (2022) ใช้ตอบว่าโมเดลใหม่และใหญ่กว่าช่วยให้แม่นขึ้นจริงหรือไม่'),
}
PRE = {None: 'อยู่ในตัวโมเดลแล้ว (รับค่า 0-255)', 'caffe': 'สลับ RGB เป็น BGR แล้วลบค่าเฉลี่ย ImageNet (ชั้น ImageNetPreprocess)',
       'torch': 'หาร 255 แล้วปรับด้วยค่าเฉลี่ยและ SD ของ ImageNet (ชั้น ImageNetPreprocess)'}

S = json.load(open(os.path.join(RESULTS_DIR, 'summary.json'), encoding='utf-8'))
pct = lambda v: f"{v['mean'] * 100:.2f} ± {v['sd'] * 100:.2f}%"  # noqa: E731

for m in S['models']:
    spec, h = MODELS[m['key']], m['hardware']
    what, why = ABOUT[m['key']]
    lr = spec.get('finetune_lr', RECIPE['finetune']['lr'])
    rows = '\n'.join(
        f"| {r['seed']} | {r['accuracy'] * 100:.2f}% ({r['correct']}/761) | {r['macro_f1'] * 100:.2f}% | {r['auc']:.4f} | "
        f"{r['epochs']['head']} + {r['epochs']['finetune']} | {r['train_seconds'] / 60:.1f} นาที |" for r in m['runs'])
    mc = ''
    if m['mcnemar_vs_main']:
        mc = '\n## เทียบกับ EfficientNet-B0 (McNemar)\n\n| seed | B0 ถูก / ตัวนี้ผิด | ตัวนี้ถูก / B0 ผิด | p-value |\n|---|---|---|---|\n' + '\n'.join(
            f"| {x['seed']} | {x['a_only']} | {x['b_only']} | {x['p']:.4f} |" for x in m['mcnemar_vs_main']) + \
            '\n\np < 0.05 แปลว่าสองโมเดลทายผิดต่างกันอย่างมีนัยสำคัญทางสถิติ\n'
    note = ''
    if 'finetune_lr' in spec:
        note = ('\n> **ข้อยกเว้นของสูตร:** ช่วง fine-tune ใช้ learning rate 0.00001 แทน 0.0001 เพราะที่ 0.0001 โมเดลพัง '
                '(val accuracy ตกจาก 60% เหลือ 35% และ loss ค้างที่ 1.386 = ทายทุกคลาสเท่ากัน) บันทึกการทดลองนั้นอยู่ใน `lr-1e-4-diverged/`\n')
    text = f"""# {m['name']}

**{spec['paper']}** · {spec['family']} · {'โมเดลหลักของระบบ' if spec['role'] == 'main' else 'โมเดลเปรียบเทียบ'}

{what}

**ทำไมถึงเลือกมาเทียบ:** {why}
{note}
## ข้อมูลโมเดล

| | |
|---|---|
| พารามิเตอร์ | {h['params'] / 1e6:.2f} ล้าน |
| FLOPs ต่อภาพ | {(h['flops'] or 0) / 1e9:.2f} GFLOPs |
| ไฟล์ Keras | {h['keras_mb']:.1f} MB |
| ไฟล์ TFLite Float16 (แบบที่แอปมือถือใช้) | {h.get('tflite_mb', 0):.1f} MB · ทายตรงกับ Keras {h.get('tflite_agreement', 0) * 100:.2f}% ของภาพ |
| เวลาต่อภาพ TFLite บน CPU (4 threads, ค่ามัธยฐาน) | {h.get('tflite_ms', {}).get('median', 0):.1f} ms |
| เวลาต่อภาพ Keras บน CPU | {h['cpu_keras_ms']['median']:.1f} ms |
| การปรับค่าพิกเซล | {PRE[spec['preprocess']]} |
| learning rate ช่วง fine-tune | {lr:g} |

## ผลบนชุดทดสอบ 761 ภาพ

เฉลี่ย {len(m['runs'])} seed: **Accuracy {pct(m['accuracy'])}** · Macro F1 {pct(m['macro_f1'])} · AUC {m['auc']['mean']:.4f}

| seed | Accuracy | Macro F1 | AUC | epoch จริง (ช่วง 1 + 2) | เวลาเทรน (GPU) |
|---|---|---|---|---|---|
{rows}
{mc}
## ไฟล์ในโฟลเดอร์

แต่ละ `seed-*/` มี

| ไฟล์ | คืออะไร |
|---|---|
| `model.keras` | โมเดลที่เทรนแล้ว (ไม่อยู่ใน git เพราะไฟล์ใหญ่ สร้างใหม่ด้วย `train.py`) |
| `model.tflite` | แปลงเป็น TFLite Float16 (เฉพาะ seed {SEEDS[0]}, ไม่อยู่ใน git) |
| `metrics.json` | ผลวัดทั้งหมด รวม confusion matrix และผลรายคลาส |
| `test_probs.npy` | ความน่าจะเป็นที่ทายภาพทดสอบทั้ง 761 ภาพ ใช้คำนวณสถิติซ้ำได้ |
| `history.json`, `log_*.csv` | ความแม่นยำและ loss ทุกรอบการเทรน |
| `train_info.json` | เวลาที่ใช้ อุปกรณ์ เวอร์ชันไลบรารี และสูตรที่ใช้จริง |
"""
    open(os.path.join(MODELS_DIR, spec['folder'], 'README.md'), 'w', encoding='utf-8').write(text)

# ---------- results/RESULTS.md: ตารางรวมสำหรับอ่านเร็วและแนบรายงาน ----------
ranked = sorted(S['models'], key=lambda m: -m['accuracy']['mean'])
main = next(m for m in S['models'] if m['role'] == 'main')
rows = '\n'.join(
    f"| {i + 1} | {'**' + m['name'] + '**' if m['role'] == 'main' else m['name']} | {pct(m['accuracy'])} | {pct(m['macro_f1'])} | {m['auc']['mean']:.4f} | "
    f"{m['hardware']['params'] / 1e6:.1f}M | {(m['hardware']['flops'] or 0) / 1e9:.2f} | {m['hardware'].get('tflite_mb', 0):.1f} MB | "
    f"{m['hardware'].get('tflite_ms', {}).get('median', 0):.1f} ms | {m['train_minutes']['mean']:.1f} นาที |" for i, m in enumerate(ranked))
cls = S['classes']
f1rows = '\n'.join(f"| {m['name']} | " + ' | '.join(f"{m['per_class_f1'][c]['mean'] * 100:.2f}" for c in cls) + ' |' for m in ranked)
mrows = '\n'.join(
    f"| {m['name']} | " + ' · '.join(str(x['a_only']) for x in m['mcnemar_vs_main']) + ' | ' + ' · '.join(str(x['b_only']) for x in m['mcnemar_vs_main'])
    + ' | ' + ' · '.join(('<0.001' if x['p'] < 0.001 else f"{x['p']:.3f}") for x in m['mcnemar_vs_main']) + ' |'
    for m in ranked if m['mcnemar_vs_main'])
dep = S['deployed_v2']
results = f"""# ผลเปรียบเทียบโมเดล

วัดบนภาพทดสอบ {S['test_size']} ภาพชุดเดียวกับโมเดลที่ใช้งานจริง · ค่าเฉลี่ย ± SD จาก {len(S['seeds'])} seed ({', '.join(map(str, S['seeds']))}) · วัดผลเมื่อ {S['evaluated']}

## ตารางรวม (เรียงตาม Accuracy)

| # | โมเดล | Accuracy | Macro F1 | AUC | พารามิเตอร์ | GFLOPs | ไฟล์ TFLite | เวลา/ภาพ (CPU) | เวลาเทรน (GPU) |
|---|---|---|---|---|---|---|---|---|---|
{rows}

เวลาต่อภาพวัดจาก TFLite Float16 บน CPU Intel Core i5-12450H 4 threads (ค่ามัธยฐาน) · GFLOPs นับการคูณและบวกแยกกัน

โมเดลที่ใช้งานจริง (EfficientNet-B0 V2 เทรนบน CPU) ได้ Accuracy {dep['accuracy'] * 100:.2f}% Macro F1 {dep['macro']['f1'] * 100:.2f}% บนชุดทดสอบเดียวกัน
ส่วน EfficientNet-B0 ในตารางคือการเทรนซ้ำบน GPU ภายใต้เงื่อนไขเดียวกับโมเดลอื่น

## F1 รายโรค (%) เฉลี่ย {len(S['seeds'])} seed

| โมเดล | {' | '.join(cls)} |
|---|{'---|' * len(cls)}
{f1rows}

## McNemar test: {main['name']} เทียบกับแต่ละโมเดล

แต่ละช่องเรียงตาม seed {', '.join(map(str, S['seeds']))} · p < 0.05 = ต่างกันอย่างมีนัยสำคัญ

| โมเดล | B0 ถูก / ตัวนั้นผิด | ตัวนั้นถูก / B0 ผิด | p-value |
|---|---|---|---|
{mrows}

## กราฟ

![ความแม่นยำเทียบกับขนาด](figures/accuracy_vs_size.png)
![Macro F1](figures/macro_f1.png)
![F1 รายโรค](figures/per_class_f1.png)
![Confusion matrices](figures/confusion_matrices.png)
![Training curves](figures/training_curves.png)
"""
open(os.path.join(RESULTS_DIR, 'RESULTS.md'), 'w', encoding='utf-8').write(results)
print('readmes and RESULTS.md written')
