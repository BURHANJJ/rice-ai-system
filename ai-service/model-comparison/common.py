"""ค่าที่ทุกสคริปต์ในโฟลเดอร์นี้ใช้ร่วมกัน: ที่อยู่ไฟล์ รายชื่อโมเดล วิธีสร้างโมเดล และชั้นปรับค่าภาพ

ทุกโมเดลรับภาพแบบเดียวกับโมเดลที่ระบบใช้ คือภาพ RGB ขนาด 224x224 ค่าพิกเซล 0-255
การปรับค่าพิกเซลตามที่แต่ละโมเดลต้องการอยู่ในตัวโมเดลเอง จึงสลับโมเดลแทนกันได้ทันที
"""
import os

import keras
from keras import layers, ops

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.environ.get('RICE_EVAL_DIR', 'D:/rice-eval')  # ที่เก็บภาพ (rice4/) และผลการเทรนรุ่นที่ใช้งาน (run/)
DATA_CACHE = os.path.join(ROOT, 'compare', 'data224.npz')  # ภาพทั้ง 3 ชุดที่ย่อแล้ว สร้างด้วย prepare_data.py
MODELS_DIR = os.path.join(HERE, 'models')
RESULTS_DIR = os.path.join(HERE, 'results')

CLASSES = ['BLAST', 'BLB', 'TUNGRO', 'HEALTHY']
IMG = 224
BATCH = 32
SPLIT_SEED = 42           # แบ่งข้อมูลด้วย seed เดียวกับรุ่นที่ใช้งาน ชุดทดสอบ 761 ภาพจึงเป็นชุดเดิม
SEEDS = (42, 7, 2026)     # seed ของการเทรน (ค่าเริ่มต้นชั้นสุดท้าย ลำดับภาพ และการสุ่มดัดแปลงภาพ)

# สูตรการเทรนเดียวกับรุ่นที่ใช้งาน (ai-service/training/train.py) ทุกโมเดลใช้เหมือนกันหมด
RECIPE = {
    'head': {'epochs': 6, 'lr': 1e-3, 'patience': 3},
    'finetune': {'epochs': 18, 'lr': 1e-4, 'patience': 5},
    'label_smoothing': 0.1,
    'dropout': 0.3,
    'augment': 0.15,
    'batch': BATCH,
}

# โมเดลที่ fine-tune ทั้งตัวด้วย batch 32 แล้วหน่วยความจำ GPU 8 GB ไม่พอ (ล้นไปใช้ RAM ช้าลงกว่า 10 เท่า)
# ป้อนทีละ 16 ภาพสองครั้งแล้วค่อยอัปเดตน้ำหนัก (gradient accumulation) ได้ผลเท่ากับ batch 32
# เพราะ loss เป็นค่าเฉลี่ยต่อภาพ และ BatchNorm ถูกล็อกไว้ ไม่ขึ้นกับขนาด batch
MICRO_BATCH = {'densenet121': 16, 'vgg16': 16, 'resnet50': 16, 'convnext_tiny': 16}


@keras.saving.register_keras_serializable(package='rice_compare')
class ImageNetPreprocess(layers.Layer):
    """ปรับค่าพิกเซล 0-255 ให้ตรงกับที่น้ำหนัก ImageNet ของแต่ละโมเดลถูกฝึกมา

    caffe: สลับ RGB เป็น BGR แล้วลบค่าเฉลี่ย (VGG16, ResNet50)
    torch: หาร 255 แล้วปรับด้วยค่าเฉลี่ยและส่วนเบี่ยงเบนของ ImageNet (DenseNet121)
    """

    MEAN = {'caffe': (103.939, 116.779, 123.68), 'torch': (0.485, 0.456, 0.406)}
    STD = {'caffe': (1.0, 1.0, 1.0), 'torch': (0.229, 0.224, 0.225)}

    def __init__(self, mode, **kw):
        super().__init__(**kw)
        self.mode = mode

    def call(self, x):
        if self.mode == 'caffe':
            x = ops.flip(x, axis=-1)
        else:
            x = x / 255.0
        mean = ops.convert_to_tensor(self.MEAN[self.mode], dtype=x.dtype)
        std = ops.convert_to_tensor(self.STD[self.mode], dtype=x.dtype)
        return (x - mean) / std

    def get_config(self):
        return {**super().get_config(), 'mode': self.mode}


