"""เทรนโมเดลจำแนกโรคใบข้าว (EfficientNetB0, 4 คลาส) โดยแยกภาพชุดทดสอบออกไว้ต่างหาก

รับภาพแบบเดียวกับโมเดลที่ระบบใช้ คือภาพสี RGB ย่อเป็น 224x224 ค่าพิกเซล 0-255 ไม่ต้องหารก่อน
ผลลัพธ์เป็นความน่าจะเป็นของ [BLAST, BLB, TUNGRO, HEALTHY] ไฟล์ที่ได้ทั้งหมดเก็บไว้ใน run/
"""
import json, os, random, time
import numpy as np
import tensorflow as tf
import keras
from keras import layers
from sklearn.model_selection import train_test_split

SEED = 42
random.seed(SEED); np.random.seed(SEED); tf.random.set_seed(SEED)
ROOT = os.environ.get('RICE_EVAL_DIR', 'D:/rice-eval')  # ที่เก็บภาพ (rice4/) และผลการเทรน (run/)
DATA = os.path.join(ROOT, 'rice4')
OUT = os.path.join(ROOT, 'run')
os.makedirs(OUT, exist_ok=True)
CLASSES = ['BLAST', 'BLB', 'TUNGRO', 'HEALTHY']
IMG = 224
BATCH = 32

# ---------- แบ่งภาพ เทรน 70 / ตรวจสอบ 15 / ทดสอบ 15 ให้ทุกชุดมีสัดส่วนแต่ละโรคเท่ากัน ----------
paths, labels = [], []
for i, c in enumerate(CLASSES):
    for f in sorted(os.listdir(os.path.join(DATA, c))):
        paths.append(os.path.join(DATA, c, f)); labels.append(i)
paths, labels = np.array(paths), np.array(labels)
p_train, p_rest, y_train, y_rest = train_test_split(paths, labels, test_size=0.30, stratify=labels, random_state=SEED)
p_val, p_test, y_val, y_test = train_test_split(p_rest, y_rest, test_size=0.50, stratify=y_rest, random_state=SEED)
split = {
    'train': {c: int((y_train == i).sum()) for i, c in enumerate(CLASSES)},
    'val': {c: int((y_val == i).sum()) for i, c in enumerate(CLASSES)},
    'test': {c: int((y_test == i).sum()) for i, c in enumerate(CLASSES)},
}
json.dump({'split': split, 'test_files': [os.path.relpath(p, DATA) for p in p_test]}, open(os.path.join(OUT, 'split.json'), 'w'), indent=1)
print('split', split, flush=True)


def load(path, label):
    img = tf.io.decode_jpeg(tf.io.read_file(path), channels=3)
    img = tf.image.resize(img, (IMG, IMG))  # ย่อแบบเดียวกับที่ API ทำ (บีบให้เป็น 224x224 ไม่ครอปขอบ)
    return img, tf.one_hot(label, len(CLASSES))


def ds(p, y, train):
    d = tf.data.Dataset.from_tensor_slices((p, y)).map(load, num_parallel_calls=tf.data.AUTOTUNE).cache()
    if train:
        d = d.shuffle(len(p), seed=SEED, reshuffle_each_iteration=True)
    return d.batch(BATCH).prefetch(tf.data.AUTOTUNE)


train_ds, val_ds, test_ds = ds(p_train, y_train, True), ds(p_val, y_val, False), ds(p_test, y_test, False)

counts = np.bincount(y_train, minlength=len(CLASSES))
# โรคขอบใบแห้งมีภาพน้อยสุด เลยให้น้ำหนักมากขึ้น โมเดลจะได้ไม่มองข้าม
class_weight = {i: float(len(y_train) / (len(CLASSES) * counts[i])) for i in range(len(CLASSES))}
print('class_weight', class_weight, flush=True)

# ---------- สร้างโมเดล ----------
# สุ่มพลิก หมุน ซูม ปรับแสงและคอนทราสต์ เฉพาะตอนเทรน ให้โมเดลเจอภาพหลายแบบ
augment = keras.Sequential([
    layers.RandomFlip('horizontal_and_vertical'),
    layers.RandomRotation(0.15),
    layers.RandomZoom(0.15),
    layers.RandomContrast(0.15),
    layers.RandomBrightness(0.15, value_range=(0, 255)),
], name='data_augmentation')
base = keras.applications.EfficientNetB0(include_top=False, weights='imagenet', input_shape=(IMG, IMG, 3), pooling='avg')
inputs = keras.Input(shape=(IMG, IMG, 3), name='image')
x = augment(inputs)
x = keras.applications.efficientnet.preprocess_input(x)  # ใน EfficientNet ไม่ได้เปลี่ยนค่าอะไร (การปรับสเกลอยู่ในโมเดลแล้ว)
x = base(x, training=False)  # ให้ BatchNorm ใช้ค่าเดิมตลอด แม้ตอน fine-tune
x = layers.Dropout(0.3)(x)
outputs = layers.Dense(len(CLASSES), activation='softmax', name='predictions')(x)
model = keras.Model(inputs, outputs, name='rice_disease_classifier_v2')

# label_smoothing กันไม่ให้โมเดลมั่นใจเกินจริง
loss = keras.losses.CategoricalCrossentropy(label_smoothing=0.1)
history = {'accuracy': [], 'val_accuracy': [], 'loss': [], 'val_loss': [], 'phase': []}


def fit(epochs, lr, phase, patience):
    model.compile(optimizer=keras.optimizers.Adam(lr), loss=loss, metrics=['accuracy'])
    cb = [
        keras.callbacks.EarlyStopping(monitor='val_accuracy', patience=patience, restore_best_weights=True),
        keras.callbacks.ReduceLROnPlateau(monitor='val_loss', factor=0.5, patience=2, min_lr=1e-7),
        keras.callbacks.CSVLogger(os.path.join(OUT, f'log_{phase}.csv')),
    ]
    t0 = time.time()
    h = model.fit(train_ds, validation_data=val_ds, epochs=epochs, class_weight=class_weight, callbacks=cb, verbose=2)
    for k in ('accuracy', 'val_accuracy', 'loss', 'val_loss'):
        history[k] += [float(v) for v in h.history[k]]
    history['phase'] += [phase] * len(h.history['loss'])
    print(f'{phase} done in {time.time() - t0:.0f}s', flush=True)


# ช่วงที่ 1: ล็อกโมเดลฐานไว้ เทรนแค่ชั้นสุดท้ายที่ทายโรค
base.trainable = False
fit(6, 1e-3, 'head', 3)
# ช่วงที่ 2: ปลดล็อกทั้งโมเดล เทรนต่อด้วย learning rate ต่ำ
# (รุ่นแรกใน Colab ปลดล็อกแค่ 20% บนสุด เลยได้ความแม่นยำแค่ราว 70%)
base.trainable = True
for l in base.layers:
    if isinstance(l, layers.BatchNormalization):
        l.trainable = False
fit(18, 1e-4, 'finetune', 5)

model.save(os.path.join(OUT, 'rice_disease_model.keras'))
json.dump(history, open(os.path.join(OUT, 'history.json'), 'w'), indent=1)
json.dump({str(i): c for i, c in enumerate(CLASSES)}, open(os.path.join(OUT, 'class_indices.json'), 'w'), indent=2)
print('saved model', flush=True)
