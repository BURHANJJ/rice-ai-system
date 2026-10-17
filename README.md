# Rice AI — ระบบจำแนกโรคใบข้าวด้วย Machine Learning

ถ่ายรูปใบข้าวแล้วรู้ว่าเป็นโรคอะไร พร้อมคำแนะนำการจัดการจากกรมการข้าว แยกได้ 4 แบบ คือ โรคไหม้ (Blast) โรคขอบใบแห้ง (Bacterial Leaf Blight) โรคใบสีส้ม (Tungro) และใบปกติ ถ้าภาพดูเป็นโรคอื่นที่ระบบยังไม่รองรับ จะบอกผู้ใช้ตรง ๆ แทนการเดาชื่อโรค

โมเดล EfficientNetB0 รุ่นที่ 3 ได้ความแม่นยำ **96.85%** บนชุดทดสอบ 761 ภาพที่ไม่เคยใช้เทรน และปฏิเสธภาพโรคอื่นได้ 98% (รุ่นที่ 2 ให้ชื่อโรคผิดกับภาพเหล่านี้ 299 จาก 801 ภาพ เหลือ 16 ภาพ)

โครงงานวิชา · สาขาวิชาคอมพิวเตอร์และวิทยาการสารสนเทศเพื่อการจัดการ คณะวิทยาการสื่อสาร มหาวิทยาลัยสงขลานครินทร์ วิทยาเขตปัตตานี · ปีการศึกษา 2569

## สถาปัตยกรรม

AI ทำงาน**บนอุปกรณ์ของผู้ใช้**ทั้งหมด ข้อมูลอยู่บน Firebase ไม่มีเซิร์ฟเวอร์ของระบบเองที่ต้องดูแล

```
แอปมือถือ (Flutter)     โมเดล V3 · TensorFlow Lite บนเครื่อง ──┐   ใช้ได้แม้ไม่มีสัญญาณ
เว็บ (React)            โมเดล V3 · ONNX Runtime Web ในเบราว์เซอร์ ┤   ภาพไม่ต้องส่งออกจากเครื่อง
                                                                  │
                                                                  ▼
            Firebase: Auth · Firestore (Security Rules) · Hosting · Cloud Messaging · Cloud Functions
```

- **สแกนในแอป**: วิเคราะห์บนมือถือ แล้วบันทึกผล รูปย่อ และพิกัดลง Firestore (ไม่มีสัญญาณก็บันทึกไว้ในเครื่องแล้วซิงก์ทีหลัง)
- **สแกนบนเว็บ**: หน้า `/try-scan` ให้ทุกคนทดลองวันละ 5 ครั้ง (ไม่บันทึกผล) และหน้าสแกนในพอร์ทัลนักวิชาการ/ผู้ดูแลระบบ (บันทึกผลเหมือนแอป)
- **แผนที่ระบาด แดชบอร์ด รายงาน**: อ่านจาก Firestore โดยตรง สิทธิ์คุมด้วย `firestore.rules`

| โฟลเดอร์ | คืออะไร | เทคโนโลยี |
|---|---|---|
| `mobile/` | แอปเกษตรกร: สแกน ผลวิเคราะห์ ประวัติ แผนที่ระบาด 3 มิติ คลังโรค สมุดแปลงนา สภาพอากาศ แจ้งเตือน | Flutter 3.24, TensorFlow Lite, Firebase |
| `web/` | เว็บสาธารณะ ทดลองสแกน แชทบอท พอร์ทัลนักวิชาการ และพอร์ทัลผู้ดูแลระบบ | React 19, Vite, Tailwind CSS 4, ONNX Runtime Web, Leaflet, Recharts |
| `ai-service/` | งานด้าน AI ทั้งหมด: เทรน ประเมินผล เปรียบเทียบ 6 สถาปัตยกรรม และไฟล์โมเดลต้นฉบับ (`model/`) | Python, Keras 3, TensorFlow / PyTorch |
| `functions/` | Push แจ้งเตือนการระบาด (FCM) และแชทบอทโหมด AI (ไม่บังคับ) | Cloud Functions (แผน Blaze) |
| `video/` | คลิปโปรโมทแอปและคลิปอธิบายการพัฒนาโมเดล | Remotion |
| `docs/` | รายงานและผลประเมินโมเดล | — |

## ผลของโมเดล

| | รุ่นแรก (Colab) | รุ่นที่ 2 | รุ่นที่ 3 (ใช้งานจริง) |
|---|---|---|---|
| คลาส | 4 | 4 | 4 + โรคอื่น |
| Accuracy 4 คลาส (ชุดทดสอบ 761 ภาพ) | 75.43% | 97.90% | **96.85%** |
| ภาพ 4 คลาสที่ระบบตอบผล | — | 92.8% | **95.7%** |
| ภาพโรคอื่น 801 ภาพที่ได้ชื่อโรคผิด | — | 299 | **16** |
| ROC-AUC (4 คลาส) | — | 0.9992 | 0.9992 |

