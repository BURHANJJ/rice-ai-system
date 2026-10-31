# คู่มือติดตั้ง Rice AI เป็นของตัวเอง

คู่มือนี้พาตั้งแต่ clone ไปจนถึงรันเว็บ แอป และพอร์ทัลผู้ดูแลบนโปรเจกต์ Firebase ของคุณเอง ใช้แผนฟรี (Spark) ได้ทั้งหมด ยกเว้น Push แจ้งเตือนและแชทบอทโหมด AI ที่ต้องใช้ฟังก์ชันบนแผน Blaze (ไม่บังคับ)

repo นี้**ไม่มี**กุญแจ รหัสผ่าน หรือค่าตั้งค่าของโปรเจกต์จริง ทุกอย่างที่เป็นของโปรเจกต์ต้องสร้างและใส่เอง ตามด้านล่าง

## สิ่งที่ต้องมี

| เครื่องมือ | รุ่น | ใช้กับ |
|---|---|---|
| Node.js | 20 ขึ้นไป | เว็บ ฟังก์ชัน สคริปต์ ชุดทดสอบ |
| Firebase CLI | รุ่นล่าสุด (`npm i -g firebase-tools`) | ส่งกฎ ส่งเว็บ ส่งฟังก์ชัน |
| Flutter | 3.24.x | แอปมือถือ |
| Java | 21 ขึ้นไป | รัน Firestore Emulator ในชุดทดสอบกฎ |
| Python | 3.11 ขึ้นไป | เฉพาะถ้าจะเทรนโมเดลเอง |

## 1. สร้างโปรเจกต์ Firebase

