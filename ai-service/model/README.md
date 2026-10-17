# โฟลเดอร์โมเดลที่ใช้งาน

`main.py` โหลดไฟล์จากโฟลเดอร์นี้ตอนเริ่มทำงาน

| ไฟล์ | คืออะไร |
|---|---|
| `rice_disease_model.keras` | **รุ่นที่ 3 (ใช้งานอยู่)** EfficientNet-B0 5 คลาส รับภาพ RGB 224×224 ค่า 0–255 (ปรับค่าพิกเซลอยู่ในโมเดล) |
| `class_indices.json` | ลำดับคลาสของผลลัพธ์: `BLAST, BLB, TUNGRO, HEALTHY, OTHER` |
| `metrics.json` | ผลวัดบนชุดทดสอบ วิธีเลือกรุ่น และเกณฑ์ความมั่นใจ (`threshold`) ที่ `main.py` ใช้ |
| `rice_disease_model.v2.keras`, `metrics.v2.json` | รุ่นที่ 2 (4 คลาส) เก็บไว้ย้อนกลับ |
| `rice_disease_model.v1.keras` | รุ่นแรกจาก Colab ใช้เปรียบเทียบเท่านั้น |

`OTHER` ไม่เคยถูกส่งเป็นผลวินิจฉัย `main.py` ตอบ 400 `out_of_scope` พร้อมข้อความให้ปรึกษาเจ้าหน้าที่
ภาพที่ความมั่นใจต่ำกว่าเกณฑ์ใน `metrics.json` ตอบ 400 `low_confidence`

แอปมือถือใช้รุ่นเดียวกันที่แปลงเป็น TFLite อยู่ที่ `mobile/assets/model/` พร้อม `model_config.json` ที่มีเกณฑ์เดียวกัน

วิธีเทรนและติดตั้งรุ่นใหม่: [`../training/README.md`](../training/README.md)
