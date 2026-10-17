"""เทรนโมเดลหนึ่งตัวด้วยสูตรเดียวกับรุ่นที่ใช้งาน แล้วเก็บผลไว้ใน models/<โฟลเดอร์โมเดล>/seed-<seed>/

รันบน GPU ผ่าน Keras 3 + PyTorch (TensorFlow บน Windows ใช้ GPU ไม่ได้):
    set KERAS_BACKEND=torch
    python train.py --model resnet50 --seed 42
    python train.py --all            # ทุกโมเดล ทุก seed (ข้ามตัวที่เทรนเสร็จแล้ว)

ไฟล์ที่ได้ในแต่ละโฟลเดอร์ seed:
    model.keras          โมเดลที่เทรนแล้ว (ไม่เก็บสถานะ optimizer) เปิดได้ทั้ง TensorFlow และ PyTorch
    history.json         ความแม่นยำและ loss ทุกรอบ
    log_head.csv, log_finetune.csv
    test_probs.npy       ความน่าจะเป็นที่โมเดลทายภาพชุดทดสอบ 761 ภาพ (เรียงตาม test_files)
    train_info.json      เวลาที่ใช้ จำนวนรอบจริง อุปกรณ์ และเวอร์ชันไลบรารี
"""
import argparse, json, os, platform, sys, time

os.environ.setdefault('KERAS_BACKEND', 'torch')

import numpy as np
import keras
from keras import layers

from common import CLASSES, DATA_CACHE, MICRO_BATCH, MODELS, RECIPE, SEEDS, build_model, run_dir


class Batches(keras.utils.PyDataset):
    """ส่งภาพทีละชุด 32 ภาพ พร้อมน้ำหนักของแต่ละภาพ (class weight) และสุ่มลำดับใหม่ทุกรอบเมื่อเป็นชุดเทรน"""

    def __init__(self, x, y, weights=None, shuffle=False, seed=0, batch=RECIPE['batch']):
        super().__init__(workers=1, use_multiprocessing=False)
        self.batch = batch
        self.x, self.y, self.w, self.shuffle = x, np.eye(len(CLASSES), dtype='float32')[y], weights, shuffle
        self.rng = np.random.default_rng(seed)
        self.order = self.rng.permutation(len(x)) if shuffle else np.arange(len(x))

    def __len__(self):
        return int(np.ceil(len(self.x) / self.batch))

    def __getitem__(self, i):
        idx = np.sort(self.order[i * self.batch:(i + 1) * self.batch])
        xb, yb = self.x[idx].astype('float32'), self.y[idx]
        if self.w is None:
            return xb, yb
        return xb, yb, self.w[idx]

    def on_epoch_end(self):
        if self.shuffle:
            self.order = self.rng.permutation(len(self.x))


