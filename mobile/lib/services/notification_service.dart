import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart' show Color;
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:workmanager/workmanager.dart';

import '../firebase_options.dart';

/// Phone notifications for outbreak broadcasts sent from the web portal.
///
/// Three paths, all deduplicated by notification id so a broadcast pops up once:
///  1. FCM push (instant, works with the app closed) — needs the
///     `sendBroadcastPush` Cloud Function deployed.
///  2. A live Firestore listener while the app is open.
///  3. A WorkManager check every ~15 minutes in the background (no server needed).
const _channel = AndroidNotificationChannel(
  'outbreak_alerts',
  'ประกาศเตือนการระบาด',
  description: 'ประกาศจากเจ้าหน้าที่เมื่อพบโรคข้าวระบาดในพื้นที่ของคุณ',
  importance: Importance.high,
);
const _task = 'rice-ai-check-broadcasts';
const _seenKey = 'rb_notified_ids';
const _maxAge = Duration(days: 3);

final FlutterLocalNotificationsPlugin _local = FlutterLocalNotificationsPlugin();
bool _localReady = false;

@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  await NotificationService.showFromData(message.data);
}

@pragma('vm:entry-point')
void notificationCallbackDispatcher() {
  Workmanager().executeTask((task, inputData) async {
    try {
      await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
      await NotificationService.checkInbox();
    } catch (_) {
      // a failed check just waits for the next run
    }
    return true;
  });
}

class NotificationService {
  NotificationService._();
  static final NotificationService instance = NotificationService._();

  StreamSubscription<RemoteMessage>? _foreground;
  StreamSubscription<String>? _tokenRefresh;
  StreamSubscription<QuerySnapshot<Map<String, dynamic>>>? _inbox;
  String? _uid;
  String? _token;
  String? _province;

  static bool get _supported => !kIsWeb && (defaultTargetPlatform == TargetPlatform.android || defaultTargetPlatform == TargetPlatform.iOS);

  static Future<void> _initLocal() async {
    if (_localReady) return;
    await _local.initialize(const InitializationSettings(
      android: AndroidInitializationSettings('@mipmap/launcher_icon'),
      iOS: DarwinInitializationSettings(requestAlertPermission: false, requestBadgePermission: false, requestSoundPermission: false),
    ));
    await _local
        .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(_channel);
    _localReady = true;
  }

  /// Call once at app start, before runApp.
  Future<void> init() async {
    if (!_supported) return;
    try {
      await _initLocal();
      FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
      _foreground = FirebaseMessaging.onMessage.listen((m) => showFromData(m.data));
      if (defaultTargetPlatform == TargetPlatform.android) {
        await Workmanager().initialize(notificationCallbackDispatcher);
        await Workmanager().registerPeriodicTask(
          _task,
          _task,
          frequency: const Duration(minutes: 15),
          existingWorkPolicy: ExistingWorkPolicy.keep,
          constraints: Constraints(networkType: NetworkType.connected),
        );
      }
    } catch (e) {
      debugPrint('NotificationService.init: $e');
    }
  }

  /// After sign-in: ask permission, register this phone for push, watch the inbox.
  Future<void> attachUser(String uid) async {
    if (!_supported || _uid == uid) return;
    await detachUser(removeToken: false);
    _uid = uid;
    try {
      final fm = FirebaseMessaging.instance;
      final perm = await fm.requestPermission(alert: true, badge: true, sound: true);
      final allowed = perm.authorizationStatus == AuthorizationStatus.authorized ||
          perm.authorizationStatus == AuthorizationStatus.provisional;
      await _local
          .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
          ?.requestNotificationsPermission();
      final token = await fm.getToken();
      await _saveToken(uid, token, allowed);
      _tokenRefresh = fm.onTokenRefresh.listen((t) => _saveToken(uid, t, allowed));
    } catch (e) {
      debugPrint('NotificationService.attachUser: $e');
    }
    _watchInbox(uid);
  }

  Future<void> _saveToken(String uid, String? token, bool allowed) async {
    if (token == null) return;
    final old = _token;
    _token = token;
    await FirebaseFirestore.instance.collection('users').doc(uid).set({
      'fcm_tokens': FieldValue.arrayUnion([token]),
      'notifications_enabled': allowed,
      'push_updated_at': FieldValue.serverTimestamp(),
    }, SetOptions(merge: true));
    if (old != null && old != token) {
      await FirebaseFirestore.instance.collection('users').doc(uid).update({
        'fcm_tokens': FieldValue.arrayRemove([old]),
      });
    }
  }