ข้อมูล: Paddy Doctor (Kaggle) 4 คลาส 5,069 ภาพ + โรคอื่น 6 ชนิด 5,338 ภาพ แบ่ง 70/15/15 แบบ stratified (seed 42) วิธีเทรน ผลรายคลาส และวิธีทำซ้ำอยู่ใน [`ai-service/training/README.md`](ai-service/training/README.md) การเปรียบเทียบกับโมเดลอื่น 5 สถาปัตยกรรมอยู่ใน [`ai-service/model-comparison/`](ai-service/model-comparison/README.md)

โมเดลเดียวกันถูกแปลงเป็น 2 รูปแบบ: TensorFlow Lite สำหรับแอป (`mobile/assets/model/`) และ ONNX สำหรับเว็บ (`web/public/models/rice-v3.onnx`, น้ำหนัก fp16 คำนวณ fp32 ตรวจแล้วว่าตอบตรงกับโมเดลต้นฉบับทุกภาพจาก 911 ภาพทดสอบ)

## เริ่มใช้งานในเครื่อง

ต้องมี Node.js 20+, Flutter 3.24 และ [Git LFS](https://git-lfs.com) (ไฟล์โมเดลเก็บผ่าน LFS) ถ้าจะเทรนโมเดลต้องมี Python 3.11+ ด้วย

```bash
git lfs install && git lfs pull

# เว็บ
cd web
npm install
cp .env.example .env
npm run dev                         # http://localhost:5173

# แอปมือถือ
cd mobile
flutter pub get
flutter run
```

ไม่มีรหัสผ่านหรือกุญแจลับใน repo นี้ ค่า Firebase ใน `web/src/lib/firebase.js` และ `mobile/android/app/google-services.json` เป็นค่าฝั่งไคลเอนต์ที่ต้องฝังในแอปอยู่แล้ว การเข้าถึงข้อมูลคุมด้วย `firestore.rules`

| ตัวแปร | ที่ | ใช้ทำอะไร |
|---|---|---|
| `VITE_CHAT_URL` | `web/.env` | ว่าง = แชทบอทตอบจากคลังความรู้ในเว็บ, ใส่ URL ของฟังก์ชัน `chat` = ตอบด้วย Claude |
| `ANTHROPIC_API_KEY` | Firebase secret | เฉพาะเมื่อเปิดแชทบอทโหมด AI |

## Deploy

```bash
cd web && npm run build && cd .. && firebase deploy --only hosting,firestore:rules --project rice-ai-appp
firebase deploy --only functions:sendBroadcastPush --project rice-ai-appp   # Push แจ้งเตือน (แผน Blaze)
```

## แอปรุ่นเบต้า

```bash
cd mobile
flutter build apk --release --split-per-abi --build-name=0.9.4 --build-number=6
```

ทุกรุ่นใหม่ให้เพิ่มทั้ง `--build-name` (เลขที่แอปแสดงในหน้าเปิดแอปและโปรไฟล์) และ `--build-number` (ต้องมากกว่ารุ่นก่อน ไม่งั้นติดตั้งทับไม่ได้) แล้วอัปเดต `web/public/downloads/rice-ai-beta.json`

ไฟล์ APK เผยแพร่ที่ [rice-ai-beta Releases](https://github.com/BURHANJJ/rice-ai-beta/releases) และหน้าแรกของเว็บ ไม่เก็บไฟล์ APK ใน repo นี้

## ทดสอบ

```bash
cd mobile && flutter test                          # โมเดลผลวิเคราะห์ ไฟล์โมเดล V3 และ UI kit
cd ai-service/training && python test_eval.py      # ประเมินชุดทดสอบ 761 ภาพ
```

## ข้อจำกัดที่รู้อยู่

- ภาพเทรนทั้งหมดมาจากนาในอินเดีย ผลกับนาไทยอาจต่างไป ระบบมีหน้าตรวจทานผล AI ไว้เก็บภาพจริงมาเทรนเพิ่ม
- สิทธิ์ทดลองสแกนบนเว็บ 5 ครั้งต่อวันนับต่อเบราว์เซอร์ เป็นการจำกัดการใช้งานพื้นฐาน ไม่ใช่ระบบกันโกง
- 2FA (TOTP) ต้องอัปเกรดเป็น Identity Platform และ Push ทันทีต้องใช้แผน Blaze
- คอลเลกชัน `diagnoses` อ่านได้สาธารณะเพื่อแผนที่ระบาด ควรแยกสถิติสาธารณะออกในรุ่นถัดไป
