import 'dart:async';
import 'dart:convert';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:remixicon/remixicon.dart';

import '../../models/rice_field.dart';
import '../../services/field_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/app_ui.dart';
import '../fields/field_detail_screen.dart';
import '../fields/widgets/field_widgets.dart';
import '../scan/scan_screen.dart' show ChemicalAdvice;
import '../wiki/data/rice_department_data.dart';

class HistoryDetailScreen extends StatefulWidget {
  final String diagId;
  const HistoryDetailScreen({
    super.key,
    required this.diagId,
  });

  @override
  State<HistoryDetailScreen> createState() => _HistoryDetailScreenState();
}

class _HistoryDetailScreenState extends State<HistoryDetailScreen> {
  bool _isLoading = true;
  String? _error;
  Map<String, dynamic>? _data;
  (RiceField, double)? _matchedField;

  @override
  void initState() {
    super.initState();
    _fetchDetail();
  }

  Future<void> _fetchDetail() async {
    try {
      final doc = await FirebaseFirestore.instance.collection('diagnoses').doc(widget.diagId).get();
      if (!doc.exists) throw Exception('ไม่พบข้อมูล');

      final data = doc.data();
      if (mounted) {
        setState(() {
          _data = data;
          _isLoading = false;
        });
      }

      _resolveField(data);
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = 'ไม่สามารถโหลดข้อมูลประวัติได้';
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _resolveField(Map<String, dynamic>? data) async {
    if (data == null) return;
    try {
      final loc = data['location'] as Map<String, dynamic>?;
      final lat = (loc?['latitude'] as num?)?.toDouble();
      final lng = (loc?['longitude'] as num?)?.toDouble();

      (RiceField, double)? matched;
      if (lat != null && lng != null) {
        matched = await FieldService.nearestField(lat, lng);
      }

      // If nearestField didn't find by coordinate or if field_id was saved directly
      if (matched == null && data['field_id'] != null) {
        final fieldDoc =
            await FirebaseFirestore.instance.collection('fields').doc(data['field_id'] as String).get();
        if (fieldDoc.exists) {
          final f = RiceField.fromDoc(fieldDoc);
          final dist = (lat != null && lng != null && f.hasLocation)
              ? FieldService.distanceM(lat, lng, f.lat!, f.lng!)
              : 0.0;
          matched = (f, dist);
        }
      }

      if (mounted && matched != null) {
        setState(() => _matchedField = matched);

        // If field_id wasn't saved in the diagnosis record yet, backfill it silently
        if (data['field_id'] == null) {
          unawaited(FirebaseFirestore.instance.collection('diagnoses').doc(widget.diagId).update({
            'field_id': matched.$1.id,
            'field_name': matched.$1.name,
          }).catchError((_) {}));
        }
      }
    } catch (_) {}
  }

  // Clean location text from stored data (may contain legacy duplicates like จ.ต. or จ.จังหวัด)
  String _cleanLocationText(String? raw) {
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

  @override
  Widget build(BuildContext context) {
    final p = context.pal;
    return Scaffold(
      backgroundColor: p.bg,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 8),
              child: Row(
                children: [
                  const AppBackButton(),
                  const SizedBox(width: 12),
                  Expanded(child: Text('ผลการวิเคราะห์', style: AppText.display(20, color: p.ink))),
                ],
              ),
            ),
            Expanded(
              child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 350),
                child: _isLoading
                    ? _buildLoading()
                    : _error != null
                        ? Center(
                            child: EmptyState(
                              icon: Remix.error_warning_line,
                              title: _error!,
                              message: 'กรุณาลองใหม่อีกครั้ง',
                              mascot: RiceyMood.worried,
                              action: AppButton(
                                label: 'ลองใหม่',
                                expand: false,
                                height: 46,
                                icon: Remix.refresh_line,
                                onPressed: () {
                                  setState(() {
                                    _isLoading = true;
                                    _error = null;
                                  });
                                  _fetchDetail();
                                },
                              ),
                            ),
                          )
                        : _buildContent(),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildLoading() {
    return const Padding(
      padding: EdgeInsets.fromLTRB(20, 8, 20, 0),
      child: Column(
        children: [
          Skeleton(height: 220, radius: 22, width: double.infinity),
          SizedBox(height: 14),
          Skeleton(height: 120, radius: 20, width: double.infinity),
          SizedBox(height: 14),
          Skeleton(height: 110, radius: 20, width: double.infinity),
        ],
      ),
    );
  }

  Widget _imagePlaceholder() {
    final p = context.pal;
    return Container(color: p.subtle, child: Icon(Remix.image_line, color: p.faint, size: 48));
  }

  Widget _buildContent() {
    final p = context.pal;
    final diag = _data!;
    final adviceList = diag['advice'] as List<dynamic>? ?? [];

    final isHealthy = diag['disease_code'] == 'HEALTHY';
    final tone = isHealthy ? Tone.safe : Tone.danger;
    final confidence = (diag['confidence'] as num).toDouble();

    // Formatting Location
    final loc = diag['location'] as Map<String, dynamic>?;
    final lat = loc?['latitude'] != null ? (loc!['latitude'] as num).toDouble() : null;
    final lng = loc?['longitude'] != null ? (loc!['longitude'] as num).toDouble() : null;
    final province = loc?['province'] as String?;
    final placeName = loc?['place_name'] as String?;

    final imageBase64 = diag['image_base64'] ?? '';
    final imageUrl = diag['image_url'] ?? '';

    Widget imageWidget;
    if (imageBase64.isNotEmpty) {
      try {
        imageWidget = Image.memory(
          base64Decode(imageBase64),
          fit: BoxFit.cover,
          errorBuilder: (c, e, s) => _imagePlaceholder(),
        );
      } catch (e) {
        imageWidget = _imagePlaceholder();
      }
    } else if (imageUrl.isNotEmpty) {
      imageWidget = Image.network(imageUrl, fit: BoxFit.cover, errorBuilder: (c, e, s) => _imagePlaceholder());
    } else {
      imageWidget = _imagePlaceholder();
    }

    final cleanProvince = _cleanLocationText(province);
    final cleanPlace = _cleanLocationText(placeName);
    final displayLocation =
        cleanProvince.isNotEmpty ? cleanProvince : (cleanPlace.isNotEmpty ? cleanPlace : 'พิกัดปัจจุบัน');

    RiceDiseaseData? deptData;
    try {
      deptData = RiceDepartmentData.diseases.firstWhere((d) => d.code == diag['disease_code']);
    } catch (_) {}

    var i = 0;
    Widget step(Widget child) => FadeSlideIn.stagger(i++, child: child);

    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: EdgeInsets.fromLTRB(20, 8, 20, 32 + MediaQuery.of(context).padding.bottom),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          step(Container(
            height: 220,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(24),
              boxShadow: [
                BoxShadow(color: Colors.black.withOpacity(0.08), blurRadius: 20, offset: const Offset(0, 10))
              ],
            ),
            clipBehavior: Clip.antiAlias,
            child: Stack(
              fit: StackFit.expand,
              children: [
                imageWidget,
                Positioned(
                  left: 12,
                  top: 12,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 6),
                    decoration: BoxDecoration(
                      color: isHealthy ? AppColors.safe : AppColors.danger,
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      isHealthy ? 'สุขภาพดี' : 'ตรวจพบโรค',
                      style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w700),
                    ),
                  ),
                ),
              ],
            ),
          )),
          const SizedBox(height: 14),
          step(AppCard(
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(diag['disease_name'] ?? 'ไม่ทราบ', style: AppText.display(23, color: p.ink, height: 1.3)),
                      if (deptData != null)
                        Text(deptData.scientificName,
                            style: TextStyle(fontSize: 12.5, color: p.muted, fontStyle: FontStyle.italic)),
                      const SizedBox(height: 10),
                      StatusPill(label: isHealthy ? 'สุขภาพดี' : 'ตรวจพบโรค', tone: tone),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                ConfidenceRing(percent: confidence, color: isHealthy ? p.safe : p.primary),
              ],
            ),
          )),
          const SizedBox(height: 14),
          step(AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const IconTile(icon: Remix.map_pin_2_line, tone: Tone.warn, size: 36),
                    const SizedBox(width: 10),
                    Expanded(
                        child: Text('ตำแหน่งที่สแกน',
                            style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5, color: p.ink))),
                    lat != null
                        ? const StatusPill(label: 'GPS บันทึกแล้ว', tone: Tone.safe)
                        : const StatusPill(label: 'ไม่ได้ระบุ GPS', tone: Tone.neutral, dot: false),
                  ],
                ),
                if (_matchedField != null) ...[
                  const SizedBox(height: 12),
                  Pressable(
                    onTap: () => Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => FieldDetailScreen(fieldId: _matchedField!.$1.id)),
                    ),
                    child: Container(
                      padding: const EdgeInsets.fromLTRB(6, 6, 12, 6),
                      decoration: BoxDecoration(color: p.primarySoft, borderRadius: BorderRadius.circular(14)),
                      child: Row(
                        children: [
                          FieldAvatar(field: _matchedField!.$1, size: 34),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('สแกนในแปลง ${_matchedField!.$1.name}',
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: p.primaryText)),
                                Text('ห่างจุดปักหมุดแปลง ${distanceLabel(_matchedField!.$2)} · ดูในสมุดแปลงนา',
                                    style: TextStyle(fontSize: 11.5, color: p.muted)),
                              ],
                            ),
                          ),
                          Icon(Remix.arrow_right_s_line, color: p.primaryText),
                        ],
                      ),
                    ),
                  ),
                ],
                if (lat != null) ...[
                  const SizedBox(height: 14),
                  Text(displayLocation, style: TextStyle(fontSize: 14, color: p.ink, height: 1.4)),
                  const SizedBox(height: 4),
                  Text(
                    '${lat.toStringAsFixed(4)}°N, ${lng!.toStringAsFixed(4)}°E',
                    style:
                        TextStyle(fontSize: 12.5, color: p.muted, fontFeatures: const [FontFeature.tabularFigures()]),
                  ),
                ],
                const SizedBox(height: 12),
                Divider(height: 1, color: p.line),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Icon(Remix.time_line, size: 13, color: p.faint),
                    const SizedBox(width: 6),
                    Text(
                      'บันทึกเมื่อ ${diag['diag_date'] != null ? DateFormat('dd/MM/yyyy HH:mm:ss').format((diag['diag_date'] as Timestamp).toDate().toLocal()) : ''}',
                      style: TextStyle(fontSize: 12, color: p.muted),
                    ),
                  ],
                ),
              ],
            ),
          )),
          if (!isHealthy) ...[
            const SizedBox(height: 14),
            step(AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const IconTile(icon: Remix.stethoscope_line, tone: Tone.danger, size: 40),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('ข้อมูลและคำแนะนำ', style: AppText.display(17, color: p.ink)),
                            Text('อ้างอิงข้อมูลจากกรมการข้าว และ AI', style: TextStyle(fontSize: 12, color: p.muted)),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 18),
                  _buildInfoSection(
                    title: 'อาการที่พบเบื้องต้น',
                    icon: Remix.search_eye_line,
                    tone: Tone.warn,
                    content: deptData?.farmerSymptoms ?? diag['symptoms'] ?? 'ไม่มีข้อมูลอาการ',
                  ),
                  const SizedBox(height: 16),
                  Divider(height: 1, color: p.line),
                  const SizedBox(height: 16),
                  _buildInfoSection(
                    title: 'วิธีแก้ไขและป้องกัน',
                    icon: Remix.shield_check_line,
                    tone: Tone.safe,
                    content: deptData?.farmerPrevention ?? adviceList.map((a) => a['treatment']).join('\n'),
                  ),
                  if (deptData != null && deptData.recommendedChemicals.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    Divider(height: 1, color: p.line),
                    const SizedBox(height: 16),
                    ChemicalAdvice(chemicals: deptData.recommendedChemicals),
                  ],
                ],
              ),
            )),
          ],
        ],
      ),
    );
  }

  Widget _buildInfoSection(
      {required String title, required IconData icon, required Tone tone, required String content}) {
    if (content.isEmpty) return const SizedBox.shrink();
    final p = context.pal;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(icon, size: 18, color: context.tone(tone).$1),
            const SizedBox(width: 8),
            Text(title, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: p.ink)),
          ],
        ),
        const SizedBox(height: 8),
        Text(content, style: TextStyle(fontSize: 14, height: 1.65, color: p.body)),
      ],
    );
  }
}
