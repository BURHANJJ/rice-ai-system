import 'package:flutter/foundation.dart';

/// Web build: TensorFlow Lite needs dart:ffi, so on-device inference is Android/iOS only.
class OfflineClassifier {
  OfflineClassifier._();
  static final OfflineClassifier instance = OfflineClassifier._();

  Future<Map<String, dynamic>> diagnose(Uint8List bytes) async =>
      throw UnsupportedError('การวิเคราะห์บนเครื่องรองรับเฉพาะแอป Android / iOS');
}