  /// Saves the phone's current province on the user's profile (from the home
  /// screen's GPS lookup, e.g. "ต.ท่าวังทอง อ.เมืองพะเยา จ.พะเยา"), so admins
  /// can target everyone currently in a province — farmers, researchers, staff.
  Future<void> updateArea(String address) async {
    final uid = _uid ?? FirebaseAuth.instance.currentUser?.uid;
    final province = RegExp(r'จ\.(\S+)').firstMatch(address)?.group(1);
    if (uid == null || province == null || province.isEmpty || province == _province) return;
    _province = province;
    try {
      await FirebaseFirestore.instance.collection('users').doc(uid).set({
        'province': province,
        'area': address,
        'area_updated_at': FieldValue.serverTimestamp(),
      }, SetOptions(merge: true));
    } catch (_) {}
  }

  /// On sign-out: stop listening and unregister this phone so the next user doesn't get their alerts.
  Future<void> detachUser({bool removeToken = true}) async {
    await _inbox?.cancel();
    await _tokenRefresh?.cancel();
    _inbox = null;
    _tokenRefresh = null;
    final uid = _uid;
    _uid = null;
    _province = null;
    if (removeToken && uid != null && _token != null) {
      try {
        await FirebaseFirestore.instance.collection('users').doc(uid).update({
          'fcm_tokens': FieldValue.arrayRemove([_token]),
        });
        await FirebaseMessaging.instance.deleteToken();
      } catch (_) {}
      _token = null;
    }
  }

  void _watchInbox(String uid) {
    _inbox = _query(uid).snapshots().listen((snap) {
      for (final c in snap.docChanges) {
        if (c.type == DocumentChangeType.added) _maybeShow(c.doc.id, c.doc.data());
      }
    }, onError: (_) {});
  }

  static Query<Map<String, dynamic>> _query(String uid) => FirebaseFirestore.instance
      .collection('notifications')
      .where('user_id', isEqualTo: uid)
      .orderBy('created_at', descending: true)
      .limit(20);

  /// Background check (WorkManager): pop up any unread broadcast not shown yet.
  static Future<void> checkInbox() async {
    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid == null) return;
    final snap = await _query(uid).get();
    for (final d in snap.docs) {
      await _maybeShow(d.id, d.data());
    }
  }

  static Future<void> _maybeShow(String id, Map<String, dynamic>? n) async {
    if (n == null || n['kind'] != 'broadcast' || n['is_read'] == true) return;
    final at = n['created_at'];
    if (at is Timestamp && DateTime.now().difference(at.toDate()) > _maxAge) return;
    await _show(id, n['title'] as String? ?? 'ประกาศจากเจ้าหน้าที่', n['body'] as String? ?? '', n['level'] as String?);
  }

  /// FCM data payload: {notification_id, title, body, level}
  static Future<void> showFromData(Map<String, dynamic> data) async {
    final id = data['notification_id'] as String?;
    if (id == null) return;
    await _show(id, data['title'] as String? ?? 'ประกาศจากเจ้าหน้าที่', data['body'] as String? ?? '', data['level'] as String?);
  }

  static Future<void> _show(String id, String title, String body, String? level) async {
    if (!_supported) return;
    final prefs = await SharedPreferences.getInstance();
    await prefs.reload(); // another isolate may have shown it already
    final seen = prefs.getStringList(_seenKey) ?? <String>[];
    if (seen.contains(id)) return;
    seen.add(id);
    await prefs.setStringList(_seenKey, seen.length > 200 ? seen.sublist(seen.length - 200) : seen);

    await _initLocal();
    final high = level == 'high';
    await _local.show(
      id.hashCode & 0x7fffffff,
      title,
      body,
      NotificationDetails(
        android: AndroidNotificationDetails(
          _channel.id,
          _channel.name,
          channelDescription: _channel.description,
          importance: Importance.high,
          priority: Priority.high,
          color: high ? const Color(0xFFC0392B) : const Color(0xFF1B4332),
          category: AndroidNotificationCategory.message,
          styleInformation: BigTextStyleInformation(body, contentTitle: title),
          ticker: title,
        ),
        iOS: const DarwinNotificationDetails(presentAlert: true, presentSound: true),
      ),
    );
  }

  Future<void> dispose() async {
    await _foreground?.cancel();
    await detachUser(removeToken: false);
  }
}
