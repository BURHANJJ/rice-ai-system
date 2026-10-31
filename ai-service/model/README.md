# โมเดลต้นฉบับ

| ไฟล์ | คืออะไร |
|---|---|
| `rice_disease_model.keras` | **รุ่นที่ 3 (ใช้งานอยู่)** EfficientNet-B0 5 คลาส รับภาพ RGB 224×224 ค่า 0–255 (ปรับค่าพิกเซลอยู่ในโมเดล) |
| `class_indices.json` | ลำดับคลาสของผลลัพธ์: `BLAST, BLB, TUNGRO, HEALTHY, OTHER` |
| `metrics.json` | ผลวัดบนชุดทดสอบ วิธีเลือกรุ่น และเกณฑ์ความมั่นใจ (`threshold`) |
| `version_comparison.json` | เทียบ V1 · V2 · V3 บนชุดทดสอบเดียวกัน |
| `metrics.v2.json` | ผลวัดของรุ่นที่ 2 (4 คลาส) ไฟล์โมเดลรุ่นที่ 1 และ 2 ไม่ได้รวมอยู่ใน repo (ผลเทียบอยู่ใน `version_comparison.json`) ต้องการใช้ให้เทรนซ้ำตาม `../training/README.md` |

`OTHER` ไม่เคยถูกแสดงเป็นผลวินิจฉัย ทั้งแอปและเว็บจะบอกผู้ใช้ว่าอาจเป็นโรคที่ยังไม่รองรับ ภาพที่ความมั่นใจต่ำกว่าเกณฑ์ (60%) จะถูกขอให้ถ่ายใหม่

ระบบใช้โมเดลนี้ในรูปที่แปลงแล้ว: TFLite ในแอป (`mobile/assets/model/`) และ ONNX ในเว็บ (`web/public/models/rice-v3.onnx`) วิธีเทรนและแปลง: [`../training/README.md`](../training/README.md)
