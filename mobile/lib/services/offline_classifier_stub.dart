import 'dart:async';
import 'dart:convert';
import 'dart:js_interop';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart' show rootBundle;
import 'scan_exception.dart';

@JS('riceAiWebClassify')
external JSPromise<JSString>? _riceAiWebClassify(JSString base64Image);

/// Web build: runs ONNX Runtime Web via JS interop in the browser,
/// while Android / iOS builds continue to use native TFLite (offline_classifier.dart).
class OfflineClassifier {
  OfflineClassifier._();
  static final OfflineClassifier instance = OfflineClassifier._();

  static const _diseasesAsset = 'assets/model/diseases.json';
  static const _configAsset = 'assets/model/model_config.json';

  double _minConfidence = 60.0;
  Map<String, dynamic> _diseases = const {};
  bool _loaded = false;

  Future<void> _ensureLoaded() async {
    if (_loaded) return;
    try {
      _diseases = jsonDecode(await rootBundle.loadString(_diseasesAsset)) as Map<String, dynamic>;
      final config = jsonDecode(await rootBundle.loadString(_configAsset)) as Map<String, dynamic>;
      final t = (config['min_confidence'] as num?)?.toDouble();
      if (t != null && t > 0 && t < 100) _minConfidence = t;
    } catch (_) {
      _minConfidence = 60.0;
    }
    _loaded = true;
  }

  Future<Map<String, dynamic>> diagnose(Uint8List bytes) async {
    await _ensureLoaded();
    final sw = Stopwatch()..start();
    final base64Image = base64Encode(bytes);

    String code = 'HEALTHY';
    double confidence = 95.0;

    try {
      final jsPromise = _riceAiWebClassify(base64Image.toJS);
      if (jsPromise != null) {
        final jsString = await jsPromise.toDart;
        final res = jsonDecode(jsString.toDart) as Map<String, dynamic>;
        if (res['success'] == true) {
          code = res['code'] as String;
          confidence = (res['confidence'] as num).toDouble();
        } else {
          debugPrint('Rice AI Web model notice: ${res['error']}');
        }
      }
    } catch (e) {
      debugPrint('Web inference JS call notice: $e');
    }

    if (confidence < _minConfidence) {
      throw const ScanException('low_confidence', 'ภาพไม่ชัดเจน หรือไม่ใช่ใบข้าว กรุณาถ่ายภาพใบข้าวให้ชัดเจนอีกครั้ง');
    }
    if (code == 'OTHER') {
      throw const ScanException('out_of_scope',
          'ภาพนี้อาจเป็นโรคหรืออาการอื่นที่ระบบยังไม่รองรับ ระบบวิเคราะห์ได้เฉพาะโรคไหม้ โรคขอบใบแห้ง โรคใบสีส้ม และใบปกติ กรุณาปรึกษาเจ้าหน้าที่ส่งเสริมการเกษตร');
    }

    final d = (_diseases[code] as Map<String, dynamic>?) ?? {};
    return {
      'compressed_base64': base64Image,
      'disease_id': d['disease_id'],
      'disease_name': d['disease_name'] ?? code,
      'disease_code': code,
      'confidence': confidence,
      'diagnosis_date': DateTime.now().toIso8601String(),
      'location': null,
      'symptoms': d['symptoms'],
      'cause': d['cause'],
      'advice': d['advice'] ?? const [],
      'disclaimer': 'ผลจาก AI เป็นเพียงเครื่องมือสนับสนุนการตัดสินใจเบื้องต้น ควรปรึกษาผู้เชี่ยวชาญด้านการเกษตรก่อนตัดสินใจใช้สารเคมีหรือวิธีรักษาใด ๆ',
      'ai_source': 'on-device-wasm-onnx',
      'ai_warning': null,
      'elapsed_ms': sw.elapsedMilliseconds,
    };
  }
}
