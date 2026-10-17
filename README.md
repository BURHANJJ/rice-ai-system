# Rice AI — ระบบจำแนกโรคใบข้าวด้วย Machine Learning

ถ่ายรูปใบข้าวแล้วรู้ว่าเป็นโรคอะไร พร้อมคำแนะนำการจัดการจากกรมการข้าว แยกได้ 4 แบบ คือ โรคไหม้ (Blast) โรคขอบใบแห้ง (Bacterial Leaf Blight) โรคใบสีส้ม (Tungro) และใบปกติ ถ้าภาพดูเป็นโรคอื่นที่ระบบยังไม่รองรับ จะบอกผู้ใช้ตรง ๆ แทนการเดาชื่อโรค

โมเดล EfficientNetB0 รุ่นที่ 3 ได้ความแม่นยำ **96.85%** บนชุดทดสอบ 761 ภาพที่ไม่เคยใช้เทรน และปฏิเสธภาพโรคอื่นได้ 98% (รุ่นที่ 2 ให้ชื่อโรคผิดกับภาพเหล่านี้ 299 จาก 801 ภาพ เหลือ 16 ภาพ) ทำงานบนมือถือแบบออฟไลน์ได้

โครงงานวิชา · สาขาวิชาคอมพิวเตอร์และวิทยาการสารสนเทศเพื่อการจัดการ คณะวิทยาการสื่อสาร มหาวิทยาลัยสงขลานครินทร์ วิทยาเขตปัตตานี · ปีการศึกษา 2569

## ส่วนประกอบ

| โฟลเดอร์ | คืออะไร | เทคโนโลยี |
|---|---|---|
| `mobile/` | แอปเกษตรกร: สแกน ผลวิเคราะห์ ประวัติ แผนที่ระบาด 3 มิติ คลังโรค สมุดแปลงนา สภาพอากาศ แจ้งเตือน | Flutter 3.24, TFLite (ออฟไลน์), Firebase |
| `web/` | เว็บสาธารณะ พอร์ทัลนักวิชาการ และพอร์ทัลผู้ดูแลระบบ | React 19, Vite, Tailwind CSS 4, Leaflet, Recharts |
| `backend/` | API รับภาพ ตรวจ Firebase ID Token ย่อรูป เติมคำแนะนำ | Node.js, Express, Firebase Admin SDK, SQLite |
| `ai-service/` | บริการจำแนกภาพ และโค้ดเทรนโมเดล (`training/`) | Python, FastAPI, TensorFlow 2.21 |
| `functions/` | ส่ง Push แจ้งเตือนการระบาดผ่าน FCM | Cloud Functions (ต้องใช้แผน Blaze) |
| `video/` | คลิปโปรโมทแอป | Remotion |
| `docs/` | เอกสารประกอบ ผลประเมินโมเดล | — |

```
แอปมือถือ ─┐                         ┌─ AI Service (FastAPI :8000)
           ├─ ภาพ + ID Token → Backend (Express :4000)
เว็บ ───────┘                         └─ คำแนะนำโรค (SQLite)
     │
     └─ อ่าน/เขียนข้อมูลตรงผ่าน Security Rules → Firebase (Auth · Firestore · FCM · Hosting)
```

## ผลของโมเดล

| | รุ่นแรก (Colab) | รุ่นที่ 2 | รุ่นที่ 3 (ใช้งานจริง) |
|---|---|---|---|
| คลาส | 4 | 4 | 4 + โรคอื่น |
| Accuracy 4 คลาส (ชุดทดสอบ 761 ภาพ) | 75.43% | 97.90% | **96.85%** |
| ภาพ 4 คลาสที่ระบบตอบผล | — | 92.8% | **95.7%** |
| ภาพโรคอื่น 801 ภาพที่ได้ชื่อโรคผิด | — | 299 | **16** |
| ROC-AUC (4 คลาส) | — | 0.9992 | 0.9992 |

