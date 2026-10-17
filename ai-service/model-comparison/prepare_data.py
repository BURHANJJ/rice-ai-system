"""แบ่งภาพแบบเดียวกับรุ่นที่ใช้งานทุกประการ ย่อเป็น 224x224 ครั้งเดียว แล้วเก็บเป็นไฟล์ .npz ให้ทุกโมเดลใช้ร่วมกัน

ใช้วิธีแบ่ง (stratified 70/15/15, seed 42) และวิธีย่อภาพ (tf.image.resize แบบบีบ ไม่ครอป) เดียวกับ training/train.py
แล้วตรวจว่ารายชื่อภาพชุดทดสอบตรงกับ run/split.json ของรุ่นที่ใช้งาน ถ้าไม่ตรงจะหยุดทันที

รันด้วย Python ที่มี TensorFlow:  python prepare_data.py
"""
import json, os

import numpy as np
import tensorflow as tf
from sklearn.model_selection import train_test_split

from common import CLASSES, DATA_CACHE, IMG, ROOT, SPLIT_SEED

DATA = os.path.join(ROOT, 'rice4')
paths, labels = [], []
for i, c in enumerate(CLASSES):
    for f in sorted(os.listdir(os.path.join(DATA, c))):
        paths.append(os.path.join(DATA, c, f)); labels.append(i)
paths, labels = np.array(paths), np.array(labels)
p_train, p_rest, y_train, y_rest = train_test_split(paths, labels, test_size=0.30, stratify=labels, random_state=SPLIT_SEED)
p_val, p_test, y_val, y_test = train_test_split(p_rest, y_rest, test_size=0.50, stratify=y_rest, random_state=SPLIT_SEED)

test_rel = [os.path.relpath(p, DATA) for p in p_test]
deployed = json.load(open(os.path.join(ROOT, 'run', 'split.json')))['test_files']
assert test_rel == deployed, 'ชุดทดสอบไม่ตรงกับรุ่นที่ใช้งาน'


def load(ps):
    out = np.empty((len(ps), IMG, IMG, 3), dtype=np.uint8)
    for i, p in enumerate(ps):
        img = tf.io.decode_jpeg(tf.io.read_file(p), channels=3)
        out[i] = np.clip(np.round(tf.image.resize(img, (IMG, IMG)).numpy()), 0, 255)
    return out


os.makedirs(os.path.dirname(DATA_CACHE), exist_ok=True)
np.savez(DATA_CACHE,
         x_train=load(p_train), y_train=y_train, x_val=load(p_val), y_val=y_val, x_test=load(p_test), y_test=y_test,
         test_files=np.array(test_rel))
print('saved', DATA_CACHE, {k: len(v) for k, v in (('train', y_train), ('val', y_val), ('test', y_test))})
