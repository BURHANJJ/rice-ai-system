# เปรียบเทียบโมเดลจำแนกโรคใบข้าว

โฟลเดอร์นี้ใช้ตอบคำถามว่า **ทำไม Rice AI จึงใช้ EfficientNet-B0** ในการทดลอง เราเทรนโมเดล 6 สถาปัตยกรรมภายใต้เงื่อนไขเดียวกันทุกอย่าง โดยเทรนตัวละ 3 รอบ แล้ววัดทั้งความแม่นยำ ขนาดไฟล์ และความเร็ว

> โมเดลที่ระบบใช้งานจริงอยู่ที่ `ai-service/model/` และไม่ได้ถูกแก้ไขโดยงานนี้ ส่วนโฟลเดอร์นี้เป็นงานวิจัยเปรียบเทียบอย่างเดียว

**ผลสรุปทั้งหมดอยู่ที่ [`results/RESULTS.md`](results/RESULTS.md)** และแสดงบนเว็บที่หน้า `/research-study`

## โครงสร้างโฟลเดอร์

```
model-comparison/
├── README.md                  ← ไฟล์นี้
├── common.py                  ค่าที่ใช้ร่วมกัน: รายชื่อโมเดล สูตรการเทรน วิธีสร้างโมเดล
├── prepare_data.py            แบ่งภาพและย่อเป็น 224x224 ครั้งเดียว (ตรวจว่าชุดทดสอบตรงกับรุ่นที่ใช้งาน)
├── train.py                   เทรนโมเดล 1 ตัว หรือทั้งหมดด้วย --all
├── evaluate.py                วัดผลบนชุดทดสอบ แปลงเป็น TFLite จับเวลา และทดสอบสถิติ
├── figures.py                 วาดกราฟสำหรับรายงาน
├── write_readmes.py           เขียน README ของแต่ละโมเดลและ results/RESULTS.md
├── export_web.py              ส่งตัวเลขไปให้หน้าเว็บ (web/src/data/modelComparison.json)
├── models/
│   ├── 01_efficientnet_b0/    ← โมเดลหลักของระบบ (เทรนซ้ำภายใต้เงื่อนไขเดียวกัน)
│   ├── 02_mobilenet_v3_large/ ← โมเดลสำหรับมือถือ
│   ├── 03_densenet121/
│   ├── 04_vgg16/              (มี lr-1e-4-diverged/ เก็บหลักฐานว่าทำไมใช้ learning rate ต่ำกว่า)
│   ├── 05_resnet50/
│   └── 06_convnext_tiny/      ← โมเดลสมัยใหม่ขนาดใหญ่
│       ├── README.md          อธิบายว่าโมเดลนี้คืออะไร ทำไมเลือก และผลของมัน
│       └── seed-42/ seed-7/ seed-2026/
│           ├── model.keras    โมเดลที่เทรนแล้ว (ไม่อยู่ใน git)
│           ├── model.tflite   แบบมือถือ (เฉพาะ seed-42, ไม่อยู่ใน git)
│           ├── metrics.json   ผลวัดทั้งหมด
│           ├── test_probs.npy ความน่าจะเป็นที่ทายภาพทดสอบ 761 ภาพ
│           ├── history.json, log_head.csv, log_finetune.csv
│           └── train_info.json
└── results/
    ├── RESULTS.md             ตารางสรุปและข้อสรุป
    ├── summary.json           ผลรวมทุกโมเดล (ใช้สร้างเว็บและ README)
    ├── summary.csv            ตารางสรุป เปิดใน Excel ได้
    ├── runs.csv               ผลแยกทุกการเทรน (18 แถว)
    └── figures/               กราฟ PNG สำหรับใส่รายงาน
```

ไฟล์ `.keras` และ `.tflite` รวมกันประมาณ 1 GB จึงไม่เก็บใน git ถ้าต้องการไฟล์เหล่านี้ให้รัน `train.py` ใหม่ หรือขอจากเครื่องที่เทรนไว้ ผลวัดทั้งหมดและความน่าจะเป็นที่ทายภาพทดสอบอยู่ใน git ครบ จึงคำนวณสถิติซ้ำได้โดยไม่ต้องเทรนใหม่

## เงื่อนไขการทดลอง

| | |
|---|---|
| ข้อมูล | Paddy Doctor (Kaggle) 4 คลาส 5,069 ภาพ แบ่ง stratified 70/15/15 ด้วย seed 42 (train 3,548 / val 760 / test 761) ชุดเดียวกับรุ่นที่ใช้งาน |
| ขนาดภาพ | 224 × 224 RGB ค่า 0-255 การปรับค่าพิกเซลตามแต่ละโมเดลอยู่ในตัวโมเดล |
| น้ำหนักเริ่มต้น | ImageNet ทุกตัว |
| ช่วงที่ 1 | ล็อกโมเดลฐาน ฝึกชั้นสุดท้าย สูงสุด 6 epochs, Adam lr 0.001, early stopping patience 3 |
| ช่วงที่ 2 | ปลดล็อกทุกชั้นยกเว้น BatchNorm สูงสุด 18 epochs, Adam lr 0.0001, patience 5 (VGG-16 ใช้ 0.00001 ดูเหตุผลใน `models/04_vgg16/README.md`) |
| อื่น ๆ | label smoothing 0.1, dropout 0.3, class weight, augmentation (พลิก หมุน ซูม contrast brightness 0.15), ReduceLROnPlateau, batch 32 |
| เทรนซ้ำ | 3 seed (42, 7, 2026) รายงานค่าเฉลี่ย ± SD |
| เทรนบน | NVIDIA RTX 4070 Laptop GPU, Keras 3.15 + PyTorch 2.11 (CUDA 12.8) |
| วัดผลบน | TensorFlow 2.21 บน CPU Intel Core i5-12450H (ตรวจว่าผลตรงกับตอนเทรนบน PyTorch) |
| ความเร็ว | TFLite Float16, 4 threads, ค่ามัธยฐานของ 100 ครั้ง (batch 1) |
| สถิติ | McNemar exact test เทียบ EfficientNet-B0 กับแต่ละโมเดล แยกทุก seed |

## วิธีรันซ้ำ

ต้องมีภาพใน `D:/rice-eval/rice4/` และผลแบ่งข้อมูลของรุ่นที่ใช้งาน `D:/rice-eval/run/split.json` ก่อน (ดู `ai-service/training/README.md`) ถ้าเก็บไว้ที่อื่นให้ตั้ง `RICE_EVAL_DIR`

```bash
# 1. เตรียมข้อมูล (Python ที่มี TensorFlow)
python prepare_data.py

# 2. เทรนบน GPU (TensorFlow บน Windows ใช้ GPU ไม่ได้ จึงใช้ Keras + PyTorch)
python -m venv D:/rice-eval/venv-gpu
D:/rice-eval/venv-gpu/Scripts/pip install torch torchvision --index-url https://download.pytorch.org/whl/cu128
D:/rice-eval/venv-gpu/Scripts/pip install keras==3.15.0 scikit-learn
set KERAS_BACKEND=torch
D:/rice-eval/venv-gpu/Scripts/python train.py --all          # ประมาณ 5-6 ชั่วโมง ข้ามตัวที่เสร็จแล้ว

# 3. วัดผลและสรุป (Python ที่มี TensorFlow ปิดงานหนักอื่นก่อน เพราะจับเวลาบน CPU)
python evaluate.py
python figures.py
python write_readmes.py
python export_web.py
```
