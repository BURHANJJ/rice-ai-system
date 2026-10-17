"""แปลงโมเดลที่ใช้งาน (ai-service/model/rice_disease_model.keras) เป็น ONNX สำหรับเว็บ

เว็บรันโมเดลในเบราว์เซอร์ด้วย onnxruntime-web (หน้า /try-scan และหน้าสแกนในพอร์ทัล)
- ตัดชั้น data augmentation และ dropout ออก (ทำงานเฉพาะตอนเทรน ตอนทำนายไม่มีผล)
- เก็บน้ำหนักแบบ fp16 ให้ไฟล์เล็กลงครึ่งหนึ่ง แล้ว Cast กลับเป็น fp32 ตอนโหลด คำนวณแบบ fp32 เท่าเดิม
- เทียบคำตอบกับโมเดลต้นฉบับบนภาพชุดทดสอบทั้งหมด + ภาพโรคอื่น และนับภาพที่ข้ามเกณฑ์ 60%

รัน:  KERAS_BACKEND=torch python export_onnx.py
ต้องมี: keras, torch, onnx, onnxscript, onnxruntime, pillow และภาพใน RICE_EVAL_DIR (ดู README.md)
"""
import json, os
os.environ.setdefault('KERAS_BACKEND', 'torch')
import numpy as np
import keras
import onnx
import onnxruntime as ort
from onnx import helper, numpy_helper, TensorProto
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..'))
SRC = os.path.join(REPO, 'ai-service', 'model', 'rice_disease_model.keras')
DST = os.path.join(REPO, 'web', 'public', 'models', 'rice-v3.onnx')
ROOT = os.environ.get('RICE_EVAL_DIR', 'D:/rice-eval')
TMP = os.path.join(ROOT, 'webmodel', 'rice-v3.fp32.onnx')
THRESHOLD = 0.60

# 1. inference path only: image -> EfficientNetB0 (pooled) -> Dense softmax, same weights
full = keras.saving.load_model(SRC, compile=False)
inp = keras.Input((224, 224, 3), name='image')
model = keras.Model(inp, full.get_layer('predictions')(full.get_layer('efficientnetb0')(inp, training=False)))
os.makedirs(os.path.dirname(TMP), exist_ok=True)
model.export(TMP, format='onnx', input_signature=[keras.InputSpec(shape=(None, 224, 224, 3), dtype='float32')])

# 2. fp16 storage, fp32 compute
m = onnx.load(TMP)
g = m.graph
casts, keep = [], []
for init in g.initializer:
    arr = numpy_helper.to_array(init)
    if arr.dtype == np.float32 and arr.size > 16:
        half = numpy_helper.from_array(arr.astype(np.float16), init.name + '__f16')
        keep.append(half)
        casts.append(helper.make_node('Cast', [half.name], [init.name], to=TensorProto.FLOAT, name=init.name + '__cast'))
    else:
        keep.append(init)
del g.initializer[:]
g.initializer.extend(keep)
nodes = casts + list(g.node)
del g.node[:]
g.node.extend(nodes)
onnx.checker.check_model(m)
os.makedirs(os.path.dirname(DST), exist_ok=True)
onnx.save(m, DST)
print('saved', DST, round(os.path.getsize(DST) / 1e6, 2), 'MB')

# 3. same answers as the original model?
split = json.load(open(os.path.join(ROOT, 'run', 'split.json')))
files = [os.path.join(ROOT, 'rice4', f) for f in split['test_files']]
other = os.path.join(ROOT, 'other6')
if os.path.isdir(other):
    for d in sorted(os.listdir(other)):
        files += [os.path.join(other, d, f) for f in sorted(os.listdir(os.path.join(other, d)))[:25]]
x = np.stack([np.asarray(Image.open(p).convert('RGB').resize((224, 224), Image.BILINEAR), dtype=np.float32) for p in files])
ref = np.asarray(full.predict(x, batch_size=32, verbose=0))
s = ort.InferenceSession(DST, providers=['CPUExecutionProvider'])
name = s.get_inputs()[0].name
got = np.concatenate([s.run(None, {name: x[i:i + 32]})[0] for i in range(0, len(x), 32)])
same = (got.argmax(1) == ref.argmax(1)).mean()
flips = int(((got.max(1) >= THRESHOLD) != (ref.max(1) >= THRESHOLD)).sum())
print(f'images {len(x)} | same top-1 {same:.4f} | max |diff| {np.abs(got - ref).max():.5f} | flips across {THRESHOLD:.0%}: {flips}')
assert same == 1.0 and flips == 0, 'the web model does not match the original; do not ship it'