def train(key, seed, data):
    out = run_dir(key, seed)
    if os.path.exists(os.path.join(out, 'train_info.json')):
        print(f'skip {key} seed {seed} (done)', flush=True)
        return
    os.makedirs(out, exist_ok=True)
    keras.utils.set_random_seed(seed)

    y_train = data['y_train']
    counts = np.bincount(y_train, minlength=len(CLASSES))
    # โรคขอบใบแห้งมีภาพน้อยสุด เลยให้น้ำหนักมากขึ้น (สูตรเดียวกับรุ่นที่ใช้งาน)
    class_weight = len(y_train) / (len(CLASSES) * counts)
    micro = MICRO_BATCH.get(key, RECIPE['batch'])
    accum = RECIPE['batch'] // micro  # จำนวนครั้งที่สะสม gradient ก่อนอัปเดต (1 = ไม่สะสม)
    train_ds = Batches(data['x_train'], y_train, class_weight[y_train].astype('float32'), shuffle=True, seed=seed, batch=micro)
    val_ds = Batches(data['x_val'], data['y_val'])

    model, base = build_model(key)
    loss = keras.losses.CategoricalCrossentropy(label_smoothing=RECIPE['label_smoothing'])
    history = {'accuracy': [], 'val_accuracy': [], 'loss': [], 'val_loss': [], 'phase': []}
    timing = {}

    def fit(phase):
        cfg = dict(RECIPE[phase])
        if phase == 'finetune' and 'finetune_lr' in MODELS[key]:
            cfg['lr'] = MODELS[key]['finetune_lr']
        opt = keras.optimizers.Adam(cfg['lr'], gradient_accumulation_steps=accum if accum > 1 else None)
        model.compile(optimizer=opt, loss=loss, metrics=['accuracy'])
        cb = [
            keras.callbacks.EarlyStopping(monitor='val_accuracy', patience=cfg['patience'], restore_best_weights=True),
            keras.callbacks.ReduceLROnPlateau(monitor='val_loss', factor=0.5, patience=2, min_lr=1e-7),
            keras.callbacks.CSVLogger(os.path.join(out, f'log_{phase}.csv')),
        ]
        t0 = time.time()
        h = model.fit(train_ds, validation_data=val_ds, epochs=cfg['epochs'], callbacks=cb, verbose=2)
        timing[phase] = {'lr': cfg['lr'], 'seconds': round(time.time() - t0, 1), 'epochs_run': len(h.history['loss'])}
        for k in ('accuracy', 'val_accuracy', 'loss', 'val_loss'):
            history[k] += [float(v) for v in h.history[k]]
        history['phase'] += [phase] * len(h.history['loss'])
        print(f'{key} seed {seed} {phase}: {timing[phase]}', flush=True)

    # ช่วงที่ 1: ล็อกโมเดลฐาน เทรนแค่ชั้นสุดท้าย
    base.trainable = False
    fit('head')
    # ช่วงที่ 2: ปลดล็อกทั้งโมเดล ยกเว้น BatchNorm แล้วเทรนต่อด้วย learning rate ต่ำ
    base.trainable = True
    for l in base.layers:
        if isinstance(l, layers.BatchNormalization):
            l.trainable = False
    fit('finetune')

    probs = model.predict(data['x_test'].astype('float32'), batch_size=64, verbose=0)
    np.save(os.path.join(out, 'test_probs.npy'), probs.astype('float32'))
    acc = float((probs.argmax(1) == data['y_test']).mean())

    # เก็บเฉพาะน้ำหนัก ไม่เก็บสถานะ optimizer ไฟล์จะเล็กลงครึ่งหนึ่ง
    clean, _ = build_model(key)
    clean.set_weights(model.get_weights())
    clean.save(os.path.join(out, 'model.keras'))
    json.dump(history, open(os.path.join(out, 'history.json'), 'w'), indent=1)

    import torch
    info = {
        'model': key, 'name': MODELS[key]['name'], 'seed': seed, 'recipe': RECIPE, 'timing': timing,
        'micro_batch': micro, 'gradient_accumulation_steps': accum,
        'train_seconds': round(sum(t['seconds'] for t in timing.values()), 1),
        'best_val_accuracy': max(history['val_accuracy']), 'test_accuracy_quick': acc,
        'device': torch.cuda.get_device_name(0) if torch.cuda.is_available() else platform.processor(),
        'keras': keras.__version__, 'backend': keras.backend.backend(), 'torch': torch.__version__,
        'python': sys.version.split()[0], 'finished': time.strftime('%Y-%m-%d %H:%M:%S'),
    }
    json.dump(info, open(os.path.join(out, 'train_info.json'), 'w'), indent=2)
    print(f'DONE {key} seed {seed} test_acc={acc:.4f} time={info["train_seconds"]}s', flush=True)
    keras.backend.clear_session()


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--model', choices=list(MODELS))
    ap.add_argument('--seed', type=int, default=SEEDS[0])
    ap.add_argument('--all', action='store_true')
    a = ap.parse_args()
    if a.all:
        # แยก process ทีละโมเดล หน่วยความจำ GPU จะคืนครบทุกครั้ง
        import subprocess
        for s in SEEDS:
            for k in MODELS:
                if not os.path.exists(os.path.join(run_dir(k, s), 'train_info.json')):
                    subprocess.run([sys.executable, __file__, '--model', k, '--seed', str(s)], check=True)
    else:
        train(a.model, a.seed, dict(np.load(DATA_CACHE)))
