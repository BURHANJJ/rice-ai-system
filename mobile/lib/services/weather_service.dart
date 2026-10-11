import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:remixicon/remixicon.dart';
import 'package:flutter/widgets.dart' show IconData;

/// Sky condition grouped from WMO weather codes.
enum WeatherKind { clear, partlyCloudy, cloudy, fog, drizzle, rain, heavyRain, thunder }

extension WeatherKindX on WeatherKind {
  static WeatherKind fromCode(int code) {
    if (code == 0) return WeatherKind.clear;
    if (code == 1 || code == 2) return WeatherKind.partlyCloudy;
    if (code == 3) return WeatherKind.cloudy;
    if (code == 45 || code == 48) return WeatherKind.fog;
    if (code >= 51 && code <= 57) return WeatherKind.drizzle;
    if (code == 65 || code == 67 || code == 82) return WeatherKind.heavyRain;
    if ((code >= 61 && code <= 66) || code == 80 || code == 81) return WeatherKind.rain;
    if (code >= 95) return WeatherKind.thunder;
    return WeatherKind.cloudy; // snow codes never occur in Thailand
  }

  String label(bool isDay) => switch (this) {
        WeatherKind.clear => isDay ? 'ท้องฟ้าแจ่มใส' : 'ท้องฟ้าโปร่ง',
        WeatherKind.partlyCloudy => 'มีเมฆบางส่วน',
        WeatherKind.cloudy => 'เมฆมาก',
        WeatherKind.fog => 'มีหมอก',
        WeatherKind.drizzle => 'ฝนปรอยๆ',
        WeatherKind.rain => 'ฝนตก',
        WeatherKind.heavyRain => 'ฝนตกหนัก',
        WeatherKind.thunder => 'พายุฝนฟ้าคะนอง',
      };

  IconData icon(bool isDay) => switch (this) {
        WeatherKind.clear => isDay ? Remix.sun_fill : Remix.moon_clear_fill,
        WeatherKind.partlyCloudy => isDay ? Remix.sun_cloudy_fill : Remix.moon_cloudy_fill,
        WeatherKind.cloudy => Remix.cloudy_fill,
        WeatherKind.fog => Remix.mist_fill,
        WeatherKind.drizzle => Remix.drizzle_fill,
        WeatherKind.rain => Remix.showers_fill,
        WeatherKind.heavyRain => Remix.heavy_showers_fill,
        WeatherKind.thunder => Remix.thunderstorms_fill,
      };

  bool get isWet =>
      this == WeatherKind.drizzle ||
      this == WeatherKind.rain ||
      this == WeatherKind.heavyRain ||
      this == WeatherKind.thunder;
}

class HourlyWeather {
  const HourlyWeather(
      {required this.time,
      required this.temperature,
      required this.code,
      required this.rainChance,
      required this.isDay});
  final DateTime time;
  final double temperature;
  final int code;
  final int rainChance;
  final bool isDay;

  WeatherKind get kind => WeatherKindX.fromCode(code);
}

class WeatherSnapshot {
  const WeatherSnapshot({
    required this.temperature,
    required this.apparent,
    required this.humidity,
    required this.windKmh,
    required this.precipitation,
    required this.code,
    required this.isDay,
    required this.rainChance,
    required this.high,
    required this.low,
    required this.hourly,
    required this.fetchedAt,
  });

  final double temperature;
  final double apparent;
  final int humidity;
  final double windKmh;
  final double precipitation;
  final int code;
  final bool isDay;
  final int? rainChance;
  final double? high;
  final double? low;
  final List<HourlyWeather> hourly;
  final DateTime fetchedAt;

  WeatherKind get kind => WeatherKindX.fromCode(code);