ข้อมูล: Paddy Doctor (Kaggle) 4 คลาส 5,069 ภาพ + โรคอื่น 6 ชนิด 5,338 ภาพ แบ่ง 70/15/15 แบบ stratified (seed 42) วิธีเทรน ผลรายคลาส และวิธีทำซ้ำอยู่ใน [`ai-service/training/README.md`](ai-service/training/README.md) การเปรียบเทียบกับโมเดลอื่น 5 สถาปัตยกรรมอยู่ใน [`ai-service/model-comparison/`](ai-service/model-comparison/README.md)

## เริ่มใช้งานในเครื่อง

ต้องมี Node.js 20+, Python 3.11+, Flutter 3.24 และ [Git LFS](https://git-lfs.com) (ไฟล์โมเดลเก็บผ่าน LFS)

```bash
git lfs install && git lfs pull

# 1) AI service
cd ai-service
pip install -r requirements.txt
python main.py                      # http://localhost:8000/health

# 2) Backend
cd backend
npm install
cp .env.example .env
npm run seed                        # ข้อมูลโรคและคำแนะนำ
npm start                           # http://localhost:4000

# 3) เว็บ
cd web
npm install
npm run dev                         # http://localhost:5173

# 4) แอปมือถือ
cd mobile
flutter pub get
flutter run --dart-define=API_BASE=http://<IP เครื่อง>:4000
```

### ตัวแปรที่ใช้

| ตัวแปร | ที่ | ค่าเริ่มต้น |
|---|---|---|
| `AI_SERVICE_URL` | backend | `http://localhost:8000` |
| `FIREBASE_PROJECT_ID` | backend | `rice-ai-appp` |
| `VITE_API_BASE` | web | `http://localhost:4000` |
| `API_BASE` (`--dart-define`) | mobile | ว่าง = วิเคราะห์บนเครื่องอย่างเดียว (รุ่นเบต้า) |
| `SEED_*_PASSWORD` | สคริปต์ seed | สุ่มให้ถ้าไม่ตั้ง |

ไม่มีรหัสผ่านหรือกุญแจลับใน repo นี้ ค่า Firebase ใน `web/src/lib/firebase.js` และ `mobile/android/app/google-services.json` เป็นค่าฝั่งไคลเอนต์ที่ต้องฝังในแอปอยู่แล้ว การเข้าถึงข้อมูลคุมด้วย `firestore.rules`

## Deploy

```bash
firebase deploy --only firestore        # rules + indexes
cd web && npm run build && cd .. && firebase deploy --only hosting
firebase deploy --only functions        # ต้องใช้แผน Blaze
```

## แอปรุ่นเบต้า

```bash
cd mobile
flutter build apk --release --split-per-abi --dart-define=API_BASE= --build-name=0.9.0
```

ไฟล์ APK เผยแพร่ที่ [rice-ai-beta Releases](https://github.com/BURHANJJ/rice-ai-beta/releases) และหน้าแรกของเว็บ ไม่เก็บไฟล์ APK ใน repo นี้

## ทดสอบ

```bash
cd mobile && flutter test                         # 9 tests
cd ai-service && python test_service.py <รูปใบข้าว>  # /health, ปฏิเสธภาพไม่ชัด, จำแนกภาพจริง
cd ai-service/training && python test_eval.py     # ประเมินชุดทดสอบ 761 ภาพ
```

## ข้อจำกัดที่รู้อยู่

- ภาพเทรนทั้งหมดมาจากนาในอินเดีย ผลกับนาไทยอาจต่างไป ระบบมีหน้าตรวจทานผล AI ไว้เก็บภาพจริงมาเทรนเพิ่ม
- Backend และ AI service ยังรันบนเครื่องพัฒนา ยังไม่ขึ้นคลาวด์
- 2FA (TOTP) ต้องอัปเกรดเป็น Identity Platform และ Push ทันทีต้องใช้แผน Blaze
- คอลเลกชัน `diagnoses` อ่านได้สาธารณะเพื่อแผนที่ระบาด ควรแยกสถิติสาธารณะออกในรุ่นถัดไป