# ลำดับในตารางผล: โมเดลหลักของระบบขึ้นก่อน ตามด้วยโมเดลเปรียบเทียบเรียงจากเล็กไปใหญ่
MODELS = {
    'efficientnet_b0': {
        'folder': '01_efficientnet_b0', 'name': 'EfficientNet-B0', 'role': 'main',
        'year': 2019, 'paper': 'Tan & Le, ICML 2019', 'family': 'CNN (compound scaling)',
        'build': lambda: keras.applications.EfficientNetB0(include_top=False, weights='imagenet', input_shape=(IMG, IMG, 3), pooling='avg'),
        'preprocess': None,  # ปรับค่าพิกเซลอยู่ในโมเดลแล้ว
    },
    'mobilenet_v3_large': {
        'folder': '02_mobilenet_v3_large', 'name': 'MobileNetV3-Large', 'role': 'compare',
        'year': 2019, 'paper': 'Howard et al., ICCV 2019', 'family': 'CNN สำหรับมือถือ',
        'build': lambda: keras.applications.MobileNetV3Large(include_top=False, weights='imagenet', input_shape=(IMG, IMG, 3), pooling='avg', include_preprocessing=True),
        'preprocess': None,
    },
    'densenet121': {
        'folder': '03_densenet121', 'name': 'DenseNet-121', 'role': 'compare',
        'year': 2017, 'paper': 'Huang et al., CVPR 2017', 'family': 'CNN (dense connections)',
        'build': lambda: keras.applications.DenseNet121(include_top=False, weights='imagenet', input_shape=(IMG, IMG, 3), pooling='avg'),
        'preprocess': 'torch',
    },
    'vgg16': {
        'folder': '04_vgg16', 'name': 'VGG-16', 'role': 'compare',
        'year': 2015, 'paper': 'Simonyan & Zisserman, ICLR 2015', 'family': 'CNN แบบดั้งเดิม',
        'build': lambda: keras.applications.VGG16(include_top=False, weights='imagenet', input_shape=(IMG, IMG, 3), pooling='avg'),
        'preprocess': 'caffe',
        # VGG16 ไม่มี BatchNorm พอ fine-tune ด้วย 1e-4 แล้วพัง (val accuracy ตกจาก 60% เหลือ 35% loss ค้างที่ ln 4)
        # จึงลดเหลือ 1e-5 เฉพาะช่วงที่ 2 ของโมเดลนี้ หลักฐานอยู่ใน models/04_vgg16/lr-1e-4-diverged/
        'finetune_lr': 1e-5,
    },
    'resnet50': {
        'folder': '05_resnet50', 'name': 'ResNet-50', 'role': 'compare',
        'year': 2016, 'paper': 'He et al., CVPR 2016', 'family': 'CNN (residual)',
        'build': lambda: keras.applications.ResNet50(include_top=False, weights='imagenet', input_shape=(IMG, IMG, 3), pooling='avg'),
        'preprocess': 'caffe',
    },
    'convnext_tiny': {
        'folder': '06_convnext_tiny', 'name': 'ConvNeXt-Tiny', 'role': 'compare',
        'year': 2022, 'paper': 'Liu et al., CVPR 2022', 'family': 'CNN สมัยใหม่ (แนวคิดจาก Transformer)',
        'build': lambda: keras.applications.ConvNeXtTiny(include_top=False, weights='imagenet', input_shape=(IMG, IMG, 3), pooling='avg', include_preprocessing=True),
        'preprocess': None,
    },
}


def run_dir(key, seed):
    return os.path.join(MODELS_DIR, MODELS[key]['folder'], f'seed-{seed}')


def build_model(key):
    """ประกอบโมเดล: ดัดแปลงภาพ (เฉพาะตอนเทรน) → ปรับค่าพิกเซล → โมเดลฐาน ImageNet → Dropout → Dense 4 คลาส"""
    spec = MODELS[key]
    a = RECIPE['augment']
    augment = keras.Sequential([
        layers.RandomFlip('horizontal_and_vertical'),
        layers.RandomRotation(a),
        layers.RandomZoom(a),
        layers.RandomContrast(a),
        layers.RandomBrightness(a, value_range=(0, 255)),
    ], name='data_augmentation')
    base = spec['build']()
    inputs = keras.Input(shape=(IMG, IMG, 3), name='image')
    x = augment(inputs)
    if spec['preprocess']:
        x = ImageNetPreprocess(spec['preprocess'], name='imagenet_preprocess')(x)
    x = base(x, training=False)  # BatchNorm ใช้ค่าเดิมของ ImageNet ตลอด เหมือนรุ่นที่ใช้งาน
    x = layers.Dropout(RECIPE['dropout'])(x)
    outputs = layers.Dense(len(CLASSES), activation='softmax', name='predictions')(x)
    return keras.Model(inputs, outputs, name=f'rice_{key}'), base
