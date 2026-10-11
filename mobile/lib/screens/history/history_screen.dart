import 'package:flutter/material.dart';
import 'package:remixicon/remixicon.dart';

import '../../models/diagnosis.dart';
import '../../services/api_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/app_ui.dart';

class HistoryScreen extends StatefulWidget {
  const HistoryScreen({super.key});
  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen> {
  List<HistoryEntry> _rows = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final data = await ApiService.instance.get('/diagnosis/me');
    setState(() {
      _rows = (data['history'] as List).map((e) => HistoryEntry.fromJson(e)).toList();
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final p = context.pal;
    return Scaffold(
      backgroundColor: p.bg,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 12),
              child: Row(
                children: [
                  const AppBackButton(),
                  const SizedBox(width: 12),
                  Expanded(child: Text('ประวัติการวินิจฉัย', style: AppText.display(20, color: p.ink))),
                ],
              ),
            ),
            Expanded(
              child: _loading
                  ? const Column(children: [SkeletonRow(), SkeletonRow(), SkeletonRow()])
                  : RefreshIndicator(
                      onRefresh: _load,
                      color: p.primary,
                      child: _rows.isEmpty
                          ? ListView(children: const [
                              EmptyState(
                                  icon: Remix.history_line,
                                  title: 'ยังไม่มีประวัติการวินิจฉัย',
                                  message: 'สแกนใบข้าวครั้งแรก ผลจะเก็บไว้ที่นี่',
                                  mascot: RiceyMood.sleep)
                            ])
                          : ListView.separated(
                              padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
                              itemCount: _rows.length,
                              separatorBuilder: (_, __) => const SizedBox(height: 10),
                              itemBuilder: (_, i) {
                                final r = _rows[i];
                                return FadeSlideIn.stagger(
                                  i,
                                  child: AppCard(
                                    padding: const EdgeInsets.all(14),
                                    child: Row(
                                      children: [
                                        const IconTile(icon: Remix.leaf_line, tone: Tone.primary, size: 40),
                                        const SizedBox(width: 12),
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              Text(r.diseaseName,
                                                  style: TextStyle(
                                                      fontSize: 14.5, fontWeight: FontWeight.w700, color: p.ink)),
                                              Text(
                                                '${r.diagDate} · ${r.province?.replaceAll('จ.ต.', 'ต.') ?? "ไม่ทราบจังหวัด"}',
                                                style: TextStyle(fontSize: 12, color: p.muted),
                                              ),
                                            ],
                                          ),
                                        ),
                                        Text('${r.confidence}%',
                                            style: TextStyle(color: p.primaryText, fontWeight: FontWeight.w700)),
                                      ],
                                    ),
                                  ),
                                );
                              },
                            ),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
