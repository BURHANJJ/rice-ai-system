import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/services.dart';

/// A province or district boundary from the bundled Thailand geo assets
/// (assets/geo, simplified from OpenGISData-Thailand).
class GeoRegion {
  GeoRegion({
    required this.code,
    required this.name,
    required this.nameEn,
    required this.region,
    required this.rings,
  }) {
    double minX = double.infinity, minY = double.infinity, maxX = -double.infinity, maxY = -double.infinity;
    double bestArea = -1;
    var cx = 0.0, cy = 0.0;
    for (final r in rings) {
      var a = 0.0, sx = 0.0, sy = 0.0;
      for (var i = 0; i < r.length; i += 2) {
        final x = r[i], y = r[i + 1];
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        final j = (i + 2) % r.length;
        final cross = x * r[j + 1] - r[j] * y;
        a += cross;
        sx += (x + r[j]) * cross;
        sy += (y + r[j + 1]) * cross;
      }
      if (a.abs() > bestArea && a != 0) {
        bestArea = a.abs();
        cx = sx / (3 * a);
        cy = sy / (3 * a);
      }
    }
    bounds = Rect.fromLTRB(minX, minY, maxX, maxY);
    labelPoint = bestArea > 0 ? Offset(cx, cy) : bounds.center;
  }

  final String code;
  final String name;
  final String nameEn;
  final String region;

  /// Outer rings as flat [lon, lat, lon, lat, …] arrays.
  final List<Float64List> rings;

  /// Lon/lat bounding box (left = west, top = south).
  late final Rect bounds;

  /// Area-weighted centroid of the largest ring, in lon/lat.
  late final Offset labelPoint;

  bool contains(double lon, double lat) {
    if (!bounds.inflate(1e-9).contains(Offset(lon, lat))) return false;
    var inside = false;
    for (final r in rings) {
      for (var i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
        final xi = r[i], yi = r[i + 1], xj = r[j], yj = r[j + 1];
        if ((yi > lat) != (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
      }
    }
    return inside;
  }

  static GeoRegion fromJson(Map<String, dynamic> j) => GeoRegion(
        code: j['c'] as String,
        name: j['n'] as String,
        nameEn: (j['e'] as String?) ?? '',
        region: (j['r'] as String?) ?? '',
        rings: (j['p'] as List)
            .map((r) => Float64List.fromList((r as List).map((v) => (v as num).toDouble()).toList()))
            .toList(),
      );
}

class GeoRepository {
  GeoRepository._();

  static Future<List<GeoRegion>>? _provinces;
  static final Map<String, Future<List<GeoRegion>>> _districts = {};

  static Future<List<GeoRegion>> provinces() => _provinces ??= _load('assets/geo/provinces.json');

  static Future<List<GeoRegion>> districts(String provinceCode) =>
      _districts[provinceCode] ??= _load('assets/geo/districts/$provinceCode.json');

  static Future<List<GeoRegion>> _load(String asset) async {
    final raw = await rootBundle.loadString(asset);
    return (jsonDecode(raw) as List).map((e) => GeoRegion.fromJson(e as Map<String, dynamic>)).toList();
  }

  /// Normalises a district label from scan text ("อ.เมืองปัตตานี", "เขตบางรัก",
  /// "อำเภอเมือง") so it can be compared with boundary names.
  static String normalizeDistrict(String s) => s.replaceFirst(RegExp(r'^(อำเภอ|อ\.|เขต|กิ่งอำเภอ)'), '').trim();

  /// District label inside a free-text Thai address, if any.
  static String? districtFromText(String text) {
    final m = RegExp(r'(?:อ\.|อำเภอ|เขต)\s*([^\s]+)').firstMatch(text);
    return m == null ? null : normalizeDistrict(m.group(1)!);
  }
}