  /// Field guidance for rice farmers from the current conditions.
  String advice({required bool hasLocalRisk}) {
    final k = kind;
    if (k == WeatherKind.thunder || k == WeatherKind.heavyRain) {
      return 'ฝนหนัก งดพ่นสารเคมี และตรวจทางระบายน้ำในแปลง';
    }
    if (k.isWet) {
      return 'ใบข้าวเปียกนาน เสี่ยงโรคใบไหม้และขอบใบแห้ง งดพ่นยาช่วงฝนตก';
    }
    if (k == WeatherKind.fog) {
      return 'มีหมอก ใบข้าวชื้นช่วงเช้า เฝ้าระวังโรคใบไหม้';
    }
    if (humidity >= 85 && temperature >= 22 && temperature <= 30) {
      return 'อากาศชื้นสูง เอื้อต่อเชื้อรา ควรสำรวจแปลงสม่ำเสมอ';
    }
    if (temperature >= 35) {
      return 'อากาศร้อนจัด รักษาระดับน้ำในแปลงให้เพียงพอ';
    }
    if ((rainChance ?? 0) >= 60) {
      return 'มีโอกาสฝนตกสูง เลื่อนการพ่นสารออกไปก่อน';
    }
    if (hasLocalRisk) {
      return 'พบโรคในพื้นที่ใกล้เคียง สภาพอากาศเหมาะกับการสำรวจแปลง';
    }
    return isDay ? 'อากาศดี เหมาะกับการสำรวจแปลงและพ่นสาร' : 'อากาศปลอดโปร่ง วางแผนสำรวจแปลงช่วงเช้า';
  }
}

class WeatherService {
  WeatherService._();

  /// Current conditions + next hours from Open-Meteo (no API key needed).
  static Future<WeatherSnapshot?> fetch(double lat, double lon) async {
    try {
      final url = Uri.parse('https://api.open-meteo.com/v1/forecast'
          '?latitude=$lat&longitude=$lon'
          '&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m'
          '&hourly=temperature_2m,weather_code,precipitation_probability,is_day'
          '&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max'
          '&forecast_days=2&timezone=auto');
      final res = await http.get(url).timeout(const Duration(seconds: 6));
      if (res.statusCode != 200) return null;
      return parse(jsonDecode(res.body) as Map<String, dynamic>);
    } catch (e) {
      debugPrint('Weather fetch failed: $e');
      return null;
    }
  }

  @visibleForTesting
  static WeatherSnapshot parse(Map<String, dynamic> data) {
    final c = data['current'] as Map<String, dynamic>;
    final daily = data['daily'] as Map<String, dynamic>?;
    num? firstOf(String key) {
      final list = daily?[key] as List?;
      return list != null && list.isNotEmpty ? list.first as num? : null;
    }

    final hourly = <HourlyWeather>[];
    final h = data['hourly'] as Map<String, dynamic>?;
    if (h != null) {
      final times = (h['time'] as List).cast<String>();
      // Times are local to the location (timezone=auto); compare against the
      // current reading's local time, not the device clock.
      final now = DateTime.parse(c['time'] as String);
      for (var i = 0; i < times.length && hourly.length < 6; i++) {
        final t = DateTime.parse(times[i]);
        if (t.isBefore(now.subtract(const Duration(minutes: 59)))) continue;
        hourly.add(HourlyWeather(
          time: t,
          temperature: (h['temperature_2m'][i] as num).toDouble(),
          code: (h['weather_code'][i] as num).toInt(),
          rainChance: (h['precipitation_probability'][i] as num?)?.toInt() ?? 0,
          isDay: (h['is_day'][i] as num?) == 1,
        ));
      }
    }

    return WeatherSnapshot(
      temperature: (c['temperature_2m'] as num).toDouble(),
      apparent: (c['apparent_temperature'] as num? ?? c['temperature_2m'] as num).toDouble(),
      humidity: (c['relative_humidity_2m'] as num).round(),
      windKmh: (c['wind_speed_10m'] as num? ?? 0).toDouble(),
      precipitation: (c['precipitation'] as num? ?? 0).toDouble(),
      code: (c['weather_code'] as num? ?? 0).toInt(),
      isDay: (c['is_day'] as num? ?? 1) == 1,
      rainChance: firstOf('precipitation_probability_max')?.toInt(),
      high: firstOf('temperature_2m_max')?.toDouble(),
      low: firstOf('temperature_2m_min')?.toDouble(),
      hourly: hourly,
      fetchedAt: DateTime.now(),
    );
  }
}
