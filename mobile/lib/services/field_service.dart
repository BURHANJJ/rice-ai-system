import 'dart:math' as math;

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

import '../models/rice_field.dart';

/// Firestore access for the field notebook.
///
/// Layout: `fields/{fieldId}` owned by `user_id`, with the diary in
/// `fields/{fieldId}/logs/{logId}`. Queries filter on a single field so no
/// composite index is needed; ordering happens on the client.
class FieldService {
  FieldService._();

  static final _db = FirebaseFirestore.instance;
  static CollectionReference<Map<String, dynamic>> get _fields => _db.collection('fields');
  static CollectionReference<Map<String, dynamic>> _logs(String fieldId) => _fields.doc(fieldId).collection('logs');

  static String get _uid {
    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid == null) throw StateError('not-logged-in');
    return uid;
  }

  /// The signed-in farmer's fields: active first (by sowing date), then harvested.
  static Stream<List<RiceField>> watchMine() {
    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid == null) return Stream.value(const []);
    return _fields.where('user_id', isEqualTo: uid).snapshots().map((s) {
      final list = s.docs.map(RiceField.fromDoc).toList();
      list.sort((a, b) {
        if (a.isHarvested != b.isHarvested) return a.isHarvested ? 1 : -1;
        return a.isHarvested
            ? (b.harvestedAt ?? b.sownAt).compareTo(a.harvestedAt ?? a.sownAt)
            : b.sownAt.compareTo(a.sownAt);
      });
      return list;
    });
  }

  static Stream<RiceField?> watch(String id) =>
      _fields.doc(id).snapshots().map((d) => d.exists ? RiceField.fromDoc(d) : null);

  static Future<String> create(RiceField f) async {
    final ref = await _fields.add({
      ...f.toFormData(),
      'user_id': _uid,
      'status': 'active',
      'task_log': <String, dynamic>{},
      'created_at': FieldValue.serverTimestamp(),
      'updated_at': FieldValue.serverTimestamp(),
    });
    return ref.id;
  }

  static Future<void> update(RiceField f) => _fields.doc(f.id).update({
        ...f.toFormData(),
        'updated_at': FieldValue.serverTimestamp(),
      });

  static Future<void> setTaskDone(String fieldId, String taskId, bool done) => _fields.doc(fieldId).update({
        'task_log.$taskId': done ? FieldValue.serverTimestamp() : FieldValue.delete(),
        'updated_at': FieldValue.serverTimestamp(),
      });

  static Future<void> markHarvested(String fieldId, DateTime date, double? yieldKg) => _fields.doc(fieldId).update({
        'status': 'harvested',
        'harvested_at': Timestamp.fromDate(date),
        'yield_kg': yieldKg,
        'updated_at': FieldValue.serverTimestamp(),
      });

  static Future<void> reopen(String fieldId) => _fields.doc(fieldId).update({
        'status': 'active',
        'harvested_at': FieldValue.delete(),
        'yield_kg': FieldValue.delete(),
        'updated_at': FieldValue.serverTimestamp(),
      });

  /// Deletes the field and its diary.
  static Future<void> delete(String fieldId) async {
    final logs = await _logs(fieldId).get();
    final batch = _db.batch();
    for (final d in logs.docs) {
      batch.delete(d.reference);
    }
    batch.delete(_fields.doc(fieldId));
    await batch.commit();
  }

  static Stream<List<FieldLog>> watchLogs(String fieldId) =>
      _logs(fieldId).orderBy('date', descending: true).snapshots().map((s) => s.docs.map(FieldLog.fromDoc).toList());

  static Future<void> addLog(String fieldId, FieldLog log) => _logs(fieldId).add({
        ...log.toData(),
        'created_at': FieldValue.serverTimestamp(),
      });

  static Future<void> deleteLog(String fieldId, String logId) => _logs(fieldId).doc(logId).delete();

  /// The user's active field closest to a point, if one lies within [radiusM].
  static Future<(RiceField, double)?> nearestField(double lat, double lng, {double radiusM = 500}) async {
    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid == null) return null;
    final qs = await _fields.where('user_id', isEqualTo: uid).get();
    (RiceField, double)? best;
    for (final d in qs.docs) {
      final f = RiceField.fromDoc(d);
      if (f.isHarvested || !f.hasLocation) continue;
      final dist = distanceM(lat, lng, f.lat!, f.lng!);
      if (dist <= radiusM && (best == null || dist < best.$2)) best = (f, dist);
    }
    return best;
  }

  /// Distance in metres between two lat/lng points (haversine).
  static double distanceM(double lat1, double lng1, double lat2, double lng2) {
    const r = 6371000.0;
    double rad(double d) => d * math.pi / 180;
    final dLat = rad(lat2 - lat1), dLng = rad(lng2 - lng1);
    final a =
        math.pow(math.sin(dLat / 2), 2) + math.cos(rad(lat1)) * math.cos(rad(lat2)) * math.pow(math.sin(dLng / 2), 2);
    return 2 * r * math.asin(math.sqrt(a));
  }

  /// The user's scans taken within [radiusM] of the field since sowing.
  static Future<List<Map<String, dynamic>>> scansNear(RiceField f, {double radiusM = 500}) async {
    if (!f.hasLocation) return const [];
    final qs = await _db.collection('diagnoses').where('user_id', isEqualTo: _uid).get();
    final out = <Map<String, dynamic>>[];
    for (final d in qs.docs) {
      final data = d.data();
      final loc = data['location'];
      if (loc is! Map || loc['latitude'] == null || loc['longitude'] == null) continue;
      final date = (data['diag_date'] as Timestamp?)?.toDate();
      if (date != null && date.isBefore(f.sownAt.subtract(const Duration(days: 1)))) continue;
      final dist = distanceM(f.lat!, f.lng!, (loc['latitude'] as num).toDouble(), (loc['longitude'] as num).toDouble());
      if (dist <= radiusM) out.add({...data, 'diag_id': d.id, 'date': date, 'distance': dist});
    }
    out.sort((a, b) => ((b['date'] as DateTime?) ?? DateTime(0)).compareTo((a['date'] as DateTime?) ?? DateTime(0)));
    return out;
  }
}