1. เปิด [Firebase console](https://console.firebase.google.com) แล้วสร้างโปรเจกต์ใหม่ (จะปิด Google Analytics ก็ได้)
2. **Authentication** → Sign-in method → เปิด **Email/Password** และ **Google**
3. **Firestore Database** → Create database → เลือก production mode และตำแหน่ง **asia-southeast1 (สิงคโปร์)** ตำแหน่งแก้ภายหลังไม่ได้ และฟังก์ชันใน repo นี้ตั้งไว้ที่ภูมิภาคเดียวกัน
4. **Hosting** → Get started (ใช้ส่งเว็บ)
5. ผูก repo กับโปรเจกต์ของคุณ: แก้ `.firebaserc` เป็น project id ของคุณ หรือรัน `firebase use --add`

## 2. ส่งกฎความปลอดภัย

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

กฎใน [`firestore.rules`](../firestore.rules) คือด่านป้องกันข้อมูลทั้งหมด (ค่า Firebase ฝั่งไคลเอนต์ไม่ใช่ความลับ) **ต้องส่งกฎก่อนเปิดให้ใครใช้** ถ้าไม่ส่ง Firestore จะอยู่ในโหมดทดสอบหรือปิดทั้งหมดแล้วแต่ตอนสร้าง

## 3. เว็บ

1. Firebase console → Project settings → Your apps → **Web app** (`</>`) → ลงทะเบียนแล้วคัดลอกค่า `firebaseConfig`
2. ใส่ใน `web/.env.local`:

```bash
cd web
cp .env.example .env.local     # แล้วกรอกค่า VITE_FIREBASE_* ให้ครบ
npm ci
npm run dev                    # http://localhost:5173
```

ถ้าขาดค่าใด หน้าเว็บจะว่างและ console จะขึ้น `Missing Firebase config: …` บอกว่าขาดอะไร

ส่งเว็บขึ้น Hosting:

```bash
npm run build
cd .. && firebase deploy --only hosting
```

> วิดีโอแนะนำบนหน้าแรกและหน้า `/research-study` ไม่ได้อยู่ใน repo (ไฟล์ `web/public/media/`) เว็บจะแสดงข้อความแทนที่ ถ้าอยากมีวิดีโอ ให้ใส่ไฟล์ชื่อ `rice-ai-promo-720p.mp4` และ `rice-ai-model-explainer-720p.mp4` พร้อมภาพ poster ในโฟลเดอร์นั้น

## 4. ตั้งผู้ดูแลระบบคนแรก

ไม่มีใครตั้งตัวเองเป็นผู้ดูแลระบบได้จากหน้าเว็บหรือแอป (กฎไม่อนุญาต) ต้องตั้งด้วย Admin SDK:

1. Authentication → Users → **Add user** สร้างบัญชีอีเมล+รหัสผ่านของคุณ
2. Project settings → **Service accounts** → Generate new private key ได้ไฟล์ JSON **เก็บไว้เป็นความลับ** เป็นกุญแจสิทธิ์เต็มของโปรเจกต์ ห้าม commit (`.gitignore` กันไว้ให้แล้ว) และลบทิ้งเมื่อใช้เสร็จ
3. รัน:

```bash
cd scripts
npm ci
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json     # Windows PowerShell: $env:GOOGLE_APPLICATION_CREDENTIALS="C:\path\key.json"
node make-admin.mjs you@example.com
```

จากนั้นเข้าสู่ระบบที่ `/login` ผู้ดูแลระบบอนุมัติบัญชีนักวิชาการ (ที่สมัครผ่าน `/apply-researcher`) ได้ที่ `/admin/approvals`

## 5. แอปมือถือ

```bash
cd mobile
dart pub global activate flutterfire_cli
flutterfire configure --project=<project-id>      # สร้าง lib/firebase_options.dart และ android/app/google-services.json
flutter pub get
flutter run
```

ไฟล์ทั้งสองไม่ถูก commit (อยู่ใน `.gitignore`) มีตัวอย่างโครงสร้างที่ [`firebase_options.dart.example`](../mobile/lib/firebase_options.dart.example) และ [`google-services.json.example`](../mobile/android/app/google-services.json.example)

- **Google Sign-In บน Android** ต้องเพิ่มลายนิ้วมือ SHA-1 ของคีย์ที่ใช้เซ็นแอปใน Firebase console (Project settings → Your apps → Android → Add fingerprint) ดูของเครื่องคุณด้วย `cd mobile/android && ./gradlew signingReport` ถ้าขึ้น `DEVELOPER_ERROR` แปลว่าลืมขั้นนี้
- **เปลี่ยนชื่อแพ็กเกจ** `com.example.rice_ai_mobile` (Android) และ `com.example.riceAiMobile` (iOS) เป็นของคุณก่อนเผยแพร่จริง แล้วลงทะเบียนแอปใน Firebase ด้วยชื่อใหม่
- **เซ็นแอปรุ่นเผยแพร่**: ตอนนี้ `flutter build apk --release` เซ็นด้วยคีย์ debug (ค่าเริ่มต้นของ Flutter ใน `mobile/android/app/build.gradle`) เหมาะกับแจกทดสอบเท่านั้น ก่อนขึ้น Google Play ให้สร้าง keystore ของคุณเอง เก็บไว้นอก repo และตั้ง `key.properties` (ถูก ignore ไว้แล้ว)
- ถ้าจะ build เป็น Flutter web ที่ใช้ Google Sign-In ให้แก้ OAuth client id ใน `mobile/lib/services/auth_provider.dart` และ `mobile/web/index.html` เป็นของโปรเจกต์คุณ

สร้างไฟล์ติดตั้ง:

```bash
flutter build apk --release --split-per-abi --build-name=1.0.0 --build-number=1
```

## 6. ฟังก์ชันคลาวด์ (ไม่บังคับ ต้องใช้แผน Blaze)

| ฟังก์ชัน | ทำอะไร | ส่งด้วย |
|---|---|---|
| `sendBroadcastPush` | ส่ง Push เมื่อผู้ดูแลระบบประกาศแจ้งเตือนการระบาด | `firebase deploy --only functions:sendBroadcastPush` |
| `chat` | ให้น้องข้าวหอมตอบด้วย Claude แทนคลังความรู้ในเว็บ | ดูด้านล่าง |

ไม่ส่งฟังก์ชัน ระบบก็ใช้งานได้ (แชทบอทตอบจากคลังความรู้ในเว็บเอง)

เปิดแชทบอทโหมด AI:

```bash
cd functions && npm ci && cd ..
firebase functions:secrets:set ANTHROPIC_API_KEY        # วางกุญแจ ระบบเก็บเป็น Secret ไม่อยู่ในโค้ด
firebase deploy --only functions:chat
# แล้วใส่ URL ของฟังก์ชันใน web/.env.local ที่ VITE_CHAT_URL แล้ว build เว็บใหม่
```

แก้รายการโดเมนที่อนุญาต (`cors`) ใน [`functions/index.js`](../functions/index.js) ให้เป็นโดเมนเว็บของคุณก่อน ตอนนี้ตั้งไว้ที่โดเมนของเว็บต้นฉบับ ฟังก์ชันจำกัด 20 คำถามต่อ IP ต่อ 10 นาที และไม่เกิน 5 instance แต่ควรตั้ง budget alert ใน Google Cloud ไว้ด้วย

## 7. โมเดล AI

ไฟล์โมเดลที่เทรนแล้วอยู่ใน repo พร้อมใช้ ไม่ต้องทำอะไร

| ไฟล์ | ใช้ที่ |
|---|---|
| `mobile/assets/model/rice_disease_model.tflite` (+ `class_indices.json`, `model_config.json`) | แอปมือถือ |
| `web/public/models/rice-v3.onnx` | เว็บ (ทดลองสแกน และสแกนในพอร์ทัล) |
| `ai-service/model/rice_disease_model.keras` | โมเดลต้นฉบับ ใช้แปลงและประเมิน |

เทรนเองหรือเปลี่ยนโมเดล: ดาวน์โหลดชุดข้อมูล **Paddy Doctor** จาก Kaggle ตามเงื่อนไขของผู้เผยแพร่ ไม่ได้แจกจ่ายใน repo นี้ แล้วทำตาม [`ai-service/training/README.md`](../ai-service/training/README.md) (ตั้งตัวแปร `RICE_EVAL_DIR` ชี้ไปที่โฟลเดอร์เก็บภาพ) หลังได้โมเดลใหม่ ต้องวางไฟล์ 3 ที่ตามตารางด้านบน และอัปเดตเกณฑ์ความมั่นใจ ขั้นตอนอยู่ในหัวข้อ "เอาโมเดลใหม่ไปใช้" ของไฟล์เดียวกัน

## 8. ทดสอบ

```bash
cd tests/firestore && npm ci && npm test        # กฎความปลอดภัย 24 ข้อ (ต้องมี Java)
cd web && npm run lint && npm run build
cd mobile && flutter analyze && flutter test
```

## ก่อนเปิดให้คนอื่นใช้จริง

- [ ] ส่ง `firestore.rules` แล้ว และ `npm test` ใน `tests/firestore` ผ่าน
- [ ] จำกัด API key ใน Google Cloud console → APIs & Services → Credentials: key ของเว็บจำกัดตาม HTTP referrer (โดเมนเว็บ + `localhost`) key ของ Android จำกัดตามชื่อแพ็กเกจ + SHA-1 และจำกัดให้เรียกได้เฉพาะ API ของ Firebase ที่ใช้ (key ฝั่งไคลเอนต์ไม่ใช่ความลับ แต่ควรจำกัด)
- [ ] เปิด [App Check](https://firebase.google.com/docs/app-check) เพื่อให้เฉพาะแอปและเว็บของคุณเรียก Firestore/Auth ได้
- [ ] ตั้ง Budget alert ใน Google Cloud (โดยเฉพาะถ้าเปิดฟังก์ชัน)
- [ ] Authentication → Settings → Authorized domains ให้เหลือเฉพาะโดเมนของคุณ
- [ ] ลบไฟล์ service account ที่ใช้ตั้งผู้ดูแลระบบ และไม่เก็บไว้ใน repo หรือแชท
- [ ] อ่านหัวข้อ "ข้อจำกัดที่รู้อยู่" ใน [SECURITY.md](../SECURITY.md) โดยเฉพาะเรื่องข้อมูลการสแกนที่อ่านได้สาธารณะ และตัดสินใจก่อนเก็บข้อมูลผู้ใช้จริง
- [ ] แก้อีเมลติดต่อในหน้านโยบายความเป็นส่วนตัว (`web/src/lib/legalContent.js`) เป็นของคุณ

## ปัญหาที่เจอบ่อย

| อาการ | สาเหตุและวิธีแก้ |
|---|---|
| เว็บขาว console ขึ้น `Missing Firebase config` | ยังไม่มี `web/.env.local` หรือกรอกไม่ครบ |
| `permission-denied` ทุกที่ | ยังไม่ได้ส่งกฎ (ข้อ 2) หรือยังไม่ได้ล็อกอิน |
| บัญชีที่เพิ่งสร้างเข้าพอร์ทัลไม่ได้ | นักวิชาการต้องรอผู้ดูแลอนุมัติ ผู้ดูแลระบบต้องตั้งด้วย `make-admin.mjs` (ข้อ 4) |
| Google Sign-In บนแอปขึ้น `DEVELOPER_ERROR` | ยังไม่ได้เพิ่ม SHA-1 ใน Firebase console (ข้อ 5) |
| `flutter analyze` ฟ้องว่าไม่มี `firebase_options.dart` | รัน `flutterfire configure` หรือคัดลอกจาก `.example` แล้วแก้ค่า |
| `firebase deploy` ขึ้นว่าไม่มีสิทธิ์ | `.firebaserc` ยังชี้ไปที่โปรเจกต์ต้นฉบับ แก้เป็นของคุณ |
