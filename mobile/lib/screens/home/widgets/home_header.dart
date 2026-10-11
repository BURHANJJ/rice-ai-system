import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:remixicon/remixicon.dart';

import '../../../services/auth_provider.dart';
import '../../../services/navigation_provider.dart';
import '../../../theme/app_theme.dart';
import '../../../widgets/app_ui.dart';

class HomeHeader extends StatefulWidget {
  final AppUser? user;

  const HomeHeader({super.key, required this.user});

  @override
  State<HomeHeader> createState() => _HomeHeaderState();
}

class _HomeHeaderState extends State<HomeHeader> {
  List<Map<String, dynamic>> _notifications = [];
  int _unreadCount = 0;
  StreamSubscription? _sub;

  @override
  void initState() {
    super.initState();
    _listenNotifications();
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }

  void _listenNotifications() {
    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid == null) return;
    _sub = FirebaseFirestore.instance
        .collection('notifications')
        .where('user_id', isEqualTo: uid)
        .orderBy('created_at', descending: true)
        .limit(20)
        .snapshots()
        .listen((snap) {
      if (!mounted) return;
      final items = snap.docs.map((d) => {'id': d.id, ...d.data()}).toList();
      setState(() {
        _notifications = items;
        _unreadCount = items.where((n) => n['is_read'] == false).length;
      });
    });
  }

  Future<void> _markAllRead() async {
    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid == null) return;
    final batch = FirebaseFirestore.instance.batch();
    for (final n in _notifications.where((n) => n['is_read'] == false)) {
      batch.update(FirebaseFirestore.instance.collection('notifications').doc(n['id'] as String), {'is_read': true});
    }
    await batch.commit();
  }

  String _timeAgo(dynamic ts) {
    if (ts == null) return '';
    final date = (ts as Timestamp).toDate();
    final diff = DateTime.now().difference(date);
    if (diff.inMinutes < 1) return 'เมื่อกี้';
    if (diff.inMinutes < 60) return '${diff.inMinutes} นาทีที่แล้ว';
    if (diff.inHours < 24) return '${diff.inHours} ชั่วโมงที่แล้ว';
    if (diff.inDays == 1) return 'เมื่อวาน';
    return DateFormat('d MMM', 'th_TH').format(date);
  }

  String _formatName(String? fullName) {
    if (fullName == null || fullName.trim().isEmpty) return 'ผู้ใช้งาน';
    final firstName = fullName.trim().split(' ').first;
    if (firstName.isEmpty) return 'ผู้ใช้งาน';
    if (RegExp(r'^[a-zA-Z]').hasMatch(firstName)) {
      return firstName[0].toUpperCase() + firstName.substring(1).toLowerCase();
    }
    return firstName;
  }

  @override
  Widget build(BuildContext context) {
    final p = context.pal;
    final greeting = _getGreeting(DateTime.now().hour);
    final initial =
        (widget.user?.fullName.isNotEmpty ?? false) ? widget.user!.fullName.characters.first.toUpperCase() : 'U';

    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(greeting['icon'] as IconData, size: 15, color: greeting['iconColor'] as Color),
                  const SizedBox(width: 6),
                  Text(greeting['text'] as String,
                      style: TextStyle(fontSize: 13, color: p.muted, fontWeight: FontWeight.w500)),
                ],
              ),
              const SizedBox(height: 2),
              Text(
                'คุณ${_formatName(widget.user?.fullName)}',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppText.display(24, color: p.ink),
              ),
            ],
          ),
        ),
        AppIconButton(
          icon: Remix.notification_4_line,
          tooltip: 'การแจ้งเตือน',
          size: 46,
          badge: _unreadCount,
          onPressed: () {
            _markAllRead();
            _showNotifications(context);
          },
        ),
        const SizedBox(width: 12),
        Semantics(
          button: true,
          label: 'โปรไฟล์',
          child: Pressable(
            onTap: () => context.read<NavigationProvider>().setIndex(4),
            child: Container(
              padding: const EdgeInsets.all(2),
              decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: AppColors.gold, width: 1.5)),
              child: Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(shape: BoxShape.circle, color: p.hero),
                alignment: Alignment.center,
                child: Text(initial, style: AppText.display(17, color: AppColors.cream, height: 1.1)),
              ),
            ),
          ),
        ),
      ],
    );
  }

  void _showNotifications(BuildContext context) {
    showAppSheet<void>(
      context,
      builder: (_) => StatefulBuilder(
        builder: (ctx, setSheetState) {
          final p = ctx.pal;
          return SizedBox(
            height: MediaQuery.of(ctx).size.height * 0.72,
            child: Column(
              children: [
                SheetHeader(
                  title: 'การแจ้งเตือน',
                  subtitle: 'ระบบเฝ้าระวังโรคข้าว',
                  icon: Remix.notification_3_line,
                  trailing: _unreadCount > 0 ? StatusPill(label: '$_unreadCount ใหม่', tone: Tone.danger) : null,
                ),
                Divider(height: 1, color: p.line),
                Expanded(
                  child: _notifications.isEmpty
                      ? const Center(
                          child: EmptyState(
                            icon: Remix.notification_off_line,
                            title: 'ยังไม่มีการแจ้งเตือน',
                            message: 'เริ่มสแกนใบข้าวเพื่อรับการแจ้งเตือน',
                            mascot: RiceyMood.sleep,
                          ),
                        )
                      : ListView.separated(
                          padding: EdgeInsets.fromLTRB(20, 16, 20, 24 + MediaQuery.of(ctx).padding.bottom),
                          itemCount: _notifications.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 10),
                          itemBuilder: (_, i) =>
                              FadeSlideIn.stagger(i, child: _notificationTile(ctx, _notifications[i])),
                        ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _notificationTile(BuildContext ctx, Map<String, dynamic> n) {
    final p = ctx.pal;
    final isBroadcast = n['kind'] == 'broadcast';
    final isDisease = n['type'] == 'disease_alert';
    final isUnread = n['is_read'] == false;
    final tone = isBroadcast
        ? (n['level'] == 'high' ? Tone.danger : n['level'] == 'medium' ? Tone.warn : Tone.info)
        : isDisease
            ? Tone.danger
            : Tone.safe;
    final label = isBroadcast
        ? (n['level'] == 'high' ? 'ประกาศเตือนภัย' : n['level'] == 'medium' ? 'ประกาศเฝ้าระวัง' : 'ประกาศจากเจ้าหน้าที่')
        : isDisease
            ? 'เร่งด่วน'
            : 'ผลสแกน AI';
    final (fg, _) = ctx.tone(tone);

    return AppCard(
      padding: const EdgeInsets.all(14),
      borderColor: isUnread ? fg.withOpacity(0.3) : null,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          RiceyAvatar(mood: isDisease || isBroadcast ? RiceyMood.worried : RiceyMood.guard, tone: fg, size: 44),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    StatusPill(label: label, tone: tone, dot: false),
                    const Spacer(),
                    if (isUnread) PulseDot(color: fg, size: 7),
                  ],
                ),
                const SizedBox(height: 6),
                Text(n['title'] as String? ?? '',
                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: p.ink)),
                const SizedBox(height: 3),
                Text(n['body'] as String? ?? '', style: TextStyle(fontSize: 12.5, color: p.muted, height: 1.45)),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Icon(Remix.time_line, size: 12, color: p.faint),
                    const SizedBox(width: 4),
                    Text(_timeAgo(n['created_at']), style: TextStyle(fontSize: 11.5, color: p.faint)),
                    if (n['location'] != null) ...[
                      const SizedBox(width: 10),
                      Icon(Remix.map_pin_2_line, size: 12, color: p.faint),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(
                          n['location'] as String? ?? '',
                          style: TextStyle(fontSize: 11.5, color: p.faint),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Map<String, dynamic> _getGreeting(int hour) {
    if (hour >= 5 && hour < 12) {
      return {'text': 'สวัสดีตอนเช้า', 'icon': Remix.sun_line, 'iconColor': const Color(0xFFC98A12)};
    } else if (hour >= 12 && hour < 17) {
      return {'text': 'สวัสดีตอนบ่าย', 'icon': Remix.sun_cloudy_line, 'iconColor': const Color(0xFFC2410C)};
    } else if (hour >= 17 && hour < 20) {
      return {'text': 'สวัสดีตอนเย็น', 'icon': Remix.moon_cloudy_line, 'iconColor': const Color(0xFF1E5A8A)};
    } else {
      return {'text': 'สวัสดีตอนค่ำ', 'icon': Remix.moon_line, 'iconColor': const Color(0xFF4F46E5)};
    }
  }
}
