"""เทรนโมเดลรุ่นที่ 3: EfficientNet-B0 5 คลาส [BLAST, BLB, TUNGRO, HEALTHY, OTHER]

OTHER คือภาพโรคหรืออาการอื่นของใบข้าวที่ระบบยังไม่รองรับ (6 ชนิดจาก Paddy Doctor)
รุ่นที่ 2 ไม่มีคลาสนี้ เวลาเจอโรคอื่นจะตอบเป็นหนึ่งใน 4 โรค โดยประมาณครึ่งหนึ่งผ่านเกณฑ์ความมั่นใจ 75%

สูตรการเทรนเหมือนรุ่นที่ 2 และการเปรียบเทียบ 6 โมเดลทุกอย่าง เปลี่ยนแค่จำนวนคลาส เทรน 3 seed
ผลเก็บที่ RICE_EVAL_DIR/v3/seed-<seed>/ แล้วเลือกตัวที่ดีที่สุดด้วยชุด validation ใน build_v3.py

รันบน GPU:  set KERAS_BACKEND=torch
            D:/rice-eval/venv-gpu/Scripts/python train_v3.py
"""
import json, os, subprocess, sys

os.environ.setdefault('KERAS_BACKEND', 'torch')
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'model-comparison'))

import numpy as np  # noqa: E402
import common  # noqa: E402

CLASSES5 = ['BLAST', 'BLB', 'TUNGRO', 'HEALTHY', 'OTHER']
common.CLASSES = CLASSES5  # build_model และ Batches ใช้จำนวนคลาสจากตรงนี้
import train as cmp_train  # noqa: E402

cmp_train.CLASSES = CLASSES5
OUT = os.path.join(common.ROOT, 'v3')
cmp_train.run_dir = lambda key, seed: os.path.join(OUT, f'seed-{seed}')

if __name__ == '__main__':
    if len(sys.argv) > 1:
        seed = int(sys.argv[1])
        cmp_train.train('efficientnet_b0', seed, dict(np.load(os.path.join(OUT, 'data5.npz'))))
        info = os.path.join(OUT, f'seed-{seed}', 'train_info.json')
        d = json.load(open(info)); d['classes'] = CLASSES5; json.dump(d, open(info, 'w'), indent=2)
    else:
        # แยก process ทีละ seed หน่วยความจำ GPU คืนครบทุกครั้ง
        for s in common.SEEDS:
            if not os.path.exists(os.path.join(OUT, f'seed-{s}', 'train_info.json')):
                subprocess.run([sys.executable, __file__, str(s)], check=True)
