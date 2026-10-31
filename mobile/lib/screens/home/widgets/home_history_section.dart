import 'dart:async';
import 'package:flutter/material.dart';
import 'package:remixicon/remixicon.dart';
import 'package:intl/intl.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../../../models/rice_field.dart';
import '../../../services/field_service.dart';
import '../../../theme/app_theme.dart';
import '../../../widgets/app_ui.dart';
import '../../history/history_detail_screen.dart';

class HomeHistorySection extends StatefulWidget {
  const HomeHistorySection({super.key});

  @override
  State<HomeHistorySection> createState() => _HomeHistorySectionState();
}

class _HomeHistorySectionState extends State<HomeHistorySection> {
  List<dynamic> _history = [];
  bool _isLoading = true;
  StreamSubscription? _authSub;
  StreamSubscription? _historySub;
  StreamSubscription? _fieldsSub;
  List<RiceField> _activeFields = [];
  String? _currentUid;

  @override
  void initState() {
    super.initState();
    _listenAuthAndHistory();
  }

  @override
  void dispose() {
    _authSub?.cancel();
    _historySub?.cancel();
    _fieldsSub?.cancel();
    super.dispose();
  }

  void _listenAuthAndHistory() {
    _authSub = FirebaseAuth.instance.authStateChanges().listen((user) {
      if (user?.uid != _currentUid) {
        _currentUid = user?.uid;
        _historySub?.cancel();
        _fieldsSub?.cancel();

        if (user == null) {
          if (mounted) setState(() { _history = []; _isLoading = false; });
          return;
        }

        // 1. Listen to user's active fields in real time
        _fieldsSub = FirebaseFirestore.instance
            .collection('fields')
            .where('user_id', isEqualTo: user.uid)
            .snapshots()
            .listen((fieldsSnap) {
          _activeFields = fieldsSnap.docs
              .map(RiceField.fromDoc)
              .where((f) => !f.isHarvested && f.hasLocation)
              .toList();
          _reprocessHistory();
        }, onError: (e) => debugPrint('Fields subscription error: $e'));

        // 2. Listen to diagnoses in real time
        _historySub = FirebaseFirestore.instance
            .collection('diagnoses')
            .where('user_id', isEqualTo: user.uid)
            .snapshots()
            .listen((qs) {
          final historyList = qs.docs.map((doc) {
            final data = doc.data();
            data['diag_id'] = doc.id;
            if (data['diag_date'] != null && data['diag_date'] is Timestamp) {
              data['diag_date'] = (data['diag_date'] as Timestamp).toDate().toUtc().toIso8601String();
            }
            data['is_firebase'] = true; // Still pass true for HistoryDetailScreen backward compatibility
            _attachField(data);
            return data;
          }).toList();

          // Sort combined list by date descending
          historyList.sort((a, b) {
            final aDate = a['diag_date']?.toString() ?? '';
            final bDate = b['diag_date']?.toString() ?? '';
            return bDate.compareTo(aDate);
          });

          if (mounted) {
            setState(() {
              _history = historyList;
              _isLoading = false;
            });
          }
        }, onError: (e) {
          debugPrint('Firestore history stream error: $e');
          if (mounted) setState(() => _isLoading = false);
        });
      }
    });
  }

  void _attachField(Map<String, dynamic> data) {
    if (data['field_name'] == null && _activeFields.isNotEmpty) {
      final loc = data['location'] as Map<String, dynamic>?;
      final lat = (loc?['latitude'] as num?)?.toDouble();
      final lng = (loc?['longitude'] as num?)?.toDouble();
      if (lat != null && lng != null) {
        for (final f in _activeFields) {
          final d = FieldService.distanceM(lat, lng, f.lat!, f.lng!);
          if (d <= 500) {
            data['field_name'] = f.name;
            data['field_id'] = f.id;
            break;
          }
        }
      }
    }
  }

  void _reprocessHistory() {
    if (_history.isEmpty) return;
    bool changed = false;
    for (final item in _history) {
      if (item is Map<String, dynamic> && item['field_name'] == null) {
        _attachField(item);
        changed = true;
      }
    }
    if (changed && mounted) setState(() {});
  }

  DateTime _parseUtcDate(String dateStr) {
    if (dateStr.endsWith('Z')) return DateTime.parse(dateStr).toLocal();
    return DateTime.parse('${dateStr.replaceFirst(' ', 'T')}Z').toLocal();
  }

