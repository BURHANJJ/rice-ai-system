"""วัดผลทุกโมเดลที่เทรนเสร็จ ด้วยภาพชุดทดสอบ 761 ภาพชุดเดียวกับรุ่นที่ใช้งาน แล้วสรุปเป็นตารางและกราฟ

รันด้วย Python ที่มี TensorFlow (ไม่ใช่ venv GPU) หลังเทรนเสร็จทั้งหมด และไม่ควรมีงานหนักอื่นรันอยู่ เพราะจับเวลาบน CPU:
    python evaluate.py

ทำอะไรบ้าง
1. เปิด model.keras ด้วย TensorFlow แล้วทายภาพชุดทดสอบใหม่ ตรวจว่าตรงกับผลตอนเทรน (บน PyTorch)
2. คำนวณ Accuracy, Precision, Recall, F1 รายคลาส, Macro F1, AUC และ confusion matrix ของทุก seed
3. นับพารามิเตอร์และ FLOPs, แปลงเป็น TFLite (Float16) แบบที่แอปมือถือใช้ วัดขนาดไฟล์ ความแม่น และเวลาต่อภาพบน CPU
4. ทดสอบ McNemar ว่า EfficientNet-B0 ต่างจากโมเดลอื่นอย่างมีนัยสำคัญหรือไม่
5. เขียน results/summary.json, results/summary.csv, results/runs.csv และกราฟใน results/figures/
"""
import csv, json, math, os, time

os.environ.setdefault('KERAS_BACKEND', 'tensorflow')

import numpy as np
import tensorflow as tf
import keras
from sklearn.metrics import accuracy_score, confusion_matrix, precision_recall_fscore_support, roc_auc_score

from common import CLASSES, DATA_CACHE, HERE, MODELS, RECIPE, RESULTS_DIR, SEEDS, run_dir

FIG = os.path.join(RESULTS_DIR, 'figures')
os.makedirs(FIG, exist_ok=True)
data = np.load(DATA_CACHE)
X, Y = data['x_test'].astype('float32'), data['y_test']


def metrics(prob):
    pred = prob.argmax(1)
    p, r, f, s = precision_recall_fscore_support(Y, pred, labels=range(4), zero_division=0)
    mp, mr, mf, _ = precision_recall_fscore_support(Y, pred, average='macro', zero_division=0)
    return {
        'accuracy': float(accuracy_score(Y, pred)), 'correct': int((pred == Y).sum()),
        'macro_precision': float(mp), 'macro_recall': float(mr), 'macro_f1': float(mf),
        'auc': float(roc_auc_score(np.eye(4)[Y], prob, average='macro', multi_class='ovr')),
        'per_class': {CLASSES[i]: {'precision': float(p[i]), 'recall': float(r[i]), 'f1': float(f[i]), 'support': int(s[i])} for i in range(4)},
        'confusion_matrix': confusion_matrix(Y, pred, labels=range(4)).tolist(),
    }


def flops(model):
    """จำนวน FLOPs ต่อภาพ (นับคูณและบวกแยกกัน) จากกราฟของ TensorFlow"""
    from tensorflow.python.framework.convert_to_constants import convert_variables_to_constants_v2
    try:
        fn = tf.function(lambda x: model(x, training=False)).get_concrete_function(tf.TensorSpec([1, 224, 224, 3], tf.float32))
        g = convert_variables_to_constants_v2(fn).graph
        opts = tf.compat.v1.profiler.ProfileOptionBuilder.float_operation()
        opts['output'] = 'none'
        return int(tf.compat.v1.profiler.profile(graph=g, run_meta=tf.compat.v1.RunMetadata(), cmd='op', options=opts).total_float_ops)
    except Exception as e:  # noqa: BLE001
        print('flops failed', e)
        return None


def timed(fn, n=100, warm=10):
    for _ in range(warm):
        fn()
    t = []
    for _ in range(n):
        s = time.perf_counter(); fn(); t.append((time.perf_counter() - s) * 1000)
    return {'median': float(np.median(t)), 'p95': float(np.percentile(t, 95))}


def tflite(model, path):
    conv = tf.lite.TFLiteConverter.from_keras_model(model)
    conv.optimizations = [tf.lite.Optimize.DEFAULT]
    conv.target_spec.supported_types = [tf.float16]
    open(path, 'wb').write(conv.convert())
    it = tf.lite.Interpreter(model_path=path, num_threads=4)
    it.allocate_tensors()
    i, o = it.get_input_details()[0]['index'], it.get_output_details()[0]['index']
    probs = []
    for x in X:
        it.set_tensor(i, x[None]); it.invoke(); probs.append(it.get_tensor(o)[0].copy())
    it.set_tensor(i, X[:1])
    return np.array(probs), os.path.getsize(path) / 1e6, timed(it.invoke)


def mcnemar(a_ok, b_ok):
    """McNemar แบบ exact: นับภาพที่โมเดลหนึ่งถูกแต่อีกโมเดลผิด แล้วทดสอบทวินามสองทาง"""
    b, c = int((a_ok & ~b_ok).sum()), int((~a_ok & b_ok).sum())
    n = b + c
    if n == 0:
        return {'a_only': b, 'b_only': c, 'p': 1.0}
    k = min(b, c)
    p = min(1.0, 2 * sum(math.comb(n, i) for i in range(k + 1)) / 2 ** n)
    return {'a_only': b, 'b_only': c, 'p': p}


def mean_sd(v):
    v = [x for x in v if x is not None]
    return {'mean': float(np.mean(v)), 'sd': float(np.std(v, ddof=1)) if len(v) > 1 else 0.0, 'n': len(v)}


