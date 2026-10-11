import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:remixicon/remixicon.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../../services/navigation_provider.dart';
import '../../../services/auth_provider.dart';
import '../../../theme/app_theme.dart';
import '../../../widgets/app_ui.dart';
import '../../../core/localization/app_translations.dart';

class HomeOutbreakSection extends StatefulWidget {
  final NavigationProvider nav;

  const HomeOutbreakSection({super.key, required this.nav});

  @override
  State<HomeOutbreakSection> createState() => _HomeOutbreakSectionState();
}

class _HomeOutbreakSectionState extends State<HomeOutbreakSection> {
  List<Map<String, dynamic>> _outbreaks = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _fetchLatestOutbreaks();
  }

  void _fetchLatestOutbreaks() {
    FirebaseFirestore.instance
        .collection('diagnoses')
        .where('disease_code', isNotEqualTo: 'HEALTHY')
        .snapshots()
        .listen((snapshot) {
      if (!mounted) return;
      if (snapshot.docs.isEmpty) {
        setState(() {
          _isLoading = false;
          _outbreaks = [];
        });
        return;
      }

      final docs = snapshot.docs.toList();
      docs.sort((a, b) {
        final aDate = (a.data()['diag_date'] as Timestamp?)?.toDate() ?? DateTime.now();
        final bDate = (b.data()['diag_date'] as Timestamp?)?.toDate() ?? DateTime.now();
        return bDate.compareTo(aDate);
      });

      final latestDocs = docs.take(3).toList();
      final List<Map<String, dynamic>> parsedOutbreaks = [];

      for (var doc in latestDocs) {
        final data = doc.data();
        final fullLoc = (data['location']?['province'] as String?) ?? 'ไม่ระบุพื้นที่';
        final parts = fullLoc.split(' ');
        final subParts = parts.where((p) => p.startsWith('อ.') || p.startsWith('ต.') || p.startsWith('เขต')).toList();
        String shortLoc = subParts.isNotEmpty ? subParts.first : fullLoc.replaceAll(RegExp(r'จ\..*'), '').trim();
        if (shortLoc.isEmpty) shortLoc = fullLoc;

        parsedOutbreaks.add({
          'disease_name': data['disease_name'] as String? ?? 'โรคไม่ทราบชื่อ',
          'location': shortLoc,
          'date': (data['diag_date'] as Timestamp?)?.toDate(),
        });
      }

      setState(() {
        _outbreaks = parsedOutbreaks;
        _isLoading = false;
      });
    }, onError: (e) {
      debugPrint('Error fetching latest outbreaks: $e');
      if (mounted) {
        setState(() {
          _isLoading = false;
          _outbreaks = [];
        });
      }
    });
  }

  String _formatDate(DateTime? date) {
    if (date == null) return '';
    final now = DateTime.now();
    final diff = now.difference(date);
    if (diff.inDays == 0) return 'วันนี้';
    if (diff.inDays == 1) return 'เมื่อวาน';
    final formatter = DateFormat('d MMM', 'th_TH');
    return formatter.format(date);
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final lang = auth.user?.settings['language'] ?? 'th';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SectionHeader(
          title: AppTranslations.tr('outbreak.title', lang),
          action: AppTranslations.tr('outbreak.view_all', lang),
          onAction: () => widget.nav.setIndex(1),
        ),
        const SizedBox(height: 12),
        AppCard(
          padding: EdgeInsets.zero,
          child: AnimatedSize(
            duration: const Duration(milliseconds: 300),
            curve: Curves.easeOutCubic,
            child: _isLoading
                ? const Column(children: [SkeletonRow(), SkeletonRow()])
                : _outbreaks.isNotEmpty
                    ? Column(
                        children: [
                          for (var i = 0; i < _outbreaks.length; i++) ...[
                            if (i > 0) Divider(height: 1, indent: 16, endIndent: 16, color: context.pal.line),
                            FadeSlideIn.stagger(
                              i,
                              child: _buildOutbreakItem(
                                context,
                                _outbreaks[i]['disease_name'] as String,
                                _outbreaks[i]['location'] as String,
                                _outbreaks[i]['date'] as DateTime?,
                              ),
                            ),
                          ],
                        ],
                      )
                    : _buildSafeState(),
          ),
        ),
      ],
    );
  }

  Widget _buildOutbreakItem(BuildContext context, String diseaseName, String location, DateTime? date) {
    final p = context.pal;
    return Pressable(
      onTap: () => widget.nav.setIndex(1),
      scale: 0.985,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
        child: Row(
          children: [
            const IconTile(icon: Remix.bug_2_line, tone: Tone.danger, size: 42),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    diseaseName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5, color: p.ink),
                  ),
                  const SizedBox(height: 2),
                  Row(
                    children: [
                      Icon(Remix.map_pin_2_line, size: 12, color: p.muted),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(
                          '$location · ${_formatDate(date)}',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(color: p.muted, fontSize: 12),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            const StatusPill(label: 'พบการระบาด', tone: Tone.danger, dot: false),
          ],
        ),
      ),
    );
  }

  Widget _buildSafeState() {
    final p = context.pal;
    return Pressable(
      onTap: () => widget.nav.setIndex(1),
      scale: 0.985,
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            const IconTile(icon: Remix.shield_check_line, tone: Tone.safe, size: 52),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const StatusPill(label: 'สถานการณ์ปกติ', tone: Tone.safe),
                  const SizedBox(height: 6),
                  Text('ไม่พบพื้นที่เสี่ยงใหม่',
                      style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: p.ink)),
                  Text('แตะเพื่อดูสถิติในพื้นที่ของคุณ', style: TextStyle(color: p.muted, fontSize: 12.5)),
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