  String _formatDate(String dateStr) {
    try {
      final date = _parseUtcDate(dateStr);
      final now = DateTime.now();
      if (date.year == now.year && date.month == now.month && date.day == now.day) {
        return 'วันนี้ ${DateFormat('HH:mm').format(date)} น.';
      } else if (date.year == now.year && date.month == now.month && date.day == now.day - 1) {
        return 'เมื่อวาน ${DateFormat('HH:mm').format(date)} น.';
      }
      return '${date.day}/${date.month}/${date.year + 543} ${DateFormat('HH:mm').format(date)} น.';
    } catch (_) {
      return dateStr;
    }
  }

  String _formatDateFull(String dateStr) {
    try {
      final date = _parseUtcDate(dateStr);
      return '${date.day}/${date.month}/${date.year + 543} ${DateFormat('HH:mm:ss').format(date)}';
    } catch (_) {
      return dateStr;
    }
  }

  String _cleanLocation(String? raw) {
    if (raw == null || raw.isEmpty) return '';
    String s = raw;
    s = s.replaceAll('จ.ต.', 'ต.');
    s = s.replaceAll('จ.จังหวัด', 'จ.');
    s = s.replaceAll('อ.อำเภอ', 'อ.');
    s = s.replaceAll('ต.ตำบล', 'ต.');
    s = s.replaceAll('จังหวัด', 'จ.');
    s = s.replaceAll('อำเภอ', 'อ.');
    s = s.replaceAll('ตำบล', 'ต.');
    s = s.replaceAll('จ.จ.', 'จ.');
    s = s.replaceAll('อ.อ.', 'อ.');
    s = s.replaceAll('ต.ต.', 'ต.');
    return s.trim();
  }

  void _openDetail(BuildContext context, String diagId) {
    Navigator.push(context, MaterialPageRoute(builder: (context) => HistoryDetailScreen(diagId: diagId)));
  }

  String _locationOf(dynamic item) {
    String rawLoc = '';
    if (item['location'] != null && item['location'] is Map && item['location']['province'] != null) {
      rawLoc = item['location']['province'];
    } else {
      rawLoc = item['province'] as String? ?? '';
    }
    return _cleanLocation(rawLoc);
  }

