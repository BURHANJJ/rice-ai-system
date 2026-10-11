import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:rice_ai_mobile/models/diagnosis.dart';

void main() {
  group('DiagnosisResult.fromJson', () {
    test('parses a server (/diagnosis/predict) response', () {
      final r = DiagnosisResult.fromJson({
        'diagnosis_id': 'abc123',
        'disease_name': 'โรคไหม้ (Rice Blast)',
        'disease_code': 'BLAST',
        'confidence': 96.4,
        'symptoms': 'แผลรูปตา',
        'cause': 'เชื้อรา',
        'advice': [
          {'treatment': 'ลดปุ๋ยไนโตรเจน', 'chemical_name': 'กลุ่ม triazole', 'dosage': 'ตามฉลาก'},
        ],
        'ai_source': 'ai-service',
        'location': {'latitude': 6.86, 'longitude': 101.25, 'province': 'ปัตตานี'},
      });
      expect(r.diseaseCode, 'BLAST');
      expect(r.confidence, 96.4);
      expect(r.advice.single.chemicalName, 'กลุ่ม triazole');
      expect(r.province, 'ปัตตานี');
    });

    test('accepts an integer confidence and missing optional fields', () {
      final r = DiagnosisResult.fromJson({
        'diagnosis_id': 'x', 'disease_name': 'ใบข้าวปกติ', 'disease_code': 'HEALTHY', 'confidence': 88,
      });
      expect(r.confidence, 88.0);
      expect(r.advice, isEmpty);
      expect(r.province, isNull);
    });

    test('keeps the on-device (offline) source and warning', () {
      final r = DiagnosisResult.fromJson({
        'diagnosis_id': 'y', 'disease_name': 'โรคใบสีส้ม', 'disease_code': 'TUNGRO', 'confidence': 91.2,
        'ai_source': 'on-device-tflite', 'ai_warning': 'วิเคราะห์บนเครื่อง', 'location': null,
      });
      expect(r.aiSource, 'on-device-tflite');
      expect(r.aiWarning, isNotNull);
    });
  });

  group('offline model assets', () {
    test('class order and disease data cover the same four classes', () {
      final labels = jsonDecode(File('assets/model/class_indices.json').readAsStringSync()) as Map<String, dynamic>;
      final diseases = jsonDecode(File('assets/model/diseases.json').readAsStringSync()) as Map<String, dynamic>;
      expect(List.generate(4, (i) => labels['$i']), ['BLAST', 'BLB', 'TUNGRO', 'HEALTHY']);
      for (final code in labels.values) {
        expect(diseases[code], isNotNull, reason: 'missing offline data for $code');
        expect((diseases[code]['advice'] as List), isNotEmpty);
      }
      expect(File('assets/model/rice_disease_model.tflite').lengthSync(), greaterThan(1000000));
    });
  });
}
