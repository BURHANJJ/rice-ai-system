import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:geolocator/geolocator.dart';

class LocationHelper {
  /// แปลงพิกัดละติจูด/ลองจิจูด เป็นชื่อ ตำบล อำเภอ จังหวัด (ภาษาไทย) แบบมืออาชีพ
  /// โดยใช้ OpenStreetMap Nominatim API ซึ่งทำงานได้ทุกแพลตฟอร์ม (รวมถึง Web)
  static Future<String> getThaiAddress(Position pos) async {
    try {
      final url = Uri.parse(
          'https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.latitude}&lon=${pos.longitude}&zoom=18&addressdetails=1&accept-language=th');
      final response = await http.get(url, headers: {
        'User-Agent': 'RiceAISystem/1.0',
      }).timeout(const Duration(seconds: 5));

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data != null && data['address'] != null) {
          final addr = data['address'];
          
          final subdistrict = addr['suburb'] ?? addr['village'] ?? addr['neighbourhood'] ?? addr['town'] ?? addr['hamlet'] ?? '';
          final district = addr['county'] ?? addr['city_district'] ?? addr['district'] ?? '';
          final province = addr['state'] ?? addr['province'] ?? addr['city'] ?? '';
          
          String cleanSubdistrict(String s) {
            s = s.replaceAll('ตำบล', '').replaceAll('แขวง', '').replaceAll('ต.', '').replaceAll('จ.', '').trim();
            return s.isNotEmpty ? 'ต.$s' : '';
          }
          
          String cleanDistrict(String s) {
            s = s.replaceAll('อำเภอ', '').replaceAll('เขต', '').replaceAll('อ.', '').trim();
            return s.isNotEmpty ? 'อ.$s' : '';
          }
          
          String cleanProvince(String s) {
            s = s.replaceAll('จังหวัด', '').replaceAll('จ.', '').trim();
            return s.isNotEmpty ? 'จ.$s' : '';
          }
          
          List<String> parts = [];
          if (subdistrict.isNotEmpty) {
            final cleaned = cleanSubdistrict(subdistrict);
            if (cleaned.isNotEmpty) parts.add(cleaned);
          }
          if (district.isNotEmpty) {
            final cleaned = cleanDistrict(district);
            if (cleaned.isNotEmpty) parts.add(cleaned);
          }
          if (province.isNotEmpty) {
            final cleaned = cleanProvince(province);
            if (cleaned.isNotEmpty) parts.add(cleaned);
          }
          
          if (parts.isNotEmpty) {
            return parts.join(' ');
          }
        }
      }
    } catch (e) {
      // Return null or generic on failure
    }
    return 'พิกัดปัจจุบัน'; // Fallback
  }
}