summary = {'classes': CLASSES, 'test_size': int(len(Y)), 'seeds': list(SEEDS), 'recipe': RECIPE, 'models': [],
           'deployed_v2': json.load(open(os.path.join(HERE, '..', 'model', 'metrics.json')))['test'],
           'evaluated': time.strftime('%Y-%m-%d'), 'tensorflow': tf.__version__}
runs_rows, correct = [], {}

for key, spec in MODELS.items():
    runs = []
    for seed in SEEDS:
        d = run_dir(key, seed)
        if not os.path.exists(os.path.join(d, 'train_info.json')):
            continue
        info = json.load(open(os.path.join(d, 'train_info.json')))
        model = keras.models.load_model(os.path.join(d, 'model.keras'), compile=False)
        prob = model.predict(X, batch_size=32, verbose=0)
        agree = float((prob.argmax(1) == np.load(os.path.join(d, 'test_probs.npy')).argmax(1)).mean())
        m = metrics(prob)
        m.update(seed=seed, train_seconds=info['train_seconds'], epochs={k: v['epochs_run'] for k, v in info['timing'].items()},
                 best_val_accuracy=info['best_val_accuracy'], backend_agreement=agree)
        json.dump(m, open(os.path.join(d, 'metrics.json'), 'w'), indent=2)
        correct[(key, seed)] = prob.argmax(1) == Y
        if seed == SEEDS[0]:
            # ขนาด ความเร็ว และ TFLite ไม่ขึ้นกับ seed วัดจากตัวแรกตัวเดียว
            hw = {'params': int(model.count_params()), 'flops': flops(model),
                  'keras_mb': os.path.getsize(os.path.join(d, 'model.keras')) / 1e6,
                  'cpu_keras_ms': timed(lambda f=tf.function(lambda x: model(x, training=False)), x=tf.constant(X[:1]): f(x), n=50)}
            try:
                tp, size, lat = tflite(model, os.path.join(d, 'model.tflite'))
                hw.update(tflite_mb=size, tflite_ms=lat, tflite_accuracy=float((tp.argmax(1) == Y).mean()),
                          tflite_agreement=float((tp.argmax(1) == prob.argmax(1)).mean()))
            except Exception as e:  # noqa: BLE001
                print('tflite failed', key, e)
            hist = json.load(open(os.path.join(d, 'history.json')))
        runs.append(m)
        runs_rows.append({'model': spec['name'], 'seed': seed, 'accuracy': m['accuracy'], 'macro_f1': m['macro_f1'], 'auc': m['auc'],
                          'correct': m['correct'], 'train_min': info['train_seconds'] / 60, 'backend_agreement': agree})
        print(spec['name'], seed, f"{m['accuracy']:.4f}", f"agree={agree:.4f}", flush=True)
        keras.backend.clear_session()
    if not runs:
        continue
    summary['models'].append({
        'key': key, 'folder': spec['folder'], 'name': spec['name'], 'role': spec['role'], 'year': spec['year'],
        'paper': spec['paper'], 'family': spec['family'], 'hardware': hw, 'history_seed42': hist,
        'accuracy': mean_sd([r['accuracy'] for r in runs]), 'macro_f1': mean_sd([r['macro_f1'] for r in runs]),
        'auc': mean_sd([r['auc'] for r in runs]), 'train_minutes': mean_sd([r['train_seconds'] / 60 for r in runs]),
        'per_class_f1': {c: mean_sd([r['per_class'][c]['f1'] for r in runs]) for c in CLASSES},
        'runs': [{k: r[k] for k in ('seed', 'accuracy', 'correct', 'macro_f1', 'auc', 'epochs', 'train_seconds', 'confusion_matrix')} for r in runs],
    })

# McNemar: EfficientNet-B0 เทียบกับแต่ละโมเดลใน seed เดียวกัน
for m in summary['models']:
    m['mcnemar_vs_main'] = [] if m['key'] == 'efficientnet_b0' else [
        {'seed': s, **mcnemar(correct[('efficientnet_b0', s)], correct[(m['key'], s)])}
        for s in SEEDS if ('efficientnet_b0', s) in correct and (m['key'], s) in correct]

json.dump(summary, open(os.path.join(RESULTS_DIR, 'summary.json'), 'w'), indent=1)
with open(os.path.join(RESULTS_DIR, 'runs.csv'), 'w', newline='', encoding='utf-8-sig') as f:
    w = csv.DictWriter(f, fieldnames=list(runs_rows[0])); w.writeheader(); w.writerows(runs_rows)
with open(os.path.join(RESULTS_DIR, 'summary.csv'), 'w', newline='', encoding='utf-8-sig') as f:
    w = csv.writer(f)
    w.writerow(['model', 'accuracy_mean', 'accuracy_sd', 'macro_f1_mean', 'macro_f1_sd', 'auc_mean', 'params_M', 'gflops',
                'tflite_mb', 'tflite_ms', 'train_min_gpu'])
    for m in summary['models']:
        h = m['hardware']
        w.writerow([m['name'], m['accuracy']['mean'], m['accuracy']['sd'], m['macro_f1']['mean'], m['macro_f1']['sd'], m['auc']['mean'],
                    h['params'] / 1e6, (h['flops'] or 0) / 1e9, h.get('tflite_mb'), (h.get('tflite_ms') or {}).get('median'),
                    m['train_minutes']['mean']])
print('wrote', os.path.join(RESULTS_DIR, 'summary.json'))
