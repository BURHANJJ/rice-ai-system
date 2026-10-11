"""ส่งภาพชุดทดสอบ 200 ภาพไปที่ AI service ทีละภาพ แล้วจับเวลาว่าตอบกลับเร็วแค่ไหน

ต้องเปิด AI service ไว้ก่อน (python main.py ในโฟลเดอร์ ai-service)
ใช้ 127.0.0.1 แทน localhost เพราะบน Windows คำว่า localhost ทำให้ช้าไปราว 2 วินาทีต่อครั้ง
"""
import json, os, random, time, urllib.request
import numpy as np

ROOT = os.environ.get('RICE_EVAL_DIR', 'D:/rice-eval')  # ที่เก็บภาพ (rice4/) และผลการเทรน (run/)
split = json.load(open(os.path.join(ROOT, 'run', 'split.json')))
files = split['test_files']
random.Random(7).shuffle(files)  # สุ่มแบบคงที่ รันกี่ครั้งก็ได้ภาพชุดเดิม
files = files[:200]
lat, ok, n, rejected = [], 0, 0, 0
for f in files:
    data = open(os.path.join(ROOT, 'rice4', f), 'rb').read()
    req = urllib.request.Request('http://127.0.0.1:8000/predict', data=data, method='POST', headers={'Content-Type': 'application/octet-stream'})
    t = time.perf_counter()
    try:
        body = json.loads(urllib.request.urlopen(req, timeout=30).read())
    except urllib.error.HTTPError as e:
        body = {'error': e.code}
    lat.append((time.perf_counter() - t) * 1000)
    true = os.path.normpath(f).split(os.sep)[0]
    code = body.get('class_code') or body.get('disease_code')
    # ไม่มีคลาสส่งกลับ = เซิร์ฟเวอร์ปฏิเสธเพราะความมั่นใจต่ำกว่า 75%
    if code is None:
        rejected += 1
    n += 1
    ok += code == true
res = {'n': n, 'accuracy_http': ok / n, 'rejected_low_confidence': rejected,
       'latency_ms': {'mean': float(np.mean(lat)), 'p50': float(np.median(lat)), 'p95': float(np.percentile(lat, 95)), 'max': float(np.max(lat))},
       'sample_response': body}
json.dump(res, open(os.path.join(ROOT, 'run', 'bench_http.json'), 'w'), indent=2, ensure_ascii=False)
print(json.dumps(res, ensure_ascii=False, indent=1))
