import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart' show rootBundle;
import 'package:image/image.dart' as img;
import 'package:tflite_flutter/tflite_flutter.dart';

import 'api_service.dart' show ApiException;

/// On-device fallback for when the Rice AI server cannot be reached (no signal in the paddy).
///
/// Runs the same EfficientNetB0 classifier as the server, converted to TensorFlow Lite
/// (float16). Input contract matches the server: RGB squashed to 224x224, raw 0–255 floats
/// (rescaling is inside the model). Output: softmax over the labels in class_indices.json:
/// [BLAST, BLB, TUNGRO, HEALTHY, OTHER] from model v3. OTHER (a leaf problem the app does not
/// cover yet) is never shown as a diagnosis; the user gets the same message as from the server.
class OfflineClassifier {
  OfflineClassifier._();
  static final OfflineClassifier instance = OfflineClassifier._();

  static const _modelAsset = 'assets/model/rice_disease_model.tflite';
  static const _labelsAsset = 'assets/model/class_indices.json';
  static const _diseasesAsset = 'assets/model/diseases.json';
  static const _size = 224;
  static const _configAsset = 'assets/model/model_config.json';

  /// Same cut-off as the server (model/metrics.json "threshold"): below this the photo is likely
  /// unclear or not a rice leaf. Shipped with each model in model_config.json; 75% if missing.
  double _minConfidence = 75.0;

  Interpreter? _interpreter;
  List<String> _labels = const ['BLAST', 'BLB', 'TUNGRO', 'HEALTHY'];
  Map<String, dynamic> _diseases = const {};

  Future<void> _ensureLoaded() async {
    if (_interpreter != null) return;
    _interpreter = await Interpreter.fromAsset(_modelAsset, options: InterpreterOptions()..threads = 4);
    final labels = jsonDecode(await rootBundle.loadString(_labelsAsset)) as Map<String, dynamic>;
    _labels = List.generate(labels.length, (i) => labels['$i'] as String);
    _diseases = jsonDecode(await rootBundle.loadString(_diseasesAsset)) as Map<String, dynamic>;
    try {
      final config = jsonDecode(await rootBundle.loadString(_configAsset)) as Map<String, dynamic>;
      final t = (config['min_confidence'] as num?)?.toDouble();
      if (t != null && t > 0 && t < 100) _minConfidence = t;
    } catch (_) {
      // Older model bundles have no config: keep the default cut-off.
    }
  }

  /// Classifies [bytes] and returns a map shaped like the server's /diagnosis/predict response,
  /// so the scan screen can save and show it the same way.
  Future<Map<String, dynamic>> diagnose(Uint8List bytes) async {
    await _ensureLoaded();
    final sw = Stopwatch()..start();
    final prepared = await compute(_prepare, bytes);
    final output = List.generate(1, (_) => List.filled(_labels.length, 0.0));
    _interpreter!.run(prepared.input.reshape([1, _size, _size, 3]), output);
    final probs = output.first;
    var best = 0;
    for (var i = 1; i < probs.length; i++) {
      if (probs[i] > probs[best]) best = i;
    }
    final confidence = double.parse((probs[best] * 100).toStringAsFixed(2));
    if (confidence < _minConfidence) {
      throw ApiException(400, 'low_confidence', 'ภาพไม่ชัดเจน หรือไม่ใช่ใบข้าว กรุณาถ่ายภาพใบข้าวให้ชัดเจนอีกครั้ง');
    }
    final code = _labels[best];
    if (code == 'OTHER') {
      throw ApiException(400, 'out_of_scope',
          'ภาพนี้อาจเป็นโรคหรืออาการอื่นที่ระบบยังไม่รองรับ ระบบวิเคราะห์ได้เฉพาะโรคไหม้ โรคขอบใบแห้ง โรคใบสีส้ม และใบปกติ กรุณาปรึกษาเจ้าหน้าที่ส่งเสริมการเกษตร');
    }
    final d = (_diseases[code] as Map<String, dynamic>?) ?? {};
    return {
      'compressed_base64': prepared.jpegBase64,
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
      'ai_source': 'on-device-tflite',
      'ai_warning': 'วิเคราะห์บนเครื่องเนื่องจากเชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ผลจะซิงก์ขึ้นระบบเมื่อมีอินเทอร์เน็ต',
      'elapsed_ms': sw.elapsedMilliseconds,
    };
  }
}

class _Prepared {
  _Prepared(this.input, this.jpegBase64);
  final Float32List input;
  final String jpegBase64;
}

/// Runs in a background isolate: decode, build the model input, and make the
/// same ≤800 px JPEG (quality 60) the server would store in Firestore.
_Prepared _prepare(Uint8List bytes) {
  final decoded = img.decodeImage(bytes);
  if (decoded == null) throw const FormatException('ไม่สามารถอ่านไฟล์ภาพได้');
  final oriented = img.bakeOrientation(decoded);
  final resized = img.copyResize(oriented, width: OfflineClassifier._size, height: OfflineClassifier._size, interpolation: img.Interpolation.linear);
  final input = Float32List(OfflineClassifier._size * OfflineClassifier._size * 3);
  var k = 0;
  for (final p in resized) {
    input[k++] = p.r.toDouble();
    input[k++] = p.g.toDouble();
    input[k++] = p.b.toDouble();
  }
  final longest = oriented.width > oriented.height ? oriented.width : oriented.height;
  final small = longest > 800
      ? img.copyResize(oriented, width: oriented.width >= oriented.height ? 800 : null, height: oriented.height > oriented.width ? 800 : null)
      : oriented;
  return _Prepared(input, base64Encode(img.encodeJpg(small, quality: 60)));
}