  void _showAllHistoryModal(BuildContext context) {
    showAppSheet<void>(
      context,
      builder: (sheetCtx) {
        final p = sheetCtx.pal;
        return SizedBox(
          height: MediaQuery.of(sheetCtx).size.height * 0.85,
          child: Column(
            children: [
              SheetHeader(
                title: 'ประวัติการสแกนทั้งหมด',
                subtitle: '${_history.length} รายการ',
                icon: Remix.history_line,
                trailing: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    PulseDot(color: p.safe, size: 6),
                    Text('Live', style: TextStyle(color: p.safe, fontSize: 11.5, fontWeight: FontWeight.w700)),
                  ],
                ),
              ),
              Divider(height: 1, color: p.line),
              Expanded(
                child: _history.isEmpty
                    ? const Center(
                        child: EmptyState(
                            icon: Remix.plant_line, title: 'ยังไม่มีประวัติการสแกน', mascot: RiceyMood.sleep))
                    : ListView.separated(
                        padding: const EdgeInsets.fromLTRB(20, 16, 20, 16),
                        itemCount: _history.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 10),
                        itemBuilder: (context, index) {
                          final item = _history[index];
                          final isHealthy = item['disease_code'] == 'HEALTHY';
                          final title = item['disease_name'] ?? 'ไม่ทราบผล';
                          final time = _formatDateFull(item['diag_date'] ?? '');
                          final loc = _locationOf(item);
                          final confidence = item['confidence'] != null ? (item['confidence'] as num).toDouble() : 0.0;
                          final tone = isHealthy ? Tone.safe : Tone.danger;

                          return FadeSlideIn.stagger(
                            index,
                            child: AppCard(
                              padding: const EdgeInsets.all(14),
                              onTap: () {
                                Navigator.pop(context);
                                _openDetail(context, item['diag_id'].toString());
                              },
                              child: Column(
                                children: [
                                  Row(
                                    children: [
                                      IconTile(
                                          icon: isHealthy ? Remix.leaf_line : Remix.bug_line, tone: tone, size: 42),
                                      const SizedBox(width: 12),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              title,
                                              maxLines: 1,
                                              overflow: TextOverflow.ellipsis,
                                              style:
                                                  TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700, color: p.ink),
                                            ),
                                            const SizedBox(height: 2),
                                            Row(
                                              children: [
                                                Icon(Remix.time_line, size: 12, color: p.faint),
                                                const SizedBox(width: 4),
                                                Text(time, style: TextStyle(fontSize: 11.5, color: p.muted)),
                                                if (item['field_name'] != null && (item['field_name'] as String).isNotEmpty) ...[
                                                  Text(' · ', style: TextStyle(fontSize: 11.5, color: p.faint)),
                                                  Icon(Remix.seedling_line, size: 11.5, color: p.primary),
                                                  const SizedBox(width: 2),
                                                  Flexible(
                                                    child: Text(
                                                      'แปลง ${item['field_name']}',
                                                      maxLines: 1,
                                                      overflow: TextOverflow.ellipsis,
                                                      style: TextStyle(
                                                          fontSize: 11.5,
                                                          fontWeight: FontWeight.w600,
                                                          color: p.primaryText),
                                                    ),
                                                  ),
                                                ],
                                              ],
                                            ),
                                          ],
                                        ),
                                      ),
                                      StatusPill(label: isHealthy ? 'ปกติ' : 'พบโรค', tone: tone),
                                    ],
                                  ),
                                  const SizedBox(height: 12),
                                  Divider(height: 1, color: p.line),
                                  const SizedBox(height: 10),
                                  Row(
                                    children: [
                                      Icon(Remix.map_pin_line, size: 13, color: p.faint),
                                      const SizedBox(width: 4),
                                      Expanded(
                                        child: Text(
                                          loc.isNotEmpty ? loc : 'ไม่ระบุพิกัด',
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: TextStyle(fontSize: 12, color: loc.isNotEmpty ? p.body : p.faint),
                                        ),
                                      ),
                                      const SizedBox(width: 8),
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                        decoration:
                                            BoxDecoration(color: p.subtle, borderRadius: BorderRadius.circular(8)),
                                        child: Text(
                                          '${confidence.toStringAsFixed(1)}%',
                                          style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: p.body),
                                        ),
                                      ),
                                      Icon(Remix.arrow_right_s_line, size: 18, color: p.faint),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
              ),
              Padding(
                padding: EdgeInsets.fromLTRB(20, 4, 20, 16 + MediaQuery.of(sheetCtx).padding.bottom),
                child: AppButton(
                    label: 'ปิด', kind: ButtonKind.soft, height: 50, onPressed: () => Navigator.pop(sheetCtx)),
              ),
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final p = context.pal;
    final shown = _history.take(3).toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SectionHeader(
          title: 'ประวัติการสแกน',
          action: 'ดูทั้งหมด',
          onAction: _history.isNotEmpty ? () => _showAllHistoryModal(context) : null,
        ),
        const SizedBox(height: 12),
        AppCard(
          padding: EdgeInsets.zero,
          child: AnimatedSize(
            duration: const Duration(milliseconds: 300),
            curve: Curves.easeOutCubic,
            child: _isLoading
                ? const Column(children: [SkeletonRow(), SkeletonRow(), SkeletonRow()])
                : _history.isEmpty
                    ? const EmptyState(
                        icon: Remix.plant_line,
                        title: 'ยังไม่มีประวัติการสแกน',
                        message: 'ผลการสแกนของคุณจะแสดงที่นี่',
                      )
                    : Column(
                        children: [
                          for (var i = 0; i < shown.length; i++) ...[
                            if (i > 0) Divider(height: 1, indent: 16, endIndent: 16, color: p.line),
                            FadeSlideIn.stagger(
                              i,
                              child: _buildHistoryTile(
                                context,
                                shown[i]['diag_id'].toString(),
                                shown[i]['disease_name'] ?? 'ไม่ทราบผล',
                                _formatDate(shown[i]['diag_date'] ?? ''),
                                shown[i]['disease_code'] != 'HEALTHY',
                                fieldName: shown[i]['field_name'] as String?,
                              ),
                            ),
                          ],
                        ],
                      ),
          ),
        ),
      ],
    );
  }

  Widget _buildHistoryTile(
    BuildContext context,
    String diagId,
    String title,
    String time,
    bool isAlert, {
    String? fieldName,
  }) {
    final p = context.pal;
    return Pressable(
      onTap: () => _openDetail(context, diagId),
      scale: 0.985,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
        child: Row(
          children: [
            IconTile(
                icon: isAlert ? Remix.plant_line : Remix.leaf_line, tone: isAlert ? Tone.danger : Tone.safe, size: 42),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w600, color: p.ink),
                  ),
                  const SizedBox(height: 2),
                  Row(
                    children: [
                      Text(time, style: TextStyle(fontSize: 12, color: p.muted)),
                      if (fieldName != null && fieldName.isNotEmpty) ...[
                        Text(' · ', style: TextStyle(fontSize: 12, color: p.faint)),
                        Icon(Remix.seedling_line, size: 12, color: p.primary),
                        const SizedBox(width: 2),
                        Flexible(
                          child: Text(
                            'แปลง $fieldName',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: p.primaryText),
                          ),
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            ),
            Icon(Remix.arrow_right_s_line, color: p.faint),
          ],
        ),
      ),
    );
  }
}
