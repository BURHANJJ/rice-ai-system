"""เตรียมข้อมูล 5 คลาสสำหรับโมเดลรุ่นที่ 3: 4 คลาสเดิม + OTHER (โรค/อาการอื่นที่ระบบยังไม่รองรับ)

- 4 คลาสเดิมใช้การแบ่งชุดเดิมทุกภาพ (model-comparison/prepare_data.py, ชุดทดสอบ 761 ภาพเดิม) ผลจึงเทียบกับ V2 ได้ตรง ๆ
- OTHER มาจากอีก 6 คลาสของ Paddy Doctor ที่อยู่ในไฟล์ zip เดียวกัน: bacterial_leaf_streak, bacterial_panicle_blight,
  brown_spot, dead_heart, downy_mildew, hispa แบ่ง 70/15/15 แบบ stratified ตามชนิดโรค (seed 42)
- ย่อภาพเป็น 224x224 แบบเดียวกับที่ระบบใช้ แล้วเก็บเป็น RICE_EVAL_DIR/v3/data5.npz

รันด้วย Python ที่มี TensorFlow:  python prepare_v3_data.py
"""
import io, os, sys, zipfile

import numpy as np
import tensorflow as tf
from sklearn.model_selection import train_test_split

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'model-comparison'))
from common import DATA_CACHE, IMG, ROOT, SPLIT_SEED  # noqa: E402

OTHER_SOURCES = ['bacterial_leaf_streak', 'bacterial_panicle_blight', 'brown_spot', 'dead_heart', 'downy_mildew', 'hispa']
OUT = os.path.join(ROOT, 'v3', 'data5.npz')

z = zipfile.ZipFile(os.path.join(ROOT, 'paddy-disease-classification.zip'))
names = sorted(n for n in z.namelist() if n.startswith('train_images/') and n.endswith('.jpg') and n.split('/')[1] in OTHER_SOURCES)
sub = np.array([OTHER_SOURCES.index(n.split('/')[1]) for n in names])
idx = np.arange(len(names))
i_tr, i_rest = train_test_split(idx, test_size=0.30, stratify=sub, random_state=SPLIT_SEED)
i_va, i_te = train_test_split(i_rest, test_size=0.50, stratify=sub[i_rest], random_state=SPLIT_SEED)
print('OTHER images', len(names), {s: int((sub == i).sum()) for i, s in enumerate(OTHER_SOURCES)}, flush=True)


def load(ix):
    out = np.empty((len(ix), IMG, IMG, 3), dtype=np.uint8)
    for k, i in enumerate(ix):
        img = tf.io.decode_jpeg(z.read(names[i]), channels=3)
        out[k] = np.clip(np.round(tf.image.resize(img, (IMG, IMG)).numpy()), 0, 255)
    return out


base = np.load(DATA_CACHE)
parts = {}
for split, ix in (('train', i_tr), ('val', i_va), ('test', i_te)):
    xo = load(ix)
    parts[f'x_{split}'] = np.concatenate([base[f'x_{split}'], xo])
    parts[f'y_{split}'] = np.concatenate([base[f'y_{split}'], np.full(len(ix), 4)])
    parts[f'sub_{split}'] = np.concatenate([np.full(len(base[f'y_{split}']), -1), sub[ix]])  # ชนิดโรคย่อยของ OTHER (-1 = 4 คลาสเดิม)
    print(split, np.bincount(parts[f'y_{split}']), flush=True)
os.makedirs(os.path.dirname(OUT), exist_ok=True)
np.savez(OUT, **parts, other_sources=np.array(OTHER_SOURCES), other_test_files=np.array([names[i] for i in i_te]))
print('saved', OUT)
