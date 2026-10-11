import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:mocktail/mocktail.dart';
import 'package:rice_ai_mobile/services/api_service.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class MockClient extends Mock implements http.Client {}
class MockStorage extends Mock implements FlutterSecureStorage {}

void main() {
  late MockClient client;
  late MockStorage storage;
  late ApiService api;

  setUp(() {
    client = MockClient();
    storage = MockStorage();
    api = ApiService.internal(client: client, storage: storage);
    
    // Default setup: no token
    when(() => storage.read(key: any(named: 'key'))).thenAnswer((_) async => null);
    
    // Register fallback for Uri
    registerFallbackValue(Uri.parse('http://localhost'));
  });

  group('ApiService - GET', () {
    test('returns decoded JSON on success (200)', () async {
      final responseBody = {'success': true, 'data': 'test'};
      when(() => client.get(any(), headers: any(named: 'headers')))
          .thenAnswer((_) async => http.Response(jsonEncode(responseBody), 200));

      final result = await api.get('/test');

      expect(result, responseBody);
      verify(() => client.get(any(), headers: any(named: 'headers'))).called(1);
    });

    test('throws ApiException on error (404)', () async {
      when(() => client.get(any(), headers: any(named: 'headers')))
          .thenAnswer((_) async => http.Response(jsonEncode({'error': 'not_found'}), 404));

      expect(() => api.get('/invalid'), throwsA(isA<ApiException>()));
    });
  });

  group('ApiService - Auth', () {
    test('includes Bearer token in headers if present', () async {
      when(() => storage.read(key: 'rice_ai_token')).thenAnswer((_) async => 'fake_token');
      when(() => client.get(any(), headers: any(named: 'headers')))
          .thenAnswer((_) async => http.Response('{}', 200));

      await api.get('/test');

      final capturedHeaders = verify(() => client.get(any(), headers: captureAny(named: 'headers'))).captured.first as Map<String, String>;
      expect(capturedHeaders['Authorization'], 'Bearer fake_token');
    });
  });
}
