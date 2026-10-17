# Rice AI — แอปมือถือ (Flutter)

แอปสำหรับเกษตรกร: ถ่ายรูปใบข้าวแล้วรู้ผลโรคพร้อมคำแนะนำจากกรมการข้าว ดูประวัติ แผนที่ระบาด 3 มิติ คลังโรค สมุดแปลงนา สภาพอากาศ และรับประกาศเตือนการระบาด

- **AI บนเครื่อง**: โมเดล V3 (TensorFlow Lite) อยู่ใน `assets/model/` สแกนได้แม้ไม่มีสัญญาณ ภาพไม่ถูกส่งออกจากเครื่อง
- **ข้อมูล**: Firebase Auth + Firestore โดยตรง ไม่มีเซิร์ฟเวอร์กลาง ผลที่บันทึกตอนไม่มีเน็ตจะซิงก์เองเมื่อมีสัญญาณ
- **แจ้งเตือน**: FCM + ตรวจกล่องแจ้งเตือนเบื้องหลังทุกราว 15 นาที

## รันและ build

```bash
flutter pub get
flutter run                                                        # เครื่องจริงหรือ emulator
flutter build apk --release --split-per-abi --build-name=0.9.4 --build-number=6
flutter test
```

`--build-name` คือเลขที่แอปแสดงในหน้าเปิดแอปและโปรไฟล์ `--build-number` ต้องมากกว่ารุ่นก่อนทุกครั้ง ไม่งั้นติดตั้งทับไม่ได้

## โครงสร้าง

```
lib/
  main.dart                    เริ่มแอป: Firebase, เลขเวอร์ชัน, การแจ้งเตือน, เลือกหน้าแรก
  theme/ · widgets/            โทนสี ฟอนต์ และชุด UI ที่ใช้ร่วมกัน (AppButton, AppToast, Ricey ฯลฯ)
  services/
    offline_classifier.dart    โมเดล TFLite: เตรียมภาพ 224×224 ทำนาย และย่อภาพ ≤800 px สำหรับบันทึก
    scan_exception.dart        เหตุที่สแกนไม่ได้ผล: ภาพไม่ชัด / โรคที่ยังไม่รองรับ
    auth_provider.dart         เข้าสู่ระบบ สมัคร Google 2FA ออกจากระบบ
    notification_service.dart  FCM และการตรวจประกาศเบื้องหลัง
    field_service.dart · weather_service.dart · location_helper.dart · app_version.dart
  models/                      DiagnosisResult, RiceField ฯลฯ
  screens/
    scan/                      ถ่ายหรือเลือกภาพ วิเคราะห์ ผล การ์ดแจ้งปัญหา และหน้าสรุปหลังบันทึก
    home/ · outbreak/ · wiki/ · fields/ · history/ · profile/ · auth/ · onboarding_screen.dart
assets/model/                  rice_disease_model.tflite · class_indices.json · diseases.json · model_config.json
```

โมเดลต้นฉบับและวิธีเทรนอยู่ที่ [`../ai-service/`](../ai-service/README.md)
