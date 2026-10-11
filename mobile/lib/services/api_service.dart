import 'dart:async';
import 'dart:convert';
import 'package:http_parser/http_parser.dart';
import 'dart:io';
import 'package:meta/meta.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:http/http.dart' as http;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';

/// Central HTTP client for the Rice AI backend.
///
/// Base URL notes (handoff section 21 architecture):
/// - Android emulator -> host machine: http://10.0.2.2:4000
/// - iOS simulator -> host machine: http://localhost:4000
/// - Physical device -> your machine's LAN IP, e.g. http://192.168.x.x:4000
/// Override via --dart-define=API_BASE=http://<host>:4000 at build/run time.
class ApiException implements Exception {
  final int statusCode;
  final String error;
  final String? message;
  ApiException(this.statusCode, this.error, this.message);
  @override
  String toString() => message ?? error;
}

class ApiService {
  ApiService._({http.Client? client})
      : _client = client ?? http.Client(),
        _storage = const FlutterSecureStorage();

  static final ApiService instance = ApiService._();

  /// Visible for testing: allows injecting a mock client or storage.
  @visibleForTesting
  ApiService.internal({http.Client? client, FlutterSecureStorage? storage})
      : _client = client ?? http.Client(),
        _storage = storage ?? const FlutterSecureStorage();

  static const String _defaultBase = String.fromEnvironment(
    'API_BASE',
    defaultValue: kIsWeb ? 'http://localhost:4000' : 'http://10.0.2.2:4000',
  );

  /// Beta builds pass `--dart-define=API_BASE=` (empty): there is no public AI server yet,
  /// so the app classifies on the phone with the bundled TFLite model.
  static bool get hasServer => kIsWeb || _defaultBase.isNotEmpty;

  final http.Client _client;
  final FlutterSecureStorage _storage;

  String get baseUrl {
    if (kIsWeb) return 'http://localhost:4000';
    return _defaultBase;
  }

  Future<String?> get _token async {
    // Priority 1: Live Firebase ID Token (auto-refreshed by SDK)
    // No Firebase app in unit tests -> fall back to the stored token.
    final firebaseUser = Firebase.apps.isEmpty ? null : FirebaseAuth.instance.currentUser;
    if (firebaseUser != null) {
      return firebaseUser.getIdToken();
    }
    // Priority 2: Stored token (for legacy/other auth flows)
    return _storage.read(key: 'rice_ai_token');
  }

  Future<void> saveToken(String token) => _storage.write(key: 'rice_ai_token', value: token);
  Future<void> clearToken() => _storage.delete(key: 'rice_ai_token');

  Future<Map<String, String>> _headers({bool json = true}) async {
    final token = await _token;
    return {
      if (json) 'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  dynamic _decode(http.Response res) {
    final body = res.body.isNotEmpty ? jsonDecode(res.body) : {};
    if (res.statusCode >= 200 && res.statusCode < 300) return body;
    throw ApiException(res.statusCode, body['error'] ?? 'unknown_error', body['message']);
  }

  Future<dynamic> get(String path, {Map<String, String>? query}) async {
    final uri = Uri.parse('$baseUrl$path').replace(queryParameters: query);
    final res = await _client.get(uri, headers: await _headers());
    return _decode(res);
  }

  Future<dynamic> post(String path, {Map<String, dynamic>? body}) async {
    final uri = Uri.parse('$baseUrl$path');
    final res = await _client.post(uri, headers: await _headers(), body: body != null ? jsonEncode(body) : null);
    return _decode(res);
  }

  Future<dynamic> patch(String path, {Map<String, dynamic>? body}) async {
    final uri = Uri.parse('$baseUrl$path');
    final res = await _client.patch(uri, headers: await _headers(), body: body != null ? jsonEncode(body) : null);
    return _decode(res);
  }

  /// Multipart upload for /diagnosis/predict (image + optional GPS).
  Future<dynamic> uploadImage(
    String path,
    List<int> imageBytes,
    String filename, {
    double? latitude,
    double? longitude,
    String? placeName,
  }) async {
    final uri = Uri.parse('$baseUrl$path');
    final request = http.MultipartRequest('POST', uri);
    final token = await _token;
    if (token != null) request.headers['Authorization'] = 'Bearer $token';
    final ext = filename.toLowerCase().endsWith('.png') ? 'png' : 'jpeg';
    request.files.add(http.MultipartFile.fromBytes(
      'image',
      imageBytes,
      filename: filename,
      contentType: MediaType('image', ext),
    ));
    if (latitude != null) request.fields['latitude'] = latitude.toString();
    if (longitude != null) request.fields['longitude'] = longitude.toString();
    if (placeName != null) request.fields['place_name'] = placeName;

    // A scan should not hang on a weak signal; the scan screen falls back to the on-device model.
    final streamed = await _client.send(request).timeout(const Duration(seconds: 25));
    final res = await http.Response.fromStream(streamed);
    return _decode(res);
  }
}
