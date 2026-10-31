# ร่วมพัฒนา

ขอบคุณที่สนใจ Rice AI โครงงานนี้ดูแลโดยนักศึกษา รับทั้ง Issue และ Pull Request

## เริ่มต้น

ตั้งค่าโปรเจกต์ Firebase ของตัวเองตาม [docs/SETUP.md](docs/SETUP.md) ก่อน repo นี้ไม่มีค่าตั้งค่าของโปรเจกต์จริงและจะไม่มีวันมี

## เปิดด่านกันข้อมูลหลุด (ทำครั้งเดียวต่อเครื่อง)

```bash
node scripts/install-hooks.mjs
```

คำสั่งนี้เปิด git hook ที่ตรวจทุกครั้งก่อน `commit` และก่อน `push` (ทั้งจากเทอร์มินัลและปุ่ม Commit/Sync ในโปรแกรมแก้โค้ด) แล้วบล็อกถ้าเจอ: ไฟล์ที่ห้ามขึ้นสาธารณะ (รายงาน วิดีโอ เอกสาร PDF/Word ไฟล์ตั้งค่า Firebase จริง กุญแจ ไฟล์สำรอง) · สิ่งใหม่ที่ราก repo ซึ่งไม่อยู่ในรายการอนุญาต · ไฟล์เกิน 25 MB · กุญแจหรือรหัสผ่านในเนื้อหา · อีเมลส่วนตัวเป็นผู้เขียน commit (ต้องใช้ `<id>+<user>@users.noreply.github.com`) · ตรวจซ้ำบน GitHub ทุก push ในงาน `leak-check` ของ CI รายละเอียดกฎอยู่ใน [`scripts/check-leaks.mjs`](scripts/check-leaks.mjs)

## ก่อนเปิด Pull Request

```bash
cd web && npm run lint && npm run build          # เว็บ
cd mobile && flutter analyze && flutter test      # แอป
cd tests/firestore && npm test                    # ถ้าแตะ firestore.rules (ต้องมี Java)
```

- แก้ `firestore.rules` ต้องเพิ่มหรืออัปเดตข้อทดสอบใน `tests/firestore/rules.test.mjs` ด้วย การเปิดสิทธิ์ให้มากขึ้นต้องอธิบายเหตุผลใน PR
- ตัวเลขผลโมเดลที่ปรากฏในเว็บและเอกสาร (ความแม่นยำ ขนาดไฟล์ จำนวนภาพ) ต้องตรงกับ `ai-service/model/metrics.json` และ `ai-service/model-comparison/results/` ถ้าเปลี่ยนโมเดลให้ทำตามหัวข้อ "เอาโมเดลใหม่ไปใช้" ใน [`ai-service/training/README.md`](ai-service/training/README.md)
- ข้อความบนหน้าจอมีสองภาษา (ไทย/อังกฤษ) ใน `web/src/lib/i18n.jsx` และไฟล์ข้อความของแต่ละหน้า แก้ทั้งสองภาษา
- อย่า commit กุญแจ รหัสผ่าน ไฟล์ `.env*` หรือไฟล์โมเดลรุ่นทดลองขนาดใหญ่ ดู [SECURITY.md](SECURITY.md)

## ข้อความ commit

เขียนเป็นประโยคบอกว่าเปลี่ยนอะไรและทำไม เช่น `Hide the trial-scan counter when localStorage is blocked` แยก commit ตามเรื่อง

## แจ้งช่องโหว่

อย่าเปิด Issue สาธารณะ ดู [SECURITY.md](SECURITY.md)
